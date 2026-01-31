/**
 * Organizer Service
 * Main business logic for organizing clips in the timeline
 */

import type { ProjectItem, Sequence, ClipProjectItem } from 'premierepro';

// UXP module import for casting
const ppro = require('premierepro');
import { parseTakeName } from './takeParser';
import { parsePattern, type MediaType } from '../utils/pattern';
import { generateRandomDuration } from '../utils/time';
import {
  getActiveSequence,
  getVideoTrack,
  getTrackEndTime,
  insertClipsBatched,
  trimClipsAfterInsert,
  type BatchClipConfig,
  type ClipInfo,
} from './premiere';

// Default duration for still images in Premiere Pro (in seconds)
const DEFAULT_IMAGE_DURATION = 5;

export interface OrganizerConfig {
  videoItems: ClipInfo[];  // Changed from ProjectItem[] to ClipInfo[] for duration access
  imageItems: ClipInfo[];  // Changed from ProjectItem[] to ClipInfo[] for duration access
  pattern: string;
  randomDuration: {
    enabled: boolean;
    minSeconds: number;
    maxSeconds: number;
  };
  // Duration config for images (separate from videos)
  imageDuration?: {
    enabled: boolean;
    minSeconds: number;
    maxSeconds: number;
  };
  videoTrackIndex: number;
  audioTrackIndex: number;
  // Track indices for two-track mode (V1=videos, V2=images)
  imageTrackIndex?: number;  // If set, images go to this track instead of videoTrackIndex
}

export interface OrganizedClip {
  takeNumber: number;
  type: MediaType;
  projectItem: ProjectItem;
  plannedDuration: number | null; // null means use full duration
  originalDuration: number;
  mediaPath?: string; // Path to the media file for thumbnails
  trackIndex: number; // Which video track this clip should go to
}

export interface OrganizePreview {
  clips: OrganizedClip[];
  totalDuration: number;
  takeStats: {
    totalTakes: number;
    usedTakes: number;
    skippedTakes: number;
  };
  warnings: string[];
}

export interface OrganizeResult {
  success: boolean;
  clipsInserted: number;
  totalDuration: number;
  errors: string[];
}

/**
 * Internal type for clips with their media type
 */
interface ClipWithType {
  clip: ClipInfo;
  type: MediaType;
  takeNumber: number;
}

/**
 * Creates a preview of how clips will be organized
 * Uses GLOBAL ordering: all clips sorted by take number, respecting pattern quantities
 * Does not modify the timeline
 */
export async function createOrganizePreview(
  config: OrganizerConfig
): Promise<OrganizePreview> {
  console.log('[createOrganizePreview] Starting with GLOBAL ordering...');
  console.log('[createOrganizePreview] Video items:', config.videoItems?.length);
  console.log('[createOrganizePreview] Image items:', config.imageItems?.length);
  console.log('[createOrganizePreview] Pattern:', config.pattern);

  const warnings: string[] = [];

  // Parse the pattern
  const patternResult = parsePattern(config.pattern);
  console.log('[createOrganizePreview] Pattern parse result:', patternResult);

  if (!patternResult.isValid) {
    return {
      clips: [],
      totalDuration: 0,
      takeStats: { totalTakes: 0, usedTakes: 0, skippedTakes: 0 },
      warnings: [patternResult.error || 'Invalid pattern'],
    };
  }

  if (config.videoItems.length === 0 && config.imageItems.length === 0) {
    return {
      clips: [],
      totalDuration: 0,
      takeStats: { totalTakes: 0, usedTakes: 0, skippedTakes: 0 },
      warnings: ['No media found in selected bins.'],
    };
  }

  // Combine all clips into a single list with their types and take numbers
  const allClips: ClipWithType[] = [
    ...config.videoItems.map((clip) => ({
      clip,
      type: 'V' as MediaType,
      takeNumber: parseTakeName(clip.name) ?? Infinity,
    })),
    ...config.imageItems.map((clip) => ({
      clip,
      type: 'I' as MediaType,
      takeNumber: parseTakeName(clip.name) ?? Infinity,
    })),
  ];

  // Sort ALL clips by take number (GLOBAL ordering)
  // When same take number, video (V) comes before image (I)
  allClips.sort((a, b) => {
    if (a.takeNumber !== b.takeNumber) {
      return a.takeNumber - b.takeNumber;
    }
    // Desempate: V vem antes de I no mesmo take
    return a.type === 'V' ? -1 : 1;
  });

  console.log('[createOrganizePreview] All clips sorted globally:', allClips.length);
  console.log('[createOrganizePreview] First 10 clips in global order:');
  allClips.slice(0, 10).forEach((item, i) => {
    console.log(`  [${i}] Take ${item.takeNumber} (${item.type}): "${item.clip.name.substring(0, 40)}..."`);
  });

  // Build the organized clips list - include ALL clips in take number order
  // No quota filtering - all clips are included
  const clips: OrganizedClip[] = [];
  let totalDuration = 0;
  let videoCount = 0;
  let imageCount = 0;

  for (const item of allClips) {
    // For IMAGES: ALWAYS use fixed duration (Premiere API returns absurd 43200s)
    // For VIDEOS: use actual clip duration
    const originalDuration = item.type === 'I'
      ? DEFAULT_IMAGE_DURATION  // Always 5 seconds for images
      : (item.clip.duration > 0 ? item.clip.duration : 8);

    // Determine planned duration based on media type
    let plannedDuration: number | null = null;
    if (item.type === 'I' && config.imageDuration?.enabled) {
      // Use image-specific duration config
      plannedDuration = generateRandomDuration(
        config.imageDuration.minSeconds,
        config.imageDuration.maxSeconds
      );
    } else if (item.type === 'V' && config.randomDuration.enabled) {
      // Use video duration config
      plannedDuration = generateRandomDuration(
        config.randomDuration.minSeconds,
        config.randomDuration.maxSeconds
      );
    } else if (config.randomDuration.enabled) {
      // Fallback: use general random duration for both types
      plannedDuration = generateRandomDuration(
        config.randomDuration.minSeconds,
        config.randomDuration.maxSeconds
      );
    }

    // Determine which track this clip goes to
    // Videos go to videoTrackIndex (V1), Images go to imageTrackIndex (V2) if configured
    const trackIndex = item.type === 'I' && config.imageTrackIndex !== undefined
      ? config.imageTrackIndex
      : config.videoTrackIndex;

    // For totalDuration calculation in preview, use EFFECTIVE duration
    // (the duration that will be used after trimming is applied)
    const effectiveDuration = plannedDuration ?? originalDuration;
    totalDuration += effectiveDuration;

    // Try to get media path for thumbnails
    let mediaPath: string | undefined;
    try {
      const clipItem = ppro.ClipProjectItem.cast(item.clip.item) as ClipProjectItem | null;
      if (clipItem) {
        mediaPath = await clipItem.getMediaFilePath();
      }
    } catch {
      // Ignore errors when getting media path
    }

    clips.push({
      takeNumber: item.takeNumber,
      type: item.type,
      projectItem: item.clip.item,
      plannedDuration,
      originalDuration,
      mediaPath,
      trackIndex,
    });

    // Update counters for stats
    if (item.type === 'V') {
      videoCount++;
    } else {
      imageCount++;
    }
  }

  console.log('[createOrganizePreview] Total clips created:', clips.length);
  console.log('[createOrganizePreview] Videos:', videoCount);
  console.log('[createOrganizePreview] Images:', imageCount);
  console.log('[createOrganizePreview] Total duration:', totalDuration.toFixed(1), 's');

  // Log first 10 clips in final order
  console.log('[createOrganizePreview] Final order (first 10):');
  clips.slice(0, 10).forEach((c, i) => {
    console.log(`  [${i}] Take ${c.takeNumber} (${c.type}) - duration: ${c.originalDuration}s`);
  });

  return {
    clips,
    totalDuration,
    takeStats: {
      totalTakes: allClips.length,
      usedTakes: clips.length,
      skippedTakes: 0,
    },
    warnings,
  };
}

/**
 * Applies the organized clips to the timeline
 * Uses BATCH insertion (single transaction) to prevent crashes
 *
 * TWO-TRACK MODE: Videos go to V1 (videoTrackIndex), Images go to V2 (imageTrackIndex)
 * Each track type maintains its own timeline position, keeping clips sequential within their track
 */
export async function applyToTimeline(
  preview: OrganizePreview,
  config: Pick<OrganizerConfig, 'videoTrackIndex' | 'audioTrackIndex' | 'imageTrackIndex'>
): Promise<OrganizeResult> {
  console.log('[applyToTimeline] Starting TWO-TRACK approach...');
  console.log('[applyToTimeline] Preview clips count:', preview.clips.length);
  console.log('[applyToTimeline] Config:', config);

  // Get the active sequence
  console.log('[applyToTimeline] Getting active sequence...');
  const sequence = await getActiveSequence();
  console.log('[applyToTimeline] Sequence:', sequence ? sequence.name : 'null');

  if (!sequence) {
    return {
      success: false,
      clipsInserted: 0,
      totalDuration: 0,
      errors: ['No active sequence. Please open a sequence first.'],
    };
  }

  // Determine if we're using two-track mode
  const useTwoTracks = config.imageTrackIndex !== undefined && config.imageTrackIndex !== config.videoTrackIndex;
  console.log('[applyToTimeline] Two-track mode:', useTwoTracks ? `V${config.videoTrackIndex + 1} for videos, V${config.imageTrackIndex! + 1} for images` : 'disabled');

  // Get the current end time of BOTH tracks
  console.log('[applyToTimeline] Getting video track:', config.videoTrackIndex);
  const videoTrack = await getVideoTrack(sequence, config.videoTrackIndex);
  const videoTrackEndTime = await getTrackEndTime(videoTrack);
  console.log('[applyToTimeline] Video track end time:', videoTrackEndTime);

  let imageTrackEndTime = videoTrackEndTime;
  if (useTwoTracks) {
    console.log('[applyToTimeline] Getting image track:', config.imageTrackIndex);
    const imageTrack = await getVideoTrack(sequence, config.imageTrackIndex!);
    imageTrackEndTime = await getTrackEndTime(imageTrack);
    console.log('[applyToTimeline] Image track end time:', imageTrackEndTime);
  }

  // GLOBAL TIMELINE: Single timeline shared between V1 and V2
  // All clips are positioned on the same timeline, just on different tracks
  // This ensures proper sequencing: Take 1 (img) → Take 2 (vid) → Take 3 (img) → etc.
  let globalCurrentTime = Math.max(videoTrackEndTime, imageTrackEndTime);
  const startingTime = globalCurrentTime; // Remember for trimming phase
  console.log('[applyToTimeline] Global starting time:', globalCurrentTime);

  // Build batch configuration AND trim info together
  // This ensures each clip's expectedStartTime is captured correctly
  const batchConfigs: BatchClipConfig[] = [];
  let totalDuration = 0;

  // Build trimInfo with expectedStartTime for time-based matching
  // This fixes the bug where clips were matched by index (wrong in two-track mode)
  interface TrimInfoWithType {
    type: MediaType;
    trimInfo: {
      plannedDuration: number | null;
      originalDuration: number;
      expectedStartTime: number;
    };
  }
  const allTrimInfo: TrimInfoWithType[] = [];

  // Count clips by type for stats
  let videoClipsCount = 0;
  let imageClipsCount = 0;

  console.log('[applyToTimeline] Building batch configuration...');

  for (const clip of preview.clips) {
    if (!clip.projectItem) {
      console.warn(`[applyToTimeline] Skipping clip Take ${clip.takeNumber} - no projectItem`);
      continue;
    }

    const isImage = clip.type === 'I';
    const trackIndex = useTwoTracks && isImage ? config.imageTrackIndex! : config.videoTrackIndex;
    const audioTrackIndex = isImage ? -1 : config.audioTrackIndex; // Images don't have audio

    batchConfigs.push({
      projectItem: clip.projectItem,
      insertTimeSeconds: globalCurrentTime,  // GLOBAL timeline - same for all clips
      videoTrackIndex: trackIndex,
      audioTrackIndex: audioTrackIndex,
    });

    // Build trimInfo with expectedStartTime BEFORE incrementing globalCurrentTime
    // This is the KEY fix: expectedStartTime allows time-based matching instead of index-based
    allTrimInfo.push({
      type: clip.type,
      trimInfo: {
        plannedDuration: clip.plannedDuration,
        originalDuration: clip.originalDuration,
        expectedStartTime: globalCurrentTime,  // Capture insertion time!
      }
    });

    // Use EFFECTIVE duration for positioning (fixes gaps!)
    // If plannedDuration exists, use it; otherwise use original duration
    const spacingDuration = clip.plannedDuration ?? clip.originalDuration;

    // GLOBAL increment - advances the same timeline regardless of track
    globalCurrentTime += spacingDuration;

    // Update counters for stats
    if (isImage) {
      imageClipsCount++;
    } else {
      videoClipsCount++;
    }

    // For totalDuration, use the EFFECTIVE duration (what the clip will be after trimming)
    const effectiveDuration = clip.plannedDuration ?? clip.originalDuration;
    totalDuration += effectiveDuration;
  }

  console.log(`[applyToTimeline] Prepared ${batchConfigs.length} clips: ${videoClipsCount} videos (V${config.videoTrackIndex + 1}), ${imageClipsCount} images (V${useTwoTracks ? config.imageTrackIndex! + 1 : config.videoTrackIndex + 1})`);
  console.log(`[applyToTimeline] Total planned duration: ${totalDuration.toFixed(1)}s`);

  // Phase 1: Execute batch insert - SINGLE transaction for all clips
  const result = await insertClipsBatched(batchConfigs, sequence);
  console.log('[applyToTimeline] Batch insert result:', result);

  // Phase 2: Apply trimming if clips have planned durations (random duration feature)
  // Uses allTrimInfo with expectedStartTime for TIME-BASED matching (not index-based!)
  if (result.success && result.insertedCount > 0) {
    const clipsWithPlannedDuration = allTrimInfo.filter(t => t.trimInfo.plannedDuration !== null);

    if (clipsWithPlannedDuration.length > 0) {
      console.log(`[applyToTimeline] Phase 2: Trimming ${clipsWithPlannedDuration.length} clips...`);

      // Filter allTrimInfo by type - each entry has expectedStartTime for correct matching
      const videoTrimInfo = allTrimInfo
        .filter(t => t.type === 'V')
        .map(t => t.trimInfo);

      const imageTrimInfo = allTrimInfo
        .filter(t => t.type === 'I')
        .map(t => t.trimInfo);

      // Trim video clips on V1
      if (videoTrimInfo.length > 0) {
        console.log(`[applyToTimeline] Trimming ${videoTrimInfo.length} video clips on V${config.videoTrackIndex + 1}...`);
        const videoTrimResult = await trimClipsAfterInsert(
          sequence,
          config.videoTrackIndex,
          config.audioTrackIndex,
          startingTime,  // GLOBAL starting time
          videoTrimInfo   // Now includes expectedStartTime!
        );

        if (!videoTrimResult.success) {
          result.errors.push(...videoTrimResult.errors);
          console.warn('[applyToTimeline] Video trimming failed');
        } else {
          console.log(`[applyToTimeline] Trimmed ${videoTrimResult.trimmedCount} video clips`);
        }
      }

      // Trim image clips on V2 (or V1 if single-track mode)
      if (imageTrimInfo.length > 0) {
        const imageTrackForTrim = useTwoTracks ? config.imageTrackIndex! : config.videoTrackIndex;
        console.log(`[applyToTimeline] Trimming ${imageTrimInfo.length} image clips on V${imageTrackForTrim + 1}...`);

        const imageTrimResult = await trimClipsAfterInsert(
          sequence,
          imageTrackForTrim,
          -1, // Images don't have audio
          startingTime,  // GLOBAL starting time (same as videos)
          imageTrimInfo   // Now includes expectedStartTime!
        );

        if (!imageTrimResult.success) {
          result.errors.push(...imageTrimResult.errors);
          console.warn('[applyToTimeline] Image trimming failed');
        } else {
          console.log(`[applyToTimeline] Trimmed ${imageTrimResult.trimmedCount} image clips`);
        }
      }
    } else {
      console.log('[applyToTimeline] No clips need trimming (random duration disabled)');
    }
  }

  return {
    success: result.success,
    clipsInserted: result.insertedCount,
    totalDuration,
    errors: result.errors,
  };
}

/**
 * Main function to organize clips
 * Combines preview and apply in one operation
 */
export async function organizeClips(
  config: OrganizerConfig
): Promise<OrganizeResult> {
  // First create a preview (now async)
  const preview = await createOrganizePreview(config);

  if (preview.clips.length === 0) {
    return {
      success: false,
      clipsInserted: 0,
      totalDuration: 0,
      errors: preview.warnings,
    };
  }

  // Then apply to timeline
  return await applyToTimeline(preview, config);
}

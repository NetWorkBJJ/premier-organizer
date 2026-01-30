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
  videoTrackIndex: number;
  audioTrackIndex: number;
}

export interface OrganizedClip {
  takeNumber: number;
  type: MediaType;
  projectItem: ProjectItem;
  plannedDuration: number | null; // null means use full duration
  originalDuration: number;
  mediaPath?: string; // Path to the media file for thumbnails
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
  allClips.sort((a, b) => a.takeNumber - b.takeNumber);

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

    let plannedDuration: number | null = null;
    if (config.randomDuration.enabled) {
      plannedDuration = generateRandomDuration(
        config.randomDuration.minSeconds,
        config.randomDuration.maxSeconds
      );
    }

    // For totalDuration calculation in preview, use originalDuration
    // (since batch insert doesn't apply trimming)
    totalDuration += originalDuration;

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
 */
export async function applyToTimeline(
  preview: OrganizePreview,
  config: Pick<OrganizerConfig, 'videoTrackIndex' | 'audioTrackIndex'>
): Promise<OrganizeResult> {
  console.log('[applyToTimeline] Starting BATCH approach...');
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

  // Get the current end time of the track to append after existing content
  console.log('[applyToTimeline] Getting video track:', config.videoTrackIndex);
  const videoTrack = await getVideoTrack(sequence, config.videoTrackIndex);
  console.log('[applyToTimeline] Video track obtained:', videoTrack ? 'success' : 'null');

  console.log('[applyToTimeline] Getting track end time...');
  const trackEndTime = await getTrackEndTime(videoTrack);
  console.log('[applyToTimeline] Track end time:', trackEndTime);

  // Build batch configuration - calculate insert times for all clips
  const batchConfigs: BatchClipConfig[] = [];
  let currentTime = trackEndTime;
  let totalDuration = 0;

  console.log('[applyToTimeline] Building batch configuration...');
  for (const clip of preview.clips) {
    if (!clip.projectItem) {
      console.warn(`[applyToTimeline] Skipping clip Take ${clip.takeNumber} - no projectItem`);
      continue;
    }

    batchConfigs.push({
      projectItem: clip.projectItem,
      insertTimeSeconds: currentTime,
      videoTrackIndex: config.videoTrackIndex,
      audioTrackIndex: config.audioTrackIndex,
    });

    // Move timeline position forward using the ORIGINAL duration
    // IMPORTANT: Batch insert does not apply trimming - clips are inserted at full duration
    // Therefore we must use originalDuration to calculate positions, not plannedDuration
    // This ensures no gaps between clips
    currentTime += clip.originalDuration;
    totalDuration += clip.originalDuration;
  }

  console.log(`[applyToTimeline] Prepared ${batchConfigs.length} clips for batch insert`);

  // Execute batch insert - SINGLE transaction for all clips
  const result = await insertClipsBatched(batchConfigs, sequence);

  console.log('[applyToTimeline] Batch insert result:', result);

  // Note: Random duration trimming is not applied in batch mode
  // Clips are inserted at their original duration
  // This is a trade-off for stability - trimming can be added later if needed

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

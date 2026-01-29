/**
 * Organizer Service
 * Main business logic for organizing clips in the timeline
 */

import type { ProjectItem, Sequence } from 'premierepro';
import { matchTakes, type TakeMatch } from './takeParser';
import { parsePattern, expandPattern, type MediaType } from '../utils/pattern';
import { generateRandomDuration } from '../utils/time';
import {
  getActiveSequence,
  getVideoTrack,
  getTrackEndTime,
  insertClipToTimeline,
  findClipAtTime,
  setClipOutPoint,
} from './premiere';

export interface OrganizerConfig {
  videoItems: ProjectItem[];
  imageItems: ProjectItem[];
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
 * Creates a preview of how clips will be organized
 * Does not modify the timeline
 */
export function createOrganizePreview(
  config: OrganizerConfig
): OrganizePreview {
  const warnings: string[] = [];

  // Parse the pattern
  const patternResult = parsePattern(config.pattern);
  if (!patternResult.isValid) {
    return {
      clips: [],
      totalDuration: 0,
      takeStats: { totalTakes: 0, usedTakes: 0, skippedTakes: 0 },
      warnings: [patternResult.error || 'Invalid pattern'],
    };
  }

  // Match videos and images by take number
  const takeMatches = matchTakes(config.videoItems, config.imageItems);

  if (takeMatches.length === 0) {
    return {
      clips: [],
      totalDuration: 0,
      takeStats: { totalTakes: 0, usedTakes: 0, skippedTakes: 0 },
      warnings: ['No takes found. Make sure files follow "(TAKE N) ..." naming.'],
    };
  }

  // Expand pattern to cover all takes
  const expandedPattern = expandPattern(patternResult.pattern, takeMatches.length);

  // Build the organized clips list
  const clips: OrganizedClip[] = [];
  let totalDuration = 0;
  let usedTakes = 0;
  let skippedTakes = 0;

  for (let i = 0; i < takeMatches.length; i++) {
    const take = takeMatches[i];
    const mediaType = expandedPattern[i];

    // Get the appropriate item based on pattern
    let projectItem: ProjectItem | null = null;
    if (mediaType === 'V') {
      projectItem = take.video;
      if (!projectItem && take.image) {
        warnings.push(`Take ${take.takeNumber}: No video, using image instead`);
        projectItem = take.image;
      }
    } else {
      projectItem = take.image;
      if (!projectItem && take.video) {
        warnings.push(`Take ${take.takeNumber}: No image, using video instead`);
        projectItem = take.video;
      }
    }

    if (!projectItem) {
      warnings.push(`Take ${take.takeNumber}: Skipped - no media available`);
      skippedTakes++;
      continue;
    }

    // Determine duration
    const originalDuration = 8; // Default AI media duration
    let plannedDuration: number | null = null;

    if (config.randomDuration.enabled) {
      // Apply random duration to videos and images
      plannedDuration = generateRandomDuration(
        config.randomDuration.minSeconds,
        config.randomDuration.maxSeconds
      );
    }

    const effectiveDuration = plannedDuration ?? originalDuration;
    totalDuration += effectiveDuration;

    clips.push({
      takeNumber: take.takeNumber,
      type: mediaType,
      projectItem,
      plannedDuration,
      originalDuration,
    });

    usedTakes++;
  }

  return {
    clips,
    totalDuration,
    takeStats: {
      totalTakes: takeMatches.length,
      usedTakes,
      skippedTakes,
    },
    warnings,
  };
}

/**
 * Applies the organized clips to the timeline
 */
export async function applyToTimeline(
  preview: OrganizePreview,
  config: Pick<OrganizerConfig, 'videoTrackIndex' | 'audioTrackIndex'>
): Promise<OrganizeResult> {
  const errors: string[] = [];
  let clipsInserted = 0;
  let currentTime = 0;

  // Get the active sequence
  const sequence = await getActiveSequence();
  if (!sequence) {
    return {
      success: false,
      clipsInserted: 0,
      totalDuration: 0,
      errors: ['No active sequence. Please open a sequence first.'],
    };
  }

  // Get the current end time of the track to append after existing content
  const videoTrack = await getVideoTrack(sequence, config.videoTrackIndex);
  const trackEndTime = await getTrackEndTime(videoTrack);
  currentTime = trackEndTime;

  // Insert each clip
  for (const clip of preview.clips) {
    try {
      // Images don't have audio, use -1 for audioTrackIndex
      const audioTrack = clip.type === 'I' ? -1 : config.audioTrackIndex;

      // Insert the clip
      await insertClipToTimeline(
        clip.projectItem,
        sequence,
        config.videoTrackIndex,
        audioTrack,
        currentTime
      );

      // If we need to trim the clip (random duration)
      if (clip.plannedDuration !== null) {
        // Find the just-inserted clip
        const insertedClip = await findClipAtTime(videoTrack, currentTime + 0.1);
        if (insertedClip) {
          // Calculate the new out point relative to clip's in point
          const inPoint = await insertedClip.getInPoint();
          const newOutPointSeconds = inPoint.seconds + clip.plannedDuration;
          await setClipOutPoint(insertedClip, newOutPointSeconds);
        }
      }

      // Move timeline position forward
      const effectiveDuration = clip.plannedDuration ?? clip.originalDuration;
      currentTime += effectiveDuration;
      clipsInserted++;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Take ${clip.takeNumber}: ${errorMsg}`);
    }
  }

  return {
    success: errors.length === 0,
    clipsInserted,
    totalDuration: currentTime - trackEndTime,
    errors,
  };
}

/**
 * Main function to organize clips
 * Combines preview and apply in one operation
 */
export async function organizeClips(
  config: OrganizerConfig
): Promise<OrganizeResult> {
  // First create a preview
  const preview = createOrganizePreview(config);

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

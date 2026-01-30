/**
 * Premiere Pro API Wrapper Service
 * Provides a simplified interface for common Premiere Pro operations
 */

import type {
  Project,
  Sequence,
  ProjectItem,
  VideoTrack,
  TrackItem,
  TickTime,
} from 'premierepro';

// UXP module import
const ppro = require('premierepro');

export interface BinInfo {
  item: ProjectItem;
  name: string;
  path: string;
  itemCount: number;
}

export interface ClipInfo {
  item: ProjectItem;
  name: string;
  duration: number;
  hasVideo: boolean;
  hasAudio: boolean;
}

/**
 * Configuration for a single clip in a batch insert operation
 */
export interface BatchClipConfig {
  projectItem: ProjectItem;
  insertTimeSeconds: number;
  videoTrackIndex: number;
  audioTrackIndex: number;
}

/**
 * Result of a batch insert operation
 */
export interface BatchResult {
  success: boolean;
  insertedCount: number;
  failedCount: number;
  errors: string[];
}

/**
 * Gets the currently active project
 */
export async function getActiveProject(): Promise<Project | null> {
  return await ppro.Project.getActiveProject();
}

/**
 * Gets the active sequence from the active project
 */
export async function getActiveSequence(): Promise<Sequence | null> {
  const project = await getActiveProject();
  if (!project) return null;
  return await project.getActiveSequence();
}

/**
 * Gets all bins (folders) from the project
 */
export async function getAllBins(): Promise<BinInfo[]> {
  const project = await getActiveProject();
  if (!project) return [];

  const rootItem = await project.getRootItem();
  const bins: BinInfo[] = [];

  // rootItem is already a FolderItem
  await collectBins(rootItem, '', bins);

  return bins;
}

/**
 * Recursively collects all bins from a folder item
 * Uses ppro.FolderItem.cast() to convert ProjectItems to FolderItems
 */
async function collectBins(
  folderItem: any,
  parentPath: string,
  bins: BinInfo[]
): Promise<void> {
  // Use getItems() - this is the correct UXP API
  const children = await folderItem.getItems();

  for (const child of children) {
    // Try to cast child to FolderItem to check if it's a folder/bin
    const childFolder = ppro.FolderItem.cast(child);

    if (childFolder) {
      // It's a folder/bin
      const path = parentPath ? `${parentPath}/${child.name}` : child.name;

      // Get items inside this folder to count clips
      const folderItems = await childFolder.getItems();
      const clipCount = folderItems.filter(
        (c: any) => !ppro.FolderItem.cast(c) // Items that are NOT folders are clips
      ).length;

      bins.push({
        item: child,
        name: child.name,
        path: path,
        itemCount: clipCount,
      });

      // Recurse into sub-bins
      await collectBins(childFolder, path, bins);
    }
  }
}

/**
 * Gets all clips from a specific bin
 */
export async function getClipsFromBin(bin: ProjectItem): Promise<ClipInfo[]> {
  console.log('[getClipsFromBin] ====== START ======');
  console.log('[getClipsFromBin] Bin name:', bin?.name);
  console.log('[getClipsFromBin] Bin nodeId:', bin?.nodeId);

  // Cast to FolderItem to access getItems()
  const folderItem = ppro.FolderItem.cast(bin);
  console.log('[getClipsFromBin] FolderItem cast:', folderItem ? 'success' : 'null');

  if (!folderItem) {
    console.log('[getClipsFromBin] FAILED: Could not cast to FolderItem');
    return [];
  }

  const children = await folderItem.getItems();
  console.log('[getClipsFromBin] Raw children count:', children?.length);

  const clips: ClipInfo[] = [];
  let skippedFolders = 0;
  let skippedNoClipCast = 0;
  let skippedErrors = 0;

  for (const child of children) {
    // Skip if it's a folder
    if (ppro.FolderItem.cast(child)) {
      skippedFolders++;
      continue;
    }

    try {
      // Cast to ClipProjectItem to access media properties
      const clipItem = ppro.ClipProjectItem.cast(child);

      if (!clipItem) {
        skippedNoClipCast++;
        console.log(`[getClipsFromBin] SKIP: "${child.name}" - ClipProjectItem cast failed (type: ${child.type})`);
        continue;
      }

      const media = await clipItem.getMedia();

      // IMPORTANT: media.duration returns a Promise in UXP API
      const duration = media ? await media.duration : null;

      clips.push({
        item: child,
        name: child.name,
        duration: duration ? duration.seconds : 0,
        hasVideo: true,
        hasAudio: true,
      });
    } catch (e) {
      skippedErrors++;
      console.error(`[getClipsFromBin] ERROR: "${child.name}":`, e);
    }
  }

  console.log('[getClipsFromBin] ====== SUMMARY ======');
  console.log(`[getClipsFromBin] Bin: "${bin?.name}"`);
  console.log(`[getClipsFromBin] Raw items: ${children?.length}`);
  console.log(`[getClipsFromBin] Skipped folders: ${skippedFolders}`);
  console.log(`[getClipsFromBin] Skipped no-cast: ${skippedNoClipCast}`);
  console.log(`[getClipsFromBin] Skipped errors: ${skippedErrors}`);
  console.log(`[getClipsFromBin] Final clips: ${clips.length}`);
  console.log('[getClipsFromBin] ====== END ======');

  return clips;
}

/**
 * Creates a TickTime from seconds
 * NOTE: Uses createWithSeconds (not fromSeconds) per official Adobe UXP API
 */
export function createTickTime(seconds: number): TickTime {
  return ppro.TickTime.createWithSeconds(seconds);
}

/**
 * Inserts a project item into the timeline at the specified position
 * Uses UXP pattern: lockedAccess + executeTransaction + compoundAction
 * Based on official Adobe samples: https://github.com/AdobeDocs/uxp-premiere-pro-samples
 */
export async function insertClipToTimeline(
  projectItem: ProjectItem,
  sequence: Sequence,
  videoTrackIndex: number,
  audioTrackIndex: number,
  insertTimeSeconds: number
): Promise<void> {
  const project = await getActiveProject();
  if (!project) throw new Error('No active project');

  console.log('[INSERT] Debug - ProjectItem:', {
    name: projectItem.name,
    type: projectItem.type,
    nodeId: projectItem.nodeId,
  });

  // Cast to ClipProjectItem - required by Adobe UXP API
  const clipItem = ppro.ClipProjectItem.cast(projectItem);

  console.log('[INSERT] Debug - ClipProjectItem cast result:', clipItem ? 'success' : 'null');

  if (!clipItem) {
    throw new Error(
      `Item "${projectItem.name}" is not a valid clip (type: ${projectItem.type})`
    );
  }

  console.log('[INSERT] Debug - Creating TickTime for:', insertTimeSeconds);
  const insertTime = createTickTime(insertTimeSeconds);
  console.log('[INSERT] Debug - TickTime created:', insertTime);

  // SYNC - getEditor is synchronous per official Adobe samples
  console.log('[INSERT] Debug - Getting SequenceEditor');
  const seqEditor = ppro.SequenceEditor.getEditor(sequence);
  if (!seqEditor) throw new Error('SequenceEditor not available');
  console.log('[INSERT] Debug - SequenceEditor obtained');

  console.log(
    `[INSERT] Inserting ${clipItem.name} at ${insertTimeSeconds}s on V${videoTrackIndex}/A${audioTrackIndex}`
  );

  // Callbacks are SYNCHRONOUS per official Adobe pattern
  let success = false;
  let lastError: Error | null = null;

  try {
    project.lockedAccess(() => {
      console.log('[INSERT] Debug - Inside lockedAccess');
      try {
        success = project.executeTransaction((compoundAction: any) => {
          console.log('[INSERT] Debug - Inside executeTransaction');
          console.log('[INSERT] Debug - Creating action with params:', {
            clipName: clipItem.name,
            insertTimeSeconds,
            videoTrackIndex,
            audioTrackIndex,
          });

          const action = seqEditor.createInsertProjectItemAction(
            clipItem,
            insertTime,
            videoTrackIndex,
            audioTrackIndex,
            false
          );

          console.log('[INSERT] Debug - Action created:', action);
          compoundAction.addAction(action);
          console.log('[INSERT] Debug - Action added to compound');
        }, 'Insert Clip');
        console.log('[INSERT] Debug - executeTransaction result:', success);
      } catch (txError) {
        console.error('[INSERT] Error in executeTransaction:', txError);
        lastError = txError instanceof Error ? txError : new Error(String(txError));
      }
    });
  } catch (lockError) {
    console.error('[INSERT] Error in lockedAccess:', lockError);
    lastError = lockError instanceof Error ? lockError : new Error(String(lockError));
  }

  if (lastError) {
    throw lastError;
  }

  if (!success) {
    throw new Error(`Transaction failed for: ${clipItem.name}`);
  }

  console.log(`[INSERT] ✓ Success: ${clipItem.name}`);
}

/**
 * Inserts multiple clips into the timeline in a SINGLE transaction
 * This is the correct pattern for batch operations - prevents crashes
 * Uses ONE lockedAccess + ONE executeTransaction for ALL clips
 */
export async function insertClipsBatched(
  clips: BatchClipConfig[],
  sequence: Sequence
): Promise<BatchResult> {
  const project = await getActiveProject();
  if (!project) {
    return {
      success: false,
      insertedCount: 0,
      failedCount: clips.length,
      errors: ['No active project'],
    };
  }

  if (clips.length === 0) {
    return {
      success: true,
      insertedCount: 0,
      failedCount: 0,
      errors: [],
    };
  }

  console.log(`[BATCH INSERT] Starting batch insert of ${clips.length} clips`);

  // Get the sequence editor ONCE
  const seqEditor = ppro.SequenceEditor.getEditor(sequence);
  if (!seqEditor) {
    return {
      success: false,
      insertedCount: 0,
      failedCount: clips.length,
      errors: ['SequenceEditor not available'],
    };
  }

  // Pre-validate clips BEFORE the transaction
  // IMPORTANT: Do NOT cast to ClipProjectItem - pass ProjectItem directly per Adobe official samples
  // See: https://github.com/AdobeDocs/uxp-premiere-pro-samples/blob/main/sample-panels/premiere-api/html/src/sequenceEditor.ts
  const preparedClips: Array<{
    projectItem: ProjectItem;
    config: BatchClipConfig;
  }> = [];
  const errors: string[] = [];

  console.log('[BATCH INSERT] Pre-validating clips...');
  for (let i = 0; i < clips.length; i++) {
    const config = clips[i];

    // Log first few items for debugging
    if (i < 3) {
      console.log(`[BATCH INSERT] Clip ${i}:`, {
        name: config.projectItem?.name?.substring(0, 50),
        type: config.projectItem?.type,
        insertTime: config.insertTimeSeconds,
        videoTrack: config.videoTrackIndex,
        audioTrack: config.audioTrackIndex,
      });
    }

    // Validate that projectItem exists
    if (!config.projectItem) {
      errors.push(`Clip ${i} has no projectItem`);
      continue;
    }

    // NOTE: Don't cast to ClipProjectItem - pass ProjectItem directly
    // NOTE: Don't create TickTime here - create it inside the transaction
    preparedClips.push({
      projectItem: config.projectItem,
      config,
    });
  }

  if (preparedClips.length === 0) {
    return {
      success: false,
      insertedCount: 0,
      failedCount: clips.length,
      errors,
    };
  }

  console.log(`[BATCH INSERT] Prepared ${preparedClips.length} clips for insertion`);

  // Execute ONE transaction with ALL actions
  let success = false;
  let lastError: Error | null = null;
  let actionsAdded = 0;

  try {
    project.lockedAccess(() => {
      console.log('[BATCH INSERT] Inside lockedAccess - starting single transaction');
      try {
        success = project.executeTransaction((compoundAction: any) => {
          console.log(`[BATCH INSERT] Inside executeTransaction - adding ${preparedClips.length} actions`);

          for (let i = 0; i < preparedClips.length; i++) {
            const prepared = preparedClips[i];
            try {
              // Create TickTime INSIDE the transaction (may be required by UXP)
              const insertTime = createTickTime(prepared.config.insertTimeSeconds);

              // Log parameters for first clip to debug
              if (i === 0) {
                console.log('[BATCH INSERT] First clip params:', {
                  projectItemName: prepared.projectItem?.name,
                  projectItemType: prepared.projectItem?.type,
                  insertTimeType: typeof insertTime,
                  insertTimeSeconds: insertTime?.seconds,
                  insertTimeTicks: insertTime?.ticks,
                  videoTrackIndex: prepared.config.videoTrackIndex,
                  audioTrackIndex: prepared.config.audioTrackIndex,
                  seqEditorType: typeof seqEditor,
                });
              }

              // Use OVERWRITE action to ensure clips are placed EXACTLY at specified time
              // This prevents Premiere from pushing clips to different positions
              // which was causing the trim matching to fail
              const action = seqEditor.createOverwriteItemAction(
                prepared.projectItem,
                insertTime,
                prepared.config.videoTrackIndex,
                prepared.config.audioTrackIndex
              );
              compoundAction.addAction(action);
              actionsAdded++;

              // Log success for first few
              if (i < 3) {
                console.log(`[BATCH INSERT] Action ${i} created successfully`);
              }
            } catch (actionError) {
              // Only log first 3 errors to avoid spam
              if (errors.length < 3) {
                console.error(`[BATCH INSERT] Failed clip ${i} "${prepared.projectItem?.name?.substring(0, 40)}":`, actionError);
              }
              errors.push(`Failed to create action for "${prepared.projectItem.name}"`);
            }
          }

          console.log(`[BATCH INSERT] Added ${actionsAdded} actions to compound`);
        }, 'Batch Insert Clips');

        console.log('[BATCH INSERT] Transaction result:', success);
      } catch (txError) {
        console.error('[BATCH INSERT] Error in executeTransaction:', txError);
        lastError = txError instanceof Error ? txError : new Error(String(txError));
      }
    });
  } catch (lockError) {
    console.error('[BATCH INSERT] Error in lockedAccess:', lockError);
    lastError = lockError instanceof Error ? lockError : new Error(String(lockError));
  }

  if (lastError) {
    errors.push(lastError.message);
  }

  const result: BatchResult = {
    success: success && actionsAdded > 0,
    insertedCount: success ? actionsAdded : 0,
    failedCount: clips.length - (success ? actionsAdded : 0),
    errors,
  };

  console.log(`[BATCH INSERT] Complete:`, result);
  return result;
}

/**
 * Sets the out point of a track item to create a cut
 * Uses UXP pattern: lockedAccess + executeTransaction + compoundAction
 */
export async function setClipOutPoint(
  trackItem: TrackItem,
  outPointSeconds: number
): Promise<void> {
  const project = await getActiveProject();
  if (!project) throw new Error('No active project');

  const outPoint = createTickTime(outPointSeconds);

  console.log(`[TRIM] Setting outpoint to ${outPointSeconds}s`);

  // Callbacks are SYNCHRONOUS per official Adobe pattern
  let success = false;
  project.lockedAccess(() => {
    success = project.executeTransaction((compoundAction: any) => {
      const action = trackItem.createSetOutPointAction(outPoint);
      compoundAction.addAction(action);
    }, 'Set Out Point');
  });

  if (!success) {
    throw new Error(`setClipOutPoint failed at ${outPointSeconds}s`);
  }

  console.log(`[TRIM] ✓ Success`);
}

/**
 * Gets the video track at the specified index
 */
export async function getVideoTrack(
  sequence: Sequence,
  index: number
): Promise<VideoTrack> {
  return await sequence.getVideoTrack(index);
}

/**
 * Gets all track items from a video track
 * NOTE: UXP API requires trackItemType and includeEmptyTrackItems parameters
 */
export async function getTrackItems(track: VideoTrack): Promise<TrackItem[]> {
  return await track.getTrackItems(
    ppro.Constants.TrackItemType.CLIP,
    false // don't include empty track items
  );
}

/**
 * Gets the end time of the last clip in a track
 */
export async function getTrackEndTime(track: VideoTrack): Promise<number> {
  console.log('[getTrackEndTime] Track:', track);
  console.log('[getTrackEndTime] Track type:', typeof track);

  try {
    const items = await track.getTrackItems(
      ppro.Constants.TrackItemType.CLIP,
      false
    );
    console.log('[getTrackEndTime] Items count:', items?.length);

    if (!items || items.length === 0) return 0;

    let maxEndTime = 0;
    for (const item of items) {
      const endTime = await item.getEndTime();
      if (endTime.seconds > maxEndTime) {
        maxEndTime = endTime.seconds;
      }
    }

    return maxEndTime;
  } catch (error) {
    console.error('[getTrackEndTime] Error getting track items:', error);
    console.log('[getTrackEndTime] Falling back to start of timeline (0)');
    return 0; // Fallback: inserir no início
  }
}

/**
 * Removes track items from the timeline
 * Uses UXP pattern: lockedAccess + executeTransaction + compoundAction
 */
export async function removeTrackItems(items: TrackItem[]): Promise<void> {
  if (items.length === 0) return;

  const project = await getActiveProject();
  if (!project) throw new Error('No active project');

  console.log(`[REMOVE] Removing ${items.length} items`);

  // Callbacks are SYNCHRONOUS per official Adobe pattern
  let success = false;
  project.lockedAccess(() => {
    success = project.executeTransaction((compoundAction: any) => {
      const action = ppro.SequenceEditor.createRemoveItemsAction(items);
      compoundAction.addAction(action);
    }, 'Remove Items');
  });

  if (!success) {
    throw new Error(`removeTrackItems failed`);
  }

  console.log(`[REMOVE] ✓ Success`);
}

/**
 * Gets the frame rate of the sequence
 */
export async function getSequenceFrameRate(sequence: Sequence): Promise<number> {
  return await sequence.getTimebase();
}

/**
 * Finds the clip at a specific time position on a track
 */
export async function findClipAtTime(
  track: VideoTrack,
  timeSeconds: number
): Promise<TrackItem | null> {
  const items = await track.getTrackItems(
    ppro.Constants.TrackItemType.CLIP,
    false
  );

  for (const item of items) {
    const startTime = await item.getStartTime();
    const endTime = await item.getEndTime();

    // Check if the time falls within this clip
    if (startTime.seconds <= timeSeconds && endTime.seconds >= timeSeconds) {
      return item;
    }
  }

  return null;
}

/**
 * Checks if Premiere Pro is available and ready
 */
export async function isPremiereReady(): Promise<boolean> {
  try {
    const project = await getActiveProject();
    return project !== null;
  } catch {
    return false;
  }
}

/**
 * Result of a trim operation
 */
export interface TrimResult {
  success: boolean;
  trimmedCount: number;
  errors: string[];
}

/**
 * Clip info for trimming operation
 */
export interface TrimClipInfo {
  plannedDuration: number | null;
  originalDuration: number;
  expectedStartTime: number;  // Time when this clip was inserted (for matching)
}

/**
 * Trims clips after batch insertion to match planned durations
 * Finds clips by their start time and applies out point trimming
 *
 * This enables the "random duration" feature by trimming each clip
 * to its planned duration after insertion.
 *
 * IMPORTANT: Trims BOTH video AND audio tracks to keep them in sync.
 * This allows Close Gap to work correctly with Linked Selection enabled.
 *
 * @param sequence - The sequence containing the clips
 * @param videoTrackIndex - Which video track to look for clips
 * @param audioTrackIndex - Which audio track to trim (linked clips)
 * @param startingTime - The time where the first clip was inserted
 * @param clips - Array of clip info with planned and original durations
 */
export async function trimClipsAfterInsert(
  sequence: Sequence,
  videoTrackIndex: number,
  audioTrackIndex: number,
  startingTime: number,
  clips: TrimClipInfo[]
): Promise<TrimResult> {
  console.log('[TRIM] Starting trim operation...');
  console.log(`[TRIM] Starting time: ${startingTime}s, Clips to process: ${clips.length}`);
  console.log(`[TRIM] Video track: V${videoTrackIndex}, Audio track: A${audioTrackIndex}`);

  const project = await getActiveProject();
  if (!project) {
    return { success: false, trimmedCount: 0, errors: ['No active project'] };
  }

  // Get the video track and all its items
  const track = await getVideoTrack(sequence, videoTrackIndex);
  const trackItems = await track.getTrackItems(
    ppro.Constants.TrackItemType.CLIP,
    false
  );

  console.log(`[TRIM] Found ${trackItems.length} track items on V${videoTrackIndex}`);

  // Get the audio track and all its items (only if audioTrackIndex is valid)
  // audioTrackIndex = -1 means no audio (e.g., images)
  let audioTrackItems: TrackItem[] = [];
  if (audioTrackIndex >= 0) {
    const audioTrack = await sequence.getAudioTrack(audioTrackIndex);
    audioTrackItems = await audioTrack.getTrackItems(
      ppro.Constants.TrackItemType.CLIP,
      false
    );
    console.log(`[TRIM] Found ${audioTrackItems.length} track items on A${audioTrackIndex}`);
  } else {
    console.log(`[TRIM] No audio track (audioTrackIndex=${audioTrackIndex})`);
  }

  // Build a map of start time → TrackItem for VIDEO
  // We need to resolve all start times first (async)
  const videoItemsByStartTime: Array<{ startTime: number; item: TrackItem }> = [];

  for (const item of trackItems) {
    const startTime = await item.getStartTime();
    videoItemsByStartTime.push({
      startTime: startTime.seconds,
      item
    });
  }

  // Sort by start time for easier debugging
  videoItemsByStartTime.sort((a, b) => a.startTime - b.startTime);

  // Build a map of start time → TrackItem for AUDIO
  const audioItemsByStartTime: Array<{ startTime: number; item: TrackItem }> = [];

  for (const item of audioTrackItems) {
    const startTime = await item.getStartTime();
    audioItemsByStartTime.push({
      startTime: startTime.seconds,
      item
    });
  }

  // Sort by start time
  audioItemsByStartTime.sort((a, b) => a.startTime - b.startTime);

  console.log('[TRIM] Video track items by start time (first 5):');
  videoItemsByStartTime.slice(0, 5).forEach((entry, i) => {
    console.log(`  [${i}] ${entry.startTime.toFixed(2)}s`);
  });

  // Filter clips that are at or after startingTime (our inserted clips)
  // Use small tolerance for floating point comparison
  const videoClipsAfterStart = videoItemsByStartTime.filter(
    (e) => e.startTime >= startingTime - 0.1
  );

  const audioClipsAfterStart = audioItemsByStartTime.filter(
    (e) => e.startTime >= startingTime - 0.1
  );

  console.log(`[TRIM] Found ${videoClipsAfterStart.length} video clips after starting time ${startingTime}s`);
  console.log(`[TRIM] Found ${audioClipsAfterStart.length} audio clips after starting time ${startingTime}s`);

  // Build list of trim actions to apply
  // PRIMARY: Match clips by EXPECTED START TIME
  // FALLBACK: If time matching fails, use ORDER-BASED matching
  const trimActions: Array<{
    videoTrackItem: TrackItem;
    audioTrackItem: TrackItem | null;
    startTime: number;
    plannedDuration: number;
  }> = [];

  const TOLERANCE = 0.5; // 0.5 second tolerance for floating point comparison

  // Filter clips that need trimming (have plannedDuration)
  const clipsToTrim = clips.filter(c => c.plannedDuration !== null);
  console.log(`[TRIM] Clips that need trimming: ${clipsToTrim.length}`);

  // Try time-based matching first
  let timeMatchCount = 0;
  const usedVideoIndices = new Set<number>();

  for (let i = 0; i < clipsToTrim.length; i++) {
    const clipInfo = clipsToTrim[i];

    // Find video clip by EXPECTED START TIME
    const videoEntryIndex = videoClipsAfterStart.findIndex(
      (e) => Math.abs(e.startTime - clipInfo.expectedStartTime) < TOLERANCE
    );

    if (videoEntryIndex !== -1) {
      timeMatchCount++;
      usedVideoIndices.add(videoEntryIndex);
    }
  }

  console.log(`[TRIM] Time-based matching: ${timeMatchCount}/${clipsToTrim.length} clips matched`);

  // Decide matching strategy
  const useOrderMatching = timeMatchCount < clipsToTrim.length * 0.5; // If less than 50% matched by time

  if (useOrderMatching) {
    console.log(`[TRIM] Using ORDER-BASED matching (time matching failed for most clips)`);

    // Match by ORDER: first trimInfo → first clip on timeline, etc.
    const numToMatch = Math.min(clipsToTrim.length, videoClipsAfterStart.length);

    for (let i = 0; i < numToMatch; i++) {
      const clipInfo = clipsToTrim[i];
      const videoEntry = videoClipsAfterStart[i];

      // Find corresponding audio clip at same start time
      const audioEntry = audioClipsAfterStart.find(
        (a) => Math.abs(a.startTime - videoEntry.startTime) < TOLERANCE
      ) || null;

      if (i < 5) {
        console.log(`[TRIM] Clip ${i} (ORDER): timeline@${videoEntry.startTime.toFixed(2)}s, planned=${clipInfo.plannedDuration!.toFixed(1)}s, audio=${audioEntry ? 'YES' : 'NO'}`);
      }

      trimActions.push({
        videoTrackItem: videoEntry.item,
        audioTrackItem: audioEntry?.item || null,
        startTime: videoEntry.startTime,
        plannedDuration: clipInfo.plannedDuration!,
      });
    }
  } else {
    console.log(`[TRIM] Using TIME-BASED matching`);

    // Match by EXPECTED START TIME
    for (let i = 0; i < clipsToTrim.length; i++) {
      const clipInfo = clipsToTrim[i];

      const videoEntry = videoClipsAfterStart.find(
        (e) => Math.abs(e.startTime - clipInfo.expectedStartTime) < TOLERANCE
      );

      if (!videoEntry) {
        console.warn(`[TRIM] Clip ${i}: NOT FOUND at expected time ${clipInfo.expectedStartTime.toFixed(2)}s`);
        continue;
      }

      const audioEntry = audioClipsAfterStart.find(
        (a) => Math.abs(a.startTime - clipInfo.expectedStartTime) < TOLERANCE
      ) || null;

      if (i < 5) {
        console.log(`[TRIM] Clip ${i} (TIME): expected@${clipInfo.expectedStartTime.toFixed(2)}s, found@${videoEntry.startTime.toFixed(2)}s, audio=${audioEntry ? 'YES' : 'NO'}`);
      }

      trimActions.push({
        videoTrackItem: videoEntry.item,
        audioTrackItem: audioEntry?.item || null,
        startTime: videoEntry.startTime,
        plannedDuration: clipInfo.plannedDuration!,
      });
    }
  }

  console.log(`[TRIM] Prepared ${trimActions.length} trim actions`);

  // Apply all trims in ONE transaction
  if (trimActions.length === 0) {
    console.log('[TRIM] No clips to trim');
    return { success: true, trimmedCount: 0, errors: [] };
  }

  // PHASE 1: Get current endTime for each clip BEFORE the transaction
  // Following Adobe's official sample: use getEndTime() then calculate new end
  // See: https://github.com/AdobeDocs/uxp-premiere-pro-samples/blob/main/sample-panels/premiere-api/html/src/sequence.ts
  console.log('[TRIM] Phase 1: Getting current endTimes (async)...');

  const trimData: Array<{
    videoTrackItem: TrackItem;
    audioTrackItem: TrackItem | null;
    currentStartSeconds: number;
    currentEndSeconds: number;
    currentDurationSeconds: number;
    plannedDuration: number;
  }> = [];

  for (let i = 0; i < trimActions.length; i++) {
    const action = trimActions[i];
    try {
      // IMPORTANT: Read BOTH startTime and endTime fresh to ensure consistency
      // Using stale startTime values was causing incorrect duration calculations
      const currentStart = await action.videoTrackItem.getStartTime();
      const currentEnd = await action.videoTrackItem.getEndTime();
      const currentDuration = currentEnd.seconds - currentStart.seconds;

      trimData.push({
        videoTrackItem: action.videoTrackItem,
        audioTrackItem: action.audioTrackItem,
        currentStartSeconds: currentStart.seconds,
        currentEndSeconds: currentEnd.seconds,
        currentDurationSeconds: currentDuration,
        plannedDuration: action.plannedDuration,
      });

      if (i < 3) {
        console.log(`[TRIM] Clip ${i}: start=${currentStart.seconds.toFixed(2)}s, end=${currentEnd.seconds.toFixed(2)}s, duration=${currentDuration.toFixed(1)}s, target=${action.plannedDuration.toFixed(1)}s`);
      }
    } catch (err) {
      console.error(`[TRIM] Failed to get times for clip ${i}:`, err);
    }
  }

  // PHASE 2: Apply trims using Adobe's approach (subtract from current end)
  console.log('[TRIM] Phase 2: Applying trims (sync transaction)...');
  let success = false;
  let trimmedCount = 0;
  const errors: string[] = [];

  try {
    project.lockedAccess(() => {
      console.log('[TRIM] Inside lockedAccess - starting trim transaction');
      try {
        success = project.executeTransaction((compoundAction: any) => {
          console.log(`[TRIM] Inside executeTransaction - adding ${trimData.length} trim actions`);

          for (let i = 0; i < trimData.length; i++) {
            const { videoTrackItem, audioTrackItem, currentStartSeconds, currentDurationSeconds, plannedDuration } = trimData[i];
            try {
              // Skip if clip is already shorter than planned duration
              if (currentDurationSeconds <= plannedDuration) {
                if (i < 3) {
                  console.log(`[TRIM] Clip ${i}: SKIP - already ${currentDurationSeconds.toFixed(1)}s <= target ${plannedDuration.toFixed(1)}s`);
                }
                continue;
              }

              // SIMPLE APPROACH: newEnd = start + plannedDuration
              // This is the most direct calculation
              const newEndSeconds = currentStartSeconds + plannedDuration;

              // Use createWithSeconds as Adobe does in their sample
              const newEndTime = ppro.TickTime.createWithSeconds(newEndSeconds);

              // VIDEO: Set END
              const videoEndAction = videoTrackItem.createSetEndAction(newEndTime);
              compoundAction.addAction(videoEndAction);

              // AUDIO: Set END (if audio track item exists)
              if (audioTrackItem) {
                const audioEndAction = audioTrackItem.createSetEndAction(newEndTime);
                compoundAction.addAction(audioEndAction);
              }

              trimmedCount++;

              if (i < 3) {
                console.log(`[TRIM] Clip ${i}: start=${currentStartSeconds.toFixed(2)}s + planned=${plannedDuration.toFixed(1)}s = newEnd=${newEndSeconds.toFixed(2)}s, hasAudio=${!!audioTrackItem}`);
              }
            } catch (actionError) {
              console.error(`[TRIM] Failed to create trim action ${i}:`, actionError);
              errors.push(`Failed to trim clip ${i}`);
            }
          }

          console.log(`[TRIM] Added ${trimmedCount} trim actions to compound`);
        }, 'Trim Clips to Planned Duration');

        console.log('[TRIM] Transaction result:', success);
      } catch (txError) {
        console.error('[TRIM] Error in executeTransaction:', txError);
        errors.push(txError instanceof Error ? txError.message : String(txError));
      }
    });
  } catch (lockError) {
    console.error('[TRIM] Error in lockedAccess:', lockError);
    errors.push(lockError instanceof Error ? lockError.message : String(lockError));
  }

  const result: TrimResult = {
    success: success && trimmedCount > 0,
    trimmedCount: success ? trimmedCount : 0,
    errors
  };

  console.log('[TRIM] Complete:', result);
  return result;
}

/**
 * Result of a ripple operation
 */
export interface RippleResult {
  success: boolean;
  movedCount: number;
  errors: string[];
}

/**
 * Ripples clips to remove gaps after trimming
 * Moves each clip (except the first) to start immediately after the previous clip ends
 * Also moves corresponding audio clips to keep them in sync
 *
 * @param sequence - The sequence containing the clips
 * @param videoTrackIndex - Which video track to process
 * @param audioTrackIndex - Which audio track to process (-1 for no audio, e.g. images)
 * @param startingTime - The time where the first clip starts
 */
export async function rippleClipsToRemoveGaps(
  sequence: Sequence,
  videoTrackIndex: number,
  audioTrackIndex: number,
  startingTime: number
): Promise<RippleResult> {
  console.log('[RIPPLE] Starting ripple operation...');
  console.log(`[RIPPLE] Starting time: ${startingTime}s, Video track: V${videoTrackIndex}, Audio track: A${audioTrackIndex}`);

  const project = await getActiveProject();
  if (!project) {
    return { success: false, movedCount: 0, errors: ['No active project'] };
  }

  // Get the video track and all its items
  const track = await getVideoTrack(sequence, videoTrackIndex);
  const trackItems = await track.getTrackItems(
    ppro.Constants.TrackItemType.CLIP,
    false
  );

  console.log(`[RIPPLE] Found ${trackItems.length} track items on V${videoTrackIndex}`);

  // Get audio track items (if audioTrackIndex >= 0)
  let audioTrackItems: TrackItem[] = [];
  if (audioTrackIndex >= 0) {
    const audioTrack = await sequence.getAudioTrack(audioTrackIndex);
    audioTrackItems = await audioTrack.getTrackItems(
      ppro.Constants.TrackItemType.CLIP,
      false
    );
    console.log(`[RIPPLE] Found ${audioTrackItems.length} audio track items on A${audioTrackIndex}`);
  }

  // Build array of VIDEO clips with their times
  const clipsWithTimes: Array<{
    item: TrackItem;
    startTime: number;
    endTime: number;
  }> = [];

  for (const item of trackItems) {
    const startTime = await item.getStartTime();
    const endTime = await item.getEndTime();
    clipsWithTimes.push({
      item,
      startTime: startTime.seconds,
      endTime: endTime.seconds
    });
  }

  // Build array of AUDIO clips with their times (for matching)
  const audioClipsWithTimes: Array<{
    item: TrackItem;
    startTime: number;
  }> = [];

  for (const item of audioTrackItems) {
    const startTime = await item.getStartTime();
    audioClipsWithTimes.push({
      item,
      startTime: startTime.seconds
    });
  }

  // Sort by start time
  clipsWithTimes.sort((a, b) => a.startTime - b.startTime);
  audioClipsWithTimes.sort((a, b) => a.startTime - b.startTime);

  // Filter to only clips at or after startingTime
  const clipsToRipple = clipsWithTimes.filter(
    (c) => c.startTime >= startingTime - 0.1
  );

  const audioClipsAfterStart = audioClipsWithTimes.filter(
    (c) => c.startTime >= startingTime - 0.1
  );

  console.log(`[RIPPLE] Found ${clipsToRipple.length} video clips to ripple (after ${startingTime}s)`);
  console.log(`[RIPPLE] Found ${audioClipsAfterStart.length} audio clips to ripple (after ${startingTime}s)`);

  if (clipsToRipple.length <= 1) {
    console.log('[RIPPLE] Only 0-1 clips, nothing to ripple');
    return { success: true, movedCount: 0, errors: [] };
  }

  // Build list of move actions
  // For each clip (starting from second), move it to end of previous clip
  const TOLERANCE = 0.5; // Tolerance for matching audio to video
  const moveActions: Array<{
    videoItem: TrackItem;
    audioItem: TrackItem | null;
    newStartTime: number;
    oldStartTime: number;
  }> = [];
  let expectedStart = clipsToRipple[0].endTime; // First clip stays, second starts at its end

  for (let i = 1; i < clipsToRipple.length; i++) {
    const clip = clipsToRipple[i];
    const gap = clip.startTime - expectedStart;

    if (Math.abs(gap) > 0.01) { // Only move if there's a significant gap
      // Find matching audio clip at same start time
      const audioClip = audioClipsAfterStart.find(
        (a) => Math.abs(a.startTime - clip.startTime) < TOLERANCE
      );

      moveActions.push({
        videoItem: clip.item,
        audioItem: audioClip?.item || null,
        newStartTime: expectedStart,
        oldStartTime: clip.startTime
      });

      if (i < 5) {
        console.log(`[RIPPLE] Will move clip ${i} from ${clip.startTime.toFixed(2)}s to ${expectedStart.toFixed(2)}s (gap: ${gap.toFixed(2)}s, audio: ${audioClip ? 'YES' : 'NO'})`);
      }
    }

    // Calculate expected start for next clip based on this clip's duration
    const clipDuration = clip.endTime - clip.startTime;
    expectedStart = expectedStart + clipDuration;
  }

  console.log(`[RIPPLE] Prepared ${moveActions.length} move actions`);

  if (moveActions.length === 0) {
    console.log('[RIPPLE] No gaps to remove');
    return { success: true, movedCount: 0, errors: [] };
  }

  // Execute all moves in ONE transaction
  let success = false;
  let movedCount = 0;
  const errors: string[] = [];

  try {
    project.lockedAccess(() => {
      console.log('[RIPPLE] Inside lockedAccess - starting ripple transaction');
      try {
        success = project.executeTransaction((compoundAction: any) => {
          console.log(`[RIPPLE] Inside executeTransaction - adding ${moveActions.length} move actions`);

          for (let i = 0; i < moveActions.length; i++) {
            const { videoItem, audioItem, newStartTime } = moveActions[i];
            try {
              const newStart = createTickTime(newStartTime);

              // Move VIDEO clip
              const videoAction = videoItem.createSetStartAction(newStart);
              compoundAction.addAction(videoAction);

              // Move AUDIO clip (if exists)
              if (audioItem) {
                const audioAction = audioItem.createSetStartAction(newStart);
                compoundAction.addAction(audioAction);
              }

              movedCount++;

              if (i < 3) {
                console.log(`[RIPPLE] Added move action ${i}: newStart=${newStartTime.toFixed(2)}s, audio=${!!audioItem}`);
              }
            } catch (actionError) {
              console.error(`[RIPPLE] Failed to create move action ${i}:`, actionError);
              errors.push(`Failed to move clip ${i}`);
            }
          }

          console.log(`[RIPPLE] Added ${movedCount} move actions to compound`);
        }, 'Ripple Clips to Remove Gaps');

        console.log('[RIPPLE] Transaction result:', success);
      } catch (txError) {
        console.error('[RIPPLE] Error in executeTransaction:', txError);
        errors.push(txError instanceof Error ? txError.message : String(txError));
      }
    });
  } catch (lockError) {
    console.error('[RIPPLE] Error in lockedAccess:', lockError);
    errors.push(lockError instanceof Error ? lockError.message : String(lockError));
  }

  const result: RippleResult = {
    success: success && movedCount > 0,
    movedCount: success ? movedCount : 0,
    errors
  };

  console.log('[RIPPLE] Complete:', result);
  return result;
}

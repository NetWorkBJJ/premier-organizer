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

              // Pass ProjectItem directly - NO cast to ClipProjectItem
              // This matches Adobe official sample code
              const action = seqEditor.createInsertProjectItemAction(
                prepared.projectItem,
                insertTime,
                prepared.config.videoTrackIndex,
                prepared.config.audioTrackIndex,
                true  // limitShift: true per Adobe sample
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
 */
export async function getTrackItems(track: VideoTrack): Promise<TrackItem[]> {
  return await track.getTrackItems();
}

/**
 * Gets the end time of the last clip in a track
 */
export async function getTrackEndTime(track: VideoTrack): Promise<number> {
  console.log('[getTrackEndTime] Track:', track);
  console.log('[getTrackEndTime] Track type:', typeof track);

  try {
    const items = await track.getTrackItems();
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
  const items = await track.getTrackItems();

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

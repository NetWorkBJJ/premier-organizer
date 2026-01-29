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
  // Cast to FolderItem to access getItems()
  const folderItem = ppro.FolderItem.cast(bin);
  if (!folderItem) return [];

  const children = await folderItem.getItems();
  const clips: ClipInfo[] = [];

  for (const child of children) {
    // Skip if it's a folder
    if (ppro.FolderItem.cast(child)) continue;

    try {
      // Cast to ClipProjectItem to access media properties
      const clipItem = ppro.ClipProjectItem.cast(child);
      if (!clipItem) continue;

      const media = await clipItem.getMedia();
      const duration = media ? await media.duration : null;

      clips.push({
        item: child,
        name: child.name,
        duration: duration ? duration.seconds : 0,
        hasVideo: true, // Will be determined by media type
        hasAudio: true,
      });
    } catch (e) {
      // Skip items that don't have these properties (e.g., sequences)
      console.log(`Skipping item ${child.name}:`, e);
    }
  }

  return clips;
}

/**
 * Creates a TickTime from seconds
 */
export function createTickTime(seconds: number): TickTime {
  return ppro.TickTime.fromSeconds(seconds);
}

/**
 * Inserts a project item into the timeline at the specified position
 */
export async function insertClipToTimeline(
  projectItem: ProjectItem,
  sequence: Sequence,
  videoTrackIndex: number,
  audioTrackIndex: number,
  insertTimeSeconds: number
): Promise<void> {
  const insertTime = createTickTime(insertTimeSeconds);

  const action = await ppro.SequenceEditor.createInsertProjectItemAction(
    projectItem,
    sequence,
    videoTrackIndex,
    audioTrackIndex,
    insertTime
  );

  await action.execute();
}

/**
 * Sets the out point of a track item to create a cut
 */
export async function setClipOutPoint(
  trackItem: TrackItem,
  outPointSeconds: number
): Promise<void> {
  const outPoint = createTickTime(outPointSeconds);
  const action = await trackItem.createSetOutPointAction(outPoint);
  await action.execute();
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
  const items = await track.getTrackItems();
  if (items.length === 0) return 0;

  let maxEndTime = 0;
  for (const item of items) {
    const endTime = await item.getEndTime();
    if (endTime.seconds > maxEndTime) {
      maxEndTime = endTime.seconds;
    }
  }

  return maxEndTime;
}

/**
 * Removes track items from the timeline
 */
export async function removeTrackItems(items: TrackItem[]): Promise<void> {
  if (items.length === 0) return;

  const action = await ppro.SequenceEditor.createRemoveItemsAction(items);
  await action.execute();
}

/**
 * Gets the frame rate of the sequence
 */
export async function getSequenceFrameRate(sequence: Sequence): Promise<number> {
  return await sequence.getTimebase();
}

/**
 * Finds the last inserted clip on a track after a specific time
 */
export async function findClipAtTime(
  track: VideoTrack,
  timeSeconds: number
): Promise<TrackItem | null> {
  const items = await track.getTrackItems();
  const time = createTickTime(timeSeconds);

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

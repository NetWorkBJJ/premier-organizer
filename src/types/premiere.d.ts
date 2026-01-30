/**
 * Type definitions for Adobe Premiere Pro UXP API
 * Based on official Adobe UXP samples and documentation
 * @see https://developer.adobe.com/premiere-pro/uxp/ppro_reference/
 */

declare module 'premierepro' {
  // ============================================
  // Core Types
  // ============================================

  export interface TickTime {
    readonly ticks: string;
    readonly seconds: number;
    add(other: TickTime): TickTime;
    subtract(other: TickTime): TickTime;
    multiply(factor: number): TickTime;
  }

  export namespace TickTime {
    /** Create TickTime from seconds - official Adobe UXP API method */
    function createWithSeconds(seconds: number): TickTime;
    /** Create TickTime from ticks string */
    function createWithTicks(ticks: string): TickTime;
    /** Constant representing zero time */
    const TIME_ZERO: TickTime;
  }

  // ============================================
  // Action Pattern
  // ============================================

  export interface Action {
    execute(): Promise<void>;
  }

  /**
   * CompoundAction for use within executeTransaction
   * Allows multiple actions to be batched together
   */
  export interface CompoundAction {
    addAction(action: Action): void;
  }

  // ============================================
  // Project Items
  // ============================================

  export type ProjectItemType = 'clip' | 'bin' | 'file' | 'sequence' | 'root';

  export interface ProjectItem {
    readonly name: string;
    readonly type: ProjectItemType;
    readonly nodeId: string;

    getParent(): Promise<ProjectItem | null>;
    getMediaPath(): Promise<string>;
    getOutPoint(): Promise<TickTime>;
    getInPoint(): Promise<TickTime>;
    getDuration(): Promise<TickTime>;

    // For clips
    isOffline(): Promise<boolean>;
    hasVideo(): Promise<boolean>;
    hasAudio(): Promise<boolean>;

    // Metadata
    getProjectMetadata(): Promise<string>;
    setProjectMetadata(metadata: string): Promise<void>;
  }

  /**
   * FolderItem extends ProjectItem with folder-specific methods
   * Use FolderItem.cast() to convert a ProjectItem to FolderItem
   */
  export interface FolderItem extends ProjectItem {
    getItems(): Promise<ProjectItem[]>;
  }

  export namespace FolderItem {
    /**
     * Cast a ProjectItem to a FolderItem
     * Returns the FolderItem if successful, null/undefined if not a folder
     */
    function cast(item: ProjectItem): FolderItem | null;
  }

  /**
   * Media object for clip items
   * NOTE: Properties are getters that return Promises in the actual UXP API
   */
  export interface Media {
    readonly start: Promise<TickTime>;
    readonly duration: Promise<TickTime>;
  }

  /**
   * ClipProjectItem extends ProjectItem with clip-specific methods
   * Use ClipProjectItem.cast() to convert a ProjectItem to ClipProjectItem
   */
  export interface ClipProjectItem extends ProjectItem {
    getMedia(): Promise<Media>;
    getMediaFilePath(): Promise<string>;
    getContentType(): Promise<number>;
    hasProxy(): Promise<boolean>;
    canProxy(): Promise<boolean>;
    getProxyPath(): Promise<string>;
  }

  export namespace ClipProjectItem {
    /**
     * Cast a ProjectItem to a ClipProjectItem
     * Returns the ClipProjectItem if successful, null/undefined if not a clip
     */
    function cast(item: ProjectItem): ClipProjectItem | null;
  }

  // ============================================
  // Constants
  // ============================================

  export namespace Constants {
    /**
     * Track item type constants used by getTrackItems()
     * @see https://developer.adobe.com/premiere-pro/uxp/ppro_reference/
     */
    export enum TrackItemType {
      CLIP = 1,
      TRANSITION = 2,
      EMPTY = 3,
    }
  }

  // ============================================
  // Tracks
  // ============================================

  export interface VideoTrack {
    readonly index: number;
    readonly name: string;

    /**
     * Gets track items from this video track
     * @param trackItemType - Type of items to retrieve (Constants.TrackItemType.CLIP, etc.)
     * @param includeEmptyTrackItems - Whether to include empty track items
     */
    getTrackItems(
      trackItemType: Constants.TrackItemType | number,
      includeEmptyTrackItems: boolean
    ): Promise<TrackItem[]>;
    isMuted(): Promise<boolean>;
    isLocked(): Promise<boolean>;
  }

  export interface AudioTrack {
    readonly index: number;
    readonly name: string;

    /**
     * Gets track items from this audio track
     * @param trackItemType - Type of items to retrieve (Constants.TrackItemType.CLIP, etc.)
     * @param includeEmptyTrackItems - Whether to include empty track items
     */
    getTrackItems(
      trackItemType: Constants.TrackItemType | number,
      includeEmptyTrackItems: boolean
    ): Promise<TrackItem[]>;
    isMuted(): Promise<boolean>;
    isLocked(): Promise<boolean>;
  }

  // ============================================
  // Track Items (Clips on Timeline)
  // ============================================

  export interface TrackItem {
    readonly name: string;
    readonly nodeId: string;
    readonly type: 'video' | 'audio';

    getStartTime(): Promise<TickTime>;
    getEndTime(): Promise<TickTime>;
    getDuration(): Promise<TickTime>;
    getInPoint(): Promise<TickTime>;
    getOutPoint(): Promise<TickTime>;
    getMediaType(): Promise<string>;

    // Actions for modification (SYNCHRONOUS per official Adobe samples)
    createSetStartAction(time: TickTime): Action;
    createSetEndAction(time: TickTime): Action;
    createSetInPointAction(time: TickTime): Action;
    createSetOutPointAction(time: TickTime): Action;

    getProjectItem(): Promise<ProjectItem>;
  }

  // ============================================
  // Sequence
  // ============================================

  export interface Sequence {
    readonly name: string;
    readonly sequenceId: string;
    readonly nodeId: string;

    getVideoTrack(index: number): Promise<VideoTrack>;
    getAudioTrack(index: number): Promise<AudioTrack>;
    getVideoTrackCount(): Promise<number>;
    getAudioTrackCount(): Promise<number>;

    getInPoint(): Promise<TickTime>;
    getOutPoint(): Promise<TickTime>;
    getZeroPoint(): Promise<TickTime>;
    getEndTime(): Promise<TickTime>;

    getFrameSize(): Promise<{ width: number; height: number }>;
    getTimebase(): Promise<number>;

    getSelection(): Promise<TrackItem[]>;
    setSelection(items: TrackItem[]): Promise<void>;
  }

  // ============================================
  // Project
  // ============================================

  export interface Project {
    readonly name: string;
    readonly documentId: string;
    readonly path: string;

    getActiveSequence(): Promise<Sequence | null>;
    getAllSequences(): Promise<Sequence[]>;
    getRootItem(): Promise<FolderItem>;

    openSequence(sequenceId: string): Promise<boolean>;
    createNewSequence(name: string): Promise<Sequence>;

    importFiles(filePaths: string[]): Promise<boolean>;
    importSequences(projectPath: string): Promise<boolean>;

    save(): Promise<boolean>;
    saveAs(path: string): Promise<boolean>;

    /**
     * Gets locked access to the project for safe modifications
     * Project state won't change during callback execution
     * NOTE: Callback is SYNCHRONOUS per official Adobe samples
     */
    lockedAccess(callback: () => void): void;

    /**
     * Executes an undoable transaction with a compound action
     * @param callback - Function receiving CompoundAction to add actions to
     * @param undoString - Description for undo history
     * NOTE: Callback is SYNCHRONOUS per official Adobe samples
     */
    executeTransaction(
      callback: (compoundAction: CompoundAction) => void,
      undoString?: string
    ): boolean;
  }

  export namespace Project {
    function getActiveProject(): Promise<Project | null>;
  }

  // ============================================
  // Sequence Editor
  // ============================================

  /**
   * SequenceEditor instance returned by getEditor()
   * Contains methods for creating timeline actions
   * Based on official Adobe UXP samples:
   * https://github.com/AdobeDocs/uxp-premiere-pro-samples/blob/main/sample-panels/premiere-api/html/src/sequenceEditor.ts
   */
  export interface SequenceEditorInstance {
    /**
     * Insert a project item into the timeline
     * @param projectItem - The item to insert (ProjectItem, NOT ClipProjectItem)
     * @param time - Insert position on timeline
     * @param videoTrackIndex - Target video track (0-based)
     * @param audioTrackIndex - Target audio track (0-based)
     * @param limitShift - Whether to limit shifting of non-input tracks
     */
    createInsertProjectItemAction(
      projectItem: ProjectItem,
      time: TickTime,
      videoTrackIndex: number,
      audioTrackIndex: number,
      limitShift: boolean
    ): Action;

    createOverwriteItemAction(
      projectItem: ProjectItem,
      time: TickTime,
      videoTrackIndex: number,
      audioTrackIndex: number
    ): Action;

    createRemoveItemsAction(
      trackItems: TrackItem[]
    ): Action;

    createCloneTrackItemAction(
      trackItem: TrackItem
    ): Action;

    createMoveItemsAction(
      trackItems: TrackItem[],
      timeDelta: TickTime
    ): Action;
  }

  export namespace SequenceEditor {
    /**
     * Get the sequence editor for a specific sequence
     * NOTE: This is SYNCHRONOUS per official Adobe samples
     */
    function getEditor(sequence: Sequence): SequenceEditorInstance;

    // Static methods (for backwards compatibility)
    function createInsertProjectItemAction(
      projectItem: ProjectItem,
      time: TickTime,
      videoTrackIndex: number,
      audioTrackIndex: number,
      limitShift: boolean
    ): Action;

    function createOverwriteItemAction(
      projectItem: ProjectItem,
      time: TickTime,
      videoTrackIndex: number,
      audioTrackIndex: number
    ): Action;

    function createRemoveItemsAction(
      trackItems: TrackItem[]
    ): Action;

    function createCloneTrackItemAction(
      trackItem: TrackItem
    ): Action;

    function createMoveItemsAction(
      trackItems: TrackItem[],
      timeDelta: TickTime
    ): Action;
  }

  // ============================================
  // Encoder
  // ============================================

  export interface EncoderPreset {
    readonly name: string;
    readonly path: string;
  }

  export namespace Encoder {
    function getPresets(): Promise<EncoderPreset[]>;
    function encodeSequence(
      sequence: Sequence,
      outputPath: string,
      presetPath: string
    ): Promise<boolean>;
  }

  // ============================================
  // Application
  // ============================================

  export interface Application {
    readonly version: string;
    readonly buildNumber: string;
  }

  export namespace Application {
    function getApplication(): Promise<Application>;
  }
}

// Global type for require
declare function require(module: 'premierepro'): typeof import('premierepro');

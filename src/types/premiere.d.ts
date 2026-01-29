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
    function fromSeconds(seconds: number): TickTime;
    function fromTicks(ticks: string): TickTime;
  }

  // ============================================
  // Action Pattern
  // ============================================

  export interface Action {
    execute(): Promise<void>;
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
   */
  export interface Media {
    readonly start: TickTime;
    readonly duration: TickTime;
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
  // Tracks
  // ============================================

  export interface VideoTrack {
    readonly index: number;
    readonly name: string;

    getTrackItems(): Promise<TrackItem[]>;
    isMuted(): Promise<boolean>;
    isLocked(): Promise<boolean>;
  }

  export interface AudioTrack {
    readonly index: number;
    readonly name: string;

    getTrackItems(): Promise<TrackItem[]>;
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

    // Actions for modification
    createSetStartAction(time: TickTime): Promise<Action>;
    createSetEndAction(time: TickTime): Promise<Action>;
    createSetInPointAction(time: TickTime): Promise<Action>;
    createSetOutPointAction(time: TickTime): Promise<Action>;

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
  }

  export namespace Project {
    function getActiveProject(): Promise<Project | null>;
  }

  // ============================================
  // Sequence Editor
  // ============================================

  export namespace SequenceEditor {
    function createInsertProjectItemAction(
      projectItem: ProjectItem,
      sequence: Sequence,
      videoTrackIndex: number,
      audioTrackIndex: number,
      insertTime: TickTime
    ): Promise<Action>;

    function createOverwriteItemAction(
      projectItem: ProjectItem,
      sequence: Sequence,
      videoTrackIndex: number,
      audioTrackIndex: number,
      insertTime: TickTime
    ): Promise<Action>;

    function createRemoveItemsAction(
      trackItems: TrackItem[]
    ): Promise<Action>;

    function createCloneTrackItemAction(
      trackItem: TrackItem
    ): Promise<Action>;

    function createMoveItemsAction(
      trackItems: TrackItem[],
      timeDelta: TickTime
    ): Promise<Action>;
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

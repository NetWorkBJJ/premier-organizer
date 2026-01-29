/**
 * Take Parser Service
 * Parses file names with "(TAKE N) Prompt..." convention
 */

import type { ProjectItem } from 'premierepro';

/**
 * Regular expression to match "(TAKE N)" pattern
 * Examples:
 * - "(TAKE 1) sunset.mp4" → 1
 * - "(TAKE 23) city lights.mp4" → 23
 * - "(take 5) beach.jpg" → 5 (case insensitive)
 */
const TAKE_REGEX = /\(TAKE\s*(\d+)\)/i;

export interface ParsedTake {
  takeNumber: number;
  originalName: string;
}

export interface TakeMatch {
  takeNumber: number;
  video: ProjectItem | null;
  image: ProjectItem | null;
}

/**
 * Extracts the take number from a filename
 * @param filename - The filename to parse
 * @returns The take number or null if not found
 */
export function parseTakeName(filename: string): number | null {
  const match = filename.match(TAKE_REGEX);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Parses an array of project items and extracts take information
 * @param items - Array of ProjectItem
 * @returns Array of ParsedTake objects sorted by take number
 */
export function parseTakes(items: ProjectItem[]): ParsedTake[] {
  const takes: ParsedTake[] = [];

  for (const item of items) {
    const takeNumber = parseTakeName(item.name);
    if (takeNumber !== null) {
      takes.push({
        takeNumber,
        originalName: item.name,
      });
    }
  }

  return takes.sort((a, b) => a.takeNumber - b.takeNumber);
}

/**
 * Matches videos and images by their take numbers
 * @param videos - Array of video ProjectItems
 * @param images - Array of image ProjectItems
 * @returns Array of TakeMatch objects with matched video/image pairs
 */
export function matchTakes(
  videos: ProjectItem[],
  images: ProjectItem[]
): TakeMatch[] {
  const videoMap = new Map<number, ProjectItem>();
  const imageMap = new Map<number, ProjectItem>();
  const allTakeNumbers = new Set<number>();

  // Map videos by take number
  for (const video of videos) {
    const takeNumber = parseTakeName(video.name);
    if (takeNumber !== null) {
      videoMap.set(takeNumber, video);
      allTakeNumbers.add(takeNumber);
    }
  }

  // Map images by take number
  for (const image of images) {
    const takeNumber = parseTakeName(image.name);
    if (takeNumber !== null) {
      imageMap.set(takeNumber, image);
      allTakeNumbers.add(takeNumber);
    }
  }

  // Create matches sorted by take number
  const sortedTakeNumbers = Array.from(allTakeNumbers).sort((a, b) => a - b);

  return sortedTakeNumbers.map((takeNumber) => ({
    takeNumber,
    video: videoMap.get(takeNumber) || null,
    image: imageMap.get(takeNumber) || null,
  }));
}

/**
 * Gets statistics about the takes
 * @param matches - Array of TakeMatch
 * @returns Object with stats
 */
export function getTakeStats(matches: TakeMatch[]): {
  totalTakes: number;
  withVideo: number;
  withImage: number;
  complete: number;
  missingVideo: number[];
  missingImage: number[];
} {
  const missingVideo: number[] = [];
  const missingImage: number[] = [];
  let withVideo = 0;
  let withImage = 0;
  let complete = 0;

  for (const match of matches) {
    if (match.video) withVideo++;
    else missingVideo.push(match.takeNumber);

    if (match.image) withImage++;
    else missingImage.push(match.takeNumber);

    if (match.video && match.image) complete++;
  }

  return {
    totalTakes: matches.length,
    withVideo,
    withImage,
    complete,
    missingVideo,
    missingImage,
  };
}

/**
 * Take Parser Service
 * Parses file names with "(TAKE N) Prompt..." convention
 */

import type { ProjectItem } from 'premierepro';

/**
 * Regular expression to match "TAKE N" pattern
 * Examples:
 * - "TAKE 1 sunset.mp4" → 1
 * - "TAKE 23 city lights.mp4" → 23
 * - "take 5 beach.jpg" → 5 (case insensitive)
 */
const TAKE_REGEX = /TAKE\s*(\d+)/i;

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
  console.log('[matchTakes] ====== DEBUG START ======');
  console.log('[matchTakes] Videos received:', videos?.length);
  console.log('[matchTakes] Images received:', images?.length);

  const videoMap = new Map<number, ProjectItem>();
  const imageMap = new Map<number, ProjectItem>();
  const allTakeNumbers = new Set<number>();

  // Debug: list first 10 video names
  console.log('[matchTakes] First 10 video names:');
  videos?.slice(0, 10).forEach((v, i) => {
    const take = parseTakeName(v.name);
    console.log(`  [${i}] "${v.name}" → Take ${take}`);
  });

  // Debug: list first 10 image names
  console.log('[matchTakes] First 10 image names:');
  images?.slice(0, 10).forEach((img, i) => {
    const take = parseTakeName(img.name);
    console.log(`  [${i}] "${img.name}" → Take ${take}`);
  });

  // Map videos by take number
  let videosWithTake = 0;
  let videosWithoutTake = 0;
  for (const video of videos) {
    const takeNumber = parseTakeName(video.name);
    if (takeNumber !== null) {
      videoMap.set(takeNumber, video);
      allTakeNumbers.add(takeNumber);
      videosWithTake++;
    } else {
      videosWithoutTake++;
      console.log(`[matchTakes] Video WITHOUT take pattern: "${video.name}"`);
    }
  }

  // Map images by take number
  let imagesWithTake = 0;
  let imagesWithoutTake = 0;
  for (const image of images) {
    const takeNumber = parseTakeName(image.name);
    if (takeNumber !== null) {
      imageMap.set(takeNumber, image);
      allTakeNumbers.add(takeNumber);
      imagesWithTake++;
    } else {
      imagesWithoutTake++;
      console.log(`[matchTakes] Image WITHOUT take pattern: "${image.name}"`);
    }
  }

  console.log('[matchTakes] Summary:');
  console.log(`  Videos with take pattern: ${videosWithTake}`);
  console.log(`  Videos WITHOUT take pattern: ${videosWithoutTake}`);
  console.log(`  Images with take pattern: ${imagesWithTake}`);
  console.log(`  Images WITHOUT take pattern: ${imagesWithoutTake}`);
  console.log(`  Unique take numbers: ${allTakeNumbers.size}`);

  // Create matches sorted by take number
  const sortedTakeNumbers = Array.from(allTakeNumbers).sort((a, b) => a - b);

  // Debug: count mismatches
  let missingVideos = 0;
  let missingImages = 0;
  const matches = sortedTakeNumbers.map((takeNumber) => {
    const video = videoMap.get(takeNumber) || null;
    const image = imageMap.get(takeNumber) || null;
    if (!video) missingVideos++;
    if (!image) missingImages++;
    return { takeNumber, video, image };
  });

  console.log(`[matchTakes] Takes missing video: ${missingVideos}`);
  console.log(`[matchTakes] Takes missing image: ${missingImages}`);
  console.log('[matchTakes] ====== DEBUG END ======');

  return matches;
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

/**
 * Time Utilities
 * Helpers for working with time/duration in Premiere Pro
 */

/**
 * Generates a random duration between min and max seconds
 * @param minSeconds - Minimum duration in seconds
 * @param maxSeconds - Maximum duration in seconds
 * @returns Random duration in seconds
 */
export function generateRandomDuration(
  minSeconds: number,
  maxSeconds: number
): number {
  if (minSeconds > maxSeconds) {
    [minSeconds, maxSeconds] = [maxSeconds, minSeconds];
  }

  return minSeconds + Math.random() * (maxSeconds - minSeconds);
}

/**
 * Formats seconds into a human-readable string
 * @param seconds - Duration in seconds
 * @returns Formatted string like "6.5s" or "1m 30s"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
}

/**
 * Parses a duration string into seconds
 * Supports formats: "6.5s", "6.5", "1m 30s", "1:30"
 */
export function parseDuration(input: string): number | null {
  const trimmed = input.trim().toLowerCase();

  // Try "1m 30s" format
  const minuteSecondMatch = trimmed.match(/^(\d+)m\s*(\d+(?:\.\d+)?)?s?$/);
  if (minuteSecondMatch) {
    const minutes = parseInt(minuteSecondMatch[1], 10);
    const seconds = minuteSecondMatch[2]
      ? parseFloat(minuteSecondMatch[2])
      : 0;
    return minutes * 60 + seconds;
  }

  // Try "1:30" format
  const colonMatch = trimmed.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (colonMatch) {
    const minutes = parseInt(colonMatch[1], 10);
    const seconds = parseFloat(colonMatch[2]);
    return minutes * 60 + seconds;
  }

  // Try seconds format "6.5s" or "6.5"
  const secondsMatch = trimmed.match(/^(\d+(?:\.\d+)?)s?$/);
  if (secondsMatch) {
    return parseFloat(secondsMatch[1]);
  }

  return null;
}

/**
 * Converts ticks to seconds (Premiere Pro uses ticks internally)
 * Standard tick rate is 254016000000 ticks per second
 */
export const TICKS_PER_SECOND = 254016000000n;

/**
 * Converts seconds to ticks string
 */
export function secondsToTicks(seconds: number): string {
  const ticks = BigInt(Math.round(seconds * Number(TICKS_PER_SECOND)));
  return ticks.toString();
}

/**
 * Converts ticks string to seconds
 */
export function ticksToSeconds(ticks: string): number {
  const ticksBigInt = BigInt(ticks);
  return Number(ticksBigInt) / Number(TICKS_PER_SECOND);
}

/**
 * Calculates total duration of an array of durations
 */
export function sumDurations(durations: number[]): number {
  return durations.reduce((sum, d) => sum + d, 0);
}

/**
 * Ensures a duration is within valid bounds
 */
export function clampDuration(
  duration: number,
  min: number,
  max: number
): number {
  return Math.max(min, Math.min(max, duration));
}

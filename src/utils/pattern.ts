/**
 * Pattern Parser Utility
 * Parses interleaving patterns like "2V,1I" or "V,I,V,I" or "VVI"
 */

export type MediaType = 'V' | 'I';

export interface PatternResult {
  pattern: MediaType[];
  isValid: boolean;
  error?: string;
}

/**
 * Parses a pattern string into an array of media types
 *
 * Supported formats:
 * - Comma-separated with counts: "2V,1I" → ['V', 'V', 'I']
 * - Comma-separated simple: "V,I,V,I" → ['V', 'V', 'I', 'I']
 * - Concatenated: "VVI" → ['V', 'V', 'I']
 * - Concatenated with counts: "2V1I" → ['V', 'V', 'I']
 *
 * @param input - The pattern string to parse
 * @returns PatternResult with the parsed pattern or error
 */
export function parsePattern(input: string): PatternResult {
  if (!input || input.trim().length === 0) {
    return {
      pattern: [],
      isValid: false,
      error: 'Pattern cannot be empty',
    };
  }

  const normalized = input.trim().toUpperCase();
  const result: MediaType[] = [];

  // Try comma-separated format first
  if (normalized.includes(',')) {
    const parts = normalized.split(',').map((p) => p.trim());

    for (const part of parts) {
      if (part.length === 0) continue;

      const parsed = parsePatternPart(part);
      if (!parsed.isValid) {
        return {
          pattern: [],
          isValid: false,
          error: `Invalid pattern part: "${part}"`,
        };
      }
      result.push(...parsed.items);
    }
  } else {
    // Try concatenated format (e.g., "VVI" or "2V1I")
    let i = 0;
    while (i < normalized.length) {
      // Check for number prefix
      let count = 1;
      let numStr = '';
      while (i < normalized.length && /\d/.test(normalized[i])) {
        numStr += normalized[i];
        i++;
      }
      if (numStr.length > 0) {
        count = parseInt(numStr, 10);
        if (count <= 0 || count > 100) {
          return {
            pattern: [],
            isValid: false,
            error: `Invalid count: ${count}. Must be between 1 and 100.`,
          };
        }
      }

      // Get the media type
      if (i >= normalized.length) {
        return {
          pattern: [],
          isValid: false,
          error: 'Pattern ends with a number, expected V or I',
        };
      }

      const char = normalized[i];
      if (char !== 'V' && char !== 'I') {
        return {
          pattern: [],
          isValid: false,
          error: `Invalid character: "${char}". Only V (video) and I (image) are allowed.`,
        };
      }

      for (let j = 0; j < count; j++) {
        result.push(char as MediaType);
      }
      i++;
    }
  }

  if (result.length === 0) {
    return {
      pattern: [],
      isValid: false,
      error: 'Pattern resulted in empty sequence',
    };
  }

  return {
    pattern: result,
    isValid: true,
  };
}

/**
 * Parses a single pattern part (e.g., "2V" or "V")
 */
function parsePatternPart(part: string): {
  items: MediaType[];
  isValid: boolean;
} {
  const match = part.match(/^(\d*)([VI])$/);
  if (!match) {
    return { items: [], isValid: false };
  }

  const count = match[1] ? parseInt(match[1], 10) : 1;
  const type = match[2] as MediaType;

  if (count <= 0 || count > 100) {
    return { items: [], isValid: false };
  }

  return {
    items: Array(count).fill(type),
    isValid: true,
  };
}

/**
 * Expands a pattern to match the total number of takes
 *
 * @param pattern - The base pattern to repeat
 * @param totalTakes - Total number of takes to fill
 * @returns Expanded pattern array
 */
export function expandPattern(
  pattern: MediaType[],
  totalTakes: number
): MediaType[] {
  if (pattern.length === 0 || totalTakes <= 0) {
    return [];
  }

  const expanded: MediaType[] = [];
  let i = 0;

  while (expanded.length < totalTakes) {
    expanded.push(pattern[i % pattern.length]);
    i++;
  }

  return expanded;
}

/**
 * Formats a pattern array back into a readable string
 */
export function formatPattern(pattern: MediaType[]): string {
  if (pattern.length === 0) return '';

  const parts: string[] = [];
  let currentType = pattern[0];
  let count = 0;

  for (const type of pattern) {
    if (type === currentType) {
      count++;
    } else {
      parts.push(count > 1 ? `${count}${currentType}` : currentType);
      currentType = type;
      count = 1;
    }
  }
  parts.push(count > 1 ? `${count}${currentType}` : currentType);

  return parts.join(',');
}

/**
 * Validates a pattern string without parsing
 */
export function isValidPattern(input: string): boolean {
  return parsePattern(input).isValid;
}

/**
 * Common pattern presets
 */
export const PATTERN_PRESETS = {
  alternate: 'V,I',
  doubleVideo: '2V,1I',
  doubleImage: '1V,2I',
  tripleVideo: '3V,1I',
  videoOnly: 'V',
  imageOnly: 'I',
} as const;

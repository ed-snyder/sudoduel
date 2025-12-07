/**
 * Emoji utility functions for proper handling of complex Unicode emojis
 */

/**
 * Split a string into grapheme clusters (visual characters)
 * This correctly handles complex emojis as single units
 */
export function getGraphemeClusters(str: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(str), segment => segment.segment);
  }
  
  // Fallback for older browsers
  return [...str];
}

/**
 * Check if a grapheme cluster is an emoji
 */
export function isEmoji(char: string): boolean {
  // Match emoji presentations and sequences
  const emojiRegex = /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\p{Emoji_Modifier})?(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\p{Emoji_Modifier})?)*$/u;
  
  // Match flag sequences (two regional indicator symbols)
  const flagRegex = /^[\u{1F1E6}-\u{1F1FF}]{2}$/u;
  
  // Match keycap sequences
  const keycapRegex = /^[0-9#*]\uFE0F?\u20E3$/u;
  
  return emojiRegex.test(char) || flagRegex.test(char) || keycapRegex.test(char);
}

/**
 * Extract emojis from a string
 * @param str Input string
 * @param maxCount Maximum number of emojis to extract
 * @returns Array of emoji strings
 */
export function extractEmojis(str: string, maxCount?: number): string[] {
  const clusters = getGraphemeClusters(str);
  const emojis = clusters.filter(isEmoji);
  
  if (maxCount !== undefined) {
    return emojis.slice(0, maxCount);
  }
  
  return emojis;
}

/**
 * Count the number of emojis in a string
 */
export function countEmojis(str: string): number {
  return extractEmojis(str).length;
}

/**
 * Check if a string contains only emojis
 */
export function isOnlyEmojis(str: string): boolean {
  const clusters = getGraphemeClusters(str);
  return clusters.length > 0 && clusters.every(isEmoji);
}

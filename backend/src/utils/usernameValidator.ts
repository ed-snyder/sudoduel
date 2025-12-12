/**
 * Username Validator with Profanity Check
 * Blocks only words that cause Apple App Store rejection
 */

// Words that WILL cause Apple rejection
const BLOCKED_WORDS = [
  // N-word - instant rejection
  'nigger', 'nigga',
  // Anti-LGBTQ
  'faggot', 'fag', 'dyke',
  // Hate groups
  'nazi', 'hitler', 'kkk', 'klan', 'whitepow', 'whitepower', 'heil', 'sieg',
  // Child safety
  'pedo', 'pedophile', 'paedo', 'loli', 'shota', 'jailbait', 'underage',
  // Sexual
  'porn', 'rape', 'hentai', 'naked', 'horny', 'jizz', 'orgasm', 'masturbat', 'blowjob', 'handjob', 'anal', 'dildo', 'vibrator',
  // Profanity
  'asshole', 'fuck', 'shit', 'cunt', 'bitch', 'whore', 'slut', 'cock', 'dick', 'pussy', 'bastard', 'damn', 'ass', 'tits', 'boob', 'penis', 'vagina',
  // Racial slurs
  'chink', 'gook', 'spic', 'wetback', 'kike', 'raghead', 'towelhead', 'injun',
];

// Leetspeak substitutions
const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's',
  '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i',
};

function normalize(str: string): string {
  let s = str.toLowerCase().replace(/[_\-.\s]/g, '');
  for (const [k, v] of Object.entries(LEET)) {
    s = s.split(k).join(v);
  }
  // Remove repeated characters (e.g., "niiigga" -> "nigga")
  return s.replace(/(.)\1{2,}/g, '$1$1');
}

function hasBannedWord(text: string): boolean {
  const normalized = normalize(text);
  return BLOCKED_WORDS.some(word => normalized.includes(word));
}

export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }
  
  const trimmed = username.trim();
  
  if (trimmed.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }
  
  if (trimmed.length > 20) {
    return { valid: false, error: 'Username must be 20 characters or less' };
  }
  
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(trimmed)) {
    return { valid: false, error: 'Must start with a letter and contain only letters, numbers, and underscores' };
  }
  
  // Profanity check - this is the critical Apple requirement
  if (hasBannedWord(trimmed)) {
    return { valid: false, error: 'Please choose a different username' };
  }
  
  return { valid: true };
}

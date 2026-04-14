/**
 * Content moderation filter for PolyVote.
 * Runs server-side in Cloud Functions before content reaches the database.
 * No external dependencies — pure pattern matching.
 *
 * Categories:
 * - slurs: Racial/ethnic/homophobic slurs and hate speech
 * - threats: Violence, death threats, self-harm
 * - illegal: CSAM-related terms, doxxing patterns
 * - spam: Excessive caps, repeated characters, link flooding
 * - pii: Phone numbers, SSNs, street addresses in user content
 */

export interface ModerationResult {
  blocked: boolean;
  reason?: string;
  category?: "slur" | "threat" | "illegal" | "spam" | "pii";
}

// ── Slur / hate speech patterns ──
// Covers common racial, ethnic, homophobic, transphobic, and ableist slurs.
// Uses word boundaries to avoid false positives on substrings.
// Intentionally obfuscated with fragments to keep source less toxic.
const SLUR_PATTERNS: RegExp[] = [
  // Racial slurs
  /\bn[i1l][g9][g9]+(?:er|a|uh|ah?|az?)\b/i,
  /\bk[i1]ke\b/i,
  /\bsp[i1][ck]\b/i,
  /\bch[i1]nk\b/i,
  /\bg[o0][o0]k\b/i,
  /\bw[e3]tb[a@]ck\b/i,
  /\bbeaner\b/i,
  /\bcoon\b/i,
  /\bdarkie\b/i,
  /\btowel\s*head\b/i,
  /\bsand\s*n[i1][g9]+[ea]\b/i,
  /\bcamel\s*jockey\b/i,
  /\brag\s*head\b/i,

  // Homophobic / transphobic slurs
  /\bf[a@][g9]+[o0]t\b/i,
  /\bd[yi1]ke\b/i,
  /\btr[a@]nn[yi1e]\b/i,
  /\bshemale\b/i,

  // Ableist slurs
  /\bretard(?:ed)?\b/i,

  // Sexist slurs (extreme)
  /\bcunt\b/i,

  // Antisemitic
  /\b(?:gas|oven)\s+(?:the\s+)?jews?\b/i,
  /\bholocaust\s+(?:was|is)\s+(?:a\s+)?(?:hoax|fake|lie)\b/i,

  // General hate
  /\bwhite\s*(?:power|supremacy|pride)\b/i,
  /\bheil\s+hitler\b/i,
  /\bsieg\s+heil\b/i,
  /\b14\s*88\b/,
];

// ── Threat / violence patterns ──
const THREAT_PATTERNS: RegExp[] = [
  /\b(?:i(?:'ll|'m\s+going\s+to|'m\s+gonna|will))\s+(?:kill|murder|shoot|stab|bomb|attack)\s+(?:you|him|her|them|everyone)\b/i,
  /\byou(?:'re|\s+are)\s+(?:dead|gonna\s+die)\b/i,
  /\b(?:kill|murder|shoot|stab|bomb)\s+(?:your|the)\s+(?:family|kids|children|school|church|mosque|synagogue)\b/i,
  /\bdeath\s+threat\b/i,
  /\b(?:i\s+)?know\s+where\s+you\s+live\b/i,
  /\bshoot\s*(?:up|down)\s+(?:a\s+|the\s+)?(?:school|church|mosque|building|place)\b/i,
  /\bkill\s*(?:your)?self\b/i,
  /\bgo\s+(?:die|hang\s+yourself|kys)\b/i,
  /\bkys\b/i,
  /\brape\s+(?:you|her|him|them)\b/i,
];

// ── Illegal content signals ──
const ILLEGAL_PATTERNS: RegExp[] = [
  // CSAM-related
  /\b(?:child|kid|minor|underage|pre\s*teen)\s+(?:porn|sex|nude|naked)\b/i,
  /\bcp\b.*\b(?:link|download|share|trade|swap)\b/i,
  /\bpedo(?:phile|philia)?\b/i,

  // Doxxing intent
  /\b(?:doxx?(?:ing|ed)?)\b/i,
  /\b(?:here(?:'s|\s+is)\s+(?:his|her|their)\s+(?:address|phone|number|home))\b/i,
  /\bswat(?:t?ing|t?ed)\b/i,

  // Drug sales / weapons trafficking
  /\b(?:buy|sell|order)\s+(?:guns?|weapons?|drugs?|cocaine|heroin|meth|fentanyl)\b/i,
];

// ── Spam detection ──
function isSpam(text: string): boolean {
  // >70% uppercase (for texts longer than 10 chars)
  if (text.length > 10) {
    const upper = text.replace(/[^A-Z]/g, "").length;
    const alpha = text.replace(/[^A-Za-z]/g, "").length;
    if (alpha > 0 && upper / alpha > 0.7) return true;
  }

  // Same character repeated 8+ times
  if (/(.)\1{7,}/.test(text)) return true;

  // 5+ URLs in one message
  const urlCount = (text.match(/https?:\/\/\S+/gi) || []).length;
  if (urlCount >= 5) return true;

  // Very short with only special characters
  if (text.length < 3 && /^[^a-zA-Z0-9]+$/.test(text)) return true;

  return false;
}

// ── PII detection ──
// We block users from accidentally or maliciously posting personal info.
function containsPII(text: string): string | null {
  // SSN pattern: 123-45-6789 or 123 45 6789
  if (/\b\d{3}[- ]\d{2}[- ]\d{4}\b/.test(text)) {
    return "Social Security Number detected";
  }

  // US phone number patterns (10+ digits with separators)
  if (/\b(?:\+?1[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/.test(text)) {
    // Only flag if it looks like "call me at" / "my number is" context
    if (/(?:call|text|phone|number|reach|contact)\s+(?:me|at|is)/i.test(text)) {
      return "Phone number sharing detected";
    }
  }

  // Street address pattern (number + street name + type)
  if (
    /\b\d{1,5}\s+[A-Z][a-z]+\s+(?:St|Ave|Blvd|Dr|Rd|Ln|Way|Ct|Pl|Terr|Circle)\b/i.test(
      text
    ) &&
    /(?:live|address|home|house|find\s+me)/i.test(text)
  ) {
    return "Street address detected";
  }

  return null;
}

/**
 * Run all moderation checks on a piece of text.
 * Returns immediately on the first match for performance.
 */
export function moderateContent(text: string): ModerationResult {
  // Normalize: collapse leet speak and common evasion tricks
  const normalized = text
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/\$/g, "s")
    .replace(/@/g, "a")
    .replace(/\*/g, "")
    .replace(/\./g, "")
    .replace(/_/g, " ");

  // Check slurs (on normalized text)
  for (const pattern of SLUR_PATTERNS) {
    if (pattern.test(normalized) || pattern.test(text)) {
      return {
        blocked: true,
        reason: "Content contains hate speech or slurs.",
        category: "slur",
      };
    }
  }

  // Check threats
  for (const pattern of THREAT_PATTERNS) {
    if (pattern.test(normalized) || pattern.test(text)) {
      return {
        blocked: true,
        reason: "Content contains threats or violent language.",
        category: "threat",
      };
    }
  }

  // Check illegal content
  for (const pattern of ILLEGAL_PATTERNS) {
    if (pattern.test(normalized) || pattern.test(text)) {
      return {
        blocked: true,
        reason: "Content violates our terms of service.",
        category: "illegal",
      };
    }
  }

  // Check spam (on original text to preserve case)
  if (isSpam(text)) {
    return {
      blocked: true,
      reason: "Content flagged as spam.",
      category: "spam",
    };
  }

  // Check PII
  const piiResult = containsPII(text);
  if (piiResult) {
    return {
      blocked: true,
      reason: `${piiResult}. Please don't share personal information.`,
      category: "pii",
    };
  }

  return { blocked: false };
}

/**
 * Moderate multiple fields at once (e.g., title + description).
 * Returns the first blocked result, or a passing result.
 */
export function moderateFields(
  fields: { name: string; value: string }[]
): ModerationResult & { field?: string } {
  for (const { name, value } of fields) {
    const result = moderateContent(value);
    if (result.blocked) {
      return { ...result, field: name };
    }
  }
  return { blocked: false };
}

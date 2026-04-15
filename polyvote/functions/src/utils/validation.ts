import { HttpsError } from "firebase-functions/v2/https";

/** Ensure a required string field is present and within length bounds. */
export function validateString(
  value: unknown,
  fieldName: string,
  maxLength = 2000
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} must be a non-empty string.`
    );
  }
  if (value.length > maxLength) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} must be at most ${maxLength} characters.`
    );
  }
  return value.trim();
}

/** Validate a category string. */
export const VALID_CATEGORIES = [
  "Politics",
  "Technology",
  "Science",
  "Culture",
  "Environment",
  "Health",
  "Sports",
  "Other",
] as const;

export type Category = (typeof VALID_CATEGORIES)[number];

export function validateCategory(value: unknown): Category {
  if (
    typeof value !== "string" ||
    !VALID_CATEGORIES.includes(value as Category)
  ) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`
    );
  }
  return value as Category;
}

/** Validate metrics array structure. */
export interface MetricInput {
  id: string;
  label: string;
  choices: { id: string; label: string; color: string; votes: number }[];
}

export function validateMetrics(value: unknown): MetricInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "Metrics must be a non-empty array."
    );
  }
  if (value.length > 6) {
    throw new HttpsError(
      "invalid-argument",
      "A topic can have at most 6 metrics."
    );
  }

  return value.map((m: Record<string, unknown>, i: number) => {
    if (typeof m.id !== "string" || typeof m.label !== "string") {
      throw new HttpsError(
        "invalid-argument",
        `Metric ${i} must have id and label strings.`
      );
    }
    if (!Array.isArray(m.choices) || m.choices.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        `Metric ${i} must have at least one choice.`
      );
    }
    const choices = (m.choices as Record<string, unknown>[]).map(
      (c, j: number) => {
        if (
          typeof c.id !== "string" ||
          typeof c.label !== "string" ||
          typeof c.color !== "string"
        ) {
          throw new HttpsError(
            "invalid-argument",
            `Metric ${i}, choice ${j} must have id, label, and color strings.`
          );
        }
        if (!/^#[0-9A-Fa-f]{6}$/.test(c.color as string)) {
          throw new HttpsError(
            "invalid-argument",
            `Metric ${i}, choice ${j} has an invalid color format. Use hex (e.g., #22c55e).`
          );
        }
        return {
          id: c.id,
          label: c.label,
          color: c.color,
          votes: typeof c.votes === "number" ? c.votes : 0,
        };
      }
    );
    return { id: m.id, label: m.label, choices };
  });
}

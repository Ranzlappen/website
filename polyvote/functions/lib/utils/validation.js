"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_CATEGORIES = void 0;
exports.validateString = validateString;
exports.validateCategory = validateCategory;
exports.validateMetrics = validateMetrics;
const https_1 = require("firebase-functions/v2/https");
/** Ensure a required string field is present and within length bounds. */
function validateString(value, fieldName, maxLength = 2000) {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new https_1.HttpsError("invalid-argument", `${fieldName} must be a non-empty string.`);
    }
    if (value.length > maxLength) {
        throw new https_1.HttpsError("invalid-argument", `${fieldName} must be at most ${maxLength} characters.`);
    }
    return value.trim();
}
/** Validate a category string. */
exports.VALID_CATEGORIES = [
    "Politics",
    "Technology",
    "Science",
    "Culture",
    "Environment",
    "Health",
    "Sports",
    "Other",
];
function validateCategory(value) {
    if (typeof value !== "string" ||
        !exports.VALID_CATEGORIES.includes(value)) {
        throw new https_1.HttpsError("invalid-argument", `Invalid category. Must be one of: ${exports.VALID_CATEGORIES.join(", ")}`);
    }
    return value;
}
function validateMetrics(value) {
    if (!Array.isArray(value) || value.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "Metrics must be a non-empty array.");
    }
    if (value.length > 6) {
        throw new https_1.HttpsError("invalid-argument", "A topic can have at most 6 metrics.");
    }
    return value.map((m, i) => {
        if (typeof m.id !== "string" || typeof m.label !== "string") {
            throw new https_1.HttpsError("invalid-argument", `Metric ${i} must have id and label strings.`);
        }
        if (!Array.isArray(m.choices) || m.choices.length === 0) {
            throw new https_1.HttpsError("invalid-argument", `Metric ${i} must have at least one choice.`);
        }
        const choices = m.choices.map((c, j) => {
            if (typeof c.id !== "string" ||
                typeof c.label !== "string" ||
                typeof c.color !== "string") {
                throw new https_1.HttpsError("invalid-argument", `Metric ${i}, choice ${j} must have id, label, and color strings.`);
            }
            return {
                id: c.id,
                label: c.label,
                color: c.color,
                votes: typeof c.votes === "number" ? c.votes : 0,
            };
        });
        return { id: m.id, label: m.label, choices };
    });
}
//# sourceMappingURL=validation.js.map
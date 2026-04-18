import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDatabase } from "firebase-admin/database";
import { createHash } from "crypto";

const POST_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,199}$/;
const SECTION_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

function extractIp(rawRequest: {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}): string {
  const fwd = rawRequest.headers["x-forwarded-for"];
  const first = Array.isArray(fwd) ? fwd[0] : fwd?.split(",")[0];
  const ip = (first || rawRequest.ip || "").trim();
  if (!ip) {
    throw new HttpsError("failed-precondition", "Could not determine client.");
  }
  return ip;
}

/**
 * Server-validated blog post section voting.
 * - Enforces App Check so only the blog's own pages can invoke.
 * - Hashes the caller IP into an opaque 32-char token kept on the server side.
 * - Atomically claims the voter slot; if already claimed, returns ok:false.
 * - Increments the up/down counter only when the slot was newly claimed.
 */
export const castBlogVote = onCall(
  { enforceAppCheck: true },
  async (request) => {
    const { postSlug, sectionId, direction } = request.data as {
      postSlug?: string;
      sectionId?: string;
      direction?: string;
    };

    if (!postSlug || !POST_SLUG_RE.test(postSlug)) {
      throw new HttpsError("invalid-argument", "Invalid postSlug.");
    }
    if (!sectionId || !SECTION_ID_RE.test(sectionId)) {
      throw new HttpsError("invalid-argument", "Invalid sectionId.");
    }
    if (direction !== "up" && direction !== "down") {
      throw new HttpsError("invalid-argument", "direction must be up or down.");
    }

    const ip = extractIp(request.rawRequest);
    const token = createHash("sha256").update(ip).digest("hex").slice(0, 32);

    const db = getDatabase();
    const sectionRef = db.ref(`votes/${postSlug}/${sectionId}`);
    const voterRef = sectionRef.child(`voters/${token}`);

    const claim = await voterRef.transaction((current) =>
      current === null ? direction : undefined
    );

    if (!claim.committed) {
      return { ok: false, reason: "already-voted" as const };
    }

    await sectionRef
      .child(direction)
      .transaction((v) => (typeof v === "number" ? v : 0) + 1);

    return { ok: true as const };
  }
);

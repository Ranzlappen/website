/*
 * CHANGE: New file – Reusable loading skeleton components
 * REASON: Provides placeholder UI while data loads from Firestore
 * DATE: 2026-04-02
 */

/** Card-shaped skeleton for topic grid */
export function TopicCardSkeleton() {
  return (
    <div className="skeleton h-56 rounded-xl" />
  );
}

/** Full-width skeleton for topic detail page */
export function TopicDetailSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div className="skeleton h-10 w-2/3 rounded-lg" />
      <div className="skeleton h-5 w-1/3 rounded" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-40 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

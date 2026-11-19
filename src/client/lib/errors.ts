/** A sentence for a failed server call. */
export function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) {
    // Validation failures arrive as zod's JSON list of issues.
    try {
      const issues = JSON.parse(error.message) as { message?: string }[];
      if (Array.isArray(issues) && issues[0]?.message) return issues[0].message;
    } catch {
      // Not JSON: the message is already a sentence.
    }
    return error.message;
  }
  return "That didn't work. Try again.";
}

/** "5 min ago", or a date for anything older than a week. */
export function timeAgo(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(timestamp).toLocaleDateString("en", { dateStyle: "medium" });
}

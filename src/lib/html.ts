/**
 * The single HTML file in a model's answer: a fenced html block, or the
 * document itself. Null when there is none.
 */
export function extractHtml(answer: string): string | null {
  const fenced = answer.match(/```(?:html)?\s*\n([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? answer).trim();
  const start = candidate.search(/<!doctype html|<html[\s>]/i);
  if (start === -1) return null;
  const end = candidate.toLowerCase().lastIndexOf("</html>");
  return end === -1
    ? candidate.slice(start)
    : candidate.slice(start, end + "</html>".length);
}

/** A file name for a download, from an app's name. */
export function fileNameFor(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "app"}.html`;
}

/**
 * Sanitize user-provided text by stripping HTML tags and
 * encoding characters that could be used in XSS attacks.
 * Returns a plain-text string safe for rendering and storage.
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Strip all HTML tags from a string, returning only text content.
 * Useful for sanitizing file names and imported metadata.
 */
export function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize a file name by removing path traversal sequences,
 * control characters, and HTML tags.
 */
export function sanitizeFileName(name: string): string {
  return stripHtmlTags(name)
    .replace(/[<>:"/\\|?*]/g, '')   // Remove filesystem-unsafe characters
    .replace(/\.\./g, '')            // Remove path traversal
    .replace(/[\x00-\x1f\x7f]/g, '') // Remove control characters
    .trim();
}

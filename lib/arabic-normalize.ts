/**
 * Arabic text normalization utilities.
 *
 * Extracted from app/api/extract-pdf/route.ts for testability.
 */

/**
 * Normalize Arabic text by converting presentation forms to base characters,
 * stripping tatweel/kashida, and normalizing variant letter forms.
 */
export function normalizeArabic(s: string): string {
  return s
    .normalize('NFKC')                    // Presentation Forms → base chars
    .replace(/\u06BE/g, '\u0647')         // Heh Doachashmee → standard Heh
    .replace(/\u06CC/g, '\u064A')         // Farsi Yeh → standard Yeh
    .replace(/\u06C1/g, '\u0647')         // Heh Goal → standard Heh
    .replace(/\u0640/g, '')               // strip tatweel/kashida (PDF justification artefact)
    .replace(/[^\S\n]+/g, ' ')            // collapse spaces/tabs but keep newlines
    .trim();
}

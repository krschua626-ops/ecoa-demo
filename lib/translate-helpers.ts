/**
 * Structural template utilities for eCOA string migration.
 *
 * Extracted from app/api/translate/route.ts for testability.
 * The source English string encodes the platform format (number prefix, XML
 * tags, multi-space gaps). We strip that structure before asking Claude to
 * match, then restore it to the target-language text extracted from the document.
 */

/**
 * Strip platform structural formatting from a source string.
 *
 * - Numbered response option: "1     All of the time" → "All of the time"
 * - Numbered question stem: "1. How often..." → "How often..."
 * - XML/HTML tagged: strips all tags to expose text content
 */
export function stripStructure(source: string): string {
  // Numbered response option: "1     All of the time" → "All of the time"
  const optMatch = source.match(/^\d+\s{2,}(.+)$/);
  if (optMatch) return optMatch[1].trim();

  // Numbered question stem: "1. How often..." → "How often..."
  const stemMatch = source.match(/^\d+\.\s+(.+)$/);
  if (stemMatch) return stemMatch[1].trim();

  // XML/HTML tagged: strip all tags to expose text content
  if (/<[a-zA-Z]/.test(source)) {
    return source.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return source;
}

/**
 * Restore platform structural formatting to a translated string.
 *
 * Applies the inverse of stripStructure: re-adds the number prefix, question
 * stem prefix, or XML tag wrapper from the original source string.
 */
export function restoreStructure(source: string, translatedText: string): string {
  const text = translatedText.trim();

  // Numbered response option: detect by 2+ spaces after digit; always emit the
  // platform standard of exactly 5 spaces regardless of source spacing.
  const optMatch = source.match(/^(\d+)\s{2,}.+$/);
  if (optMatch) return optMatch[1] + '     ' + text;

  // Numbered question stem: restore "N. " prefix
  const stemMatch = source.match(/^(\d+\.\s+).+$/);
  if (stemMatch) return stemMatch[1] + text;

  // XML/HTML: replace the first non-empty text node with the translated text,
  // preserving any leading whitespace indent that was inside the tag.
  if (/<[a-zA-Z]/.test(source)) {
    let replaced = false;
    const result = source.replace(/>[^<]+</g, (m) => {
      if (!replaced && m.slice(1, -1).trim()) {
        replaced = true;
        const inner = m.slice(1, -1);
        const leadingWS = inner.match(/^(\s+)/)?.[1] ?? '';
        return '>' + leadingWS + text + '<';
      }
      return m;
    });
    return replaced ? result : text;
  }

  return text;
}

/**
 * Strip any number prefix that came from the PDF's own layout.
 *
 * Examples:
 * - "1 كلّ الوقت" → "كلّ الوقت"
 * - ".١ كم من الوقت" → "كم من الوقت"
 */
export function stripPDFNumberPrefix(text: string): string {
  return text
    .replace(/^\d+\s+/, '')                // "1 text"
    .replace(/^[\u0660-\u0669]+\s+/, '')   // "١ text" (Arabic-Indic digits)
    .replace(/^\.\d+\s*/, '')              // ".1 text" (RTL period artifact)
    .replace(/^\.[\u0660-\u0669]+\s*/, '') // ".١ text"
    .trim();
}

/**
 * Normalize PDF extraction artifacts from Arabic/RTL text.
 *
 * - Gender-inclusive slash spacing: "word / suffix" → "word/suffix"
 * - Period spacing: "sentence . next" → "sentence. next"
 */
export function normalizePDFArabicText(text: string): string {
  return text
    .replace(/(\S) \/ (\S)/g, '$1/$2')   // "مضطرا / ة" → "مضطرا/ة"
    .replace(/(\S) \. /g, '$1. ')         // "حياتك . سوف" → "حياتك. سوف"
    .replace(/(\S) \.$/gm, '$1.');        // trailing " ." → "."
}

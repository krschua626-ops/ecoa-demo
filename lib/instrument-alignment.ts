/**
 * Positional alignment library for eCOA string migration.
 *
 * Architecture
 * ────────────
 * For instruments with numbered question stems (e.g. "1. How often…") and
 * numbered response options (e.g. "1     ALL OF THE TIME"), the PDF and JSON
 * are both in document order and share an identical structural numbering.
 * We exploit that to map UUIDs directly to PDF text without any LLM search.
 *
 * For unnumbered instruments (e.g. WPAI with plain prose questions) or for
 * strings that don't carry a number (titles, instructions, example blocks),
 * we fall back to the existing LLM anchor path, but with an improved
 * paragraph collector that eliminates truncation of multi-line strings.
 */

// ─── Regex patterns ──────────────────────────────────────────────────────────

/** PDF question stem: ".1 كم من الوقت…" */
const Q_STEM_PDF = /^\.(\d+)\s/;

/** PDF response option: "1 كلّ الوقت" — digit + space + Arabic/Hangul/CJK */
const OPTION_PDF = /^(\d)\s[\u0600-\u06FF\uAC00-\uD7A3\u4E00-\u9FFF]/;

/** Source question stem: "1. How often…" */
const Q_STEM_SRC = /^(\d+)\.\s/;

/** Source response option: "1     ALL OF THE TIME" */
const OPTION_SRC = /^(\d+)\s{2,}/;

/** Lines that mark a hard stop when collecting paragraph continuations. */
const STOP_PATTERNS: RegExp[] = [
  Q_STEM_PDF,
  OPTION_PDF,
  /^IBDQ\s*$/,
  /^McMaster/,
  /©/,
  /milo@mcmaster/,
  /Final version/i,
  /^WPAI/i,
  /ID058965/,
];

function isStopLine(line: string): boolean {
  return STOP_PATTERNS.some(p => p.test(line));
}

// ─── Arabic / CJK text detection ─────────────────────────────────────────────

function hasTranslatedScript(s: string): boolean {
  return /[\u0600-\u06FF\uAC00-\uD7A3\u3040-\u30FF\u4E00-\u9FFF]/.test(s);
}

// ─── Diacritics strip (search-only — never applied to output) ─────────────────

export function stripDiacriticsForSearch(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    .replace(/\u0624/g, '\u0648')
    .replace(/\u0626/g, '\u064A')
    .replace(/[\u060C\u061B\u061F\u0021-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007E©]/g, ' ')
    .replace(/(^| )[\u064A\u0629\u0649]( |$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PDFIndex = {
  /** question number → full stem text (with instruction tail) */
  stems: Map<number, string>;
  /** "questionNum_optionNum" → raw option line */
  options: Map<string, string>;
  /** true when the PDF contains numbered question stems */
  hasNumberedElements: boolean;
};

// ─── Slice 1: PDF Numbered Index ──────────────────────────────────────────────

/**
 * Parse the extracted PDF text into a numbered index.
 * Returns stem + option maps keyed by their numeric identifiers.
 * For instruments without numbered elements the maps will be empty.
 */
export function buildPDFIndex(pdfText: string): PDFIndex {
  const lines = pdfText.split('\n').map(l => l.trim()).filter(Boolean);
  const stems  = new Map<number, string>();
  const options = new Map<string, string>();
  let currentQ = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ── Question stem ─────────────────────────────────────────────────────────
    const stemM = line.match(Q_STEM_PDF);
    if (stemM) {
      currentQ = parseInt(stemM[1]);
      let text = line;
      // Collect instruction-tail continuation lines
      // (e.g. "الرجاء اختيار إجابة واحدة من" that the vendor appends)
      i++;
      while (i < lines.length) {
        const next = lines[i];
        if (
          /^(الرجاء|وذلك|وباختيار)/.test(next) &&
          !isStopLine(next)
        ) {
          text += ' ' + next;
          i++;
        } else {
          i--; // put back so the outer loop re-reads this line
          break;
        }
      }
      stems.set(currentQ, text);
      continue;
    }

    // ── Response option ───────────────────────────────────────────────────────
    const optM = line.match(OPTION_PDF);
    if (optM && currentQ > 0) {
      options.set(`${currentQ}_${optM[1]}`, line);
      continue;
    }
  }

  return { stems, options, hasNumberedElements: stems.size > 0 };
}

// ─── Slice 2: Source Classifier ───────────────────────────────────────────────

export type SourceClass =
  | { kind: 'q_stem';  questionNum: number }
  | { kind: 'option';  questionNum: number; optionNum: number }
  | { kind: 'other' };

/**
 * Classify a single source_locale_text value.
 * Needs the running question number (from the previous q_stem in the array).
 */
export function classifySource(
  source: string,
  currentQuestion: number,
): SourceClass {
  const stemM = source.match(Q_STEM_SRC);
  if (stemM) return { kind: 'q_stem', questionNum: parseInt(stemM[1]) };

  const optM = source.match(OPTION_SRC);
  if (optM && currentQuestion > 0)
    return { kind: 'option', questionNum: currentQuestion, optionNum: parseInt(optM[1]) };

  return { kind: 'other' };
}

// ─── Slice 3: Positional Aligner ─────────────────────────────────────────────

export type AlignmentResult = {
  uuid: string;
  /** Raw PDF text for this string, or null if not positionally matched. */
  rawPDFText: string | null;
  confidence: 'high' | 'low';
};

/**
 * Align an ordered list of source entries to PDF text using structural numbering.
 *
 * Numbered q_stems and options receive 'high' confidence matches directly from
 * the PDF index.  Everything else (titles, instructions, XML compound strings,
 * unnumbered instruments) gets rawPDFText: null and will be routed to LLM.
 */
export function alignPositionally(
  entries: Array<{ uuid: string; source: string }>,
  pdfIndex: PDFIndex,
): AlignmentResult[] {
  const results: AlignmentResult[] = [];

  if (!pdfIndex.hasNumberedElements) {
    // Unnumbered instrument (e.g. WPAI) — everything goes to LLM
    return entries.map(e => ({ uuid: e.uuid, rawPDFText: null, confidence: 'low' }));
  }

  let currentQ = 0;

  for (const entry of entries) {
    const cls = classifySource(entry.source, currentQ);

    if (cls.kind === 'q_stem') {
      currentQ = cls.questionNum;
      const text = pdfIndex.stems.get(cls.questionNum) ?? null;
      results.push({ uuid: entry.uuid, rawPDFText: text, confidence: text ? 'high' : 'low' });
      continue;
    }

    if (cls.kind === 'option') {
      const key = `${cls.questionNum}_${cls.optionNum}`;
      const text = pdfIndex.options.get(key) ?? null;
      results.push({ uuid: entry.uuid, rawPDFText: text, confidence: text ? 'high' : 'low' });
      continue;
    }

    // Unnumbered string (instruction, title, XML block, etc.) → LLM
    results.push({ uuid: entry.uuid, rawPDFText: null, confidence: 'low' });
  }

  return results;
}

// ─── Paragraph collector (fixes truncation for LLM-path strings) ─────────────

/**
 * Find the anchor line in the document, then greedily collect continuation
 * lines until the gathered text length is proportional to the source length.
 *
 * This replaces the single-line return in findVerbatimInDocument for long
 * source strings (instruction paragraphs, extended question stems).
 */
export function findVerbatimParagraph(
  anchor: string,
  pdfText: string,
  sourceStrippedLen: number,
): string | null {
  if (!anchor || anchor.trim().length < 3) return null;

  const normAnchor = stripDiacriticsForSearch(anchor.trim());
  const lines = pdfText.split('\n').map(l => l.trim()).filter(Boolean);

  // Pass 1: single-line anchor match
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (stripDiacriticsForSearch(lines[i]).includes(normAnchor)) {
      startIdx = i;
      break;
    }
  }

  // Pass 2: two-line concat
  if (startIdx === -1) {
    for (let i = 0; i < lines.length - 1; i++) {
      const combined = stripDiacriticsForSearch(lines[i] + ' ' + lines[i + 1]);
      if (combined.includes(normAnchor)) {
        startIdx = i;
        break;
      }
    }
  }

  // Pass 3: space-collapsed
  if (startIdx === -1) {
    const collapsed = normAnchor.replace(/\s+/g, '');
    for (let i = 0; i < lines.length; i++) {
      if (stripDiacriticsForSearch(lines[i]).replace(/\s+/g, '').includes(collapsed)) {
        startIdx = i;
        break;
      }
    }
  }

  if (startIdx === -1) return null;

  // Short sources → return single line only
  if (sourceStrippedLen < 100) return lines[startIdx];

  // Longer sources → collect continuation lines until length target or stop
  const collected = [lines[startIdx]];
  // Arabic/Korean text is typically 50-70% the length of English
  const targetLen = Math.max(sourceStrippedLen * 0.50, lines[startIdx].length + 10);

  for (let i = startIdx + 1; i < lines.length; i++) {
    if (collected.join(' ').length >= targetLen) break;
    const next = lines[i];
    if (!next) break;
    if (isStopLine(next)) break;
    // Don't cross into a new logical section (e.g. a line that has no
    // translated-script characters is likely a header/label, not a continuation)
    if (!hasTranslatedScript(next) && next.length > 3) break;
    collected.push(next);
  }

  return collected.join(' ');
}

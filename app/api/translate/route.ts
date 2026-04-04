import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  buildPDFIndex,
  alignPositionally,
  findVerbatimParagraph,
} from '../../../lib/instrument-alignment';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BATCH_SIZE = 30;

// ---------------------------------------------------------------------------
// Structural template utilities
// The source English string encodes the platform format (number prefix, XML
// tags, multi-space gaps). We strip that structure before asking Claude to
// match, then restore it to the Arabic text we extract from the document.
// ---------------------------------------------------------------------------

function stripStructure(source: string): string {
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

function restoreStructure(source: string, arabicText: string): string {
  const text = arabicText.trim();

  // Numbered response option: detect by 2+ spaces after digit; always emit the
  // platform standard of exactly 5 spaces regardless of source spacing.
  const optMatch = source.match(/^(\d+)\s{2,}.+$/);
  if (optMatch) return optMatch[1] + '     ' + text;

  // Numbered question stem: restore "N. " prefix
  const stemMatch = source.match(/^(\d+\.\s+).+$/);
  if (stemMatch) return stemMatch[1] + text;

  // XML/HTML: replace the first non-empty text node with the Arabic text,
  // preserving any leading whitespace indent that was inside the tag (e.g. the
  // 5-space indent in <size value='l'>     TEXT</size>).
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

// For source strings that contain <br /> separators the content is a multi-line
// block (e.g. the EXAMPLE section: header + question stem + 7 response options
// all in one XML string). restoreStructure only replaces the first text node,
// leaving the rest in English. This function rebuilds the string node-by-node
// by pulling consecutive lines from the document starting at the anchor line.
function rebuildMultiSegmentXML(
  source: string,
  verbatimLine: string,
  extractedText: string,
): string {
  const docLines = extractedText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l);

  // Find anchor line index. Also look one line back — the anchor might be the
  // question stem while the section label (e.g. "مثال") is the line before it.
  let startIdx = docLines.indexOf(verbatimLine);
  if (startIdx === -1) {
    // verbatimLine may be a 2-line concatenated result from findVerbatimInDocument pass 2,
    // or tatweel stripping may have made it differ from the stored lines.
    // Search normalized: find the docLine whose stripped form is a prefix of stripped verbatimLine.
    const normVerbatim = stripDiacriticsForSearch(verbatimLine);
    for (let i = 0; i < docLines.length; i++) {
      const normLine = stripDiacriticsForSearch(docLines[i]);
      if (normLine.length > 5 && normVerbatim.startsWith(normLine)) {
        startIdx = i;
        break;
      }
    }
  }
  if (startIdx > 0) {
    const prev = docLines[startIdx - 1];
    // If the previous line is short (≤15 chars) and contains no digits it is
    // likely a section header like "مثال" — start from there.
    if (prev.length <= 15 && !/\d/.test(prev)) startIdx -= 1;
  }
  if (startIdx === -1) {
    // Verbatim line not found at all — fall back to first-node replace
    return restoreStructure(source, verbatimLine);
  }

  const pool = docLines.slice(startIdx, startIdx + 20);
  let poolIdx = 0;

  return source.replace(/>[^<]+</g, (match) => {
    const inner = match.slice(1, -1);
    if (!inner.trim()) return match; // keep whitespace-only gaps
    if (/^\s*\d+\s*$/.test(inner.trim())) return match; // keep pure-number nodes (bold "1" etc.)
    if (!/[\u0600-\u06FF]/.test(inner) && /[a-zA-Z]/.test(inner)) return match; // keep Latin-only nodes (e.g. "STOP")
    if (poolIdx >= pool.length) return match;

    const docLine = pool[poolIdx++];
    const arabic = stripPDFNumberPrefix(docLine);
    if (!arabic) {
      poolIdx--; // line was empty after stripping — skip and retry next call
      return match;
    }

    // Preserve number+spaces prefix that the source node had (e.g. "2     ")
    const srcPrefix = inner.match(/^(\d+\s{2,})/)?.[1] ?? '';
    // Preserve leading whitespace prefix (e.g. "     " before ALL OF THE TIME)
    const srcSpaces = !srcPrefix ? (inner.match(/^(\s+)/)?.[1] ?? '') : '';
    return '>' + srcPrefix + srcSpaces + arabic + '<';
  });
}

// ---------------------------------------------------------------------------
// Anchor-based verbatim extraction
// Claude returns a short anchor (base chars, no diacritics) that we use to
// locate the exact line in the extracted document — then we return the
// verbatim original, diacritics and all. Claude never outputs the Arabic text
// itself, so tokeniser-level diacritic mangling cannot occur.
// ---------------------------------------------------------------------------

// Strip diacritics for search/comparison only — never applied to output.
// Also normalises:
//   • tatweel (U+0640) — PDF kashida used for justification
//   • alef variants with hamza (أ إ آ ٱ) → plain alef (ا)
//     Claude strips hamza when building anchors, so the anchor uses ا where
//     the document has أ/إ. Without this step those anchors never match.
//   • waw with hamza (ؤ) → waw (و)
//   • yeh with hamza (ئ) → yeh (ي)
//   • punctuation (Arabic/Latin commas, periods, question marks, etc.) —
//     PDF text often embeds ، and . inside lines; anchors never include them.
function stripDiacriticsForSearch(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[\u064B-\u065F]/g, '')                    // standard Arabic diacritics
    .replace(/\u0640/g, '')                              // tatweel / kashida
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')   // أ إ آ ٱ → ا
    .replace(/\u0624/g, '\u0648')                        // ؤ → و
    .replace(/\u0626/g, '\u064A')                        // ئ → ي
    .replace(/[\u060C\u061B\u061F\u0021-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007E©]/g, ' ') // punctuation
    // After "/" is stripped to a space, Arabic gender-inclusive markers (ي، ة)
    // are left as isolated single-char tokens — e.g. "توقف / ي" → "توقف  ي".
    // Strip standalone ي / ة / ى so they don't break anchor matching.
    .replace(/(^| )[\u064A\u0629\u0649]( |$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Strip any number prefix that came from the PDF's own layout
// (e.g. "1 كلّ الوقت" → "كلّ الوقت", ".١ كم من الوقت" → "كم من الوقت")
function stripPDFNumberPrefix(text: string): string {
  return text
    .replace(/^\d+\s+/, '')                // "1 text"
    .replace(/^[\u0660-\u0669]+\s+/, '')   // "١ text" (Arabic-Indic digits)
    .replace(/^\.\d+\s*/, '')              // ".1 text" (RTL period artifact)
    .replace(/^\.[\u0660-\u0669]+\s*/, '') // ".١ text"
    .trim();
}

// Normalize PDF extraction artifacts from Arabic/RTL text:
//   • Gender-inclusive slash spacing: "word / suffix" → "word/suffix"
//     PDF tokenizer inserts spaces around "/" in Arabic text
//   • Period spacing: "sentence . next" → "sentence. next"
//     PDF sometimes emits a space before the period when the line breaks there
function normalizePDFArabicText(text: string): string {
  return text
    .replace(/(\S) \/ (\S)/g, '$1/$2')   // "مضطرا / ة" → "مضطرا/ة"
    .replace(/(\S) \. /g, '$1. ')         // "حياتك . سوف" → "حياتك. سوف"
    .replace(/(\S) \.$/gm, '$1.');        // trailing " ." → "."
}

// Used only for <br /> multi-segment strings where rebuildMultiSegmentXML
// needs a single anchor line for document positioning.
// All other strings use findVerbatimParagraph() from instrument-alignment.ts.
function findVerbatimInDocument(anchor: string, extractedText: string): string | null {
  return findVerbatimParagraph(anchor, extractedText, 0); // 0 → single-line mode
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildPrompt(
  strippedBatch: Record<string, string>,
  translatedDocument: string,
  guidelinesText: string,
): string {
  // Detect whether the document is primarily Arabic (combining-diacritics script)
  // or a non-combining script (Korean, CJK, etc.).
  // For Arabic we use the anchor approach (Claude returns a short anchor so the
  // verbatim PDF text — including diacritics — is extracted by code).
  // For Korean/CJK we ask Claude to output the full translated string directly,
  // because those scripts have no combining-diacritic mangling risk and the PDF
  // text often has spacing/punctuation artifacts that must be cleaned up anyway.
  const arabicChars = (translatedDocument.match(/[\u0600-\u06FF]/g) ?? []).length;
  const koreanChars = (translatedDocument.match(/[\uAC00-\uD7A3]/g) ?? []).length;
  const cjkChars    = (translatedDocument.match(/[\u4E00-\u9FFF]/g) ?? []).length;
  const isArabic    = arabicChars > koreanChars + cjkChars;
  const scriptName  = isArabic ? 'Arabic'
    : koreanChars > cjkChars ? 'Korean'
    : 'target-language';

  if (isArabic) {
    // ── Arabic mode: anchor-based verbatim extraction ──────────────────────────
    return `You are an expert eCOA localization specialist performing string migration — not translation.

The target-language strings already exist in the paper translation document below. Your job is to locate each source string's equivalent in that document and return a short anchor that identifies it.

CRITICAL RULES:
- Do NOT output the full Arabic text. Only output a short "match_anchor" — we will extract the verbatim text directly from the document using your anchor. This is intentional: it avoids any risk of you mangling diacritical marks during output.
- The match_anchor must be 5–20 base Arabic characters taken from the matching string in the document. Strip ALL diacritical marks from the anchor (no shadda ّ, kasra ِ, tanwin ً ٍ ٌ, etc) — use plain base letters only so the anchor can be matched against a normalised version of the document.
- If no match can be found, set match_anchor to null and confidence to "low".
- For response option strings: different questions use different scales. Always anchor to the Arabic text that follows the corresponding question stem — not a visually similar string from a different question's scale.
- Q3 and Q30 are DIFFERENT questions with different Arabic translations. Do not confuse their answer scales.

## Source strings — keyed by UUID (structural prefixes and tags already stripped)
\`\`\`json
${JSON.stringify(strippedBatch, null, 2)}
\`\`\`

## Paper translation document (extracted text — source of truth)
\`\`\`
${translatedDocument}
\`\`\`

## Migration guidelines
${guidelinesText}

## Response format
Return a JSON object where each key is a UUID, mapped to:
- "match_anchor": 5–20 base Arabic chars (no diacritics) that uniquely locate the string, or null
- "confidence": "high" | "medium" | "low"
- "confidence_rationale": 1–2 sentences
- "flags": array of concern strings (empty if none)

Confidence: high = unambiguous match; medium = plausible with minor uncertainty; low = no match.
Return ONLY the JSON object. Start with { and end with }.`;
  }

  // ── Non-Arabic mode (Korean, CJK, etc.): direct translation output ────────────
  // Claude outputs the full translated string. The paper document is provided as
  // reference context. XML tags from the source must be preserved in equivalent
  // positions in the translated output.
  return `You are an expert eCOA localization specialist performing string migration.

The paper translation document below contains ${scriptName} translations of the source strings. Your job is to produce correctly-formatted migrated strings that match the style and structure of the vendor's translation.

CRITICAL RULES:
- Output the complete translated string for each UUID, using the paper document as the authoritative source of the ${scriptName} text.
- Preserve any XML/HTML tags from the source string in equivalent positions in your output (e.g. <b>, <u>, <i>, <size value='...'>, <br />). The tag structure and attributes must remain identical.
- Clean up PDF extraction artifacts: remove extra spaces before periods/commas, normalise punctuation spacing.
- If the source string has no ${scriptName} equivalent in the document (e.g. a version footer like "V2.0 (US English)"), adapt minimally (e.g. change "US English" → "${scriptName}") or set confidence to "low" and return the source string unchanged.
- For plain-text source strings (no XML tags), return the plain ${scriptName} equivalent with no extra tags.

## Source strings — keyed by UUID (structural prefixes and tags already stripped)
\`\`\`json
${JSON.stringify(strippedBatch, null, 2)}
\`\`\`

## Paper translation document (extracted text — reference)
\`\`\`
${translatedDocument}
\`\`\`

## Migration guidelines
${guidelinesText}

## Response format
Return a JSON object where each key is a UUID, mapped to:
- "direct_translation": the complete translated string (with XML tags preserved), or the source string if no match
- "confidence": "high" | "medium" | "low"
- "confidence_rationale": 1–2 sentences
- "flags": array of concern strings (empty if none)

Confidence: high = clear match; medium = paraphrased/inferred; low = not found.
Return ONLY the JSON object. Start with { and end with }.`;
}


// What Claude returns per string — two modes depending on script
type ClaudeAnchorEntry = {
  // Arabic mode: short anchor for verbatim extraction
  match_anchor?: string | null;
  // Korean/CJK mode: full translated string with XML preserved
  direct_translation?: string | null;
  confidence: 'high' | 'medium' | 'low';
  confidence_rationale: string;
  flags: string[];
};

// What the API returns to the client (migrated_string populated from verbatim extraction)
type MigrationEntry = {
  migrated_string: string;
  confidence: 'high' | 'medium' | 'low';
  confidence_rationale: string;
  flags: string[];
};

async function translateBatch(
  strippedBatch: Record<string, string>,
  translatedDocument: string,
  guidelinesText: string,
): Promise<{ anchors: Record<string, ClaudeAnchorEntry>; usage: { input_tokens: number; output_tokens: number }; model: string }> {
  let retries = 0;
  while (true) {
    try {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: 'You are an expert eCOA localization specialist. Return precise structured JSON only.',
        messages: [{ role: 'user', content: buildPrompt(strippedBatch, translatedDocument, guidelinesText) }],
      });
      const rawText = message.content[0].type === 'text' ? message.content[0].text : '';
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Model did not return valid JSON');
      return { anchors: JSON.parse(jsonMatch[0]), usage: message.usage, model: message.model };
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      const headers = (err as { headers?: Headers }).headers;
      if (status === 429 && retries < 5) {
        const retryAfter = headers ? parseInt(headers.get('retry-after') ?? '15', 10) : 15;
        await sleep((retryAfter + 1) * 1000);
        retries++;
        continue;
      }
      throw err;
    }
  }
}

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const { englishJson, translatedDocument, guidelines } = await request.json();
  const sourceJson = englishJson as Record<string, string>;

  const guidelinesText = Array.isArray(guidelines)
    ? guidelines.map((r: { id: string; title: string; rule: string }) =>
        `[${r.id}] ${r.title}: ${r.rule}`
      ).join('\n')
    : String(guidelines);

  const entries = Object.entries(sourceJson);
  const allTranslations: Record<string, MigrationEntry> = {};
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let modelName = '';

  // ── Phase 1: Positional alignment ────────────────────────────────────────────
  // Build a numbered index from the PDF text (question stems + response options).
  // For instruments that have numbered elements (e.g. IBDQ) this resolves the
  // majority of strings without any LLM call.
  const pdfIndex = buildPDFIndex(translatedDocument);
  const positionalResults = alignPositionally(
    entries.map(([uuid, source]) => ({ uuid, source })),
    pdfIndex,
  );

  const needsLLM: string[] = [];

  for (const { uuid, rawPDFText, confidence: posConf } of positionalResults) {
    const source = sourceJson[uuid];

    if (rawPDFText && posConf === 'high') {
      // Direct positional match — restore platform structure and store
      const cleanText = normalizePDFArabicText(stripPDFNumberPrefix(rawPDFText));
      const migratedString = source ? restoreStructure(source, cleanText) : cleanText;
      allTranslations[uuid] = {
        migrated_string: migratedString,
        confidence: 'high',
        confidence_rationale: 'Positional match — located by question/option number in document.',
        flags: [],
      };
    } else {
      // No positional match — queue for LLM
      needsLLM.push(uuid);
    }
  }

  // ── Phase 2: LLM for unmatched strings ────────────────────────────────────────
  // Titles, instruction paragraphs, XML compound strings, scale labels, and all
  // strings from unnumbered instruments (e.g. WPAI) go through this path.
  // The improved findVerbatimParagraph() handles multi-line prose correctly.
  if (needsLLM.length > 0) {
    // Detect script: Arabic uses anchor mode (stripped source), others use
    // direct-translation mode (full source with XML so Claude can preserve tags).
    const arabicChars = (translatedDocument.match(/[\u0600-\u06FF]/g) ?? []).length;
    const koreanChars = (translatedDocument.match(/[\uAC00-\uD7A3]/g) ?? []).length;
    const cjkChars    = (translatedDocument.match(/[\u4E00-\u9FFF]/g) ?? []).length;
    const isArabicDoc = arabicChars > koreanChars + cjkChars;

    const llmEntries = needsLLM.map(uuid => [uuid, sourceJson[uuid]] as [string, string]);
    const batches: Array<{ stripped: Record<string, string> }> = [];
    for (let i = 0; i < llmEntries.length; i += BATCH_SIZE) {
      const slice = llmEntries.slice(i, i + BATCH_SIZE);
      const stripped: Record<string, string> = {};
      for (const [k, v] of slice) {
        // Arabic: strip structure (Claude only needs the base text for anchor matching).
        // Non-Arabic: pass the full source string WITH XML tags so Claude can
        // produce a properly-structured direct_translation.
        stripped[k] = isArabicDoc ? stripStructure(v) : v;
      }
      batches.push({ stripped });
    }

    for (const batch of batches) {
      const r = await translateBatch(batch.stripped, translatedDocument, guidelinesText);

      for (const [uuid, anchorEntry] of Object.entries(r.anchors)) {
        const source = sourceJson[uuid];
        const fallback = source ?? '';
        let migratedString = fallback;
        let confidence: MigrationEntry['confidence'] = anchorEntry.confidence;

        if (anchorEntry.direct_translation) {
          // ── Non-Arabic mode: Claude returned the full translated string ──────
          // Use it directly — the source XML structure is already preserved.
          migratedString = anchorEntry.direct_translation;
        } else if (anchorEntry.match_anchor) {
          // ── Arabic mode: anchor-based verbatim extraction ────────────────────
          if (source && source.includes('<br')) {
            // Multi-segment XML block: need a single anchor line for positioning
            const anchorLine = findVerbatimInDocument(anchorEntry.match_anchor, translatedDocument);
            if (anchorLine) {
              migratedString = rebuildMultiSegmentXML(source, anchorLine, translatedDocument);
            } else {
              confidence = 'low';
              anchorEntry.confidence_rationale = `Anchor not found. English placeholder retained.`;
            }
          } else {
            // Prose string: collect full paragraph, not just one line
            const strippedLen = stripStructure(source ?? '').length;
            const verbatimText = findVerbatimParagraph(
              anchorEntry.match_anchor,
              translatedDocument,
              strippedLen,
            );
            if (verbatimText) {
              const cleanText = normalizePDFArabicText(stripPDFNumberPrefix(verbatimText));
              migratedString = source ? restoreStructure(source, cleanText) : cleanText;
            } else {
              confidence = 'low';
              anchorEntry.confidence_rationale = `Anchor "${anchorEntry.match_anchor}" not found. English placeholder retained.`;
            }
          }
        }

        allTranslations[uuid] = {
          migrated_string: migratedString,
          confidence,
          confidence_rationale: anchorEntry.confidence_rationale,
          flags: anchorEntry.flags ?? [],
        };
      }

      totalInputTokens += r.usage.input_tokens;
      totalOutputTokens += r.usage.output_tokens;
      modelName = r.model;
    }
  }

  return NextResponse.json({
    translations: allTranslations,
    model: modelName || 'positional',
    usage: { input_tokens: totalInputTokens, output_tokens: totalOutputTokens },
    batches: needsLLM.length > 0 ? Math.ceil(needsLLM.length / BATCH_SIZE) : 0,
    positionalMatches: entries.length - needsLLM.length,
  });
}

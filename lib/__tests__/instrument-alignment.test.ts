import { describe, it, expect } from 'vitest';
import {
  stripDiacriticsForSearch,
  buildPDFIndex,
  classifySource,
  alignPositionally,
  findVerbatimParagraph,
} from '../instrument-alignment';

// ─── stripDiacriticsForSearch ────────────────────────────────────────────────

describe('stripDiacriticsForSearch', () => {
  it('strips Arabic diacritical marks (tashkeel)', () => {
    // "كُلّ" (with damma + shadda) → "كل"
    const withDiacritics = '\u0643\u064F\u0644\u0651';
    expect(stripDiacriticsForSearch(withDiacritics)).toBe('\u0643\u0644');
  });

  it('strips tatweel/kashida', () => {
    // "كـــلمة" → "كلمة"
    expect(stripDiacriticsForSearch('كـــلمة')).toBe('كلمة');
  });

  it('normalizes alef variants to plain alef', () => {
    // أ إ آ ٱ → ا
    expect(stripDiacriticsForSearch('أحمد')).toBe('احمد');
    expect(stripDiacriticsForSearch('إسلام')).toBe('اسلام');
    expect(stripDiacriticsForSearch('آمن')).toBe('امن');
  });

  it('normalizes hamza carriers (waw/yeh)', () => {
    // ؤ → و, ئ → ي
    expect(stripDiacriticsForSearch('مؤمن')).toBe('مومن');
    expect(stripDiacriticsForSearch('رئيس')).toBe('رييس');
  });

  it('replaces punctuation with spaces', () => {
    expect(stripDiacriticsForSearch('كلمة، كلمة')).toBe('كلمة كلمة');
    expect(stripDiacriticsForSearch('سؤال؟')).toBe('سوال');
  });

  it('collapses whitespace and trims', () => {
    expect(stripDiacriticsForSearch('  كلمة    كلمة  ')).toBe('كلمة كلمة');
  });

  it('strips isolated single-char ي / ة / ى tokens (gender markers)', () => {
    expect(stripDiacriticsForSearch('توقف ي')).toBe('توقف');
    expect(stripDiacriticsForSearch('ة كلمة')).toBe('كلمة');
  });

  it('returns empty string for empty input', () => {
    expect(stripDiacriticsForSearch('')).toBe('');
  });
});

// ─── buildPDFIndex ───────────────────────────────────────────────────────────

describe('buildPDFIndex', () => {
  it('indexes numbered question stems', () => {
    const pdfText = `.1 كم مرة شعرت بالتعب
.2 كم مرة شعرت بالحزن`;
    const index = buildPDFIndex(pdfText);
    expect(index.hasNumberedElements).toBe(true);
    expect(index.stems.size).toBe(2);
    expect(index.stems.get(1)).toContain('كم مرة شعرت بالتعب');
    expect(index.stems.get(2)).toContain('كم مرة شعرت بالحزن');
  });

  it('indexes response options under their question', () => {
    const pdfText = `.1 كم مرة شعرت بالتعب
1 كلّ الوقت
2 معظم الوقت
3 بعض الوقت`;
    const index = buildPDFIndex(pdfText);
    expect(index.options.size).toBe(3);
    expect(index.options.get('1_1')).toBe('1 كلّ الوقت');
    expect(index.options.get('1_2')).toBe('2 معظم الوقت');
    expect(index.options.get('1_3')).toBe('3 بعض الوقت');
  });

  it('collects multi-line instruction tails onto question stems', () => {
    const pdfText = `.1 كم مرة شعرت بالتعب
الرجاء اختيار إجابة واحدة
1 كلّ الوقت`;
    const index = buildPDFIndex(pdfText);
    // The instruction tail should be concatenated onto stem 1
    expect(index.stems.get(1)).toContain('الرجاء اختيار إجابة واحدة');
  });

  it('returns empty index for unnumbered document', () => {
    const pdfText = `This is just plain text
without any numbered elements`;
    const index = buildPDFIndex(pdfText);
    expect(index.hasNumberedElements).toBe(false);
    expect(index.stems.size).toBe(0);
    expect(index.options.size).toBe(0);
  });

  it('handles empty input', () => {
    const index = buildPDFIndex('');
    expect(index.hasNumberedElements).toBe(false);
    expect(index.stems.size).toBe(0);
  });

  it('stops collecting tail lines at document boundaries', () => {
    const pdfText = `.1 سؤال أول
© Copyright 2024
.2 سؤال ثاني`;
    const index = buildPDFIndex(pdfText);
    // Copyright line should NOT be part of stem 1
    expect(index.stems.get(1)).not.toContain('Copyright');
    expect(index.stems.size).toBe(2);
  });
});

// ─── classifySource ──────────────────────────────────────────────────────────

describe('classifySource', () => {
  it('classifies numbered question stems', () => {
    const result = classifySource('1. How often did you feel tired?', 0);
    expect(result).toEqual({ kind: 'q_stem', questionNum: 1 });
  });

  it('classifies multi-digit question stems', () => {
    const result = classifySource('30. Have you been satisfied?', 0);
    expect(result).toEqual({ kind: 'q_stem', questionNum: 30 });
  });

  it('classifies numbered response options', () => {
    const result = classifySource('1     ALL OF THE TIME', 5);
    expect(result).toEqual({ kind: 'option', questionNum: 5, optionNum: 1 });
  });

  it('requires current question > 0 for options', () => {
    const result = classifySource('1     ALL OF THE TIME', 0);
    expect(result).toEqual({ kind: 'other' });
  });

  it('classifies plain text as other', () => {
    expect(classifySource('Please select one answer', 1)).toEqual({ kind: 'other' });
  });

  it('classifies XML strings as other', () => {
    expect(classifySource('<b>Example</b>', 1)).toEqual({ kind: 'other' });
  });
});

// ─── alignPositionally ──────────────────────────────────────────────────────

describe('alignPositionally', () => {
  it('matches entries to PDF index by position', () => {
    const pdfText = `.1 سؤال أول
1 إجابة أولى
2 إجابة ثانية
.2 سؤال ثاني`;
    const pdfIndex = buildPDFIndex(pdfText);

    const entries = [
      { uuid: 'a', source: '1. First question' },
      { uuid: 'b', source: '1     First answer' },
      { uuid: 'c', source: '2     Second answer' },
      { uuid: 'd', source: '2. Second question' },
    ];

    const results = alignPositionally(entries, pdfIndex);

    expect(results[0]).toMatchObject({ uuid: 'a', confidence: 'high' });
    expect(results[0].rawPDFText).toContain('سؤال أول');
    expect(results[1]).toMatchObject({ uuid: 'b', confidence: 'high' });
    expect(results[2]).toMatchObject({ uuid: 'c', confidence: 'high' });
    expect(results[3]).toMatchObject({ uuid: 'd', confidence: 'high' });
  });

  it('returns low confidence for unnumbered entries', () => {
    const pdfIndex = buildPDFIndex('.1 سؤال\n1 إجابة');
    const entries = [
      { uuid: 'x', source: 'Please select one answer' },
    ];
    const results = alignPositionally(entries, pdfIndex);
    expect(results[0]).toMatchObject({ uuid: 'x', rawPDFText: null, confidence: 'low' });
  });

  it('returns all low confidence for unnumbered instruments', () => {
    const pdfIndex = buildPDFIndex('This is plain text');
    const entries = [
      { uuid: 'a', source: '1. Question' },
      { uuid: 'b', source: 'Plain text' },
    ];
    const results = alignPositionally(entries, pdfIndex);
    expect(results.every(r => r.confidence === 'low')).toBe(true);
    expect(results.every(r => r.rawPDFText === null)).toBe(true);
  });

  it('returns low confidence when stem not found in index', () => {
    const pdfIndex = buildPDFIndex('.1 سؤال');
    const entries = [
      { uuid: 'a', source: '99. Question not in PDF' },
    ];
    const results = alignPositionally(entries, pdfIndex);
    expect(results[0]).toMatchObject({ uuid: 'a', rawPDFText: null, confidence: 'low' });
  });
});

// ─── findVerbatimParagraph ──────────────────────────────────────────────────

describe('findVerbatimParagraph', () => {
  const pdfText = `هذا هو العنوان
السطر الأول من الفقرة
السطر الثاني من الفقرة
السطر الثالث من الفقرة
.1 سؤال جديد`;

  it('finds anchor on a single line (pass 1)', () => {
    const result = findVerbatimParagraph('العنوان', pdfText, 10);
    expect(result).toBe('هذا هو العنوان');
  });

  it('returns null for empty/short anchor', () => {
    expect(findVerbatimParagraph('', pdfText, 10)).toBeNull();
    expect(findVerbatimParagraph('ab', pdfText, 10)).toBeNull();
  });

  it('returns null when anchor not found', () => {
    expect(findVerbatimParagraph('غير موجود في النص', pdfText, 10)).toBeNull();
  });

  it('returns single line for short source strings (< 100 chars)', () => {
    const result = findVerbatimParagraph('السطر الأول', pdfText, 20);
    expect(result).toBe('السطر الأول من الفقرة');
  });

  it('collects continuation lines for long source strings', () => {
    // sourceStrippedLen > 100 triggers paragraph collection
    const result = findVerbatimParagraph('السطر الأول', pdfText, 200);
    expect(result).toContain('السطر الأول من الفقرة');
    expect(result).toContain('السطر الثاني من الفقرة');
  });

  it('stops collecting at stop lines (next question stem)', () => {
    const result = findVerbatimParagraph('السطر الأول', pdfText, 500);
    // Should NOT include the ".1 سؤال جديد" line
    expect(result).not.toContain('سؤال جديد');
  });

  it('matches via two-line concat (pass 2)', () => {
    // Anchor that spans two lines
    const twoLinePdf = `أول كلمة
ثاني كلمة
سطر آخر`;
    const result = findVerbatimParagraph('أول كلمة ثاني كلمة', twoLinePdf, 10);
    expect(result).toBe('أول كلمة');
  });

  it('matches via space-collapsed (pass 3)', () => {
    // Anchor with different spacing
    const spacedPdf = `كلمة   مع   فراغات
سطر آخر`;
    const result = findVerbatimParagraph('كلمة مع فراغات', spacedPdf, 10);
    expect(result).toBe('كلمة   مع   فراغات');
  });
});

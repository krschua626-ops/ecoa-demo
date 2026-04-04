import { describe, it, expect } from 'vitest';
import {
  stripStructure,
  restoreStructure,
  stripPDFNumberPrefix,
  normalizePDFArabicText,
} from '../translate-helpers';

// ─── stripStructure ──────────────────────────────────────────────────────────

describe('stripStructure', () => {
  it('strips numbered response option prefix', () => {
    expect(stripStructure('1     ALL OF THE TIME')).toBe('ALL OF THE TIME');
    expect(stripStructure('7     NONE OF THE TIME')).toBe('NONE OF THE TIME');
  });

  it('strips numbered question stem prefix', () => {
    expect(stripStructure('1. How often did you feel tired?')).toBe(
      'How often did you feel tired?',
    );
    expect(stripStructure('30. Have you been satisfied overall?')).toBe(
      'Have you been satisfied overall?',
    );
  });

  it('strips XML/HTML tags', () => {
    expect(stripStructure('<b>Bold text</b>')).toBe('Bold text');
    expect(
      stripStructure("<size value='l'>     Some large text</size>"),
    ).toBe('Some large text');
  });

  it('handles nested XML tags', () => {
    expect(stripStructure('<b><u>Bold underline</u></b>')).toBe('Bold underline');
  });

  it('returns plain text unchanged', () => {
    expect(stripStructure('Please select one answer')).toBe(
      'Please select one answer',
    );
  });

  it('handles option with varying space counts', () => {
    expect(stripStructure('3  Short option')).toBe('Short option');
    expect(stripStructure('5          Wide option')).toBe('Wide option');
  });

  it('does not strip single-space digit prefix (not an option pattern)', () => {
    // "1 text" with only one space is not a response option
    expect(stripStructure('1 text')).toBe('1 text');
  });
});

// ─── restoreStructure ────────────────────────────────────────────────────────

describe('restoreStructure', () => {
  it('restores numbered response option prefix with standard 5 spaces', () => {
    expect(restoreStructure('1     ALL OF THE TIME', 'كل الوقت')).toBe(
      '1     كل الوقت',
    );
    // Even if original had different spacing, output always has 5 spaces
    expect(restoreStructure('3  Short option', 'خيار قصير')).toBe(
      '3     خيار قصير',
    );
  });

  it('restores question stem prefix', () => {
    expect(
      restoreStructure('1. How often did you feel tired?', 'كم مرة شعرت بالتعب'),
    ).toBe('1. كم مرة شعرت بالتعب');
  });

  it('preserves multi-digit stem prefix spacing', () => {
    expect(restoreStructure('30. Have you been satisfied?', 'هل أنت راضٍ')).toBe(
      '30. هل أنت راضٍ',
    );
  });

  it('replaces first text node in XML', () => {
    const source = '<b>Bold text</b>';
    expect(restoreStructure(source, 'نص عريض')).toBe('<b>نص عريض</b>');
  });

  it('preserves leading whitespace in XML text nodes', () => {
    const source = "<size value='l'>     Some large text</size>";
    expect(restoreStructure(source, 'نص كبير')).toBe(
      "<size value='l'>     نص كبير</size>",
    );
  });

  it('returns translated text for plain strings', () => {
    expect(restoreStructure('Please select', 'الرجاء الاختيار')).toBe(
      'الرجاء الاختيار',
    );
  });

  it('trims whitespace from translated text', () => {
    expect(restoreStructure('1. Question', '  سؤال  ')).toBe('1. سؤال');
  });
});

// ─── stripPDFNumberPrefix ────────────────────────────────────────────────────

describe('stripPDFNumberPrefix', () => {
  it('strips Western digit prefix', () => {
    expect(stripPDFNumberPrefix('1 كلّ الوقت')).toBe('كلّ الوقت');
    expect(stripPDFNumberPrefix('25 نص')).toBe('نص');
  });

  it('strips Arabic-Indic digit prefix', () => {
    expect(stripPDFNumberPrefix('١ نص عربي')).toBe('نص عربي');
  });

  it('strips RTL period artifact prefix', () => {
    expect(stripPDFNumberPrefix('.1 كم من الوقت')).toBe('كم من الوقت');
    expect(stripPDFNumberPrefix('.١ كم من الوقت')).toBe('كم من الوقت');
  });

  it('returns text unchanged when no prefix', () => {
    expect(stripPDFNumberPrefix('كلمة عادية')).toBe('كلمة عادية');
  });

  it('handles empty string', () => {
    expect(stripPDFNumberPrefix('')).toBe('');
  });
});

// ─── normalizePDFArabicText ──────────────────────────────────────────────────

describe('normalizePDFArabicText', () => {
  it('normalizes gender-inclusive slash spacing', () => {
    expect(normalizePDFArabicText('مضطرا / ة')).toBe('مضطرا/ة');
  });

  it('normalizes period spacing mid-sentence', () => {
    expect(normalizePDFArabicText('حياتك . سوف')).toBe('حياتك. سوف');
  });

  it('normalizes trailing period spacing', () => {
    expect(normalizePDFArabicText('نهاية .')).toBe('نهاية.');
  });

  it('leaves correct text unchanged', () => {
    expect(normalizePDFArabicText('نص عادي بدون مشاكل')).toBe(
      'نص عادي بدون مشاكل',
    );
  });

  it('handles multiple normalizations in one string', () => {
    expect(normalizePDFArabicText('مضطرا / ة في حياتك . سوف')).toBe(
      'مضطرا/ة في حياتك. سوف',
    );
  });
});

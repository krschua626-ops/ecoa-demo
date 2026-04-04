import { describe, it, expect } from 'vitest';
import { normalizeArabic } from '../arabic-normalize';

describe('normalizeArabic', () => {
  it('strips tatweel/kashida characters', () => {
    // Kashida (U+0640) is used for PDF justification
    expect(normalizeArabic('كـــلـــمـــة')).toBe('كلمة');
  });

  it('normalizes Heh Doachashmee to standard Heh', () => {
    // U+06BE → U+0647
    expect(normalizeArabic('\u06BE')).toBe('\u0647');
  });

  it('normalizes Farsi Yeh to standard Yeh', () => {
    // U+06CC → U+064A
    expect(normalizeArabic('\u06CC')).toBe('\u064A');
  });

  it('normalizes Heh Goal to standard Heh', () => {
    // U+06C1 → U+0647
    expect(normalizeArabic('\u06C1')).toBe('\u0647');
  });

  it('collapses multiple spaces to single space', () => {
    expect(normalizeArabic('كلمة    كلمة')).toBe('كلمة كلمة');
  });

  it('preserves newlines while collapsing spaces', () => {
    expect(normalizeArabic('سطر أول\nسطر ثاني')).toBe('سطر أول\nسطر ثاني');
  });

  it('collapses tabs to spaces', () => {
    expect(normalizeArabic('كلمة\t\tكلمة')).toBe('كلمة كلمة');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeArabic('  كلمة  ')).toBe('كلمة');
  });

  it('handles empty string', () => {
    expect(normalizeArabic('')).toBe('');
  });

  it('applies NFKC normalization (presentation forms)', () => {
    // Arabic Presentation Form-B "ﻻ" (U+FEFC) → "لا" (lam + alef)
    expect(normalizeArabic('\uFEFC')).toBe('لا');
  });

  it('handles mixed Arabic and Latin text', () => {
    expect(normalizeArabic('Version 2.0 نسخة')).toBe('Version 2.0 نسخة');
  });

  it('handles multiple normalizations together', () => {
    // Farsi yeh + kashida + extra spaces
    const input = '\u06CC\u0640\u0640   test';
    const result = normalizeArabic(input);
    expect(result).toBe('\u064A test');
  });
});

import { NextRequest, NextResponse } from 'next/server';
import { normalizeArabic } from '../../../lib/arabic-normalize';

async function extractRTLText(buffer: Buffer): Promise<string> {
  // webpackIgnore keeps this out of the bundle; Node.js native import() handles the .mjs file
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — magic comment preserved through TypeScript compilation
  const { getDocument } = await import(/* webpackIgnore: true */ 'pdfjs-dist/legacy/build/pdf.mjs');

  const data = new Uint8Array(buffer);
  const doc = await getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;

  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    type TextItem = { str: string; transform: number[]; dir: string };
    const items = (content.items as TextItem[]).filter(i => i.str.trim());

    // Group by y-coordinate (3pt tolerance)
    const lineMap = new Map<number, TextItem[]>();
    for (const item of items) {
      const y = Math.round(item.transform[5] / 3) * 3;
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y)!.push(item);
    }

    // Merge diacritic-only buckets into the nearest non-diacritic bucket within 6pt.
    // Arabic combining marks (shadda, kasra, tanwin etc.) are often rendered at a
    // slightly different y-coordinate from their base letter — typically 2–5pt away.
    // The 3pt bucket tolerance is not enough to catch them, so they end up as
    // isolated single-char lines in the output. By relocating them before building
    // line strings, the existing x-sort + pendingDiacritic logic attaches them correctly.
    for (const [y, lineItems] of [...lineMap.entries()]) {
      if (lineItems.every(i => /^[\u064B-\u065F\s]+$/.test(i.str))) {
        // This bucket is entirely combining diacritics — find nearest non-diacritic bucket
        const nearby = [...lineMap.keys()].find(
          k => k !== y && Math.abs(k - y) <= 6 &&
            lineMap.get(k)!.some(i => !/^[\u064B-\u065F\s]+$/.test(i.str))
        );
        if (nearby !== undefined) {
          lineMap.get(nearby)!.push(...lineItems);
          lineMap.delete(y);
        }
      }
    }

    // Sort lines top-to-bottom (descending y in PDF coords)
    const sortedYs = [...lineMap.keys()].sort((a, b) => b - a);

    for (const y of sortedYs) {
      const lineItems = lineMap.get(y)!;
      const rtlCount = lineItems.filter(i => i.dir === 'rtl').length;
      const ltrCount = lineItems.filter(i => i.dir === 'ltr').length;
      const isRTL = rtlCount >= ltrCount;

      // RTL lines: sort items right→left (descending x = reading order)
      if (isRTL) lineItems.sort((a, b) => b.transform[4] - a.transform[4]);
      else lineItems.sort((a, b) => a.transform[4] - b.transform[4]);

      // Build line text. PDF stores some diacritics as separate items whose str
      // is " ّ" (leading space + combining char). Trim and reattach them to the
      // adjacent Arabic word rather than blindly attaching to the preceding item
      // (which might be a digit like "5", yielding "5ٍ" instead of "راضٍ").
      const parts: string[] = [];
      let pendingDiacritic = '';
      for (const item of lineItems) {
        const s = item.str.trim();
        if (!s) continue;
        const isDiacriticOnly = /^[\u064B-\u065F]+$/.test(s);
        if (isDiacriticOnly) {
          // If the preceding token is purely ASCII/numeric, defer to next token
          if (parts.length > 0 && /^[\x00-\x7F]+$/.test(parts[parts.length - 1])) {
            pendingDiacritic += s;
          } else if (parts.length > 0) {
            parts[parts.length - 1] += s;
          } else {
            pendingDiacritic += s;
          }
        } else if (parts.length > 0 && parts[parts.length - 1].endsWith('\u0640')) {
          // Previous token ends with tatweel (kashida used for PDF justification).
          // This is the same word split across two PDF items — join without space.
          // normalizeArabic() will strip the tatweel later.
          if (pendingDiacritic) {
            parts[parts.length - 1] += s + pendingDiacritic;
            pendingDiacritic = '';
          } else {
            parts[parts.length - 1] += s;
          }
        } else {
          if (pendingDiacritic) {
            parts.push(s + pendingDiacritic);
            pendingDiacritic = '';
          } else {
            parts.push(s);
          }
        }
      }
      // Flush any remaining pending diacritic onto the last Arabic token
      if (pendingDiacritic && parts.length > 0) {
        parts[parts.length - 1] += pendingDiacritic;
      }
      const lineText = parts.join(' ');
      if (lineText) allLines.push(lineText);
    }
  }

  return normalizeArabic(allLines.join('\n'));
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractRTLText(buffer);

  return NextResponse.json({ text, pages: 0 });
}

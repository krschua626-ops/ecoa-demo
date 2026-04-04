'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

type TranslationEntry = {
  migrated_string: string;
  translated_string?: string; // legacy fallback
  confidence: 'high' | 'medium' | 'low' | 'needs_review';
  confidence_rationale: string;
  flags: string[];
};

type TranslationResult = {
  translations: Record<string, TranslationEntry>;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
};

type GuidelineRule = { id: string; title: string; rule: string; type: string; rationale: string };

function toHtml(text: string): string {
  return text
    .replace(/<size\s+value='[^']*'\s*>/g, '<span>')
    .replace(/<\/size>/g, '</span>');
}

function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: toHtml(text) }}
    />
  );
}

const confidenceConfig = {
  high:         { label: 'Matched',        rowClass: '',                   badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  medium:       { label: 'Review',         rowClass: 'bg-amber-50/40',     badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  low:          { label: 'No match',       rowClass: 'bg-red-50/50',       badgeClass: 'bg-red-50 text-red-700 border-red-200' },
  needs_review: { label: 'Human review',  rowClass: 'bg-violet-50/50',    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200' },
};

export default function TranslationClient({
  sampleEnglish,
  sampleGerman,
  guidelines,
}: {
  sampleEnglish: Record<string, string>;
  sampleGerman: string;
  guidelines: GuidelineRule[];
}) {
  const hasSampleEnglish = Object.keys(sampleEnglish).length > 0;
  const hasSampleGerman  = sampleGerman.trim().length > 0;

  const [englishJson, setEnglishJson] = useState(sampleEnglish);
  const [translatedDoc, setTranslatedDoc] = useState(sampleGerman);
  const [englishSource, setEnglishSource] = useState<'sample' | 'upload'>(hasSampleEnglish ? 'sample' : 'upload');
  const [germanSource, setGermanSource]   = useState<'sample' | 'upload'>(hasSampleGerman  ? 'sample' : 'upload');
  const [uploadedArray, setUploadedArray] = useState<Array<Record<string, string>> | null>(null);
  const [isRunning, setIsRunning]         = useState(false);
  const [result, setResult]               = useState<TranslationResult | null>(null);
  const [expandedKey, setExpandedKey]     = useState<string | null>(null);
  const englishFileRef = useRef<HTMLInputElement>(null);
  const germanFileRef  = useRef<HTMLInputElement>(null);

  const handleEnglishUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (Array.isArray(parsed)) {
          // Platform array format: [{string_resource_uuid, source_locale_text, ...}]
          setUploadedArray(parsed);
          const flat: Record<string, string> = {};
          for (const item of parsed) {
            if (item.string_resource_uuid && item.source_locale_text != null) {
              flat[item.string_resource_uuid] = item.source_locale_text;
            }
          }
          setEnglishJson(flat);
        } else {
          setUploadedArray(null);
          setEnglishJson(parsed);
        }
        setEnglishSource('upload');
      } catch { alert('Invalid JSON file'); }
    };
    reader.readAsText(file);
  };

  const handleGermanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name.toLowerCase().endsWith('.pdf')) {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/extract-pdf', { method: 'POST', body: fd });
      if (!res.ok) { alert('Failed to extract PDF text'); return; }
      const { text } = await res.json();
      setTranslatedDoc(text);
      setGermanSource('upload');
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => { setTranslatedDoc(ev.target?.result as string); setGermanSource('upload'); };
      reader.readAsText(file);
    }
  };

  const runTranslation = async () => {
    setIsRunning(true);
    setResult(null);
    setExpandedKey(null);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ englishJson, translatedDocument: translatedDoc, guidelines }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        alert(`Translation failed: ${err.error ?? res.statusText}`);
        return;
      }
      setResult(await res.json());
    } finally {
      setIsRunning(false);
    }
  };

  const downloadJson = () => {
    if (!result) return;
    let output: unknown;
    if (uploadedArray) {
      // Reconstruct original array format with target_locale_text filled in
      output = uploadedArray.map(item => {
        const entry = result.translations[item.string_resource_uuid];
        const migratedText = entry?.migrated_string ?? entry?.translated_string;
        // Only overwrite for high/medium confidence; low and needs_review keep the English placeholder
        const autoApproved = entry?.confidence === 'high' || entry?.confidence === 'medium';
        return {
          ...item,
          target_locale_text: (migratedText && autoApproved) ? migratedText : item.target_locale_text,
        };
      });
    } else {
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(result.translations)) flat[k] = v.migrated_string ?? v.translated_string ?? '';
      output = flat;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' }));
    a.download = 'translated-output.json';
    a.click();
  };

  const entries = result ? Object.entries(result.translations) : [];
  const highCount       = entries.filter(([, v]) => v.confidence === 'high').length;
  const medCount        = entries.filter(([, v]) => v.confidence === 'medium').length;
  const lowCount        = entries.filter(([, v]) => v.confidence === 'low').length;
  const reviewCount     = entries.filter(([, v]) => v.confidence === 'needs_review').length;
  const flaggedCount    = entries.filter(([, v]) => v.flags?.length > 0).length;

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
          Step 3 — String Migration
        </p>
        <h2 className="text-2xl font-bold text-slate-900">String Migration</h2>
        <p className="text-slate-500 mt-1 text-sm">
          Matches each JSON string key to its equivalent in the author&rsquo;s translated PDF. No translation is generated — strings are copied verbatim from the source document.
        </p>
      </div>

      {/* Input cards */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* English JSON */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Input 1</p>
              <p className="text-sm font-semibold text-slate-900">English JSON</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              englishSource === 'sample'
                ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${englishSource === 'sample' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
              {englishSource === 'sample' ? 'Pre-loaded sample' : 'Uploaded'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            {Object.keys(englishJson).length > 0
              ? `${Object.keys(englishJson).length} strings · English placeholders in target fields`
              : 'No file loaded — upload a JSON to begin'}
          </p>
          <div className="flex items-center gap-2">
            <input ref={englishFileRef} type="file" accept=".json" className="hidden" onChange={handleEnglishUpload} />
            <button onClick={() => englishFileRef.current?.click()} className="text-xs text-slate-500 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors">
              {Object.keys(englishJson).length > 0 ? 'Upload different file' : 'Upload JSON file'}
            </button>
            {englishSource === 'upload' && hasSampleEnglish && (
              <button onClick={() => { setEnglishJson(sampleEnglish); setEnglishSource('sample'); setUploadedArray(null); }} className="text-xs text-indigo-600 hover:text-indigo-800">
                Use sample
              </button>
            )}
          </div>
        </div>

        {/* Translated document */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Input 2</p>
              <p className="text-sm font-semibold text-slate-900">Translated Document</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              germanSource === 'sample'
                ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${germanSource === 'sample' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
              {germanSource === 'sample' ? 'Pre-loaded sample' : 'Uploaded'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            {translatedDoc.trim().length > 0
              ? 'Paper translation · strings extracted verbatim'
              : 'No file loaded — upload a PDF or TXT to begin'}
          </p>
          <div className="flex items-center gap-2">
            <input ref={germanFileRef} type="file" accept=".txt,.pdf" className="hidden" onChange={handleGermanUpload} />
            <button onClick={() => germanFileRef.current?.click()} className="text-xs text-slate-500 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors">
              {translatedDoc.trim().length > 0 ? 'Upload different file' : 'Upload PDF or TXT'}
            </button>
            {germanSource === 'upload' && hasSampleGerman && (
              <button onClick={() => { setTranslatedDoc(sampleGerman); setGermanSource('sample'); }} className="text-xs text-indigo-600 hover:text-indigo-800">
                Use sample
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Run button */}
      <div className="mb-8">
        <button
          onClick={runTranslation}
          disabled={isRunning}
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {isRunning ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {Object.keys(englishJson).length > 30 ? `Migrating ${Object.keys(englishJson).length} strings in batches…` : 'Migration agent running…'}
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {result ? 'Run Again' : 'Run Migration'}
            </>
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Summary bar */}
          <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Total strings</p>
                <p className="text-xl font-bold text-slate-900">{entries.length}</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />{highCount} matched
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />{medCount} review
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <span className="w-2 h-2 rounded-full bg-red-500" />{lowCount} no match
                </span>
                {reviewCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    <span className="w-2 h-2 rounded-full bg-violet-500" />{reviewCount} human review
                  </span>
                )}
                {flaggedCount > 0 && (
                  <>
                    <div className="w-px h-4 bg-slate-200" />
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {flaggedCount} flagged
                    </span>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-400">{result.model} · {(result.usage.input_tokens ?? 0) + (result.usage.output_tokens ?? 0)} tokens</p>
          </div>

          {/* Diff table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto mb-6">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 text-xs text-slate-400">
              Click any row to expand match rationale · Low-confidence rows (no match found, English placeholder retained) highlighted in red · Flagged strings marked with ⚠
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider" style={{width: '180px'}}>Key</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">English</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Arabic (IL) — from PDF</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider" style={{width: '100px'}}>Match</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(([key, entry]) => {
                  const conf = confidenceConfig[entry.confidence] ?? confidenceConfig.medium;
                  const hasFlags  = entry.flags?.length > 0;
                  const isExpanded = expandedKey === key;
                  return (
                    <tr key={key} className="border-b border-slate-100 last:border-0">
                      <td colSpan={4} className="p-0">
                        <div
                          className={`grid cursor-pointer transition-colors hover:brightness-95 ${conf.rowClass}`}
                          style={{gridTemplateColumns: '180px 1fr 1fr 100px'}}
                          onClick={() => setExpandedKey(isExpanded ? null : key)}
                        >
                          <div className="px-4 py-3 flex items-start gap-1.5">
                            {hasFlags && (
                              <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            )}
                            <code className="text-xs text-slate-500 font-mono break-all leading-relaxed">{key}</code>
                          </div>
                          <div className="px-4 py-3 text-slate-600 text-sm leading-relaxed"><RichText text={englishJson[key] ?? ''} /></div>
                          <div className="px-4 py-3 text-slate-900 text-sm font-medium leading-relaxed" dir="rtl" lang="ar"><RichText text={entry.migrated_string ?? entry.translated_string ?? ''} /></div>
                          <div className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${conf.badgeClass}`}>
                              {conf.label}
                            </span>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className={`px-4 pb-3 ${conf.rowClass}`}>
                            <div className="ml-0 bg-white border border-slate-100 rounded-lg px-4 py-3">
                              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Match rationale</p>
                              <p className="text-sm text-slate-700">{entry.confidence_rationale}</p>
                              {hasFlags && (
                                <div className="mt-3 pt-3 border-t border-slate-100">
                                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1.5">Flags</p>
                                  <ul className="space-y-1">
                                    {entry.flags.map((flag, i) => (
                                      <li key={i} className="text-sm text-amber-700 flex items-start gap-1.5">
                                        <span className="text-amber-400 flex-shrink-0 mt-0.5">·</span>
                                        {flag}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={downloadJson}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Migrated JSON
            </button>
            <Link
              href="/validation"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Proceed to Intake Validation
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

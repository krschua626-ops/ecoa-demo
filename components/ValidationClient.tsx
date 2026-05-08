'use client';

import { useState } from 'react';
import Link from 'next/link';

type StructuralCheck = { id: string; label: string; detail: string; passed: boolean };
type Flag = {
  id: string; key: string; severity: 'low' | 'medium' | 'high'; routing: string;
  englishSource?: string; translatedString: string; issue: string; recommendedAction: string;
  guidelineRef?: string;
};
type ValidationData = {
  instrument: string; language: string; runAt: string;
  structural: { passed: boolean; checks: StructuralCheck[] };
  semantic: { flagCount: number; flags: Flag[] };
  instrumentContext: { flagCount: number; flags: Flag[] };
};

const severityConfig = {
  high:   { label: 'High',   className: 'bg-red-50 text-red-700 border-red-200' },
  medium: { label: 'Medium', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  low:    { label: 'Low',    className: 'bg-sky-50 text-sky-700 border-sky-200' },
};

const routingConfig: Record<string, { label: string; className: string }> = {
  routed_to_team: { label: 'Routed to team',  className: 'bg-violet-50 text-violet-700 border-violet-200' },
  auto_resolved:  { label: 'Auto-resolved',   className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

function SectionHeader({
  title, subtitle, open, onToggle, allPassed, flagCount,
}: {
  title: string; subtitle: string; open: boolean; onToggle: () => void;
  allPassed?: boolean; flagCount?: number;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
    >
      <div className="flex items-center gap-3">
        {allPassed !== undefined && (
          allPassed
            ? <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            : <span className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                {flagCount}
              </span>
        )}
        <div>
          <p className="font-semibold text-slate-900 text-sm">{title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

function FlagCard({ flag, expanded, onToggle }: { flag: Flag; expanded: boolean; onToggle: () => void }) {
  const sev = severityConfig[flag.severity] ?? severityConfig.medium;
  const route = routingConfig[flag.routing] ?? routingConfig.routed_to_team;

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${expanded ? 'border-slate-300' : 'border-slate-200'}`}>
      {/* Flag summary row */}
      <button onClick={onToggle} className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${sev.className}`}>
                {sev.label}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${route.className}`}>
                {route.label}
              </span>
              {flag.guidelineRef && (
                <span className="text-xs text-slate-400 font-mono">{flag.guidelineRef}</span>
              )}
            </div>
            <code className="text-xs font-mono text-slate-500 block mb-1.5">{flag.key}</code>
            <p className="text-sm text-slate-700 leading-relaxed line-clamp-2">{flag.issue}</p>
          </div>
          <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4 space-y-4">
          {flag.englishSource && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">English source</p>
              <p className="text-sm text-slate-700 bg-white border border-slate-100 rounded-lg px-3 py-2 leading-relaxed">{flag.englishSource}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Translated string</p>
            <p className="text-sm font-medium text-slate-900 bg-white border border-slate-100 rounded-lg px-3 py-2 leading-relaxed">{flag.translatedString}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Issue</p>
            <p className="text-sm text-slate-700 leading-relaxed">{flag.issue}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
            <p className="text-xs font-semibold text-[#1B5EA6] uppercase tracking-wide mb-1.5">Recommended action</p>
            <p className="text-sm text-slate-700 leading-relaxed">{flag.recommendedAction}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ValidationClient({ data }: { data: ValidationData }) {
  const [structOpen, setStructOpen] = useState(true);
  const [semanticOpen, setSemanticOpen] = useState(true);
  const [ctxOpen, setCtxOpen] = useState(true);
  const [expandedFlag, setExpandedFlag] = useState<string | null>(null);

  // Handle empty/unrun state
  if (!data.structural || !data.semantic || !data.instrumentContext) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Step 4 — Intake Agent</p>
          <h2 className="text-2xl font-bold text-slate-900">Intake Validation</h2>
          <p className="text-slate-500 mt-1 text-sm">Structural, semantic, and instrument-context validation of the translated output.</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-400 text-sm">No validation data available.</p>
          <p className="text-slate-400 text-xs mt-1">Complete the Translation Agent step first, then run validation.</p>
        </div>
      </div>
    );
  }

  const totalFlags = data.semantic.flagCount + data.instrumentContext.flagCount;

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Step 4 — Intake Agent</p>
        <h2 className="text-2xl font-bold text-slate-900">Intake Validation</h2>
        <p className="text-slate-500 mt-1 text-sm">Structural, semantic, and instrument-context validation of the translated output.</p>
      </div>

      {/* Run summary bar */}
      <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Instrument</p>
            <p className="font-semibold text-slate-900 text-sm">{data.instrument}</p>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Language</p>
            <p className="font-semibold text-slate-900 text-sm">{data.language}</p>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Structural</p>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              All passed
            </span>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Flags raised</p>
            <p className="font-semibold text-amber-600 text-sm">{totalFlags} flags</p>
          </div>
        </div>
        <p className="text-xs text-slate-400">
          {new Date(data.runAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-4 mb-8">

        {/* Structural */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <SectionHeader
            title="Structural Checks"
            subtitle={`${data.structural.checks.length} checks · all passed`}
            open={structOpen}
            onToggle={() => setStructOpen(o => !o)}
            allPassed={true}
          />
          {structOpen && (
            <div className="border-t border-slate-100 px-6 py-4">
              <ul className="space-y-2">
                {data.structural.checks.map(check => (
                  <li key={check.id} className="flex items-start gap-3">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-2.5 h-2.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{check.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{check.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Semantic */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <SectionHeader
            title="Semantic Flags"
            subtitle={`${data.semantic.flagCount} flag${data.semantic.flagCount !== 1 ? 's' : ''} · meaning preservation checks`}
            open={semanticOpen}
            onToggle={() => setSemanticOpen(o => !o)}
            allPassed={false}
            flagCount={data.semantic.flagCount}
          />
          {semanticOpen && (
            <div className="border-t border-slate-100 px-6 py-4 space-y-3">
              {data.semantic.flags.map(flag => (
                <FlagCard
                  key={flag.id}
                  flag={flag}
                  expanded={expandedFlag === flag.id}
                  onToggle={() => setExpandedFlag(expandedFlag === flag.id ? null : flag.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Instrument-context */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <SectionHeader
            title="Instrument-Context Flags"
            subtitle={`${data.instrumentContext.flagCount} flag${data.instrumentContext.flagCount !== 1 ? 's' : ''} · migration guideline checks`}
            open={ctxOpen}
            onToggle={() => setCtxOpen(o => !o)}
            allPassed={false}
            flagCount={data.instrumentContext.flagCount}
          />
          {ctxOpen && (
            <div className="border-t border-slate-100 px-6 py-4 space-y-3">
              {data.instrumentContext.flags.map(flag => (
                <FlagCard
                  key={flag.id}
                  flag={flag}
                  expanded={expandedFlag === flag.id}
                  onToggle={() => setExpandedFlag(expandedFlag === flag.id ? null : flag.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Link href="/translation" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Translation
        </Link>
        <Link href="/review" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1B5EA6] text-white text-sm font-semibold rounded-lg hover:bg-[#154E8C] transition-colors">
          Proceed to Screenshot Review
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

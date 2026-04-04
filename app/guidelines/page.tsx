import Link from 'next/link';
import guidelinesData from '@/data/guidelines.json';

const typeConfig: Record<string, { className: string }> = {
  'Response Scale': { className: 'bg-violet-50 text-violet-700 border-violet-200' },
  'Pagination':     { className: 'bg-sky-50 text-sky-700 border-sky-200' },
  'Formatting':     { className: 'bg-slate-100 text-slate-600 border-slate-200' },
  'Scoring':        { className: 'bg-teal-50 text-teal-700 border-teal-200' },
  'Safety':         { className: 'bg-red-50 text-red-700 border-red-200' },
  'Edge Case':      { className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export default function GuidelinesPage() {
  const { instrument, version, language, lastUpdated, updatedBy, rules } = guidelinesData;

  return (
    <div className="p-8 max-w-4xl">
      {/* Page header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
          Step 2 — Guidelines Agent
        </p>
        <h2 className="text-2xl font-bold text-slate-900">Migration Guidelines</h2>
        <p className="text-slate-500 mt-1 text-sm">
          Instrument-specific migration rules captured during the English eCOA build.
        </p>
      </div>

      {/* Instrument context bar */}
      <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Instrument</p>
            <p className="font-semibold text-slate-900">{instrument} v{version}</p>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Language</p>
            <p className="font-semibold text-slate-900">{language}</p>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Rules</p>
            <p className="font-semibold text-slate-900">{rules.length}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Last updated {lastUpdated}</p>
          <p className="text-xs text-slate-400 mt-0.5">{updatedBy}</p>
        </div>
      </div>

      {/* Rules list */}
      <div className="space-y-3 mb-8">
        {rules.map((rule, idx) => {
          const typeStyle = typeConfig[rule.type] ?? { className: 'bg-slate-100 text-slate-600 border-slate-200' };
          return (
            <div key={rule.id} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-start gap-4">
                {/* Rule number */}
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center mt-0.5">
                  {idx + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${typeStyle.className}`}>
                      {rule.type}
                    </span>
                    <span className="text-xs text-slate-400">{rule.id}</span>
                  </div>
                  <p className="font-semibold text-slate-900 text-sm mb-2">{rule.title}</p>
                  <p className="text-sm text-slate-700 leading-relaxed mb-3">{rule.rule}</p>
                  <div className="bg-slate-50 rounded-lg px-4 py-2.5 border border-slate-100">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Rationale</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{rule.rationale}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="flex items-center justify-between">
        <Link
          href="/intake"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Intake
        </Link>
        <Link
          href="/translation"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Proceed to Translation Agent
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

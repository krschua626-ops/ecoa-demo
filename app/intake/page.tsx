import Link from 'next/link';
import intakeDataRaw from '@/data/intake.json';

type Language = {
  code: string;
  label: string;
  status: string;
  priorVersion: string | null;
  notes: string;
};

const intakeData = intakeDataRaw as typeof intakeDataRaw & { languages: Language[] };

const statusConfig = {
  reuse_available: {
    label: 'Reuse Available',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  migration_required: {
    label: 'Migration Required',
    className: 'bg-[#EBF3FC] text-[#154E8C] border-[#BDD7F5]',
    dot: 'bg-[#2470B7]',
  },
  pending_license: {
    label: 'Pending License',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-400',
  },
} as const;

type StatusKey = keyof typeof statusConfig;

export default function IntakePage() {
  const { instrument } = intakeData;
  const languages: Language[] = intakeData.languages as Language[];

  return (
    <div className="p-8 max-w-4xl">
      {/* Page header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
          Step 1 — Orchestration Agent
        </p>
        <h2 className="text-2xl font-bold text-slate-900">Study Intake</h2>
        <p className="text-slate-500 mt-1 text-sm">
          Gap analysis and language migration status for the selected instrument.
        </p>
      </div>

      {/* Instrument info card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Instrument</p>
            <p className="text-sm font-semibold text-slate-900">{instrument.name} v{instrument.version}</p>
            <p className="text-xs text-slate-500">{instrument.fullName}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Items</p>
            <p className="text-sm font-semibold text-slate-900">{instrument.itemCount}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Copyright</p>
            <p className="text-sm font-semibold text-slate-900">{instrument.copyrightHolder}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">License</p>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Active · expires {instrument.licenseExpiry}
            </span>
          </div>
        </div>
      </div>

      {/* Language gap analysis table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm">Language Gap Analysis</h3>
          <p className="text-xs text-slate-400 mt-0.5">{languages.length} target languages · Active instrument selected</p>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Language</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Prior Version</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {languages.map((lang) => {
              const config = statusConfig[lang.status as StatusKey];
              const isSelected = lang.status === 'migration_required';
              return (
                <tr
                  key={lang.code}
                  className={isSelected ? 'bg-[#EBF3FC]/50' : 'hover:bg-slate-50'}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2470B7] flex-shrink-0" />
                      )}
                      <span className={`font-medium ${isSelected ? 'text-[#154E8C]' : 'text-slate-900'}`}>
                        {lang.label}
                      </span>
                      {isSelected && (
                        <span className="text-xs text-[#5B9FD4] font-normal">active</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.className}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                      {config.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {lang.priorVersion ? `v${lang.priorVersion}` : '—'}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs leading-relaxed">
                    {lang.notes}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* CTA */}
      {(() => {
        const activeLang = languages.find(l => l.status === 'migration_required') ?? languages[0];
        const ctaLabel = instrument.name
          ? `${instrument.name}${instrument.version ? ` v${instrument.version}` : ''}${activeLang ? ` · ${activeLang.label}` : ''}`
          : null;
        return (
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {ctaLabel
            ? <>Proceeding with <span className="font-medium text-slate-600">{ctaLabel}</span></>
            : <span className="italic">No instrument loaded — fill in intake data to proceed.</span>}
        </p>
        <Link
          href="/guidelines"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1B5EA6] text-white text-sm font-semibold rounded-lg hover:bg-[#154E8C] transition-colors"
        >
          Proceed to Migration Guidelines
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
        );
      })()}
    </div>
  );
}

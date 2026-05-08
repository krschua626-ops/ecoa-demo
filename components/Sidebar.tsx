'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import intakeDataRaw from '@/data/intake.json';

type Language = { code: string; label: string; status: string };

const { instrument } = intakeDataRaw;
const languages = intakeDataRaw.languages as Language[];

// Derive active language: first with status migration_required, or first language overall
const activeLang =
  languages.find((l) => l.status === 'migration_required') ?? languages[0] ?? null;

function InstrumentContext() {
  const hasInstrument = !!instrument.name;
  return (
    <div className="px-6 py-3 bg-slate-800 border-b border-slate-700">
      <p className="text-xs text-slate-400 mb-0.5">Active instrument</p>
      {hasInstrument ? (
        <>
          <p className="text-sm font-medium text-[#7BB3E0]">
            {instrument.name}{instrument.version ? ` v${instrument.version}` : ''}
          </p>
          {activeLang && (
            <p className="text-xs text-slate-400 mt-0.5">{activeLang.label}</p>
          )}
        </>
      ) : (
        <p className="text-xs text-slate-500 italic">No instrument loaded</p>
      )}
    </div>
  );
}

const steps = [
  { number: 1, label: 'Study Intake', href: '/intake', description: 'Gap analysis & language status' },
  { number: 2, label: 'Migration Guidelines', href: '/guidelines', description: 'Instrument-specific rules' },
  { number: 3, label: 'AI Migration', href: '/translation', description: 'Verbatim string migration' },
  { number: 4, label: 'Intake Validation', href: '/validation', description: 'Structural & semantic checks' },
  { number: 5, label: 'Screenshot Review', href: '/review', description: 'Linguist flag classification' },
];

const stepOrder = steps.map(s => s.href);

export default function Sidebar() {
  const pathname = usePathname();
  const currentIndex = stepOrder.indexOf(pathname);

  return (
    <aside className="w-64 min-h-screen bg-slate-900 flex flex-col flex-shrink-0">
      {/* Logo / App name */}
      <div className="px-6 py-5 border-b border-slate-700">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">eCOA Platform</p>
        <h1 className="text-white font-semibold text-sm leading-tight">Localization Workflow</h1>
      </div>

      {/* Instrument context strip — populated from intake.json */}
      <InstrumentContext />

      {/* Navigation steps */}
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {steps.map((step, idx) => {
            const isActive = pathname === step.href;
            const isCompleted = currentIndex > idx;
            const isFuture = currentIndex < idx;

            return (
              <li key={step.href}>
                <Link
                  href={step.href}
                  className={`flex items-start gap-3 px-3 py-3 rounded-lg transition-colors group ${
                    isActive
                      ? 'bg-[#1B5EA6] text-white'
                      : isCompleted
                      ? 'text-slate-200 hover:bg-slate-700'
                      : isFuture
                      ? 'text-slate-500 hover:bg-slate-800'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {/* Step number / checkmark */}
                  <span
                    className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${
                      isActive
                        ? 'bg-white text-[#1B5EA6]'
                        : isCompleted
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-700 text-slate-400 group-hover:bg-slate-600'
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step.number
                    )}
                  </span>

                  {/* Label and description */}
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm font-medium leading-tight">{step.label}</span>
                    <span
                      className={`text-xs leading-tight mt-0.5 ${
                        isActive ? 'text-[#BDD7F5]' : isCompleted ? 'text-slate-400' : 'text-slate-600'
                      }`}
                    >
                      {step.description}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-700">
        <p className="text-xs text-slate-600">Prototype Demo</p>
      </div>
    </aside>
  );
}

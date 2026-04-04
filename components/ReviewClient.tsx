'use client';

import { useState } from 'react';
import Link from 'next/link';

type Flag = {
  id: string;
  key: string;
  status: 'pending' | 'resolved';
  translatedString: string;
  proposedEdit: string;
  proposedEditDisplay: string;
  linguistNote: string;
  englishReference: string;
};

type Classification = {
  issue_type: 'mechanical' | 'rendering' | 'linguistic';
  authority_assessment: 'within_linguist_scope' | 'requires_team_signoff' | 'conflicts_with_author_approved';
  reference_evidence: string;
  recommended_disposition: 'approve' | 'reject' | 'escalate';
};

type GuidelineRule = { id: string; title: string; rule: string; type: string; rationale: string };

const issueTypeConfig = {
  mechanical:  { label: 'Mechanical',  className: 'bg-sky-50 text-sky-700 border-sky-200' },
  rendering:   { label: 'Rendering',   className: 'bg-violet-50 text-violet-700 border-violet-200' },
  linguistic:  { label: 'Linguistic',  className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const authorityConfig = {
  within_linguist_scope:        { label: 'Within linguist scope',       className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  requires_team_signoff:        { label: 'Requires team sign-off',       className: 'bg-amber-50 text-amber-700 border-amber-200' },
  conflicts_with_author_approved: { label: 'Conflicts with author-approved', className: 'bg-red-50 text-red-700 border-red-200' },
};

const dispositionConfig = {
  approve:  { label: 'Approve',   className: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  reject:   { label: 'Reject',    className: 'bg-red-600 hover:bg-red-700 text-white' },
  escalate: { label: 'Escalate',  className: 'bg-amber-500 hover:bg-amber-600 text-white' },
};

function ReferencePanel({ flag }: { flag: Flag | null }) {
  const [tab, setTab] = useState<'english' | 'german'>('english');

  if (!flag) {
    return (
      <div className="flex-1 bg-white rounded-xl border border-slate-200 flex items-center justify-center text-slate-300 text-sm">
        Select a flag from the queue to begin review
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-slate-100 px-5 pt-4 gap-4">
        <button
          onClick={() => setTab('english')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'english' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          English · Approved
        </button>
        <button
          onClick={() => setTab('german')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'german' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Arabic (IL) · Flagged
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {tab === 'english' ? (
          <EnglishContent flagKey={flag.key} />
        ) : (
          <GermanContent flag={flag} />
        )}
      </div>
    </div>
  );
}

function EnglishContent({ flagKey }: { flagKey: string }) {

  const freqOptions = ['1     ALL OF THE TIME', '2     MOST OF THE TIME', '3     A GOOD BIT OF THE TIME', '4     SOME OF THE TIME', '5     A LITTLE OF THE TIME', '6     HARDLY ANY OF THE TIME', '7     NONE OF THE TIME'];

  const content: Record<string, { label: string; body: React.ReactNode }> = {
    'fae3da27-bfe1-41d2-86ee-f87a4ff10beb': {
      label: 'Item 1 of 32 — Bowel domain',
      body: (
        <div>
          <p className="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wide">Item 1 · Bowel movement frequency</p>
          <p className="text-sm text-slate-800 leading-relaxed mb-4">
            1. How frequent have your bowel movements been during the last two weeks? Please indicate how frequent your bowel movements have been during the last two weeks by selecting one of the options from
          </p>
          <div className="space-y-1.5">
            {freqOptions.map(opt => (
              <label key={opt} className="flex items-center gap-2.5 text-sm text-slate-700 font-mono">
                <span className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                {opt === '1     BOWEL MOVEMENTS AS OR MORE FREQUENT THAN THEY HAVE EVER BEEN' ? <span className="font-semibold text-slate-900 bg-indigo-50 px-1 rounded">{opt}</span> : opt}
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3 italic">Note: item 1 uses a custom frequency scale, not the standard 1–7</p>
        </div>
      ),
    },
    'c1b1d269-fb1e-40b2-9a5f-6a661d6bc44a': {
      label: 'Item 3 of 32 — Emotional domain',
      body: (
        <div>
          <p className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">Item 3 · Frustration / impatience / restlessness</p>
          <p className="text-sm font-medium text-slate-900 leading-relaxed mb-4">
            3. How often during the last 2 weeks have you felt{' '}
            <em className="not-italic font-semibold underline decoration-dotted">frustrated</em>,{' '}
            <em className="not-italic font-semibold underline decoration-dotted">impatient</em>, or{' '}
            <em className="not-italic font-semibold underline decoration-dotted">restless</em>? Please choose an option from
          </p>
          <div className="space-y-1.5">
            {freqOptions.map(opt => (
              <label key={opt} className="flex items-center gap-2.5 text-sm text-slate-700 font-mono">
                <span className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                {opt}
              </label>
            ))}
          </div>
        </div>
      ),
    },
    'e5bcb435-4272-453b-8082-4049441b687a': {
      label: 'Item 7 of 32 — Emotional domain',
      body: (
        <div>
          <p className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">Item 7 · Surgery worry</p>
          <p className="text-sm font-medium text-slate-900 leading-relaxed mb-4">
            7. How often during the last 2 weeks did you feel worried about the possibility of needing to have{' '}
            <em className="not-italic font-semibold underline decoration-dotted">surgery</em>{' '}
            because of your bowel problem? Please choose an option from
          </p>
          <div className="space-y-1.5">
            {freqOptions.map(opt => (
              <label key={opt} className="flex items-center gap-2.5 text-sm text-slate-700 font-mono">
                <span className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                {opt}
              </label>
            ))}
          </div>
        </div>
      ),
    },
    '2207c1fd-9feb-47a9-a43a-7c71ec585452': {
      label: 'Item 1 — Response option 1',
      body: (
        <div>
          <p className="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wide">Item 1 · Response scale · Option 1 of 7</p>
          <p className="text-sm text-slate-600 mb-4">The full 7-point scale for Item 1 (bowel movement frequency):</p>
          <div className="space-y-1.5">
            {[
              '1     BOWEL MOVEMENTS AS OR MORE FREQUENT THAN THEY HAVE EVER BEEN',
              '2     EXTREMELY FREQUENT',
              '3     VERY FREQUENT',
              '4     MODERATE INCREASE IN FREQUENCY OF BOWEL MOVEMENTS',
              '5     SOME INCREASE IN FREQUENCY OF BOWEL MOVEMENTS',
              '6     SLIGHT INCREASE IN FREQUENCY OF BOWEL MOVEMENTS',
              '7     NORMAL, NO INCREASE IN FREQUENCY OF BOWEL MOVEMENTS',
            ].map(opt => (
              <label key={opt} className={`flex items-center gap-2.5 text-xs font-mono ${opt.startsWith('1') ? 'font-semibold text-slate-900 bg-indigo-50 px-2 py-1 rounded' : 'text-slate-700'}`}>
                <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${opt.startsWith('1') ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`}>
                  {opt.startsWith('1') && <span className="block w-2 h-2 bg-white rounded-full m-auto mt-0.5" />}
                </span>
                {opt}
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3 italic">Highlighted: option 1 — the string under review for RTL rendering</p>
        </div>
      ),
    },
  };

  const card = content[flagKey];
  if (!card) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 h-full">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">English · Approved</p>
          <p className="text-sm font-semibold text-slate-700 mt-0.5">{card.label}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Author approved
        </span>
      </div>
      {card.body}
    </div>
  );
}

function GermanContent({ flag }: { flag: Flag }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 h-full">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Arabic (IL) · Under review</p>
          <code className="text-xs font-mono text-slate-500 mt-0.5 block">{flag.key}</code>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          Flagged
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Current string</p>
          <p className="text-sm text-slate-800 leading-relaxed bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">{flag.translatedString}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1.5">Proposed edit</p>
          <p className="text-sm font-medium text-slate-900 leading-relaxed bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">{flag.proposedEdit}</p>
        </div>
        <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Linguist note</p>
          <p className="text-xs text-slate-600 leading-relaxed">{flag.linguistNote}</p>
        </div>
      </div>
    </div>
  );
}

export default function ReviewClient({
  flags: initialFlags,
  guidelines,
}: {
  flags: Flag[];
  guidelines: GuidelineRule[];
}) {
  const [flags] = useState(initialFlags);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [classifications, setClassifications] = useState<Record<string, Classification>>({});
  const [dispositions, setDispositions] = useState<Record<string, 'approve' | 'reject' | 'escalate'>>({});

  const resetDemo = () => {
    setDispositions({});
    setClassifications({});
    setSelectedId(null);
  };

  const selectedFlag = flags.find(f => f.id === selectedId) ?? null;
  const pendingFlags  = flags.filter(f => !dispositions[f.id]);
  const resolvedFlags = flags.filter(f =>  dispositions[f.id]);

  const handleSelectFlag = async (flag: Flag) => {
    setSelectedId(flag.id);

    // Already classified — no need to re-call
    if (classifications[flag.id]) return;

    setClassifying(true);
    try {
      // Pass all available guidelines as context — no instrument-specific filter
      const res = await fetch('/api/classify-flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flagId: flag.id,
          flaggedKey: flag.key,
          translatedString: flag.translatedString,
          proposedEdit: flag.proposedEdit,
          englishReference: flag.englishReference,
          linguistNote: flag.linguistNote,
          instrumentContext: null,
          priorDecisions: guidelines,
        }),
      });

      const data = await res.json();
      if (data.classification) {
        setClassifications(prev => ({ ...prev, [flag.id]: data.classification }));
      }
    } finally {
      setClassifying(false);
    }
  };

  const handleDisposition = (flagId: string, disposition: 'approve' | 'reject' | 'escalate') => {
    setDispositions(prev => ({ ...prev, [flagId]: disposition }));
    // Move to next pending flag automatically
    const nextPending = flags.find(f => !dispositions[f.id] && f.id !== flagId);
    setSelectedId(nextPending?.id ?? null);
  };

  const isClassifying  = classifying && selectedId !== null && !classifications[selectedId ?? ''];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 flex-shrink-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Step 5 — Review Classification Agent</p>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Screenshot Review</h2>
            <p className="text-slate-500 mt-1 text-sm">AI-powered flag classification and disposition for linguist-submitted flags.</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500"><span className="font-semibold text-slate-900">{pendingFlags.length}</span> pending</span>
            <span className="text-sm text-slate-500"><span className="font-semibold text-emerald-600">{resolvedFlags.length}</span> resolved</span>
            {resolvedFlags.length > 0 && (
              <button
                onClick={resetDemo}
                className="text-xs text-slate-400 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
              >
                Reset demo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 gap-4 px-8 pb-8 min-h-0 overflow-hidden">

        {/* Left: tabbed reference panel */}
        <div className="flex-1 min-w-0 flex flex-col">
          <ReferencePanel flag={selectedFlag} /></div>

        {/* Right rail: flag queue */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">

          {/* Pending flags */}
          {pendingFlags.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2 px-1">Pending · {pendingFlags.length}</p>
              <div className="space-y-2">
                {pendingFlags.map(flag => {
                  const isSelected = selectedId === flag.id;
                  const cls = classifications[flag.id];
                  return (
                    <div
                      key={flag.id}
                      className={`rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-indigo-400 shadow-sm bg-white'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                      onClick={() => handleSelectFlag(flag)}
                    >
                      {/* Flag header */}
                      <div className="px-4 py-3">
                        <code className="text-xs font-mono text-slate-500 block mb-1">{flag.key}</code>
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{flag.linguistNote}</p>
                        <p className="text-xs text-indigo-600 font-medium mt-1.5">{flag.proposedEditDisplay}</p>
                      </div>

                      {/* Classification panel — shown when selected */}
                      {isSelected && (
                        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/80 rounded-b-xl">
                          {isClassifying ? (
                            <div className="flex items-center gap-2 text-slate-500 text-xs py-2">
                              <svg className="w-3.5 h-3.5 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Classification agent running…
                            </div>
                          ) : cls ? (
                            <div className="space-y-3">
                              {/* Classification tags */}
                              <div className="flex flex-wrap gap-1.5">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${issueTypeConfig[cls.issue_type].className}`}>
                                  {issueTypeConfig[cls.issue_type].label}
                                </span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${authorityConfig[cls.authority_assessment].className}`}>
                                  {authorityConfig[cls.authority_assessment].label}
                                </span>
                              </div>

                              {/* Evidence */}
                              <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Evidence</p>
                                <p className="text-xs text-slate-600 leading-relaxed">{cls.reference_evidence}</p>
                              </div>

                              {/* Recommended disposition */}
                              <div className="flex items-center gap-1.5 pt-1">
                                <p className="text-xs text-slate-400 mr-1">Recommended:</p>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                                  cls.recommended_disposition === 'approve' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                  cls.recommended_disposition === 'reject'  ? 'bg-red-50 text-red-700 border-red-200' :
                                  'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {cls.recommended_disposition.charAt(0).toUpperCase() + cls.recommended_disposition.slice(1)}
                                </span>
                              </div>

                              {/* Disposition buttons */}
                              <div className="flex gap-2 pt-1">
                                {(['approve', 'reject', 'escalate'] as const).map(d => (
                                  <button
                                    key={d}
                                    onClick={(e) => { e.stopPropagation(); handleDisposition(flag.id, d); }}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${dispositionConfig[d].className}`}
                                  >
                                    {dispositionConfig[d].label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 py-1">Click to classify this flag</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Resolved flags */}
          {resolvedFlags.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2 mt-2 px-1">Resolved · {resolvedFlags.length}</p>
              <div className="space-y-2">
                {resolvedFlags.map(flag => {
                  const d = dispositions[flag.id];
                  return (
                    <div key={flag.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 opacity-70">
                      <div className="flex items-start justify-between gap-2">
                        <code className="text-xs font-mono text-slate-400">{flag.key}</code>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                          d === 'approve'  ? 'bg-emerald-50 text-emerald-700' :
                          d === 'reject'   ? 'bg-red-50 text-red-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {d.charAt(0).toUpperCase() + d.slice(1)}d
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* All resolved */}
          {pendingFlags.length === 0 && resolvedFlags.length > 0 && (
            <div className="mt-2">
              <Link
                href="/intake"
                className="block w-full text-center px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Review complete — Back to start
              </Link>
            </div>
          )}

          {/* Back nav */}
          <div className="mt-auto pt-2">
            <Link href="/validation" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Validation
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

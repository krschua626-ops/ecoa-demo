import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  const {
    flagId,
    flaggedKey,
    translatedString,
    proposedEdit,
    englishReference,
    linguistNote,
    instrumentContext,  // { instrument, version, language, guidelines[] }
    priorDecisions,     // relevant guidelines rules
  } = await request.json();

  const guidelinesText = Array.isArray(priorDecisions)
    ? priorDecisions.map((r: { id: string; title: string; rule: string }) =>
        `[${r.id}] ${r.title}: ${r.rule}`
      ).join('\n')
    : '';

  const prompt = `You are an expert eCOA (electronic Clinical Outcome Assessment) instrument services specialist reviewing a linguist's flag during screenshot review of a translated eCOA instrument.

## Instrument Context
- Instrument: ${instrumentContext?.instrument ?? 'PHQ-9'} v${instrumentContext?.version ?? '1.2'}
- Language: ${instrumentContext?.language ?? 'German (Germany)'}
- String key: ${flaggedKey}

## Approved English Reference
${englishReference}

## Current Translated String
${translatedString}

## Linguist's Proposed Edit
${proposedEdit}

## Linguist's Note
${linguistNote ?? 'No additional note provided.'}

## Relevant Migration Guidelines
${guidelinesText || 'No specific guidelines provided for this string.'}

## Your Task
Classify this linguist flag and assess the authority scope of the proposed change.

Return a JSON object with exactly these four fields:

- "issue_type": one of "mechanical", "rendering", or "linguistic"
  - mechanical: typo, punctuation error, spacing issue, or obvious transcription error — does not affect meaning
  - rendering: character length, line-break placement, formatting, or layout concern — does not affect semantic content
  - linguistic: translation choice, word selection, register, or semantic interpretation — affects meaning or equivalence

- "authority_assessment": one of "within_linguist_scope", "requires_team_signoff", or "conflicts_with_author_approved"
  - within_linguist_scope: the change is a clear correction or minor formatting fix that the linguist can approve without escalation
  - requires_team_signoff: the change involves a translation judgment call that needs instrument services review before approval
  - conflicts_with_author_approved: the proposed change conflicts with validated instrument content, author-approved wording, or migration guidelines — must not be approved without author or sponsor sign-off

- "reference_evidence": a concise summary (2-4 sentences) of the relevant evidence informing your assessment — cite specific guidelines, validated wording, or prior decisions where applicable

- "recommended_disposition": one of "approve", "reject", or "escalate"
  - approve: the change is correct and within scope — safe to accept
  - reject: the change conflicts with validated content or guidelines — should not be accepted
  - escalate: the change requires team or author review before a decision can be made

Return ONLY the JSON object. Start with { and end with }.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: 'You are an expert eCOA instrument services specialist. You produce precise, structured JSON output and never include explanatory text outside the JSON object.',
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    return NextResponse.json({ error: 'Model did not return valid JSON', raw: rawText }, { status: 500 });
  }

  const classification = JSON.parse(jsonMatch[0]);

  return NextResponse.json({
    flagId,
    classification,
    model: message.model,
    usage: message.usage,
  });
}

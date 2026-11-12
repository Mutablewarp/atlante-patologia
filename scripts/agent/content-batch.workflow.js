export const meta = {
  name: 'content-batch',
  description: 'One sub-batch of cards on Sonnet agents: author, translate, verify, fix, questions, images',
  phases: [{ title: 'Cards', detail: 'one agent per card and stage; a blocked card stops, the others go on' }],
}

// Workflow script for one sub-batch (docs/agents/CONTRACTS.md §5), plain JavaScript. args: { packets, cards: [{ id, from }] }, from next.mjs.
const STAGES = ['author', 'translator', 'verifier', 'fixer', 'questions', 'scout']

// The report of CONTRACTS.md section 3. The verifier's verdicts stay in its report file, not in what it returns.
const REPORT = {
  type: 'object',
  properties: { id: { type: 'string' }, stage: { type: 'string' }, status: { type: 'string', enum: ['done', 'blocked'] }, note: { type: 'string', maxLength: 200 }, files: { type: 'array', items: { type: 'string' } } },
  required: ['id', 'stage', 'status'],
}

const run = (stage) => async (prev, card) => {
  if (prev === null || prev?.status === 'blocked') return prev // a lost or blocked card stops; the others go on
  if (STAGES.indexOf(stage) < STAGES.indexOf(card.from)) return { id: card.id, stage, status: 'done', note: 'done before' }
  const report = await agent(
    `Card ${card.id}, stage ${stage}. Read docs/agents/BRIEF.md and docs/agents/roles/${stage}.md, then the packet in ${args.packets}/${card.id}/. Return the JSON report only.`,
    { label: `${stage}:${card.id}`, phase: 'Cards', model: 'sonnet', schema: REPORT },
  )
  if (!report || report.status === 'blocked') log(`${stage}:${card.id} ${report ? `blocked: ${report.note ?? ''}` : 'lost'}`)
  return report
}

return pipeline(args.cards, ...STAGES.map(run))

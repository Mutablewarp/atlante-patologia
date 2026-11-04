/**
 * Quick check, metacognitive layer (template in ExamQuestions.astro): before
 * opening an answer the learner may say how sure they are; once it is open the
 * choice locks, and "I knew it / I did not" saves one quiz attempt (mode
 * `quick`) with that confidence for the calibration view in Me.
 * Without JavaScript or storage the plain <details> quick check still works.
 */
import { put } from '../lib/db.ts';
import { isConfidence } from '../lib/metacog.ts';

const tpl = document.querySelector<HTMLTemplateElement>('template[data-qc-confidence]');
if (tpl) document.querySelectorAll<HTMLLIElement>('.quick-check > li').forEach((li, i) => enhance(tpl, li, i));

function enhance(tpl: HTMLTemplateElement, li: HTMLLIElement, i: number) {
  const d = tpl.dataset;
  const qid = (JSON.parse(d.ids ?? '[]') as string[])[i];
  const details = li.querySelector('details');
  if (!qid || !details) return;
  const frag = tpl.content.cloneNode(true) as DocumentFragment;
  const box = frag.querySelector<HTMLFieldSetElement>('.qc-confidence')!;
  const grade = frag.querySelector<HTMLElement>('.qc-grade')!;
  const live = grade.querySelector<HTMLElement>('.qc-live')!;
  box.querySelectorAll('input').forEach((x) => (x.name = `qc-conf-${qid}`));
  details.before(box);
  details.append(grade);
  details.addEventListener('toggle', () => {
    if (!details.open) return;
    box.disabled = true; // confidence counts only when given before seeing the answer
    grade.hidden = false;
  });
  grade.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-grade]');
    if (!b || grade.querySelector('[aria-pressed="true"]')) return; // one record per answer
    // Marked before the write, so a second activation while it is pending is ignored; undone if the write fails.
    b.setAttribute('aria-pressed', 'true');
    const confidence = Number(box.querySelector<HTMLInputElement>('input:checked')?.value);
    const at = Date.now();
    const question = `qc:${d.entity}:${qid}`;
    try {
      await put('quizAttempts', {
        id: `${question}@${at}`,
        question,
        entities: [d.entity!],
        module: d.module!,
        correct: b.dataset.grade === '1',
        mode: 'quick',
        at,
        updated: at,
        ...(isConfidence(confidence) ? { confidence } : {}),
      });
    } catch {
      b.setAttribute('aria-pressed', 'false');
      return; // no storage: nothing to record
    }
    live.textContent = live.dataset.saved ?? '';
  });
}

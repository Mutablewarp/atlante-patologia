/** "How sure are you?" before the answer is shown (quiz, review). Optional: skipping it saves the attempt without a confidence. */
import type { Lang } from '../i18n/index.ts';
import { tS } from '../i18n/study.ts';
import { CONFIDENCE, type Confidence } from '../lib/metacog.ts';

export function ConfidencePicker(props: { lang: Lang; name: string; value?: Confidence; disabled?: boolean; onChange: (c: Confidence) => void }) {
  const t = (k: Parameters<typeof tS>[1]) => tS(props.lang, k);
  return (
    <fieldset class="confidence">
      <legend>
        {t('confidenceLegend')} <span class="small muted">{t('confidenceHelp')}</span>
      </legend>
      <div class="confidence-options">
        {CONFIDENCE.map((c) => (
          <label class="radio">
            <input
              type="radio"
              name={props.name}
              value={c}
              checked={props.value === c}
              disabled={props.disabled}
              onChange={() => props.onChange(c)}
            />
            <span>{t(`conf${c}`)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

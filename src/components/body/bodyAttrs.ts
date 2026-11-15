import type { Lang } from '../../i18n/index.ts';
import { tBody } from '../../i18n/body.ts';

/** The attributes of `<ap-body>`: the manifest URL and the messages the element script reads (docs/BODY_SPEC.md §5). */
export function bodyAttrs(lang: Lang, manifestUrl: string): Record<string, string> {
  const t = (k: Parameters<typeof tBody>[1]) => tBody(lang, k);
  return {
    'data-manifest': manifestUrl,
    'data-t-loading': t('loading'),
    'data-t-ready': t('ready'),
    'data-t-off': t('turnedOff'),
    'data-t-error': t('error'),
    'data-t-lost': t('lost'),
    'data-t-no-model': t('noModel'),
    'data-t-whole': t('whole'),
    'data-t-organ': t('organ'),
    'data-t-system': t('system'),
  };
}

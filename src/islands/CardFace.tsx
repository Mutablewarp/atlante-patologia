/** One side of a flashcard. Card HTML is generated and escaped at build (same-origin static JSON). */
import type { Lang } from '../i18n/index.ts';
import { tS } from '../i18n/study.ts';
import type { StudyCard } from './client.ts';
import type { Shape } from '../lib/cards.ts';

function ShapeEl({ s, ratio, cls }: { s: Shape; ratio: number; cls: string }) {
  const c = s.coords;
  if (s.type === 'circle') return <ellipse class={cls} cx={c[0]} cy={c[1]} rx={c[2]} ry={(c[2] ?? 0) * ratio} />;
  if (s.type === 'rect') return <rect class={cls} x={c[0]} y={c[1]} width={c[2]} height={c[3]} />;
  const pts: string[] = [];
  for (let i = 0; i + 1 < c.length; i += 2) pts.push(`${c[i]},${c[i + 1]}`);
  return <polygon class={cls} points={pts.join(' ')} />;
}

/** A study image: the AVIF where the browser has it, else the small WebP (src/lib/picture.ts). */
export function Pic({ img }: { img: { src: string; avifSet?: string; width: number; height: number; alt: string } }) {
  return (
    <picture>
      {img.avifSet && <source type="image/avif" srcSet={img.avifSet} />}
      <img src={img.src} width={img.width} height={img.height} alt={img.alt} loading="lazy" decoding="async" />
    </picture>
  );
}

export function Figure({ img, target }: { img: NonNullable<StudyCard['image']>; target?: number }) {
  const ratio = img.width / img.height;
  return (
    <figure class="occlusion">
      <div class="occ-wrap">
        <Pic img={img} />
        {target !== undefined && (
          <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
            {img.shapes.map((s, i) => (
              <ShapeEl s={s} ratio={ratio} cls={i === target ? 'occ-target' : 'occ-other'} />
            ))}
          </svg>
        )}
      </div>
    </figure>
  );
}

export function CardFace({ lang, card, side }: { lang: Lang; card: StudyCard; side: 'front' | 'back' }) {
  if (card.kind === 'occlusion' && card.image) {
    return side === 'front' ? (
      <div class="card-face">
        <p class="card-text">{tS(lang, 'occlusionPrompt')}</p>
        <Figure img={card.image} target={card.image.target} />
      </div>
    ) : (
      <div class="card-face card-text" dangerouslySetInnerHTML={{ __html: card.back }} />
    );
  }
  return <div class="card-face card-text" dangerouslySetInnerHTML={{ __html: side === 'front' ? card.front : card.back }} />;
}

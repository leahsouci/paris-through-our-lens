import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import type { PendingPhoto, Photo } from '../types';
import { pad2, photoUrl, shortArr } from '../photos';

export function IndexGrid({ open, photos, pending, onPick }: { open: boolean; photos: Photo[]; pending: PendingPhoto[]; onPick: (id: string) => void }) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (open) {
        gsap.set(root.current, { autoAlpha: 1 });
        gsap.fromTo('.card', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.05, ease: 'expo.out' });
      } else {
        gsap.to(root.current, { autoAlpha: 0, duration: 0.4 });
      }
    }, root);
    return () => ctx.revert();
  }, [open]);

  return (
    <div ref={root} className="index" aria-hidden={!open}>
      <div className="index-grid">
        {photos.map((p) => (
          <button key={p.id} className="card" onClick={() => onPick(p.id)} tabIndex={open ? 0 : -1}>
            <span className="card-head">
              <span className="card-title">{p.title}</span>
              <span className="card-num">{pad2(p.number)}</span>
            </span>
            <span className="card-sub">
              {shortArr(p.arrondissement)} · {p.author} · {p.readMinutes} min de lecture
            </span>
            <span className="card-tile">
              <img
                src={photoUrl(p.mid)}
                alt={p.title}
                width={p.width}
                height={p.height}
                loading="lazy"
                decoding="async"
                style={{ background: p.color }}
              />
            </span>
          </button>
        ))}
        {pending.map((p) => (
          <div key={p.id} className="card is-pending" title={p.clue ?? undefined}>
            <span className="card-head">
              <span className="card-title">{p.title}</span>
              <span className="card-num">{pad2(p.number)}</span>
            </span>
            <span className="card-sub">
              <span className="tag">À localiser</span> {p.clue ?? 'Lieu inconnu'}
            </span>
            <span className="card-tile">
              <img src={photoUrl(p.mid)} alt={p.title} width={p.width} height={p.height} loading="lazy" decoding="async" style={{ background: p.color }} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

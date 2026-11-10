import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import type { Photo } from '../types';
import { arrondissementLabel, formatCoords, formatWalk, historyOf, historyUrl, legBetween, pad2, photoUrl } from '../photos';

type Props = {
  photo: Photo | null;
  next: Photo | null;
  prev: Photo | null;
  position: number;
  total: number;
  touring: boolean;
  tourKey: number;
  dwell: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onZoomImage: () => void;
};

const PRECISION = [
  { key: 'exact', label: 'Exact', match: ['gps', 'exact'] },
  { key: 'approx', label: 'Approx.', match: ['approx'] },
  { key: 'pending', label: 'À localiser', match: [] as string[] },
];

// Full-page "fiche" for one photo, laid out like an askgib.com article on graph paper.
export function ArticlePanel({ photo, next, prev, position, total, touring, tourKey, dwell, onClose, onPrev, onNext, onZoomImage }: Props) {
  const root = useRef<HTMLElement>(null);
  const salle = useRef<gsap.core.Timeline | null>(null);
  const touringRef = useRef(touring);
  touringRef.current = touring;
  const open = photo != null;
  const h = photo ? historyOf(photo.id) : null;
  const scrollToHero = () => {
    const scroller = root.current?.querySelector<HTMLElement>('.sheet-scroll');
    const hero = root.current?.querySelector<HTMLElement>('.sheet-hero');
    if (scroller && hero) gsap.to(scroller, { scrollTop: hero.offsetTop, duration: 1.6, ease: 'power2.inOut' });
  };

  useLayoutEffect(() => {
    gsap.to(root.current, open
      ? { yPercent: 0, autoAlpha: 1, duration: 1.3, ease: 'expo.out', delay: 0.9 }
      : { yPercent: 100, autoAlpha: 0, duration: 0.7, ease: 'power3.in' });
  }, [open]);

  useLayoutEffect(() => {
    if (!photo) return;
    const ctx = gsap.context(() => {
      root.current!.querySelector('.sheet-scroll')!.scrollTop = 0;
      gsap.fromTo('.sheet-plate img', { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.12 },
        { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 1.6, ease: 'expo.inOut', delay: 1 });
      gsap.fromTo('.sheet-hero-text > *', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, stagger: 0.08, ease: 'power3.out', delay: 1.1 });
      if (!root.current!.querySelector('.salle')) return;
      // Museum "room": archive image, dated timeline, then a wipe back to today.
      const steps = root.current!.querySelectorAll('.salle-timeline li').length;
      const tl = gsap.timeline({ delay: 1 });
      tl.fromTo('.salle-then', { scale: 1.18, clipPath: 'inset(0% 0% 0% 0%)' }, { scale: 1.02, duration: 4 + steps, ease: 'none' }, 0)
        .from('.salle-kicker span', { y: 20, opacity: 0, stagger: 0.15, duration: 0.9, ease: 'power3.out' }, 0.2)
        .from('.salle-year', { yPercent: 60, opacity: 0, duration: 1.2, ease: 'expo.out' }, 0.4)
        .from('.salle-lede', { y: 24, opacity: 0, duration: 1, ease: 'power3.out' }, 0.9)
        .from('.salle-cap', { opacity: 0, duration: 1 }, 1.3)
        .fromTo('.tl-bar', { scaleX: 0 }, { scaleX: 1, duration: steps * 0.9, ease: 'none' }, 1.6)
        .from('.salle-timeline li', { x: -30, opacity: 0, stagger: 0.9, duration: 0.8, ease: 'power3.out' }, 1.6)
        .to('.salle-then', { clipPath: 'inset(0% 0% 0% 100%)', duration: 1.8, ease: 'expo.inOut' }, 2.2 + steps * 0.9)
        .from('.salle-now-tag', { opacity: 0, y: 20, duration: 0.8, ease: 'power3.out' }, '<0.9')
        .call(() => { if (touringRef.current) scrollToHero(); }, [], '+=1.4');
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) tl.progress(1);
      salle.current = tl;
    }, root);
    return () => ctx.revert();
  }, [photo]);

  const arr = photo ? arrondissementLabel(photo.arrondissement, true) : '';
  return (
    <article ref={root} className="sheet" aria-hidden={!open} style={{ visibility: 'hidden', opacity: 0 }}>
      {photo && (
        <>
          <div className="sheet-bar">
            <span className="sheet-mark">PARIS</span>
            <button className="link" onClick={onClose}>← Retour au plan</button>
            <span className="sheet-count">Étape {pad2(photo.number)} / {pad2(total)}</span>
            <span className="sheet-arrows">
              <button className="link" onClick={onPrev} disabled={position <= 0}>← Précédente</button>
              <button className="link" onClick={onNext} disabled={position >= total - 1}>Marcher →</button>
            </span>
            {touring && (
              <div className="tour-progress">
                <span key={tourKey} style={{ animationDuration: `${dwell}ms` }} />
              </div>
            )}
          </div>

          <div className="sheet-scroll">
            {h && (
              <section className="salle" aria-label={`Retour en arrière, ${h.year}`}>
                <img className="salle-now" src={photoUrl(photo.mid)} alt="" />
                <img
                  className="salle-then"
                  src={historyUrl(h.image)}
                  srcSet={`${historyUrl(h.mid)} 800w, ${historyUrl(h.image)} 1600w`}
                  sizes="100vw"
                  alt={h.caption}
                />
                <div className="salle-shade" />
                <span className="salle-now-tag">Aujourd'hui · {photo.title}</span>
                <div className="salle-text">
                  <p className="salle-kicker"><span>Salle {pad2(photo.number)}</span><span>Retour en arrière</span></p>
                  <h2 className={`salle-year ${h.year.length > 5 ? 'is-long' : ''}`}>{h.year}</h2>
                  <p className="salle-lede">{h.lede}</p>
                  <p className="salle-cap">
                    {h.caption}. {h.credit} · {h.license} · <a href={h.source} target="_blank" rel="noreferrer">Wikimedia Commons ↗</a>
                  </p>
                </div>
                <ol className="salle-timeline">
                  <i className="tl-bar" />
                  {h.timeline.map(([year, text]) => (
                    <li key={year + text}><b>{year}</b><span>{text}</span></li>
                  ))}
                </ol>
                <div className="salle-controls">
                  <button onClick={() => salle.current?.restart(true)}>↺ Revoir</button>
                  <button onClick={scrollToHero}>Voir la photo ↓</button>
                </div>
              </section>
            )}
            <section className="sheet-hero">
              <div className="sheet-hero-text">
                <p className="sheet-legend">
                  <span>Étape {pad2(photo.number)}</span>
                  {PRECISION.map((p) => (
                    <span key={p.key} className={`lg lg-${p.key} ${p.match.includes(photo.precision ?? '') ? 'is-on' : ''}`}>{p.label}</span>
                  ))}
                </p>
                <h1 className="sheet-title">{photo.title}</h1>
                <p className="sheet-dek">
                  {[photo.place, photo.quartier && `quartier ${photo.quartier}`, arr].filter(Boolean).join(', ')}.
                </p>
                {prev && legBetween(prev.id, photo.id) && (
                  <p className="sheet-walk">↳ {formatWalk(legBetween(prev.id, photo.id)!)} depuis « {prev.title} »</p>
                )}
                <div className="sheet-stamp">
                  <div><span>Quartier</span><b>{photo.quartier ?? '—'}</b></div>
                  <div><span>Lecture</span><b>{photo.readMinutes} min</b></div>
                </div>
              </div>
              <figure className="sheet-plate" onClick={onZoomImage}>
                <i className="cross tl" /><i className="cross tr" /><i className="cross bl" /><i className="cross br" />
                <img
                  src={photoUrl(photo.file)}
                  srcSet={`${photoUrl(photo.mid)} 800w, ${photoUrl(photo.file)} 1600w`}
                  sizes="(max-width: 760px) 100vw, 46vw"
                  alt={photo.title}
                  width={photo.width}
                  height={photo.height}
                  style={{ background: photo.color }}
                />
                <figcaption>{formatCoords(photo.lat, photo.lng)} · agrandir ↗</figcaption>
              </figure>
            </section>

            <dl className="sheet-meta">
              <div><dt>N°</dt><dd>{pad2(photo.number)}</dd></div>
              <div><dt>Photo par</dt><dd>{photo.author}</dd></div>
              <div><dt>Arrondissement</dt><dd>{arr || '—'}</dd></div>
              <div><dt>Quartier</dt><dd>{photo.quartier ?? '—'}</dd></div>
              <div><dt>Coordonnées</dt><dd>
                <a href={`https://www.google.com/maps?q=${photo.lat},${photo.lng}`} target="_blank" rel="noreferrer">
                  {formatCoords(photo.lat, photo.lng, 4)} ↗
                </a>
              </dd></div>
              <div><dt>Précision</dt><dd>{photo.precision === 'approx' ? 'Approximative' : photo.precision === 'gps' ? 'GPS' : 'Exacte'}</dd></div>
            </dl>

            <div className="sheet-body">
              <div className="prose" dangerouslySetInnerHTML={{ __html: photo.html }} />
              {photo.clue && (
                <aside className="sheet-note">
                  <i className="note-rule" />
                  <span>Indice de localisation</span>
                  <p>{photo.clue}</p>
                </aside>
              )}
            </div>

            {next && (
              <button className="sheet-next" onClick={onNext}>
                <span>Prochaine étape · {pad2(next.number)}{legBetween(photo.id, next.id) ? ` · ${formatWalk(legBetween(photo.id, next.id)!)}` : ''}</span>
                <b>{next.title} →</b>
              </button>
            )}
          </div>
        </>
      )}
    </article>
  );
}

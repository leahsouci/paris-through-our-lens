import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import chapters from './data/chapters.json';
import type { InkMap } from './map/InkMap';
import { photos, pending, photoUrl, formatCoords, formatWalk, legBetween, walkKm, arrondissementLabel } from './photos';
import type { PendingPhoto } from './types';
import { footstep, setMood, setSound } from './ambience';

gsap.registerPlugin(ScrollTrigger);

type Art = { caption: string; mid?: string; image?: string; color?: string; credit?: string; license?: string; source?: string };
type Chapter = { era: string; tone: 'past' | 'modern' | 'future'; place?: string; when: string; scene: string[]; text: string[]; note: string; art: Art };
type LngLat = [number, number];
type Leg = NonNullable<ReturnType<typeof legBetween>>;
type AnyPhoto = PendingPhoto & { lat?: number | null; lng?: number | null };

const CH = chapters.chapters as Record<string, Chapter>;
const byId = new Map<string, AnyPhoto>([...photos, ...pending].map((p) => [p.id, p]));
const artUrl = (f?: string) => (f ? `${import.meta.env.BASE_URL}art/${f}` : '');
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII'];
const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type Item =
  | { kind: 'chapter'; n: number; photo: AnyPhoto; ch: Chapter }
  | { kind: 'walk'; from: AnyPhoto; to: AnyPhoto; leg: Leg; text: string }
  | { kind: 'coda' };

const items: Item[] = [];
let last: AnyPhoto | null = null;
chapters.order.forEach((id, i) => {
  const photo = byId.get(id)!;
  const ch = CH[id];
  if (ch.place?.startsWith('Hors les murs') && !items.some((it) => it.kind === 'coda')) items.push({ kind: 'coda' });
  if (photo.lat != null) {
    const leg = last ? legBetween(last.id, id) : null;
    if (leg && last) items.push({ kind: 'walk', from: last, to: photo, leg, text: (chapters.legs as Record<string, string>)[`${last.id}>${id}`] ?? '' });
    last = photo;
  }
  items.push({ kind: 'chapter', n: i + 1, photo, ch });
});
const walks = items.filter((it): it is Extract<Item, { kind: 'walk' }> => it.kind === 'walk');
const fullRoute: LngLat[] = walks.flatMap((w) => w.leg.coordinates as LngLat[]);
const stops = photos.filter((p) => p.lat != null).map((p, i) => ({ lng: p.lng!, lat: p.lat!, n: (p as { step?: number }).step ?? i + 1 }));
const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m / 10) * 10} m`);

function placeOf(p: AnyPhoto, ch: Chapter) {
  if (ch.place) return ch.place;
  return [p.place, arrondissementLabel(p.arrondissement)].filter(Boolean).join(', ');
}

export default function App() {
  const mapEl = useRef<HTMLDivElement>(null);
  const ink = useRef<InkMap | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [sound, setSoundOn] = useState(false);
  const toggleSound = () => setSoundOn((on) => { setSound(!on); return !on; });

  useEffect(() => {
    let alive = true;
    import('./map/InkMap')
      .then(({ InkMap }) => InkMap.create(mapEl.current!, fullRoute, stops))
      .then((m) => {
        if (!alive) return;
        ink.current = m;
        m.overview();
        root.current?.classList.add('map-ready');
        ScrollTrigger.refresh();
      })
      .catch((e) => console.error(e));
    return () => { alive = false; };
  }, []);

  useLayoutEffect(() => {
    const lenis = reduced ? null : new Lenis({ lerp: 0.075 });
    const raf = (t: number) => lenis?.raf(t * 1000);
    if (lenis) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
    }
    const ctx = gsap.context(() => {
      gsap.to('.progress i', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } });
      ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom center', onEnterBack: () => ink.current?.overview() });
      let lastStep = -1;
      gsap.utils.toArray<HTMLElement>('.walk').forEach((el, i) => {
        ScrollTrigger.create({
          trigger: el, start: 'top bottom', end: 'bottom top',
          onToggle: (st) => st.isActive && setMood('street'),
          onUpdate: (st) => {
            const w = walks[i];
            const p = Math.max(0, Math.min(1, (st.progress - 0.18) / 0.64));
            ink.current?.scrub(w.leg.coordinates as LngLat[], p, { img: photoUrl(w.to.thumb), at: [w.to.lng!, w.to.lat!] });
            const pace = Math.floor(p * w.leg.distance / 45);
            if (pace !== lastStep) { lastStep = pace; if (p > 0 && p < 1) footstep(); }
            const street = [...(w.leg.streets ?? [])].reverse().find(([at]) => at <= p)?.[1];
            const s = el.querySelector('.walk-street');
            if (s && street && s.textContent !== street) s.textContent = street;
            const left = el.querySelector('.walk-left');
            if (left) left.textContent = p >= 0.98 ? 'Vous y êtes.' : `encore ${km((1 - p) * w.leg.distance)}`;
          },
        });
      });
      gsap.utils.toArray<HTMLElement>('.coda, .outro').forEach((el) =>
        ScrollTrigger.create({ trigger: el, start: 'top bottom', onEnter: () => ink.current?.overview(), onEnterBack: () => ink.current?.overview() }));
      if (reduced) return;
      gsap.from('.hero-line', { yPercent: 110, opacity: 0, duration: 1.8, stagger: 0.12, ease: 'expo.out', delay: 0.2 });
      gsap.utils.toArray<HTMLElement>('.ch').forEach((ch) => {
        gsap.fromTo(ch.querySelector('.ch-bg img'), { scale: 1.22, yPercent: -4 }, { scale: 1.02, yPercent: 4, ease: 'none', scrollTrigger: { trigger: ch, start: 'top bottom', end: 'bottom top', scrub: true } });
        ScrollTrigger.create({ trigger: ch, start: 'top center', end: 'bottom center', onToggle: (st) => st.isActive && setMood(ch.dataset.tone as 'past') });
        gsap.fromTo(ch.querySelectorAll('.ch-scene .w'), { opacity: 0.08, filter: 'blur(3px)' }, { opacity: 1, filter: 'blur(0px)', stagger: 0.05, ease: 'none', scrollTrigger: { trigger: ch.querySelector('.ch-scene'), start: 'top 75%', end: 'bottom 75%', scrub: true } });
        gsap.fromTo(ch.querySelector('.ch-veil'), { opacity: 0.35 }, { opacity: 1, ease: 'none', scrollTrigger: { trigger: ch, start: 'top top', end: '+=100%', scrub: true } });
        gsap.from(ch.querySelectorAll('.ch-head > *'), { y: 80, opacity: 0, duration: 1.6, stagger: 0.14, ease: 'expo.out', scrollTrigger: { trigger: ch, start: 'top 60%' } });
        gsap.fromTo(ch.querySelector('.ch-plate'), { clipPath: 'inset(100% 0% 0% 0%)', y: 120, rotate: 0 },
          { clipPath: 'inset(0% 0% 0% 0%)', y: 0, rotate: -1.2, duration: 1.8, ease: 'expo.inOut', scrollTrigger: { trigger: ch.querySelector('.ch-body'), start: 'top 80%' } });
      });
      gsap.utils.toArray<HTMLElement>('.reveal').forEach((el) =>
        gsap.from(el, { y: 40, opacity: 0, duration: 1.4, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } }));
      gsap.utils.toArray<HTMLElement>('.walk-card').forEach((el) =>
        gsap.from(el, { y: 60, opacity: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: el.parentElement, start: 'top 40%' } }));
    }, root);
    return () => {
      ctx.revert();
      if (lenis) { gsap.ticker.remove(raf); lenis.destroy(); }
    };
  }, []);

  return (
    <div ref={root} className="promenade">
      <div ref={mapEl} className="map-layer" aria-hidden />
      <div className="grain" aria-hidden />
      <div className="progress" aria-hidden><i /></div>
      <header className="topbar">
        <span>Paris, à pied</span>
        <span>{chapters.order.length} images · {walkKm.toFixed(1).replace('.', ',')} km · <button className="sound" onClick={toggleSound} aria-pressed={sound}>{sound ? 'son ●' : 'son ○'}</button></span>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <p className="hero-kicker hero-line">Projet de classe · une promenade</p>
          <h1><span className="hero-line">Paris,</span><span className="hero-line"><em>à pied</em></span></h1>
          <p className="hero-lede hero-line">
            Vingt-deux images ramassées dans la rue. Des murs qui parlent, des pierres qui se souviennent.
            On marche, on regarde, et l'histoire remonte sous les pas.
          </p>
          <p className="hero-scroll hero-line">Faites défiler ↓</p>
        </div>
      </section>

      {items.map((it, i) => {
        if (it.kind === 'coda') return (
          <section key="coda" className="coda">
            <p className="reveal kicker">Hors les murs</p>
            <h2 className="reveal">Ailleurs, la même colère</h2>
            <p className="reveal">Trois images qui ne semblent pas avoir été prises à Paris. On les garde : les murs de province répondent à ceux de la capitale.</p>
          </section>
        );
        if (it.kind === 'walk') return (
          <section key={`w${i}`} className="walk">
            <div className="walk-card">
              <p className="kicker">En marchant</p>
              <h3>{it.from.title} <span>→</span> {it.to.title}</h3>
              <p className="walk-dist">{formatWalk(it.leg)} · <span className="walk-left">en route</span></p>
              <p className="walk-street">{it.leg.streets?.[0]?.[1] ?? ''}</p>
              <p className="walk-text">{it.text}</p>
            </div>
          </section>
        );
        const { photo: p, ch, n } = it;
        return (
          <section key={p.id} id={p.id} className={`ch tone-${ch.tone}`} data-tone={ch.tone}>
            <div className="ch-bg">
              <img src={artUrl(ch.art.image)} srcSet={ch.art.mid ? `${artUrl(ch.art.mid)} 900w, ${artUrl(ch.art.image)} 1920w` : undefined} sizes="100vw" alt="" loading={n > 2 ? 'lazy' : 'eager'} style={{ background: ch.art.color }} />
              <i className="ch-veil" />
            </div>
            <div className="ch-inner">
              <header className="ch-head">
                <p className="kicker">{ROMAN[n]} · {placeOf(p, ch)}</p>
                <div className="ch-era">{ch.era}</div>
                <h2 className="ch-title">{p.title}</h2>
              </header>
              <div className="ch-scene">
                <p className="kicker ch-when">{ch.when}</p>
                {ch.scene.map((t, j) => (
                  <p key={j}>{t.split(' ').map((w, k) => <span key={k} className="w">{w} </span>)}</p>
                ))}
              </div>
              <div className="ch-body">
                <figure className="ch-plate">
                  <img src={photoUrl(p.mid)} srcSet={`${photoUrl(p.mid)} 800w, ${photoUrl(p.file)} 1600w`} sizes="(max-width: 800px) 90vw, 40vw" alt={p.title} width={p.width} height={p.height} loading="lazy" style={{ background: p.color }} />
                  <figcaption>{p.lat != null && p.lng != null ? formatCoords(p.lat, p.lng) : 'Lieu encore à retrouver'}</figcaption>
                </figure>
                <div className="ch-text">
                  <p className="kicker today">Aujourd'hui, en passant</p>
                  {ch.text.map((t, j) => <p key={j} className="reveal">{t}</p>)}
                </div>
              </div>
              <footer className="ch-note">
                <p className="reveal">{ch.note}</p>
                <small className="reveal">
                  En fond : {ch.art.caption}. {ch.art.credit && `${ch.art.credit} · `}{ch.art.license}
                  {ch.art.source && <> · <a href={ch.art.source} target="_blank" rel="noreferrer">Wikimedia Commons</a></>}
                </small>
              </footer>
            </div>
          </section>
        );
      })}

      <section className="outro">
        <p className="reveal kicker">Fin de la promenade</p>
        <h2 className="reveal">On rentre à pied.</h2>
        <p className="reveal">
          {photos.length} lieux retrouvés sur le plan, {pending.length} images encore sans adresse. Si vous savez où elles ont été prises, dites-le-nous :
          la promenade s'allongera.
        </p>
        <button className="reveal back" onClick={() => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })}>Revenir au début ↑</button>
      </section>
    </div>
  );
}

import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

type Props = { visible: boolean; stats: { photos: number; pending: number; arrondissements: number; walkKm: number }; onEnter: () => void };

export function Intro({ visible, stats, onEnter }: Props) {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (visible) {
        gsap.set(root.current, { autoAlpha: 1, y: 0 });
        gsap.fromTo(
          '.intro > *',
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.4, stagger: 0.12, ease: 'expo.out', delay: 0.2 },
        );
      } else {
        gsap.to(root.current, { autoAlpha: 0, y: 20, duration: 0.8, ease: 'power2.inOut' });
      }
    }, root);
    return () => ctx.revert();
  }, [visible]);

  return (
    <section ref={root} className="intro" aria-hidden={!visible}>
      <p className="eyebrow">Projet de classe · Paris · {stats.arrondissements} arrondissements</p>
      <p className="intro-lede">
        Un parcours culturel à pied : {stats.photos} étapes, {stats.walkKm.toFixed(1).replace('.', ',')} km de marche à travers les quartiers de Paris.
        {stats.pending > 0 && ` ${stats.pending} autres attendent encore leur adresse.`}
      </p>
      <div className="intro-actions">
        <button className="btn-outline" onClick={onEnter}>
          Entrer dans Paris <span aria-hidden>↓</span>
        </button>
        <span className="hint">ou faites défiler</span>
      </div>
    </section>
  );
}

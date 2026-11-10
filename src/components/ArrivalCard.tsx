import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

export function ArrivalCard({ show, subtitle }: { show: boolean; subtitle: string }) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!show) return;
    const ctx = gsap.context(() => {
      gsap
        .timeline()
        .set(root.current, { autoAlpha: 1 })
        .fromTo('.arrival-word span', { yPercent: 110 }, { yPercent: 0, duration: 1.3, stagger: 0.06, ease: 'expo.out' })
        .fromTo('p', { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power2.out' }, 0.5)
        .to('.arrival-word span', { yPercent: -110, duration: 0.9, stagger: 0.04, ease: 'expo.in' }, 2.6)
        .to(root.current, { autoAlpha: 0, duration: 0.6 }, 3.1);
    }, root);
    return () => ctx.revert();
  }, [show]);

  return (
    <div ref={root} className="arrival" aria-hidden>
      <h2 className="arrival-word">
        {'Arrived'.split('').map((c, i) => (
          <span key={i}>{c}</span>
        ))}
      </h2>
      <p>{subtitle}</p>
    </div>
  );
}

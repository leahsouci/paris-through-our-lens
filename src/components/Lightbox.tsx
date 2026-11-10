import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import type { Photo } from '../types';
import { photoUrl } from '../photos';

export function Lightbox({ photo, onClose }: { photo: Photo | null; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!photo) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(root.current, { opacity: 0 }, { opacity: 1, duration: 0.5 });
      gsap.fromTo('img', { scale: 0.96, opacity: 0 }, { scale: 1, opacity: 1, duration: 1, ease: 'expo.out' });
    }, root);
    return () => ctx.revert();
  }, [photo]);

  if (!photo) return null;
  return (
    <div ref={root} className="lightbox" onClick={onClose} role="dialog" aria-label={photo.title}>
      <img src={photoUrl(photo.file)} alt={photo.title} width={photo.width} height={photo.height} />
      <p>
        <span>{photo.title}</span>
        <span>{photo.author}</span>
      </p>
      <button className="link lightbox-close" aria-label="Close">
        Close ×
      </button>
    </div>
  );
}

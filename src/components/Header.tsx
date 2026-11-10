import type { RefObject } from 'react';
import type { Phase } from '../App';
import { pad2 } from '../photos';

type Props = {
  phase: Phase;
  stats: { photos: number; authors: number; arrondissements: number; range: string; pending: number };
  touring: boolean;
  indexOpen: boolean;
  soundOn: boolean;
  coordsRef: RefObject<HTMLSpanElement | null>;
  altRef: RefObject<HTMLSpanElement | null>;
  onEnter: () => void;
  onSpace: () => void;
  onTour: () => void;
  onIndex: () => void;
  onSound: () => void;
};

const Toggle = ({ on }: { on: boolean }) => <span className="toggle">( {on ? 'Y' : 'N'} )</span>;

export function Header(p: Props) {
  const inParis = p.phase === 'paris';
  const big = (p.phase === 'space' || p.phase === 'loading') && !p.indexOpen;
  return (
    <header className={`header ${big ? 'is-big' : 'is-compact'}`}>
      <div className="wordmark" aria-label="Paris">
        PARIS
      </div>
      <div className="meta-row">
        <div className="meta-col">
          <span className="strong">Paris Through Our Lens</span>
          <span>Projet de classe</span>
        </div>
        <nav className="meta-col" aria-label="Main">
          {inParis ? (
            <button className="link" onClick={p.onSpace} disabled={p.indexOpen}>
              Plan ↑
            </button>
          ) : (
            <button className="link" onClick={p.onEnter} disabled={p.phase !== 'space'}>
              Entrer ↓
            </button>
          )}
          <button className={`link ${p.indexOpen ? 'is-on' : ''}`} onClick={p.onIndex}>
            {p.indexOpen ? 'Fermer l’index ×' : `Index (${pad2(p.stats.photos + p.stats.pending)})`}
          </button>
          <button className="link" onClick={p.onTour} disabled={!inParis || p.indexOpen}>
            {p.touring ? 'Arrêter ■' : 'Visite guidée ▶'}
          </button>
        </nav>
        <div className="meta-col meta-toggles">
          <span className="toggle-line">
            Photographes <span className="toggle">( {pad2(p.stats.authors)} )</span>
          </span>
          <span className="toggle-line">
            Arrondissements <span className="toggle">( {pad2(p.stats.arrondissements)} )</span>
          </span>
          <button className="link toggle-line" onClick={p.onSound}>
            Son <Toggle on={p.soundOn} />
          </button>
        </div>
        <div className="meta-col meta-right">
          <span ref={p.coordsRef}>48.857° N, 2.352° E</span>
          <span ref={p.altRef}>Altitude —</span>
          <span>Paris, France</span>
        </div>
      </div>
    </header>
  );
}

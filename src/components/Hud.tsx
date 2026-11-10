import { useState } from 'react';
import type { Photo } from '../types';
import { pad2, photoUrl, shortArr } from '../photos';

export type Filters = { author: string; arrondissement: string; day: string };
export const NO_FILTERS: Filters = { author: '', arrondissement: '', day: '' };

type Props = {
  visible: boolean;
  photos: Photo[];
  allPhotos: Photo[];
  activeId: string | null;
  filters: Filters;
  onFilters: (f: Filters) => void;
  onSelect: (id: string) => void;
};

const unique = <T,>(xs: T[]) => [...new Set(xs)];

export function Hud({ visible, photos, allPhotos, activeId, filters, onFilters, onSelect }: Props) {
  const [showFilters, setShowFilters] = useState(false);

  const authors = unique(allPhotos.map((p) => p.author)).sort();
  const arrs = unique(allPhotos.map((p) => p.arrondissement ?? -1)).filter((n) => n >= 0).sort((a, b) => a - b);
  const days = unique(allPhotos.map((p) => p.takenAt?.slice(0, 10) ?? '')).filter(Boolean).sort();
  const activeFilters = Object.values(filters).filter(Boolean).length;

  return (
    <div className={`hud ${visible ? 'is-visible' : ''}`}>
      <div className="hud-bar">
        <button className={`link ${showFilters ? 'is-on' : ''}`} onClick={() => setShowFilters((s) => !s)}>
          Filters <span className="toggle">( {activeFilters ? pad2(activeFilters) : 'N'} )</span>
        </button>
        {showFilters && (
          <div className="filters">
            <select aria-label="Photographer" value={filters.author} onChange={(e) => onFilters({ ...filters, author: e.target.value })}>
              <option value="">All photographers</option>
              {authors.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
            <select
              aria-label="Arrondissement"
              value={filters.arrondissement}
              onChange={(e) => onFilters({ ...filters, arrondissement: e.target.value })}
            >
              <option value="">All arrondissements</option>
              {arrs.map((n) => (
                <option key={n} value={n}>
                  {shortArr(n)}
                </option>
              ))}
            </select>
            <select aria-label="Day" value={filters.day} onChange={(e) => onFilters({ ...filters, day: e.target.value })}>
              <option value="">All days</option>
              {days.map((d) => (
                <option key={d} value={d}>
                  {new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </option>
              ))}
            </select>
            {activeFilters > 0 && (
              <button className="link" onClick={() => onFilters(NO_FILTERS)}>
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      <div className="filmstrip">
        {photos.map((p) => (
          <button key={p.id} className={`film ${p.id === activeId ? 'is-active' : ''}`} onClick={() => onSelect(p.id)} title={p.title}>
            <img src={photoUrl(p.thumb)} alt={p.title} width={56} height={56} loading="lazy" decoding="async" />
            <span>{pad2(p.number)}</span>
          </button>
        ))}
        {photos.length === 0 && <p className="film-empty">No photos match these filters.</p>}
      </div>
    </div>
  );
}

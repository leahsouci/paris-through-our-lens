import walk from './data/walk.json';
import raw from './data/photos.json';
import type { PendingPhoto, Photo } from './types';

type RawPhoto = Omit<Photo, 'title' | 'author' | 'html' | 'readMinutes' | 'number' | 'lat' | 'lng'> & {
  lat: number | null;
  lng: number | null;
};
type Article = { title: string; author: string; html: string; words: number };

const articles = import.meta.glob<Article>('./articles/*.md', { import: 'default', eager: true });

export const photoUrl = (file: string) => `${import.meta.env.BASE_URL}photos/${file}`;

const all = (raw as RawPhoto[]).map((p, i) => {
  const a = articles[`./articles/${p.id}.md`];
  return {
    ...p,
    title: a?.title || p.id,
    author: a?.author || 'Anonyme',
    html: a?.html ?? '',
    readMinutes: Math.max(1, Math.round((a?.words ?? 0) / 220)),
    number: i + 1,
  };
});

export const photos: Photo[] = all.filter((p): p is typeof p & { lat: number; lng: number } => p.lat != null && p.lng != null);
// Photos we couldn't place yet: shown in the index with an "À localiser" tag, not on the map.
export const pending: PendingPhoto[] = all.filter((p) => p.lat == null || p.lng == null);

// Kept inline so the arrondissement geometry only ships with the (lazy) map chunk.
const NAMES = ['', 'Louvre', 'Bourse', 'Temple', 'Hôtel-de-Ville', 'Panthéon', 'Luxembourg', 'Palais-Bourbon', 'Élysée', 'Opéra', 'Entrepôt',
  'Popincourt', 'Reuilly', 'Gobelins', 'Observatoire', 'Vaugirard', 'Passy', 'Batignolles-Monceau', 'Buttes-Montmartre', 'Buttes-Chaumont', 'Ménilmontant'];

const ord = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

export function arrondissementLabel(n: number | null, withName = false) {
  if (n == null) return '';
  if (n === 0) return 'Outside Paris';
  const label = `${ord(n)} arrondissement`;
  return withName && NAMES[n] ? `${label} · ${NAMES[n]}` : label;
}

export const shortArr = (n: number | null) => (n == null ? '—' : n === 0 ? 'Outside Paris' : ord(n));

export function formatDate(iso: string | null, withTime = true) {
  if (!iso) return 'Unknown date';
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  if (!withTime) return date;
  return `${date}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

export const dayKey = (iso: string | null) => (iso ? iso.slice(0, 10) : 'unknown');

export function formatCoords(lat: number, lng: number, digits = 4) {
  return `${Math.abs(lat).toFixed(digits)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(digits)}° ${lng >= 0 ? 'E' : 'W'}`;
}

export const pad2 = (n: number) => String(n).padStart(2, '0');

type Leg = { distance: number; duration: number; coordinates: [number, number][]; streets?: [number, string][] };
const LEGS = walk as unknown as Record<string, Leg>;
export const legBetween = (a?: string, b?: string): Leg | null => (a && b ? LEGS[`${a}>${b}`] ?? null : null);
export const formatWalk = (l: Leg) => `${(l.distance / 1000).toFixed(1).replace('.', ',')} km · ${Math.round(l.duration / 60)} min à pied`;
export const walkKm = photos.slice(1).reduce((km, p, i) => km + (legBetween(photos[i].id, p.id)?.distance ?? 0) / 1000, 0);

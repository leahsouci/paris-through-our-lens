// Reads every photo in /photos-raw, extracts GPS + date from EXIF, makes web versions
// (EXIF stripped for privacy), and updates src/data/photos.json + src/articles/<id>.md.
// Usage: npm run import-photos
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import exifr from 'exifr';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';

const ROOT = path.resolve(import.meta.dirname, '..');
const RAW = path.join(ROOT, 'photos-raw');
const OUT = path.join(ROOT, 'public', 'photos');
const ARTICLES = path.join(ROOT, 'src', 'articles');
const DATA = path.join(ROOT, 'src', 'data', 'photos.json');
const ARR = JSON.parse(await fs.readFile(path.join(ROOT, 'src', 'data', 'arrondissements.json'), 'utf8'));
const QUARTIERS = JSON.parse(await fs.readFile(path.join(ROOT, 'src', 'data', 'quartiers.json'), 'utf8'));
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.tif', '.tiff']);

const slugify = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function arrondissementOf(lat, lng) {
  if (lat == null || lng == null) return null;
  const p = point([lng, lat]);
  const hit = ARR.features.find((f) => booleanPointInPolygon(p, f));
  return hit ? hit.properties.number : 0; // 0 = outside Paris
}

function quartierOf(lat, lng) {
  if (lat == null || lng == null) return null;
  const p = point([lng, lat]);
  return QUARTIERS.features.find((f) => booleanPointInPolygon(p, f))?.properties.name ?? null;
}

function toIso(date) {
  if (!(date instanceof Date) || isNaN(date)) return null;
  // EXIF dates have no timezone; keep the wall-clock time as written by the camera.
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Hand-placed locations for photos without GPS (e.g. sent through WhatsApp).
const LOCATIONS_FILE = path.join(ROOT, 'src', 'data', 'locations.json');
const LOCATIONS = existsSync(LOCATIONS_FILE) ? JSON.parse(await fs.readFile(LOCATIONS_FILE, 'utf8')) : {};

const existing = existsSync(DATA) ? JSON.parse(await fs.readFile(DATA, 'utf8')) : [];
const byId = new Map(existing.map((p) => [p.id, p]));

await fs.mkdir(OUT, { recursive: true });
await fs.mkdir(ARTICLES, { recursive: true });
const files = (await fs.readdir(RAW)).filter((f) => EXTENSIONS.has(path.extname(f).toLowerCase())).sort();
if (!files.length) console.log('No photos found in /photos-raw.');

const photos = [];
const missingGps = [];

for (const file of files) {
  const id = slugify(path.parse(file).name);
  const original = await fs.readFile(path.join(RAW, file));
  const ext = path.extname(file).toLowerCase();

  let gps = null;
  let meta = null;
  try {
    gps = await exifr.gps(original);
    meta = await exifr.parse(original, ['DateTimeOriginal', 'CreateDate']);
  } catch {
    /* no EXIF */
  }

  const input = ext === '.heic' || ext === '.heif'
    ? Buffer.from(await heicConvert({ buffer: original, format: 'JPEG', quality: 0.92 }))
    : original;

  // .rotate() applies the EXIF orientation; sharp drops all metadata (incl. GPS) by default.
  const base = sharp(input).rotate();
  const { width, height } = await base.clone().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 })
    .toFile(path.join(OUT, `${id}.webp`));
  await base.clone().resize({ width: 800, withoutEnlargement: true }).webp({ quality: 78 })
    .toFile(path.join(OUT, `${id}-800.webp`));
  await base.clone().resize({ width: 320, height: 320, fit: 'cover' }).webp({ quality: 72 })
    .toFile(path.join(OUT, `${id}-thumb.webp`));
  const { dominant } = await base.clone().stats();

  const prev = byId.get(id) ?? {};
  const loc = LOCATIONS[id] ?? {};
  const lat = gps?.latitude ?? loc.lat ?? prev.lat ?? null;
  const lng = gps?.longitude ?? loc.lng ?? prev.lng ?? null;
  if (lat == null || lng == null) missingGps.push(file);

  photos.push({
    id,
    file: `${id}.webp`,
    mid: `${id}-800.webp`,
    thumb: `${id}-thumb.webp`,
    lat: lat == null ? null : +lat.toFixed(6),
    lng: lng == null ? null : +lng.toFixed(6),
    takenAt: toIso(meta?.DateTimeOriginal ?? meta?.CreateDate) ?? prev.takenAt ?? null,
    arrondissement: arrondissementOf(lat, lng),
    quartier: quartierOf(lat, lng),
    precision: gps ? 'gps' : lat == null ? null : (loc.precision ?? 'approx'),
    step: loc.step ?? null,
    place: loc.place ?? null,
    clue: loc.clue ?? null,
    width,
    height,
    color: `rgb(${dominant.r},${dominant.g},${dominant.b})`,
  });

  const articlePath = path.join(ARTICLES, `${id}.md`);
  if (!existsSync(articlePath)) {
    const title = loc.title ?? path.parse(file).name.replace(/[-_]+/g, ' ');
    await fs.writeFile(articlePath, `---\ntitle: ${title}\nauthor: \n---\n\nWrite the story of this photo here: where, when, why it matters.\n`);
  }
  console.log(`✓ ${file}${lat == null ? '  (no GPS)' : `  ${lat.toFixed(5)}, ${lng.toFixed(5)}`}`);
}

photos.sort((a, b) => (a.step ?? 999) - (b.step ?? 999) || (a.takenAt ?? '9999').localeCompare(b.takenAt ?? '9999') || (a.lat == null) - (b.lat == null));
await fs.writeFile(DATA, JSON.stringify(photos, null, 2) + '\n');
console.log(`\nWrote ${photos.length} photos to src/data/photos.json`);

if (missingGps.length) {
  console.log('\n⚠  These photos have no GPS data. Add "lat" and "lng" for them in src/data/locations.json,');
  console.log('   then run this script again (your values are kept):');
  missingGps.forEach((f) => console.log('   - ' + f));
}

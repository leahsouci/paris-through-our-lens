// Downloads public-domain / CC0 archive images from Wikimedia Commons for each step's "Retour en arrière".
// Usage: npm run fetch-history   (reads src/data/history.json, fills in credits)
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const file = path.join(ROOT, 'src/data/history.json');
const history = JSON.parse(await fs.readFile(file, 'utf8'));
const strip = (s = '') => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

for (const [id, h] of Object.entries(history)) {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', format: 'json', titles: `File:${h.commons}`, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '1600',
  });
  const page = Object.values((await (await fetch(url, { headers: { 'User-Agent': 'paris-through-our-lens' } })).json()).query.pages)[0];
  const info = page.imageinfo?.[0];
  if (!info) { console.log(`✗ ${id}: ${h.commons}`); continue; }
  let res;
  for (let i = 0; i < 5; i++) {
    res = await fetch(info.thumburl, { headers: { 'User-Agent': 'paris-through-our-lens' } });
    if (res.ok) break;
    await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const img = sharp(buf).rotate();
  const meta = await img.metadata();
  await img.clone().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(ROOT, 'public/history', `${id}-1600.webp`));
  await img.clone().resize({ width: 800, withoutEnlargement: true }).webp({ quality: 74 }).toFile(path.join(ROOT, 'public/history', `${id}-800.webp`));
  const m = info.extmetadata ?? {};
  Object.assign(h, {
    image: `${id}-1600.webp`, mid: `${id}-800.webp`, width: meta.width, height: meta.height,
    credit: strip(m.Artist?.value) || 'Auteur inconnu', license: strip(m.LicenseShortName?.value), source: info.descriptionurl,
  });
  console.log(`✓ ${id}  ${meta.width}x${meta.height}  ${h.license}  ${h.credit.slice(0, 50)}`);
  await new Promise((r) => setTimeout(r, 1500));
}
await fs.writeFile(file, JSON.stringify(history, null, 2) + '\n');

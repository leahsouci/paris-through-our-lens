// Fetches walking paths (OpenStreetMap foot routing) between consecutive located photos
// and writes them to src/data/walk.json. Usage: npm run walk-route
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const photos = JSON.parse(await fs.readFile(path.join(ROOT, 'src/data/photos.json'), 'utf8')).filter((p) => p.lat != null);
const legs = {};
for (let i = 0; i < photos.length - 1; i++) {
  const [a, b] = [photos[i], photos[i + 1]];
  const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url, { headers: { 'User-Agent': 'paris-through-our-lens' } });
  const route = (await res.json()).routes?.[0];
  if (!route) { console.log(`✗ ${a.id} → ${b.id}`); continue; }
  legs[`${a.id}>${b.id}`] = {
    distance: Math.round(route.distance),
    duration: Math.round(route.duration),
    coordinates: route.geometry.coordinates.map(([x, y]) => [+x.toFixed(5), +y.toFixed(5)]),
  };
  console.log(`✓ ${a.id} → ${b.id}  ${(route.distance / 1000).toFixed(1)} km`);
  await new Promise((r) => setTimeout(r, 1000));
}
await fs.writeFile(path.join(ROOT, 'src/data/walk.json'), JSON.stringify(legs) + '\n');

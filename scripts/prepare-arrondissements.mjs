// One-off: slims the Paris open-data arrondissements file down to what the app needs.
import fs from 'node:fs';
const src = JSON.parse(fs.readFileSync(new URL('./data/arrondissements.raw.geojson', import.meta.url)));
const round = (c) => (typeof c[0] === 'number' ? [+c[0].toFixed(5), +c[1].toFixed(5)] : c.map(round));
const out = {
  type: 'FeatureCollection',
  features: src.features
    .map((f) => ({
      type: 'Feature',
      properties: { number: f.properties.c_ar, name: f.properties.l_aroff, centerLng: +f.properties.geom_x_y.lon.toFixed(5), centerLat: +f.properties.geom_x_y.lat.toFixed(5) },
      geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) },
    }))
    .sort((a, b) => a.properties.number - b.properties.number),
};
fs.writeFileSync(new URL('../src/data/arrondissements.json', import.meta.url), JSON.stringify(out));
console.log('wrote', out.features.length, 'arrondissements');

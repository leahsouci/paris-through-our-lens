import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';

const BASE_STYLE = 'https://tiles.openfreemap.org/styles/positron';

export const INK = '#111111';
export const BLUE = '#1f33e8';

// Editorial palette: paper-white land, ultramarine water, white "architectural model" buildings.
const PAINT: Record<string, Record<string, unknown>> = {
  background: { 'background-color': '#f1f1ef' },
  park: { 'fill-color': '#e6e8e3' },
  water: { 'fill-color': BLUE },
  waterway: { 'line-color': BLUE },
  landuse_residential: { 'fill-color': '#ececea' },
  landcover_wood: { 'fill-color': '#e4e6e1' },
  highway_minor: { 'line-color': '#e2e2e0' },
  highway_major_casing: { 'line-color': '#d4d4d2' },
  highway_major_inner: { 'line-color': '#ffffff' },
  boundary_2: { 'line-color': '#9a9a9a' },
  water_name_point_label: { 'text-color': '#ffffff', 'text-halo-width': 0 },
  water_name_line_label: { 'text-color': '#ffffff', 'text-halo-width': 0 },
};
for (const id of ['label_other', 'label_village', 'label_town', 'label_state', 'label_city', 'label_city_capital']) {
  PAINT[id] = { 'text-color': '#5c5c5c', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2, 'text-halo-blur': 0 };
}
for (const id of ['label_country_1', 'label_country_2', 'label_country_3']) {
  PAINT[id] = { 'text-color': '#7a7a7a', 'text-halo-color': 'rgba(255,255,255,0.8)', 'text-halo-width': 1 };
}

const HIDDEN = new Set([
  'label_other', // replaced by the official quartier names
  'building',
  'boundary_3',
  'boundary_disputed',
  'highway-shield-non-us',
  'highway-shield-us-interstate',
  'road_shield_us',
  'airport',
  'aeroway-taxiway',
  'aeroway-runway-casing',
  'aeroway-runway',
  'aeroway-area',
  'railway_transit_dashline',
  'railway_service_dashline',
  'railway_dashline',
]);

const buildings3d: LayerSpecification = {
  id: 'building-3d',
  type: 'fill-extrusion',
  source: 'openmaptiles',
  'source-layer': 'building',
  minzoom: 13,
  paint: {
    'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 10], 0, '#f7f7f5', 60, '#ffffff'],
    'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 15, ['coalesce', ['get', 'render_height'], 10]],
    'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
    'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 13.6, 0.95],
    'fill-extrusion-vertical-gradient': true,
  },
};

export async function buildStyle(): Promise<StyleSpecification> {
  // Same URL + credentials mode as the <link rel="preload"> in index.html, so the preloaded response is reused.
  const style = (await (await fetch(BASE_STYLE, { credentials: 'same-origin' })).json()) as StyleSpecification;
  delete style.sources.ne2_shaded;

  const layers: LayerSpecification[] = [];
  for (const original of style.layers) {
    if ('source' in original && original.source === 'ne2_shaded') continue;
    if (HIDDEN.has(original.id)) continue;
    const layer = { ...original } as LayerSpecification & { paint?: Record<string, unknown>; layout?: Record<string, unknown> };
    if (PAINT[layer.id]) layer.paint = { ...(layer.paint ?? {}), ...PAINT[layer.id] };
    if (layer.type === 'symbol' && layer.id.startsWith('label_')) {
      layer.layout = { ...(layer.layout ?? {}), 'text-letter-spacing': 0.12, 'text-transform': 'uppercase' };
    }
    if (layer.id === 'highway-name-path') layers.push(buildings3d);
    layers.push(layer);
  }
  style.layers = layers;

  style.light = { anchor: 'viewport', color: '#ffffff', intensity: 0.32, position: [1.3, 210, 35] };
  style.sky = {
    'sky-color': '#ffffff',
    'horizon-color': '#dfe3ff',
    'fog-color': '#ffffff',
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.8,
    'fog-ground-blend': 0.9,
  };
  return style;
}

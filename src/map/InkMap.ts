import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection, LineString } from 'geojson';
import { buildStyle, BLUE as OX, INK } from './mapStyle';
import arrondissements from '../data/arrondissements.json';
import quartiers from '../data/quartiers.json';
import parisOutline from '../data/paris-outline.json';

type LngLat = [number, number];
const PARIS_BOUNDS: [LngLat, LngLat] = [[2.224, 48.8156], [2.4697, 48.9022]];
const line = (c: LngLat[]) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: c } });

// A paper-and-ink plan of Paris whose camera is driven by the page scroll.
export class InkMap {
  private bearing = 0;
  private walker: maplibregl.Marker;
  private dest: maplibregl.Marker | null = null;
  private destImg: HTMLImageElement | null = null;
  map: maplibregl.Map;
  private constructor(map: maplibregl.Map) {
    this.map = map;
    const el = document.createElement('div');
    el.className = 'walker';
    this.walker = new maplibregl.Marker({ element: el });
  }

  static async create(container: HTMLElement, route: LngLat[], stops: { lng: number; lat: number; n: number }[]) {
    const map = new maplibregl.Map({
      container,
      style: await buildStyle(),
      bounds: PARIS_BOUNDS,
      interactive: false,
      maxPitch: 70,
      attributionControl: { compact: true },
      canvasContextAttributes: { antialias: true },
    });
    await map.once('load');
    const outline = (parisOutline as unknown as LngLat[][][]).flat();
    map.addSource('mask', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-10, 40], [15, 40], [15, 58], [-10, 58], [-10, 40]], ...outline] } } });
    map.addLayer({ id: 'mask', type: 'fill', source: 'mask', paint: { 'fill-color': '#efe7d6', 'fill-opacity': 0.88 } });
    map.addSource('outline', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: outline } } });
    map.addLayer({ id: 'outline', type: 'line', source: 'outline', paint: { 'line-color': INK, 'line-width': 1.4 } });
    map.addSource('arr', { type: 'geojson', data: arrondissements as unknown as FeatureCollection });
    map.addLayer({ id: 'arr', type: 'line', source: 'arr', paint: { 'line-color': '#8c7e66', 'line-width': 0.9, 'line-dasharray': [3, 2] } });
    map.addSource('quartiers', { type: 'geojson', data: quartiers as unknown as FeatureCollection });
    map.addLayer({ id: 'quartiers', type: 'line', source: 'quartiers', paint: { 'line-color': '#a99c83', 'line-width': 0.5, 'line-opacity': 0.6 } });
    map.addSource('q-labels', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: quartiers.features.map((f) => ({ type: 'Feature' as const, properties: { name: f.properties.name }, geometry: { type: 'Point' as const, coordinates: [f.properties.lng, f.properties.lat] } })) },
    });
    map.addLayer({
      id: 'q-labels', type: 'symbol', source: 'q-labels', minzoom: 12.3,
      layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Italic'], 'text-size': 11, 'text-max-width': 7 },
      paint: { 'text-color': '#6d604c', 'text-halo-color': 'rgba(239,231,214,0.9)', 'text-halo-width': 1.4 },
    });
    map.addSource('route', { type: 'geojson', data: line(route) });
    map.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round' }, paint: { 'line-color': OX, 'line-width': 1.6, 'line-opacity': 0.35, 'line-dasharray': [1, 2.5] } });
    map.addSource('walked', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as FeatureCollection<LineString> });
    map.addLayer({ id: 'walked', type: 'line', source: 'walked', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': OX, 'line-width': 3.2 } });
    map.addSource('stops', { type: 'geojson', data: { type: 'FeatureCollection', features: stops.map((s) => ({ type: 'Feature' as const, properties: { n: String(s.n) }, geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] } })) } });
    map.addLayer({ id: 'stops', type: 'circle', source: 'stops', paint: { 'circle-radius': 9, 'circle-color': '#f6efe1', 'circle-stroke-color': OX, 'circle-stroke-width': 1.5 } });
    map.addLayer({ id: 'stops-n', type: 'symbol', source: 'stops', layout: { 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-allow-overlap': true }, paint: { 'text-color': OX } });
    return new InkMap(map);
  }

  overview() {
    this.walker.remove();
    this.dest?.getElement().classList.remove('is-on');
    const el = this.map.getContainer();
    const cam = this.map.cameraForBounds(PARIS_BOUNDS, { padding: { top: 60, bottom: 60, left: Math.min(el.clientWidth * 0.42, 560), right: 40 } });
    this.map.easeTo({ padding: { left: 0, right: 0, top: 0, bottom: 0 }, center: cam?.center, zoom: cam?.zoom ?? 11.5, pitch: 0, bearing: 0, duration: 1600 });
    this.bearing = 0;
  }

  // Place the walker at fraction p of the street path and follow with a pedestrian camera.
  scrub(coords: LngLat[], p: number, dest?: { img: string; at: LngLat }) {
    const k = Math.cos((coords[0][1] * Math.PI) / 180);
    const seg = coords.slice(1).map((c, i) => Math.hypot((c[0] - coords[i][0]) * k, c[1] - coords[i][1]));
    const total = seg.reduce((a, b) => a + b, 0);
    let d = Math.max(0, Math.min(1, p)) * total;
    let i = 0;
    while (i < seg.length - 1 && d > seg[i]) d -= seg[i++];
    const t = seg[i] ? Math.min(1, d / seg[i]) : 0;
    const here: LngLat = [coords[i][0] + (coords[i + 1][0] - coords[i][0]) * t, coords[i][1] + (coords[i + 1][1] - coords[i][1]) * t];
    const ahead = coords[Math.min(coords.length - 1, i + 4)];
    const heading = (Math.atan2((ahead[0] - here[0]) * k, ahead[1] - here[1]) * 180) / Math.PI;
    this.bearing += ((((heading - this.bearing + 540) % 360) - 180) * 0.08);
    (this.map.getSource('walked') as maplibregl.GeoJSONSource).setData(line([...coords.slice(0, i + 1), here]));
    this.walker.setLngLat(here).addTo(this.map);
    const arrive = Math.max(0, Math.min(1, (p - 0.78) / 0.22));
    const ease = arrive * arrive * (3 - 2 * arrive);
    if (dest) {
      if (!this.dest) {
        const el = document.createElement('div');
        el.className = 'postcard';
        this.destImg = document.createElement('img');
        this.destImg.alt = '';
        el.appendChild(this.destImg);
        this.dest = new maplibregl.Marker({ element: el, anchor: 'bottom' });
      }
      if (this.destImg && !this.destImg.src.endsWith(dest.img)) this.destImg.src = dest.img;
      this.dest.setLngLat(dest.at).addTo(this.map);
      this.dest.getElement().classList.toggle('is-on', arrive > 0.15);
      this.dest.getElement().style.setProperty('--arrive', String(ease));
    }
    const w = this.map.getContainer().clientWidth;
    const padding = w > 800 ? { left: Math.min(w * 0.36, 520), right: 0, top: 0, bottom: 0 } : { left: 0, right: 0, top: 0, bottom: 260 };
    this.map.jumpTo({ center: here, zoom: 15.6 + ease * 1.5, pitch: 60 + ease * 10, bearing: this.bearing, padding });
  }
}

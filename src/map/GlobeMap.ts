import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import gsap from 'gsap';
import type { FeatureCollection, LineString, Point } from 'geojson';
import arrondissements from '../data/arrondissements.json';
import quartiers from '../data/quartiers.json';
import parisOutline from '../data/paris-outline.json';
import type { Photo } from '../types';
import { buildStyle, BLUE, INK } from './mapStyle';
import { formatWalk, legBetween, photoUrl } from '../photos';

type LngLat = [number, number];
type Padding = { top: number; right: number; bottom: number; left: number };

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const NO_PADDING: Padding = { top: 0, right: 0, bottom: 0, left: 0 };

const PARIS_BOUNDS: [LngLat, LngLat] = [[2.224, 48.8156], [2.4697, 48.9022]];
export const PARIS_VIEW = { center: [2.3335, 48.8625] as LngLat, zoom: 12.7, pitch: 56, bearing: -18 };

export type GlobeMapOptions = {
  reducedMotion: boolean;
  onSelect: (id: string) => void;
  onMove?: (lng: number, lat: number, zoom: number) => void;
  onMarkerLand?: () => void;
};

type Pin = { marker: maplibregl.Marker; el: HTMLElement };

export class GlobeMap {
  map!: maplibregl.Map;
  private pins = new Map<string, Pin>();
  private shown = new Set<string>();
  private mode: 'spin' | 'drift' | 'still' = 'still';
  private interacting = false;
  private resumeTimer = 0;
  private raf = 0;
  private lastFrame = 0;
  private routeTween?: gsap.core.Tween;
  private readonly opts: GlobeMapOptions;

  private constructor(opts: GlobeMapOptions) {
    this.opts = opts;
  }

  static async create(container: HTMLElement, opts: GlobeMapOptions) {
    const globe = new GlobeMap(opts);
    await globe.init(container);
    return globe;
  }

  private async init(container: HTMLElement) {
    const style = await buildStyle();
    this.map = new maplibregl.Map({
      container,
      style,
      bounds: PARIS_BOUNDS,
      maxBounds: [[1.5, 48.45], [3.2, 49.25]],
      minZoom: 10,
      maxPitch: 72,
      attributionControl: { compact: true },
      canvasContextAttributes: { antialias: true },
    });
    await new Promise<void>((resolve) => this.map.once('load', () => resolve()));
    this.map.jumpTo(this.overviewCamera());
    this.addOverlays();
    this.setInteractive('space');

    const hold = () => {
      this.interacting = true;
      clearTimeout(this.resumeTimer);
    };
    const release = () => {
      clearTimeout(this.resumeTimer);
      this.resumeTimer = window.setTimeout(() => (this.interacting = false), 3000);
    };
    for (const e of ['mousedown', 'touchstart', 'wheel'] as const) this.map.on(e, hold);
    for (const e of ['mouseup', 'touchend', 'wheel'] as const) this.map.on(e, release);
    this.map.on('move', () => {
      const c = this.map.getCenter();
      this.opts.onMove?.(c.lng, c.lat, this.map.getZoom());
    });

    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.map.remove();
  }

  private frame = (t: number) => {
    const dt = this.lastFrame ? Math.min(t - this.lastFrame, 64) : 16;
    this.lastFrame = t;
    if (!this.interacting && !this.opts.reducedMotion && !this.map.isMoving()) {
      if (this.mode === 'spin') {
        const c = this.map.getCenter();
        this.map.jumpTo({ center: [c.lng - dt * 0.004, c.lat] });
      } else if (this.mode === 'drift') {
        this.map.jumpTo({ bearing: this.map.getBearing() + dt * 0.0012 });
      }
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  spacePadding(el: HTMLElement = this.map.getContainer()): Padding {
    const w = el.clientWidth;
    return w > 900 ? { ...NO_PADDING, left: Math.min(w * 0.42, 620) } : { ...NO_PADDING, bottom: el.clientHeight * 0.3 };
  }

  // Whole city seen from above, framed beside the intro text.
  overviewCamera() {
    const el = this.map.getContainer();
    const pad = this.spacePadding(el);
    const cam = this.map.cameraForBounds(PARIS_BOUNDS, {
      padding: { top: Math.min(260, el.clientHeight * 0.3), bottom: 30 + pad.bottom, left: 30 + pad.left, right: 30 },
    });
    return { center: cam?.center ?? PARIS_VIEW.center, zoom: cam?.zoom ?? 11.5, pitch: 0, bearing: 0, padding: NO_PADDING };
  }

  startSpin() {
    this.mode = 'still';
  }

  private setInteractive(state: 'space' | 'locked' | 'paris') {
    const m = this.map;
    const all = [m.scrollZoom, m.boxZoom, m.dragRotate, m.dragPan, m.keyboard, m.doubleClickZoom, m.touchZoomRotate, m.touchPitch];
    all.forEach((h) => (state === 'paris' ? h.enable() : h.disable()));
    if (state === 'space') m.dragPan.enable();
  }

  private move(kind: 'flyTo' | 'easeTo', options: maplibregl.FlyToOptions): Promise<void> {
    return new Promise((resolve) => {
      this.map.once('moveend', () => resolve());
      this.map[kind]({ ...options, duration: this.opts.reducedMotion ? 0 : options.duration, essential: true });
    });
  }

  async descend() {
    this.mode = 'still';
    this.setInteractive('locked');
    await this.move('easeTo', { ...PARIS_VIEW, padding: NO_PADDING, duration: 5200, easing: easeInOutCubic });
    this.setInteractive('paris');
    this.mode = 'drift';
  }

  async ascend() {
    this.mode = 'still';
    this.setInteractive('locked');
    this.hideAll();
    this.clearRoute();
    this.highlight(null);
    await this.move('easeTo', { ...this.overviewCamera(), duration: 4200, easing: easeInOutCubic });
    this.setInteractive('space');
  }

  flyToPhoto(p: Photo, padding: Padding) {
    this.mode = 'still';
    this.highlight(p);
    return this.move('flyTo', {
      center: [p.lng, p.lat],
      zoom: 16.3,
      pitch: 62,
      bearing: this.map.getBearing() + 30,
      padding,
      duration: 4200,
      curve: 1.25,
      easing: easeInOutCubic,
    });
  }

  // Pedestrian-height camera that walks along the street path, with a dot for the walker.
  async walk(coords: LngLat[]) {
    this.mode = 'still';
    this.highlight(null);
    if (this.opts.reducedMotion || coords.length < 2) return;
    const k = Math.cos((coords[0][1] * Math.PI) / 180);
    const seg = coords.slice(1).map((c, i) => Math.hypot((c[0] - coords[i][0]) * k, c[1] - coords[i][1]) * 111320);
    const total = seg.reduce((a, b) => a + b, 0);
    const at = (d: number): LngLat => {
      let i = 0;
      while (i < seg.length - 1 && d > seg[i]) d -= seg[i++];
      const t = seg[i] ? Math.min(1, d / seg[i]) : 0;
      return [coords[i][0] + (coords[i + 1][0] - coords[i][0]) * t, coords[i][1] + (coords[i + 1][1] - coords[i][1]) * t];
    };
    const heading = (a: LngLat, b: LngLat) => (Math.atan2((b[0] - a[0]) * k, b[1] - a[1]) * 180) / Math.PI;
    const el = document.createElement('div');
    el.className = 'walker';
    const dot = new maplibregl.Marker({ element: el }).setLngLat(coords[0]).addTo(this.map);
    await this.move('flyTo', { center: coords[0], zoom: 16.2, pitch: 62, bearing: heading(coords[0], at(150)), padding: NO_PADDING, duration: 2200 });
    const ms = Math.min(14000, Math.max(6000, total * 2.6));
    let bearing = this.map.getBearing();
    await new Promise<void>((resolve) => {
      const start = performance.now();
      const tick = (now: number) => {
        const f = Math.min(1, (now - start) / ms);
        const d = (0.5 - Math.cos(f * Math.PI) / 2) * total;
        const c = at(d);
        const delta = ((heading(c, at(Math.min(total, d + 180))) - bearing + 540) % 360) - 180;
        bearing += delta * 0.035;
        dot.setLngLat(c);
        this.map.jumpTo({ center: c, bearing });
        if (f < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    dot.remove();
  }

  overview() {
    this.highlight(null);
    this.mode = 'drift';
    return this.move('flyTo', { ...PARIS_VIEW, bearing: this.map.getBearing(), padding: NO_PADDING, duration: 3800 });
  }

  // ---------- markers ----------

  setPhotos(photos: Photo[]) {
    for (const p of photos) {
      if (this.pins.has(p.id)) continue;
      const el = document.createElement('div');
      el.className = 'pin';
      el.style.setProperty('--pin-color', p.color);
      el.innerHTML = `
        <div class="pin-drop">
          <div class="pin-hover">
            <div class="pin-photo"><img src="${photoUrl(p.thumb)}" alt="" width="64" height="64" decoding="async" draggable="false" /></div>
            <span class="pin-num">${String(p.number).padStart(2, '0')}</span>
            <div class="pin-label"><span>${escapeHtml(p.title)}</span></div>
          </div>
          <div class="pin-stem"></div>
        </div>
        <div class="pin-ground"></div>`;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `${String(p.number).padStart(2, '0')} ${p.title}`);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.opts.onSelect(p.id);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lng, p.lat]);
      this.pins.set(p.id, { marker, el });
    }
  }

  showMarkers(ids: string[], stagger = true) {
    const wanted = new Set(ids);
    [...this.shown].filter((id) => !wanted.has(id)).forEach((id) => this.hide(id));
    const toAdd = ids.filter((id) => !this.shown.has(id));
    toAdd.forEach((id, i) => {
      const pin = this.pins.get(id);
      if (!pin) return;
      this.shown.add(id);
      pin.marker.addTo(this.map);
      const delay = stagger ? i * 0.35 : 0;
      gsap.fromTo(
        pin.el.querySelector('.pin-drop'),
        { y: -180, opacity: 0, scale: 0.5 },
        { y: 0, opacity: 1, scale: 1, duration: 1.4, delay, ease: 'bounce.out' },
      );
      gsap.fromTo(
        pin.el.querySelector('.pin-ground'),
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 1.2, delay: delay + 0.2, ease: 'power2.out' },
      );
      gsap.delayedCall(delay + 0.55, () => this.opts.onMarkerLand?.());
    });
    return toAdd.length * (stagger ? 0.35 : 0) + 1.4;
  }

  private hide(id: string) {
    const pin = this.pins.get(id);
    if (!pin) return;
    this.shown.delete(id);
    gsap.to(pin.el.querySelectorAll('.pin-drop, .pin-ground'), {
      y: -50,
      opacity: 0,
      duration: 0.6,
      ease: 'power2.in',
      onComplete: () => {
        if (!this.shown.has(id)) pin.marker.remove();
      },
    });
  }

  hideAll() {
    [...this.shown].forEach((id) => this.hide(id));
  }

  setActive(id: string | null) {
    this.pins.forEach((pin, key) => pin.el.classList.toggle('is-active', key === id));
  }

  // ---------- overlays ----------

  private addOverlays() {
    const m = this.map;
    const labels: FeatureCollection<Point> = {
      type: 'FeatureCollection',
      features: arrondissements.features.map((f) => ({
        type: 'Feature',
        properties: { label: `${f.properties.number}${f.properties.number === 1 ? 'er' : 'e'}` },
        geometry: { type: 'Point', coordinates: [f.properties.centerLng, f.properties.centerLat] },
      })),
    };
    m.addSource('arrondissements', { type: 'geojson', data: arrondissements as unknown as FeatureCollection });
    m.addSource('arrondissement-labels', { type: 'geojson', data: labels });
    m.addSource('route', { type: 'geojson', data: emptyLine(), lineMetrics: true });
    // Fade everything outside the city limits so only Paris and its quartiers stand out.
    const outline = parisOutline as LngLat[][];
    m.addSource('paris-mask', {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-10, 40], [15, 40], [15, 58], [-10, 58], [-10, 40]], ...outline] } },
    });
    m.addSource('paris-outline', {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: outline } },
    });
    m.addLayer({ id: 'paris-mask', type: 'fill', source: 'paris-mask', paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.86 } });
    m.addLayer({ id: 'paris-outline', type: 'line', source: 'paris-outline', paint: { 'line-color': INK, 'line-width': 1.2 } });
    m.addSource('quartiers', { type: 'geojson', data: quartiers as unknown as FeatureCollection });
    m.addSource('quartier-labels', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: quartiers.features.map((f) => ({
          type: 'Feature' as const,
          properties: { name: f.properties.name },
          geometry: { type: 'Point' as const, coordinates: [f.properties.lng, f.properties.lat] },
        })),
      },
    });
    m.addLayer(
      {
        id: 'quartier-line',
        type: 'line',
        source: 'quartiers',
        paint: { 'line-color': '#9c9c9c', 'line-width': 0.6, 'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.25, 12, 0.55, 15, 0.25] },
      },
      'building-3d',
    );
    m.addLayer({
      id: 'quartier-label',
      type: 'symbol',
      source: 'quartier-labels',
      minzoom: 12.4,
      maxzoom: 15.5,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 10,
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.16,
        'text-max-width': 7,
      },
      paint: { 'text-color': '#7d7d7d', 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.2 },
    });

    m.addLayer(
      {
        id: 'arr-fill',
        type: 'fill',
        source: 'arrondissements',
        filter: ['==', ['get', 'number'], -1],
        paint: { 'fill-color': BLUE, 'fill-opacity': 0.07 },
      },
      'building-3d',
    );
    m.addLayer(
      {
        id: 'arr-line',
        type: 'line',
        source: 'arrondissements',
        paint: {
          'line-color': INK,
          'line-width': 0.8,
          'line-dasharray': [2, 3],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0, 11, 0.4, 15, 0.2],
        },
      },
      'building-3d',
    );
    m.addLayer({
      id: 'arr-label',
      type: 'symbol',
      source: 'arrondissement-labels',
      maxzoom: 14.5,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 13,
        'text-letter-spacing': 0.2,
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': INK,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 10.5, 0, 12, 0.7],
        'text-halo-color': 'rgba(255,255,255,0.9)',
        'text-halo-width': 1.2,
      },
    });
    m.addLayer({
      id: 'route-glow',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.9 },
    });
    m.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-width': 3, 'line-color': BLUE, 'line-dasharray': [0.1, 2] },
    });
    m.addSource('legs', { type: 'geojson', data: emptyLine() });
    m.addLayer({
      id: 'leg-label',
      type: 'symbol',
      source: 'legs',
      minzoom: 11.5,
      layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-letter-spacing': 0.04 },
      paint: { 'text-color': BLUE, 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
    });
  }

  private highlight(p: Photo | null) {
    this.map.setFilter('arr-fill', ['==', ['get', 'number'], p?.arrondissement ?? -1]);
  }

  drawRoute(photos: Photo[], delay = 0) {
    this.routeTween?.kill();
    // Follow the real walking path between consecutive steps when we have it.
    const coords: LngLat[] = [];
    const labels: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };
    photos.forEach((p, i) => {
      const leg = legBetween(photos[i - 1]?.id, p.id);
      if (leg) {
        coords.push(...(leg.coordinates as LngLat[]));
        const mid = leg.coordinates[Math.floor(leg.coordinates.length / 2)];
        labels.features.push({ type: 'Feature', properties: { label: formatWalk(leg) }, geometry: { type: 'Point', coordinates: mid } });
      } else coords.push([p.lng, p.lat]);
    });
    (this.map.getSource('legs') as maplibregl.GeoJSONSource).setData(labels);
    const source = this.map.getSource('route') as maplibregl.GeoJSONSource;
    if (coords.length < 2) {
      source.setData(emptyLine());
      return;
    }
    const lengths = coords.slice(1).map((c, i) => Math.hypot(c[0] - coords[i][0], c[1] - coords[i][1]));
    const total = lengths.reduce((a, b) => a + b, 0);
    const state = { p: 0 };
    this.routeTween = gsap.to(state, {
      p: 1,
      delay,
      duration: this.opts.reducedMotion ? 0 : 1.2 * coords.length,
      ease: 'power1.inOut',
      onUpdate: () => {
        let remaining = state.p * total;
        const partial: LngLat[] = [coords[0]];
        for (let i = 0; i < lengths.length && remaining > 0; i++) {
          const t = Math.min(1, remaining / lengths[i]);
          const [a, b] = [coords[i], coords[i + 1]];
          partial.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
          remaining -= lengths[i];
        }
        if (partial.length < 2) partial.push(coords[0]);
        source.setData(line(partial));
      },
    });
  }

  clearRoute() {
    this.routeTween?.kill();
    (this.map.getSource('route') as maplibregl.GeoJSONSource | undefined)?.setData(emptyLine());
    (this.map.getSource('legs') as maplibregl.GeoJSONSource | undefined)?.setData(emptyLine());
  }
}

function line(coordinates: LngLat[]): FeatureCollection<LineString> {
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } }] };
}
function emptyLine() {
  return { type: 'FeatureCollection', features: [] } as FeatureCollection<LineString>;
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

import type { Photo } from './types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import type { GlobeMap } from './map/GlobeMap';
import { photos as allPhotos, pending, legBetween, formatWalk, walkKm, pad2, dayKey, formatCoords, formatDate } from './photos';
import { sound } from './sound';
import { Header } from './components/Header';
import { Intro } from './components/Intro';
import { ArrivalCard } from './components/ArrivalCard';
import { ArticlePanel } from './components/ArticlePanel';
import { Lightbox } from './components/Lightbox';
import { IndexGrid } from './components/IndexGrid';
import { Hud, NO_FILTERS, type Filters } from './components/Hud';

export type Phase = 'loading' | 'space' | 'descending' | 'paris' | 'ascending';

const DWELL = 17000;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reducedMotion) gsap.globalTimeline.timeScale(20);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function altitude(zoom: number, lat: number) {
  const metersPerPixel = (40075016 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
  const meters = metersPerPixel * window.innerHeight * 1.5;
  return meters > 10000 ? `${Math.round(meters / 1000).toLocaleString('en-GB')} km` : meters > 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function panelPadding() {
  if (window.innerWidth < 760) return { top: 80, right: 0, bottom: window.innerHeight * 0.58, left: 0 };
  return { top: 120, right: Math.min(620, Math.max(400, window.innerWidth * 0.44)), bottom: 120, left: 0 };
}

function dateRange() {
  const days = [...new Set(allPhotos.map((p) => dayKey(p.takenAt)))].filter((d) => d !== 'unknown').sort();
  if (!days.length) return '';
  if (days.length === 1) return formatDate(days[0], false);
  return `${formatDate(days[0], false)} – ${formatDate(days[days.length - 1], false)}`;
}

const stats = {
  photos: allPhotos.length,
  authors: new Set(allPhotos.map((p) => p.author)).size,
  arrondissements: new Set(allPhotos.map((p) => p.arrondissement).filter((n) => n)).size,
  range: dateRange(),
  pending: pending.length,
  walkKm,
};

export default function App() {
  const mapEl = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeMap | null>(null);
  const coordsRef = useRef<HTMLSpanElement>(null);
  const altRef = useRef<HTMLSpanElement>(null);
  const tourToken = useRef(0);

  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [touring, setTouring] = useState(false);
  const [tourKey, setTourKey] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [indexOpen, setIndexOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [arrivals, setArrivals] = useState(0);
  const [walking, setWalking] = useState<{ from: Photo; to: Photo; label: string } | null>(null);

  const visible = useMemo(
    () =>
      allPhotos.filter(
        (p) =>
          (!filters.author || p.author === filters.author) &&
          (!filters.arrondissement || String(p.arrondissement) === filters.arrondissement) &&
          (!filters.day || dayKey(p.takenAt) === filters.day),
      ),
    [filters],
  );
  const active = allPhotos.find((p) => p.id === activeId) ?? null;
  const position = active ? visible.findIndex((p) => p.id === active.id) : -1;

  const phaseRef = useRef(phase);
  const visibleRef = useRef(visible);
  const activeRef = useRef(activeId);
  useEffect(() => {
    phaseRef.current = phase;
    visibleRef.current = visible;
    activeRef.current = activeId;
  });

  const stopTour = useCallback(() => {
    tourToken.current++;
    setTouring(false);
  }, []);

  const select = useCallback(
    async (id: string, opts: { tour?: boolean; walk?: boolean } = {}) => {
      if (!opts.tour) stopTour();
      const photo = allPhotos.find((p) => p.id === id);
      const g = globe.current;
      if (!photo || !g) return;
      const leg = opts.walk ? legBetween(activeRef.current ?? undefined, id) : null;
      if (leg) {
        const from = allPhotos.find((p) => p.id === activeRef.current)!;
        setActiveId(null);
        g.setActive(null);
        setWalking({ from, to: photo, label: formatWalk(leg) });
        await g.walk(leg.coordinates as [number, number][]);
        setWalking(null);
      }
      setActiveId(id);
      setZoomed(false);
      g.setActive(id);
      return g.flyToPhoto(photo, panelPadding());
    },
    [stopTour],
  );
  const selectRef = useRef(select);
  useEffect(() => {
    selectRef.current = select;
  });

  const close = useCallback(() => {
    stopTour();
    setActiveId(null);
    setZoomed(false);
    globe.current?.setActive(null);
    void globe.current?.overview();
  }, [stopTour]);

  useEffect(() => {
    let cancelled = false;
    let created: GlobeMap | undefined;
    // MapLibre is loaded as a separate chunk so the page paints before the 1 MB map engine arrives.
    import('./map/GlobeMap')
      .then(({ GlobeMap }) =>
        GlobeMap.create(mapEl.current!, {
          reducedMotion,
          onSelect: (id) => void selectRef.current(id),
          onMove: (lng, lat, zoom) => {
            if (coordsRef.current) coordsRef.current.textContent = formatCoords(lat, lng, 3);
            if (altRef.current) altRef.current.textContent = `Altitude ${altitude(zoom, lat)}`;
          },
          onMarkerLand: () => sound.pop(),
        }),
      )
      .then((g) => {
        if (cancelled) return g.destroy();
        created = g;
        globe.current = g;
        g.setPhotos(allPhotos);
        g.startSpin();
        setPhase('space');
      })
      .catch((e) => setError(String(e)));
    return () => {
      cancelled = true;
      created?.destroy();
      globe.current = null;
    };
  }, []);

  const enter = useCallback(async () => {
    const g = globe.current;
    if (phaseRef.current !== 'space' || !g) return;
    setPhase('descending');
    sound.whoosh(11.5);
    await g.descend();
    setPhase('paris');
    setArrivals((n) => n + 1);
    await sleep(reducedMotion ? 0 : 1400);
    const list = visibleRef.current;
    g.showMarkers(list.map((p) => p.id));
    g.drawRoute(list, 0.8);
  }, []);

  const toSpace = useCallback(async () => {
    const g = globe.current;
    if (!g || phaseRef.current !== 'paris') return;
    stopTour();
    setActiveId(null);
    setZoomed(false);
    setPhase('ascending');
    sound.whoosh(8);
    await g.ascend();
    setPhase('space');
  }, [stopTour]);

  const pickFromIndex = useCallback(
    async (id: string) => {
      setIndexOpen(false);
      if (phaseRef.current === 'space') await enter();
      if (phaseRef.current === 'paris' || phaseRef.current === 'descending') void select(id);
    },
    [enter, select],
  );

  const step = useCallback(
    (delta: number) => {
      const list = visibleRef.current;
      const i = list.findIndex((p) => p.id === activeRef.current);
      const next = list[i + delta];
      if (next) void select(next.id, { walk: delta === 1 });
    },
    [select],
  );

  const toggleTour = useCallback(async () => {
    if (touring) return stopTour();
    const token = ++tourToken.current;
    setTouring(true);
    const list = visibleRef.current;
    let i = Math.max(0, list.findIndex((p) => p.id === activeRef.current));
    while (tourToken.current === token && i < list.length) {
      await select(list[i].id, { tour: true, walk: true });
      if (tourToken.current !== token) return;
      setTourKey((k) => k + 1);
      await sleep(DWELL);
      if (tourToken.current !== token) return;
      i++;
    }
    if (tourToken.current === token) close();
  }, [touring, stopTour, select, close]);

  // Filters: update markers + route, and close the article if its photo was filtered out.
  useEffect(() => {
    const g = globe.current;
    if (!g || phaseRef.current !== 'paris') return;
    g.showMarkers(visible.map((p) => p.id), false);
    g.drawRoute(visible);
    if (activeRef.current && !visible.some((p) => p.id === activeRef.current)) close();
  }, [visible, close]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (phaseRef.current === 'space' && !indexOpen && e.deltaY > 20) void enter();
    };
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => (touchY = e.touches[0].clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (phaseRef.current === 'space' && !indexOpen && touchY - e.touches[0].clientY > 60) void enter();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && indexOpen) return setIndexOpen(false);
      if (phaseRef.current === 'space' && (e.key === 'Enter' || e.key === 'ArrowDown')) void enter();
      if (phaseRef.current !== 'paris') return;
      if (e.key === 'Escape') {
        if (zoomed) setZoomed(false);
        else if (activeRef.current) close();
      }
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [enter, close, step, zoomed, indexOpen]);

  const toggleSound = () => {
    const next = !soundOn;
    sound.setEnabled(next);
    setSoundOn(next);
  };

  return (
    <div className={`app phase-${phase} ${active ? 'has-panel' : ''} ${indexOpen ? 'has-index' : ''}`}>
      <div ref={mapEl} className="map" />

      <Header
        phase={phase}
        stats={stats}
        touring={touring}
        indexOpen={indexOpen}
        soundOn={soundOn}
        coordsRef={coordsRef}
        altRef={altRef}
        onEnter={() => void enter()}
        onSpace={() => void toSpace()}
        onTour={() => void toggleTour()}
        onIndex={() => setIndexOpen((o) => !o)}
        onSound={toggleSound}
      />

      {(phase === 'loading' || error) && (
        <div className="loader" role="status">
          {error ? (
            <>
              Impossible de charger la carte.
              <small>{error}</small>
            </>
          ) : (
            <>
              <span className="loader-bar" />
              Chargement de Paris
            </>
          )}
        </div>
      )}

      <Intro visible={phase === 'space' && !indexOpen} stats={stats} onEnter={() => void enter()} />
      {arrivals > 0 && <ArrivalCard key={arrivals} show subtitle={`${visible.length} photographies · ${stats.arrondissements} arrondissements`} />}

      <Hud
        visible={phase === 'paris' && !indexOpen}
        photos={visible}
        allPhotos={allPhotos}
        activeId={activeId}
        filters={filters}
        onFilters={setFilters}
        onSelect={(id) => void select(id)}
      />

      <ArticlePanel
        photo={phase === 'paris' && !indexOpen ? active : null}
        position={position}
        next={position >= 0 ? visible[position + 1] ?? null : null}
        prev={position > 0 ? visible[position - 1] : null}
        total={visible.length}
        touring={touring}
        tourKey={tourKey}
        dwell={DWELL}
        onClose={close}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onZoomImage={() => {
          stopTour();
          setZoomed(true);
        }}
      />
      {walking && (
        <div className="walk-card" role="status">
          <span className="walk-eyebrow">En marche</span>
          <b>{pad2(walking.from.number)} {walking.from.title} → {pad2(walking.to.number)} {walking.to.title}</b>
          <span>{walking.label}</span>
        </div>
      )}
      <IndexGrid open={indexOpen} photos={visible} pending={pending} onPick={(id) => void pickFromIndex(id)} />
      <Lightbox photo={zoomed ? active : null} onClose={() => setZoomed(false)} />
    </div>
  );
}

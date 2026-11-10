export type LngLat = [number, number];

const RAD = Math.PI / 180;
export const dist = (a: LngLat, b: LngLat) => {
  const k = Math.cos(((a[1] + b[1]) / 2) * RAD);
  return Math.hypot((b[0] - a[0]) * k, b[1] - a[1]) * RAD * 6371000;
};

export function cumulative(c: LngLat[]) {
  const out = [0];
  for (let i = 1; i < c.length; i++) out.push(out[i - 1] + dist(c[i - 1], c[i]));
  return out;
}

// Point at distance d (metres) along a polyline, with the index of the segment it lies on.
export function pointAt(c: LngLat[], cum: number[], d: number): { here: LngLat; i: number } {
  if (c.length < 2) return { here: c[0] ?? [2.3488, 48.8534], i: 0 };
  const t = Math.max(0, Math.min(cum[cum.length - 1], d));
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= t) lo = m; else hi = m; }
  const f = cum[hi] > cum[lo] ? (t - cum[lo]) / (cum[hi] - cum[lo]) : 0;
  return { here: [c[lo][0] + (c[hi][0] - c[lo][0]) * f, c[lo][1] + (c[hi][1] - c[lo][1]) * f], i: lo };
}

export function inRing(p: LngLat, ring: LngLat[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Smooth curve through points (Catmull-Rom), used to draw the arrondissement snail.
export function smooth(pts: LngLat[], n = 10): LngLat[] {
  const out: LngLat[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[Math.max(0, i - 1)], pts[i], pts[i + 1], pts[Math.min(pts.length - 1, i + 2)]];
    for (let s = 0; s < n; s++) {
      const t = s / n, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

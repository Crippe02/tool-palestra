import type { SeriesPoint } from '../domain/dashboard';

/** Grafico a linea in SVG, senza librerie. */
export function HistoryChart({ title, points, format }: { title: string; points: SeriesPoint[]; format: (y: number) => string }) {
  if (points.length < 2) return <p className="muted">Servono almeno due valori per il grafico.</p>;
  const W = 320, H = 140, P = 12;
  const ys = points.map((p) => p.y);
  const min = Math.min(...ys), max = Math.max(...ys);
  const span = max - min || 1;
  const x = (i: number) => P + (i * (W - 2 * P)) / (points.length - 1);
  const y = (v: number) => H - P - ((v - min) * (H - 2 * P)) / span;
  const line = points.map((p, i) => `${x(i)},${y(p.y)}`).join(' ');
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} nel tempo: da ${format(points[0].y)} a ${format(points[points.length - 1].y)}`}>
        <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
        {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.y)} r="3.5" fill="var(--accent)" />)}
      </svg>
      <figcaption className="chart-axis">
        <span>{points[0].x}: <b>{format(points[0].y)}</b></span>
        <span>{points[points.length - 1].x}: <b>{format(points[points.length - 1].y)}</b></span>
      </figcaption>
    </figure>
  );
}

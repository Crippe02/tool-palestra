const MINUS = '−';

export function formatNumber(n: number, maxDigits = 1, minDigits = 0): string {
  return n.toLocaleString('it-IT', { maximumFractionDigits: maxDigits, minimumFractionDigits: minDigits });
}

function signed(n: number, body: string): string {
  if (n > 0) return `+${body}`;
  if (n < 0) return `${MINUS}${body}`;
  return body;
}

/** -3.17 → "−3,2%", 12 → "+12%" */
export function formatPercent(n: number): string {
  const r = Math.round(n * 10) / 10;
  return signed(r, `${formatNumber(Math.abs(r))}%`);
}

/** 1660 → "27:40", 3750 → "1:02:30" */
export function formatTime(s: number): string {
  const total = Math.round(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** -150 → "−2:30" */
export function formatTimeDiff(s: number): string {
  return signed(Math.round(s), formatTime(Math.abs(s)));
}

/** "27:40" → 1660, "1:02:30" → 3750, testo non valido → null */
export function parseDuration(t: string): number | null {
  const m = t.trim().match(/^(\d+):([0-5]\d)(?::([0-5]\d))?$/);
  if (!m) return null;
  return m[3] != null ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : Number(m[1]) * 60 + Number(m[2]);
}

/** 376 → "6:16/km" */
export function formatPace(sPerKm: number): string {
  return `${formatTime(sPerKm)}/km`;
}

export function formatSigned(n: number, unit: string): string {
  return signed(n, `${formatNumber(Math.abs(n))} ${unit}`);
}

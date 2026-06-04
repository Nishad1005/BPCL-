// lib/period.ts
// Pure date math; no TZ assumptions beyond what KPI's report_date uses
// (UTC date slice — matches WP2's report_date convention exactly).
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'visit_based';

export function periodStartFor(freq: Frequency, asOf: Date): string {
  if (freq === 'visit_based') {
    throw new Error('visit_based has no calendar period (set via nso_visit_id, lands with M3)');
  }
  const d = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  if (freq === 'daily') return d.toISOString().slice(0, 10);
  if (freq === 'monthly') {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
  }
  // weekly → ISO Monday (UTC)
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

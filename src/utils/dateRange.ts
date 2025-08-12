export function dayToUtcRange(localYYYYMMDD: string): { since: string; until: string } {
  const [y,m,d] = localYYYYMMDD.split('-').map(Number);
  // Create dates in local timezone, then convert to UTC
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end   = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { since: start.toISOString(), until: end.toISOString() };
}

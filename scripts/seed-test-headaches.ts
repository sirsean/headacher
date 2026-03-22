#!/usr/bin/env tsx
/**
 * seed-test-headaches.ts
 *
 * Generates sample headaches (dense) and events (sparse) for local development.
 *
 * ⚠️  LOCAL ONLY — uses --local; writes under .wrangler/state/v3/d1/
 * ⚠️  Does not touch production D1
 *
 * Requires at least one row in users_v2 (sign in once via the app).
 *
 * Re-running appends more rows; it does not clear headaches or events.
 *
 * Usage: npm run db:seed-test
 */

import { execSync } from 'child_process'

const DATABASE_NAME = 'headacher-production'
const DAYS_TO_GENERATE = 90

// --- Headaches ---
const SEVERITY_DISTRIBUTION = {
  mild: { min: 1, max: 3, probability: 0.1 },
  moderate: { min: 4, max: 7, probability: 0.7 },
  severe: { min: 8, max: 10, probability: 0.2 },
}

const AURA_PROBABILITY = 0.2
const MAX_HEADACHES_PER_DAY = 2
const ZERO_HEADACHE_DAY_PROBABILITY = 0.05

// --- Events: 1–4 per rolling 7-day window, sparser than headaches ---
const EVENTS_MIN_PER_WEEK = 1
const EVENTS_MAX_PER_WEEK = 4

/** event_type → pool of values we reuse (realistic repetition) */
const EVENT_POOLS: Record<string, string[]> = {
  medication: [
    'ibuprofen 400mg',
    'sumatriptan 50mg',
    'acetaminophen 500mg',
    'rizatriptan 10mg',
    'excedrin',
    'naproxen 220mg',
  ],
  sleep: ['slept 9h', 'poor sleep', 'nap 30 minutes', 'insomnia', 'woke up early'],
  trigger: ['skipped lunch', 'bright light', 'stress', 'weather change', 'strong perfume'],
  note: ['felt better after rest', 'skipped workout', 'work from home', 'hydrated more'],
}

const EVENT_TYPE_WEIGHTS: { type: string; weight: number }[] = [
  { type: 'medication', weight: 0.38 },
  { type: 'sleep', weight: 0.22 },
  { type: 'trigger', weight: 0.22 },
  { type: 'note', weight: 0.18 },
]

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function sqlEscape(str: string): string {
  return str.replace(/'/g, "''")
}

function pickWeightedEventType(): string {
  const r = Math.random()
  let acc = 0
  for (const { type, weight } of EVENT_TYPE_WEIGHTS) {
    acc += weight
    if (r < acc) return type
  }
  return EVENT_TYPE_WEIGHTS[EVENT_TYPE_WEIGHTS.length - 1].type
}

function pickEventValue(eventType: string): string {
  const pool = EVENT_POOLS[eventType] ?? ['(unknown)']
  return pool[randomInt(0, pool.length - 1)]
}

function generateSeverity(): number {
  const rand = Math.random()
  if (rand < SEVERITY_DISTRIBUTION.mild.probability) {
    return randomInt(SEVERITY_DISTRIBUTION.mild.min, SEVERITY_DISTRIBUTION.mild.max)
  }
  if (rand < SEVERITY_DISTRIBUTION.mild.probability + SEVERITY_DISTRIBUTION.moderate.probability) {
    return randomInt(SEVERITY_DISTRIBUTION.moderate.min, SEVERITY_DISTRIBUTION.moderate.max)
  }
  return randomInt(SEVERITY_DISTRIBUTION.severe.min, SEVERITY_DISTRIBUTION.severe.max)
}

function generateAura(): number {
  return Math.random() < AURA_PROBABILITY ? 1 : 0
}

function generateRandomTimestampUtc(year: number, month: number, day: number): string {
  const hour = randomInt(0, 23)
  const minute = randomInt(0, 59)
  const second = randomInt(0, 59)
  return new Date(Date.UTC(year, month, day, hour, minute, second)).toISOString()
}

function getUserId(): string {
  console.log('📡 Fetching user ID from local database...')

  try {
    const result = execSync(
      `wrangler d1 execute ${DATABASE_NAME} --command "SELECT id FROM users_v2 LIMIT 1;" --local --json`,
      { encoding: 'utf-8' },
    )

    const parsed = JSON.parse(result) as Array<{ results?: Array<{ id: string }> }>

    if (parsed?.[0]?.results?.[0]?.id) {
      const userId = parsed[0].results[0].id
      console.log(`✅ Found user ID: ${userId}\n`)
      return userId
    }

    throw new Error('No user found in local database')
  } catch (error) {
    console.error('❌ Error fetching user ID:', error)
    console.error('💡 Run migrations and sign in once so users_v2 has a row.')
    process.exit(1)
  }
}

function generateHeadacheEntries(days: number): Array<{ timestamp: string; severity: number; aura: number }> {
  const entries: Array<{ timestamp: string; severity: number; aura: number }> = []
  const now = new Date()

  console.log(`🎲 Generating headache entries for the last ${days} days...`)

  for (let daysAgo = 0; daysAgo < days; daysAgo++) {
    const date = new Date(now)
    date.setDate(date.getDate() - daysAgo)

    const numEntries =
      Math.random() < ZERO_HEADACHE_DAY_PROBABILITY ? 0 : randomInt(1, MAX_HEADACHES_PER_DAY)

    for (let i = 0; i < numEntries; i++) {
      entries.push({
        timestamp: generateRandomTimestampUtc(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate(),
        ),
        severity: generateSeverity(),
        aura: generateAura(),
      })
    }
  }

  entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  return entries
}

/**
 * Rolling 7-day windows from (now - days) to now; each week gets 1–4 events at random instants.
 */
function generateEventEntries(days: number): Array<{ timestamp: string; event_type: string; value: string }> {
  const entries: Array<{ timestamp: string; event_type: string; value: string }> = []
  const now = new Date()
  const horizonStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

  console.log(`🎲 Generating sparse events (${EVENTS_MIN_PER_WEEK}–${EVENTS_MAX_PER_WEEK} per week) for the last ${days} days...`)

  let weekStart = new Date(horizonStart)
  while (weekStart < now) {
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
    const spanEnd = weekEnd < now ? weekEnd : now
    const count = randomInt(EVENTS_MIN_PER_WEEK, EVENTS_MAX_PER_WEEK)

    for (let i = 0; i < count; i++) {
      const t0 = weekStart.getTime()
      const t1 = spanEnd.getTime()
      if (t1 <= t0) break
      const ts = new Date(t0 + Math.random() * (t1 - t0))
      const eventType = pickWeightedEventType()
      entries.push({
        timestamp: ts.toISOString(),
        event_type: eventType,
        value: pickEventValue(eventType),
      })
    }

    weekStart = weekEnd
  }

  entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  return entries
}

function buildHeadachesInsertSQL(userId: string, rows: Array<{ timestamp: string; severity: number; aura: number }>): string {
  const uid = sqlEscape(userId)
  const values = rows
    .map((e) => `('${e.timestamp}', ${e.severity}, ${e.aura}, '${uid}')`)
    .join(', ')
  return `INSERT INTO headaches (timestamp, severity, aura, user_id) VALUES ${values};`
}

function buildEventsInsertSQL(
  userId: string,
  rows: Array<{ timestamp: string; event_type: string; value: string }>,
): string {
  const uid = sqlEscape(userId)
  const values = rows
    .map(
      (e) =>
        `('${e.timestamp}', '${sqlEscape(e.event_type)}', '${sqlEscape(e.value)}', '${uid}')`,
    )
    .join(', ')
  return `INSERT INTO events (timestamp, event_type, value, user_id) VALUES ${values};`
}

function executeBatched<T>(
  label: string,
  buildSql: (batch: T[]) => string,
  rows: T[],
  batchSize: number,
): void {
  const batches: T[][] = []
  for (let i = 0; i < rows.length; i += batchSize) {
    batches.push(rows.slice(i, i + batchSize))
  }

  console.log(`\n📝 ${label}: inserting ${rows.length} row(s) in ${batches.length} batch(es)...`)

  for (let i = 0; i < batches.length; i++) {
    const sql = buildSql(batches[i])
    execSync(`wrangler d1 execute ${DATABASE_NAME} --local --command "${sql}"`, { encoding: 'utf-8' })
    process.stdout.write(`\r${label}: batch ${i + 1}/${batches.length}`)
  }
  console.log('')
}

function printHeadacheSummary(entries: Array<{ timestamp: string; severity: number; aura: number }>): void {
  if (entries.length === 0) return
  const withAura = entries.filter((e) => e.aura === 1).length
  const avgSeverity = entries.reduce((sum, e) => sum + e.severity, 0) / entries.length
  const severityDistribution = {
    mild: entries.filter((e) => e.severity >= 1 && e.severity <= 3).length,
    moderate: entries.filter((e) => e.severity >= 4 && e.severity <= 7).length,
    severe: entries.filter((e) => e.severity >= 8 && e.severity <= 10).length,
  }

  console.log('\n📊 Headaches')
  console.log('═══════════════════════════════════════')
  console.log(`Total: ${entries.length}`)
  console.log(`Range: ${entries[0].timestamp.split('T')[0]} → ${entries[entries.length - 1].timestamp.split('T')[0]}`)
  console.log(`Avg severity: ${avgSeverity.toFixed(2)}`)
  console.log(`Mild / moderate / severe: ${severityDistribution.mild} / ${severityDistribution.moderate} / ${severityDistribution.severe}`)
  console.log(`With aura: ${withAura} (${((withAura / entries.length) * 100).toFixed(1)}%)`)
  console.log('═══════════════════════════════════════\n')
}

function printEventSummary(entries: Array<{ timestamp: string; event_type: string; value: string }>): void {
  if (entries.length === 0) return
  const byType = new Map<string, number>()
  for (const e of entries) {
    byType.set(e.event_type, (byType.get(e.event_type) ?? 0) + 1)
  }

  console.log('📊 Events')
  console.log('═══════════════════════════════════════')
  console.log(`Total: ${entries.length}`)
  console.log(`Range: ${entries[0].timestamp.split('T')[0]} → ${entries[entries.length - 1].timestamp.split('T')[0]}`)
  console.log('By type:')
  for (const [type, n] of [...byType.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${type}: ${n}`)
  }
  console.log('═══════════════════════════════════════\n')
}

function main(): void {
  console.log('\n╔═══════════════════════════════════════════════════════════╗')
  console.log('║      🧪 HEADACHER DEV SEED — headaches + events 🧪       ║')
  console.log('║  LOCAL D1 only (.wrangler/state/v3/d1/)                  ║')
  console.log('╚═══════════════════════════════════════════════════════════╝\n')

  const userId = getUserId()
  const headaches = generateHeadacheEntries(DAYS_TO_GENERATE)
  const events = generateEventEntries(DAYS_TO_GENERATE)

  if (headaches.length === 0 && events.length === 0) {
    console.log('⚠️  Nothing generated. Try running again.\n')
    return
  }

  if (headaches.length > 0) printHeadacheSummary(headaches)
  if (events.length > 0) printEventSummary(events)

  console.log('⚠️  Writing to LOCAL database only.\n')

  if (headaches.length > 0) {
    executeBatched('Headaches', (batch) => buildHeadachesInsertSQL(userId, batch), headaches, 20)
  }
  if (events.length > 0) {
    executeBatched('Events', (batch) => buildEventsInsertSQL(userId, batch), events, 20)
  }

  console.log('\n✅ Done. Run npm run dev and open the dashboard.\n')
}

main()

#!/usr/bin/env tsx
/**
 * seed-test-headaches.ts
 * 
 * Generates realistic test headache data for the last 90 days in the LOCAL development database.
 * 
 * ⚠️  LOCAL ONLY - This script uses the --local flag to write to .wrangler/state/v3/d1/
 * ⚠️  It will NOT affect the production Cloudflare D1 database
 * 
 * Usage: npm run db:seed-test
 */

import { execSync } from 'child_process';

const DATABASE_NAME = 'headacher-production';
const DAYS_TO_GENERATE = 90;

// Distribution settings
const SEVERITY_DISTRIBUTION = {
  mild: { min: 1, max: 3, probability: 0.10 },      // 10% mild (1-3)
  moderate: { min: 4, max: 7, probability: 0.70 },  // 70% moderate (4-7)
  severe: { min: 8, max: 10, probability: 0.20 },   // 20% severe (8-10)
};

const AURA_PROBABILITY = 0.20; // 20% chance of aura
const MAX_ENTRIES_PER_DAY = 2; // 0-2 random entries per day
const ZERO_ENTRIES_PROBABILITY = 0.05; // 5% chance of no headaches on a given day

/**
 * Generate a random integer between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate severity value based on distribution
 */
function generateSeverity(): number {
  const rand = Math.random();
  
  if (rand < SEVERITY_DISTRIBUTION.mild.probability) {
    return randomInt(SEVERITY_DISTRIBUTION.mild.min, SEVERITY_DISTRIBUTION.mild.max);
  } else if (rand < SEVERITY_DISTRIBUTION.mild.probability + SEVERITY_DISTRIBUTION.moderate.probability) {
    return randomInt(SEVERITY_DISTRIBUTION.moderate.min, SEVERITY_DISTRIBUTION.moderate.max);
  } else {
    return randomInt(SEVERITY_DISTRIBUTION.severe.min, SEVERITY_DISTRIBUTION.severe.max);
  }
}

/**
 * Generate aura value (0 or 1)
 */
function generateAura(): number {
  return Math.random() < AURA_PROBABILITY ? 1 : 0;
}

/**
 * Format date as ISO-8601 UTC timestamp
 */
function formatTimestamp(date: Date): string {
  return date.toISOString();
}

/**
 * Generate a random timestamp for a given day
 */
function generateRandomTimestamp(year: number, month: number, day: number): string {
  const hour = randomInt(0, 23);
  const minute = randomInt(0, 59);
  const second = randomInt(0, 59);
  
  const date = new Date(Date.UTC(year, month, day, hour, minute, second));
  return formatTimestamp(date);
}

/**
 * Fetch the first user ID from the local database
 */
function getUserId(): string {
  console.log('📡 Fetching user ID from local database...');
  
  try {
    const result = execSync(
      `wrangler d1 execute ${DATABASE_NAME} --command "SELECT id FROM users_v2 LIMIT 1;" --local --json`,
      { encoding: 'utf-8' }
    );
    
    const parsed = JSON.parse(result);
    
    // Wrangler JSON output structure: array of result objects
    if (parsed && parsed.length > 0 && parsed[0].results && parsed[0].results.length > 0) {
      const userId = parsed[0].results[0].id;
      console.log(`✅ Found user ID: ${userId}\n`);
      return userId;
    }
    
    throw new Error('No user found in local database');
  } catch (error) {
    console.error('❌ Error fetching user ID:', error);
    console.error('💡 Make sure you have run migrations and have at least one user in the local database');
    process.exit(1);
  }
}

/**
 * Generate headache entries for the specified number of days
 */
function generateHeadacheEntries(userId: string, days: number): Array<{ timestamp: string; severity: number; aura: number }> {
  const entries: Array<{ timestamp: string; severity: number; aura: number }> = [];
  const now = new Date();
  
  console.log(`🎲 Generating headache entries for the last ${days} days...`);
  
  for (let daysAgo = 0; daysAgo < days; daysAgo++) {
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    
    // Random number of entries for this day (1-2, or 0 with 5% probability)
    const numEntries = Math.random() < ZERO_ENTRIES_PROBABILITY 
      ? 0 
      : randomInt(1, MAX_ENTRIES_PER_DAY);
    
    for (let i = 0; i < numEntries; i++) {
      const timestamp = generateRandomTimestamp(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate()
      );
      const severity = generateSeverity();
      const aura = generateAura();
      
      entries.push({ timestamp, severity, aura });
    }
  }
  
  // Sort by timestamp ascending (oldest first)
  entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  return entries;
}

/**
 * Build SQL INSERT statements
 */
function buildInsertSQL(userId: string, entries: Array<{ timestamp: string; severity: number; aura: number }>): string {
  const values = entries.map(entry => 
    `('${entry.timestamp}', ${entry.severity}, ${entry.aura}, '${userId}')`
  ).join(', ');
  
  return `INSERT INTO headaches (timestamp, severity, aura, user_id) VALUES ${values};`;
}

/**
 * Execute the SQL against the local database in batches
 */
function executeSQL(userId: string, entries: Array<{ timestamp: string; severity: number; aura: number }>): void {
  console.log('\n📝 Executing SQL against LOCAL database...');
  console.log('⚠️  Using --local flag - this will NOT affect production!\n');
  
  const BATCH_SIZE = 20; // Insert 20 records at a time
  const batches = [];
  
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    batches.push(entries.slice(i, i + BATCH_SIZE));
  }
  
  console.log(`Inserting ${entries.length} entries in ${batches.length} batches...`);
  
  try {
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const sql = buildInsertSQL(userId, batch);
      
      execSync(
        `wrangler d1 execute ${DATABASE_NAME} --local --command "${sql}"`,
        { encoding: 'utf-8' }
      );
      
      process.stdout.write(`\rBatch ${i + 1}/${batches.length} completed`);
    }
    
    console.log('\n\n✅ Successfully inserted test data into LOCAL database');
  } catch (error) {
    console.error('\n❌ Error executing SQL:', error);
    process.exit(1);
  }
}

/**
 * Print summary statistics
 */
function printSummary(entries: Array<{ timestamp: string; severity: number; aura: number }>): void {
  const totalEntries = entries.length;
  const withAura = entries.filter(e => e.aura === 1).length;
  const avgSeverity = entries.reduce((sum, e) => sum + e.severity, 0) / totalEntries;
  
  const severityDistribution = {
    mild: entries.filter(e => e.severity >= 1 && e.severity <= 3).length,
    moderate: entries.filter(e => e.severity >= 4 && e.severity <= 7).length,
    severe: entries.filter(e => e.severity >= 8 && e.severity <= 10).length,
  };
  
  const firstDate = entries.length > 0 ? entries[0].timestamp.split('T')[0] : 'N/A';
  const lastDate = entries.length > 0 ? entries[entries.length - 1].timestamp.split('T')[0] : 'N/A';
  
  console.log('\n📊 Summary Statistics:');
  console.log('═══════════════════════════════════════');
  console.log(`Total entries generated: ${totalEntries}`);
  console.log(`Date range: ${firstDate} to ${lastDate}`);
  console.log(`Average severity: ${avgSeverity.toFixed(2)}`);
  console.log(`\nSeverity distribution:`);
  console.log(`  Mild (1-3):     ${severityDistribution.mild} (${(severityDistribution.mild / totalEntries * 100).toFixed(1)}%)`);
  console.log(`  Moderate (4-7): ${severityDistribution.moderate} (${(severityDistribution.moderate / totalEntries * 100).toFixed(1)}%)`);
  console.log(`  Severe (8-10):  ${severityDistribution.severe} (${(severityDistribution.severe / totalEntries * 100).toFixed(1)}%)`);
  console.log(`\nWith aura: ${withAura} (${(withAura / totalEntries * 100).toFixed(1)}%)`);
  console.log('═══════════════════════════════════════\n');
}

/**
 * Main execution
 */
function main(): void {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║      🧪 HEADACHER TEST DATA GENERATOR - LOCAL ONLY 🧪     ║');
  console.log('║                                                           ║');
  console.log('║  ⚠️  This script writes to your LOCAL development DB      ║');
  console.log('║  ⚠️  Location: .wrangler/state/v3/d1/                     ║');
  console.log('║  ⚠️  Production database will NOT be affected             ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  const userId = getUserId();
  const entries = generateHeadacheEntries(userId, DAYS_TO_GENERATE);
  
  if (entries.length === 0) {
    console.log('⚠️  No entries were generated (this can happen randomly with 0-2 entries per day)');
    console.log('💡 Try running the script again to generate different results\n');
    return;
  }
  
  printSummary(entries);
  
  executeSQL(userId, entries);
  
  console.log('\n🎉 Done! You can now test your charts with this data.');
  console.log('💡 To verify: npm run dev and navigate to your dashboard\n');
}

// Run the script
main();

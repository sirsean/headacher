import { describe, it, expect, beforeEach } from 'vitest';

// Mock D1 database interface for smoke tests
interface MockRow {
  id: number;
  timestamp: string;
  severity?: number;
  aura?: number;
  event_type?: string;
  value?: string;
  user_id: string;
}

interface MockD1Database {
  prepare: (sql: string) => {
    bind: (...params: unknown[]) => {
      first: () => Promise<MockRow | null>;
      all: () => Promise<{ results: MockRow[] }>;
      run: () => Promise<{ meta: { last_row_id: number; changes: number } }>;
    };
  };
}

// Create a simplified mock database for smoke tests
const createSmokeTestDB = (): MockD1Database => {
  const mockData = {
    headaches: new Map<number, MockRow>(),
    events: new Map<number, MockRow>(),
    users: new Set<string>()
  };

  let nextId = 1;

  return {
    prepare: (sql: string) => ({
      bind: (...params: unknown[]) => ({
        first: async () => {
          if (sql.includes('SELECT * FROM headaches WHERE id = ? AND user_id = ?')) {
            const [id, userId] = params;
            const headache = mockData.headaches.get(id);
            return headache && headache.user_id === userId ? headache : null;
          }
          if (sql.includes('SELECT * FROM events WHERE id = ? AND user_id = ?')) {
            const [id, userId] = params;
            const event = mockData.events.get(id);
            return event && event.user_id === userId ? event : null;
          }
          return null;
        },
        all: async () => {
          const results: MockRow[] = [];
          
          if (sql.includes('SELECT * FROM headaches') && sql.includes('user_id = ?')) {
            // For headaches list queries, user_id is typically the last or second-to-last parameter
            // depending on whether LIMIT/OFFSET are present
            let userId;
            if (sql.includes('LIMIT ? OFFSET ?')) {
              // user_id, limit, offset
              userId = params[params.length - 3];
            } else if (sql.includes('LIMIT ?')) {
              // user_id, limit  
              userId = params[params.length - 2];
            } else {
              // just user_id
              userId = params[params.length - 1];
            }
            
            for (const [, headache] of mockData.headaches) {
              if (headache.user_id === userId) {
                // Apply date filtering if present
                if (sql.includes('timestamp >= ?') && sql.includes('timestamp <= ?')) {
                  const headacheTimestamp = new Date(headache.timestamp);
                  const startTime = new Date(params[0]);
                  const endTime = new Date(params[1]);
                  if (headacheTimestamp >= startTime && headacheTimestamp <= endTime) {
                    results.push(headache);
                  }
                } else {
                  results.push(headache);
                }
              }
            }
            // Sort by timestamp DESC for realistic behavior
            results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            
            // Apply LIMIT and OFFSET if present
            if (sql.includes('LIMIT ? OFFSET ?')) {
              const limit = params[params.length - 2];
              const offset = params[params.length - 1];
              return { results: results.slice(offset, offset + limit) };
            } else if (sql.includes('LIMIT ?')) {
              const limit = params[params.length - 1];
              return { results: results.slice(0, limit) };
            }
          }
          
          if (sql.includes('SELECT * FROM events') && sql.includes('user_id = ?')) {
            // For events list queries, user_id is typically the last or second-to-last parameter
            let userId;
            if (sql.includes('LIMIT ? OFFSET ?')) {
              // user_id, limit, offset
              userId = params[params.length - 3];
            } else if (sql.includes('LIMIT ?')) {
              // user_id, limit  
              userId = params[params.length - 2];
            } else {
              // just user_id
              userId = params[params.length - 1];
            }
            
            for (const [, event] of mockData.events) {
              if (event.user_id === userId) {
                // Apply date filtering if present
                if (sql.includes('timestamp >= ?') && sql.includes('timestamp <= ?')) {
                  const eventTimestamp = new Date(event.timestamp);
                  const startTime = new Date(params[0]);
                  const endTime = new Date(params[1]);
                  if (eventTimestamp >= startTime && eventTimestamp <= endTime) {
                    results.push(event);
                  }
                } else {
                  results.push(event);
                }
              }
            }
            results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            
            // Apply LIMIT and OFFSET if present
            if (sql.includes('LIMIT ? OFFSET ?')) {
              const limit = params[params.length - 2];
              const offset = params[params.length - 1];
              return { results: results.slice(offset, offset + limit) };
            } else if (sql.includes('LIMIT ?')) {
              const limit = params[params.length - 1];
              return { results: results.slice(0, limit) };
            }
          }
          
          // Handle dashboard queries
          if (sql.includes('SELECT timestamp, severity, aura FROM headaches')) {
            const userId = params[params.length - 1] as string;
            for (const [, headache] of mockData.headaches) {
              if (headache.user_id === userId) {
                const headacheTimestamp = new Date(headache.timestamp);
                const startTime = new Date(params[0]);
                const endTime = new Date(params[1]);
                if (headacheTimestamp >= startTime && headacheTimestamp <= endTime) {
                  results.push({
                    timestamp: headache.timestamp,
                    severity: headache.severity,
                    aura: headache.aura
                  });
                }
              }
            }
          }
          
          if (sql.includes('SELECT event_type, value, timestamp FROM events')) {
            const userId = params[params.length - 1] as string;
            for (const [, event] of mockData.events) {
              if (event.user_id === userId) {
                const eventTimestamp = new Date(event.timestamp);
                const startTime = new Date(params[0]);
                const endTime = new Date(params[1]);
                if (eventTimestamp >= startTime && eventTimestamp <= endTime) {
                  results.push({
                    event_type: event.event_type,
                    value: event.value,
                    timestamp: event.timestamp
                  });
                }
              }
            }
          }
          
          return { results };
        },
        run: async () => {
          if (sql.startsWith('INSERT INTO headaches')) {
            const id = nextId++;
            const [timestamp, severity, aura, userId] = params;
            const headache = { id, timestamp, severity, aura, user_id: userId };
            mockData.headaches.set(id, headache);
            return { meta: { last_row_id: id, changes: 1 } };
          }
          
          if (sql.startsWith('INSERT INTO events')) {
            const id = nextId++;
            const [timestamp, event_type, value, userId] = params;
            const event = { id, timestamp, event_type, value, user_id: userId };
            mockData.events.set(id, event);
            return { meta: { last_row_id: id, changes: 1 } };
          }
          
          if (sql.startsWith('INSERT OR IGNORE INTO users')) {
            const [address] = params;
            const hadUser = mockData.users.has(address);
            mockData.users.add(address);
            return { meta: { last_row_id: 0, changes: hadUser ? 0 : 1 } };
          }
          
          if (sql.startsWith('UPDATE') && sql.includes('user_id = ?')) {
            const userId = params[params.length - 1];
            const id = params[params.length - 2];
            
            if (sql.includes('headaches')) {
              const headache = mockData.headaches.get(id);
              if (headache && headache.user_id === userId) {
                // Simulate update
                if (sql.includes('severity = ?')) {
                  headache.severity = params[0];
                }
                if (sql.includes('aura = ?')) {
                  const auraIndex = sql.indexOf('aura = ?') > sql.indexOf('severity = ?') ? 1 : 0;
                  headache.aura = params[auraIndex];
                }
                return { meta: { last_row_id: id, changes: 1 } };
              }
            }
            
            if (sql.includes('events')) {
              const event = mockData.events.get(id);
              if (event && event.user_id === userId) {
                if (sql.includes('value = ?')) {
                  event.value = params[0];
                }
                if (sql.includes('event_type = ?')) {
                  event.event_type = params[0];
                }
                return { meta: { last_row_id: id, changes: 1 } };
              }
            }
            
            return { meta: { last_row_id: 0, changes: 0 } };
          }
          
          if (sql.startsWith('DELETE') && sql.includes('user_id = ?')) {
            const userId = params[params.length - 1];
            const id = params[params.length - 2];
            
            if (sql.includes('headaches')) {
              const headache = mockData.headaches.get(id);
              if (headache && headache.user_id === userId) {
                mockData.headaches.delete(id);
                return { meta: { last_row_id: 0, changes: 1 } };
              }
            }
            
            if (sql.includes('events')) {
              const event = mockData.events.get(id);
              if (event && event.user_id === userId) {
                mockData.events.delete(id);
                return { meta: { last_row_id: 0, changes: 1 } };
              }
            }
            
            return { meta: { last_row_id: 0, changes: 0 } };
          }
          
          return { meta: { last_row_id: 0, changes: 0 } };
        }
      })
    })
  };
};

describe('Smoke Tests - Basic Create/List Flows', () => {
  const testUser = '0x1234567890123456789012345678901234567890';
  let mockDB: MockD1Database;

  beforeEach(() => {
    mockDB = createSmokeTestDB();
  });

  describe('Headache Basic CRUD Operations', () => {
    it('should create a new headache successfully', async () => {
      const timestamp = '2024-01-15T10:30:00Z';
      const severity = 7;
      const aura = 1;

      const result = await mockDB.prepare('INSERT INTO headaches (timestamp, severity, aura, user_id) VALUES (?, ?, ?, ?)')
        .bind(timestamp, severity, aura, testUser).run();

      expect(result.meta.changes).toBe(1);
      expect(result.meta.last_row_id).toBeGreaterThan(0);
    });

    it('should list headaches for a user', async () => {
      // Create test data
      await mockDB.prepare('INSERT INTO headaches (timestamp, severity, aura, user_id) VALUES (?, ?, ?, ?)')
        .bind('2024-01-15T10:00:00Z', 6, 0, testUser).run();
      await mockDB.prepare('INSERT INTO headaches (timestamp, severity, aura, user_id) VALUES (?, ?, ?, ?)')
        .bind('2024-01-15T12:00:00Z', 8, 1, testUser).run();

      const result = await mockDB.prepare('SELECT * FROM headaches WHERE user_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?')
        .bind(testUser, 50, 0).all();

      expect(result.results).toHaveLength(2);
      expect(result.results[0].severity).toBe(8); // Most recent first
      expect(result.results[1].severity).toBe(6);
      expect(result.results[0].user_id).toBe(testUser);
      expect(result.results[1].user_id).toBe(testUser);
    });

    it('should retrieve a specific headache by ID', async () => {
      const createResult = await mockDB.prepare('INSERT INTO headaches (timestamp, severity, aura, user_id) VALUES (?, ?, ?, ?)')
        .bind('2024-01-15T10:00:00Z', 5, 0, testUser).run();
      
      const headacheId = createResult.meta.last_row_id;

      const result = await mockDB.prepare('SELECT * FROM headaches WHERE id = ? AND user_id = ?')
        .bind(headacheId, testUser).first();

      expect(result).not.toBeNull();
      expect(result.id).toBe(headacheId);
      expect(result.severity).toBe(5);
      expect(result.aura).toBe(0);
      expect(result.user_id).toBe(testUser);
    });

    it('should update a headache successfully', async () => {
      const createResult = await mockDB.prepare('INSERT INTO headaches (timestamp, severity, aura, user_id) VALUES (?, ?, ?, ?)')
        .bind('2024-01-15T10:00:00Z', 5, 0, testUser).run();
      
      const headacheId = createResult.meta.last_row_id;

      const updateResult = await mockDB.prepare('UPDATE headaches SET severity = ?, aura = ? WHERE id = ? AND user_id = ?')
        .bind(8, 1, headacheId, testUser).run();

      expect(updateResult.meta.changes).toBe(1);

      const updatedRecord = await mockDB.prepare('SELECT * FROM headaches WHERE id = ? AND user_id = ?')
        .bind(headacheId, testUser).first();

      expect(updatedRecord.severity).toBe(8);
      expect(updatedRecord.aura).toBe(1);
    });

    it('should delete a headache successfully', async () => {
      const createResult = await mockDB.prepare('INSERT INTO headaches (timestamp, severity, aura, user_id) VALUES (?, ?, ?, ?)')
        .bind('2024-01-15T10:00:00Z', 5, 0, testUser).run();
      
      const headacheId = createResult.meta.last_row_id;

      const deleteResult = await mockDB.prepare('DELETE FROM headaches WHERE id = ? AND user_id = ?')
        .bind(headacheId, testUser).run();

      expect(deleteResult.meta.changes).toBe(1);

      const deletedRecord = await mockDB.prepare('SELECT * FROM headaches WHERE id = ? AND user_id = ?')
        .bind(headacheId, testUser).first();

      expect(deletedRecord).toBeNull();
    });
  });

  describe('Event Basic CRUD Operations', () => {
    it('should create a new event successfully', async () => {
      const timestamp = '2024-01-15T11:00:00Z';
      const eventType = 'medication';
      const value = 'ibuprofen 400mg';

      const result = await mockDB.prepare('INSERT INTO events (timestamp, event_type, value, user_id) VALUES (?, ?, ?, ?)')
        .bind(timestamp, eventType, value, testUser).run();

      expect(result.meta.changes).toBe(1);
      expect(result.meta.last_row_id).toBeGreaterThan(0);
    });

    it('should list events for a user', async () => {
      // Create test data
      await mockDB.prepare('INSERT INTO events (timestamp, event_type, value, user_id) VALUES (?, ?, ?, ?)')
        .bind('2024-01-15T09:00:00Z', 'trigger', 'stress', testUser).run();
      await mockDB.prepare('INSERT INTO events (timestamp, event_type, value, user_id) VALUES (?, ?, ?, ?)')
        .bind('2024-01-15T11:00:00Z', 'medication', 'aspirin', testUser).run();

      const result = await mockDB.prepare('SELECT * FROM events WHERE user_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?')
        .bind(testUser, 50, 0).all();

      expect(result.results).toHaveLength(2);
      expect(result.results[0].event_type).toBe('medication'); // Most recent first
      expect(result.results[1].event_type).toBe('trigger');
      expect(result.results[0].user_id).toBe(testUser);
      expect(result.results[1].user_id).toBe(testUser);
    });

    it('should retrieve a specific event by ID', async () => {
      const createResult = await mockDB.prepare('INSERT INTO events (timestamp, event_type, value, user_id) VALUES (?, ?, ?, ?)')
        .bind('2024-01-15T11:00:00Z', 'sleep', '8 hours', testUser).run();
      
      const eventId = createResult.meta.last_row_id;

      const result = await mockDB.prepare('SELECT * FROM events WHERE id = ? AND user_id = ?')
        .bind(eventId, testUser).first();

      expect(result).not.toBeNull();
      expect(result.id).toBe(eventId);
      expect(result.event_type).toBe('sleep');
      expect(result.value).toBe('8 hours');
      expect(result.user_id).toBe(testUser);
    });

    it('should update an event successfully', async () => {
      const createResult = await mockDB.prepare('INSERT INTO events (timestamp, event_type, value, user_id) VALUES (?, ?, ?, ?)')
        .bind('2024-01-15T11:00:00Z', 'medication', 'aspirin', testUser).run();
      
      const eventId = createResult.meta.last_row_id;

      const updateResult = await mockDB.prepare('UPDATE events SET value = ? WHERE id = ? AND user_id = ?')
        .bind('ibuprofen 400mg', eventId, testUser).run();

      expect(updateResult.meta.changes).toBe(1);

      const updatedRecord = await mockDB.prepare('SELECT * FROM events WHERE id = ? AND user_id = ?')
        .bind(eventId, testUser).first();

      expect(updatedRecord.value).toBe('ibuprofen 400mg');
    });

    it('should delete an event successfully', async () => {
      const createResult = await mockDB.prepare('INSERT INTO events (timestamp, event_type, value, user_id) VALUES (?, ?, ?, ?)')
        .bind('2024-01-15T11:00:00Z', 'trigger', 'bright lights', testUser).run();
      
      const eventId = createResult.meta.last_row_id;

      const deleteResult = await mockDB.prepare('DELETE FROM events WHERE id = ? AND user_id = ?')
        .bind(eventId, testUser).run();

      expect(deleteResult.meta.changes).toBe(1);

      const deletedRecord = await mockDB.prepare('SELECT * FROM events WHERE id = ? AND user_id = ?')
        .bind(eventId, testUser).first();

      expect(deletedRecord).toBeNull();
    });
  });

  describe('Dashboard Data Flow', () => {
    it('should retrieve dashboard data correctly', async () => {
      // Create test data
      await mockDB.prepare('INSERT INTO headaches (timestamp, severity, aura, user_id) VALUES (?, ?, ?, ?)')
        .bind('2024-01-15T10:00:00Z', 7, 1, testUser).run();
      
      await mockDB.prepare('INSERT INTO events (timestamp, event_type, value, user_id) VALUES (?, ?, ?, ?)')
        .bind('2024-01-15T09:00:00Z', 'medication', 'ibuprofen', testUser).run();

      // Query dashboard data (simulating the dashboard endpoint)
      const startDate = '2024-01-01T00:00:00Z';
      const endDate = '2024-01-31T23:59:59Z';

      const headachesData = await mockDB.prepare(
        'SELECT timestamp, severity, aura FROM headaches WHERE timestamp >= ? AND timestamp <= ? AND user_id = ? ORDER BY timestamp'
      ).bind(startDate, endDate, testUser).all();

      const eventsData = await mockDB.prepare(
        'SELECT event_type, value, timestamp FROM events WHERE timestamp >= ? AND timestamp <= ? AND user_id = ? ORDER BY timestamp'
      ).bind(startDate, endDate, testUser).all();

      expect(headachesData.results).toHaveLength(1);
      expect(headachesData.results[0].severity).toBe(7);
      expect(headachesData.results[0].aura).toBe(1);

      expect(eventsData.results).toHaveLength(1);
      expect(eventsData.results[0].event_type).toBe('medication');
      expect(eventsData.results[0].value).toBe('ibuprofen');
    });

    it('should handle empty dashboard data gracefully', async () => {
      const startDate = '2024-01-01T00:00:00Z';
      const endDate = '2024-01-31T23:59:59Z';

      const headachesData = await mockDB.prepare(
        'SELECT timestamp, severity, aura FROM headaches WHERE timestamp >= ? AND timestamp <= ? AND user_id = ? ORDER BY timestamp'
      ).bind(startDate, endDate, testUser).all();

      const eventsData = await mockDB.prepare(
        'SELECT event_type, value, timestamp FROM events WHERE timestamp >= ? AND timestamp <= ? AND user_id = ? ORDER BY timestamp'
      ).bind(startDate, endDate, testUser).all();

      expect(headachesData.results).toHaveLength(0);
      expect(eventsData.results).toHaveLength(0);
    });
  });

  describe('User Registration Flow', () => {
    it('should register a new user successfully', async () => {
      const result = await mockDB.prepare('INSERT OR IGNORE INTO users (address) VALUES (?)')
        .bind(testUser).run();

      expect(result.meta.changes).toBe(1);
    });

    it('should handle duplicate user registration gracefully', async () => {
      // First registration
      await mockDB.prepare('INSERT OR IGNORE INTO users (address) VALUES (?)')
        .bind(testUser).run();

      // Second registration (should be ignored)
      const result = await mockDB.prepare('INSERT OR IGNORE INTO users (address) VALUES (?)')
        .bind(testUser).run();

      // Changes should be 0 due to IGNORE clause
      expect(result.meta.changes).toBe(0);
    });
  });

  describe('Pagination and Filtering', () => {
    beforeEach(async () => {
      // Create test data with different severities and timestamps
      const testData = [
        { timestamp: '2024-01-10T10:00:00Z', severity: 3, aura: 0 },
        { timestamp: '2024-01-11T11:00:00Z', severity: 6, aura: 1 },
        { timestamp: '2024-01-12T12:00:00Z', severity: 8, aura: 0 },
        { timestamp: '2024-01-13T13:00:00Z', severity: 9, aura: 1 },
        { timestamp: '2024-01-14T14:00:00Z', severity: 4, aura: 0 }
      ];

      for (const data of testData) {
        await mockDB.prepare('INSERT INTO headaches (timestamp, severity, aura, user_id) VALUES (?, ?, ?, ?)')
          .bind(data.timestamp, data.severity, data.aura, testUser).run();
      }
    });

    it('should handle pagination correctly', async () => {
      // Get first page (limit 3)
      const page1 = await mockDB.prepare('SELECT * FROM headaches WHERE user_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?')
        .bind(testUser, 3, 0).all();

      // Get second page (limit 3, offset 3)
      const page2 = await mockDB.prepare('SELECT * FROM headaches WHERE user_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?')
        .bind(testUser, 3, 3).all();

      expect(page1.results).toHaveLength(3);
      expect(page2.results).toHaveLength(2); // Remaining 2 records

      // Verify ordering (most recent first)
      expect(page1.results[0].timestamp).toBe('2024-01-14T14:00:00Z');
      expect(page1.results[1].timestamp).toBe('2024-01-13T13:00:00Z');
      expect(page1.results[2].timestamp).toBe('2024-01-12T12:00:00Z');
    });

    it('should handle date range filtering', async () => {
      const result = await mockDB.prepare(
        'SELECT * FROM headaches WHERE timestamp >= ? AND timestamp <= ? AND user_id = ? ORDER BY timestamp DESC'
      ).bind('2024-01-11T00:00:00Z', '2024-01-13T23:59:59Z', testUser).all();

      expect(result.results).toHaveLength(3);
      expect(result.results.every(h => h.user_id === testUser)).toBe(true);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity with user_id', async () => {
      // Create headache
      const headacheResult = await mockDB.prepare('INSERT INTO headaches (timestamp, severity, aura, user_id) VALUES (?, ?, ?, ?)')
        .bind('2024-01-15T10:00:00Z', 7, 1, testUser).run();

      // Create event
      const eventResult = await mockDB.prepare('INSERT INTO events (timestamp, event_type, value, user_id) VALUES (?, ?, ?, ?)')
        .bind('2024-01-15T11:00:00Z', 'medication', 'aspirin', testUser).run();

      // Verify both records have correct user_id
      const headache = await mockDB.prepare('SELECT * FROM headaches WHERE id = ? AND user_id = ?')
        .bind(headacheResult.meta.last_row_id, testUser).first();

      const event = await mockDB.prepare('SELECT * FROM events WHERE id = ? AND user_id = ?')
        .bind(eventResult.meta.last_row_id, testUser).first();

      expect(headache.user_id).toBe(testUser);
      expect(event.user_id).toBe(testUser);
    });

    it('should handle concurrent operations correctly', async () => {
      // Simulate concurrent creation of multiple records
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        promises.push(
          mockDB.prepare('INSERT INTO headaches (timestamp, severity, aura, user_id) VALUES (?, ?, ?, ?)')
            .bind(`2024-01-15T1${i}:00:00Z`, 5 + i, i % 2, testUser).run()
        );
      }

      const results = await Promise.all(promises);

      // All insertions should succeed
      results.forEach(result => {
        expect(result.meta.changes).toBe(1);
        expect(result.meta.last_row_id).toBeGreaterThan(0);
      });

      // Verify all records are created
      const allRecords = await mockDB.prepare('SELECT * FROM headaches WHERE user_id = ?')
        .bind(testUser).all();

      expect(allRecords.results).toHaveLength(5);
    });
  });
});

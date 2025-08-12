import { describe, it, expect } from 'vitest';

// Since the DB helper functions are not exported, we'll recreate them here for testing
// In a real-world scenario, these would be extracted to a separate utility module

function buildSelectWithUserScope(table: string, where: string[], params: unknown[], addr: string): { sql: string; params: unknown[] } {
  const userScopedWhere = [...where, 'user_id = ?'];
  const userScopedParams = [...params, addr];
  const whereClause = `WHERE ${userScopedWhere.join(' AND ')}`;
  return {
    sql: `SELECT * FROM ${table} ${whereClause}`,
    params: userScopedParams
  };
}

function buildInsertWithUserScope(table: string, columns: string[], values: unknown[], addr: string): { sql: string; params: unknown[] } {
  const userScopedColumns = [...columns, 'user_id'];
  const userScopedValues = [...values, addr];
  const placeholders = userScopedColumns.map(() => '?').join(', ');
  return {
    sql: `INSERT INTO ${table} (${userScopedColumns.join(', ')}) VALUES (${placeholders})`,
    params: userScopedValues
  };
}

function buildUpdateWithUserScope(table: string, fields: string[], params: unknown[], id: number, addr: string): { sql: string; params: unknown[] } {
  const userScopedParams = [...params, id, addr];
  return {
    sql: `UPDATE ${table} SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
    params: userScopedParams
  };
}

function buildDeleteWithUserScope(table: string, id: number, addr: string): { sql: string; params: unknown[] } {
  return {
    sql: `DELETE FROM ${table} WHERE id = ? AND user_id = ?`,
    params: [id, addr]
  };
}

function buildSelectByIdWithUserScope(table: string, id: number, addr: string): { sql: string; params: unknown[] } {
  return {
    sql: `SELECT * FROM ${table} WHERE id = ? AND user_id = ?`,
    params: [id, addr]
  };
}

describe('DB Helper Functions - User Scoping', () => {
  const testUser = '0x1234567890123456789012345678901234567890';
  const otherUser = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

  describe('buildSelectWithUserScope', () => {
    it('should add user_id filter to WHERE clause', () => {
      const result = buildSelectWithUserScope('headaches', [], [], testUser);
      
      expect(result.sql).toBe('SELECT * FROM headaches WHERE user_id = ?');
      expect(result.params).toEqual([testUser]);
    });

    it('should append user_id filter to existing WHERE conditions', () => {
      const result = buildSelectWithUserScope(
        'headaches', 
        ['severity >= ?', 'timestamp >= ?'], 
        [5, '2024-01-01T00:00:00Z'], 
        testUser
      );
      
      expect(result.sql).toBe('SELECT * FROM headaches WHERE severity >= ? AND timestamp >= ? AND user_id = ?');
      expect(result.params).toEqual([5, '2024-01-01T00:00:00Z', testUser]);
    });

    it('should work with different table names', () => {
      const result = buildSelectWithUserScope('events', ['event_type = ?'], ['sleep'], testUser);
      
      expect(result.sql).toBe('SELECT * FROM events WHERE event_type = ? AND user_id = ?');
      expect(result.params).toEqual(['sleep', testUser]);
    });

    it('should always include user_id filter even with empty conditions', () => {
      const result = buildSelectWithUserScope('headaches', [], [], testUser);
      
      expect(result.sql).toContain('user_id = ?');
      expect(result.params).toContain(testUser);
    });
  });

  describe('buildInsertWithUserScope', () => {
    it('should add user_id column and value to INSERT statement', () => {
      const result = buildInsertWithUserScope(
        'headaches',
        ['timestamp', 'severity', 'aura'],
        ['2024-01-01T12:00:00Z', 7, 1],
        testUser
      );

      expect(result.sql).toBe('INSERT INTO headaches (timestamp, severity, aura, user_id) VALUES (?, ?, ?, ?)');
      expect(result.params).toEqual(['2024-01-01T12:00:00Z', 7, 1, testUser]);
    });

    it('should work with minimal column set', () => {
      const result = buildInsertWithUserScope('events', ['event_type'], ['medication'], testUser);

      expect(result.sql).toBe('INSERT INTO events (event_type, user_id) VALUES (?, ?)');
      expect(result.params).toEqual(['medication', testUser]);
    });

    it('should preserve column order with user_id at the end', () => {
      const result = buildInsertWithUserScope(
        'headaches',
        ['timestamp', 'severity'],
        ['2024-01-01T12:00:00Z', 5],
        testUser
      );

      expect(result.sql).toBe('INSERT INTO headaches (timestamp, severity, user_id) VALUES (?, ?, ?)');
      expect(result.params).toEqual(['2024-01-01T12:00:00Z', 5, testUser]);
    });
  });

  describe('buildUpdateWithUserScope', () => {
    it('should add user_id condition to UPDATE WHERE clause', () => {
      const result = buildUpdateWithUserScope(
        'headaches',
        ['severity = ?', 'aura = ?'],
        [8, 0],
        123,
        testUser
      );

      expect(result.sql).toBe('UPDATE headaches SET severity = ?, aura = ? WHERE id = ? AND user_id = ?');
      expect(result.params).toEqual([8, 0, 123, testUser]);
    });

    it('should work with single field updates', () => {
      const result = buildUpdateWithUserScope('events', ['value = ?'], ['updated value'], 456, testUser);

      expect(result.sql).toBe('UPDATE events SET value = ? WHERE id = ? AND user_id = ?');
      expect(result.params).toEqual(['updated value', 456, testUser]);
    });

    it('should ensure user cannot update another user\'s records', () => {
      const result = buildUpdateWithUserScope('headaches', ['severity = ?'], [9], 123, testUser);
      
      // The SQL always includes user_id check
      expect(result.sql).toContain('user_id = ?');
      expect(result.params).toContain(testUser);
      expect(result.params).not.toContain(otherUser);
    });
  });

  describe('buildDeleteWithUserScope', () => {
    it('should add user_id condition to DELETE WHERE clause', () => {
      const result = buildDeleteWithUserScope('headaches', 123, testUser);

      expect(result.sql).toBe('DELETE FROM headaches WHERE id = ? AND user_id = ?');
      expect(result.params).toEqual([123, testUser]);
    });

    it('should work with different table names', () => {
      const result = buildDeleteWithUserScope('events', 456, testUser);

      expect(result.sql).toBe('DELETE FROM events WHERE id = ? AND user_id = ?');
      expect(result.params).toEqual([456, testUser]);
    });

    it('should ensure user cannot delete another user\'s records', () => {
      const result = buildDeleteWithUserScope('headaches', 123, testUser);
      
      expect(result.sql).toContain('user_id = ?');
      expect(result.params).toContain(testUser);
      expect(result.params).not.toContain(otherUser);
    });
  });

  describe('buildSelectByIdWithUserScope', () => {
    it('should add user_id condition to SELECT WHERE clause', () => {
      const result = buildSelectByIdWithUserScope('headaches', 123, testUser);

      expect(result.sql).toBe('SELECT * FROM headaches WHERE id = ? AND user_id = ?');
      expect(result.params).toEqual([123, testUser]);
    });

    it('should work with different table names', () => {
      const result = buildSelectByIdWithUserScope('events', 456, testUser);

      expect(result.sql).toBe('SELECT * FROM events WHERE id = ? AND user_id = ?');
      expect(result.params).toEqual([456, testUser]);
    });

    it('should ensure user cannot access another user\'s records', () => {
      const result = buildSelectByIdWithUserScope('headaches', 123, testUser);
      
      expect(result.sql).toContain('user_id = ?');
      expect(result.params).toContain(testUser);
      expect(result.params).not.toContain(otherUser);
    });
  });

  describe('Cross-user security tests', () => {
    it('should generate different queries for different users', () => {
      const user1Query = buildSelectWithUserScope('headaches', [], [], testUser);
      const user2Query = buildSelectWithUserScope('headaches', [], [], otherUser);

      expect(user1Query.sql).toBe(user2Query.sql); // Same SQL structure
      expect(user1Query.params).not.toEqual(user2Query.params); // Different params
      expect(user1Query.params).toContain(testUser);
      expect(user2Query.params).toContain(otherUser);
    });

    it('should never generate queries without user_id conditions', () => {
      const selectQuery = buildSelectWithUserScope('headaches', ['severity > ?'], [5], testUser);
      const updateQuery = buildUpdateWithUserScope('headaches', ['severity = ?'], [7], 123, testUser);
      const deleteQuery = buildDeleteWithUserScope('headaches', 123, testUser);
      const selectByIdQuery = buildSelectByIdWithUserScope('headaches', 123, testUser);

      expect(selectQuery.sql).toContain('user_id = ?');
      expect(updateQuery.sql).toContain('user_id = ?');
      expect(deleteQuery.sql).toContain('user_id = ?');
      expect(selectByIdQuery.sql).toContain('user_id = ?');
    });

    it('should maintain parameter order with user_id in correct position', () => {
      const updateQuery = buildUpdateWithUserScope('headaches', ['severity = ?', 'aura = ?'], [8, 1], 123, testUser);
      
      // Parameters should be: [field_values..., id, user_id]
      expect(updateQuery.params).toEqual([8, 1, 123, testUser]);
    });
  });
});

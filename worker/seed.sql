-- worker/seed.sql
-- Sample data for local development

-- Insert sample headaches
INSERT INTO headaches (timestamp, severity, aura) VALUES
  ('2025-08-09T08:30:00Z', 4, 0),
  ('2025-08-09T18:45:00Z', 7, 1),
  ('2025-08-10T02:10:00Z', 6, 0);

-- Insert sample events (global timeline)
INSERT INTO events (timestamp, event_type, value) VALUES
  ('2025-08-09T07:50:00Z', 'medication', 'ibuprofen 400mg'),
  ('2025-08-09T12:00:00Z', 'trigger', 'skipped lunch'),
  ('2025-08-09T20:15:00Z', 'note', 'aura lasted ~20 min'),
  ('2025-08-10T01:30:00Z', 'sleep', 'nap 30 minutes');


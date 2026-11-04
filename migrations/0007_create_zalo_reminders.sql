CREATE TABLE IF NOT EXISTS zalo_bot_links (
  username TEXT PRIMARY KEY,
  chat_id TEXT UNIQUE,
  link_code TEXT UNIQUE,
  link_code_expires_at INTEGER,
  task_reminders_enabled INTEGER NOT NULL DEFAULT 1,
  daily_digest_enabled INTEGER NOT NULL DEFAULT 0,
  daily_digest_time TEXT NOT NULL DEFAULT '08:00',
  linked_at INTEGER
);

CREATE TABLE IF NOT EXISTS zalo_reminder_deliveries (
  username TEXT NOT NULL,
  delivery_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (username, delivery_key)
);

CREATE INDEX IF NOT EXISTS idx_zalo_reminder_deliveries_created_at
  ON zalo_reminder_deliveries(created_at);

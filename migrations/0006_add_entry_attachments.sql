ALTER TABLE entries ADD COLUMN file_key TEXT;
ALTER TABLE entries ADD COLUMN file_name TEXT;
ALTER TABLE entries ADD COLUMN file_content_type TEXT;
ALTER TABLE entries ADD COLUMN file_size INTEGER;

CREATE TABLE IF NOT EXISTS entry_upload_quota (
  username TEXT NOT NULL,
  usage_year INTEGER NOT NULL,
  used_bytes INTEGER NOT NULL DEFAULT 0,
  reserved_bytes INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (username, usage_year)
);

CREATE TABLE IF NOT EXISTS entry_upload_sessions (
  token TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  usage_year INTEGER NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  multipart_upload_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_content_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  entry_id INTEGER,
  mo_ta TEXT NOT NULL,
  loai_thong_tin TEXT NOT NULL,
  noi_dung TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT 'uploading',
  started_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_entry_upload_sessions_started_at
  ON entry_upload_sessions(started_at);

CREATE TABLE IF NOT EXISTS entry_upload_parts (
  token TEXT NOT NULL,
  part_number INTEGER NOT NULL,
  etag TEXT NOT NULL,
  PRIMARY KEY (token, part_number)
);

CREATE TABLE IF NOT EXISTS entry_file_cleanup (
  object_key TEXT PRIMARY KEY,
  queued_at TEXT NOT NULL DEFAULT (datetime('now'))
);

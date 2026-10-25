ALTER TABLE entries ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_entries_deleted_at ON entries(deleted_at);

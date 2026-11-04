ALTER TABLE zalo_reminder_deliveries
  ADD COLUMN status TEXT NOT NULL DEFAULT 'sent';

CREATE TABLE IF NOT EXISTS user_profiles (
  username TEXT PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '',
  birth_year INTEGER,
  hometown TEXT NOT NULL DEFAULT '',
  current_location TEXT NOT NULL DEFAULT '',
  workplace TEXT NOT NULL DEFAULT '',
  password_salt TEXT,
  password_hash TEXT
);

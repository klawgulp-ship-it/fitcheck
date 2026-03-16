import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'fitcheck.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS garments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    name TEXT,
    category TEXT NOT NULL,
    color TEXT,
    season TEXT,
    image_path TEXT NOT NULL,
    thumbnail_path TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS outfits (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    worn_at TEXT
  );

  CREATE TABLE IF NOT EXISTS outfit_items (
    outfit_id TEXT NOT NULL,
    garment_id TEXT NOT NULL,
    position_x REAL DEFAULT 0,
    position_y REAL DEFAULT 0,
    scale REAL DEFAULT 1,
    z_index INTEGER DEFAULT 0,
    PRIMARY KEY (outfit_id, garment_id),
    FOREIGN KEY (outfit_id) REFERENCES outfits(id) ON DELETE CASCADE,
    FOREIGN KEY (garment_id) REFERENCES garments(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_garments_user ON garments(user_id);
  CREATE INDEX IF NOT EXISTS idx_garments_category ON garments(category);
  CREATE INDEX IF NOT EXISTS idx_outfits_user ON outfits(user_id);
`);

export default db;

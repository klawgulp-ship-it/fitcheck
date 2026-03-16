import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db';

const router = Router();

// Create outfit
router.post('/', (req: Request, res: Response) => {
  const id = uuid();
  const { name, items } = req.body;

  db.prepare('INSERT INTO outfits (id, name) VALUES (?, ?)').run(id, name || null);

  if (items && Array.isArray(items)) {
    const insert = db.prepare(`
      INSERT INTO outfit_items (outfit_id, garment_id, position_x, position_y, scale, z_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      insert.run(id, item.garment_id, item.position_x || 0, item.position_y || 0, item.scale || 1, item.z_index || 0);
    }
  }

  const outfit = getOutfitWithItems(id);
  res.status(201).json(outfit);
});

// List outfits
router.get('/', (_req: Request, res: Response) => {
  const outfits = db.prepare('SELECT * FROM outfits WHERE user_id = ? ORDER BY created_at DESC').all('default');
  res.json(outfits);
});

// Get outfit with items
router.get('/:id', (req: Request, res: Response) => {
  const outfit = getOutfitWithItems(req.params.id);
  if (!outfit) return res.status(404).json({ error: 'Not found' });
  res.json(outfit);
});

// Update outfit (replace items)
router.put('/:id', (req: Request, res: Response) => {
  const { name, items, worn_at } = req.body;

  if (name !== undefined) {
    db.prepare('UPDATE outfits SET name = ? WHERE id = ?').run(name, req.params.id);
  }
  if (worn_at !== undefined) {
    db.prepare('UPDATE outfits SET worn_at = ? WHERE id = ?').run(worn_at, req.params.id);
  }

  if (items && Array.isArray(items)) {
    db.prepare('DELETE FROM outfit_items WHERE outfit_id = ?').run(req.params.id);
    const insert = db.prepare(`
      INSERT INTO outfit_items (outfit_id, garment_id, position_x, position_y, scale, z_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      insert.run(req.params.id, item.garment_id, item.position_x || 0, item.position_y || 0, item.scale || 1, item.z_index || 0);
    }
  }

  const outfit = getOutfitWithItems(req.params.id);
  res.json(outfit);
});

// Mark outfit as worn today
router.post('/:id/wear', (req: Request, res: Response) => {
  const date = req.body.date || new Date().toISOString().split('T')[0];
  db.prepare('UPDATE outfits SET worn_at = ? WHERE id = ?').run(date, req.params.id);
  const outfit = getOutfitWithItems(req.params.id);
  res.json(outfit);
});

// Delete outfit
router.delete('/:id', (req: Request, res: Response) => {
  db.prepare('DELETE FROM outfit_items WHERE outfit_id = ?').run(req.params.id);
  db.prepare('DELETE FROM outfits WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

function getOutfitWithItems(id: string) {
  const outfit: any = db.prepare('SELECT * FROM outfits WHERE id = ?').get(id);
  if (!outfit) return null;
  outfit.items = db.prepare(`
    SELECT oi.*, g.name as garment_name, g.category, g.color, g.image_path, g.thumbnail_path
    FROM outfit_items oi
    JOIN garments g ON g.id = oi.garment_id
    WHERE oi.outfit_id = ?
    ORDER BY oi.z_index
  `).all(id);
  return outfit;
}

export default router;

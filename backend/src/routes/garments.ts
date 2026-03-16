import { Router, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import db from '../db';

const router = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'data', 'uploads');
const THUMB_DIR = path.join(UPLOAD_DIR, 'thumbnails');
[UPLOAD_DIR, THUMB_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => cb(null, `${uuid()}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

// Upload garment photo
router.post('/', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const id = uuid();
    const { category = 'other', name, color, season } = req.body;
    const imagePath = req.file.filename;

    // Generate thumbnail
    const thumbName = `thumb_${imagePath}`;
    await sharp(req.file.path)
      .resize(300, 300, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toFile(path.join(THUMB_DIR, thumbName));

    db.prepare(`
      INSERT INTO garments (id, name, category, color, season, image_path, thumbnail_path)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name || null, category, color || null, season || null, imagePath, `thumbnails/${thumbName}`);

    const garment = db.prepare('SELECT * FROM garments WHERE id = ?').get(id);
    res.status(201).json(garment);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List garments
router.get('/', (req: Request, res: Response) => {
  const { category, color, season } = req.query;
  let sql = 'SELECT * FROM garments WHERE user_id = ?';
  const params: any[] = ['default'];

  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (color) { sql += ' AND color = ?'; params.push(color); }
  if (season) { sql += ' AND season = ?'; params.push(season); }

  sql += ' ORDER BY created_at DESC';
  const garments = db.prepare(sql).all(...params);
  res.json(garments);
});

// Get single garment
router.get('/:id', (req: Request, res: Response) => {
  const garment = db.prepare('SELECT * FROM garments WHERE id = ?').get(req.params.id);
  if (!garment) return res.status(404).json({ error: 'Not found' });
  res.json(garment);
});

// Update garment
router.patch('/:id', (req: Request, res: Response) => {
  const { name, category, color, season } = req.body;
  const fields: string[] = [];
  const params: any[] = [];

  if (name !== undefined) { fields.push('name = ?'); params.push(name); }
  if (category !== undefined) { fields.push('category = ?'); params.push(category); }
  if (color !== undefined) { fields.push('color = ?'); params.push(color); }
  if (season !== undefined) { fields.push('season = ?'); params.push(season); }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  fields.push("updated_at = datetime('now')");
  params.push(req.params.id);

  db.prepare(`UPDATE garments SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  const garment = db.prepare('SELECT * FROM garments WHERE id = ?').get(req.params.id);
  res.json(garment);
});

// Delete garment
router.delete('/:id', (req: Request, res: Response) => {
  const garment: any = db.prepare('SELECT * FROM garments WHERE id = ?').get(req.params.id);
  if (!garment) return res.status(404).json({ error: 'Not found' });

  // Clean up files
  const imgPath = path.join(UPLOAD_DIR, garment.image_path);
  const thumbPath = path.join(UPLOAD_DIR, garment.thumbnail_path);
  if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);

  db.prepare('DELETE FROM garments WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

export default router;

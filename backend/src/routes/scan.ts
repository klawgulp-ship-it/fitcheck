import { Router, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import db from '../db';

const router = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'data', 'uploads');
const THUMB_DIR = path.join(UPLOAD_DIR, 'thumbnails');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
}

const SCAN_PROMPT = `You are a fashion AI analyzing a photo of a closet, clothing rack, drawer, or pile of clothes.

Identify EVERY distinct clothing item or accessory visible in the image. Clothes may be:
- Hanging sideways, upside down, or at angles
- Folded, bunched up, or partially hidden behind other items
- On hangers, shelves, hooks, or in piles

For EACH item, provide:
- name: A short descriptive name (e.g. "Black Nike hoodie", "Blue denim jeans", "White Air Force 1s")
- category: One of: tops, bottoms, shoes, outerwear, accessories, other
- color: Primary color(s) (e.g. "black", "navy/white", "olive green")
- season: Best season fit — one of: spring, summer, fall, winter, all
- position: Describe where in the image this item is located (e.g. "top left", "center hanging", "bottom shelf right side") so the user can identify which item you mean

Respond ONLY with a JSON array. No markdown, no explanation. Example:
[
  {"name": "Black Nike hoodie", "category": "outerwear", "color": "black", "season": "fall", "position": "left side, second hanger"},
  {"name": "Blue slim jeans", "category": "bottoms", "color": "blue", "season": "all", "position": "folded on shelf, right"}
]

If you can't identify any clothing items, return an empty array: []`;

// Scan a closet photo — returns detected garments (Gemini Flash = free tier)
router.post('/detect', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const model = getModel();
    const base64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64,
        }
      },
      { text: SCAN_PROMPT }
    ]);

    const text = result.response.text();

    // Parse JSON — handle potential markdown wrapping
    let items: any[];
    try {
      const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      items = JSON.parse(cleaned);
    } catch {
      return res.status(422).json({ error: 'Failed to parse AI response', raw: text });
    }

    // Save the original scan image so we can reference it
    const scanFilename = `scan_${uuid()}${path.extname(req.file.originalname || '.jpg')}`;
    const scanPath = path.join(UPLOAD_DIR, scanFilename);
    fs.writeFileSync(scanPath, req.file.buffer);

    res.json({
      scan_image: scanFilename,
      items: items.map((item: any, i: number) => ({
        id: `detected_${i}`,
        name: item.name || 'Unknown item',
        category: item.category || 'other',
        color: item.color || '',
        season: item.season || 'all',
        position: item.position || '',
      }))
    });
  } catch (err: any) {
    console.error('Scan error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Bulk save confirmed items from a scan
router.post('/bulk', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const items = JSON.parse(req.body.items || '[]');
    if (!items.length) return res.status(400).json({ error: 'No items to save' });

    const saved: any[] = [];

    for (const item of items) {
      const id = uuid();
      const imageName = `${uuid()}${path.extname(req.file.originalname || '.jpg')}`;
      const imagePath = path.join(UPLOAD_DIR, imageName);

      // Save the full scan image as the garment image
      fs.writeFileSync(imagePath, req.file.buffer);

      // Generate thumbnail
      const thumbName = `thumb_${imageName.replace(path.extname(imageName), '.png')}`;
      await sharp(req.file.buffer)
        .resize(300, 300, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toFile(path.join(THUMB_DIR, thumbName));

      db.prepare(`
        INSERT INTO garments (id, name, category, color, season, image_path, thumbnail_path)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, item.name || null, item.category || 'other', item.color || null, item.season || null, imageName, `thumbnails/${thumbName}`);

      saved.push(db.prepare('SELECT * FROM garments WHERE id = ?').get(id));
    }

    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

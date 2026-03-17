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
- position: Describe where in the image this item is (e.g. "top left", "center hanging")
- bbox: Bounding box as [ymin, xmin, ymax, xmax] with values 0-1000 (relative to image dimensions, where 0,0 is top-left and 1000,1000 is bottom-right). Draw a tight box around just this item.

Respond ONLY with a JSON array. No markdown, no explanation. Example:
[
  {"name": "Black Nike hoodie", "category": "outerwear", "color": "black", "season": "fall", "position": "left side", "bbox": [50, 10, 400, 300]},
  {"name": "Blue slim jeans", "category": "bottoms", "color": "blue", "season": "all", "position": "right shelf", "bbox": [200, 500, 600, 800]}
]

If you can't identify any clothing items, return an empty array: []`;

// Scan a closet photo — returns detected garments with cropped previews
router.post('/detect', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const model = getModel();
    const base64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64 } },
      { text: SCAN_PROMPT }
    ]);

    const text = result.response.text();

    let items: any[];
    try {
      const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      items = JSON.parse(cleaned);
    } catch {
      return res.status(422).json({ error: 'Failed to parse AI response', raw: text });
    }

    // Get image dimensions for bbox cropping
    const metadata = await sharp(req.file.buffer).metadata();
    const imgW = metadata.width || 1;
    const imgH = metadata.height || 1;

    // Crop each detected item and save as preview
    const scanId = uuid();
    const processedItems = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let cropFilename = '';

      if (item.bbox && Array.isArray(item.bbox) && item.bbox.length === 4) {
        const [ymin, xmin, ymax, xmax] = item.bbox;
        // Convert 0-1000 coords to pixels
        const left = Math.max(0, Math.round((xmin / 1000) * imgW));
        const top = Math.max(0, Math.round((ymin / 1000) * imgH));
        const width = Math.min(imgW - left, Math.round(((xmax - xmin) / 1000) * imgW));
        const height = Math.min(imgH - top, Math.round(((ymax - ymin) / 1000) * imgH));

        if (width > 10 && height > 10) {
          cropFilename = `crop_${scanId}_${i}.png`;
          try {
            await sharp(req.file.buffer)
              .extract({ left, top, width, height })
              .resize(400, 400, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
              .png()
              .toFile(path.join(UPLOAD_DIR, cropFilename));
          } catch (e) {
            console.error('Crop failed for item', i, e);
            cropFilename = '';
          }
        }
      }

      processedItems.push({
        id: `detected_${i}`,
        name: item.name || 'Unknown item',
        category: item.category || 'other',
        color: item.color || '',
        season: item.season || 'all',
        position: item.position || '',
        bbox: item.bbox || null,
        crop_image: cropFilename || null,
      });
    }

    // Save original scan image
    const scanFilename = `scan_${scanId}.jpg`;
    await sharp(req.file.buffer).jpeg({ quality: 85 }).toFile(path.join(UPLOAD_DIR, scanFilename));

    res.json({ scan_image: scanFilename, items: processedItems });
  } catch (err: any) {
    console.error('Scan error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Bulk save confirmed items — uses cropped images per item
router.post('/bulk', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const items = JSON.parse(req.body.items || '[]');
    if (!items.length) return res.status(400).json({ error: 'No items to save' });

    const metadata = await sharp(req.file.buffer).metadata();
    const imgW = metadata.width || 1;
    const imgH = metadata.height || 1;
    const saved: any[] = [];

    for (const item of items) {
      const id = uuid();
      const imageName = `${id}.png`;
      const thumbName = `thumb_${id}.png`;
      let imageBuffer: Buffer;

      // Crop individual item if bbox provided
      if (item.bbox && Array.isArray(item.bbox) && item.bbox.length === 4) {
        const [ymin, xmin, ymax, xmax] = item.bbox;
        const left = Math.max(0, Math.round((xmin / 1000) * imgW));
        const top = Math.max(0, Math.round((ymin / 1000) * imgH));
        const width = Math.min(imgW - left, Math.round(((xmax - xmin) / 1000) * imgW));
        const height = Math.min(imgH - top, Math.round(((ymax - ymin) / 1000) * imgH));

        if (width > 10 && height > 10) {
          imageBuffer = await sharp(req.file.buffer)
            .extract({ left, top, width, height })
            .png()
            .toBuffer();
        } else {
          imageBuffer = req.file.buffer;
        }
      } else {
        imageBuffer = req.file.buffer;
      }

      // Save cropped image
      await sharp(imageBuffer)
        .resize(600, 600, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toFile(path.join(UPLOAD_DIR, imageName));

      // Generate thumbnail
      await sharp(imageBuffer)
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

// Generate outfit suggestions from scanned items
router.post('/suggest-outfits', async (req: Request, res: Response) => {
  try {
    const { garment_ids } = req.body;

    // Get all garments (or just the specified ones)
    let garments: any[];
    if (garment_ids && garment_ids.length) {
      const placeholders = garment_ids.map(() => '?').join(',');
      garments = db.prepare(`SELECT * FROM garments WHERE id IN (${placeholders})`).all(...garment_ids);
    } else {
      garments = db.prepare('SELECT * FROM garments WHERE user_id = ? ORDER BY created_at DESC').all('default');
    }

    if (garments.length < 2) {
      return res.json({ outfits: [] });
    }

    const model = getModel();

    // Build a text list of garments for the AI
    const garmentList = garments.map((g: any) =>
      `ID:${g.id} | "${g.name || g.category}" | ${g.category} | ${g.color || 'unknown color'} | ${g.season || 'all'}`
    ).join('\n');

    const result = await model.generateContent([{
      text: `You are a fashion stylist. Given these clothing items from someone's closet, create 2-4 complete outfit combinations.

ITEMS:
${garmentList}

Rules:
- Each outfit MUST have at least a top + bottom (or a dress/jumpsuit counts as both)
- Add shoes and outerwear if available and they match
- Focus on color coordination, style cohesion, and season matching
- Give each outfit a vibe name (e.g. "Casual Friday", "Street Heat", "Clean Fit")
- Only use item IDs from the list above

Respond ONLY with a JSON array. No markdown. Example:
[
  {"name": "Street Heat", "item_ids": ["id1", "id2", "id3"]},
  {"name": "Clean Minimal", "item_ids": ["id4", "id5"]}
]`
    }]);

    const text = result.response.text();
    let suggestions: any[];
    try {
      const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      suggestions = JSON.parse(cleaned);
    } catch {
      return res.status(422).json({ error: 'Failed to parse outfit suggestions', raw: text });
    }

    // Validate that suggested IDs actually exist
    const validIds = new Set(garments.map((g: any) => g.id));
    const validSuggestions = suggestions
      .filter((s: any) => s.item_ids && s.item_ids.every((id: string) => validIds.has(id)))
      .map((s: any) => ({
        name: s.name,
        items: s.item_ids.map((id: string) => garments.find((g: any) => g.id === id))
      }));

    res.json({ outfits: validSuggestions });
  } catch (err: any) {
    console.error('Suggest error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

import express from 'express';
import cors from 'cors';
import path from 'path';
import garmentRoutes from './routes/garments';
import outfitRoutes from './routes/outfits';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

app.use(cors());
app.use(express.json());

// Serve uploaded images
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'data', 'uploads');
app.use('/uploads', express.static(UPLOAD_DIR));

// API routes
app.use('/api/garments', garmentRoutes);
app.use('/api/outfits', outfitRoutes);

// Serve frontend in production
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FitCheck API running on port ${PORT}`);
});

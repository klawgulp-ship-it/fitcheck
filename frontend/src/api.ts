const BASE = '/api';

export interface Garment {
  id: string;
  name: string | null;
  category: string;
  color: string | null;
  season: string | null;
  image_path: string;
  thumbnail_path: string;
  created_at: string;
}

export interface OutfitItem {
  garment_id: string;
  garment_name: string;
  category: string;
  color: string;
  image_path: string;
  thumbnail_path: string;
  position_x: number;
  position_y: number;
  scale: number;
  z_index: number;
}

export interface Outfit {
  id: string;
  name: string | null;
  created_at: string;
  worn_at: string | null;
  items?: OutfitItem[];
}

export async function uploadGarment(file: File, meta: { category: string; name?: string; color?: string; season?: string }): Promise<Garment> {
  const form = new FormData();
  form.append('image', file);
  form.append('category', meta.category);
  if (meta.name) form.append('name', meta.name);
  if (meta.color) form.append('color', meta.color);
  if (meta.season) form.append('season', meta.season);

  const res = await fetch(`${BASE}/garments`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getGarments(filters?: { category?: string }): Promise<Garment[]> {
  const params = new URLSearchParams();
  if (filters?.category) params.set('category', filters.category);
  const res = await fetch(`${BASE}/garments?${params}`);
  return res.json();
}

export async function deleteGarment(id: string): Promise<void> {
  await fetch(`${BASE}/garments/${id}`, { method: 'DELETE' });
}

export async function getOutfits(): Promise<Outfit[]> {
  const res = await fetch(`${BASE}/outfits`);
  return res.json();
}

export async function getOutfit(id: string): Promise<Outfit> {
  const res = await fetch(`${BASE}/outfits/${id}`);
  return res.json();
}

export async function createOutfit(name: string, items: { garment_id: string; position_x: number; position_y: number; scale: number; z_index: number }[]): Promise<Outfit> {
  const res = await fetch(`${BASE}/outfits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, items })
  });
  return res.json();
}

export interface DetectedItem {
  id: string;
  name: string;
  category: string;
  color: string;
  season: string;
  position: string;
}

export interface ScanResult {
  scan_image: string;
  items: DetectedItem[];
}

export async function scanCloset(file: File): Promise<ScanResult> {
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(`${BASE}/scan/detect`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function bulkSaveGarments(file: File, items: { name: string; category: string; color: string; season: string }[]): Promise<Garment[]> {
  const form = new FormData();
  form.append('image', file);
  form.append('items', JSON.stringify(items));
  const res = await fetch(`${BASE}/scan/bulk`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function markWorn(outfitId: string): Promise<Outfit> {
  const res = await fetch(`${BASE}/outfits/${outfitId}/wear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  return res.json();
}

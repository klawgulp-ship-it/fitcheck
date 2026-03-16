import { useState, useEffect, useRef } from 'react';
import { getGarments, uploadGarment, deleteGarment, Garment } from '../api';

const CATEGORIES = ['all', 'tops', 'bottoms', 'shoes', 'outerwear', 'accessories', 'other'];

export default function Closet() {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [category, setCategory] = useState('all');
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState({ name: '', category: 'tops', color: '', season: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadGarments();
  }, [category]);

  async function loadGarments() {
    const filters = category !== 'all' ? { category } : undefined;
    setGarments(await getGarments(filters));
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      await uploadGarment(file, meta);
      setShowUpload(false);
      setFile(null);
      setPreview(null);
      setMeta({ name: '', category: 'tops', color: '', season: '' });
      loadGarments();
    } catch (err) {
      console.error(err);
    }
    setUploading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this item?')) return;
    await deleteGarment(id);
    loadGarments();
  }

  return (
    <>
      <div className="tabs">
        {CATEGORIES.map(c => (
          <button key={c} className={`tab ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
            {c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      {garments.length === 0 ? (
        <div className="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.47a2 2 0 00-1.34-2.23z"/>
          </svg>
          <p>Your closet is empty.<br/>Tap + to add your first piece.</p>
        </div>
      ) : (
        <div className="garment-grid">
          {garments.map(g => (
            <div key={g.id} className="garment-card" onContextMenu={(e) => { e.preventDefault(); handleDelete(g.id); }}>
              <img src={`/uploads/${g.thumbnail_path}`} alt={g.name || g.category} loading="lazy" />
              <div className="label">{g.name || g.category}</div>
            </div>
          ))}
        </div>
      )}

      <button className="fab" onClick={() => setShowUpload(true)}>+</button>

      {showUpload && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowUpload(false); }}>
          <div className="modal">
            <h2>Add to Closet</h2>

            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />

            <div className="capture-area" onClick={() => fileRef.current?.click()}>
              {preview ? (
                <img src={preview} alt="Preview" />
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <p>Tap to take a photo or choose from gallery</p>
                </>
              )}
            </div>

            <div className="form-group">
              <label>Category</label>
              <div className="category-pills">
                {CATEGORIES.filter(c => c !== 'all').map(c => (
                  <button key={c} className={`pill ${meta.category === c ? 'active' : ''}`} onClick={() => setMeta({ ...meta, category: c })}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Name (optional)</label>
              <input placeholder="e.g. Black Nike hoodie" value={meta.name} onChange={e => setMeta({ ...meta, name: e.target.value })} />
            </div>

            <div className="form-group">
              <label>Color</label>
              <input placeholder="e.g. black, navy, floral" value={meta.color} onChange={e => setMeta({ ...meta, color: e.target.value })} />
            </div>

            <div className="form-group">
              <label>Season</label>
              <div className="category-pills">
                {['spring', 'summer', 'fall', 'winter', 'all'].map(s => (
                  <button key={s} className={`pill ${meta.season === s ? 'active' : ''}`} onClick={() => setMeta({ ...meta, season: s })}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn" onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? 'Adding...' : 'Add to Closet'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

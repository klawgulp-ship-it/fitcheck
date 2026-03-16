import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getGarments, getOutfit, createOutfit, Garment } from '../api';

interface PlacedItem {
  garment: Garment;
  x: number;
  y: number;
  scale: number;
}

export default function OutfitBuilder() {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [placed, setPlaced] = useState<PlacedItem[]>([]);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [outfitName, setOutfitName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    getGarments().then(setGarments);
    const id = params.get('id');
    if (id) {
      getOutfit(id).then(o => {
        if (o.name) setOutfitName(o.name);
        if (o.items) {
          setPlaced(o.items.map(item => ({
            garment: {
              id: item.garment_id,
              name: item.garment_name,
              category: item.category,
              color: item.color,
              image_path: item.image_path,
              thumbnail_path: item.thumbnail_path,
              season: null,
              created_at: ''
            },
            x: item.position_x,
            y: item.position_y,
            scale: item.scale
          })));
        }
      });
    }
  }, []);

  function addToCanvas(g: Garment) {
    setPlaced(prev => [...prev, { garment: g, x: 50, y: 50 + prev.length * 30, scale: 1 }]);
    setShowPicker(false);
  }

  function removeFromCanvas(idx: number) {
    setPlaced(prev => prev.filter((_, i) => i !== idx));
  }

  function handlePointerDown(idx: number, e: React.PointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragging(idx);
    setDragOffset({
      x: e.clientX - rect.left - placed[idx].x,
      y: e.clientY - rect.top - placed[idx].y
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (dragging === null) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;
    setPlaced(prev => prev.map((item, i) => i === dragging ? { ...item, x, y } : item));
  }

  function handlePointerUp() {
    setDragging(null);
  }

  async function handleSave() {
    if (placed.length === 0) return;
    setSaving(true);
    try {
      await createOutfit(
        outfitName || `Outfit ${new Date().toLocaleDateString()}`,
        placed.map((item, i) => ({
          garment_id: item.garment.id,
          position_x: item.x,
          position_y: item.y,
          scale: item.scale,
          z_index: i
        }))
      );
      navigate('/outfits');
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  }

  return (
    <>
      <div className="form-group">
        <input
          placeholder="Name this outfit..."
          value={outfitName}
          onChange={e => setOutfitName(e.target.value)}
          style={{ background: 'var(--surface)', border: 'none', fontSize: 18, fontWeight: 700 }}
        />
      </div>

      <div
        ref={canvasRef}
        className="outfit-canvas"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {placed.length === 0 && (
          <div className="empty" style={{ padding: 40 }}>
            <p>Tap the + below to add pieces from your closet</p>
          </div>
        )}
        {placed.map((item, idx) => (
          <div
            key={idx}
            className="outfit-item"
            style={{ left: item.x, top: item.y, transform: `scale(${item.scale})` }}
            onPointerDown={(e) => handlePointerDown(idx, e)}
            onDoubleClick={() => removeFromCanvas(idx)}
          >
            <img src={`/uploads/${item.garment.thumbnail_path}`} alt={item.garment.name || ''} draggable={false} />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="btn" style={{ flex: 1, background: 'var(--surface)' }} onClick={() => setShowPicker(true)}>
          + Add Piece
        </button>
        <button className="btn" style={{ flex: 1 }} onClick={handleSave} disabled={placed.length === 0 || saving}>
          {saving ? 'Saving...' : 'Save Outfit'}
        </button>
      </div>

      {showPicker && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowPicker(false); }}>
          <div className="modal">
            <h2>Pick a Piece</h2>
            {garments.length === 0 ? (
              <div className="empty">
                <p>Add items to your closet first</p>
              </div>
            ) : (
              <div className="garment-grid">
                {garments.map(g => (
                  <div key={g.id} className="garment-card" onClick={() => addToCanvas(g)}>
                    <img src={`/uploads/${g.thumbnail_path}`} alt={g.name || g.category} loading="lazy" />
                    <div className="label">{g.name || g.category}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

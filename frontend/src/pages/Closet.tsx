import { useState, useEffect, useRef } from 'react';
import { getGarments, uploadGarment, deleteGarment, scanCloset, bulkSaveGarments, suggestOutfits, createOutfit, Garment, DetectedItem, OutfitSuggestion } from '../api';

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

  // Scan state
  const [showScan, setShowScan] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const scanFileRef = useRef<HTMLInputElement>(null);

  // Outfit suggestion state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<OutfitSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [savingOutfit, setSavingOutfit] = useState<string | null>(null);

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

  // --- Scan functions ---

  function handleScanFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setScanFile(f);
    setScanPreview(URL.createObjectURL(f));
    setDetectedItems([]);
    setSelectedItems(new Set());
  }

  async function handleScan() {
    if (!scanFile) return;
    setScanning(true);
    try {
      const result = await scanCloset(scanFile);
      setDetectedItems(result.items);
      setSelectedItems(new Set(result.items.map(i => i.id)));
    } catch (err: any) {
      console.error(err);
      alert('Scan failed — try a clearer photo');
    }
    setScanning(false);
  }

  function toggleItem(id: string) {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateDetectedItem(id: string, field: string, value: string) {
    setDetectedItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  }

  async function handleBulkSave() {
    if (!scanFile || selectedItems.size === 0) return;
    setSaving(true);
    try {
      const itemsToSave = detectedItems
        .filter(i => selectedItems.has(i.id))
        .map(({ name, category, color, season, bbox }) => ({ name, category, color, season, bbox }));
      const saved = await bulkSaveGarments(scanFile, itemsToSave);

      // Close scan modal
      setShowScan(false);
      setScanFile(null);
      setScanPreview(null);
      setDetectedItems([]);
      setSelectedItems(new Set());
      loadGarments();

      // Auto-suggest outfits from the newly saved items
      if (saved.length >= 2) {
        setLoadingSuggestions(true);
        setShowSuggestions(true);
        try {
          const result = await suggestOutfits(saved.map(g => g.id));
          setSuggestions(result.outfits);
        } catch (err) {
          console.error('Suggestion failed:', err);
          setSuggestions([]);
        }
        setLoadingSuggestions(false);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save items');
    }
    setSaving(false);
  }

  async function handleSaveOutfit(suggestion: OutfitSuggestion) {
    setSavingOutfit(suggestion.name);
    try {
      const items = suggestion.items.map((g, i) => ({
        garment_id: g.id,
        position_x: 50 + (i % 2) * 150,
        position_y: 30 + Math.floor(i / 2) * 160,
        scale: 1,
        z_index: i,
      }));
      await createOutfit(suggestion.name, items);
      setSuggestions(prev => prev.filter(s => s.name !== suggestion.name));
      if (suggestions.length <= 1) setShowSuggestions(false);
    } catch (err) {
      console.error(err);
    }
    setSavingOutfit(null);
  }

  function closeScan() {
    setShowScan(false);
    setScanFile(null);
    setScanPreview(null);
    setDetectedItems([]);
    setSelectedItems(new Set());
    setEditingItem(null);
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

      {/* Two FABs: scan + single add */}
      <button className="fab fab-scan" onClick={() => setShowScan(true)} title="Scan Closet">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
          <path d="M2 7V2h5M17 2h5v5M22 17v5h-5M7 22H2v-5"/>
          <rect x="6" y="6" width="12" height="12" rx="1"/>
        </svg>
      </button>
      <button className="fab" onClick={() => setShowUpload(true)}>+</button>

      {/* Single upload modal */}
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

      {/* Scan Closet modal */}
      {showScan && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeScan(); }}>
          <div className="modal scan-modal">
            <h2>Scan Closet</h2>
            <input ref={scanFileRef} type="file" accept="image/*" capture="environment" onChange={handleScanFile} style={{ display: 'none' }} />

            {/* Step 1: Take photo */}
            {!detectedItems.length && (
              <>
                <div className="capture-area" onClick={() => scanFileRef.current?.click()}>
                  {scanPreview ? (
                    <img src={scanPreview} alt="Closet preview" />
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2 7V2h5M17 2h5v5M22 17v5h-5M7 22H2v-5"/>
                        <rect x="6" y="6" width="12" height="12" rx="1"/>
                      </svg>
                      <p>Take a wide shot of your closet, rack, or drawer</p>
                    </>
                  )}
                </div>
                <button className="btn" onClick={handleScan} disabled={!scanFile || scanning}>
                  {scanning ? 'AI is scanning...' : 'Scan for Items'}
                </button>
                {scanning && (
                  <div className="scan-progress">
                    <div className="scan-spinner"></div>
                    <p>Identifying clothes — sideways, folded, hanging — all of it...</p>
                  </div>
                )}
              </>
            )}

            {/* Step 2: Review detected items with cropped previews */}
            {detectedItems.length > 0 && (
              <>
                <div className="scan-preview-strip">
                  <img src={scanPreview!} alt="Scanned closet" />
                </div>

                <div className="scan-summary">
                  Found <strong>{detectedItems.length}</strong> items — tap to edit, uncheck to skip
                </div>

                <div className="detected-list">
                  {detectedItems.map(item => (
                    <div key={item.id} className={`detected-item ${selectedItems.has(item.id) ? 'selected' : 'deselected'}`}>
                      <div className="detected-check" onClick={() => toggleItem(item.id)}>
                        {selectedItems.has(item.id) ? (
                          <svg viewBox="0 0 24 24" fill="var(--accent)" width="22" height="22">
                            <rect width="24" height="24" rx="6"/>
                            <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" width="22" height="22">
                            <rect x="1" y="1" width="22" height="22" rx="6"/>
                          </svg>
                        )}
                      </div>

                      {/* Cropped preview thumbnail */}
                      {item.crop_image && (
                        <div className="detected-thumb">
                          <img src={`/uploads/${item.crop_image}`} alt={item.name} />
                        </div>
                      )}

                      <div className="detected-info" onClick={() => setEditingItem(editingItem === item.id ? null : item.id)}>
                        <div className="detected-name">{item.name}</div>
                        <div className="detected-meta">
                          <span className="detected-tag">{item.category}</span>
                          {item.color && <span className="detected-tag">{item.color}</span>}
                          <span className="detected-tag">{item.season}</span>
                        </div>
                        {item.position && <div className="detected-position">{item.position}</div>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Inline edit */}
                {editingItem && (() => {
                  const item = detectedItems.find(i => i.id === editingItem);
                  if (!item) return null;
                  return (
                    <div className="detected-edit">
                      <div className="form-group">
                        <label>Name</label>
                        <input value={item.name} onChange={e => updateDetectedItem(item.id, 'name', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label>Category</label>
                        <div className="category-pills">
                          {CATEGORIES.filter(c => c !== 'all').map(c => (
                            <button key={c} className={`pill ${item.category === c ? 'active' : ''}`}
                              onClick={() => updateDetectedItem(item.id, 'category', c)}>
                              {c.charAt(0).toUpperCase() + c.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Color</label>
                        <input value={item.color} onChange={e => updateDetectedItem(item.id, 'color', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label>Season</label>
                        <div className="category-pills">
                          {['spring', 'summer', 'fall', 'winter', 'all'].map(s => (
                            <button key={s} className={`pill ${item.season === s ? 'active' : ''}`}
                              onClick={() => updateDetectedItem(item.id, 'season', s)}>
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="scan-actions">
                  <button className="btn btn-outline" onClick={closeScan}>Cancel</button>
                  <button className="btn" onClick={handleBulkSave} disabled={selectedItems.size === 0 || saving}>
                    {saving ? 'Saving...' : `Add ${selectedItems.size} Items`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Outfit Suggestions modal */}
      {showSuggestions && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowSuggestions(false); }}>
          <div className="modal scan-modal">
            <h2>Outfit Ideas</h2>

            {loadingSuggestions ? (
              <div className="scan-progress">
                <div className="scan-spinner"></div>
                <p>Putting fits together from your closet...</p>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="empty" style={{ padding: '20px 0' }}>
                <p>No outfit combos found — add more pieces!</p>
              </div>
            ) : (
              <div className="suggestion-list">
                {suggestions.map((s, idx) => (
                  <div key={idx} className="suggestion-card">
                    <div className="suggestion-header">
                      <h3>{s.name}</h3>
                      <button
                        className="btn btn-small"
                        onClick={() => handleSaveOutfit(s)}
                        disabled={savingOutfit === s.name}
                      >
                        {savingOutfit === s.name ? 'Saving...' : 'Save Fit'}
                      </button>
                    </div>
                    <div className="suggestion-items">
                      {s.items.map(g => (
                        <div key={g.id} className="suggestion-piece">
                          <img src={`/uploads/${g.thumbnail_path}`} alt={g.name || g.category} />
                          <span>{g.name || g.category}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => setShowSuggestions(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}

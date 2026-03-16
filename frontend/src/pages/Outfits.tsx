import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOutfits, markWorn, Outfit } from '../api';

export default function Outfits() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadOutfits();
  }, []);

  async function loadOutfits() {
    setOutfits(await getOutfits());
  }

  async function handleWear(id: string) {
    await markWorn(id);
    loadOutfits();
  }

  return (
    <>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Your Outfits</h2>

      {outfits.length === 0 ? (
        <div className="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
            <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
          </svg>
          <p>No outfits yet.<br/>Head to Build to create your first fit.</p>
        </div>
      ) : (
        <div className="outfit-list">
          {outfits.map(o => (
            <div key={o.id} className="outfit-card" onClick={() => navigate(`/build?id=${o.id}`)}>
              <div className="outfit-info">
                <h3>{o.name || 'Untitled Outfit'}</h3>
                <p>
                  {o.worn_at ? `Last worn: ${new Date(o.worn_at).toLocaleDateString()}` : 'Never worn'}
                </p>
              </div>
              <button
                className="pill active"
                style={{ flexShrink: 0 }}
                onClick={(e) => { e.stopPropagation(); handleWear(o.id); }}
              >
                Wore it
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

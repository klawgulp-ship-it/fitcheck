import { Routes, Route, NavLink } from 'react-router-dom';
import Closet from './pages/Closet';
import Outfits from './pages/Outfits';
import OutfitBuilder from './pages/OutfitBuilder';

export default function App() {
  return (
    <div className="app">
      <div className="header">
        <h1>FitCheck</h1>
      </div>

      <div className="content">
        <Routes>
          <Route path="/" element={<Closet />} />
          <Route path="/outfits" element={<Outfits />} />
          <Route path="/build" element={<OutfitBuilder />} />
        </Routes>
      </div>

      <nav className="nav">
        <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.47a2 2 0 00-1.34-2.23z"/>
          </svg>
          Closet
        </NavLink>
        <NavLink to="/outfits" className={({ isActive }) => isActive ? 'active' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
            <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
          </svg>
          Outfits
        </NavLink>
        <NavLink to="/build" className={({ isActive }) => isActive ? 'active' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          Build
        </NavLink>
      </nav>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import DataCollection from './pages/DataCollection';
import FeatureEngineering from './pages/FeatureEngineering';
import MLModels from './pages/MLModels';
import SignalGeneration from './pages/SignalGeneration';
import Backtesting from './pages/Backtesting';
import ShapAnalysis from './pages/ShapAnalysis';
import './App.css';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract active page from URL path (e.g. '/features' -> 'features')
  const activePage = location.pathname.substring(1) || 'data';

  const [serverOnline, setServerOnline] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Poll Flask server to verify connection status
  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const res = await fetch('/api/stocks');
        if (res.ok) {
          setServerOnline(true);
        } else {
          setServerOnline(false);
        }
      } catch (err) {
        setServerOnline(false);
      }
    };

    checkServerStatus();
    const interval = setInterval(checkServerStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const navItems = [
    { id: 'data', label: 'Data Collection', abbr: 'DC' },
    { id: 'features', label: 'Feature Engineering', abbr: 'FE' },
    { id: 'models', label: 'ML Models', abbr: 'ML' },
    { id: 'signals', label: 'Signal Generation', abbr: 'SG' },
    { id: 'backtest', label: 'Backtesting', abbr: 'BT' },
    { id: 'shap', label: 'SHAP Analysis', abbr: 'SH' }
  ];

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          QuantML <span>Platform</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <div
              key={item.id}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => navigate(`/${item.id}`)}
            >
              <span className="nav-icon">{item.abbr}</span>
              <span className="nav-label">{item.label}</span>
            </div>
          ))}
        </nav>
        <footer className="sidebar-footer">
          <div className="status-indicator">
            <span className={`status-dot ${serverOnline ? 'online' : 'offline'}`}></span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {serverOnline ? 'Backend Connected' : 'Server Offline'}
            </span>
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            API: http://127.0.0.1:5000
          </span>
        </footer>
      </aside>

      {/* Main Content View */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/data" replace />} />
          <Route path="/data" element={<DataCollection onStockDownloaded={triggerRefresh} />} />
          <Route path="/features" element={<FeatureEngineering refreshTrigger={refreshTrigger} />} />
          <Route path="/models" element={<MLModels refreshTrigger={refreshTrigger} />} />
          <Route path="/signals" element={<SignalGeneration refreshTrigger={refreshTrigger} />} />
          <Route path="/backtest" element={<Backtesting refreshTrigger={refreshTrigger} />} />
          <Route path="/shap" element={<ShapAnalysis refreshTrigger={refreshTrigger} />} />
          <Route path="*" element={<Navigate to="/data" replace />} />
        </Routes>
      </main>
    </div>
  );
}

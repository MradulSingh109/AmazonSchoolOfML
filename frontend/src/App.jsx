import React, { useState, useEffect } from 'react';
import DataCollection from './pages/DataCollection';
import FeatureEngineering from './pages/FeatureEngineering';
import MLModels from './pages/MLModels';
import SignalGeneration from './pages/SignalGeneration';
import Backtesting from './pages/Backtesting';
import ShapAnalysis from './pages/ShapAnalysis';
import './App.css';

export default function App() {
  const [activePage, setActivePage] = useState('data');
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

  // Render Page Content based on Active Sidebar Choice
  const renderActivePage = () => {
    switch (activePage) {
      case 'data':
        return <DataCollection onStockDownloaded={triggerRefresh} />;
      case 'features':
        return <FeatureEngineering refreshTrigger={refreshTrigger} />;
      case 'models':
        return <MLModels refreshTrigger={refreshTrigger} />;
      case 'signals':
        return <SignalGeneration refreshTrigger={refreshTrigger} />;
      case 'backtest':
        return <Backtesting refreshTrigger={refreshTrigger} />;
      case 'shap':
        return <ShapAnalysis refreshTrigger={refreshTrigger} />;
      default:
        return <DataCollection onStockDownloaded={triggerRefresh} />;
    }
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
              onClick={() => setActivePage(item.id)}
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
      <main className="main-content">{renderActivePage()}</main>
    </div>
  );
}

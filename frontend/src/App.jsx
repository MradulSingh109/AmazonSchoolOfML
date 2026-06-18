import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import DataCollection from './pages/DataCollection';
import FeatureEngineering from './pages/FeatureEngineering';
import MarketRegimes from './pages/MarketRegimes';
import MLModels from './pages/MLModels';
import SignalGeneration from './pages/SignalGeneration';
import Backtesting from './pages/Backtesting';
import ShapAnalysis from './pages/ShapAnalysis';
import Strategies from './pages/Strategies';
import StrategyDetail from './pages/StrategyDetail';
import './App.css';
import { Hero } from '@/components/ui/animated-hero';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract active page from URL path (e.g. '/features' -> 'features')
  const path = location.pathname.substring(1);
  const activePage = path === '' ? 'home' : (path.startsWith('strategies') ? 'strategies' : path);

  const mlPages = ['data', 'features', 'regime', 'models', 'signals', 'backtest', 'shap'];
  const isMlActive = mlPages.includes(activePage);
  const isStrategiesActive = activePage === 'strategies';

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

  const mlSubItems = [
    { id: 'data', label: '1. Data Collection' },
    { id: 'features', label: '2. Feature Engineering' },
    { id: 'regime', label: '3. Market Regimes' },
    { id: 'models', label: '4. ML Models' },
    { id: 'signals', label: '5. Signal Generation' },
    { id: 'backtest', label: '6. Backtesting' },
    { id: 'shap', label: '7. SHAP Analysis' }
  ];

  const isHomePage = activePage === 'home';

  const renderNavbar = (isGlass = false) => {
    return (
      <header 
        className="header-navbar"
        style={isGlass ? {
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        } : {}}
      >
        <div className="navbar-brand" onClick={() => navigate('/')}>
          <div className="navbar-logo" style={isGlass ? { color: '#ffffff' } : {}}>
            Apollo
          </div>
        </div>
        
        <nav className="navbar-nav">
          <div
            className={`navbar-item ${isMlActive ? 'active' : ''}`}
            style={isGlass ? { color: 'rgba(255, 255, 255, 0.85)' } : {}}
            onClick={() => navigate('/data')}
          >
            ML Models
          </div>
          <div
            className={`navbar-item ${isStrategiesActive ? 'active-strategies' : ''}`}
            style={isGlass ? { color: 'rgba(255, 255, 255, 0.85)' } : {}}
            onClick={() => navigate('/strategies')}
          >
            Intraday Strategies
          </div>
        </nav>

        <div className="navbar-right">
          <div className="status-indicator">
            <span className={`status-dot ${serverOnline ? 'online' : 'offline'}`}></span>
            <span style={{ color: isGlass ? 'rgba(255, 255, 255, 0.8)' : 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>
              {serverOnline ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>
      </header>
    );
  };

  return (
    <div 
      className="app-layout"
      style={isHomePage ? { backgroundColor: '#000000ff' } : {}}
    >
      {renderNavbar(isHomePage)}

      {isHomePage && (
        <div 
          className="hero-wrapper"
          style={{
            backgroundImage: 'url("/buildings-bg-upscaled.jpg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            marginTop: '-70px',
            zIndex: 1
          }}
        >
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            alignItems: 'center', 
            color: '#ffffff', 
            textAlign: 'center', 
            padding: '40px 24px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.85) 100%)'
          }}>
            <Hero />
          </div>
        </div>
      )}

      {/* Main Content View */}
      <main className="main-content">
        {/* Secondary Sub-Navbar for ML Pipeline Stages */}
        {isMlActive && (
          <nav className="sub-navbar">
            {mlSubItems.map((item) => (
              <div
                key={item.id}
                className={`sub-nav-item ${activePage === item.id ? 'active' : ''}`}
                onClick={() => navigate(`/${item.id}`)}
              >
                {item.label}
              </div>
            ))}
          </nav>
        )}

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/data" element={<DataCollection onStockDownloaded={triggerRefresh} />} />
          <Route path="/features" element={<FeatureEngineering refreshTrigger={refreshTrigger} />} />
          <Route path="/regime" element={<MarketRegimes refreshTrigger={refreshTrigger} />} />
          <Route path="/models" element={<MLModels refreshTrigger={refreshTrigger} />} />
          <Route path="/signals" element={<SignalGeneration refreshTrigger={refreshTrigger} />} />
          <Route path="/backtest" element={<Backtesting refreshTrigger={refreshTrigger} />} />
          <Route path="/shap" element={<ShapAnalysis refreshTrigger={refreshTrigger} />} />
          <Route path="/strategies" element={<Strategies />} />
          <Route path="/strategies/:strategyId" element={<StrategyDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

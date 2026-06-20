import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Strategies() {
  const navigate = useNavigate();

  const strategyList = [
    {
      id: 'itsm',
      name: 'Intraday Time Series Momentum (ITSM)',
      category: 'Quantitative ML',
      // difficulty: 'Advanced',
      risk: 'Medium',
      reward: 'High',
      desc: 'Exploits overnight gap signals and midday institutional order execution trends to trade the final hour of trading (14:40 to 15:10 IST). Supports machine learning regressors, dynamic ATR stops, and trailing stops.',
      accent: '#ffffffff',
      // accentGlow: 'rgba(16, 185, 129, 0.1)'
    },
    {
      id: 'orb',
      name: 'Opening Range Breakout (ORB)',
      category: 'Breakout & Momentum',
      // difficulty: 'Intermediate',
      risk: 'High',
      reward: 'High',
      desc: 'Monitors the High and Low boundaries created in the first N minutes of market open (e.g. 15, 30, or 60 mins) and enters a trade in the direction of the breakout. Automatically squares off at market close.',
      accent: '#ffffffff',
      // accentGlow: 'rgba(139, 92, 246, 0.1)'
    }
  ];

  return (
    <div className="animate-fade-in" style={{
      // background: 'radial-gradient(circle at 50% 0%, rgba(139, 92, 246, 0.12) 0%, rgba(9, 9, 11, 1) 75%)',
      color: '#f4f4f5',
      padding: '20px',
      // borderRadius: '24px',
      // border: '1px solid rgba(255, 255, 255, 0.05)',
      // boxShadow: '0 20px 80px rgba(0, 0, 0, 0.65)',
      minHeight: '80vh'
    }}>
      <header className="page-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '24px', marginBottom: '32px' }}>
        <h1 style={{
          color: '#ffffff',
          fontSize: '32px',
          fontWeight: '800',
          background: 'linear-gradient(to right, #ffffff, #a1a1aa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: 0
        }}>
          Algorithmic Strategy Suite
        </h1>
        <p style={{ color: '#a1a1aa', fontSize: '15px', marginTop: '8px' }}>
          Select a mathematical intraday trading strategy, customize your risk parameters, and run automated backtests on historical datasets.
        </p>
      </header>

      {/* Strategies Grid */}
      <section className="grid-3" style={{ marginTop: '32px', gap: '24px' }}>
        {strategyList.map((strategy) => (
          <div
            key={strategy.id}
            className="card animate-fade-in"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '360px',
              borderTop: `4px solid ${strategy.accent}`,
              background: 'rgba(24, 24, 27, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderTopColor: strategy.accent,
              borderRadius: '16px',
              padding: '28px',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
              transition: 'transform 0.25s ease, border-color 0.25s ease, background-color 0.25s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.backgroundColor = 'rgba(24, 24, 27, 0.8)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.backgroundColor = 'rgba(24, 24, 27, 0.6)';
            }}
          >
            <div>
              {/* Header Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <span className="badge" style={{ backgroundColor: strategy.accentGlow, color: strategy.accent, border: `1px solid ${strategy.accent}30`, fontWeight: '600' }}>
                  {strategy.category}
                </span>
                <span style={{ fontSize: '12px', color: '#71717a', fontFamily: 'var(--font-mono)' }}>
                  {strategy.difficulty}
                </span>
              </div>

              {/* Title & Desc */}
              <h2 style={{ fontSize: '19px', fontWeight: '700', margin: '0 0 12px 0', color: '#ffffff' }}>
                {strategy.name}
              </h2>
              <p style={{ color: '#a1a1aa', fontSize: '13.5px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
                {strategy.desc}
              </p>

              {/* Performance / Config details */}
              <div style={{ display: 'flex', gap: '20px', fontSize: '12px', marginBottom: '28px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
                <div>
                  <span style={{ color: '#71717a', display: 'block', textTransform: 'uppercase', fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px' }}>Risk Profile</span>
                  <span style={{ fontWeight: 600, color: strategy.risk === 'High' ? '#ef4444' : '#f59e0b' }}>{strategy.risk}</span>
                </div>
                <div>
                  <span style={{ color: '#71717a', display: 'block', textTransform: 'uppercase', fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px' }}>Target Reward</span>
                  <span style={{ fontWeight: 600, color: '#10b981' }}>{strategy.reward}</span>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              className="btn"
              style={{
                width: '100%',
                background: '#000000',
                color: '#ffffff',
                border: '1px solid #27272a',
                padding: '12px',
                borderRadius: '9999px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onClick={() => navigate(`/strategies/${strategy.id}`)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.color = '#000000';
                e.currentTarget.style.borderColor = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#000000';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.borderColor = '#27272a';
              }}
            >
              <span>Configure & Backtest</span>
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

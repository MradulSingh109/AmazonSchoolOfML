import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Strategies() {
  const navigate = useNavigate();

  const strategyList = [
    {
      id: 'itsm',
      name: 'Intraday Time Series Momentum (ITSM)',
      category: 'Quantitative ML',
      difficulty: 'Advanced',
      risk: 'Medium',
      reward: 'High',
      desc: 'Exploits overnight gap signals and midday institutional order execution trends to trade the final hour of trading (14:40 to 15:10 IST). Supports machine learning regressors, dynamic ATR stops, and trailing stops.',
      accent: 'var(--accent-green)',
      accentGlow: 'rgba(34, 197, 94, 0.08)'
    },
    {
      id: 'orb',
      name: 'Opening Range Breakout (ORB)',
      category: 'Breakout & Momentum',
      difficulty: 'Intermediate',
      risk: 'High',
      reward: 'High',
      desc: 'Monitors the High and Low boundaries created in the first N minutes of market open (e.g. 15, 30, or 60 mins) and enters a trade in the direction of the breakout. Automatically squares off at market close.',
      accent: 'var(--accent-purple)',
      accentGlow: 'rgba(124, 58, 237, 0.08)'
    },
    {
      id: 'vwap',
      name: 'VWAP Momentum Crossover',
      category: 'Trend Following',
      difficulty: 'Intermediate',
      risk: 'Medium',
      reward: 'Medium',
      desc: 'Utilizes the Volume Weighted Average Price (VWAP) as a dynamic indicator of institutional support and resistance. Generates buy triggers when price crosses above VWAP and short triggers when crossing below.',
      accent: 'var(--accent-cyan)',
      accentGlow: 'rgba(8, 145, 178, 0.08)'
    },
    {
      id: 'rsi-reversion',
      name: 'Intraday RSI Mean Reversion',
      category: 'Mean Reversion',
      difficulty: 'Beginner',
      risk: 'Medium',
      reward: 'Medium',
      desc: 'Capitalizes on overextended intraday price swings. Initiates long positions when the Relative Strength Index (RSI) dips below oversold boundaries (e.g. 30) and short positions when it climbs above overbought boundaries (e.g. 70).',
      accent: 'var(--accent-amber)',
      accentGlow: 'rgba(217, 119, 6, 0.06)'
    }
  ];

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <h1>Algorithmic Strategy Suite</h1>
        <p>Select a mathematical intraday trading strategy, customize your risk parameters, and run automated backtests on historical datasets.</p>
      </header>

      {/* Strategies Grid */}
      <section className="grid-3" style={{ marginTop: '32px' }}>
        {strategyList.map((strategy) => (
          <div
            key={strategy.id}
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '360px',
              borderTop: `4px solid ${strategy.accent}`,
              transition: 'transform 0.25s ease, border-color 0.25s ease',
            }}
          >
            <div>
              {/* Header Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <span className="badge" style={{ backgroundColor: strategy.accentGlow, color: strategy.accent, border: `1px solid ${strategy.accent}30` }}>
                  {strategy.category}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {strategy.difficulty}
                </span>
              </div>

              {/* Title & Desc */}
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 10px 0', color: 'var(--text-primary)' }}>
                {strategy.name}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
                {strategy.desc}
              </p>

              {/* Performance / Config details */}
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', marginBottom: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontSize: '10px', fontWeight: 600 }}>Risk Profile</span>
                  <span style={{ fontWeight: 600, color: strategy.risk === 'High' ? 'var(--accent-red)' : 'var(--accent-amber)' }}>{strategy.risk}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontSize: '10px', fontWeight: 600 }}>Target Reward</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent-green)' }}>{strategy.reward}</span>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              className="btn"
              style={{
                width: '100%',
                background: strategy.accent,
                color: '#ffffff',
                boxShadow: `0 4px 12px 0 ${strategy.accent}20`
              }}
              onClick={() => navigate(`/strategies/${strategy.id}`)}
            >
              <span>Configure & Backtest</span>
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

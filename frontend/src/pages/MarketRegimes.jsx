import React, { useState, useEffect } from 'react';
import AnalyticsChart from '../components/AnalyticsChart';

export default function MarketRegimes({ refreshTrigger }) {
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [nRegimes, setNRegimes] = useState(3);
  const [method, setMethod] = useState('gmm');
  
  const [detecting, setDetecting] = useState(false);
  const [status, setStatus] = useState({ type: null, message: '' });
  const [result, setResult] = useState(null);
  const [activeRegimeModels, setActiveRegimeModels] = useState([]);

  // Fetch list of processed datasets
  const fetchDatasets = async () => {
    try {
      const res = await fetch('/api/features/list');
      const data = await res.json();
      if (data.success) {
        setDatasets(data.datasets);
      }
    } catch (err) {
      console.error('Failed to load datasets:', err);
    }
  };

  // Fetch list of completed regime models
  const fetchRegimeModels = async () => {
    try {
      const res = await fetch('/api/regime/list');
      const data = await res.json();
      if (data.success) {
        setActiveRegimeModels(data.regime_models);
      }
    } catch (err) {
      console.error('Failed to load regime models:', err);
    }
  };

  useEffect(() => {
    fetchDatasets();
    fetchRegimeModels();
  }, [refreshTrigger]);

  const handleDetect = async (e) => {
    if (e) e.preventDefault();

    if (!selectedDataset) {
      setStatus({ type: 'error', message: 'Please select an engineered dataset.' });
      return;
    }

    setDetecting(true);
    setStatus({ type: 'loading', message: `Fitting ${method.toUpperCase()} with ${nRegimes} clusters on ${selectedDataset.toUpperCase()}...` });
    setResult(null);

    try {
      const res = await fetch('/api/regime/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedDataset,
          n_regimes: parseInt(nRegimes),
          method: method
        })
      });
      const data = await res.json();

      if (data.success) {
        setStatus({ type: 'success', message: data.message });
        setResult(data);
        fetchRegimeModels(); // Refresh list
      } else {
        setStatus({ type: 'error', message: data.message || 'Regime detection failed.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Error connecting to server: ' + err.message });
    } finally {
      setDetecting(false);
    }
  };

  // Define colors for regime visualization
  const regimeColors = {
    0: 'rgba(239, 68, 68, 0.13)',   // Bear: Soft Red
    1: 'rgba(148, 163, 184, 0.12)',  // Sideways: Soft Gray
    2: 'rgba(16, 185, 129, 0.13)',   // Bull: Soft Green
    3: 'rgba(217, 70, 239, 0.13)',   // Alternative State: Soft Purple
    4: 'rgba(14, 165, 233, 0.13)',   // Alternative State: Soft Blue
  };

  const getPriceChartData = () => {
    if (!result) return null;
    return {
      labels: result.dates,
      datasets: [
        {
          label: 'Stock Price',
          data: result.close,
          borderColor: '#0f172a',
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.1
        }
      ]
    };
  };

  // Custom Chart.js plugin to draw vertical bands in the background for active regimes
  const regimeBackgroundPlugin = {
    id: 'regimeBackground',
    beforeDraw: (chart) => {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !result || !result.labels) return;

      const labels = result.labels;
      const count = labels.length;
      ctx.save();

      const xScale = scales.x;
      const yAxis = scales.y;

      for (let i = 0; i < count - 1; i++) {
        const regimeId = labels[i];
        const color = regimeColors[regimeId] || 'rgba(0, 0, 0, 0)';

        const xStart = xScale.getPixelForValue(result.dates[i]);
        const xEnd = xScale.getPixelForValue(result.dates[i + 1]);
        const stripWidth = Math.max(0.5, xEnd - xStart);

        if (xStart >= chartArea.left && xEnd <= chartArea.right) {
          ctx.fillStyle = color;
          ctx.fillRect(xStart, chartArea.top, stripWidth, chartArea.bottom - chartArea.top);
        }
      }
      ctx.restore();
    }
  };

  const getStatsArray = () => {
    if (!result?.stats) return [];
    return Object.entries(result.stats).map(([name, s]) => ({
      name,
      ...s
    })).sort((a, b) => a.regime_id - b.regime_id);
  };

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <h1>Market Regime Detection</h1>
        <p>Unsupervised clustering (Gaussian Mixture Models / K-Means) to identify historical price regimes</p>
      </header>

      {/* Control Card */}
      <section className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <div>
            <h2>Run Regime Detection</h2>
            <span>Apply unsupervised clustering on macro trend & volatility features</span>
          </div>
        </div>

        <form onSubmit={handleDetect}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="select-regime-stock">Select Processed Dataset</label>
              <select
                id="select-regime-stock"
                value={selectedDataset}
                onChange={(e) => setSelectedDataset(e.target.value)}
              >
                <option value="">Choose an engineered dataset</option>
                {datasets.map((d) => (
                  <option key={d.filename} value={d.symbol.toLowerCase()}>
                    {d.symbol} ({d.rows.toLocaleString()} rows)
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="select-clusters">Number of Regimes (K)</label>
              <select
                id="select-clusters"
                value={nRegimes}
                onChange={(e) => setNRegimes(e.target.value)}
              >
                <option value={3}>3 Regimes (Bull / Bear / Sideways)</option>
                <option value={2}>2 Regimes (Trend / Mean-Revert)</option>
                <option value={4}>4 Regimes</option>
                <option value={5}>5 Regimes</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="select-method">Clustering Algorithm</label>
              <select
                id="select-method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="gmm">Gaussian Mixture Model (Recommended)</option>
                <option value="kmeans">K-Means (Hard Boundaries)</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={detecting}
              style={{ width: '220px', height: '46px' }}
            >
              Detect Regimes
            </button>
          </div>
        </form>

        {status.type && (
          <div className={`status-bar ${status.type}`}>
            {status.type === 'loading' && <div className="spinner"></div>}
            <span>{status.message}</span>
          </div>
        )}
      </section>

      {/* Visualizer and Stats Panel */}
      {result && (
        <div style={{ marginTop: '24px' }}>
          
          {/* Regime Timeline Chart */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-header">
              <div>
                <h2>Regime Timeline Chart</h2>
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'rgba(12, 255, 174, 0.4)' }}></span>
                    Bull Regime
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'rgba(148, 163, 184, 0.4)' }}></span>
                    Sideways Regime
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'rgba(255, 0, 0, 0.4)' }}></span>
                    Bear Regime
                  </span>
                </div>
              </div>
            </div>

            <div style={{ height: '350px', position: 'relative', backgroundColor: '#ffffff', borderRadius: '8px', padding: '16px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}>
              <AnalyticsChart
                type="line"
                data={getPriceChartData()}
                plugins={[regimeBackgroundPlugin]}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: 'rgba(0, 0, 0, 0.05)' } }
                  }
                }}
                height={318}
              />
            </div>
          </div>

          {/* Regime Statistics Grid */}
          <div className="grid-3">
            {getStatsArray().map((regime) => {
              const colors = [
                { text: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.2)' }, // Bear
                { text: '#64748b', bg: 'rgba(100, 116, 139, 0.1)', border: 'rgba(100, 116, 139, 0.2)' }, // Sideways
                { text: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.2)' }, // Bull
                { text: '#d946ef', bg: 'rgba(217, 70, 239, 0.1)', border: 'rgba(217, 70, 239, 0.2)' }, // Alt
                { text: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)', border: 'rgba(14, 165, 233, 0.2)' }, // Alt
              ];

              const currentTheme = colors[regime.regime_id % colors.length];

              return (
                <div 
                  key={regime.name} 
                  className="card"
                  style={{
                    // border: `.5px solid #ffffffff`,
                    background: `linear-gradient(135deg, var(--card-bg), ${currentTheme.bg})`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: currentTheme.text }}>
                      {regime.name.toUpperCase()} REGIME
                    </h3>
                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', backgroundColor: currentTheme.border, color: currentTheme.text }}>
                      Cluster #{regime.regime_id}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Duration</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{regime.days_count} Days ({regime.percentage}%)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Annualized Return</span>
                      <span style={{ fontWeight: 600, color: regime.avg_return_annualized >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {regime.avg_return_annualized}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Annualized Volatility</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{regime.avg_volatility_annualized}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Average ADX</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{regime.avg_adx}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Regime Models Table */}
      <section className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <div>
            <h2>Saved Regime Models</h2>
            <span>Unsupervised models stored on the server</span>
          </div>
        </div>

        <div className="table-wrapper">
          <table style={{background:'black'}}>
            <thead>
              <tr style={{background:'white'}}>
                <th style={{color:'black'}}>Stock</th>
                <th style={{color:'black'}}>Method</th>
                <th style={{color:'black'}}>Clusters (K)</th>
                <th style={{color:'black'}}>Bear Count</th>
                <th style={{color:'black'}}>Sideways Count</th>
                <th style={{color:'black'}}>Bull Count</th>
              </tr>
            </thead>
            <tbody>
              {activeRegimeModels.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No regime models generated yet. Run detection above.
                  </td>
                </tr>
              ) : (
                activeRegimeModels.map((m) => (
                  <tr key={m.filename}>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m.symbol}</td>
                    <td>{m.method.toUpperCase()}</td>
                    <td>{m.n_regimes}</td>
                    <td style={{ color: 'var(--accent-red)' }}>
                      {m.stats['Bear']?.days_count || '-'} days
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {m.stats['Sideways']?.days_count || '-'} days
                    </td>
                    <td style={{ color: 'var(--accent-green)' }}>
                      {m.stats['Bull']?.days_count || '-'} days
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

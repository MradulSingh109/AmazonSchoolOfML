import React, { useState, useEffect, useRef } from 'react';

export default function ShapAnalysis({ refreshTrigger }) {
  const [stocks, setStocks] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedStock, setSelectedStock] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [status, setStatus] = useState({ type: null, message: '' });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const canvasRef = useRef(null);

  const fetchData = async () => {
    try {
      const resStocks = await fetch('/api/features/list');
      const dataStocks = await resStocks.json();
      if (dataStocks.success) {
        setStocks(dataStocks.datasets);
      }

      const resModels = await fetch('/api/models/list');
      const dataModels = await resModels.json();
      if (dataModels.success) {
        setModels(dataModels.models);
      }
    } catch (err) {
      console.error('Failed to load SHAP options:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  const handleStockChange = (e) => {
    const stockVal = e.target.value;
    setSelectedStock(stockVal);

    if (!stockVal) {
      setSelectedModel('');
      return;
    }

    const prefix = stockVal.toLowerCase() + '_';
    const matched = models.find((m) => m.filename.toLowerCase().startsWith(prefix));
    if (matched) {
      setSelectedModel(matched.filename);
    } else {
      setSelectedModel('');
    }
  };

  const handleRunShap = async (e) => {
    if (e) e.preventDefault();

    if (!selectedStock || !selectedModel) {
      setStatus({ type: 'error', message: 'Please select a dataset stock and a trained model.' });
      return;
    }

    setRunning(true);
    setStatus({ type: 'loading', message: 'Calculating SHAP values (TreeExplainer/LinearExplainer)...' });
    setResult(null);

    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedStock,
          model_filename: selectedModel
        })
      });
      const data = await res.json();

      if (data.success) {
        setStatus({ type: 'success', message: 'SHAP analysis completed successfully.' });
        setResult(data);
      } else {
        setStatus({ type: 'error', message: data.message });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Error generating explainability: ' + err.message });
    } finally {
      setRunning(false);
    }
  };

  // Re-draw beeswarm plot when result changes
  useEffect(() => {
    if (!result || !canvasRef.current) return;
    drawShapBeeswarm(result);
  }, [result]);

  const drawShapBeeswarm = (data) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    
    // Scale for high-DPI screens
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Light-theme background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const features = data.feature_impact.map((fi) => fi.feature); // Sorted by impact
    const beeswarm = data.beeswarm;

    const leftMargin = 110;
    const rightMargin = 40;
    const topMargin = 30;
    const bottomMargin = 40;
    const plotWidth = width - leftMargin - rightMargin;
    const plotHeight = height - topMargin - bottomMargin;

    const rowHeight = plotHeight / features.length;

    // Draw center vertical line (SHAP value = 0)
    const zeroX = leftMargin + plotWidth / 2;
    ctx.beginPath();
    ctx.moveTo(zeroX, topMargin);
    ctx.lineTo(zeroX, topMargin + plotHeight);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Find max absolute SHAP value for scaling the horizontal axis
    let maxAbsShap = 0.001;
    features.forEach((feat) => {
      if (beeswarm[feat]) {
        beeswarm[feat].forEach((pt) => {
          const absVal = Math.abs(pt.shap);
          if (absVal > maxAbsShap) maxAbsShap = absVal;
        });
      }
    });
    maxAbsShap *= 1.1; // Add padding

    // Draw X-axis ticks
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = '9px JetBrains Mono';
    for (let val of [-maxAbsShap, -maxAbsShap / 2, 0, maxAbsShap / 2, maxAbsShap]) {
      const x = leftMargin + ((val + maxAbsShap) / (2 * maxAbsShap)) * plotWidth;
      ctx.fillText(val.toFixed(3), x, topMargin + plotHeight + 16);

      // Tick mark
      ctx.beginPath();
      ctx.moveTo(x, topMargin + plotHeight);
      ctx.lineTo(x, topMargin + plotHeight + 4);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.stroke();
    }

    // Draw lanes, labels, guide lines, and points
    features.forEach((feat, laneIdx) => {
      const centerY = topMargin + laneIdx * rowHeight + rowHeight / 2;

      // Lane labels
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10px Inter';
      ctx.fillText(feat, leftMargin - 15, centerY);

      // Horizontal track guideline
      ctx.beginPath();
      ctx.moveTo(leftMargin, centerY);
      ctx.lineTo(leftMargin + plotWidth, centerY);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.03)';
      ctx.stroke();

      const points = beeswarm[feat] || [];

      // Map to pixel coordinates
      const pointsWithCoords = points.map((pt) => {
        const x = leftMargin + ((pt.shap + maxAbsShap) / (2 * maxAbsShap)) * plotWidth;
        return {
          x,
          normVal: pt.normalized_value,
          shap: pt.shap
        };
      });

      // Beeswarm clustering logic (stack overlapping dots)
      const binSize = 6;
      const bins = {};
      pointsWithCoords.forEach((pt) => {
        const binIdx = Math.round(pt.x / binSize);
        if (!bins[binIdx]) bins[binIdx] = [];
        bins[binIdx].push(pt);
      });

      // Draw dots
      Object.keys(bins).forEach((binIdx) => {
        const ptsInBin = bins[binIdx];
        ptsInBin.forEach((pt, idx) => {
          const sign = idx % 2 === 0 ? 1 : -1;
          const multiplier = Math.floor((idx + 1) / 2);
          const yOffset = sign * multiplier * 4.5;
          const finalY = centerY + yOffset;

          // Color map: Blue (Low) -> Magenta/Red (High)
          const r = Math.round(34 + pt.normVal * (244 - 34));
          const g = Math.round(211 - pt.normVal * (211 - 63));
          const b = Math.round(238 - pt.normVal * (238 - 94));

          ctx.beginPath();
          ctx.arc(pt.x, finalY, 2.5, 0, 2 * Math.PI);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
          ctx.fill();
        });
      });
    });

    // Chart header text
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px Inter';
    ctx.fillText('SHAP Value (impact on model prediction)', leftMargin, topMargin - 15);

    // Feature value color scale legend
    ctx.textAlign = 'right';
    ctx.fillText('Feature Value:', width - 130, topMargin - 15);

    const legendWidth = 80;
    const legendX = width - 120;
    const legendY = topMargin - 20;

    const grad = ctx.createLinearGradient(legendX, 0, legendX + legendWidth, 0);
    grad.addColorStop(0, '#22d3ee'); // Blue/Cyan
    grad.addColorStop(1, '#f43f5e'); // Red/Rose
    ctx.fillStyle = grad;
    ctx.fillRect(legendX, legendY, legendWidth, 6);

    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText('Low', legendX, legendY + 16);
    ctx.textAlign = 'right';
    ctx.fillText('High', legendX + legendWidth, legendY + 16);
  };

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <h1>Model Explainability (SHAP)</h1>
        <p>Analyze how individual technical indicators contribute to the ML model's decision-making</p>
      </header>

      {/* SHAP Execution Control Card */}
      <section className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <div>
            <h2>Run SHAP Feature Interpretation</h2>
            <span>Deconstruct feature contributions for a trained model</span>
          </div>
        </div>

        <form onSubmit={handleRunShap}>
          <div className="form-grid" style={{ gridTemplateColumns: '1.5fr 2fr 1fr' }}>
            <div className="form-group">
              <label htmlFor="select-stock-shap">Select Dataset</label>
              <select
                id="select-stock-shap"
                value={selectedStock}
                onChange={handleStockChange}
              >
                <option value="">Choose stock</option>
                {stocks.map((s) => (
                  <option key={s.filename} value={s.symbol.toLowerCase()}>
                    {s.symbol}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="select-model-shap">Select Trained Model</label>
              <select
                id="select-model-shap"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                <option value="">Choose trained model</option>
                {models.map((m) => (
                  <option key={m.filename} value={m.filename}>
                    {m.symbol} - {m.model_type.replace('_', ' ').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={running}
                style={{ width: '100%', height: '46px' }}
              >
                Run SHAP
              </button>
            </div>
          </div>
        </form>

        {status.type && (
          <div className={`status-bar ${status.type}`}>
            {status.type === 'loading' && <div className="spinner"></div>}
            <span>{status.message}</span>
          </div>
        )}
      </section>

      {/* Results Panel */}
      {result && (
        <div style={{ marginTop: '24px' }} className="grid-2">
          {/* Feature Ranking Table */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2>Global Feature Impact</h2>
                <span>Mean Absolute SHAP Value (average impact on prediction magnitude)</span>
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th style={{ textAlign: 'left' }}>Feature</th>
                    <th>Impact (Mean |SHAP|)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.feature_impact.map((fi, idx) => (
                    <tr key={fi.feature}>
                      <td>{idx + 1}</td>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)', textAlign: 'left' }}>
                        {fi.feature}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)', fontWeight: 700 }}>
                        {fi.mean_abs_shap.toFixed(5)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Beeswarm Plot Canvas */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2>SHAP Summary (Beeswarm Plot)</h2>
                <span>Feature value impact distribution. Color represents feature value (Low=Blue, High=Red)</span>
              </div>
            </div>
            <div style={{ position: 'relative', width: '100%', height: '340px', marginTop: '10px' }}>
              <canvas
                ref={canvasRef}
                style={{ width: '100%', height: '100%', borderRadius: '8px', overflow: 'hidden' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

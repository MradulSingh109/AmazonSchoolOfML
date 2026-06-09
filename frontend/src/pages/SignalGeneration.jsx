import React, { useState, useEffect } from 'react';
import AnalyticsChart from '../components/AnalyticsChart';
import TablePreview from '../components/TablePreview';

export default function SignalGeneration({ refreshTrigger }) {
  const [stocks, setStocks] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedStock, setSelectedStock] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [threshold, setThreshold] = useState(0.55);
  const [tradingStyle, setTradingStyle] = useState('short');
  const [status, setStatus] = useState({ type: null, message: '' });
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  const fetchData = async () => {
    try {
      // Fetch datasets
      const resStocks = await fetch('/api/features/list');
      const dataStocks = await resStocks.json();
      if (dataStocks.success) {
        setStocks(dataStocks.datasets);
      }

      // Fetch models
      const resModels = await fetch('/api/models/list');
      const dataModels = await resModels.json();
      if (dataModels.success) {
        setModels(dataModels.models);
      }
    } catch (err) {
      console.error('Failed to load signal options:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  // Auto-select corresponding model when stock changes
  const handleStockChange = (e) => {
    const stockVal = e.target.value;
    setSelectedStock(stockVal);

    if (!stockVal) {
      setSelectedModel('');
      return;
    }

    // Try to find a model that starts with this symbol
    const prefix = stockVal.toLowerCase() + '_';
    const matched = models.find((m) => m.filename.toLowerCase().startsWith(prefix));
    if (matched) {
      setSelectedModel(matched.filename);
    } else {
      setSelectedModel('');
    }
  };

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();

    if (!selectedStock || !selectedModel) {
      setStatus({ type: 'error', message: 'Please select both a dataset stock and a trained model.' });
      return;
    }

    setGenerating(true);
    setStatus({ type: 'loading', message: 'Generating Buy/Sell trading signals...' });
    setResult(null);

    try {
      const res = await fetch('/api/signals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedStock,
          model_filename: selectedModel,
          threshold: Number(threshold),
          short_style: tradingStyle
        })
      });
      const data = await res.json();

      if (data.success) {
        setStatus({ type: 'success', message: data.message });
        setResult(data);
      } else {
        setStatus({ type: 'error', message: data.message });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Error generating signals: ' + err.message });
    } finally {
      setGenerating(false);
    }
  };

  // Prepare Signal Overlay Chart Data
  const getSignalsChartData = () => {
    if (!result?.chart_data) return null;

    const { dates, close, signals } = result.chart_data;
    const buyScatter = [];
    const sellScatter = [];

    // Identify signal change points
    for (let i = 0; i < signals.length; i++) {
      if (i === 0) continue;
      if (signals[i] !== signals[i - 1]) {
        if (signals[i] === 1) {
          buyScatter.push({ x: dates[i], y: close[i] });
        } else {
          sellScatter.push({ x: dates[i], y: close[i] });
        }
      }
    }

    return {
      labels: dates,
      datasets: [
        {
          label: 'Close Price',
          data: close,
          borderColor: 'rgba(148, 163, 184, 0.4)',
          borderWidth: 1.8,
          pointRadius: 0,
          fill: false,
          z: 1,
        },
        {
          label: 'BUY Signal Trigger',
          data: dates.map((d) => {
            const found = buyScatter.find((pt) => pt.x === d);
            return found ? found.y : null;
          }),
          backgroundColor: '#10b981',
          borderColor: '#10b981',
          pointRadius: 6,
          pointHoverRadius: 8,
          showLine: false,
          fill: false,
          z: 10,
        },
        {
          label: 'SELL/EXIT Signal Trigger',
          data: dates.map((d) => {
            const found = sellScatter.find((pt) => pt.x === d);
            return found ? found.y : null;
          }),
          backgroundColor: '#f43f5e',
          borderColor: '#f43f5e',
          pointRadius: 6,
          pointHoverRadius: 8,
          showLine: false,
          fill: false,
          z: 10,
        }
      ]
    };
  };

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <h1>Signal Generation Layer</h1>
        <p>Generate long/short trading triggers from machine learning probability predictions</p>
      </header>

      {/* Signal Creation Control Card */}
      <section className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <div>
            <h2>Create Trading Signals</h2>
            <span>Pair a dataset with a trained ML model and set your probability threshold</span>
          </div>
        </div>

        <form onSubmit={handleGenerate}>
          <div className="form-grid" style={{ gridTemplateColumns: '1.2fr 1.8fr 0.8fr 1.2fr' }}>
            <div className="form-group">
              <label htmlFor="select-stock-signals">Select Dataset</label>
              <select
                id="select-stock-signals"
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
              <label htmlFor="select-model-signals">Select Trained Model</label>
              <select
                id="select-model-signals"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                <option value="">Choose trained model</option>
                {models.map((m) => (
                  <option key={m.filename} value={m.filename}>
                    {m.symbol} - {m.model_type.replace('_', ' ').toUpperCase()} (CV Acc: {(m.metrics.cv_accuracy * 100).toFixed(1)}%)
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="input-threshold">BUY Threshold</label>
              <input
                type="number"
                id="input-threshold"
                value={threshold}
                min="0.5"
                max="0.95"
                step="0.01"
                onChange={(e) => setThreshold(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="select-style-signals">Trading Style</label>
              <select
                id="select-style-signals"
                value={tradingStyle}
                onChange={(e) => setTradingStyle(e.target.value)}
              >
                <option value="short">Long-Short (1 / -1)</option>
                <option value="flat">Long-Only (1 / 0)</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={generating} style={{ marginTop: '16px' }}>
            Generate Signals
          </button>
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
        <div style={{ marginTop: '24px' }}>
          {/* Signal Stats Row */}
          <div className="grid-3">
            <div className="stat-card cyan">
              <div className="stat-label">Total Days analyzed</div>
              <div className="stat-value cyan">{result.rows.toLocaleString()}</div>
              <div className="stat-sub">Trading days in sample</div>
            </div>
            <div className="stat-card green">
              <div className="stat-label">BUY / LONG Signals</div>
              <div className="stat-value green">{result.buys.toLocaleString()}</div>
              <div className="stat-sub">{result.buy_percentage}% of total period</div>
            </div>
            <div className="stat-card amber">
              <div className="stat-label">Trades Executed</div>
              <div className="stat-value amber">{result.trades_count.toLocaleString()}</div>
              <div className="stat-sub">Position entry & exit switches</div>
            </div>
          </div>

          {/* Chart Overlay */}
          <div className="card section-gap" style={{ marginTop: '24px' }}>
            <div className="card-header">
              <div>
                <h2>Stock Price & Trading Signals Overlay</h2>
                <span>Historical stock close price (line) overlayed with BUY (Green) and SELL (Red) positions</span>
              </div>
            </div>
            <AnalyticsChart
              type="line"
              data={getSignalsChartData()}
              height={380}
              options={{
                plugins: {
                  legend: {
                    display: true,
                    position: 'top',
                    labels: { color: 'var(--text-primary)' }
                  },
                  tooltip: {
                    callbacks: {
                      label: (context) => {
                        if (context.datasetIndex === 0) return `Close Price: ₹${context.raw.toFixed(2)}`;
                        if (context.datasetIndex === 1) return `BUY Signal triggered: ₹${context.raw.toFixed(2)}`;
                        if (context.datasetIndex === 2) return `SELL/EXIT triggered: ₹${context.raw.toFixed(2)}`;
                        return '';
                      }
                    }
                  }
                }
              }}
            />
          </div>

          {/* Table Preview */}
          <TablePreview
            prefix="signals"
            columns={result.columns}
            headData={result.preview_head}
            tailData={result.preview_tail}
            totalRows={result.rows}
          />
        </div>
      )}
    </div>
  );
}

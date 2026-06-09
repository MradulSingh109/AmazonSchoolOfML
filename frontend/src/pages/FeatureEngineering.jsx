import React, { useState, useEffect } from 'react';
import AnalyticsChart from '../components/AnalyticsChart';
import TablePreview from '../components/TablePreview';

export default function FeatureEngineering({ refreshTrigger }) {
  const [stocks, setStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState('');
  const [status, setStatus] = useState({ type: null, message: '' });
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const fetchStocks = async () => {
    try {
      const res = await fetch('/api/stocks');
      const data = await res.json();
      if (data.success) {
        setStocks(data.stocks);
      }
    } catch (err) {
      console.error('Failed to load stocks:', err);
    }
  };

  useEffect(() => {
    fetchStocks();
  }, [refreshTrigger]);

  const handleProcess = async (e) => {
    if (e) e.preventDefault();

    if (!selectedStock) {
      setStatus({ type: 'error', message: 'Please choose a dataset to process.' });
      return;
    }

    setProcessing(true);
    setStatus({ type: 'loading', message: `Executing Feature Engineering pipeline for ${selectedStock.toUpperCase()}...` });
    setResult(null);

    try {
      const res = await fetch('/api/features/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: selectedStock })
      });
      const data = await res.json();

      if (data.success) {
        setStatus({ type: 'success', message: data.message });
        setResult(data);
      } else {
        setStatus({ type: 'error', message: data.message });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Error connecting to server: ' + err.message });
    } finally {
      setProcessing(false);
    }
  };

  // Prepare Chart Data
  const getRsiChartData = () => {
    if (!result?.chart_data) return null;
    const len = result.chart_data.dates.length;
    return {
      labels: result.chart_data.dates,
      datasets: [
        {
          label: 'RSI',
          data: result.chart_data.rsi,
          borderColor: '#c084fc',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.1,
        },
        {
          label: 'Overbought (70)',
          data: Array(len).fill(70),
          borderColor: 'rgba(244, 63, 94, 0.4)',
          borderWidth: 1,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
        },
        {
          label: 'Oversold (30)',
          data: Array(len).fill(30),
          borderColor: 'rgba(16, 185, 129, 0.4)',
          borderWidth: 1,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
        }
      ]
    };
  };

  const getMacdChartData = () => {
    if (!result?.chart_data) return null;
    return {
      labels: result.chart_data.dates,
      datasets: [
        {
          label: 'MACD Line',
          data: result.chart_data.macd,
          borderColor: '#22d3ee',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.1,
        },
        {
          label: 'Signal Line',
          data: result.chart_data.macd_signal,
          borderColor: 'rgba(251, 146, 60, 0.8)',
          borderWidth: 1.2,
          pointRadius: 0,
          tension: 0.1,
        }
      ]
    };
  };

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <h1>Feature Engineering & Target Creation</h1>
        <p>Generate predictive features and classification labels for machine learning models</p>
      </header>

      {/* Feature Generation Control Card */}
      <section className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <div>
            <h2>Run Feature Engineering Pipeline</h2>
            <span>Select an available raw dataset to calculate technical indicators and ML labels</span>
          </div>
        </div>

        <form onSubmit={handleProcess}>
          <div className="form-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
            <div className="form-group">
              <label htmlFor="select-stock-features">Select Dataset</label>
              <select
                id="select-stock-features"
                value={selectedStock}
                onChange={(e) => setSelectedStock(e.target.value)}
              >
                <option value="">Choose a stock dataset</option>
                {stocks.map((s) => (
                  <option key={s.symbol} value={s.symbol.toLowerCase()}>
                    {s.symbol} ({s.rows.toLocaleString()} rows)
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={processing}
                style={{ width: '100%', height: '46px' }}
              >
                Run Pipeline
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
        <div style={{ marginTop: '24px' }}>
          {/* Stats Row */}
          <div className="grid-3">
            <div className="stat-card cyan">
              <div className="stat-label">Cleaned Dataset Rows</div>
              <div className="stat-value cyan">{result.rows.toLocaleString()}</div>
              <div className="stat-sub">Dropped edge cases with NaN values</div>
            </div>
            <div className="stat-card purple">
              <div className="stat-label">Engineered Features</div>
              <div className="stat-value purple">{result.added_features.length}</div>
              <div className="stat-sub">Trend, Momentum, Volatility, Volume, Returns</div>
            </div>
            <div className="stat-card green">
              <div className="stat-label">Target Class Balance (Ups)</div>
              <div className="stat-value green">{result.class_balance.up_percentage}%</div>
              <div className="stat-sub">
                Up days: {result.class_balance.ups.toLocaleString()} / Down or Flat: {result.class_balance.downs.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Indicators Charts Row */}
          <div className="grid-2" style={{ marginTop: '24px' }}>
            <div className="card">
              <div className="card-header">
                <div>
                  <h2>Relative Strength Index (RSI)</h2>
                  <span>14-period RSI indicator with overbought (70) and oversold (30) levels</span>
                </div>
              </div>
              <AnalyticsChart
                type="line"
                data={getRsiChartData()}
                options={{
                  scales: {
                    y: {
                      min: 0,
                      max: 100,
                    }
                  }
                }}
              />
            </div>
            <div className="card">
              <div className="card-header">
                <div>
                  <h2>MACD & Signal Line</h2>
                  <span>Moving Average Convergence Divergence (12, 26, 9)</span>
                </div>
              </div>
              <AnalyticsChart type="line" data={getMacdChartData()} />
            </div>
          </div>

          {/* Table Preview */}
          <TablePreview
            prefix="features"
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

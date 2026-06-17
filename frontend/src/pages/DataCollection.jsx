import React, { useState, useEffect } from 'react';
import AnalyticsChart from '../components/AnalyticsChart';
import TablePreview from '../components/TablePreview';

export default function DataCollection({ onStockDownloaded }) {
  const [symbol, setSymbol] = useState('');
  const [startDate, setStartDate] = useState('2020-01-01');
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState({ type: null, message: '' });
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState(null);
  const [stocks, setStocks] = useState([]);

  // Popular quick pick symbols
  const popularSymbols = [
    { label: 'RELIANCE', symbol: 'RELIANCE' },
    { label: 'TCS', symbol: 'TCS' },
    { label: 'HDFCBANK', symbol: 'HDFCBANK' },
    { label: 'Gold (GC=F)', symbol: 'GC=F' },
    { label: 'S&P 500 (^GSPC)', symbol: '^GSPC' },
    { label: 'Bitcoin (BTC-USD)', symbol: 'BTC-USD' }
  ];

  const fetchStocks = async () => {
    try {
      const res = await fetch('/api/stocks'); // Hits the endpoint in backend/app/api/data.py
      const data = await res.json();
      if (data.success) {
        setStocks(data.stocks);
        if (onStockDownloaded) {
          onStockDownloaded(); // Trigger sibling/parent refresh if needed
        }
      }
    } catch (err) {
      console.error('Failed to load stocks:', err);
    }
  };

  useEffect(() => {
    fetchStocks();
  }, []);

  const handleDownload = async (e) => {
    if (e) e.preventDefault();

    if (!symbol.trim()) {
      setStatus({ type: 'error', message: 'Please enter an asset symbol.' });
      return;
    }
    if (!startDate || !endDate) {
      setStatus({ type: 'error', message: 'Please select both start and end dates.' });
      return;
    }

    setDownloading(true);
    setStatus({ type: 'loading', message: `Downloading ${symbol.toUpperCase()} from Yahoo Finance...` });
    setResult(null);

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbol.trim(),
          start_date: startDate,
          end_date: endDate
        })
      });
      const data = await res.json();

      if (data.success) {
        setStatus({ type: 'success', message: data.message });
        setResult(data);
        fetchStocks(); // Reload stock list
      } else {
        setStatus({ type: 'error', message: data.message });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Network error: ' + err.message });
    } finally {
      setDownloading(false);
    }
  };

  const handleQuickPick = (sym) => {
    setSymbol(sym);
  };

  // Prepare Chart Data
  const getPriceChartData = () => {
    if (!result?.chart_data) return null;
    return {
      labels: result.chart_data.dates,
      datasets: [
        {
          label: 'Close Price',
          data: result.chart_data.close,
          borderColor: '#22d3ee',
          borderWidth: 2,
          backgroundColor: 'rgba(34, 211, 238, 0.08)',
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.1,
        }
      ]
    };
  };

  const getVolumeChartData = () => {
    if (!result?.chart_data) return null;
    return {
      labels: result.chart_data.dates,
      datasets: [
        {
          label: 'Volume',
          data: result.chart_data.volume,
          backgroundColor: 'rgba(192, 132, 252, 0.35)',
          borderRadius: 2,
        }
      ]
    };
  };

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <h1>Data Collection</h1>
        <p>Download OHLCV market data from Yahoo Finance (supports NSE stocks, Forex, Commodities, Crypto, and global indices)</p>
      </header>

      {/* Download Form Card */}
      <section className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <div>
            <h2>Download Asset Data</h2>
            <span>Enter an asset symbol and date range to fetch historical data</span>
          </div>
        </div>

        {/* Quick Picks */}
        <div className="quick-picks">
          <span className="label">Popular:</span>
          {popularSymbols.map((item) => (
            <span
              key={item.symbol}
              className="chip"
              onClick={() => handleQuickPick(item.symbol)}
            >
              {item.label}
            </span>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleDownload}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="input-symbol">Asset Symbol</label>
              <input
                type="text"
                id="input-symbol"
                placeholder="e.g. RELIANCE, XAUUSD=X, BTC-USD"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label htmlFor="input-start">Start Date</label>
              <input
                type="date"
                id="input-start"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="input-end">End Date</label>
              <input
                type="date"
                id="input-end"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={downloading}>
            <span>Download Data</span>
          </button>
        </form>

        {/* Status Bar */}
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
              <div className="stat-label">Total Rows</div>
              <div className="stat-value cyan">{result.rows.toLocaleString()}</div>
              <div className="stat-sub">
                {result.date_range.start} → {result.date_range.end}
              </div>
            </div>
            <div className="stat-card green">
              <div className="stat-label">Avg Close Price</div>
              <div className="stat-value green">₹{result.summary.avg_price.toLocaleString()}</div>
              <div className="stat-sub">
                Low: ₹{result.summary.min_price.toLocaleString()} — High: ₹{result.summary.max_price.toLocaleString()}
              </div>
            </div>
            <div className="stat-card pcard">
              <div className="stat-label">Total Return</div>
              <div
                className="stat-value"
                style={{ color: result.summary.total_return >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}
              >
                {result.summary.total_return >= 0 ? '+' : ''}
                {result.summary.total_return}%
              </div>
              <div className="stat-sub">
                ₹{result.summary.start_price.toLocaleString()} → ₹{result.summary.end_price.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid-2" style={{ marginTop: '24px' }}>
            <div className="card">
              <div className="card-header">
                <div>
                  <h2>Price Chart</h2>
                  <span>Daily close price (₹)</span>
                </div>
              </div>
              <AnalyticsChart type="line" data={getPriceChartData()} />
            </div>
            <div className="card">
              <div className="card-header">
                <div>
                  <h2>Volume Chart</h2>
                  <span>Daily volume</span>
                </div>
              </div>
              <AnalyticsChart
                type="bar"
                data={getVolumeChartData()}
                options={{
                  scales: {
                    y: {
                      ticks: {
                        callback: (v) =>
                          v >= 1e6
                            ? (v / 1e6).toFixed(1) + 'M'
                            : v >= 1e3
                            ? (v / 1e3).toFixed(0) + 'K'
                            : v
                      }
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Table Preview */}
          <TablePreview
            prefix="data"
            columns={result.columns}
            headData={result.preview_head}
            tailData={result.preview_tail}
            totalRows={result.rows}
          />
        </div>
      )}

      {/* Downloaded Datasets List */}
      <section className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <div>
            <h2>Downloaded Datasets</h2>
            <span>Previously downloaded stock data files</span>
          </div>
        </div>
        <div className="stock-list">
          {stocks.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📂</div>
              <p>No datasets downloaded yet. Use the form above to download data.</p>
            </div>
          ) : (
            stocks.map((stock) => (
              <div key={stock.symbol} className="stock-item">
                <div>
                  <span className="symbol">{stock.symbol}</span>
                  <span className="meta">
                    &nbsp;·&nbsp;{stock.rows} rows&nbsp;·&nbsp;{stock.size_kb} KB
                  </span>
                </div>
                <div className="meta">Modified: {stock.modified}</div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

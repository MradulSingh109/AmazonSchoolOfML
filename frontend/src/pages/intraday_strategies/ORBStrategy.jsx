import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AnalyticsChart from '../../components/AnalyticsChart';
import TablePreview from '../../components/TablePreview';

export default function ORBStrategy() {
  const navigate = useNavigate();

  // --- ORB Dashboard State ---
  const [activeStep, setActiveStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: null, message: '' });
  const [showAboutStrategy, setShowAboutStrategy] = useState(false);

  // Download State
  const [downloadSymbol, setDownloadSymbol] = useState('^NSEI');
  const [downloadStart, setDownloadStart] = useState('2026-05-01');
  const [downloadEnd, setDownloadEnd] = useState('2026-06-15');
  const [downloadInterval, setDownloadInterval] = useState('5m');
  const [intradayStocks, setIntradayStocks] = useState([]);
  const [selectedRawFile, setSelectedRawFile] = useState('');

  // Feature Processing State
  const [selectedFeaturesFile, setSelectedFeaturesFile] = useState('');
  const [processedPreview, setProcessedPreview] = useState(null);

  // Backtest State
  const [initialCapital, setInitialCapital] = useState(26000);
  const [vixFilter, setVixFilter] = useState(true);
  const [trailingStop, setTrailingStop] = useState(true);
  const [transactionCost, setTransactionCost] = useState(0.0003);
  const [backtestResults, setBacktestResults] = useState(null);

  // ORB Specific Settings
  const [rvolThreshold, setRvolThreshold] = useState(2.0);
  const [riskPerTrade, setRiskPerTrade] = useState(1.0); // 1%
  const [atrMultiplier, setAtrMultiplier] = useState(1.5);
  const [riskRewardRatio, setRiskRewardRatio] = useState(3.0);
  const [avgAtrPct, setAvgAtrPct] = useState(null);

  // Fetch initial files
  const fetchFiles = async () => {
    try {
      const rawRes = await fetch('/api/intraday-stocks');
      const rawData = await rawRes.json();
      if (rawData.success) {
        setIntradayStocks(rawData.stocks);
        if (rawData.stocks.length > 0 && !selectedRawFile) {
          setSelectedRawFile(rawData.stocks[0].filename);
        }
      }
    } catch (err) {
      console.error("Failed to fetch intraday files:", err);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // Handlers
  const handleDownload = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: 'info', message: 'Downloading 5m bars from Yahoo Finance...' });
    try {
      const res = await fetch('/api/download-intraday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: downloadSymbol,
          start_date: downloadStart,
          end_date: downloadEnd,
          interval: downloadInterval
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: 'success', message: data.message });
        await fetchFiles();
        setSelectedRawFile(data.filename);
        setActiveStep(2);
      } else {
        setStatus({ type: 'error', message: data.detail || 'Download failed.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Failed to contact backend server.' });
    } finally {
      setLoading(false);
    }
  };

  const handleProcessFeatures = async () => {
    if (!selectedRawFile) {
      setStatus({ type: 'error', message: 'Please select a raw intraday file first.' });
      return;
    }
    setLoading(true);
    setStatus({ type: 'info', message: 'Processing ORB strategy features...' });
    try {
      const res = await fetch('/api/orb/process-features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: selectedRawFile })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: 'success', message: `Successfully generated ORB features! (${data.rows} rows)` });
        setSelectedFeaturesFile(data.filename);
        setProcessedPreview(data);
        if (data.avg_atr_pct !== undefined) {
          setAvgAtrPct(data.avg_atr_pct);
        }
      } else {
        setStatus({ type: 'error', message: data.detail || 'Feature processing failed.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Connection to server failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRunBacktest = async () => {
    const rawFile = selectedRawFile;
    const featFile = selectedFeaturesFile || (rawFile ? rawFile.replace('.csv', '_orb_features.csv') : '');

    if (!rawFile || !featFile) {
      setStatus({ type: 'error', message: 'Missing raw data or processed features file.' });
      return;
    }

    setLoading(true);
    setStatus({ type: 'info', message: 'Running ORB-RVOL Intraday Simulation...' });
    try {
      const res = await fetch('/api/orb/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          features_filename: featFile,
          raw_filename: rawFile,
          initial_capital: parseFloat(initialCapital),
          rvol_threshold: parseFloat(rvolThreshold),
          vix_filter: vixFilter,
          trailing_stop: trailingStop,
          transaction_cost_pct: parseFloat(transactionCost),
          risk_per_trade_pct: parseFloat(riskPerTrade) / 100.0,
          atr_multiplier: parseFloat(atrMultiplier),
          risk_reward_ratio: parseFloat(riskRewardRatio)
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: 'success', message: 'ORB Backtest simulation completed!' });
        setBacktestResults(data);
        setActiveStep(4);
      } else {
        setStatus({ type: 'error', message: data.detail || 'Backtest simulation failed.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Connection to server failed.' });
    } finally {
      setLoading(false);
    }
  };

  const indexTickers = [
    { label: 'Nifty 50 (^NSEI)', val: '^NSEI' },
    { label: 'Nifty Bank (^NSEBANK)', val: '^NSEBANK' },
    { label: 'Reliance Industries (RELIANCE)', val: 'RELIANCE' },
    { label: 'TCS (TCS)', val: 'TCS' }
  ];

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '80px' }}>
      {/* Navigation & Header */}
      <button
        className="btn"
        style={{
          marginBottom: '24px',
          background: '#000000',
          color: '#ffffff',
          border: '1px solid #27272a',
          borderRadius: '9999px',
          transition: 'all 0.3s ease'
        }}
        onClick={() => navigate('/strategies')}
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
        <span>← Back to Strategies</span>
      </button>

      <header className="page-header" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1>Opening Range Breakout (ORB-RVOL)</h1>
          <span className="badge" style={{ background: 'rgba(124, 58, 237, 0.1)', color: 'var(--accent-purple)', border: '1px solid rgba(124, 58, 237, 0.2)' }}>
            Rule-Based Strategy
          </span>
        </div>
        <p>
          Trade opening breakouts confirmed by Relative Volume, utilizing tight ATR risk bands and 3-bar failure exits.
        </p>
      </header>

      {/* About Strategy Dropdown */}
      <div className="card animate-fade-in" style={{ marginBottom: '32px', padding: '0', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.01)' }}>
        <button
          onClick={() => setShowAboutStrategy(!showAboutStrategy)}
          style={{
            width: '100%',
            padding: '16px 24px',
            background: 'transparent',
            border: 'none',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            textAlign: 'left',
            color: 'var(--text-primary)',
            fontWeight: 700,
            fontSize: '15.5px',
            outline: 'none',
            transition: 'background 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            About Strategy: Opening Range Breakout (ORB-RVOL)
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {showAboutStrategy ? '▲ Hide Details' : '▼ View Details'}
          </span>
        </button>

        {showAboutStrategy && (
          <div style={{ padding: '24px', borderTop: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.015)', lineHeight: '1.6' }}>
            <div className="animate-fade-in" style={{ fontSize: '13.5px' }}>
              <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
                The <strong>ORB-RVOL</strong> strategy is a high-frequency intraday momentum strategy designed to capture directional institutional flows. It identifies stocks with unusually high opening volume and trades breakouts from the initial opening range, managed by dynamic volatility-based stops and targets.
              </p>
              <div className="grid-2" style={{ gap: '24px', alignItems: 'start' }}>
                <div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 700, color: 'var(--accent-purple)' }}>Core Signals & Formulas</h4>
                  <ul style={{ paddingLeft: '20px', margin: '0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <li>
                      <strong>Opening Range (OR):</strong> First 5-minute candle (09:15 - 09:20 IST).
                      <br /><span style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', background: 'rgba(0,0,0,0.03)', padding: '2px 4px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>ORW = H_OR - L_OR</span>
                    </li>
                    <li>
                      <strong>Relative Volume (RVOL):</strong> Compares today's opening volume against the 14-day average.
                      <br /><span style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', background: 'rgba(0,0,0,0.03)', padding: '2px 4px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>RVOL = Volume_09:15 / AvgVolume_14d</span>
                      <br /><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>* Must be &ge; 3.0 to qualify for trading.</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 700, color: 'var(--accent-green)' }}>Risk & Position Management</h4>
                  <ul style={{ paddingLeft: '20px', margin: '0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <li>
                      <strong>Stop Loss (SL):</strong>
                      <br /><span style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', background: 'rgba(0,0,0,0.03)', padding: '2px 4px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>Long SL = Entry - (Multiplier &times; ATR14)</span>
                      <br /><span style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', background: 'rgba(0,0,0,0.03)', padding: '2px 4px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>Short SL = Entry + (Multiplier &times; ATR14)</span>
                      <br /><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>* Narrow range exception: Uses L_OR / H_OR if ORW% &lt; 0.75%.</span>
                    </li>
                    <li>
                      <strong>Profit Target:</strong> Set dynamically based on the risk unit (R = |Entry - Stop|):
                      <br /><span style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', background: 'rgba(0,0,0,0.03)', padding: '2px 4px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>Target = Entry &plusmn; (Risk-to-Reward Ratio &times; R)</span>
                    </li>
                    <li>
                      <strong>Exits & Safeguards:</strong>
                      <br />• <em>3-Bar Failure Exit:</em> Immediately exit if price closes inside the opening range for 3 consecutive bars.
                      <br />• <em>Time Square-off:</em> All open positions are strictly closed at <strong>15:15 IST</strong>.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      {status.message && (
        <div
          className="card animate-slide-up"
          style={{
            marginBottom: '24px',
            padding: '12px 20px',
            borderRadius: '8px',
            borderLeft: `4px solid ${status.type === 'success' ? 'var(--accent-green)' :
                status.type === 'error' ? 'var(--accent-red)' : 'var(--accent-cyan)'
              }`,
            background: 'rgba(255,255,255,0.95)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', gap: '10px' }}>
            {loading && <div className="spinner-mini" />}
            <span style={{ fontSize: '14px', color: '#000000ff', fontWeight: 500 }}>
              {status.message}
            </span>
          </div>
        </div>
      )}

      {/* Step Navigator */}
      <div className="card" style={{ padding: '16px', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
        {[
          { num: 1, label: '1. Ingest Data' },
          { num: 2, label: '2. Features' },
          { num: 3, label: '3. Backtest Config' },
          { num: 4, label: '4. Performance' }
        ].map((s) => (
          <button
            key={s.num}
            onClick={() => setActiveStep(s.num)}
            style={{
              flex: 1,
              padding: '12px 8px',
              borderRadius: '6px',
              border: 'none',
              background: activeStep === s.num ? '#ffffff' : 'transparent',
              color: activeStep === s.num ? '#000000' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textAlign: 'center'
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Step Contents */}
      <div className="grid-1" style={{ gap: '32px' }}>
        {/* STEP 1: Data Ingestion */}
        {activeStep === 1 && (
          <div className="card animate-fade-in" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Step 1: Download Intraday Data</h2>
            <form onSubmit={handleDownload} className="grid-2" style={{ gap: '20px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Asset Symbol</label>
                <input
                  type="text"
                  list="tickers-list"
                  placeholder="e.g. RELIANCE.NS, ^NSEI, TCS.NS"
                  value={downloadSymbol}
                  onChange={(e) => setDownloadSymbol(e.target.value.toUpperCase())}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)' }}
                />
                <datalist id="tickers-list">
                  {indexTickers.map((t) => (
                    <option key={t.val} value={t.val}>{t.label}</option>
                  ))}
                  <option value="RELIANCE.NS">Reliance Industries (NSE)</option>
                  <option value="TCS.NS">TCS (NSE)</option>
                  <option value="INFY.NS">Infosys (NSE)</option>
                  <option value="HDFCBANK.NS">HDFC Bank (NSE)</option>
                  <option value="ICICIBANK.NS">ICICI Bank (NSE)</option>
                  <option value="SBIN.NS">State Bank of India (NSE)</option>
                  <option value="^NSEI">Nifty 50 Index</option>
                  <option value="^NSEBANK">Nifty Bank Index</option>
                </datalist>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Interval</label>
                <select
                  value={downloadInterval}
                  onChange={(e) => setDownloadInterval(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)' }}
                >
                  <option value="5m">5-minute (Max 60 Days)</option>
                  <option value="15m">15-minute (Max 60 Days)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Start Date</label>
                <input
                  type="date"
                  value={downloadStart}
                  onChange={(e) => setDownloadStart(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>End Date</label>
                <input
                  type="date"
                  value={downloadEnd}
                  onChange={(e) => setDownloadEnd(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)' }}
                />
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="submit"
                  className="btn"
                  style={{
                    background: '#000000',
                    color: '#ffffff',
                    border: '1px solid #27272a',
                    borderRadius: '9999px',
                    transition: 'all 0.3s ease'
                  }}
                  disabled={loading}
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
                  <span>{loading ? 'Downloading...' : 'Fetch Intraday Data'}</span>
                </button>
              </div>
            </form>

            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              Downloaded Intraday Files
            </h3>
            {intradayStocks.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No intraday data downloaded yet.</p>
            ) : (
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', background: '#ffffffff' }}>
                      <th style={{ padding: '8px 4px', color: '#000000ff' }}>Symbol</th>
                      <th style={{ padding: '8px 4px', color: '#000000ff' }}>Interval</th>
                      <th style={{ padding: '8px 4px', color: '#000000ff' }}>Rows</th>
                      <th style={{ padding: '8px 4px', color: '#000000ff' }}>Size</th>
                      <th style={{ padding: '8px 4px', color: '#000000ff' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {intradayStocks.map((stock) => (
                      <tr key={stock.filename} style={{ borderBottom: '1px dotted var(--border-color)' }}>
                        <td style={{ padding: '8px 4px', fontWeight: 600 }}>{stock.symbol}</td>
                        <td style={{ padding: '8px 4px' }}>{stock.interval}</td>
                        <td style={{ padding: '8px 4px', fontFamily: 'var(--font-mono)' }}>{stock.rows}</td>
                        <td style={{ padding: '8px 4px' }}>{stock.size_kb} KB</td>
                        <td style={{ padding: '8px 4px' }}>
                          <button
                            className="btn-link"
                            style={{ color: 'var(--accent-purple)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                            onClick={() => {
                              setSelectedRawFile(stock.filename);
                              setActiveStep(2);
                            }}
                          >
                            Use File
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Feature Engineering */}
        {activeStep === 2 && (
          <div className="card animate-fade-in" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Step 2: Strategy Feature Engineering</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
              Calculate opening range High/Low bounds, relative volume (RVOL) spikes, and 14-day average true range (ATR) parameters.
            </p>

            <div style={{ background: 'rgba(0,0,0,0.02)', padding: '16px', borderRadius: '8px', marginBottom: '24px', border: '1px solid var(--border-color)' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Selected Raw Data File</label>
              <select
                value={selectedRawFile}
                onChange={(e) => setSelectedRawFile(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)' }}
              >
                <option value="">-- Select a Raw CSV --</option>
                {intradayStocks.map((stock) => (
                  <option key={stock.filename} value={stock.filename}>
                    {stock.symbol} ({stock.interval}) - {stock.rows} rows
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={handleProcessFeatures}
                className="btn"
                style={{
                  background: '#000000',
                  color: '#ffffff',
                  border: '1px solid #27272a',
                  borderRadius: '9999px',
                  transition: 'all 0.3s ease'
                }}
                disabled={loading || !selectedRawFile}
                onMouseEnter={(e) => {
                  if (loading || !selectedRawFile) return;
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
                <span>{loading ? 'Processing...' : 'Compute Daily Features'}</span>
              </button>
            </div>

            {processedPreview && (
              <div className="animate-fade-in" style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                <TablePreview
                  prefix="orb-features"
                  columns={processedPreview.columns}
                  headData={processedPreview.preview_head}
                  tailData={processedPreview.preview_tail}
                  totalRows={processedPreview.rows}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button
                    onClick={() => setActiveStep(3)}
                    className="btn"
                    style={{
                      background: '#090909ff',
                      color: '#faf9f9ff',
                      border: '1px solid #27272a',
                      borderRadius: '9999px',
                      transition: 'all 0.3s ease'
                    }}
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
                    <span>Proceed to Backtest Config →</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Backtest Configuration */}
        {activeStep === 3 && (
          <div className="card animate-fade-in" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>
              Step 3: Configure ORB-RVOL Backtester
            </h2>

            <div className="grid-2" style={{ gap: '20px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Initial Capital (INR)</label>
                <input
                  type="number"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Transaction Cost / Slip (%)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={transactionCost}
                  onChange={(e) => setTransactionCost(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Relative Volume (RVOL) Threshold</label>
                <input
                  type="number"
                  step="0.1"
                  value={rvolThreshold}
                  onChange={(e) => setRvolThreshold(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Capital Allocation Mode</label>
                <div style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'rgba(34, 197, 94, 0.05)', color: 'var(--accent-green)', fontWeight: 600, fontSize: '13.5px', display: 'flex', alignItems: 'center', height: '40px', boxSizing: 'border-box' }}>
                  Full Capital Allocation (Max Qty)
                </div>
              </div>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              ATR & Target Configuration
            </h3>
            <div className="grid-2" style={{ gap: '20px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>
                  ATR Stop Loss Multiplier: <strong style={{ color: 'var(--accent-purple)' }}>{atrMultiplier}x</strong>
                </label>
                <input
                  type="range"
                  min="0.0"
                  max="3.0"
                  step="0.05"
                  value={atrMultiplier}
                  onChange={(e) => setAtrMultiplier(parseFloat(e.target.value))}
                  style={{ width: '100%', marginBottom: '8px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>0.0x (Tightest)</span>
                  <span>1.5x (Paper Default)</span>
                  <span>3.0x (Conservative)</span>
                </div>
                <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  * The theoretical strategy paper sets this multiplier to 1.5.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>
                  Risk-to-Reward Ratio (Target): <strong style={{ color: 'var(--accent-green)' }}>{riskRewardRatio}:1</strong>
                </label>
                <input
                  type="range"
                  min="1.0"
                  max="5.0"
                  step="0.1"
                  value={riskRewardRatio}
                  onChange={(e) => setRiskRewardRatio(parseFloat(e.target.value))}
                  style={{ width: '100%', marginBottom: '8px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>1.0:1</span>
                  <span>3.0:1 (Default)</span>
                  <span>5.0:1</span>
                </div>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Stop Loss Risk Analysis
                </label>
                <div style={{ padding: '12px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'rgba(239, 68, 68, 0.03)', color: 'var(--text-primary)', fontSize: '13.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Estimated Stop Loss Distance (Negative Price Change):</span>
                  <strong style={{ color: 'var(--accent-red)', fontSize: '15px', fontFamily: 'var(--font-mono)' }}>
                    {avgAtrPct ? `-${(atrMultiplier * avgAtrPct).toFixed(2)}%` : 'Run features step to estimate'}
                  </strong>
                </div>
                <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Calculated dynamically based on historical 14-day Average True Range (ATR) relative to asset price. Higher multipliers widen stop-loss boundaries but increase peak downside risk per trade.
                </p>
              </div>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              Risk Management Filters
            </h3>
            <div className="grid-2" style={{ gap: '20px', marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={vixFilter} onChange={(e) => setVixFilter(e.target.checked)} />
                <span style={{ fontSize: '13.5px' }}><strong>VIX Filter</strong> (Trade only when India VIX &gt; 11.0)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={trailingStop} onChange={(e) => setTrailingStop(e.target.checked)} />
                <span style={{ fontSize: '13.5px' }}><strong>ATR Trailing Stop</strong> (Breakeven at 1.5R, trail 1.0 ATR at 2.0R)</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={handleRunBacktest}
                className="btn"
                style={{
                  background: '#000000',
                  color: '#ffffff',
                  border: '1px solid #27272a',
                  borderRadius: '9999px',
                  transition: 'all 0.3s ease'
                }}
                disabled={loading}
                onMouseEnter={(e) => {
                  if (loading) return;
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
                <span>{loading ? 'Running...' : 'Run Simulation'}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Backtest Results Dashboard */}
        {activeStep === 4 && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Metric Overview Card */}
            {backtestResults ? (
              <>
                <div className="card" style={{ padding: '24px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>Simulation Results Metrics</h2>
                  <div className="grid-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                    <div style={{ background: 'rgba(0,0,0,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)' }}>Total Return</span>
                      <h3 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 0 0', color: backtestResults.metrics.total_return_pct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {backtestResults.metrics.total_return_pct}%
                      </h3>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)' }}>Sharpe Ratio</span>
                      <h3 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 0 0', color: 'var(--text-primary)' }}>
                        {backtestResults.metrics.sharpe_ratio}
                      </h3>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)' }}>Max Drawdown</span>
                      <h3 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 0 0', color: 'var(--accent-red)' }}>
                        {backtestResults.metrics.max_drawdown_pct}%
                      </h3>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)' }}>CAGR</span>
                      <h3 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 0 0', color: backtestResults.metrics.cagr_pct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {backtestResults.metrics.cagr_pct}%
                      </h3>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)' }}>Total Trades</span>
                      <h3 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 0 0' }}>
                        {backtestResults.metrics.trades_count}
                      </h3>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)' }}>Win Rate</span>
                      <h3 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 0 0' }}>
                        {backtestResults.metrics.win_rate_pct}%
                      </h3>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)' }}>Avg Stop Loss Risk</span>
                      <h3 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 0 0', color: 'var(--accent-red)' }}>
                        -{backtestResults.metrics.avg_stop_loss_pct}%
                      </h3>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)' }}>Risk-to-Reward Ratio</span>
                      <h3 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 0 0', color: 'var(--accent-green)' }}>
                        {backtestResults.metrics.risk_reward_ratio}:1
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Equity Curve Chart */}
                <div className="card" style={{ padding: '24px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>
                    ORB-RVOL Equity & Drawdown Curves
                  </h2>
                  <AnalyticsChart
                    type="line"
                    data={{
                      labels: backtestResults.chart_data.dates,
                      datasets: [
                        {
                          label: 'ORB Strategy Return (%)',
                          data: backtestResults.chart_data.strategy_cum_return,
                          borderColor: '#7c3aed',
                          backgroundColor: 'rgba(124, 58, 237, 0.04)',
                          fill: true,
                          tension: 0.1,
                          borderWidth: 2
                        },
                        {
                          label: 'Drawdown (%)',
                          data: backtestResults.chart_data.drawdown,
                          borderColor: '#ef4444',
                          borderDash: [5, 5],
                          fill: false,
                          tension: 0.1,
                          borderWidth: 1.5
                        }
                      ]
                    }}
                    options={{
                      plugins: {
                        legend: { display: true }
                      }
                    }}
                    height={350}
                  />
                </div>

                {/* Trades Log */}
                <div className="card" style={{ padding: '24px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>
                    ORB Executed Trade Log
                  </h2>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', background: '#fff' }}>
                          <th style={{ padding: '10px 6px', color: '#000000ff' }}>Exit Date</th>
                          <th style={{ padding: '10px 6px', color: '#000000ff' }}>Direction</th>
                          <th style={{ padding: '10px 6px', color: '#000000ff' }}>Qty</th>
                          <th style={{ padding: '10px 6px', color: '#000000ff' }}>Entry Price</th>
                          <th style={{ padding: '10px 6px', color: '#000000ff' }}>Exit Price</th>
                          <th style={{ padding: '10px 6px', color: '#000000ff' }}>SL Price</th>
                          <th style={{ padding: '10px 6px', color: '#000000ff' }}>SL Risk (%)</th>
                          <th style={{ padding: '10px 6px', color: '#000000ff' }}>Stopped Out</th>
                          <th style={{ padding: '10px 6px', color: '#000000ff' }}>PnL (INR)</th>
                          <th style={{ padding: '10px 6px', color: '#000000ff' }}>Return (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {backtestResults.trades.map((t, i) => (
                          <tr key={i} style={{ borderBottom: '1px dotted var(--border-color)', background: i % 2 === 0 ? 'rgba(0,0,0,0.01)' : 'transparent' }}>
                            <td style={{ padding: '10px 6px', fontWeight: 500 }}>{t.date}</td>
                            <td style={{ padding: '10px 6px' }}>
                              <span className="badge" style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: t.direction === 'LONG' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: t.direction === 'LONG' ? 'var(--accent-green)' : 'var(--accent-red)'
                              }}>
                                {t.direction}
                              </span>
                            </td>
                            <td style={{ padding: '10px 6px', fontFamily: 'var(--font-mono)' }}>{t.quantity}</td>
                            <td style={{ padding: '10px 6px', fontFamily: 'var(--font-mono)' }}>{t.entry_price}</td>
                            <td style={{ padding: '10px 6px', fontFamily: 'var(--font-mono)' }}>{t.exit_price}</td>
                            <td style={{ padding: '10px 6px', fontFamily: 'var(--font-mono)' }}>{t.stop_loss}</td>
                            <td style={{ padding: '10px 6px', fontFamily: 'var(--font-mono)', color: 'var(--accent-red)', fontWeight: 600 }}>{t.sl_change_pct !== undefined ? `${t.sl_change_pct}%` : '-'}</td>
                            <td style={{ padding: '10px 6px' }}>{t.stopped_out ? '❌ Yes' : '✅ No'}</td>
                            <td style={{ padding: '10px 6px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: t.pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                              {t.pnl >= 0 ? `+${t.pnl}` : t.pnl}
                            </td>
                            <td style={{ padding: '10px 6px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: t.return_pct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                              {t.return_pct >= 0 ? `+${t.return_pct}%` : `${t.return_pct}%`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)' }}>No simulation data. Please run a backtest in Step 4.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

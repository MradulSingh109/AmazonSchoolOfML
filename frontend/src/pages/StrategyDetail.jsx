import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AnalyticsChart from '../components/AnalyticsChart';
import TablePreview from '../components/TablePreview';

export default function StrategyDetail() {
  const { strategyId } = useParams();
  const navigate = useNavigate();

  // If not ITSM, show standard placeholder
  if (strategyId !== 'itsm') {
    return (
      <div className="animate-fade-in">
        <button 
          className="btn" 
          style={{ marginBottom: '24px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}
          onClick={() => navigate('/strategies')}
        >
          <span>← Back to Strategies</span>
        </button>

        <header className="page-header">
          <h1 style={{ textTransform: 'capitalize' }}>
            {strategyId ? strategyId.replace('-', ' ') : 'Strategy'} Backtester
          </h1>
          <p>Configure settings and run simulated backtests for the {strategyId} strategy.</p>
        </header>

        <section className="card" style={{ marginTop: '24px' }}>
          <h2>Strategy Configuration</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Detailed configuration controls and interactive charts for <strong>{strategyId}</strong> are under development.
          </p>
        </section>
      </div>
    );
  }

  // --- ITSM Specific Dashboard State ---
  const [activeStep, setActiveStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: null, message: '' });

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

  // Training State
  const [modelType, setModelType] = useState('linear_regression');
  const [alpha, setAlpha] = useState(1.0);
  const [nEstimators, setNEstimators] = useState(100);
  const [maxDepth, setMaxDepth] = useState(5);
  const [learningRate, setLearningRate] = useState(0.1);
  const [trainedModels, setTrainedModels] = useState([]);
  const [selectedModelFile, setSelectedModelFile] = useState('');
  const [trainingResults, setTrainingResults] = useState(null);

  // Backtest State
  const [initialCapital, setInitialCapital] = useState(1000000);
  const [vixFilter, setVixFilter] = useState(true);
  const [volumeFilter, setVolumeFilter] = useState(true);
  const [trendFilter, setTrendFilter] = useState(true);
  const [breadthFilter, setBreadthFilter] = useState(false);
  const [trailingStop, setTrailingStop] = useState(true);
  const [transactionCost, setTransactionCost] = useState(0.0005);
  const [backtestResults, setBacktestResults] = useState(null);

  // Fetch initial files and models
  const fetchFiles = async () => {
    try {
      // 1. Get raw files
      const rawRes = await fetch('/api/intraday-stocks');
      const rawData = await rawRes.json();
      if (rawData.success) {
        setIntradayStocks(rawData.stocks);
        if (rawData.stocks.length > 0 && !selectedRawFile) {
          setSelectedRawFile(rawData.stocks[0].filename);
        }
      }

      // 2. Get trained models
      const modelsRes = await fetch('/api/itsm/models');
      const modelsData = await modelsRes.json();
      if (modelsData.success) {
        setTrainedModels(modelsData.models);
        if (modelsData.models.length > 0 && !selectedModelFile) {
          setSelectedModelFile(modelsData.models[0].filename);
        }
      }
    } catch (err) {
      console.error("Failed to fetch files/models:", err);
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
        // Automatically move to step 2
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
    setStatus({ type: 'info', message: 'Processing strategy features...' });
    try {
      const res = await fetch('/api/itsm/process-features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: selectedRawFile })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: 'success', message: `Successfully generated features! (${data.rows} rows)` });
        setSelectedFeaturesFile(data.filename);
        setProcessedPreview(data);
      } else {
        setStatus({ type: 'error', message: data.detail || 'Feature processing failed.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Connection to server failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleTrainModel = async () => {
    const featFile = selectedFeaturesFile || (selectedRawFile ? selectedRawFile.replace('.csv', '_features.csv') : '');
    if (!featFile) {
      setStatus({ type: 'error', message: 'Please process features or select a feature file first.' });
      return;
    }
    setLoading(true);
    setStatus({ type: 'info', message: `Training ${modelType} model...` });
    try {
      const hyper = {};
      if (modelType === 'ridge' || modelType === 'lasso') hyper.alpha = parseFloat(alpha);
      if (modelType === 'random_forest') {
        hyper.n_estimators = parseInt(nEstimators);
        hyper.max_depth = parseInt(maxDepth);
      }
      if (modelType === 'xgboost') {
        hyper.n_estimators = parseInt(nEstimators);
        hyper.max_depth = parseInt(maxDepth);
        hyper.learning_rate = parseFloat(learningRate);
      }

      const res = await fetch('/api/itsm/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: featFile,
          model_type: modelType,
          hyperparameters: hyper
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({
          type: 'success',
          message: `Model trained! Test R²: ${data.test_metrics.r2.toFixed(4)}, Test MAE: ${data.test_metrics.mae.toFixed(6)}`
        });
        await fetchFiles();
        setSelectedModelFile(data.filename);
        setTrainingResults(data);
      } else {
        setStatus({ type: 'error', message: data.detail || 'Model training failed.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Connection to server failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRunBacktest = async () => {
    const rawFile = selectedRawFile;
    const featFile = selectedFeaturesFile || (rawFile ? rawFile.replace('.csv', '_features.csv') : '');
    if (!rawFile || !featFile || !selectedModelFile) {
      setStatus({ type: 'error', message: 'Missing raw data, features data, or trained model file.' });
      return;
    }
    setLoading(true);
    setStatus({ type: 'info', message: 'Running Walk-Forward Intraday Simulation...' });
    try {
      const res = await fetch('/api/itsm/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          features_filename: featFile,
          raw_filename: rawFile,
          model_filename: selectedModelFile,
          initial_capital: parseFloat(initialCapital),
          vix_filter: vixFilter,
          volume_filter: volumeFilter,
          trend_filter: trendFilter,
          breadth_filter: breadthFilter,
          trailing_stop: trailingStop,
          transaction_cost_pct: parseFloat(transactionCost)
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: 'success', message: 'Backtest simulation completed!' });
        setBacktestResults(data);
        setActiveStep(5);
      } else {
        setStatus({ type: 'error', message: data.detail || 'Backtest simulation failed.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Connection to server failed.' });
    } finally {
      setLoading(false);
    }
  };

  // Quick picker symbols for intraday
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
        style={{ marginBottom: '24px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}
        onClick={() => navigate('/strategies')}
      >
        <span>← Back to Strategies</span>
      </button>

      <header className="page-header" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1>Intraday Time Series Momentum (ITSM)</h1>
          <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'var(--accent-green)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
            Active Strategy
          </span>
        </div>
        <p>Exploit overnight information and midday order execution lag using machine learning regressors.</p>
      </header>

      {/* Status Bar */}
      {status.message && (
        <div 
          className="card animate-slide-up" 
          style={{ 
            marginBottom: '24px', 
            padding: '12px 20px', 
            borderRadius: '8px', 
            borderLeft: `4px solid ${
              status.type === 'success' ? 'var(--accent-green)' : 
              status.type === 'error' ? 'var(--accent-red)' : 'var(--accent-cyan)'
            }`,
            background: 'rgba(255,255,255,0.95)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', gap: '10px' }}>
            {loading && <div className="spinner-mini" />}
            <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>
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
          { num: 3, label: '3. Train Model' },
          { num: 4, label: '4. Backtest Config' },
          { num: 5, label: '5. Performance' }
        ].map((s) => (
          <button
            key={s.num}
            onClick={() => setActiveStep(s.num)}
            style={{
              flex: 1,
              padding: '12px 8px',
              borderRadius: '6px',
              border: 'none',
              background: activeStep === s.num ? 'var(--text-primary)' : 'transparent',
              color: activeStep === s.num ? '#ffffff' : 'var(--text-secondary)',
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
                <button type="submit" className="btn" style={{ background: 'var(--text-primary)', color: '#fff' }} disabled={loading}>
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
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px 4px' }}>Symbol</th>
                      <th style={{ padding: '8px 4px' }}>Interval</th>
                      <th style={{ padding: '8px 4px' }}>Rows</th>
                      <th style={{ padding: '8px 4px' }}>Size</th>
                      <th style={{ padding: '8px 4px' }}>Action</th>
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
              Calculate the target last-hour return ($LH_t$) and all structural metrics like overnight gap return (`onfh`), midday trend return (`middle_return`), relative volume (`relative_volume`), VWAP trend vectors, and dynamic ATR boundaries.
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
                style={{ background: 'var(--text-primary)', color: '#fff' }} 
                disabled={loading || !selectedRawFile}
              >
                <span>{loading ? 'Processing...' : 'Compute Daily Features'}</span>
              </button>
            </div>

            {processedPreview && (
              <div className="animate-fade-in" style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                <TablePreview
                  prefix="itsm-features"
                  columns={processedPreview.columns}
                  headData={processedPreview.preview_head}
                  tailData={processedPreview.preview_tail}
                  totalRows={processedPreview.rows}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button
                    onClick={() => setActiveStep(3)}
                    className="btn"
                    style={{ background: 'var(--accent-purple)', color: '#fff' }}
                  >
                    <span>Proceed to Model Training →</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Model Training */}
        {activeStep === 3 && (
          <div className="card animate-fade-in" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Step 3: Machine Learning Model Training</h2>
            <div className="grid-2" style={{ gap: '20px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Features Source</label>
                <input
                  type="text"
                  value={selectedFeaturesFile || (selectedRawFile ? selectedRawFile.replace('.csv', '_features.csv') : 'Process features first')}
                  disabled
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Regression Algorithm</label>
                <select
                  value={modelType}
                  onChange={(e) => setModelType(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)' }}
                >
                  <option value="linear_regression">Ordinary Least Squares (OLS)</option>
                  <option value="ridge">Ridge Regression (L2 regularization)</option>
                  <option value="lasso">Lasso Regression (L1 regularization)</option>
                  <option value="random_forest">Random Forest Regressor</option>
                  <option value="xgboost">XGBoost Regressor</option>
                </select>
              </div>

              {/* Dynamic Hyperparameter Fields */}
              {(modelType === 'ridge' || modelType === 'lasso') && (
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>
                    Regularization strength (Alpha): {alpha}
                  </label>
                  <input
                    type="range"
                    min="0.01"
                    max="10.0"
                    step="0.05"
                    value={alpha}
                    onChange={(e) => setAlpha(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              {(modelType === 'random_forest' || modelType === 'xgboost') && (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Estimators: {nEstimators}</label>
                    <input
                      type="range"
                      min="10"
                      max="300"
                      step="10"
                      value={nEstimators}
                      onChange={(e) => setNEstimators(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Max Depth: {maxDepth}</label>
                    <input
                      type="range"
                      min="2"
                      max="10"
                      step="1"
                      value={maxDepth}
                      onChange={(e) => setMaxDepth(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                </>
              )}

              {modelType === 'xgboost' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Learning Rate: {learningRate}</label>
                  <input
                    type="range"
                    min="0.01"
                    max="0.5"
                    step="0.01"
                    value={learningRate}
                    onChange={(e) => setLearningRate(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={handleTrainModel}
                className="btn"
                style={{ background: 'var(--text-primary)', color: '#fff' }}
                disabled={loading || (!selectedRawFile && !selectedFeaturesFile)}
              >
                <span>{loading ? 'Training...' : 'Fit & Evaluate Model'}</span>
              </button>
            </div>

            {trainingResults && (
              <div className="animate-fade-in" style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Training Performance Summary</h3>
                <div className="grid-2" style={{ gap: '20px', marginBottom: '24px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>In-Sample (Train Set)</h4>
                    <table style={{ width: '100%', fontSize: '13px' }}>
                      <tbody>
                        <tr>
                          <td style={{ padding: '4px 0', color: 'var(--text-muted)' }}>R² Score</td>
                          <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{trainingResults.train_metrics.r2.toFixed(4)}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '4px 0', color: 'var(--text-muted)' }}>Mean Absolute Error (MAE)</td>
                          <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{trainingResults.train_metrics.mae.toFixed(6)}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '4px 0', color: 'var(--text-muted)' }}>Root Mean Squared Error (RMSE)</td>
                          <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{trainingResults.train_metrics.rmse.toFixed(6)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Out-of-Sample (Test Set)</h4>
                    <table style={{ width: '100%', fontSize: '13px' }}>
                      <tbody>
                        <tr>
                          <td style={{ padding: '4px 0', color: 'var(--text-muted)' }}>R² Score</td>
                          <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)', color: trainingResults.test_metrics.r2 >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{trainingResults.test_metrics.r2.toFixed(4)}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '4px 0', color: 'var(--text-muted)' }}>Mean Absolute Error (MAE)</td>
                          <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{trainingResults.test_metrics.mae.toFixed(6)}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '4px 0', color: 'var(--text-muted)' }}>Root Mean Squared Error (RMSE)</td>
                          <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{trainingResults.test_metrics.rmse.toFixed(6)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Model saved as: <strong style={{ color: 'var(--text-primary)' }}>{trainingResults.filename}</strong></span>
                  <button
                    onClick={() => setActiveStep(4)}
                    className="btn"
                    style={{ background: 'var(--accent-purple)', color: '#fff' }}
                  >
                    <span>Proceed to Backtesting →</span>
                  </button>
                </div>
              </div>
            )}

            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '20px' }}>
              Available Trained Models
            </h3>
            {trainedModels.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No models trained yet.</p>
            ) : (
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px 4px' }}>Model File</th>
                      <th style={{ padding: '8px 4px' }}>Underlying</th>
                      <th style={{ padding: '8px 4px' }}>Algorithm</th>
                      <th style={{ padding: '8px 4px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainedModels.map((m) => (
                      <tr key={m.filename} style={{ borderBottom: '1px dotted var(--border-color)' }}>
                        <td style={{ padding: '8px 4px', fontWeight: 600 }}>{m.filename}</td>
                        <td style={{ padding: '8px 4px' }}>{m.symbol}</td>
                        <td style={{ padding: '8px 4px', textTransform: 'capitalize' }}>{m.model_type.replace('_', ' ')}</td>
                        <td style={{ padding: '8px 4px' }}>
                          <button
                            className="btn-link"
                            style={{ color: 'var(--accent-purple)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                            onClick={() => {
                              setSelectedModelFile(m.filename);
                              setActiveStep(4);
                            }}
                          >
                            Select Model
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

        {/* STEP 4: Backtest Configuration */}
        {activeStep === 4 && (
          <div className="card animate-fade-in" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Step 4: Configure Backtesting Simulation</h2>
            <div className="grid-2" style={{ gap: '20px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Model Selector</label>
                <select
                  value={selectedModelFile}
                  onChange={(e) => setSelectedModelFile(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)' }}
                >
                  <option value="">-- Select Model --</option>
                  {trainedModels.map((m) => (
                    <option key={m.filename} value={m.filename}>{m.filename}</option>
                  ))}
                </select>
              </div>

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
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              Execution Constraints & Filters
            </h3>
            <div className="grid-2" style={{ gap: '20px', marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={vixFilter} onChange={(e) => setVixFilter(e.target.checked)} />
                <span style={{ fontSize: '13.5px' }}><strong>VIX Filter</strong> (Only enter trades when India VIX &gt; 15)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={volumeFilter} onChange={(e) => setVolumeFilter(e.target.checked)} />
                <span style={{ fontSize: '13.5px' }}><strong>Volume Filter</strong> (Only enter trades when Relative Volume &gt; 1.2)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={trendFilter} onChange={(e) => setTrendFilter(e.target.checked)} />
                <span style={{ fontSize: '13.5px' }}><strong>VWAP Trend Filter</strong> (Long above VWAP, Short below VWAP)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={trailingStop} onChange={(e) => setTrailingStop(e.target.checked)} />
                <span style={{ fontSize: '13.5px' }}><strong>Trailing Stop Loss</strong> (Dynamic 5m trailing using 0.75 ATR)</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={handleRunBacktest}
                className="btn"
                style={{ background: 'var(--text-primary)', color: '#fff' }}
                disabled={loading || !selectedModelFile}
              >
                <span>{loading ? 'Running...' : 'Run Simulation'}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Backtest Results Dashboard */}
        {activeStep === 5 && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Metric Overview Card */}
            {backtestResults ? (
              <>
                <div className="card" style={{ padding: '24px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>Simulation Results Metrics</h2>
                  <div className="grid-3" style={{ gap: '16px' }}>
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
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)' }}>CAGR</span>
                      <h3 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 0 0', color: backtestResults.metrics.cagr_pct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {backtestResults.metrics.cagr_pct}%
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Equity Curve Chart */}
                <div className="card" style={{ padding: '24px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>ITSM Equity & Drawdown Curves</h2>
                  <AnalyticsChart
                    type="line"
                    data={{
                      labels: backtestResults.chart_data.dates,
                      datasets: [
                        {
                          label: 'ITSM Strategy Return (%)',
                          data: backtestResults.chart_data.strategy_cum_return,
                          borderColor: '#22c55e',
                          backgroundColor: 'rgba(34, 197, 94, 0.04)',
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
                  <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>ITSM Executed Trade Log</h2>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '10px 6px' }}>Exit Date</th>
                          <th style={{ padding: '10px 6px' }}>Direction</th>
                          <th style={{ padding: '10px 6px' }}>Qty</th>
                          <th style={{ padding: '10px 6px' }}>Entry Price</th>
                          <th style={{ padding: '10px 6px' }}>Exit Price</th>
                          <th style={{ padding: '10px 6px' }}>SL Price</th>
                          <th style={{ padding: '10px 6px' }}>Stopped Out</th>
                          <th style={{ padding: '10px 6px' }}>PnL (INR)</th>
                          <th style={{ padding: '10px 6px' }}>Return (%)</th>
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
                <p style={{ color: 'var(--text-secondary)' }}>No simulation data. Please select a model and run a backtest in Step 4.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

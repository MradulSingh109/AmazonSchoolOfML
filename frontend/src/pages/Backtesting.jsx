import React, { useState, useEffect } from 'react';
import AnalyticsChart from '../components/AnalyticsChart';

export default function Backtesting({ refreshTrigger }) {
  const [signalFiles, setSignalFiles] = useState([]);
  const [selectedSignal, setSelectedSignal] = useState('');
  const [capital, setCapital] = useState(100000);
  const [riskFreeRate, setRiskFreeRate] = useState(5.0);
  const [stopLoss, setStopLoss] = useState(1.0);
  const [takeProfit, setTakeProfit] = useState(6.0);
  const [status, setStatus] = useState({ type: null, message: '' });
  const [backtesting, setBacktesting] = useState(false);
  const [result, setResult] = useState(null);

  const fetchSignals = async () => {
    try {
      const res = await fetch('/api/signals/list');
      const data = await res.json();
      if (data.success) {
        setSignalFiles(data.datasets);
      }
    } catch (err) {
      console.error('Failed to load signals:', err);
    }
  };

  useEffect(() => {
    fetchSignals();
  }, [refreshTrigger]);

  const handleBacktest = async (e) => {
    if (e) e.preventDefault();

    if (!selectedSignal) {
      setStatus({ type: 'error', message: 'Please select a signals dataset to run.' });
      return;
    }

    setBacktesting(true);
    setStatus({ type: 'loading', message: 'Executing portfolio simulation and calculating stats...' });
    setResult(null);

    try {
      const res = await fetch('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signal_filename: selectedSignal,
          initial_capital: Number(capital),
          risk_free_rate: Number(riskFreeRate) / 100,
          stop_loss: Number(stopLoss),
          take_profit: Number(takeProfit)
        })
      });
      const data = await res.json();

      if (data.success) {
        setStatus({ type: 'success', message: 'Backtest completed successfully!' });
        setResult(data);
      } else {
        setStatus({ type: 'error', message: data.message });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Error running backtest: ' + err.message });
    } finally {
      setBacktesting(false);
    }
  };

  // Prepare Returns Chart Data
  const getReturnsChartData = () => {
    if (!result?.chart_data) return null;
    const { dates, strategy_cum_return, stock_cum_return } = result.chart_data;

    return {
      labels: dates,
      datasets: [
        {
          label: 'ML Strategy Return',
          data: strategy_cum_return,
          borderColor: '#10b981',
          borderWidth: 2,
          pointRadius: 0,
          fill: false
        },
        {
          label: 'Stock Buy & Hold',
          data: stock_cum_return,
          borderColor: '#64748b',
          borderWidth: 1.5,
          pointRadius: 0,
          borderDash: [3, 3],
          fill: false
        }
      ]
    };
  };

  // Prepare Drawdown Chart Data
  const getDrawdownChartData = () => {
    if (!result?.chart_data) return null;
    const { dates, drawdown, stock_drawdown } = result.chart_data;

    return {
      labels: dates,
      datasets: [
        {
          label: 'Strategy Drawdown',
          data: drawdown,
          borderColor: '#f43f5e',
          borderWidth: 1.5,
          backgroundColor: 'rgba(244, 63, 94, 0.12)',
          fill: true,
          pointRadius: 0
        },
        {
          label: 'Stock Drawdown',
          data: stock_drawdown,
          borderColor: '#fb923c',
          borderWidth: 1,
          fill: false,
          pointRadius: 0
        }
      ]
    };
  };

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <h1>Backtesting Engine</h1>
        <p>Simulate historical performance of generated trading signals against a buy-and-hold benchmark</p>
      </header>

      {/* Backtest Execution Control Card */}
      <section className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <div>
            <h2>Run Backtest Simulation</h2>
            <span>Choose your signal dataset and set basic portfolio metrics</span>
          </div>
        </div>

        <form onSubmit={handleBacktest}>
          <div className="form-grid" style={{ gridTemplateColumns: '1.8fr 1.2fr 1fr 1fr 1fr' }}>
            <div className="form-group">
              <label htmlFor="select-signal-backtest">Select Signals Dataset</label>
              <select
                id="select-signal-backtest"
                value={selectedSignal}
                onChange={(e) => setSelectedSignal(e.target.value)}
              >
                <option value="">Choose generated signals file</option>
                {signalFiles.map((s) => (
                  <option key={s.filename} value={s.filename}>
                    {s.symbol} ({s.rows.toLocaleString()} rows, buy: {s.buy_percentage}%)
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="input-capital">Initial Capital (₹)</label>
              <input
                type="number"
                id="input-capital"
                value={capital}
                min="1000"
                max="100000000"
                step="1000"
                onChange={(e) => setCapital(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="input-rf">Risk-Free Rate (%)</label>
              <input
                type="number"
                id="input-rf"
                value={riskFreeRate}
                min="0.0"
                max="25.0"
                step="0.1"
                onChange={(e) => setRiskFreeRate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="input-sl">Stop Loss (%)</label>
              <input
                type="number"
                id="input-sl"
                value={stopLoss}
                min="0.0"
                max="20.0"
                step="0.1"
                onChange={(e) => setStopLoss(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="input-tp">Take Profit (%)</label>
              <input
                type="number"
                id="input-tp"
                value={takeProfit}
                min="0.0"
                max="50.0"
                step="0.1"
                onChange={(e) => setTakeProfit(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={backtesting} style={{ marginTop: '16px' }}>
            Run Backtest
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
          {/* Key Portfolio Performance Cards */}
          <div className="grid-4">
            <div className={`stat-card ${result.metrics.strategy_total_return >= result.metrics.stock_total_return ? 'green' : 'amber'}`}>
              <div className="stat-label">Total Return</div>
              <div
                className="stat-value"
                style={{ color: result.metrics.strategy_total_return >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}
              >
                {result.metrics.strategy_total_return >= 0 ? '+' : ''}
                {(result.metrics.strategy_total_return * 100).toFixed(1)}%
              </div>
              <div className="stat-sub">
                Stock B&H:{' '}
                <span style={{ color: result.metrics.stock_total_return >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {result.metrics.stock_total_return >= 0 ? '+' : ''}
                  {(result.metrics.stock_total_return * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="stat-card green">
              <div className="stat-label">CAGR (Strategy vs Stock)</div>
              <div className="stat-value green">{(result.metrics.strategy_cagr * 100).toFixed(2)}%</div>
              <div className="stat-sub">Benchmark CAGR: {(result.metrics.stock_cagr * 100).toFixed(2)}%</div>
            </div>
            <div className="stat-card cyan">
              <div className="stat-label">Sharpe Ratio</div>
              <div className="stat-value cyan">{result.metrics.strategy_sharpe.toFixed(2)}</div>
              <div className="stat-sub">Benchmark Sharpe: {result.metrics.stock_sharpe.toFixed(2)}</div>
            </div>
            <div className="stat-card red">
              <div className="stat-label">Max Drawdown</div>
              <div className="stat-value red">{(result.metrics.strategy_max_drawdown * 100).toFixed(1)}%</div>
              <div className="stat-sub">Benchmark Drawdown: {(result.metrics.stock_max_drawdown * 100).toFixed(1)}%</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid-2" style={{ marginTop: '24px' }}>
            {/* Returns Chart */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h2>Cumulative Returns Curve</h2>
                  <span>Strategy return vs. Stock Buy & Hold (%)</span>
                </div>
              </div>
              <AnalyticsChart
                type="line"
                data={getReturnsChartData()}
                options={{
                  plugins: {
                    legend: { display: true }
                  },
                  scales: {
                    y: {
                      ticks: {
                        callback: (v) => v + '%'
                      }
                    }
                  }
                }}
              />
            </div>

            {/* Drawdown Chart */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h2>Drawdown Curves</h2>
                  <span>Portfolio drawdown depth over time (%)</span>
                </div>
              </div>
              <AnalyticsChart
                type="line"
                data={getDrawdownChartData()}
                options={{
                  plugins: {
                    legend: { display: true }
                  },
                  scales: {
                    y: {
                      max: 0,
                      ticks: {
                        color: 'var(--accent-red)',
                        callback: (v) => v + '%'
                      },
                      grid: { color: 'rgba(244, 63, 94, 0.08)' }
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Completed Trade Log Table */}
          <div className="card section-gap" style={{ marginTop: '24px' }}>
            <div className="card-header">
              <div>
                <h2>Completed Trade Log</h2>
                <span>Detailed execution list of all generated trades</span>
              </div>
            </div>
            <div className="table-wrapper" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Trade #</th>
                    <th>Direction</th>
                    <th>Entry Date</th>
                    <th>Entry Price</th>
                    <th>Exit Date</th>
                    <th>Exit Price</th>
                    <th>Return (%)</th>
                    <th>Outcome</th>
                    <th>Capital Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No trades executed in this backtest.
                      </td>
                    </tr>
                  ) : (
                    result.trades.map((t, idx) => {
                      const returnVal = (t.return * 100).toFixed(2);
                      const isWin = t.return > 0;
                      const returnClass = isWin ? 'green' : 'red';
                      const outcomeText = isWin ? 'WIN' : 'LOSS';
                      const outcomeClass = isWin ? 'badge-green' : 'badge-red';

                      return (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td
                            style={{
                              fontWeight: 700,
                              color: t.direction === 'LONG' ? 'var(--accent-green)' : 'var(--accent-amber)'
                            }}
                          >
                            {t.direction}
                          </td>
                          <td>{t.entry_date}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            ₹{t.entry_price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td>{t.exit_date}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            {t.exit_price !== undefined
                              ? `₹${t.exit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                              : '—'}
                          </td>
                          <td
                            style={{
                              fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                              color: isWin ? 'var(--accent-green)' : 'var(--accent-red)'
                            }}
                          >
                            {isWin ? '+' : ''}
                            {returnVal}%
                          </td>
                          <td>
                            <span className={`badge ${outcomeClass}`}>{outcomeText}</span>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {t.exit_capital !== undefined
                              ? `₹${t.exit_capital.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                              : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

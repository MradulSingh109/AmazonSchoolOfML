import React, { useState, useEffect } from 'react';
import AnalyticsChart from '../components/AnalyticsChart';

export default function MLModels({ refreshTrigger }) {
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [modelType, setModelType] = useState('logistic_regression');
  const [status, setStatus] = useState({ type: null, message: '' });
  const [training, setTraining] = useState(false);
  const [result, setResult] = useState(null);
  const [regimeAware, setRegimeAware] = useState(false);

  // Logistic Regression Hyperparameters
  const [lrC, setLrC] = useState(0.01);
  const [lrSolver, setLrSolver] = useState('lbfgs');

  // Random Forest Hyperparameters
  const [rfNEstimators, setRfNEstimators] = useState(200);
  const [rfMaxDepth, setRfMaxDepth] = useState(4);
  const [rfMinSamplesLeaf, setRfMinSamplesLeaf] = useState(100);
  const [rfMinSamplesSplit, setRfMinSamplesSplit] = useState(100);

  // XGBoost Hyperparameters
  const [xgbNEstimators, setXgbNEstimators] = useState(250);
  const [xgbMaxDepth, setXgbMaxDepth] = useState(1);
  const [xgbLearningRate, setXgbLearningRate] = useState(0.02);
  const [xgbSubsample, setXgbSubsample] = useState(0.5);
  const [xgbMinChildWeight, setXgbMinChildWeight] = useState(25);
  const [xgbRegAlpha, setXgbRegAlpha] = useState(5.0);
  const [xgbRegLambda, setXgbRegLambda] = useState(15.0);

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

  useEffect(() => {
    fetchDatasets();
  }, [refreshTrigger]);

  const getHyperparameters = () => {
    if (modelType === 'logistic_regression') {
      return {
        C: parseFloat(lrC),
        solver: lrSolver
      };
    } else if (modelType === 'random_forest') {
      return {
        n_estimators: parseInt(rfNEstimators),
        max_depth: rfMaxDepth ? parseInt(rfMaxDepth) : null,
        min_samples_leaf: parseInt(rfMinSamplesLeaf),
        min_samples_split: parseInt(rfMinSamplesSplit)
      };
    } else if (modelType === 'xgboost') {
      return {
        n_estimators: parseInt(xgbNEstimators),
        max_depth: parseInt(xgbMaxDepth),
        learning_rate: parseFloat(xgbLearningRate),
        subsample: parseFloat(xgbSubsample),
        min_child_weight: parseInt(xgbMinChildWeight),
        reg_alpha: parseFloat(xgbRegAlpha),
        reg_lambda: parseFloat(xgbRegLambda)
      };
    }
    return {};
  };

  const handleTrain = async (e) => {
    if (e) e.preventDefault();

    if (!selectedDataset) {
      setStatus({ type: 'error', message: 'Please choose an engineered dataset.' });
      return;
    }

    setTraining(true);
    const modelNameStr = modelType.replace('_', ' ').toUpperCase();
    setStatus({ type: 'loading', message: `Training ${modelNameStr} on ${selectedDataset.toUpperCase()} features...` });
    setResult(null);

    try {
      const res = await fetch('/api/models/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedDataset,
          model_type: modelType,
          hyperparameters: getHyperparameters(),
          regime_aware: regimeAware
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
      setStatus({ type: 'error', message: 'Error connecting to server: ' + err.message });
    } finally {
      setTraining(false);
    }
  };

  // Prepare Metrics Table Data
  const getMetricsList = () => {
    if (!result?.metrics) return [];
    const m = result.metrics;
    return [
      { name: 'Accuracy', train: m.train_accuracy, cv: m.cv_accuracy },
      { name: 'Precision', train: m.train_precision, cv: m.cv_precision },
      { name: 'Recall', train: m.train_recall, cv: m.cv_recall },
      { name: 'F1 Score', train: m.train_f1, cv: m.cv_f1 },
      { name: 'ROC-AUC', train: m.train_auc, cv: m.cv_auc }
    ];
  };

  const renderOverfitBadge = (train, cv) => {
    const diff = Math.abs(train - cv);
    if (diff > 0.15) {
      return <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>Overfitting</span>;
    } else if (diff > 0.08) {
      return <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>Mild Overfit</span>;
    } else if (cv < 0.52) {
      return <span style={{ color: 'var(--text-muted)' }}>Underfitting</span>;
    }
    return <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>Optimal</span>;
  };

  // Prepare Grouped Bar Chart Data
  const getPerformanceComparisonChartData = () => {
    if (!result?.metrics) return null;
    const m = result.metrics;
    return {
      labels: ['Accuracy', 'Precision', 'Recall', 'F1-Score', 'ROC-AUC'],
      datasets: [
        {
          label: 'In-Sample (Training)',
          data: [
            (m.train_accuracy * 100).toFixed(2),
            (m.train_precision * 100).toFixed(2),
            (m.train_recall * 100).toFixed(2),
            (m.train_f1 * 100).toFixed(2),
            (m.train_auc * 100).toFixed(2)
          ],
          backgroundColor: 'rgba(124, 58, 237, 0.65)',
          borderColor: 'rgb(124, 58, 237)',
          borderWidth: 1.5,
          borderRadius: 4
        },
        {
          label: 'Out-of-Sample (Cross-Validation)',
          data: [
            (m.cv_accuracy * 100).toFixed(2),
            (m.cv_precision * 100).toFixed(2),
            (m.cv_recall * 100).toFixed(2),
            (m.cv_f1 * 100).toFixed(2),
            (m.cv_auc * 100).toFixed(2)
          ],
          backgroundColor: 'rgba(34, 211, 238, 0.65)',
          borderColor: 'rgb(34, 211, 238)',
          borderWidth: 1.5,
          borderRadius: 4
        }
      ]
    };
  };

  // Prepare Feature Importance Chart Data
  const getImportanceChartData = () => {
    if (!result?.feature_importance) return null;
    const labels = result.feature_importance.map((item) => item.feature);
    const values = result.feature_importance.map((item) => item.importance);
    const colors = values.map((val) => (val >= 0 ? 'rgba(34, 211, 238, 0.75)' : 'rgba(244, 63, 94, 0.75)'));

    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderRadius: 4,
        }
      ]
    };
  };

  // Prepare Prediction Class Doughnut Chart Data
  const getPredictionsPieChartData = () => {
    if (!result?.predictions_sample) return null;
    let ups = 0;
    let downs = 0;
    result.predictions_sample.forEach((p) => {
      if (p === 1) ups++;
      else downs++;
    });

    return {
      labels: ['BUY (Long)', 'SELL/FLAT (Short)'],
      datasets: [
        {
          data: [ups, downs],
          backgroundColor: ['rgba(16, 185, 129, 0.75)', 'rgba(244, 63, 94, 0.65)'],
          borderColor: ['#10b981', '#f43f5e'],
          borderWidth: 1.5,
        }
      ]
    };
  };

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <h1>Machine Learning Models</h1>
        <p>Train Logistic Regression, Random Forest, or XGBoost on historical stock features with custom hyperparameters</p>
      </header>

      {/* Model Training Control Card */}
      <section className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <div>
            <h2>Train Model</h2>
            <span>Configure your features, adjust hyperparameters, and execute training</span>
          </div>
        </div>

        <form onSubmit={handleTrain}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="select-stock-model">Select Processed Dataset</label>
              <select
                id="select-stock-model"
                value={selectedDataset}
                onChange={(e) => setSelectedDataset(e.target.value)}
              >
                <option value="">Choose an engineered dataset</option>
                {datasets.map((d) => (
                  <option key={d.filename} value={d.symbol.toLowerCase()}>
                    {d.symbol} ({d.rows.toLocaleString()} rows, {d.features_count} features)
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="select-model-type">Model Algorithm</label>
              <select
                id="select-model-type"
                value={modelType}
                onChange={(e) => setModelType(e.target.value)}
              >
                <option value="logistic_regression">Logistic Regression (Baseline)</option>
                <option value="random_forest">Random Forest (Non-linear)</option>
                <option value="xgboost">XGBoost (Production Boosting)</option>
              </select>
            </div>
            
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', height: '100%', paddingTop: '24px' }}>
              <label htmlFor="regime-aware-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0 }}>
                <input
                  id="regime-aware-checkbox"
                  type="checkbox"
                  checked={regimeAware}
                  onChange={(e) => setRegimeAware(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-purple)' }}
                />
                <div>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px' }}>Regime-Aware Model</span>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Train sub-models on Bull, Bear, and Sideways states</span>
                </div>
              </label>
            </div>
          </div>

          {/* Hyperparameter Settings */}
          <div className="hyperparameters-section" style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px dashed var(--border-color)' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-purple)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.75px' }}>
              Model Hyperparameters
            </h3>
            <div className="form-grid">
              {modelType === 'logistic_regression' && (
                <>
                  <div className="form-group">
                    <label htmlFor="lr-c">Regularization (C)</label>
                    <input
                      id="lr-c"
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      max="10.0"
                      value={lrC}
                      onChange={(e) => setLrC(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="lr-solver">Solver</label>
                    <select
                      id="lr-solver"
                      value={lrSolver}
                      onChange={(e) => setLrSolver(e.target.value)}
                    >
                      <option value="lbfgs">lbfgs (Default)</option>
                      <option value="liblinear">liblinear</option>
                      <option value="newton-cg">newton-cg</option>
                    </select>
                  </div>
                </>
              )}

              {modelType === 'random_forest' && (
                <>
                  <div className="form-group">
                    <label htmlFor="rf-estimators">Estimators (Trees)</label>
                    <input
                      id="rf-estimators"
                      type="number"
                      min="10"
                      max="1000"
                      value={rfNEstimators}
                      onChange={(e) => setRfNEstimators(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="rf-depth">Max Depth</label>
                    <input
                      id="rf-depth"
                      type="number"
                      min="1"
                      max="50"
                      value={rfMaxDepth || ''}
                      onChange={(e) => setRfMaxDepth(e.target.value)}
                      placeholder="Unlimited"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="rf-samples-leaf">Min Samples Leaf</label>
                    <input
                      id="rf-samples-leaf"
                      type="number"
                      min="1"
                      max="1000"
                      value={rfMinSamplesLeaf}
                      onChange={(e) => setRfMinSamplesLeaf(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="rf-samples-split">Min Samples Split</label>
                    <input
                      id="rf-samples-split"
                      type="number"
                      min="2"
                      max="1000"
                      value={rfMinSamplesSplit}
                      onChange={(e) => setRfMinSamplesSplit(e.target.value)}
                    />
                  </div>
                </>
              )}

              {modelType === 'xgboost' && (
                <>
                  <div className="form-group">
                    <label htmlFor="xgb-estimators">Estimators (Trees)</label>
                    <input
                      id="xgb-estimators"
                      type="number"
                      min="10"
                      max="1000"
                      value={xgbNEstimators}
                      onChange={(e) => setXgbNEstimators(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="xgb-depth">Max Depth</label>
                    <input
                      id="xgb-depth"
                      type="number"
                      min="1"
                      max="15"
                      value={xgbMaxDepth}
                      onChange={(e) => setXgbMaxDepth(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="xgb-lr">Learning Rate</label>
                    <input
                      id="xgb-lr"
                      type="number"
                      step="0.001"
                      min="0.001"
                      max="1.0"
                      value={xgbLearningRate}
                      onChange={(e) => setXgbLearningRate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="xgb-subsample">Subsample Rate</label>
                    <input
                      id="xgb-subsample"
                      type="number"
                      step="0.05"
                      min="0.1"
                      max="1.0"
                      value={xgbSubsample}
                      onChange={(e) => setXgbSubsample(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="xgb-min-weight">Min Child Weight</label>
                    <input
                      id="xgb-min-weight"
                      type="number"
                      min="1"
                      max="500"
                      value={xgbMinChildWeight}
                      onChange={(e) => setXgbMinChildWeight(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="xgb-alpha">L1 Reg (Alpha)</label>
                    <input
                      id="xgb-alpha"
                      type="number"
                      step="0.1"
                      min="0"
                      value={xgbRegAlpha}
                      onChange={(e) => setXgbRegAlpha(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="xgb-lambda">L2 Reg (Lambda)</label>
                    <input
                      id="xgb-lambda"
                      type="number"
                      step="0.1"
                      min="0"
                      value={xgbRegLambda}
                      onChange={(e) => setXgbRegLambda(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={training}
              style={{ width: '220px', height: '46px' }}
            >
              Execute Training
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

      {/* Results Panel */}
      {result && (
        <div style={{ marginTop: '24px' }}>
          {/* Validation Metrics Row */}
          <div className="grid-2">
            {/* Validation Metrics Table */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h2>Model Validation Metrics</h2>
                  <span>Comparison of Full-Training Set metrics vs TimeSeriesSplit Cross-Validation</span>
                </div>
              </div>

              <div className="table-wrapper">
                <table style={{ textAlign: 'center',background:'#000000' }}>
                  <thead style={{background:'#ffffff'}}>
                    <tr>
                      <th style={{ textAlign: 'left',color:'black' }}>Metric</th>
                      <th style={{color:'black'}}>In-Sample (Train)</th>
                      <th style={{color:'black'}}>Out-of-Sample (CV)</th>
                      <th style={{color:'black'}}>Overfitting</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getMetricsList().map((metric) => (
                      <tr key={metric.name}>
                        <td style={{ fontWeight: 700, textAlign: 'left', color: 'var(--text-primary)' }}>
                          {metric.name}
                        </td>
                        <td>{(metric.train * 100).toFixed(2)}%</td>
                        <td style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                          {(metric.cv * 100).toFixed(2)}%
                        </td>
                        <td>{renderOverfitBadge(metric.train, metric.cv)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Performance Comparison Chart */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h2>Performance Comparison Chart</h2>
                  <span>Visualization of In-Sample vs. Cross-Validation accuracy and scores (%)</span>
                </div>
              </div>
              <div style={{ height: '300px' }}>
                <AnalyticsChart
                  type="bar"
                  data={getPerformanceComparisonChartData()}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        min: 0,
                        max: 100,
                        ticks: { color: 'var(--text-secondary)' }
                      },
                      x: {
                        ticks: { color: 'var(--text-primary)', font: { weight: 'bold' } }
                      }
                    },
                    plugins: {
                      legend: {
                        display: true,
                        position: 'bottom',
                        labels: { color: 'var(--text-primary)' }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid-2" style={{ marginTop: '24px' }}>
            {/* Feature Importance Chart */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h2>Feature Importances (Top 8)</h2>
                  <span>Technical indicators contributing most to predictions</span>
                </div>
              </div>
              <AnalyticsChart
                type="bar"
                data={getImportanceChartData()}
                options={{
                  indexAxis: 'y',
                  scales: {
                    x: {
                      ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } },
                    },
                    y: {
                      ticks: { color: 'var(--text-primary)', font: { size: 11, weight: 'bold' } },
                    }
                  }
                }}
              />
            </div>

            {/* Doughnut Predictions Chart */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h2>Prediction Class Analysis</h2>
                  <span>Distribution of predictions (Up vs Down/Flat)</span>
                </div>
              </div>
              <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AnalyticsChart
                  type="doughnut"
                  data={getPredictionsPieChartData()}
                  options={{
                    plugins: {
                      legend: {
                        display: true,
                        position: 'bottom',
                        labels: { color: 'var(--text-primary)' }
                      }
                    },
                    cutout: '60%'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

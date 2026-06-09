import React, { useState, useEffect } from 'react';
import AnalyticsChart from '../components/AnalyticsChart';

export default function MLModels({ refreshTrigger }) {
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [modelType, setModelType] = useState('logistic_regression');
  const [status, setStatus] = useState({ type: null, message: '' });
  const [training, setTraining] = useState(false);
  const [result, setResult] = useState(null);

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
          model_type: modelType
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
      return <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>⚠️ Overfitting</span>;
    } else if (diff > 0.08) {
      return <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>Mild Overfit</span>;
    } else if (cv < 0.52) {
      return <span style={{ color: 'var(--text-muted)' }}>Underfitting</span>;
    }
    return <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>Optimal</span>;
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
        <p>Train Logistic Regression, Random Forest, or XGBoost on historical stock features</p>
      </header>

      {/* Model Training Control Card */}
      <section className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <div>
            <h2>Train Model</h2>
            <span>Configure your features and choose a machine learning model to execute training</span>
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
            <div className="form-group" style={{ justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={training}
                style={{ width: '100%', height: '46px' }}
              >
                Execute Training
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
          {/* Validation Metrics Table */}
          <div className="card section-gap">
            <div className="card-header">
              <div>
                <h2>Model Validation Metrics</h2>
                <span>Comparison of Full-Training Set metrics vs TimeSeriesSplit Cross-Validation</span>
              </div>
            </div>

            <div className="table-wrapper">
              <table style={{ textAlign: 'center' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Metric</th>
                    <th>In-Sample (Training Set)</th>
                    <th>Out-of-Sample (Cross-Validation)</th>
                    <th>Overfitting Check</th>
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

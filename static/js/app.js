/**
 * QuantML Research Platform — Front-end Logic
 * Handles Navigation, Phase 1 (Data), Phase 2 & 3 (Features), Phase 4 & 5 (Models), Phase 6 (Signals), Phase 7 (Backtesting), Phase 8 (SHAP)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Navigation
  setupNavigation();
  
  // Phase 1: Data Collection
  setDefaultEndDate();
  loadStockList();
  bindDataEvents();

  // Phase 2 & 3: Feature Engineering
  bindFeatureEvents();

  // Phase 4 & 5: Model Training
  bindModelEvents();

  // Phase 6: Signal Generation
  bindSignalEvents();

  // Phase 7: Backtesting Engine
  bindBacktestEvents();

  // Phase 8: SHAP Explainability
  bindShapEvents();
});

// --- Navigation ---
function setupNavigation() {
  const navItems = document.querySelectorAll('.sidebar .nav-item');
  const sections = document.querySelectorAll('.page-section');
  const globalStockList = document.getElementById('global-stock-list-card');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      // Toggle nav item classes
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      // Toggle page visibility
      const pageId = 'page-' + item.dataset.page;
      sections.forEach(sec => sec.style.display = 'none');
      
      const targetSec = document.getElementById(pageId);
      if (targetSec) targetSec.style.display = 'block';

      // Hide or show the global downloaded datasets list card
      if (item.dataset.page === 'data') {
        globalStockList.style.display = 'block';
      } else {
        globalStockList.style.display = 'none';
      }

      // Dropdown refreshes depending on page
      if (item.dataset.page === 'features') {
        refreshFeaturesDropdown();
      }
      if (item.dataset.page === 'models') {
        refreshModelsDropdown();
      }
      if (item.dataset.page === 'signals') {
        refreshSignalsDropdowns();
      }
      if (item.dataset.page === 'backtest') {
        refreshBacktestDropdown();
      }
      if (item.dataset.page === 'shap') {
        refreshShapDropdowns();
      }
    });
  });
}

// --- Globals ---
let priceChart = null;
let volumeChart = null;
let rsiChart = null;
let macdChart = null;
let importanceChart = null;
let predictionsPieChart = null;
let signalsPriceChart = null;
let backtestReturnsChart = null;
let backtestDrawdownChart = null;

// --- Chart Defaults (Optimized for Light Mode) ---
const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0f172a',
      titleColor: '#ffffff',
      bodyColor: '#e2e8f0',
      borderColor: 'rgba(0, 0, 0, 0.1)',
      borderWidth: 1,
      titleFont: { family: 'Inter', size: 12 },
      bodyFont: { family: 'JetBrains Mono', size: 11 },
      padding: 10,
      cornerRadius: 8,
    }
  },
  scales: {
    x: {
      ticks: { color: '#475569', maxTicksLimit: 10, font: { size: 10 } },
      grid: { color: 'rgba(0, 0, 0, 0.03)' },
    },
    y: {
      ticks: { color: '#475569', font: { family: 'JetBrains Mono', size: 10 } },
      grid: { color: 'rgba(0, 0, 0, 0.04)' },
    }
  }
};

// ==========================================
// PHASE 1: DATA COLLECTION
// ==========================================

function setDefaultEndDate() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('input-end').value = today;
}

function showDataStatus(type, message) {
  const bar = document.getElementById('status-bar-data');
  bar.className = 'status-bar ' + type;
  bar.style.display = 'flex';
  if (type === 'loading') {
    bar.innerHTML = '<div class="spinner"></div> ' + message;
  } else {
    const icon = type === 'success' ? '✓' : '✕';
    bar.innerHTML = icon + '&nbsp;&nbsp;' + message;
  }
}

function bindDataEvents() {
  document.getElementById('btn-download').addEventListener('click', handleDownload);

  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.getElementById('input-symbol').value = chip.dataset.symbol;
      document.getElementById('input-symbol').focus();
    });
  });

  document.getElementById('input-symbol').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleDownload();
  });
}

async function handleDownload() {
  const symbol = document.getElementById('input-symbol').value.trim();
  const startDate = document.getElementById('input-start').value;
  const endDate = document.getElementById('input-end').value;

  if (!symbol) {
    showDataStatus('error', 'Please enter a stock symbol.');
    return;
  }
  if (!startDate || !endDate) {
    showDataStatus('error', 'Please select both start and end dates.');
    return;
  }

  const btn = document.getElementById('btn-download');
  btn.disabled = true;
  showDataStatus('loading', `Downloading ${symbol.toUpperCase()} from Yahoo Finance...`);

  try {
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, start_date: startDate, end_date: endDate })
    });
    const data = await res.json();

    if (data.success) {
      showDataStatus('success', data.message);
      renderDataResults(data);
      loadStockList();
    } else {
      showDataStatus('error', data.message);
      document.getElementById('result-panel-data').style.display = 'none';
    }
  } catch (err) {
    showDataStatus('error', 'Network error: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

function renderDataResults(data) {
  document.getElementById('result-panel-data').style.display = 'block';

  // Stats
  const s = data.summary;
  const returnClass = s.total_return >= 0 ? 'green' : 'red';
  const returnSign = s.total_return >= 0 ? '+' : '';
  
  document.getElementById('stats-row-data').innerHTML = `
    <div class="stat-card cyan">
      <div class="stat-label">Total Rows</div>
      <div class="stat-value cyan">${data.rows.toLocaleString()}</div>
      <div class="stat-sub">${data.date_range.start} → ${data.date_range.end}</div>
    </div>
    <div class="stat-card green">
      <div class="stat-label">Avg Close Price</div>
      <div class="stat-value green">₹${s.avg_price.toLocaleString()}</div>
      <div class="stat-sub">Low: ₹${s.min_price.toLocaleString()} — High: ₹${s.max_price.toLocaleString()}</div>
    </div>
    <div class="stat-card ${s.total_return >= 0 ? 'green' : 'amber'}">
      <div class="stat-label">Total Return</div>
      <div class="stat-value ${returnClass}">${returnSign}${s.total_return}%</div>
      <div class="stat-sub">₹${s.start_price.toLocaleString()} → ₹${s.end_price.toLocaleString()}</div>
    </div>
  `;

  // Charts
  renderPriceChart(data.chart_data);
  renderVolumeChart(data.chart_data);

  // Table
  renderTable('data', data.columns, data.preview_head, data.preview_tail, data.rows);
}

function renderPriceChart(chartData) {
  const ctx = document.getElementById('price-chart').getContext('2d');
  if (priceChart) priceChart.destroy();

  const gradient = ctx.createLinearGradient(0, 0, 0, 320);
  gradient.addColorStop(0, 'rgba(14, 165, 233, 0.15)');
  gradient.addColorStop(1, 'rgba(14, 165, 233, 0)');

  priceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.dates,
      datasets: [{
        data: chartData.close,
        borderColor: '#0284c7',
        borderWidth: 2,
        backgroundColor: gradient,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.1,
      }]
    },
    options: { ...chartDefaults }
  });
}

function renderVolumeChart(chartData) {
  const ctx = document.getElementById('volume-chart').getContext('2d');
  if (volumeChart) volumeChart.destroy();

  volumeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartData.dates,
      datasets: [{
        data: chartData.volume,
        backgroundColor: 'rgba(124, 58, 237, 0.35)',
        borderRadius: 2,
      }]
    },
    options: {
      ...chartDefaults,
      scales: {
        ...chartDefaults.scales,
        y: {
          ...chartDefaults.scales.y,
          ticks: {
            ...chartDefaults.scales.y.ticks,
            callback: v => (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v)
          }
        }
      }
    }
  });
}

async function loadStockList() {
  try {
    const res = await fetch('/api/stocks');
    const data = await res.json();
    const container = document.getElementById('stock-list');

    if (!data.success || data.stocks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">📂</div>
          <p>No datasets downloaded yet. Use the form above to download data.</p>
        </div>`;
      return;
    }

    container.innerHTML = data.stocks.map(s => `
      <div class="stock-item">
        <div>
          <span class="symbol">${s.symbol}</span>
          <span class="meta">&nbsp;·&nbsp;${s.rows} rows&nbsp;·&nbsp;${s.size_kb} KB</span>
        </div>
        <div class="meta">Modified: ${s.modified}</div>
      </div>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

// ==========================================
// PHASE 2 & 3: FEATURE ENGINEERING
// ==========================================

async function refreshFeaturesDropdown() {
  const select = document.getElementById('select-stock-features');
  select.innerHTML = '<option value="">Choose a stock dataset</option>';

  try {
    const res = await fetch('/api/stocks');
    const data = await res.json();
    if (data.success && data.stocks.length > 0) {
      data.stocks.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.symbol.toLowerCase();
        opt.textContent = `${s.symbol} (${s.rows} rows)`;
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

function showFeaturesStatus(type, message) {
  const bar = document.getElementById('status-bar-features');
  bar.className = 'status-bar ' + type;
  bar.style.display = 'flex';
  if (type === 'loading') {
    bar.innerHTML = '<div class="spinner"></div> ' + message;
  } else {
    const icon = type === 'success' ? '✓' : '✕';
    bar.innerHTML = icon + '&nbsp;&nbsp;' + message;
  }
}

function bindFeatureEvents() {
  document.getElementById('btn-process-features').addEventListener('click', handleProcessFeatures);
}

async function handleProcessFeatures() {
  const select = document.getElementById('select-stock-features');
  const symbol = select.value;

  if (!symbol) {
    showFeaturesStatus('error', 'Please choose a dataset to process.');
    return;
  }

  const btn = document.getElementById('btn-process-features');
  btn.disabled = true;
  showFeaturesStatus('loading', `Executing Feature Engineering pipeline for ${symbol.toUpperCase()}...`);

  try {
    const res = await fetch('/api/features/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol })
    });
    const data = await res.json();

    if (data.success) {
      showFeaturesStatus('success', data.message);
      renderFeatureResults(data);
    } else {
      showFeaturesStatus('error', data.message);
      document.getElementById('result-panel-features').style.display = 'none';
    }
  } catch (err) {
    showFeaturesStatus('error', 'Error connecting to server: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

function renderFeatureResults(data) {
  document.getElementById('result-panel-features').style.display = 'block';

  const cb = data.class_balance;
  document.getElementById('stats-row-features').innerHTML = `
    <div class="stat-card cyan">
      <div class="stat-label">Cleaned Dataset Rows</div>
      <div class="stat-value cyan">${data.rows.toLocaleString()}</div>
      <div class="stat-sub">Dropped edge cases with NaN values</div>
    </div>
    <div class="stat-card purple">
      <div class="stat-label">Engineered Features</div>
      <div class="stat-value purple">${data.added_features.length}</div>
      <div class="stat-sub">Trend, Momentum, Volatility, Volume, Returns</div>
    </div>
    <div class="stat-card green">
      <div class="stat-label">Target Class Balance (Ups)</div>
      <div class="stat-value green">${cb.up_percentage}%</div>
      <div class="stat-sub">Up days: ${cb.ups.toLocaleString()} / Down or Flat: ${cb.downs.toLocaleString()}</div>
    </div>
  `;

  renderRsiChart(data.chart_data);
  renderMacdChart(data.chart_data);
  renderTable('features', data.columns, data.preview_head, data.preview_tail, data.rows);
}

function renderRsiChart(chartData) {
  const ctx = document.getElementById('rsi-chart').getContext('2d');
  if (rsiChart) rsiChart.destroy();

  rsiChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.dates,
      datasets: [
        {
          label: 'RSI',
          data: chartData.rsi,
          borderColor: '#7c3aed',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.1,
          z: 10
        },
        {
          label: 'Overbought (70)',
          data: Array(chartData.dates.length).fill(70),
          borderColor: 'rgba(239, 68, 68, 0.4)',
          borderWidth: 1,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        },
        {
          label: 'Oversold (30)',
          data: Array(chartData.dates.length).fill(30),
          borderColor: 'rgba(16, 185, 129, 0.4)',
          borderWidth: 1,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        legend: { display: false }
      },
      scales: {
        ...chartDefaults.scales,
        y: {
          min: 0,
          max: 100,
          ticks: { color: '#475569', font: { family: 'JetBrains Mono', size: 10 } },
          grid: { color: 'rgba(0, 0, 0, 0.04)' }
        }
      }
    }
  });
}

function renderMacdChart(chartData) {
  const ctx = document.getElementById('macd-chart').getContext('2d');
  if (macdChart) macdChart.destroy();

  macdChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.dates,
      datasets: [
        {
          label: 'MACD Line',
          data: chartData.macd,
          borderColor: '#0284c7',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.1
        },
        {
          label: 'Signal Line',
          data: chartData.macd_signal,
          borderColor: 'rgba(217, 119, 6, 0.8)',
          borderWidth: 1.2,
          pointRadius: 0,
          tension: 0.1
        }
      ]
    },
    options: {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        legend: { display: false }
      }
    }
  });
}

// ==========================================
// PHASE 4 & 5: ML MODELS
// ==========================================

async function refreshModelsDropdown() {
  const select = document.getElementById('select-stock-model');
  select.innerHTML = '<option value="">Choose an engineered dataset</option>';

  try {
    const res = await fetch('/api/features/list');
    const data = await res.json();
    if (data.success && data.datasets.length > 0) {
      data.datasets.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.symbol.toLowerCase();
        opt.textContent = `${s.symbol} (${s.rows} rows, ${s.features_count} features)`;
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

function showModelsStatus(type, message) {
  const bar = document.getElementById('status-bar-models');
  bar.className = 'status-bar ' + type;
  bar.style.display = 'flex';
  if (type === 'loading') {
    bar.innerHTML = '<div class="spinner"></div> ' + message;
  } else {
    const icon = type === 'success' ? '✓' : '✕';
    bar.innerHTML = icon + '&nbsp;&nbsp;' + message;
  }
}

// Model Binding
function bindModelEvents() {
  document.getElementById('btn-train-model').addEventListener('click', handleTrainModel);
}

async function handleTrainModel() {
  const symbol = document.getElementById('select-stock-model').value;
  const modelType = document.getElementById('select-model-type').value;

  if (!symbol) {
    showModelsStatus('error', 'Please choose an engineered dataset.');
    return;
  }

  const btn = document.getElementById('btn-train-model');
  btn.disabled = true;
  showModelsStatus('loading', `Training ${modelType.replace('_', ' ').toUpperCase()} on ${symbol.toUpperCase()} features...`);

  try {
    const res = await fetch('/api/models/train', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, model_type: modelType })
    });
    const data = await res.json();

    if (data.success) {
      showModelsStatus('success', data.message);
      renderModelResults(data);
    } else {
      showModelsStatus('error', data.message);
      document.getElementById('result-panel-models').style.display = 'none';
    }
  } catch (err) {
    showModelsStatus('error', 'Error connecting to server: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

function renderModelResults(data) {
  document.getElementById('result-panel-models').style.display = 'block';

  const m = data.metrics;
  const tbody = document.getElementById('metrics-table-body');
  
  const metricsList = [
    { name: 'Accuracy', train: m.train_accuracy, cv: m.cv_accuracy },
    { name: 'Precision', train: m.train_precision, cv: m.cv_precision },
    { name: 'Recall', train: m.train_recall, cv: m.cv_recall },
    { name: 'F1 Score', train: m.train_f1, cv: m.cv_f1 },
    { name: 'ROC-AUC', train: m.train_auc, cv: m.cv_auc }
  ];

  tbody.innerHTML = metricsList.map(metric => {
    const diff = Math.abs(metric.train - metric.cv);
    let checkText = '<span style="color:var(--accent-green); font-weight:600;">Optimal</span>';
    if (diff > 0.15) {
      checkText = '<span style="color:var(--accent-red); font-weight:600;">⚠️ Overfitting</span>';
    } else if (diff > 0.08) {
      checkText = '<span style="color:var(--accent-amber); font-weight:600;">Mild Overfit</span>';
    } else if (metric.cv < 0.52) {
      checkText = '<span style="color:var(--text-muted);">Underfitting</span>';
    }
    
    return `
      <tr>
        <td style="font-weight:700; text-align:left; color:var(--text-primary); font-family:var(--font-sans);">${metric.name}</td>
        <td>${(metric.train * 100).toFixed(2)}%</td>
        <td style="color:var(--accent-cyan); font-weight:700;">${(metric.cv * 100).toFixed(2)}%</td>
        <td>${checkText}</td>
      </tr>
    `;
  }).join('');

  renderImportanceChart(data.feature_importance);
  renderPredictionsPieChart(data.predictions_sample);
}

function renderImportanceChart(importances) {
  const ctx = document.getElementById('importance-chart').getContext('2d');
  if (importanceChart) importanceChart.destroy();

  const labels = importances.map(item => item.feature);
  const values = importances.map(item => item.importance);
  const colors = values.map(val => val >= 0 ? 'rgba(14, 165, 233, 0.75)' : 'rgba(239, 68, 68, 0.75)');

  importanceChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderRadius: 4,
      }]
    },
    options: {
      ...chartDefaults,
      indexAxis: 'y',
      plugins: {
        ...chartDefaults.plugins,
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: { color: '#475569', font: { family: 'JetBrains Mono', size: 10 } },
          grid: { color: 'rgba(0, 0, 0, 0.04)' }
        },
        y: {
          ticks: { color: '#0f172a', font: { size: 11, weight: 'bold' } },
          grid: { display: false }
        }
      }
    }
  });
}

function renderPredictionsPieChart(predictions) {
  const ctx = document.getElementById('predictions-pie-chart').getContext('2d');
  if (predictionsPieChart) predictionsPieChart.destroy();

  let ups = 0;
  let downs = 0;
  predictions.forEach(p => {
    if (p === 1) ups++;
    else downs++;
  });

  predictionsPieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['BUY (Long)', 'SELL/FLAT (Short)'],
      datasets: [{
        data: [ups, downs],
        backgroundColor: ['rgba(16, 185, 129, 0.75)', 'rgba(239, 68, 68, 0.65)'],
        borderColor: ['#10b981', '#ef4444'],
        borderWidth: 1.5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { color: '#0f172a', font: { family: 'Inter', size: 11 } }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          bodyColor: '#ffffff',
          borderColor: 'rgba(0,0,0,0.1)',
          borderWidth: 1,
          bodyFont: { family: 'Inter', size: 11 },
        }
      },
      cutout: '60%'
    }
  });
}

// ==========================================
// PHASE 6: SIGNAL GENERATION
// ==========================================

async function refreshSignalsDropdowns() {
  const selectStock = document.getElementById('select-stock-signals');
  const selectModel = document.getElementById('select-model-signals');

  selectStock.innerHTML = '<option value="">Choose stock</option>';
  selectModel.innerHTML = '<option value="">Choose trained model</option>';

  try {
    const resStocks = await fetch('/api/features/list');
    const dataStocks = await resStocks.json();
    if (dataStocks.success && dataStocks.datasets.length > 0) {
      dataStocks.datasets.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.symbol.toLowerCase();
        opt.textContent = s.symbol;
        selectStock.appendChild(opt);
      });
    }

    const resModels = await fetch('/api/models/list');
    const dataModels = await resModels.json();
    if (dataModels.success && dataModels.models.length > 0) {
      dataModels.models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.filename;
        opt.textContent = `${m.symbol} - ${m.model_type.replace('_', ' ').toUpperCase()} (CV Acc: ${(m.metrics.cv_accuracy * 100).toFixed(1)}%)`;
        selectModel.appendChild(opt);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

function showSignalsStatus(type, message) {
  const bar = document.getElementById('status-bar-signals');
  bar.className = 'status-bar ' + type;
  bar.style.display = 'flex';
  if (type === 'loading') {
    bar.innerHTML = '<div class="spinner"></div> ' + message;
  } else {
    const icon = type === 'success' ? '✓' : '✕';
    bar.innerHTML = icon + '&nbsp;&nbsp;' + message;
  }
}

function bindSignalEvents() {
  document.getElementById('btn-generate-signals').addEventListener('click', handleGenerateSignals);
  
  document.getElementById('select-stock-signals').addEventListener('change', e => {
    const symbol = e.target.value;
    if (!symbol) return;
    const modelSelect = document.getElementById('select-model-signals');
    for (let i = 0; i < modelSelect.options.length; i++) {
      const opt = modelSelect.options[i];
      if (opt.value.startsWith(symbol + '_')) {
        modelSelect.selectedIndex = i;
        break;
      }
    }
  });
}

async function handleGenerateSignals() {
  const symbol = document.getElementById('select-stock-signals').value;
  const modelFilename = document.getElementById('select-model-signals').value;
  const threshold = document.getElementById('input-threshold').value;
  const shortStyle = document.getElementById('select-style-signals').value;

  if (!symbol || !modelFilename) {
    showSignalsStatus('error', 'Please select both a dataset stock and a trained model.');
    return;
  }

  const btn = document.getElementById('btn-generate-signals');
  btn.disabled = true;
  showSignalsStatus('loading', 'Generating Buy/Sell trading signals...');

  try {
    const res = await fetch('/api/signals/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol,
        model_filename: modelFilename,
        threshold,
        short_style: shortStyle
      })
    });
    const data = await res.json();

    if (data.success) {
      showSignalsStatus('success', data.message);
      renderSignalResults(data, shortStyle);
    } else {
      showSignalsStatus('error', data.message);
      document.getElementById('result-panel-signals').style.display = 'none';
    }
  } catch (err) {
    showSignalsStatus('error', 'Error generating signals: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

function renderSignalResults(data, shortStyle) {
  document.getElementById('result-panel-signals').style.display = 'block';

  document.getElementById('stats-row-signals').innerHTML = `
    <div class="stat-card cyan">
      <div class="stat-label">Total Days analyzed</div>
      <div class="stat-value cyan">${data.rows.toLocaleString()}</div>
      <div class="stat-sub">Trading days in sample</div>
    </div>
    <div class="stat-card green">
      <div class="stat-label">BUY / LONG Signals</div>
      <div class="stat-value green">${data.buys.toLocaleString()}</div>
      <div class="stat-sub">${data.buy_percentage}% of total period</div>
    </div>
    <div class="stat-card amber">
      <div class="stat-label">Trades Executed</div>
      <div class="stat-value amber">${data.trades_count.toLocaleString()}</div>
      <div class="stat-sub">Position entry & exit switches</div>
    </div>
  `;

  renderSignalsPriceChart(data.chart_data, shortStyle);
  renderTable('signals', data.columns, data.preview_head, data.preview_tail, data.rows);
}

function renderSignalsPriceChart(chartData, shortStyle) {
  const ctx = document.getElementById('signals-price-chart').getContext('2d');
  if (signalsPriceChart) signalsPriceChart.destroy();

  const dates = chartData.dates;
  const prices = chartData.close;
  const signals = chartData.signals;
  
  const buyScatter = [];
  const sellScatter = [];

  for (let i = 0; i < signals.length; i++) {
    if (i === 0) continue;
    if (signals[i] !== signals[i-1]) {
      if (signals[i] === 1) {
        buyScatter.push({ x: dates[i], y: prices[i] });
      } else {
        sellScatter.push({ x: dates[i], y: prices[i] });
      }
    }
  }

  signalsPriceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'Close Price',
          data: prices,
          borderColor: 'rgba(71, 85, 105, 0.4)',
          borderWidth: 1.8,
          pointRadius: 0,
          fill: false,
          z: 1
        },
        {
          label: 'BUY Signal Trigger',
          data: dates.map(d => {
            const found = buyScatter.find(pt => pt.x === d);
            return found ? found.y : null;
          }),
          backgroundColor: '#10b981',
          borderColor: '#10b981',
          pointRadius: 6,
          pointHoverRadius: 8,
          showLine: false,
          fill: false,
          z: 10
        },
        {
          label: 'SELL/EXIT Signal Trigger',
          data: dates.map(d => {
            const found = sellScatter.find(pt => pt.x === d);
            return found ? found.y : null;
          }),
          backgroundColor: '#ef4444',
          borderColor: '#ef4444',
          pointRadius: 6,
          pointHoverRadius: 8,
          showLine: false,
          fill: false,
          z: 10
        }
      ]
    },
    options: {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        legend: {
          display: true,
          position: 'top',
          labels: { color: '#0f172a', font: { family: 'Inter', size: 11 } }
        },
        tooltip: {
          ...chartDefaults.plugins.tooltip,
          callbacks: {
            label: context => {
              if (context.datasetIndex === 0) return `Close Price: ₹${context.raw.toFixed(2)}`;
              if (context.datasetIndex === 1) return `BUY Signal triggered: ₹${context.raw.toFixed(2)}`;
              if (context.datasetIndex === 2) return `SELL/EXIT triggered: ₹${context.raw.toFixed(2)}`;
              return '';
            }
          }
        }
      },
      scales: {
        ...chartDefaults.scales,
        y: {
          ...chartDefaults.scales.y,
          ticks: { color: '#475569', font: { family: 'JetBrains Mono', size: 10 } }
        }
      }
    }
  });
}

// ==========================================
// PHASE 7: BACKTESTING ENGINE
// ==========================================

async function refreshBacktestDropdown() {
  const select = document.getElementById('select-signal-backtest');
  select.innerHTML = '<option value="">Choose generated signals file</option>';

  try {
    const res = await fetch('/api/signals/list');
    const data = await res.json();
    if (data.success && data.datasets.length > 0) {
      data.datasets.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.filename;
        opt.textContent = `${s.symbol} (${s.rows} rows, buy signals: ${s.buy_percentage}%)`;
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

function showBacktestStatus(type, message) {
  const bar = document.getElementById('status-bar-backtest');
  bar.className = 'status-bar ' + type;
  bar.style.display = 'flex';
  if (type === 'loading') {
    bar.innerHTML = '<div class="spinner"></div> ' + message;
  } else {
    const icon = type === 'success' ? '✓' : '✕';
    bar.innerHTML = icon + '&nbsp;&nbsp;' + message;
  }
}

function bindBacktestEvents() {
  document.getElementById('btn-run-backtest').addEventListener('click', handleRunBacktest);
}

async function handleRunBacktest() {
  const filename = document.getElementById('select-signal-backtest').value;
  const capital = document.getElementById('input-capital').value;
  const rf = document.getElementById('input-rf').value;

  if (!filename) {
    showBacktestStatus('error', 'Please select a signals dataset to run.');
    return;
  }

  const btn = document.getElementById('btn-run-backtest');
  btn.disabled = true;
  showBacktestStatus('loading', 'Executing portfolio simulation and calculating stats...');

  try {
    const res = await fetch('/api/backtest/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signal_filename: filename,
        initial_capital: capital,
        risk_free_rate: rf / 100
      })
    });
    const data = await res.json();

    if (data.success) {
      showBacktestStatus('success', 'Backtest completed successfully!');
      renderBacktestResults(data);
    } else {
      showBacktestStatus('error', data.message);
      document.getElementById('result-panel-backtest').style.display = 'none';
    }
  } catch (err) {
    showBacktestStatus('error', 'Error running backtest: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

function renderBacktestResults(data) {
  document.getElementById('result-panel-backtest').style.display = 'block';

  const m = data.metrics;
  const stratClass = m.strategy_total_return >= 0 ? 'green' : 'red';
  const stockClass = m.stock_total_return >= 0 ? 'green' : 'red';
  const stratSign = m.strategy_total_return >= 0 ? '+' : '';
  const stockSign = m.stock_total_return >= 0 ? '+' : '';

  document.getElementById('stats-row-backtest').innerHTML = `
    <div class="stat-card ${m.strategy_total_return >= m.stock_total_return ? 'green' : 'amber'}">
      <div class="stat-label">Total Return</div>
      <div class="stat-value ${stratClass}">${stratSign}${(m.strategy_total_return * 100).toFixed(1)}%</div>
      <div class="stat-sub">Stock B&H: <span class="${stockClass}">${stockSign}${(m.stock_total_return * 100).toFixed(1)}%</span></div>
    </div>
    <div class="stat-card green">
      <div class="stat-label">CAGR (Strategy vs Stock)</div>
      <div class="stat-value green">${(m.strategy_cagr * 100).toFixed(2)}%</div>
      <div class="stat-sub">Benchmark CAGR: ${(m.stock_cagr * 100).toFixed(2)}%</div>
    </div>
    <div class="stat-card cyan">
      <div class="stat-label">Sharpe Ratio</div>
      <div class="stat-value cyan">${m.strategy_sharpe.toFixed(2)}</div>
      <div class="stat-sub">Benchmark Sharpe: ${m.stock_sharpe.toFixed(2)}</div>
    </div>
    <div class="stat-card red">
      <div class="stat-label">Max Drawdown</div>
      <div class="stat-value red">${(m.strategy_max_drawdown * 100).toFixed(1)}%</div>
      <div class="stat-sub">Benchmark Drawdown: ${(m.stock_max_drawdown * 100).toFixed(1)}%</div>
    </div>
  `;

  renderBacktestReturnsChart(data.chart_data);
  renderBacktestDrawdownChart(data.chart_data);
  renderTradesLog(data.trades);
}

function renderBacktestReturnsChart(chartData) {
  const ctx = document.getElementById('backtest-returns-chart').getContext('2d');
  if (backtestReturnsChart) backtestReturnsChart.destroy();

  backtestReturnsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.dates,
      datasets: [
        {
          label: 'ML Strategy Return',
          data: chartData.strategy_cum_return,
          borderColor: '#10b981',
          borderWidth: 2,
          pointRadius: 0,
          fill: false
        },
        {
          label: 'Stock Buy & Hold',
          data: chartData.stock_cum_return,
          borderColor: '#94a3b8',
          borderWidth: 1.5,
          pointRadius: 0,
          borderDash: [3, 3],
          fill: false
        }
      ]
    },
    options: {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        legend: {
          display: true,
          labels: { color: '#0f172a', font: { family: 'Inter', size: 10 } }
        }
      },
      scales: {
        ...chartDefaults.scales,
        y: {
          ...chartDefaults.scales.y,
          ticks: {
            ...chartDefaults.scales.y.ticks,
            callback: v => v + '%'
          }
        }
      }
    }
  });
}

function renderBacktestDrawdownChart(chartData) {
  const ctx = document.getElementById('backtest-drawdown-chart').getContext('2d');
  if (backtestDrawdownChart) backtestDrawdownChart.destroy();

  const gradientStrat = ctx.createLinearGradient(0, 0, 0, 250);
  gradientStrat.addColorStop(0, 'rgba(239, 68, 68, 0.15)');
  gradientStrat.addColorStop(1, 'rgba(239, 68, 68, 0)');

  backtestDrawdownChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.dates,
      datasets: [
        {
          label: 'Strategy Drawdown',
          data: chartData.drawdown,
          borderColor: '#ef4444',
          borderWidth: 1.5,
          backgroundColor: gradientStrat,
          fill: true,
          pointRadius: 0
        },
        {
          label: 'Stock Drawdown',
          data: chartData.stock_drawdown,
          borderColor: '#d97706',
          borderWidth: 1,
          fill: false,
          pointRadius: 0
        }
      ]
    },
    options: {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        legend: {
          display: true,
          labels: { color: '#0f172a', font: { family: 'Inter', size: 10 } }
        }
      },
      scales: {
        ...chartDefaults.scales,
        y: {
          max: 0,
          ticks: {
            color: '#ef4444',
            font: { family: 'JetBrains Mono', size: 9 },
            callback: v => v + '%'
          },
          grid: { color: 'rgba(239, 68, 68, 0.08)' }
        }
      }
    }
  });
}

function renderTradesLog(trades) {
  const tbody = document.getElementById('table-body-trades');
  
  if (trades.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-secondary);">No trades executed in this backtest.</td></tr>`;
    return;
  }

  tbody.innerHTML = trades.map((t, i) => {
    const returnVal = (t.return * 100).toFixed(2);
    const returnClass = t.return > 0 ? 'green' : 'red';
    const returnSign = t.return > 0 ? '+' : '';
    const outcomeText = t.return > 0 ? 'WIN' : 'LOSS';
    const outcomeClass = t.return > 0 ? 'badge-green' : 'badge-red';

    return `
      <tr>
        <td>${i + 1}</td>
        <td style="font-weight:700; color:${t.direction === 'LONG' ? 'var(--accent-green)' : 'var(--accent-amber)'};">${t.direction}</td>
        <td>${t.entry_date}</td>
        <td>${t.exit_date}</td>
        <td class="${returnClass}" style="font-weight:700; font-family:var(--font-mono);">${returnSign}${returnVal}%</td>
        <td><span class="badge ${outcomeClass}">${outcomeText}</span></td>
      </tr>
    `;
  }).join('');
}

// ==========================================
// PHASE 8: SHAP EXPLAINABILITY
// ==========================================

async function refreshShapDropdowns() {
  const selectStock = document.getElementById('select-stock-shap');
  const selectModel = document.getElementById('select-model-shap');

  selectStock.innerHTML = '<option value="">Choose stock</option>';
  selectModel.innerHTML = '<option value="">Choose trained model</option>';

  try {
    const resStocks = await fetch('/api/features/list');
    const dataStocks = await resStocks.json();
    if (dataStocks.success && dataStocks.datasets.length > 0) {
      dataStocks.datasets.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.symbol.toLowerCase();
        opt.textContent = s.symbol;
        selectStock.appendChild(opt);
      });
    }

    const resModels = await fetch('/api/models/list');
    const dataModels = await resModels.json();
    if (dataModels.success && dataModels.models.length > 0) {
      dataModels.models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.filename;
        opt.textContent = `${m.symbol} - ${m.model_type.replace('_', ' ').toUpperCase()}`;
        selectModel.appendChild(opt);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

function showShapStatus(type, message) {
  const bar = document.getElementById('status-bar-shap');
  bar.className = 'status-bar ' + type;
  bar.style.display = 'flex';
  if (type === 'loading') {
    bar.innerHTML = '<div class="spinner"></div> ' + message;
  } else {
    const icon = type === 'success' ? '✓' : '✕';
    bar.innerHTML = icon + '&nbsp;&nbsp;' + message;
  }
}

function bindShapEvents() {
  document.getElementById('btn-run-shap').addEventListener('click', handleRunShap);
  
  document.getElementById('select-stock-shap').addEventListener('change', e => {
    const symbol = e.target.value;
    if (!symbol) return;
    const modelSelect = document.getElementById('select-model-shap');
    for (let i = 0; i < modelSelect.options.length; i++) {
      const opt = modelSelect.options[i];
      if (opt.value.startsWith(symbol + '_')) {
        modelSelect.selectedIndex = i;
        break;
      }
    }
  });
}

async function handleRunShap() {
  const symbol = document.getElementById('select-stock-shap').value;
  const modelFilename = document.getElementById('select-model-shap').value;

  if (!symbol || !modelFilename) {
    showShapStatus('error', 'Please select a dataset stock and a trained model.');
    return;
  }

  const btn = document.getElementById('btn-run-shap');
  btn.disabled = true;
  showShapStatus('loading', 'Calculating SHAP values (TreeExplainer/LinearExplainer)...');

  try {
    const res = await fetch('/api/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, model_filename: modelFilename })
    });
    const data = await res.json();

    if (data.success) {
      showShapStatus('success', 'SHAP analysis completed successfully.');
      renderShapResults(data);
    } else {
      showShapStatus('error', data.message);
      document.getElementById('result-panel-shap').style.display = 'none';
    }
  } catch (err) {
    showShapStatus('error', 'Error generating explainability: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

function renderShapResults(data) {
  document.getElementById('result-panel-shap').style.display = 'block';

  // Render feature ranking table
  const tbody = document.getElementById('shap-impact-table-body');
  tbody.innerHTML = data.feature_impact.map((fi, i) => `
    <tr>
      <td>${i + 1}</td>
      <td style="font-weight:700; color:var(--text-primary); text-align:left;">${fi.feature}</td>
      <td style="font-family:var(--font-mono); color:var(--accent-purple); font-weight:700;">
        ${fi.mean_abs_shap.toFixed(5)}
      </td>
    </tr>
  `).join('');

  // Render beeswarm plot on Canvas
  drawShapBeeswarm(data);
}

function drawShapBeeswarm(data) {
  const canvas = document.getElementById('shap-beeswarm-canvas');
  const ctx = canvas.getContext('2d');

  // Handle high-DPI screens
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = width * window.devicePixelRatio;
  canvas.height = height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  // Clear background (Optimized for Light Mode)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const features = data.feature_impact.map(fi => fi.feature); // Sorted by impact
  const beeswarm = data.beeswarm;

  // Margin definitions
  const leftMargin = 100;
  const rightMargin = 40;
  const topMargin = 30;
  const bottomMargin = 40;
  const plotWidth = width - leftMargin - rightMargin;
  const plotHeight = height - topMargin - bottomMargin;

  // Draw vertical lanes and labels for features
  const rowHeight = plotHeight / features.length;
  
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 11px Inter';

  // Draw grid lines
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.03)';
  ctx.lineWidth = 1;
  const zeroX = leftMargin + plotWidth / 2;
  
  // Center line (SHAP value = 0)
  ctx.beginPath();
  ctx.moveTo(zeroX, topMargin);
  ctx.lineTo(zeroX, topMargin + plotHeight);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.stroke();

  // Find max absolute SHAP value for scaling the horizontal axis
  let maxAbsShap = 0.001;
  features.forEach(feat => {
    beeswarm[feat].forEach(pt => {
      const absVal = Math.abs(pt.shap);
      if (absVal > maxAbsShap) maxAbsShap = absVal;
    });
  });
  
  // Add 10% padding to max SHAP
  maxAbsShap *= 1.1;

  // Draw ticks on X-axis (Light Mode optimized dark text)
  ctx.textAlign = 'center';
  ctx.fillStyle = '#475569';
  ctx.font = '9px JetBrains Mono';
  for (let val of [-maxAbsShap, -maxAbsShap/2, 0, maxAbsShap/2, maxAbsShap]) {
    const x = leftMargin + ((val + maxAbsShap) / (2 * maxAbsShap)) * plotWidth;
    ctx.fillText(val.toFixed(3), x, topMargin + plotHeight + 15);
    
    // Tiny tick line
    ctx.beginPath();
    ctx.moveTo(x, topMargin + plotHeight);
    ctx.lineTo(x, topMargin + plotHeight + 5);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.stroke();
  }

  // Draw dots for each feature track
  features.forEach((feat, laneIdx) => {
    const centerY = topMargin + laneIdx * rowHeight + rowHeight / 2;

    // Draw lane label
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10px Inter';
    ctx.fillText(feat, leftMargin - 15, centerY);

    // Draw track horizontal guide line
    ctx.beginPath();
    ctx.moveTo(leftMargin, centerY);
    ctx.lineTo(leftMargin + plotWidth, centerY);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.02)';
    ctx.stroke();

    const points = beeswarm[feat];
    
    // Sort points by SHAP value so they draw in order
    const pointsWithCoords = points.map(pt => {
      const shapVal = pt.shap;
      const x = leftMargin + ((shapVal + maxAbsShap) / (2 * maxAbsShap)) * plotWidth;
      return {
        x: x,
        normVal: pt.normalized_value,
        shap: shapVal
      };
    });

    // Simple Beeswarm clustering layout
    const binSize = 6;
    const bins = {};
    
    pointsWithCoords.forEach(pt => {
      const binIdx = Math.round(pt.x / binSize);
      if (!bins[binIdx]) bins[binIdx] = [];
      bins[binIdx].push(pt);
    });

    // Draw points inside bins with vertical layout
    Object.keys(bins).forEach(binIdx => {
      const ptsInBin = bins[binIdx];
      ptsInBin.forEach((pt, idx) => {
        const sign = idx % 2 === 0 ? 1 : -1;
        const multiplier = Math.floor((idx + 1) / 2);
        const yOffset = sign * multiplier * 4.5;
        const finalY = centerY + yOffset;

        // Color mapping: Light-mode friendly contrast gradient
        // Blue (Low) -> Magenta/Red (High)
        // Low: rgba(37, 99, 235, 0.75) [Blue]
        // High: rgba(220, 38, 38, 0.75) [Red]
        const r = Math.round(37 + pt.normVal * (220 - 37));
        const g = Math.round(99 - pt.normVal * 61);
        const b = Math.round(235 - pt.normVal * 197);
        
        ctx.beginPath();
        ctx.arc(pt.x, finalY, 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
        ctx.fill();
      });
    });
  });

  // Draw labels (Light Mode optimized dark text)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.font = '9px Inter';
  ctx.fillText('SHAP Value (impact on model prediction)', leftMargin, topMargin - 15);
  
  ctx.textAlign = 'right';
  ctx.fillText('Feature Value:', width - 130, topMargin - 15);

  // Gradient legend bar
  const legendWidth = 80;
  const legendX = width - 120;
  const legendY = topMargin - 20;
  
  const grad = ctx.createLinearGradient(legendX, 0, legendX + legendWidth, 0);
  grad.addColorStop(0, '#2563eb'); // Blue
  grad.addColorStop(1, '#dc2626'); // Red
  ctx.fillStyle = grad;
  ctx.fillRect(legendX, legendY, legendWidth, 6);
  
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'left';
  ctx.fillText('Low', legendX, legendY + 16);
  ctx.textAlign = 'right';
  ctx.fillText('High', legendX + legendWidth, legendY + 16);
}

// ==========================================
// GENERIC HELPERS
// ==========================================

function renderTable(prefix, columns, headData, tailData, totalRows) {
  const thead = document.getElementById(`table-head-${prefix}`);
  const tbody = document.getElementById(`table-body-${prefix}`);

  thead.innerHTML = columns.map(c => `<th>${c}</th>`).join('');

  let rows = '';
  headData.forEach(row => {
    rows += '<tr>' + columns.map(c => `<td>${formatTableCell(c, row[c])}</td>`).join('') + '</tr>';
  });

  rows += `<tr><td colspan="${columns.length}" class="table-ellipsis">⋯</td></tr>`;

  tailData.forEach(row => {
    rows += '<tr>' + columns.map(c => `<td>${formatTableCell(c, row[c])}</td>`).join('') + '</tr>';
  });

  tbody.innerHTML = rows;

  const subtitle = document.getElementById(`table-subtitle-${prefix}`);
  if (subtitle) {
    subtitle.textContent = `Showing first 10 & last 5 of ${totalRows.toLocaleString()} rows`;
  }
}

function formatTableCell(col, val) {
  if (val === undefined || val === null) return '—';
  
  if (col === 'Target') {
    return val === 1 
      ? '<span style="color:var(--accent-green); font-weight:700;">1 (UP)</span>' 
      : '<span style="color:var(--text-secondary);">0 (DOWN/FLAT)</span>';
  }
  
  if (col === 'Signal') {
    if (val === 1) return '<span style="color:var(--accent-green); font-weight:700;">BUY (1)</span>';
    if (val === -1) return '<span style="color:var(--accent-red); font-weight:700;">SELL (-1)</span>';
    return '<span style="color:var(--text-secondary);">FLAT (0)</span>';
  }

  if (col === 'Position_Change') {
    if (val === 1) return '<span style="color:var(--accent-green); font-weight:700;">+1 (ENTER/LONG)</span>';
    if (val === -1) return '<span style="color:var(--accent-red); font-weight:700;">-1 (EXIT/SHORT)</span>';
    if (val === 2) return '<span style="color:var(--accent-green); font-weight:700;">+2 (REVERSE LONG)</span>';
    if (val === -2) return '<span style="color:var(--accent-red); font-weight:700;">-2 (REVERSE SHORT)</span>';
    return '<span style="color:var(--text-secondary);">0 (HOLD)</span>';
  }
  
  if (col === 'Volume' || col === 'Vol_MA') {
    return Number(val).toLocaleString();
  }
  
  if (['Open', 'High', 'Low', 'Close', 'EMA20', 'EMA50', 'EMA200', 'ATR', 'BB_Width'].includes(col)) {
    return '₹' + Number(val).toFixed(2);
  }

  if (['Return_1D', 'Return_5D', 'Return_10D'].includes(col)) {
    const num = (Number(val) * 100).toFixed(2);
    const color = num >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    const sign = num >= 0 ? '+' : '';
    return `<span style="color:${color}">${sign}${num}%</span>`;
  }

  if (typeof val === 'number') {
    return val.toFixed(4);
  }
  
  return val;
}

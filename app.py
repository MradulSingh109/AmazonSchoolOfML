"""
QuantML Research Platform - Flask Application
Serves the web interface and API endpoints.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import pickle
from flask import Flask, render_template, request, jsonify
import pandas as pd
from src.data.data_loader import download_stock_data, list_downloaded_stocks
from src.features.feature_engineering import generate_features
from src.features.target_generation import generate_target

# ML models
from src.models.logistic_regression import train_logistic_regression
from src.models.random_forest import train_random_forest
from src.models.xgboost_model import train_xgboost

# Signal generator
from src.signals.signal_generator import generate_signals

# Backtesting engine
from src.backtesting.backtester import run_backtest

# SHAP Explainer
from src.explainability.shap_explainer import calculate_shap_values

app = Flask(__name__)

# Paths
RAW_DIR = os.path.join(os.path.dirname(__file__), 'data', 'raw')
PROCESSED_DIR = os.path.join(os.path.dirname(__file__), 'data', 'processed')
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')

# Create directories if they don't exist
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)


@app.route('/')
def index():
    """Serve the main dashboard page."""
    return render_template('index.html')


@app.route('/api/download', methods=['POST'])
def api_download():
    """API endpoint to download stock data."""
    data = request.get_json()
    symbol = data.get('symbol', '')
    start_date = data.get('start_date', '')
    end_date = data.get('end_date', '')

    if not symbol or not start_date or not end_date:
        return jsonify({'success': False, 'message': 'All fields are required.'})

    result = download_stock_data(symbol, start_date, end_date)
    return jsonify(result)


@app.route('/api/stocks', methods=['GET'])
def api_stocks():
    """API endpoint to list downloaded stocks."""
    stocks = list_downloaded_stocks()
    return jsonify({'success': True, 'stocks': stocks})


@app.route('/api/features/process', methods=['POST'])
def api_process_features():
    """API endpoint to run feature engineering and target generation."""
    data = request.get_json()
    symbol = data.get('symbol', '').lower()

    if not symbol:
        return jsonify({'success': False, 'message': 'Symbol is required.'})

    raw_filepath = os.path.join(RAW_DIR, f"{symbol}.csv")
    if not os.path.exists(raw_filepath):
        return jsonify({'success': False, 'message': f'Raw data for {symbol.upper()} not found. Download it first.'})

    try:
        # Load raw data
        df = pd.read_csv(raw_filepath)

        # Generate features
        feat_df = generate_features(df)

        # Generate targets
        final_df = generate_target(feat_df)

        # Drop NaN values resulting from rolling indicators
        clean_df = final_df.dropna().copy()

        processed_filename = f"{symbol}_features.csv"
        processed_filepath = os.path.join(PROCESSED_DIR, processed_filename)
        clean_df.to_csv(processed_filepath, index=False)

        # Get summary stats
        total_rows = len(clean_df)
        num_features = len(clean_df.columns) - 7  # Exclude original OHLCV, Date, and Target

        # Target class balance
        target_counts = clean_df['Target'].value_counts().to_dict()
        ups = int(target_counts.get(1, 0))
        downs = int(target_counts.get(0, 0))
        up_percentage = round((ups / total_rows) * 100, 2) if total_rows > 0 else 0

        # Features calculated list
        added_features = [
            'EMA20', 'EMA50', 'EMA200', 'RSI', 'MACD', 'MACD_Signal', 'ROC',
            'ATR', 'BB_Width', 'Vol_MA', 'Vol_Ratio', 'Return_1D', 'Return_5D', 'Return_10D'
        ]

        # Preview Data
        preview_head = clean_df.head(10).to_dict(orient='records')
        preview_tail = clean_df.tail(5).to_dict(orient='records')

        return jsonify({
            'success': True,
            'message': f'Feature engineering completed for {symbol.upper()}. Saved to data/processed/{processed_filename}',
            'filename': processed_filename,
            'rows': total_rows,
            'columns': list(clean_df.columns),
            'added_features': added_features,
            'class_balance': {
                'ups': ups,
                'downs': downs,
                'up_percentage': up_percentage
            },
            'preview_head': preview_head,
            'preview_tail': preview_tail,
            'chart_data': {
                'dates': clean_df['Date'].tolist(),
                'close': clean_df['Close'].tolist(),
                'rsi': clean_df['RSI'].tolist(),
                'macd': clean_df['MACD'].tolist(),
                'macd_signal': clean_df['MACD_Signal'].tolist()
            }
        })

    except Exception as e:
        return jsonify({'success': False, 'message': f'Error engineering features: {str(e)}'})


@app.route('/api/features/list', methods=['GET'])
def api_list_features():
    """List all processed feature datasets."""
    files = []
    for f in os.listdir(PROCESSED_DIR):
        if f.endswith('_features.csv'):
            symbol = f.replace('_features.csv', '').upper()
            filepath = os.path.join(PROCESSED_DIR, f)
            df = pd.read_csv(filepath)
            files.append({
                'filename': f,
                'symbol': symbol,
                'rows': len(df),
                'features_count': len(df.columns) - 7  # Date, OHLCV, Target
            })
    return jsonify({'success': True, 'datasets': files})


@app.route('/api/models/train', methods=['POST'])
def api_train_model():
    """API endpoint to train a selected ML model."""
    data = request.get_json()
    symbol = data.get('symbol', '').lower()
    model_type = data.get('model_type', '')  # 'logistic_regression', 'random_forest', 'xgboost'

    if not symbol or not model_type:
        return jsonify({'success': False, 'message': 'Dataset symbol and Model type are required.'})

    features_path = os.path.join(PROCESSED_DIR, f"{symbol}_features.csv")
    if not os.path.exists(features_path):
        return jsonify({'success': False, 'message': f'Engineered dataset for {symbol.upper()} not found. Run Feature Engineering first.'})

    try:
        # Load dataset
        df = pd.read_csv(features_path)

        # Chronological train-test split (80% train, 20% test to prevent data leakage)
        split_idx = int(len(df) * 0.8)
        df_train = df.iloc[:split_idx].reset_index(drop=True)

        # Define features (optimized subset to prevent overfitting)
        feature_cols = [
            'EMA50', 'RSI', 'MACD', 'ATR', 'Vol_Ratio', 'Return_1D'
        ]

        # Ensure all columns are present
        missing_cols = [col for col in feature_cols if col not in df_train.columns]
        if missing_cols:
            return jsonify({'success': False, 'message': f'Missing feature columns: {missing_cols}'})

        # Train model based on type (using df_train)
        result = {}
        if model_type == 'logistic_regression':
            result = train_logistic_regression(df_train, feature_cols)
        elif model_type == 'random_forest':
            result = train_random_forest(df_train, feature_cols)
        elif model_type == 'xgboost':
            result = train_xgboost(df_train, feature_cols)
        else:
            return jsonify({'success': False, 'message': f'Unknown model type: {model_type}'})

        # Save model
        model_save_name = f"{symbol}_{model_type}.pkl"
        model_save_path = os.path.join(MODELS_DIR, model_save_name)
        
        # Save model dict
        save_dict = {
            'model': result['model'],
            'scaler': result.get('scaler', None),
            'feature_cols': feature_cols,
            'metrics': result['metrics'],
            'feature_importance': result['feature_importance']
        }
        
        with open(model_save_path, 'wb') as f:
            pickle.dump(save_dict, f)

        response_data = {
            'success': True,
            'message': f'Successfully trained {model_type.replace("_", " ").title()} on {symbol.upper()}. Saved model to models/{model_save_name}',
            'model_type': model_type,
            'symbol': symbol.upper(),
            'metrics': result['metrics'],
            'feature_importance': result['feature_importance'][:8],
            'predictions_sample': result['predictions'][:20],
            'probabilities_sample': result['probabilities'][:20]
        }

        return jsonify(response_data)

    except Exception as e:
        return jsonify({'success': False, 'message': f'Error during training: {str(e)}'})


@app.route('/api/models/list', methods=['GET'])
def api_list_models():
    """List all trained model pickle files."""
    files = []
    for f in os.listdir(MODELS_DIR):
        if f.endswith('.pkl'):
            parts = f.replace('.pkl', '').split('_')
            model_type = '_'.join(parts[1:])
            symbol = parts[0].upper()
            filepath = os.path.join(MODELS_DIR, f)
            
            with open(filepath, 'rb') as pf:
                model_data = pickle.load(pf)
                
            files.append({
                'filename': f,
                'symbol': symbol,
                'model_type': model_type,
                'metrics': model_data['metrics']
            })
    return jsonify({'success': True, 'models': files})


@app.route('/api/signals/generate', methods=['POST'])
def api_generate_signals():
    """API endpoint to generate trading signals."""
    data = request.get_json()
    symbol = data.get('symbol', '').lower()
    model_filename = data.get('model_filename', '')
    threshold = float(data.get('threshold', 0.55))
    short_style = data.get('short_style', 'short')

    if not symbol or not model_filename:
        return jsonify({'success': False, 'message': 'Dataset symbol and trained model filename are required.'})

    features_path = os.path.join(PROCESSED_DIR, f"{symbol}_features.csv")
    model_path = os.path.join(MODELS_DIR, model_filename)

    if not os.path.exists(features_path):
        return jsonify({'success': False, 'message': f'Engineered dataset for {symbol.upper()} not found.'})
    if not os.path.exists(model_path):
        return jsonify({'success': False, 'message': f'Model {model_filename} not found.'})

    try:
        # Load dataset
        df = pd.read_csv(features_path)

        # Subset to the 20% out-of-sample test split chronologically
        split_idx = int(len(df) * 0.8)
        df_test = df.iloc[split_idx:].reset_index(drop=True)

        # Generate signals on the unseen test set
        signal_df = generate_signals(df_test, model_path, threshold, short_style)

        # Save to processed signals file
        signal_filename = f"{symbol}_signals.csv"
        signal_filepath = os.path.join(PROCESSED_DIR, signal_filename)
        signal_df.to_csv(signal_filepath, index=False)

        # Stats
        total_rows = len(signal_df)
        buys = int((signal_df['Signal'] == 1).sum())
        sells = int((signal_df['Signal'] == (-1 if short_style == 'short' else 0)).sum())
        
        buy_percentage = round((buys / total_rows) * 100, 2) if total_rows > 0 else 0
        sell_percentage = round((sells / total_rows) * 100, 2) if total_rows > 0 else 0
        trades_count = int((signal_df['Position_Change'] != 0).sum())

        preview_head = signal_df.head(10).to_dict(orient='records')
        preview_tail = signal_df.tail(5).to_dict(orient='records')

        return jsonify({
            'success': True,
            'message': f'Signals generated successfully. Saved to data/processed/{signal_filename}',
            'filename': signal_filename,
            'rows': total_rows,
            'columns': list(signal_df.columns),
            'buys': buys,
            'sells': sells,
            'buy_percentage': buy_percentage,
            'sell_percentage': sell_percentage,
            'trades_count': trades_count,
            'preview_head': preview_head,
            'preview_tail': preview_tail,
            'chart_data': {
                'dates': signal_df['Date'].tolist(),
                'close': signal_df['Close'].tolist(),
                'probability': signal_df['Probability'].tolist(),
                'signals': signal_df['Signal'].tolist()
            }
        })

    except Exception as e:
        return jsonify({'success': False, 'message': f'Error generating signals: {str(e)}'})


@app.route('/api/signals/list', methods=['GET'])
def api_list_signals():
    """List all processed datasets that have signal outputs generated."""
    files = []
    for f in os.listdir(PROCESSED_DIR):
        if f.endswith('_signals.csv'):
            symbol = f.replace('_signals.csv', '').upper()
            filepath = os.path.join(PROCESSED_DIR, f)
            df = pd.read_csv(filepath)
            
            buys = int((df['Signal'] == 1).sum())
            total = len(df)
            
            files.append({
                'filename': f,
                'symbol': symbol,
                'rows': total,
                'buy_percentage': round((buys / total) * 100, 1) if total > 0 else 0
            })
    return jsonify({'success': True, 'datasets': files})


@app.route('/api/backtest/run', methods=['POST'])
def api_run_backtest():
    """API endpoint to run backtest simulation."""
    data = request.get_json()
    signal_filename = data.get('signal_filename', '')
    risk_free_rate = float(data.get('risk_free_rate', 0.05))
    initial_capital = float(data.get('initial_capital', 100000.0))

    if not signal_filename:
        return jsonify({'success': False, 'message': 'Signal dataset filename is required.'})

    signal_filepath = os.path.join(PROCESSED_DIR, signal_filename)
    if not os.path.exists(signal_filepath):
        return jsonify({'success': False, 'message': f'Signal dataset {signal_filename} not found.'})

    try:
        # Load dataset
        df = pd.read_csv(signal_filepath)

        # Run backtester
        results = run_backtest(df, risk_free_rate, initial_capital)

        return jsonify({
            'success': True,
            'message': 'Backtest execution completed.',
            'metrics': results['metrics'],
            'trades': results['trades'],
            'chart_data': results['chart_data']
        })

    except Exception as e:
        return jsonify({'success': False, 'message': f'Error running backtest: {str(e)}'})


@app.route('/api/explain', methods=['POST'])
def api_explain_model():
    """API endpoint to calculate SHAP feature contributions."""
    data = request.get_json()
    symbol = data.get('symbol', '').lower()
    model_filename = data.get('model_filename', '')

    if not symbol or not model_filename:
        return jsonify({'success': False, 'message': 'Dataset symbol and trained model filename are required.'})

    features_path = os.path.join(PROCESSED_DIR, f"{symbol}_features.csv")
    model_path = os.path.join(MODELS_DIR, model_filename)

    if not os.path.exists(features_path):
        return jsonify({'success': False, 'message': f'Processed dataset for {symbol.upper()} not found.'})
    if not os.path.exists(model_path):
        return jsonify({'success': False, 'message': f'Model {model_filename} not found.'})

    try:
        # Load dataset
        df = pd.read_csv(features_path)

        # Calculate SHAP values
        results = calculate_shap_values(df, model_path, max_samples=250)

        if not results.get('success', False):
            return jsonify({'success': False, 'message': results.get('error', 'SHAP calculation failed.')})

        return jsonify(results)

    except Exception as e:
        return jsonify({'success': False, 'message': f'Error running SHAP explanation: {str(e)}'})


if __name__ == '__main__':
    app.run(debug=True, port=5000)

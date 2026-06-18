"""
QuantML Research Platform - Data Loader Module
Phase 1: Data Collection

Responsibilities:
  - Download OHLCV market data from Yahoo Finance
  - Support NSE-listed stocks (with .NS suffix)
  - Support custom date ranges
  - Store raw datasets locally as CSV
"""

import os
import yfinance as yf
import pandas as pd
from datetime import datetime


from app.config import RAW_DIR as DATA_DIR, RAW_INTRADAY_DIR


def ensure_data_dir():
    """Create the data/raw directory if it doesn't exist."""
    os.makedirs(DATA_DIR, exist_ok=True)


def get_nse_ticker(symbol: str) -> str:
    """Convert a stock symbol to Yahoo Finance ticker format, preserving global tickers."""
    symbol = symbol.strip().upper()
    # If the symbol has a suffix or special characters, leave it as is
    if any(char in symbol for char in ['.', '=', '-', '^']) or symbol in ['GLD', 'SLV', 'SPY', 'QQQ', 'BTC', 'ETH']:
        return symbol
    # Default to NSE stock
    return symbol + '.NS'


def download_stock_data(symbol: str, start_date: str, end_date: str) -> dict:
    """
    Download OHLCV data for an NSE stock from Yahoo Finance.

    Args:
        symbol: Stock symbol (e.g., 'RELIANCE', 'TCS', 'INFY')
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format

    Returns:
        dict with keys: success, message, filename, rows, columns, preview, summary
    """
    ensure_data_dir()

    ticker = get_nse_ticker(symbol)
    clean_symbol = symbol.strip().upper().replace('.NS', '')

    try:
        # Validate dates
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        end_dt = datetime.strptime(end_date, '%Y-%m-%d')
        if start_dt >= end_dt:
            return {'success': False, 'message': 'Start date must be before end date.'}

        # Download data
        df = yf.download(ticker, start=start_date, end=end_date, progress=False)

        if df.empty:
            return {
                'success': False,
                'message': f'No data found for {ticker}. Check if the symbol is valid.'
            }

        # Flatten multi-level columns if present
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        # Keep only OHLCV columns
        expected_cols = ['Open', 'High', 'Low', 'Close', 'Volume']
        available_cols = [c for c in expected_cols if c in df.columns]
        df = df[available_cols]

        # Reset index to make Date a column
        df.index.name = 'Date'
        df = df.reset_index()
        df['Date'] = df['Date'].dt.strftime('%Y-%m-%d')

        # Round numeric columns
        for col in ['Open', 'High', 'Low', 'Close']:
            if col in df.columns:
                df[col] = df[col].round(2)

        # Save to CSV
        filename = f"{clean_symbol.lower()}.csv"
        filepath = os.path.join(DATA_DIR, filename)
        df.to_csv(filepath, index=False)

        # Generate summary statistics
        summary = {}
        if 'Close' in df.columns:
            summary = {
                'min_price': float(df['Close'].min()),
                'max_price': float(df['Close'].max()),
                'avg_price': round(float(df['Close'].mean()), 2),
                'start_price': float(df['Close'].iloc[0]),
                'end_price': float(df['Close'].iloc[-1]),
                'total_return': round(
                    ((df['Close'].iloc[-1] - df['Close'].iloc[0]) / df['Close'].iloc[0]) * 100, 2
                ),
                'avg_volume': int(df['Volume'].mean()) if 'Volume' in df.columns else 0,
            }

        # Preview data (first 10 and last 5 rows)
        preview_head = df.head(10).to_dict(orient='records')
        preview_tail = df.tail(5).to_dict(orient='records')

        return {
            'success': True,
            'message': f'Successfully downloaded {len(df)} rows for {clean_symbol}',
            'filename': filename,
            'filepath': filepath,
            'rows': len(df),
            'columns': list(df.columns),
            'date_range': {'start': df['Date'].iloc[0], 'end': df['Date'].iloc[-1]},
            'preview_head': preview_head,
            'preview_tail': preview_tail,
            'summary': summary,
            'chart_data': {
                'dates': df['Date'].tolist(),
                'close': df['Close'].tolist(),
                'volume': df['Volume'].tolist() if 'Volume' in df.columns else [],
            }
        }

    except ValueError as e:
        return {'success': False, 'message': f'Invalid date format: {str(e)}'}
    except Exception as e:
        return {'success': False, 'message': f'Error downloading data: {str(e)}'}


def list_downloaded_stocks() -> list:
    """List all previously downloaded stock CSV files."""
    ensure_data_dir()
    files = []
    for f in os.listdir(DATA_DIR):
        if f.endswith('.csv'):
            filepath = os.path.join(DATA_DIR, f)
            stat = os.stat(filepath)
            df = pd.read_csv(filepath)
            files.append({
                'filename': f,
                'symbol': f.replace('.csv', '').upper(),
                'size_kb': round(stat.st_size / 1024, 1),
                'rows': len(df),
                'modified': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M'),
            })
    return files


def download_intraday_data(symbol: str, start_date: str, end_date: str, interval: str = "5m") -> dict:
    """
    Download intraday OHLCV data for an NSE stock or index from Yahoo Finance.
    Yahoo Finance limits:
      - 1m interval: max 7 days
      - 5m/15m/30m/60m interval: max 60 days
    """
    os.makedirs(RAW_INTRADAY_DIR, exist_ok=True)
    ticker = get_nse_ticker(symbol)
    clean_symbol = symbol.strip().upper().replace('.NS', '')

    try:
        # Check date range validity
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        end_dt = datetime.strptime(end_date, '%Y-%m-%d')
        if start_dt >= end_dt:
            return {'success': False, 'message': 'Start date must be before end date.'}

        # yfinance download
        df = yf.download(ticker, start=start_date, end=end_date, interval=interval, progress=False)

        if df.empty:
            # Try to fetch maximum available if requested range was too long or returned empty
            df = yf.download(ticker, period="60d", interval=interval, progress=False)
            if df.empty:
                return {
                    'success': False,
                    'message': f'No intraday data found for {ticker}.'
                }

        # Flatten multi-level columns if present
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        # Keep only OHLCV columns
        expected_cols = ['Open', 'High', 'Low', 'Close', 'Volume']
        available_cols = [c for c in expected_cols if c in df.columns]
        df = df[available_cols]

        # Convert index to Asia/Kolkata timezone and strip tz
        if df.index.tz is not None:
            df.index = df.index.tz_convert('Asia/Kolkata').tz_localize(None)

        df.index.name = 'Datetime'
        df = df.reset_index()
        df['Datetime'] = df['Datetime'].dt.strftime('%Y-%m-%d %H:%M:%S')

        # Round prices
        for col in ['Open', 'High', 'Low', 'Close']:
            if col in df.columns:
                df[col] = df[col].round(2)

        # Save to raw_intraday directory
        filename = f"{clean_symbol.lower()}_{interval}.csv"
        filepath = os.path.join(RAW_INTRADAY_DIR, filename)
        df.to_csv(filepath, index=False)

        summary = {}
        if 'Close' in df.columns:
            summary = {
                'min_price': float(df['Close'].min()),
                'max_price': float(df['Close'].max()),
                'avg_price': round(float(df['Close'].mean()), 2),
                'start_price': float(df['Close'].iloc[0]),
                'end_price': float(df['Close'].iloc[-1]),
                'avg_volume': int(df['Volume'].mean()) if 'Volume' in df.columns else 0,
            }

        preview_head = df.head(10).to_dict(orient='records')
        preview_tail = df.tail(5).to_dict(orient='records')

        return {
            'success': True,
            'message': f'Successfully downloaded {len(df)} intraday rows ({interval}) for {clean_symbol}',
            'filename': filename,
            'filepath': filepath,
            'rows': len(df),
            'columns': list(df.columns),
            'date_range': {'start': df['Datetime'].iloc[0], 'end': df['Datetime'].iloc[-1]},
            'preview_head': preview_head,
            'preview_tail': preview_tail,
            'summary': summary,
            'chart_data': {
                'dates': df['Datetime'].tolist(),
                'close': df['Close'].tolist(),
                'volume': df['Volume'].tolist() if 'Volume' in df.columns else [],
            }
        }
    except Exception as e:
        return {'success': False, 'message': f'Error downloading intraday data: {str(e)}'}


def list_downloaded_intraday_stocks() -> list:
    """List all downloaded intraday CSV files."""
    os.makedirs(RAW_INTRADAY_DIR, exist_ok=True)
    files = []
    for f in os.listdir(RAW_INTRADAY_DIR):
        if f.endswith('.csv'):
            filepath = os.path.join(RAW_INTRADAY_DIR, f)
            stat = os.stat(filepath)
            df = pd.read_csv(filepath)
            parts = f.replace('.csv', '').split('_')
            symbol = parts[0].upper()
            interval = parts[1] if len(parts) > 1 else '5m'
            files.append({
                'filename': f,
                'symbol': symbol,
                'interval': interval,
                'size_kb': round(stat.st_size / 1024, 1),
                'rows': len(df),
                'modified': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M'),
            })
    return files


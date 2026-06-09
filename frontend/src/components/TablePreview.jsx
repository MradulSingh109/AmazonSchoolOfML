import React from 'react';

export default function TablePreview({ prefix, columns, headData, tailData, totalRows }) {
  if (!columns || columns.length === 0) return null;

  const formatTableCell = (col, val) => {
    if (val === undefined || val === null) return '—';

    if (col === 'Target') {
      return val === 1 ? (
        <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>1 (UP)</span>
      ) : (
        <span style={{ color: 'var(--text-secondary)' }}>0 (DOWN/FLAT)</span>
      );
    }

    if (col === 'Signal') {
      if (val === 1) return <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>BUY (1)</span>;
      if (val === -1) return <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>SELL (-1)</span>;
      return <span style={{ color: 'var(--text-secondary)' }}>FLAT (0)</span>;
    }

    if (col === 'Position_Change') {
      if (val === 1) return <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>+1 (ENTER/LONG)</span>;
      if (val === -1) return <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>-1 (EXIT/SHORT)</span>;
      if (val === 2) return <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>+2 (REVERSE LONG)</span>;
      if (val === -2) return <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>-2 (REVERSE SHORT)</span>;
      return <span style={{ color: 'var(--text-secondary)' }}>0 (HOLD)</span>;
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
      return <span style={{ color }}>{sign}{num}%</span>;
    }

    if (typeof val === 'number') {
      return val.toFixed(4);
    }

    return String(val);
  };

  return (
    <div className="card section-gap animate-fade-in" style={{ marginTop: '24px' }}>
      <div className="card-header">
        <div>
          <h2>Dataset Preview</h2>
          <span id={`table-subtitle-${prefix}`}>
            Showing first {headData.length} & last {tailData.length} of {totalRows.toLocaleString()} rows
          </span>
        </div>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {headData.map((row, idx) => (
              <tr key={`head-${idx}`}>
                {columns.map((col) => (
                  <td key={col}>{formatTableCell(col, row[col])}</td>
                ))}
              </tr>
            ))}
            <tr>
              <td colSpan={columns.length} className="table-ellipsis">
                ⋯
              </td>
            </tr>
            {tailData.map((row, idx) => (
              <tr key={`tail-${idx}`}>
                {columns.map((col) => (
                  <td key={col}>{formatTableCell(col, row[col])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

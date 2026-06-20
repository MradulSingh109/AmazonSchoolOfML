import React from 'react';

export default function TablePreview({ prefix, columns, headData, tailData, totalRows }) {
  if (!columns || columns.length === 0) return null;

  const formatTableCell = (col, val) => {
    if (val === undefined || val === null) return '—';

    if (col === 'Target') {
      return val === 1 ? (
        <span style={{ color: '#16a34a', fontWeight: 700 }}>1 (UP)</span>
      ) : (
        <span style={{ color: '#4b5563' }}>0 (DOWN/FLAT)</span>
      );
    }

    if (col === 'Signal') {
      if (val === 1) return <span style={{ color: '#16a34a', fontWeight: 700 }}>BUY (1)</span>;
      if (val === -1) return <span style={{ color: '#dc2626', fontWeight: 700 }}>SELL (-1)</span>;
      return <span style={{ color: '#4b5563' }}>FLAT (0)</span>;
    }

    if (col === 'Position_Change') {
      if (val === 1) return <span style={{ color: '#16a34a', fontWeight: 700 }}>+1 (ENTER/LONG)</span>;
      if (val === -1) return <span style={{ color: '#dc2626', fontWeight: 700 }}>-1 (EXIT/SHORT)</span>;
      if (val === 2) return <span style={{ color: '#16a34a', fontWeight: 700 }}>+2 (REVERSE LONG)</span>;
      if (val === -2) return <span style={{ color: '#dc2626', fontWeight: 700 }}>-2 (REVERSE SHORT)</span>;
      return <span style={{ color: '#4b5563' }}>0 (HOLD)</span>;
    }

    if (col === 'Volume' || col === 'Vol_MA') {
      return Number(val).toLocaleString();
    }

    if (['Open', 'High', 'Low', 'Close', 'EMA20', 'EMA50', 'EMA200', 'ATR', 'BB_Width'].includes(col)) {
      return '₹' + Number(val).toFixed(2);
    }

    if (['Return_1D', 'Return_5D', 'Return_10D'].includes(col)) {
      const num = (Number(val) * 100).toFixed(2);
      const color = num >= 0 ? '#16a34a' : '#dc2626';
      const sign = num >= 0 ? '+' : '';
      return <span style={{ color }}>{sign}{num}%</span>;
    }

    if (typeof val === 'number') {
      return val.toFixed(4);
    }

    return String(val);
  };

  return (
    <div className="card section-gap animate-fade-in" style={{ marginTop: '24px', background: '#ffffff', color: '#000000', borderRadius: '12px', padding: '24px', border: '1px solid #e4e4e7' }}>
      <div className="card-header" style={{ marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: '#000000', margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700 }}>Dataset Preview</h2>
          <span id={`table-subtitle-${prefix}`} style={{ color: '#71717a', fontSize: '13px' }}>
            Showing first {headData.length} & last {tailData.length} of {totalRows.toLocaleString()} rows
          </span>
        </div>
      </div>
      <div className="table-wrapper" style={{ background: '#ffffff', borderRadius: '8px', overflowX: 'auto', border: '1px solid #e4e4e7' }}>
        <table style={{ background: '#ffffff', color: '#000000', width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f4f4f5', borderBottom: '2px solid #e4e4e7' }}>
              {columns.map((col) => (
                <th key={col} style={{ color: '#18181b', padding: '12px 16px', fontWeight: 600, textAlign: 'left', fontSize: '13px', borderBottom: '2px solid #e4e4e7' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {headData.map((row, idx) => (
              <tr key={`head-${idx}`} style={{ borderBottom: '1px solid #e4e4e7', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                {columns.map((col) => (
                  <td key={col} style={{ padding: '12px 16px', fontSize: '13px', color: '#18181b' }}>{formatTableCell(col, row[col])}</td>
                ))}
              </tr>
            ))}
            <tr style={{ background: '#ffffff' }}>
              <td colSpan={columns.length} className="table-ellipsis" style={{ textAlign: 'center', padding: '8px', color: '#71717a', fontSize: '16px', fontWeight: 'bold' }}>
                ⋯
              </td>
            </tr>
            {tailData.map((row, idx) => (
              <tr key={`tail-${idx}`} style={{ borderBottom: '1px solid #e4e4e7', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                {columns.map((col) => (
                  <td key={col} style={{ padding: '12px 16px', fontSize: '13px', color: '#18181b' }}>{formatTableCell(col, row[col])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

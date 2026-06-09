import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

export default function AnalyticsChart({ type, data, options = {}, height = 300 }) {
  const canvasRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Destroy existing chart instance if it exists
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    // Curated Chart defaults optimized for Dark Glass theme
    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
          labels: {
            color: '#475569',
            font: { family: 'Inter', size: 11 }
          }
        },
        tooltip: {
          backgroundColor: '#ffffff',
          titleColor: '#0f172a',
          bodyColor: '#334155',
          borderColor: 'rgba(0, 0, 0, 0.08)',
          borderWidth: 1,
          titleFont: { family: 'Inter', size: 12, weight: 'bold' },
          bodyFont: { family: 'JetBrains Mono', size: 11 },
          padding: 12,
          cornerRadius: 8,
        }
      },
      scales: {
        x: {
          ticks: { 
            color: '#64748b', 
            maxTicksLimit: 10, 
            font: { family: 'Inter', size: 10 } 
          },
          grid: { 
            color: 'rgba(0, 0, 0, 0.04)',
            borderColor: 'rgba(0, 0, 0, 0.06)'
          },
        },
        y: {
          ticks: { 
            color: '#64748b', 
            font: { family: 'JetBrains Mono', size: 10 } 
          },
          grid: { 
            color: 'rgba(0, 0, 0, 0.04)',
            borderColor: 'rgba(0, 0, 0, 0.06)'
          },
        }
      }
    };

    // Deep merge options
    const mergedOptions = {
      ...defaultOptions,
      ...options,
      plugins: {
        ...defaultOptions.plugins,
        ...options.plugins,
        legend: {
          ...defaultOptions.plugins.legend,
          ...(options.plugins?.legend || {})
        },
        tooltip: {
          ...defaultOptions.plugins.tooltip,
          ...(options.plugins?.tooltip || {})
        }
      },
      scales: {
        ...defaultOptions.scales,
        ...options.scales,
        x: {
          ...defaultOptions.scales.x,
          ...(options.scales?.x || {}),
          ticks: {
            ...defaultOptions.scales.x.ticks,
            ...(options.scales?.x?.ticks || {})
          },
          grid: {
            ...defaultOptions.scales.x.grid,
            ...(options.scales?.x?.grid || {})
          }
        },
        y: {
          ...defaultOptions.scales.y,
          ...(options.scales?.y || {}),
          ticks: {
            ...defaultOptions.scales.y.ticks,
            ...(options.scales?.y?.ticks || {})
          },
          grid: {
            ...defaultOptions.scales.y.grid,
            ...(options.scales?.y?.grid || {})
          }
        }
      }
    };

    // Initialize Chart
    const ctx = canvasRef.current.getContext('2d');
    chartInstanceRef.current = new Chart(ctx, {
      type,
      data,
      options: mergedOptions,
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [data, type, options]);

  return (
    <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

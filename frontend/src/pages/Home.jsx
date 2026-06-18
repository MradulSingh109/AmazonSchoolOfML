import React from 'react';
import { useNavigate } from 'react-router-dom';
import DisplayCards from "@/components/ui/display-cards";
import { Sparkles, Download, Sliders, GitBranch, Brain as BrainIcon, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import RadialOrbitalTimeline from "@/components/ui/radial-orbital-timeline";

export default function Home() {
  const navigate = useNavigate();
  const [expandedIndex, setExpandedIndex] = React.useState(0);

  const strategiesList = [
    {
      title: "Opening Range Breakout (ORB)",
      // short: "Trade high/low bounds of early market activity.",
      detail: "Identifies the high and low price levels established during the initial trading period (e.g., first 5 or 15 minutes of the market open). A buy order is triggered when price breaks above the opening high, while a sell short is triggered below the opening low."
    },
    {
      title: "VWAP Momentum",
      // short: "Buy/sell price crosses relative to volume-weighted pricing.",
      detail: "Uses the Volume Weighted Average Price (VWAP) as a benchmark for institutional order flow. Triggers long positions when the price crosses above the VWAP line with volume acceleration, indicating bullish momentum."
    },
    {
      title: "RSI Mean Reversion",
      // short: "Capitalize on overbought/oversold conditions.",
      detail: "Monitors the Relative Strength Index (RSI) on short intraday timeframes. When RSI crosses above 70 or below 30, it indicates overextended momentum and trades the reversal back toward the mean."
    },
    // {
    //   title: "Risk Controls",
    //   short: "Test stop-loss and take-profit exit triggers.",
    //   detail: "Protects capital by simulating custom percentage or dollar-based stop losses, trailing stops, and profit targets. Ensures all strategies operate under a defined maximum drawdowns tolerance."
    // },
    // {
    //   title: "Performance Reports",
    //   short: "View profit factor, win rates, and detailed trade ledgers.",
    //   detail: "Provides comprehensive diagnostics including win/loss ratio, average trade duration, max drawdown, and a chronological trade ledger for audit trail validation."
    // }
  ];

  const pipelineTimelineData = [
    {
      id: 1,
      title: "Data Ingestion",
      date: "Step 1",
      content: "Downloads clean historical OHLCV data from APIs and processes local CSV storage.",
      category: "Data",
      icon: Download,
      relatedIds: [2],
      status: "completed",
      completion: 20,
    },
    {
      id: 2,
      title: "Feature Engineering",
      date: "Step 2",
      content: "Calculates 30+ technical indicators, momentum oscillators, volatility bands, and target labels.",
      category: "Features",
      icon: Sliders,
      relatedIds: [1, 3],
      status: "completed",
      completion: 40,
    },
    {
      id: 3,
      title: "Regime Clustering",
      date: "Step 3",
      content: "Partitions market structures into Bull, Bear, and Sideways states using Unsupervised Gaussian Mixture Models.",
      category: "Regimes",
      icon: GitBranch,
      relatedIds: [2, 4],
      status: "in-progress",
      completion: 60,
    },
    {
      id: 4,
      title: "Model Training",
      date: "Step 4",
      content: "Trains ensemble XGBoost and Random Forest classifiers per regime to prevent statistical drift.",
      category: "Training",
      icon: BrainIcon,
      relatedIds: [3, 5],
      status: "pending",
      completion: 80,
    },
    {
      id: 5,
      title: "SHAP Explainability",
      date: "Step 5",
      content: "Generates SHAP feature contribution maps to explain prediction weights of active model decisions.",
      category: "Analytics",
      icon: Activity,
      relatedIds: [4],
      status: "pending",
      completion: 100,
    },
  ];

  const strategyCards = [
    {
      icon: <Sparkles className="size-4 text-cyan-300" />,
      title: "Opening Range Breakout",
      description: "Trade early bounds breakout",
      date: "Intraday (1m-5m)",
      iconClassName: "text-cyan-500",
      titleClassName: "text-cyan-400",
      className:
        "[grid-area:stack] hover:-translate-y-10 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0",
    },
    {
      icon: <Sparkles className="size-4 text-purple-300" />,
      title: "VWAP Momentum",
      description: "Buy/sell price crosses",
      date: "Trend Following",
      iconClassName: "text-purple-500",
      titleClassName: "text-purple-400",
      className:
        "[grid-area:stack] translate-x-12 translate-y-10 hover:-translate-y-1 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0",
    },
    {
      icon: <Sparkles className="size-4 text-emerald-300" />,
      title: "RSI Mean Reversion",
      description: "Overbought/oversold levels",
      date: "Oscillator-based",
      iconClassName: "text-emerald-500",
      titleClassName: "text-emerald-400",
      className:
        "[grid-area:stack] translate-x-24 translate-y-20 hover:translate-y-10",
    },
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '48px', padding: '24px 0' }}>
      
      {/* Algorithmic Intraday Strategies Showcase */}
      <section 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: '1.1fr 1fr', 
          gap: '48px', 
          alignItems: 'center',
          minHeight: '450px'
        }}
      >
        {/* Left: Interactive 3D Stacked Display Cards */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
          <div style={{ width: '100%', maxWidth: '380px' }}>
            <DisplayCards cards={strategyCards} />
          </div>
        </div>

        {/* Right: Strategy Overview and CTA */}
        <div 
          className="card" 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between',
            minHeight: '420px',
            // background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(8, 145, 178, 0.05) 100%)',
            // backdropFilter: 'blur(20px)',
            // border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '32px',
            borderRadius: '16px'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              {/* <span style={{ fontSize: '32px' }}>⚡</span> */}
              <h2 style={{ fontSize: '40px', fontWeight: '800', margin: 0, color: '#ffffff' }}>
                Algorithmic Strategies
              </h2>
            </div>
            <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>
              Run mathematical backtests of core intraday trading strategies on multi-timeframe asset data. 
              {/* Configure custom risk inputs like stop-losses and target rewards to find optimal setups. */}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '32px' }}>
              {strategiesList.map((item, index) => {
                const isExpanded = expandedIndex === index;
                return (
                  <div 
                    key={index}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                      paddingBottom: '12px',
                      paddingTop: '12px',
                      cursor: 'pointer'
                    }}
                    onClick={() => setExpandedIndex(isExpanded ? null : index)}
                  >
                    <div 
                      className={`strategy-option ${isExpanded ? 'active' : ''}`}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <span style={{ fontSize: '15px', fontWeight: '600' }}>
                        {item.title}
                      </span>
                      <span style={{ 
                        fontSize: '12px', 
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s'
                      }}>
                        ▼
                      </span>
                    </div>
                    
                    {item.short && (
                      <p style={{ 
                        color: 'rgba(255, 255, 255, 0.55)', 
                        fontSize: '13px', 
                        margin: '6px 0 0 0',
                        lineHeight: '1.5'
                      }}>
                        {item.short}
                      </p>
                    )}

                    <div style={{
                      maxHeight: isExpanded ? '200px' : '0px',
                      opacity: isExpanded ? 1 : 0,
                      overflow: 'hidden',
                      transition: 'all 0.3s ease-in-out',
                      marginTop: isExpanded ? '8px' : '0px'
                    }}>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        padding: '12px',
                        borderRadius: '6px',
                        // borderLeft: '2px solid var(--accent-cyan)',
                        fontSize: '13px',
                        lineHeight: '1.6',
                        color: 'rgba(255, 255, 255, 0.8)'
                      }}>
                        {item.detail}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <Button 
            size="lg" 
            variant="outline" 
            className="w-full gap-4 font-semibold inline-flex items-center justify-center bg-black text-white hover:bg-white hover:text-black border-zinc-800 hover:border-white transition-all duration-300 rounded-full"
            onClick={() => navigate('/strategies')}
          >
            Explore Intraday Strategies
          </Button>
        </div>
      </section>

      {/* Machine Learning Pipeline Showcase */}
      <section style={{ marginTop: '16px' }}>
        <div 
          className="card" 
          style={{ 
            // background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(124, 58, 237, 0.05) 100%)',
            // backdropFilter: 'blur(20px)',
            // border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '32px',
            borderRadius: '16px'
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                {/* <span style={{ fontSize: '32px' }}>🧠</span> */}
                <h2 style={{ fontSize: '40px', fontWeight: '800', margin: 0, color: '#ffffff' }}>
                  Machine Learning Pipeline
                </h2>
              </div>
              <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '15px', lineHeight: '1.6', marginBottom: '32px' }}>
                Process historical datasets, analyze market regimes using Gaussian Mixture Models (GMM), 
                and train adaptive, regime-aware ML classifiers (XGBoost, Random Forest, Logistic Regression).
              </p>
              <Button 
                size="lg" 
                variant="outline" 
                className="gap-4 font-semibold inline-flex items-center justify-center bg-black text-white hover:bg-white hover:text-black border-zinc-800 hover:border-white transition-all duration-300 rounded-full"
                onClick={() => navigate('/data')}
              >
                Launch ML Research Pipeline
              </Button>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'visible' }}>
              <RadialOrbitalTimeline timelineData={pipelineTimelineData} />
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

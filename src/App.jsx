import { useState, useCallback } from "react";

const WATCHLIST = [
  { ticker: "AAPL", name: "Apple Inc.", sector: "Tech" },
  { ticker: "TSLA", name: "Tesla Inc.", sector: "EV" },
  { ticker: "NVDA", name: "NVIDIA Corp.", sector: "Chips" },
  { ticker: "SPY", name: "S&P 500 ETF", sector: "ETF" },
  { ticker: "AMD", name: "Advanced Micro Devices", sector: "Chips" },
  { ticker: "META", name: "Meta Platforms", sector: "Tech" },
  { ticker: "AMZN", name: "Amazon.com", sector: "Tech" },
  { ticker: "MSFT", name: "Microsoft Corp.", sector: "Tech" },
  { ticker: "QQQ", name: "Nasdaq 100 ETF", sector: "ETF" },
  { ticker: "GOOGL", name: "Alphabet Inc.", sector: "Tech" },
  { ticker: "IWM", name: "iShares Russell 2000 ETF", sector: "ETF" },
];

const SETUPS = [
  "Bull Flag Breakout",
  "Pre-Earnings Squeeze",
  "Bear Flag Breakdown",
  "Earnings Volatility Crush",
  "IV Spike + Oversold",
  "Gap Fill Setup",
  "Support Bounce",
  "Resistance Break",
  "Momentum Continuation",
  "Reversal at Key Level",
  "High OI Strike Magnet",
];

function generateMockPrice(ticker) {
  const bases = {
    AAPL: 189, TSLA: 248, NVDA: 875, SPY: 512, AMD: 172,
    META: 490, AMZN: 184, MSFT: 415, QQQ: 441, GOOGL: 171,
  };
  const base = bases[ticker] || 100;
  return +(base + (Math.random() - 0.5) * base * 0.03).toFixed(2);
}

function getRandomSetup() {
  return SETUPS[Math.floor(Math.random() * SETUPS.length)];
}

function getRandomDirection() {
  return Math.random() > 0.5 ? "CALL" : "PUT";
}

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [analysis, setAnalysis] = useState("");
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [customTicker, setCustomTicker] = useState("");
  const [watchlist, setWatchlist] = useState(WATCHLIST);
  const [scanCount, setScanCount] = useState(0);
  const [filter, setFilter] = useState("ALL");
  const [log, setLog] = useState([]);

  const addLog = (msg) => {
    setLog((prev) =>
      [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 20)
    );
  };

  const runScan = useCallback(async () => {
    setScanning(true);
    setScanCount((c) => c + 1);
    addLog("🔍 Initiating full market scan...");
    await new Promise((r) => setTimeout(r, 600));

    const newAlerts = [];
    for (const stock of watchlist) {
      const price = generateMockPrice(stock.ticker);
      const direction = getRandomDirection();
      const setup = getRandomSetup();
      const ivRank = Math.floor(Math.random() * 100);
      const confidence = Math.floor(55 + Math.random() * 40);
      const dte = [7, 14, 21, 30, 45][Math.floor(Math.random() * 5)];
      const strikeOffset =
        direction === "CALL"
          ? +(price * (1 + (Math.random() * 0.07 + 0.02))).toFixed(0)
          : +(price * (1 - (Math.random() * 0.07 + 0.02))).toFixed(0);
      const premium = +(Math.random() * 4 + 0.3).toFixed(2);
      const targetPremium = +(premium * (2 + Math.random() * 4)).toFixed(2);
      const riskReward = +(targetPremium / premium).toFixed(1);
      const signal =
        confidence >= 80 ? "STRONG" : confidence >= 65 ? "MODERATE" : "WATCH";

      newAlerts.push({
        id: `${stock.ticker}-${Date.now()}-${Math.random()}`,
        ticker: stock.ticker,
        name: stock.name,
        sector: stock.sector,
        price,
        direction,
        setup,
        ivRank,
        confidence,
        dte,
        strike: strikeOffset,
        premium,
        targetPremium,
        riskReward,
        signal,
        timestamp: new Date().toLocaleTimeString(),
      });

      await new Promise((r) => setTimeout(r, 80));
      addLog(`✅ ${stock.ticker} scanned → ${direction} ${signal} (${confidence}%)`);
    }

    const sorted = newAlerts.sort((a, b) => b.confidence - a.confidence);
    setAlerts(sorted);
    setScanning(false);
    addLog(`🎯 Scan complete. ${sorted.filter((a) => a.signal === "STRONG").length} strong setups found.`);
  }, [watchlist]);

  const fetchAIAnalysis = async (alert) => {
    setSelectedAlert(alert);
    setAnalysis("");
    setLoadingAnalysis(true);

    const prompt = `You are a professional options trader and technical analyst. Analyze this options setup and provide a detailed trade breakdown:

Stock: ${alert.ticker} (${alert.name})
Current Price: $${alert.price}
Setup: ${alert.setup}
Direction: ${alert.direction}
Strike: $${alert.strike}
DTE: ${alert.dte} days
IV Rank: ${alert.ivRank}%
Buy Premium: $${alert.premium}
Target Premium: $${alert.targetPremium}
Risk/Reward: ${alert.riskReward}x
Confidence: ${alert.confidence}%

Provide:
1. WHY this setup is forming (technical reasoning)
2. ENTRY criteria — exactly what needs to happen before entering
3. STRIKE SELECTION logic — why this strike makes sense OTM
4. PROFIT TARGET — how and when to take profits (sell ITM or close early)
5. STOP LOSS — how to manage risk (% of premium loss)
6. KEY RISKS that could invalidate this setup
7. IDEAL market conditions for this play

Keep it sharp, practical, and trader-focused. Use dollar amounts and percentages.`;

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }
      setAnalysis(data.text || "No analysis available.");
    } catch {
      setAnalysis("Error fetching analysis. Please try again.");
    }
    setLoadingAnalysis(false);
  };

  const addTicker = () => {
    const t = customTicker.toUpperCase().trim();
    if (t && !watchlist.find((w) => w.ticker === t)) {
      setWatchlist((prev) => [...prev, { ticker: t, name: t, sector: "Custom" }]);
      setCustomTicker("");
      addLog(`➕ Added ${t} to watchlist`);
    }
  };

  const removeTicker = (ticker) => {
    setWatchlist((prev) => prev.filter((w) => w.ticker !== ticker));
    addLog(`➖ Removed ${ticker} from watchlist`);
  };

  const filtered =
    filter === "ALL"
      ? alerts
      : alerts.filter((a) =>
          filter === "CALLS"
            ? a.direction === "CALL"
            : filter === "PUTS"
            ? a.direction === "PUT"
            : a.signal === filter
        );

  const signalColor = (s) =>
    s === "STRONG" ? "#00ff88" : s === "MODERATE" ? "#ffd700" : "#888";
  const dirColor = (d) => (d === "CALL" ? "#00ff88" : "#ff4466");

  return (
    <div style={{ fontFamily: "'DM Mono','Courier New',monospace", background: "#020408", minHeight: "100vh", color: "#c8d6e5" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #020408; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0f16; }
        ::-webkit-scrollbar-thumb { background: #00ff88; border-radius: 2px; }
        .scan-btn { background: linear-gradient(135deg,#00ff88,#00cc66); color: #020408; border: none; padding: 12px 32px; font-family: 'Bebas Neue',sans-serif; font-size: 18px; letter-spacing: 2px; cursor: pointer; clip-path: polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%); transition: all .2s; }
        .scan-btn:hover { background: linear-gradient(135deg,#00ffaa,#00ff88); transform: scale(1.02); }
        .scan-btn:disabled { background: #1a2a1a; color: #444; cursor: not-allowed; transform: none; }
        .alert-row { display: grid; grid-template-columns: 80px 1fr 80px 70px 60px 60px 80px 80px 90px 90px; gap: 8px; align-items: center; padding: 10px 16px; border-bottom: 1px solid #0d1a12; cursor: pointer; transition: background .15s; font-size: 12px; }
        .alert-row:hover { background: #0a1510; }
        .filter-btn { background: transparent; border: 1px solid #1a3322; color: #888; padding: 6px 14px; font-family: 'DM Mono',monospace; font-size: 11px; cursor: pointer; transition: all .2s; letter-spacing: 1px; }
        .filter-btn.active { border-color: #00ff88; color: #00ff88; background: #001a0a; }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.4} }
        .slide-in { animation: slideIn .3s ease; }
        @keyframes slideIn { from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)} }
        .ticker-tag { display: inline-flex; align-items: center; gap: 6px; background: #0a1510; border: 1px solid #1a3322; padding: 4px 10px; font-size: 11px; border-radius: 2px; }
        .remove-x { background: none; border: none; color: #ff4466; cursor: pointer; font-size: 14px; line-height: 1; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.85); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #040c10; border: 1px solid #00ff8833; max-width: 700px; width: 100%; max-height: 85vh; overflow-y: auto; padding: 28px; }
        .stat-box { background: #040c10; border: 1px solid #0d1a12; padding: 14px 18px; flex: 1; min-width: 120px; }
        input[type="text"] { background: #040c10; border: 1px solid #1a3322; color: #c8d6e5; padding: 8px 12px; font-family: 'DM Mono',monospace; font-size: 12px; outline: none; width: 100%; }
        input[type="text"]:focus { border-color: #00ff88; }
        .add-btn { background: #001a0a; border: 1px solid #00ff88; color: #00ff88; padding: 8px 16px; font-family: 'DM Mono',monospace; font-size: 12px; cursor: pointer; letter-spacing: 1px; white-space: nowrap; }
        .loading-dots::after { content: '...'; animation: dots 1.5s steps(4,end) infinite; }
        @keyframes dots { 0%,20%{content:'.'}40%{content:'..'}60%,100%{content:'...'} }
      `}</style>

      {/* Header */}
      <div style={{ background: "#040c10", borderBottom: "1px solid #0d1a12", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 4, color: "#00ff88" }}>◈ OPTIONSHAWK</div>
          <div style={{ fontSize: 10, color: "#446655", letterSpacing: 2 }}>AI-POWERED OPTIONS FLOW SCANNER</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {scanning && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#00ff88", fontSize: 12 }}>
              <span className="pulse">◉</span> SCANNING<span className="loading-dots"></span>
            </div>
          )}
          <div style={{ fontSize: 11, color: "#446655" }}>SCANS: <span style={{ color: "#00ff88" }}>{scanCount}</span></div>
          <button className="scan-btn" onClick={runScan} disabled={scanning}>{scanning ? "SCANNING..." : "RUN SCAN"}</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", minHeight: "calc(100vh - 65px)" }}>

        {/* Main Panel */}
        <div style={{ overflow: "auto", display: "flex", flexDirection: "column" }}>

          {/* Stats */}
          <div style={{ display: "flex", gap: 1, background: "#0d1a12" }}>
            {[
              { label: "TOTAL SETUPS", value: alerts.length },
              { label: "STRONG", value: alerts.filter((a) => a.signal === "STRONG").length, color: "#00ff88" },
              { label: "CALLS", value: alerts.filter((a) => a.direction === "CALL").length, color: "#00ff88" },
              { label: "PUTS", value: alerts.filter((a) => a.direction === "PUT").length, color: "#ff4466" },
              { label: "AVG CONF", value: alerts.length ? Math.round(alerts.reduce((s, a) => s + a.confidence, 0) / alerts.length) + "%" : "—" },
            ].map((s) => (
              <div key={s.label} className="stat-box">
                <div style={{ fontSize: 9, color: "#446655", letterSpacing: 2, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontFamily: "'Bebas Neue',sans-serif", color: s.color || "#c8d6e5", letterSpacing: 1 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ padding: "12px 16px", display: "flex", gap: 8, borderBottom: "1px solid #0d1a12", flexWrap: "wrap", alignItems: "center" }}>
            {["ALL", "STRONG", "MODERATE", "CALLS", "PUTS"].map((f) => (
              <button key={f} className={`filter-btn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{f}</button>
            ))}
            <div style={{ marginLeft: "auto", fontSize: 11, color: "#446655" }}>{filtered.length} RESULTS — click row for AI analysis</div>
          </div>

          {/* Table Header */}
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 80px 70px 60px 60px 80px 80px 90px 90px", gap: 8, padding: "8px 16px", fontSize: 9, color: "#446655", letterSpacing: 2, borderBottom: "1px solid #0d1a12", background: "#020408" }}>
            <span>TICKER</span><span>SETUP</span><span>TYPE</span><span>SIGNAL</span>
            <span>IV RNK</span><span>DTE</span><span>STRIKE</span><span>BUY@</span>
            <span>TARGET</span><span>R/R</span>
          </div>

          {/* Rows */}
          <div>
            {filtered.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "#446655", fontSize: 13 }}>
                {scanning ? "Scanning..." : "Hit RUN SCAN to find option setups →"}
              </div>
            ) : (
              filtered.map((alert, i) => (
                <div key={alert.id} className="alert-row slide-in" onClick={() => fetchAIAnalysis(alert)}
                  style={{ animationDelay: `${i * 20}ms`, background: selectedAlert?.id === alert.id ? "#0a1510" : undefined }}>
                  <span style={{ color: "#00ff88", fontWeight: 500, fontSize: 13 }}>{alert.ticker}</span>
                  <span style={{ color: "#8899aa", fontSize: 11 }}>{alert.setup}</span>
                  <span style={{ color: dirColor(alert.direction), background: alert.direction === "CALL" ? "#001a0a" : "#1a000a", padding: "2px 8px", fontSize: 11, fontWeight: 500 }}>{alert.direction}</span>
                  <span style={{ color: signalColor(alert.signal), fontSize: 10, letterSpacing: 1 }}>{alert.signal}</span>
                  <span style={{ color: alert.ivRank > 70 ? "#ffd700" : "#8899aa" }}>{alert.ivRank}%</span>
                  <span style={{ color: "#8899aa" }}>{alert.dte}d</span>
                  <span style={{ color: "#c8d6e5" }}>${alert.strike}</span>
                  <span style={{ color: "#ffd700" }}>${alert.premium}</span>
                  <span style={{ color: "#00ff88" }}>${alert.targetPremium}</span>
                  <span style={{ color: alert.riskReward >= 3 ? "#00ff88" : "#ffd700", fontWeight: 500 }}>{alert.riskReward}x</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ borderLeft: "1px solid #0d1a12", display: "flex", flexDirection: "column", background: "#020408" }}>

          {/* Watchlist */}
          <div style={{ padding: 16, borderBottom: "1px solid #0d1a12" }}>
            <div style={{ fontSize: 9, color: "#446655", letterSpacing: 3, marginBottom: 12 }}>WATCHLIST ({watchlist.length})</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <input type="text" value={customTicker} onChange={(e) => setCustomTicker(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTicker()} placeholder="ADD TICKER" />
              <button className="add-btn" onClick={addTicker}>+</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxHeight: 130, overflowY: "auto" }}>
              {watchlist.map((w) => (
                <span key={w.ticker} className="ticker-tag">
                  {w.ticker}
                  <button className="remove-x" onClick={() => removeTicker(w.ticker)}>×</button>
                </span>
              ))}
            </div>
          </div>

          {/* Scan Log */}
          <div style={{ padding: 16, flex: 1, overflow: "auto" }}>
            <div style={{ fontSize: 9, color: "#446655", letterSpacing: 3, marginBottom: 10 }}>SCAN LOG</div>
            {log.length === 0 ? (
              <div style={{ fontSize: 11, color: "#2a3a2a" }}>Awaiting scan...</div>
            ) : (
              log.map((l, i) => (
                <div key={i} style={{ fontSize: 10, color: i === 0 ? "#8899aa" : "#2a4a3a", marginBottom: 4, lineHeight: 1.5 }}>{l}</div>
              ))
            )}
          </div>

          {/* Legend */}
          <div style={{ padding: 16, borderTop: "1px solid #0d1a12", fontSize: 10, color: "#446655" }}>
            <div style={{ marginBottom: 6, letterSpacing: 2, fontSize: 9 }}>SIGNAL GUIDE</div>
            {[["◉ STRONG", "#00ff88", "80-95% conf."], ["◉ MODERATE", "#ffd700", "65-79% conf."], ["◉ WATCH", "#888", "55-64% conf."]].map(([l, c, d]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: c }}>{l}</span><span>{d}</span>
              </div>
            ))}
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #0d1a12", color: "#2a4a3a", fontSize: 9, lineHeight: 1.6 }}>
              ⚠ Educational use only. Not financial advice. Always manage risk.
            </div>
          </div>
        </div>
      </div>

      {/* AI Modal */}
      {selectedAlert && (
        <div className="modal-overlay" onClick={() => setSelectedAlert(null)}>
          <div className="modal slide-in" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 3, color: "#00ff88" }}>
                  {selectedAlert.ticker} — {selectedAlert.direction}
                </div>
                <div style={{ fontSize: 11, color: "#446655" }}>{selectedAlert.setup} · ${selectedAlert.strike} STRIKE · {selectedAlert.dte} DTE</div>
              </div>
              <button onClick={() => setSelectedAlert(null)} style={{ background: "none", border: "none", color: "#446655", cursor: "pointer", fontSize: 20 }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 20 }}>
              {[
                ["BUY PREMIUM", `$${selectedAlert.premium}`, "#ffd700"],
                ["TARGET", `$${selectedAlert.targetPremium}`, "#00ff88"],
                ["RISK/REWARD", `${selectedAlert.riskReward}x`, "#00ff88"],
                ["IV RANK", `${selectedAlert.ivRank}%`, selectedAlert.ivRank > 70 ? "#ffd700" : "#8899aa"],
                ["CONFIDENCE", `${selectedAlert.confidence}%`, signalColor(selectedAlert.signal)],
                ["SIGNAL", selectedAlert.signal, signalColor(selectedAlert.signal)],
                ["DIRECTION", selectedAlert.direction, dirColor(selectedAlert.direction)],
                ["PRICE", `$${selectedAlert.price}`, "#c8d6e5"],
              ].map(([l, v, c]) => (
                <div key={l} style={{ background: "#020408", border: "1px solid #0d1a12", padding: "10px 12px" }}>
                  <div style={{ fontSize: 9, color: "#446655", letterSpacing: 1, marginBottom: 4 }}>{l}</div>
                  <div style={{ fontSize: 16, fontFamily: "'Bebas Neue',sans-serif", color: c, letterSpacing: 1 }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ background: "#020408", border: "1px solid #0d1a12", padding: 18 }}>
              <div style={{ fontSize: 9, color: "#00ff88", letterSpacing: 3, marginBottom: 14 }}>◈ AI TRADE ANALYSIS</div>
              {loadingAnalysis ? (
                <div style={{ color: "#446655", fontSize: 12 }}>
                  <span className="pulse">◉</span> Analyzing setup<span className="loading-dots"></span>
                </div>
              ) : (
                <div style={{ fontSize: 12, lineHeight: 1.8, color: "#8899aa", whiteSpace: "pre-wrap" }}>{analysis}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

/**
 * Portfolio page (client)
 * - auth check + redirect
 * - CRUD (uses /api/investments with Authorization header)
 * - logout
 * - autocomplete for company name -> fills symbol (uppercase)
 */

export default function PortfolioPage() {
  const router = useRouter();

  // Investments state
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);

  // Add/Edit UI state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [newInvestment, setNewInvestment] = useState({
    name: "",
    symbol: "",
    type: "Stock",
    shares: "",
    buyPrice: "",
    currentPrice: "",
  });

  // Autocomplete state
  const [symbolSuggestions, setSymbolSuggestions] = useState([]);
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [autoQuery, setAutoQuery] = useState("");
  const autocompleteTimerRef = useRef(null);

  // For avoiding memory leak if component unmounts mid-flight
  const abortControllers = useRef(new Set());

  // Helper: get Authorization header (Bearer access_token) from Supabase session
  const getAuthHeader = async () => {
    const { data } = await supabaseClient.auth.getSession();
    const session = data?.session;
    if (!session) throw new Error("Not authenticated");
    return { Authorization: `Bearer ${session.access_token}` };
  };

  // Auth check on mount + subscribe to auth changes
  useEffect(() => {
    let unsub = null;
    const checkAuthAndLoad = async () => {
      try {
        setAuthChecking(true);
        const { data } = await supabaseClient.auth.getSession();
        if (!data?.session) {
          router.push("/login");
          return;
        }
        await loadInvestments();
      } catch (err) {
        console.error("Auth check error:", err);
        router.push("/login");
      } finally {
        setAuthChecking(false);
      }
    };

    checkAuthAndLoad();

    // subscribe to auth state changes -> redirect on sign out
    const { data: listener } = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        router.push("/login");
      }
    });
    unsub = listener;

    return () => {
      // cleanup event subscription
      try {
        unsub?.subscription?.unsubscribe?.();
      } catch (e) {}
      // abort any inflight fetch
      abortControllers.current.forEach((c) => {
        try { c.abort(); } catch (e) {}
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Investments CRUD ---

  // loadInvestments: fetch list from server (requires Authorization header)
  const loadInvestments = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeader();
      const controller = new AbortController();
      abortControllers.current.add(controller);
      const res = await fetch("/api/investments", { headers, signal: controller.signal });
      abortControllers.current.delete(controller);

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        console.error("loadInvestments failed:", data);
        throw new Error(data?.error || "Failed to load investments");
      }

      const mapped = (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        symbol: row.symbol,
        type: row.type,
        shares: Number(row.shares),
        buyPrice: Number(row.buy_price),
        currentPrice: Number(row.current_price),
      }));

      setInvestments(mapped);
    } catch (err) {
      console.error("loadInvestments error:", err);
      setInvestments([]);
      // show user-friendly message only if not auth redirect
      if (err.message && !/Not authenticated/i.test(err.message)) {
        // optionally show alert
      }
    } finally {
      setLoading(false);
    }
  };

  // Add investment
  const handleAddInvestment = async () => {
    if (
      !newInvestment.name ||
      !newInvestment.symbol ||
      !newInvestment.shares ||
      !newInvestment.buyPrice ||
      !newInvestment.currentPrice
    ) {
      alert("Please fill in all fields");
      return;
    }

    const payload = {
      name: newInvestment.name,
      symbol: newInvestment.symbol.toUpperCase(),
      type: newInvestment.type,
      shares: parseFloat(newInvestment.shares),
      buyPrice: parseFloat(newInvestment.buyPrice),
      currentPrice: parseFloat(newInvestment.currentPrice),
    };

    try {
      const headers = await getAuthHeader();
      headers["Content-Type"] = "application/json";
      const res = await fetch("/api/investments", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to add investment");

      await loadInvestments();
      setNewInvestment({ name: "", symbol: "", type: "Stock", shares: "", buyPrice: "", currentPrice: "" });
      setShowAddForm(false);
    } catch (err) {
      console.error("handleAddInvestment error:", err);
      alert(err.message || "Failed to add investment");
    }
  };

  // Start edit
  const startEdit = (inv) => {
    setEditingId(inv.id);
    setEditValues({
      shares: inv.shares,
      currentPrice: inv.currentPrice,
    });
  };

  // Save edit (PUT)
  const handleSaveEdit = async (id) => {
    try {
      const payload = {
        shares: parseFloat(editValues.shares),
        currentPrice: parseFloat(editValues.currentPrice),
      };
      const headers = await getAuthHeader();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/investments/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to update investment");

      await loadInvestments();
      setEditingId(null);
      setEditValues({});
    } catch (err) {
      console.error("handleSaveEdit error:", err);
      alert(err.message || "Failed to save edit");
    }
  };

  // Delete
  const handleDeletePersist = async (id) => {
    if (!confirm("Delete this investment?")) return;
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`/api/investments/${id}`, { method: "DELETE", headers });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to delete");
      await loadInvestments();
    } catch (err) {
      console.error("handleDeletePersist error:", err);
      alert(err.message || "Failed to delete");
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  // Logout
  const handleLogout = async () => {
    try {
      await supabaseClient.auth.signOut();
      router.push("/login");
    } catch (err) {
      console.error("Logout error:", err);
      alert("Logout failed");
    }
  };

  // summary calculations
  const totalInvested = investments.reduce((sum, inv) => sum + inv.shares * inv.buyPrice, 0);
  const currentValue = investments.reduce((sum, inv) => sum + inv.shares * inv.currentPrice, 0);
  const totalGainLoss = currentValue - totalInvested;
  const totalGainLossPercent = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;

  // --- Autocomplete logic ---

  const searchSymbols = (q) => {
    if (autocompleteTimerRef.current) {
      clearTimeout(autocompleteTimerRef.current);
      autocompleteTimerRef.current = null;
    }
    autocompleteTimerRef.current = setTimeout(async () => {
      const qtrim = (q || "").trim();
      if (!qtrim) {
        setSymbolSuggestions([]);
        setAutocompleteOpen(false);
        return;
      }
      try {
        const controller = new AbortController();
        abortControllers.current.add(controller);
        const res = await fetch(`/api/symbols?q=${encodeURIComponent(qtrim)}`, { signal: controller.signal });
        abortControllers.current.delete(controller);
        const data = await res.json().catch(() => []);
        setSymbolSuggestions(Array.isArray(data) ? data : []);
        setAutocompleteOpen(true);
        setHighlightIndex(-1);
      } catch (err) {
        console.error("symbol search error", err);
        setSymbolSuggestions([]);
        setAutocompleteOpen(false);
      }
    }, 180);
  };

  const onAutoInputChange = (value) => {
    setAutoQuery(value);
    // set typed name into newInvestment; do not overwrite symbol until selection
    setNewInvestment((s) => ({ ...s, name: value }));
    searchSymbols(value);
  };

  const onSelectSuggestion = (item) => {
    setNewInvestment((s) => ({ ...s, name: item.name, symbol: (item.symbol || "").toUpperCase() }));
    setAutoQuery(item.name);
    setAutocompleteOpen(false);
    setSymbolSuggestions([]);
    setHighlightIndex(-1);
  };

  const onAutoKeyDown = (e) => {
    if (!autocompleteOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, symbolSuggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && symbolSuggestions[highlightIndex]) {
        onSelectSuggestion(symbolSuggestions[highlightIndex]);
      }
    } else if (e.key === "Escape") {
      setAutocompleteOpen(false);
    }
  };

  // --- Render ---

  if (authChecking) {
    return (
      <div className="container">
        <div className="header">
          <h1>Investment Portfolio Manager</h1>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header + Logout */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div className="header" style={{ margin: 0 }}>
          <h1>Investment Portfolio Manager</h1>
          <p>Track and manage your investments in one place</p>
        </div>

        <div style={{ textAlign: "right" }}>
          <button onClick={handleLogout} className="btn btn-danger" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
            Logout
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="card-grid">
        <div className="card">
          <div className="card-label">Total Invested</div>
          <div className="card-value">₹{totalInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>

        <div className="card">
          <div className="card-label">Current Value</div>
          <div className="card-value">₹{currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>

        <div className="card">
          <div className="card-label">Total Gain/Loss</div>
          <div className={`card-value ${totalGainLoss >= 0 ? "green" : "red"}`}>₹{Math.abs(totalGainLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>

        <div className="card">
          <div className="card-label">Return %</div>
          <div className={`card-value ${totalGainLossPercent >= 0 ? "green" : "red"}`}>{totalGainLossPercent.toFixed(2)}%</div>
        </div>
      </div>

      {/* Add Investment Button */}
      <div className="mb-2">
        <button onClick={() => setShowAddForm(!showAddForm)} className="btn btn-primary">
          {showAddForm ? "✕ Cancel" : "+ Add New Investment"}
        </button>
      </div>

      {/* Add Investment Form */}
      {showAddForm && (
        <div className="card mb-4">
          <h3 className="mb-2 font-semibold" style={{ fontSize: "1.25rem" }}>New Investment</h3>
          <div className="form-grid">
            {/* Autocomplete Name + Symbol */}
            <div style={{ position: "relative", zIndex: 2000, overflow: "visible"}}>
              <input
                type="text"
                placeholder="Company name (type to search)"
                value={autoQuery}
                onChange={(e) => onAutoInputChange(e.target.value)}
                onKeyDown={onAutoKeyDown}
                className="input"
                style={{ width: "100%", marginBottom: 6 }}
                onBlur={() => setTimeout(() => setAutocompleteOpen(false), 150)}
                onFocus={() => { if (symbolSuggestions.length > 0) setAutocompleteOpen(true); }}
              />

              {autocompleteOpen && symbolSuggestions.length > 0 && (
  <ul style={{
    position: "absolute",
    zIndex: 99999,              // << very high
    left: 0,
    right: 0,
    maxHeight: 260,
    overflowY: "auto",
    background: "rgba(0,0,0,0.95)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    marginTop: 6,
    padding: 8,
    listStyle: "none",
    boxShadow: "0 8px 30px rgba(2,6,23,0.6)" // add shadow so it visually floats
  }}>
                  {symbolSuggestions.map((it, idx) => (
                    <li
                      key={`${it.symbol}-${idx}`}
                      onMouseDown={(e) => { e.preventDefault(); onSelectSuggestion(it); }}
                      onMouseEnter={() => setHighlightIndex(idx)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 6,
                        background: idx === highlightIndex ? "rgba(255,255,255,0.04)" : "transparent",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12
                      }}
                    >
                      <span style={{ color: "#fff" }}>{it.name}</span>
                      <span style={{ color: "#93c5fd", fontWeight: 700 }}>{(it.symbol || "").toUpperCase()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Symbol field (auto-filled and forced uppercase) */}
            <input
              type="text"
              placeholder="Symbol (e.g., AAPL)"
              value={newInvestment.symbol}
              onChange={(e) => setNewInvestment(s => ({ ...s, symbol: e.target.value.toUpperCase() }))}
              className="input"
            />

            <select
              value={newInvestment.type}
              onChange={(e) => setNewInvestment({ ...newInvestment, type: e.target.value })}
              className="select"
            >
              <option value="Stock">Stock</option>
              <option value="ETF">ETF</option>
              <option value="Bond">Bond</option>
              <option value="Crypto">Crypto</option>
              <option value="Mutual Fund">Mutual Fund</option>
            </select>

            <input
              type="number"
              placeholder="Shares"
              step="0.01"
              value={newInvestment.shares}
              onChange={(e) => setNewInvestment({ ...newInvestment, shares: e.target.value })}
              className="input"
            />
            <input
              type="number"
              placeholder="Buy Price"
              step="0.01"
              value={newInvestment.buyPrice}
              onChange={(e) => setNewInvestment({ ...newInvestment, buyPrice: e.target.value })}
              className="input"
            />
            <input
              type="number"
              placeholder="Current Price"
              step="0.01"
              value={newInvestment.currentPrice}
              onChange={(e) => setNewInvestment({ ...newInvestment, currentPrice: e.target.value })}
              className="input"
            />
          </div>
          <button onClick={handleAddInvestment} className="btn btn-success">Add Investment</button>
        </div>
      )}

      {/* Investments Table */}
      <div className="table-container">
        <h3 className="mb-2 font-semibold" style={{ fontSize: "1.25rem" }}>Investment Holdings</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Shares</th>
              <th>Buy Price</th>
              <th>Current</th>
              <th>Value</th>
              <th>Gain/Loss</th>
              <th>Return %</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {investments.map((inv) => {
              const totalInv = inv.shares * inv.buyPrice;
              const currentVal = inv.shares * inv.currentPrice;
              const gainLoss = currentVal - totalInv;
              const returnPct = totalInv > 0 ? (gainLoss / totalInv) * 100 : 0;
              const isEditing = editingId === inv.id;

              return (
                <tr key={inv.id}>
                  <td>
                    <div className="stock-name">{inv.name}</div>
                    <div className="stock-symbol">{inv.symbol}</div>
                  </td>
                  <td>{inv.type}</td>
                  <td>
                    {isEditing ? (
                      <input type="number" step="0.01" value={editValues.shares} onChange={(e) => setEditValues({ ...editValues, shares: e.target.value })} className="input" style={{ width: "80px", padding: "0.25rem 0.5rem" }} />
                    ) : (
                      inv.shares
                    )}
                  </td>
                  <td>₹{inv.buyPrice.toFixed(2)}</td>
                  <td>
                    {isEditing ? (
                      <input type="number" step="0.01" value={editValues.currentPrice} onChange={(e) => setEditValues({ ...editValues, currentPrice: e.target.value })} className="input" style={{ width: "100px", padding: "0.25rem 0.5rem" }} />
                    ) : (
                      `₹${inv.currentPrice.toFixed(2)}`
                    )}
                  </td>
                  <td className="font-semibold">₹{currentVal.toFixed(2)}</td>
                  <td className={`font-semibold ${gainLoss >= 0 ? "green" : "red"}`}>{gainLoss >= 0 ? "+" : ""}{gainLoss.toFixed(2)}</td>
                  <td className={`font-semibold ${returnPct >= 0 ? "green" : "red"}`}>{returnPct >= 0 ? "+" : ""}{returnPct.toFixed(2)}%</td>
                  <td>
                    {isEditing ? (
                      <>
                        <button onClick={() => handleSaveEdit(inv.id)} className="btn btn-success" style={{ marginRight: "0.5rem", padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}>Save</button>
                        <button onClick={cancelEdit} className="btn btn-danger">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(inv)} className="btn btn-primary" style={{ marginRight: "0.5rem", padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}>Edit</button>
                        <button onClick={() => handleDeletePersist(inv.id)} className="btn btn-danger">Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {investments.length === 0 && (
              <tr>
                <td colSpan="9" style={{ color: "#93c5fd", padding: "1rem 0" }}>No investments found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-center mt-2" style={{ color: "#93c5fd", fontSize: "0.875rem" }}>
        <p>Investment Portfolio Manager - Track your financial growth</p>
      </div>
    </div>
  );
}

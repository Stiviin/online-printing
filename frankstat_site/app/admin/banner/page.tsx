"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function BannerAdminPage() {
  const [isActive, setIsActive] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/banner", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setIsActive(d.isActive ?? false); setItems(d.items ?? []); })
      .catch(() => setError("Failed to load banner config."))
      .finally(() => setLoading(false));
  }, []);

  const updateItem = (i: number, val: string) =>
    setItems((prev) => prev.map((v, idx) => (idx === i ? val : v)));

  const removeItem = (i: number) =>
    setItems((prev) => prev.filter((_, idx) => idx !== i));

  const addItem = () => {
    if (items.length >= 10) return;
    setItems((prev) => [...prev, ""]);
  };

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      const r = await fetch("/api/admin/banner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive, items: items.filter((s) => s.trim()) }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Save failed"); }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', system-ui, sans-serif; background: #060D1A; color: #E2EAF4; min-height: 100vh; }

        .page { max-width: 720px; margin: 0 auto; padding: 2.5rem 1.5rem; }

        .back { display: inline-flex; align-items: center; gap: 0.4rem; color: #8CA0B8;
          text-decoration: none; font-size: 0.85rem; font-weight: 500; margin-bottom: 2rem;
          transition: color 0.2s; }
        .back:hover { color: #00AEEF; }

        .page-title { font-size: 1.6rem; font-weight: 700; color: #fff; margin-bottom: 0.3rem; }
        .page-sub { font-size: 0.88rem; color: #8CA0B8; margin-bottom: 2rem; }

        .card {
          background: #0A1525; border: 1px solid rgba(0,174,239,0.15);
          border-radius: 16px; padding: 1.75rem;
          margin-bottom: 1.25rem;
        }
        .card-title { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; color: #00AEEF; margin-bottom: 1.25rem; }

        /* Toggle */
        .toggle-row { display: flex; align-items: center; justify-content: space-between; }
        .toggle-label { font-size: 0.95rem; font-weight: 600; color: #E2EAF4; }
        .toggle-hint { font-size: 0.8rem; color: #8CA0B8; margin-top: 0.2rem; }

        .toggle-switch {
          position: relative; width: 48px; height: 26px; cursor: pointer;
          flex-shrink: 0;
        }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .toggle-track {
          position: absolute; inset: 0; border-radius: 99px;
          background: #1E2D42; border: 1px solid rgba(255,255,255,0.08);
          transition: background 0.25s;
        }
        .toggle-track.on { background: linear-gradient(90deg, #00AEEF, #EC008C); border-color: transparent; }
        .toggle-thumb {
          position: absolute; top: 3px; left: 3px;
          width: 20px; height: 20px; border-radius: 50%;
          background: #fff; transition: transform 0.25s;
          box-shadow: 0 1px 4px rgba(0,0,0,0.4);
        }
        .toggle-track.on + .toggle-thumb,
        .toggle-switch input:checked ~ .toggle-track + .toggle-thumb { transform: translateX(22px); }

        /* Items */
        .item-list { display: flex; flex-direction: column; gap: 0.7rem; }
        .item-row { display: flex; align-items: center; gap: 0.6rem; }
        .item-input {
          flex: 1; background: #060D1A; border: 1.5px solid rgba(0,174,239,0.2);
          border-radius: 8px; padding: 0.65rem 0.9rem;
          font-size: 0.9rem; color: #E2EAF4; outline: none;
          transition: border-color 0.2s;
        }
        .item-input:focus { border-color: #00AEEF; }
        .item-input::placeholder { color: #3A5270; }
        .btn-remove {
          width: 32px; height: 32px; border-radius: 8px;
          background: rgba(236,0,140,0.1); border: 1px solid rgba(236,0,140,0.25);
          color: #EC008C; font-size: 1.1rem; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        .btn-remove:hover { background: rgba(236,0,140,0.2); }

        .btn-add {
          margin-top: 0.75rem; width: 100%;
          background: rgba(0,174,239,0.08); border: 1.5px dashed rgba(0,174,239,0.3);
          border-radius: 8px; padding: 0.65rem;
          color: #00AEEF; font-size: 0.88rem; font-weight: 600;
          cursor: pointer; transition: background 0.2s, border-color 0.2s;
        }
        .btn-add:hover { background: rgba(0,174,239,0.14); border-color: #00AEEF; }
        .btn-add:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Preview */
        .preview-wrap {
          background: linear-gradient(90deg, #0087C0 0%, #00AEEF 30%, #EC008C 70%, #B5006B 100%);
          border-radius: 8px; overflow: hidden; padding: 0.5rem 0;
        }
        .preview-ticker {
          display: flex; gap: 3rem; animation: ticker 20s linear infinite; white-space: nowrap;
        }
        .preview-ticker span { font-size: 0.78rem; color: #fff; font-weight: 600; }
        @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .preview-empty { text-align: center; color: rgba(255,255,255,0.5);
          font-size: 0.82rem; padding: 0.25rem; }

        /* Actions */
        .actions { display: flex; align-items: center; gap: 1rem; margin-top: 1.5rem; }
        .btn-save {
          padding: 0.75rem 2rem; border-radius: 10px; border: none;
          background: linear-gradient(90deg, #00AEEF, #EC008C);
          color: #fff; font-size: 0.95rem; font-weight: 700;
          cursor: pointer; transition: opacity 0.2s, transform 0.15s;
        }
        .btn-save:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .saved-msg { font-size: 0.85rem; color: #4EE59B; font-weight: 600; }
        .error-msg { font-size: 0.85rem; color: #EC008C; font-weight: 600; }

        .skeleton { height: 200px; background: #0A1525; border-radius: 16px; animation: pulse 1.5s ease infinite; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>

      <div className="page">
        <Link href="/" className="back">← Back to site</Link>

        <div className="page-title">Offer Banner</div>
        <p className="page-sub">Control the scrolling banner shown at the top of the homepage.</p>

        {loading ? (
          <div className="skeleton" />
        ) : (
          <>
            {/* Toggle */}
            <div className="card">
              <div className="card-title">Visibility</div>
              <div className="toggle-row">
                <div>
                  <div className="toggle-label">Show banner on homepage</div>
                  <div className="toggle-hint">
                    {isActive ? "Banner is visible to all visitors." : "Banner is hidden. No offers will be shown."}
                  </div>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                  <div className={`toggle-track ${isActive ? "on" : ""}`} />
                  <div className="toggle-thumb" />
                </label>
              </div>
            </div>

            {/* Messages */}
            <div className="card">
              <div className="card-title">Ticker Messages ({items.length}/10)</div>
              <div className="item-list">
                {items.map((item, i) => (
                  <div key={i} className="item-row">
                    <input
                      className="item-input"
                      value={item}
                      onChange={(e) => updateItem(i, e.target.value)}
                      placeholder="e.g. 🎉 FREE DELIVERY on orders above KES 5,000"
                      maxLength={200}
                    />
                    <button className="btn-remove" onClick={() => removeItem(i)} title="Remove">×</button>
                  </div>
                ))}
              </div>
              <button className="btn-add" onClick={addItem} disabled={items.length >= 10}>
                + Add message
              </button>
            </div>

            {/* Live preview */}
            <div className="card">
              <div className="card-title">Live Preview</div>
              <div className="preview-wrap">
                {items.filter((s) => s.trim()).length > 0 ? (
                  <div className="preview-ticker">
                    {[...items.filter((s) => s.trim()), ...items.filter((s) => s.trim())].map((t, i) => (
                      <span key={i}>{t}</span>
                    ))}
                  </div>
                ) : (
                  <div className="preview-empty">No messages — add some above</div>
                )}
              </div>
            </div>

            {/* Save */}
            <div className="actions">
              <button className="btn-save" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
              {saved && <span className="saved-msg">✓ Saved successfully</span>}
              {error && <span className="error-msg">⚠ {error}</span>}
            </div>
          </>
        )}
      </div>
    </>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", remember: false });
  const [forgotEmail, setForgotEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");

  const set = (k: string, v: string | boolean) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (serverError) setServerError("");
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.email.includes("@")) e.email = "Enter a valid email";
    if (form.password.length < 6) e.password = "Password is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setServerError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setServerError(d.error ?? "Login failed. Please try again.");
        return;
      }
      router.push("/");
    } catch {
      setServerError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.includes("@")) return;
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      setForgotSent(true);
    } catch {
      setForgotSent(true); // always show success to prevent enumeration
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }

        :root {
          --cyan:     #00AEEF;
          --cyan-dim: rgba(0,174,239,0.15);
          --magenta:  #EC008C;
          --mag-dim:  rgba(236,0,140,0.15);
          --yellow:   #FFE500;
          --yel-dim:  rgba(255,229,0,0.12);
          --dark:     #060D1A;
          --dark-2:   #0A1525;
          --dark-3:   #0F1E30;
          --border:   rgba(0,174,239,0.18);
          --text:     #E2EAF4;
          --text-soft:#8CA0B8;
          --error:    #EC008C;
        }

        body {
          font-family: 'Inter', system-ui, sans-serif;
          background: var(--dark);
          min-height: 100vh;
          display: flex;
          align-items: stretch;
        }

        .auth-shell {
          display: grid;
          grid-template-columns: 1fr 1fr;
          min-height: 100vh;
          width: 100%;
        }

        /* ── VISUAL PANEL ── */
        .panel-visual {
          background: var(--dark-2);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 3rem;
          position: relative;
          overflow: hidden;
        }
        /* Cyan top-left glow */
        .panel-visual::before {
          content: '';
          position: absolute;
          top: -120px; left: -120px;
          width: 480px; height: 480px;
          background: radial-gradient(circle, rgba(0,174,239,0.18) 0%, transparent 65%);
          pointer-events: none;
        }
        /* Magenta bottom-right glow */
        .panel-visual::after {
          content: '';
          position: absolute;
          bottom: -100px; right: -100px;
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(236,0,140,0.14) 0%, transparent 65%);
          pointer-events: none;
        }

        .panel-logo {
          font-size: 1.5rem; font-weight: 800;
          color: var(--text); letter-spacing: -0.02em;
          text-decoration: none;
          position: relative; z-index: 1;
          display: flex; align-items: center; gap: 0.5rem;
        }
        .logo-img { height: 38px; width: auto; object-fit: contain; }

        .panel-middle { position: relative; z-index: 1; }

        .panel-tagline {
          font-size: clamp(1.8rem, 2.8vw, 2.5rem);
          font-weight: 800; color: var(--text);
          line-height: 1.15; margin-bottom: 1.2rem;
          letter-spacing: -0.03em;
        }
        .panel-tagline .c { color: var(--cyan); }
        .panel-tagline .m { color: var(--magenta); }
        .panel-tagline .y { color: var(--yellow); }

        .panel-sub {
          font-size: 0.9rem; color: var(--text-soft);
          line-height: 1.75; max-width: 340px;
          margin-bottom: 2.5rem;
        }

        /* Orders badge */
        .orders-badge {
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border);
          border-radius: 14px; padding: 1.5rem;
          max-width: 340px;
          backdrop-filter: blur(8px);
        }
        .badge-title {
          font-size: 0.72rem; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: var(--cyan); margin-bottom: 1rem;
        }
        .order-item {
          display: flex; align-items: center;
          gap: 0.75rem; padding: 0.55rem 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .order-item:last-child { border-bottom: none; }
        .order-dot {
          width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
        }
        .order-name { font-size: 0.84rem; color: var(--text-soft); flex: 1; }
        .order-status {
          font-size: 0.7rem; font-weight: 600;
          padding: 0.18rem 0.55rem; border-radius: 99px;
        }

        .panel-bottom { position: relative; z-index: 1; }
        .panel-bottom-text { font-size: 0.78rem; color: rgba(140,160,184,0.5); }

        /* ── FORM PANEL ── */
        .panel-form {
          background: var(--dark);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 3rem 2.5rem;
          position: relative;
        }
        /* Subtle yellow glow top-right */
        .panel-form::before {
          content: '';
          position: absolute;
          top: -60px; right: -60px;
          width: 260px; height: 260px;
          background: radial-gradient(circle, rgba(255,229,0,0.06) 0%, transparent 65%);
          pointer-events: none;
        }

        .form-box { width: 100%; max-width: 400px; position: relative; z-index: 1; }

        .form-eyebrow {
          font-size: 0.68rem; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          background: linear-gradient(90deg, var(--cyan), var(--magenta));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 0.6rem;
        }
        .form-title {
          font-size: 2rem; font-weight: 800;
          color: var(--text); line-height: 1.1;
          letter-spacing: -0.03em; margin-bottom: 0.45rem;
        }
        .form-subtitle { font-size: 0.87rem; color: var(--text-soft); margin-bottom: 2rem; }
        .form-subtitle a { color: var(--cyan); text-decoration: none; font-weight: 600; }
        .form-subtitle a:hover { text-decoration: underline; }

        .field { margin-bottom: 1.2rem; }
        .label {
          display: block;
          font-size: 0.72rem; font-weight: 600;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--text-soft); margin-bottom: 0.45rem;
        }
        .input-wrap { position: relative; }
        .input {
          width: 100%;
          background: var(--dark-3);
          border: 1.5px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 0.8rem 1rem;
          font-family: 'Inter', sans-serif;
          font-size: 0.95rem; color: var(--text);
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
          outline: none;
        }
        .input::placeholder { color: rgba(140,160,184,0.4); }
        .input:focus {
          border-color: var(--cyan);
          background: var(--dark-2);
          box-shadow: 0 0 0 3px rgba(0,174,239,0.12);
        }
        .input.has-error {
          border-color: var(--magenta);
          box-shadow: 0 0 0 3px rgba(236,0,140,0.1);
        }
        .toggle-pass {
          position: absolute; right: 0.9rem; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          cursor: pointer; color: var(--text-soft);
          font-size: 0.9rem; transition: color 0.2s;
        }
        .toggle-pass:hover { color: var(--cyan); }
        .err { font-size: 0.74rem; color: var(--magenta); margin-top: 0.3rem; font-weight: 500; }

        .meta-row {
          display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 1.5rem;
        }
        .check-wrap {
          display: flex; align-items: center; gap: 0.55rem; cursor: pointer;
        }
        .check-box {
          width: 16px; height: 16px; border-radius: 4px;
          border: 1.5px solid rgba(255,255,255,0.15);
          background: var(--dark-3); flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s; cursor: pointer;
        }
        .check-box.checked {
          background: linear-gradient(135deg, var(--cyan), var(--magenta));
          border-color: transparent;
        }
        .check-text { font-size: 0.82rem; color: var(--text-soft); }
        .forgot-link {
          font-size: 0.82rem; color: var(--cyan);
          font-weight: 600; text-decoration: none;
          cursor: pointer; background: none; border: none;
          font-family: 'Inter', sans-serif;
          transition: color 0.2s;
        }
        .forgot-link:hover { color: var(--magenta); }

        /* CTA button — gradient */
        .btn-full {
          width: 100%;
          background: linear-gradient(90deg, var(--cyan) 0%, var(--magenta) 100%);
          color: #fff; border: none; border-radius: 10px;
          padding: 0.9rem;
          font-family: 'Inter', sans-serif;
          font-size: 0.95rem; font-weight: 700;
          letter-spacing: 0.02em; cursor: pointer;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          box-shadow: 0 4px 20px rgba(0,174,239,0.25);
        }
        .btn-full:hover {
          opacity: 0.92; transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(0,174,239,0.35);
        }
        .btn-full:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }

        .divider {
          display: flex; align-items: center; gap: 0.8rem;
          margin: 1.5rem 0;
        }
        .divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.07); }
        .divider-text { font-size: 0.74rem; color: var(--text-soft); font-weight: 500; }

        .social-row { display: flex; gap: 0.75rem; }
        .btn-social {
          flex: 1;
          background: var(--dark-3);
          border: 1.5px solid rgba(255,255,255,0.08);
          border-radius: 10px; padding: 0.7rem;
          font-family: 'Inter', sans-serif;
          font-size: 0.82rem; font-weight: 600; color: var(--text-soft);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          transition: border-color 0.2s, color 0.2s, background 0.2s;
        }
        .btn-social:hover { border-color: var(--cyan); color: var(--text); background: var(--dark-2); }

        /* Spinner */
        .spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.25);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Forgot panel */
        .forgot-panel { animation: fadeUp 0.3s ease both; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .back-btn {
          background: none; border: none;
          color: var(--text-soft); cursor: pointer;
          font-family: 'Inter', sans-serif;
          font-size: 0.85rem; font-weight: 600;
          display: flex; align-items: center; gap: 0.4rem;
          margin-bottom: 1.5rem; padding: 0;
          transition: color 0.2s;
        }
        .back-btn:hover { color: var(--cyan); }

        .sent-box {
          background: rgba(0,174,239,0.08);
          border: 1.5px solid rgba(0,174,239,0.25);
          border-radius: 12px; padding: 1.5rem;
          text-align: center; margin-top: 1rem;
        }
        .sent-icon { font-size: 2rem; margin-bottom: 0.6rem; }
        .sent-title {
          font-size: 1.1rem; font-weight: 700;
          color: var(--text); margin-bottom: 0.4rem;
        }
        .sent-desc { font-size: 0.85rem; color: var(--text-soft); line-height: 1.65; }

        .server-error {
          display: flex; align-items: flex-start; gap: 0.6rem;
          background: rgba(236,0,140,0.08); border: 1.5px solid rgba(236,0,140,0.25);
          border-radius: 10px; padding: 0.75rem 1rem;
          margin-bottom: 1.1rem;
          animation: fadeUp 0.2s ease both;
        }
        .server-error-text { font-size: 0.84rem; color: #FF6EC7; font-weight: 500; line-height: 1.45; }

        /* Decorative accent bar */
        .accent-bar {
          width: 40px; height: 3px; border-radius: 99px;
          background: linear-gradient(90deg, var(--cyan), var(--magenta));
          margin-bottom: 1.25rem;
        }

        @media (max-width: 768px) {
          .auth-shell { grid-template-columns: 1fr; }
          .panel-visual { display: none; }
          .panel-form { padding: 2.5rem 1.5rem; align-items: flex-start; }
          .form-box { max-width: 100%; }
        }
      `}</style>

      <div className="auth-shell">
        {/* ── FORM PANEL ── */}
        <div className="panel-form">
          <div className="form-box">

            {forgotMode ? (
              <div className="forgot-panel">
                <button className="back-btn" onClick={() => { setForgotMode(false); setForgotSent(false); }}>
                  ← Back to sign in
                </button>
                <div className="accent-bar" />
                <div className="form-eyebrow">Account Recovery</div>
                <div className="form-title">Reset Password</div>
                <p className="form-subtitle">Enter your email and we'll send a reset link instantly.</p>

                {forgotSent ? (
                  <div className="sent-box">
                    <div className="sent-icon">📬</div>
                    <div className="sent-title">Check your inbox!</div>
                    <p className="sent-desc">
                      If <strong>{forgotEmail}</strong> is registered, a reset link is on its way. It expires in 1 hour.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleForgot} noValidate>
                    <div className="field">
                      <label className="label">Email Address</label>
                      <input
                        className="input" type="email" placeholder="you@example.com"
                        value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                        autoFocus required
                      />
                    </div>
                    <button type="submit" className="btn-full" disabled={loading || !forgotEmail.includes("@")}>
                      {loading ? <div className="spinner" /> : "Send Reset Link →"}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <>
                <div className="accent-bar" />
                <div className="form-eyebrow">Welcome Back</div>
                <div className="form-title">Sign In</div>
                <p className="form-subtitle">
                  New to Frankstat?{" "}
                  <Link href="/signup">Create a free account</Link>
                </p>

                <form onSubmit={handleLogin} noValidate>
                  <div className="field">
                    <label className="label">Email Address</label>
                    <input
                      className={`input${errors.email ? " has-error" : ""}`}
                      type="email" placeholder="you@example.com"
                      value={form.email} onChange={(e) => set("email", e.target.value)}
                      autoFocus
                    />
                    {errors.email && <div className="err">⚠ {errors.email}</div>}
                  </div>

                  <div className="field">
                    <label className="label">Password</label>
                    <div className="input-wrap">
                      <input
                        className={`input${errors.password ? " has-error" : ""}`}
                        type={showPass ? "text" : "password"}
                        placeholder="Your password"
                        value={form.password} onChange={(e) => set("password", e.target.value)}
                      />
                      <button type="button" className="toggle-pass" onClick={() => setShowPass((s) => !s)}>
                        {showPass ? "🙈" : "👁"}
                      </button>
                    </div>
                    {errors.password && <div className="err">⚠ {errors.password}</div>}
                  </div>

                  <div className="meta-row">
                    <label className="check-wrap" onClick={() => set("remember", !form.remember)}>
                      <div className={`check-box${form.remember ? " checked" : ""}`}>
                        {form.remember && <span style={{ color: "white", fontSize: "0.6rem" }}>✓</span>}
                      </div>
                      <span className="check-text">Remember me</span>
                    </label>
                    <button type="button" className="forgot-link" onClick={() => setForgotMode(true)}>
                      Forgot password?
                    </button>
                  </div>

                  {serverError && (
                    <div className="server-error">
                      <span className="server-error-text">⚠ {serverError}</span>
                    </div>
                  )}

                  <button type="submit" className="btn-full" disabled={loading}>
                    {loading ? <div className="spinner" /> : "Sign In →"}
                  </button>
                </form>

                <div className="divider">
                  <div className="divider-line" />
                  <div className="divider-text">or continue with</div>
                  <div className="divider-line" />
                </div>
                <div className="social-row">
                  <button type="button" className="btn-social">G&nbsp; Google</button>
                  <button type="button" className="btn-social">f&nbsp; Facebook</button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── VISUAL PANEL ── */}
        <div className="panel-visual">
          <Link href="/" className="panel-logo">
            <img src="/logo.png" alt="Frankstat" className="logo-img" />
          </Link>

          <div className="panel-middle">
            <h2 className="panel-tagline">
              Your account.<br />
              <span className="c">Your orders.</span><br />
              <span className="m">All in one</span> <span className="y">place.</span>
            </h2>
            <p className="panel-sub">
              Track your prints in real-time, reorder favourites, and manage invoices — all from your Frankstat dashboard.
            </p>

            <div className="orders-badge">
              <div className="badge-title">📦 Recent Orders</div>
              {[
                { name: "Event Banners × 4",    status: "In Production", dot: "#00AEEF", bg: "rgba(0,174,239,0.12)",  tx: "#00AEEF" },
                { name: "Business Cards × 500", status: "Ready",         dot: "#FFE500", bg: "rgba(255,229,0,0.12)",  tx: "#FFE500" },
                { name: "3D Signage × 1",        status: "Delivering",    dot: "#EC008C", bg: "rgba(236,0,140,0.12)", tx: "#EC008C" },
              ].map((item) => (
                <div key={item.name} className="order-item">
                  <div className="order-dot" style={{ background: item.dot }} />
                  <div className="order-name">{item.name}</div>
                  <div className="order-status" style={{ color: item.tx, background: item.bg }}>{item.status}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel-bottom">
            <p className="panel-bottom-text">© {new Date().getFullYear()} Frankstat Printing Solutions · Nairobi, Kenya</p>
          </div>
        </div>
      </div>
    </>
  );
}

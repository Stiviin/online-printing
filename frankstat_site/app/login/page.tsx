"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";;


export default function LoginPage() {
  const router = useRouter();

  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", remember: false });
  const [forgotEmail, setForgotEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

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

    const { email, password } = form; 
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        let errorMessage = "Login failed";
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch {}
        alert(errorMessage);
        setLoading(false);
        return;
      }

      const data = await res.json();
      console.log("Login successful:", data);

      // ✅ router.push now works
      router.push("/");
    } catch (error) {
      console.error("Error during login:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };





  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.includes("@")) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1400));
    setLoading(false);
    setForgotSent(true);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }

        :root {
          --white: #FFFFFF;
          --off: #F9F6F2;
          --ink: #1C1410;
          --ink-soft: #5C4A38;
          --gold: #C19A4A;
          --gold-light: #E8C97A;
          --cream: #F0E8DC;
          --cream-border: #E2D5C3;
          --error: #C0392B;
        }

        body {
          font-family: 'DM Sans', sans-serif;
          background: var(--white);
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

        /* ── RIGHT PANEL (form side — now on left for login) ── */
        .panel-form {
          background: var(--white);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 3rem 2rem;
          order: 0;
        }

        /* ── LEFT PANEL (visual side — now on right for login) ── */
        .panel-visual {
          background: var(--ink);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 3rem;
          position: relative;
          overflow: hidden;
          order: 1;
        }
        .panel-visual::before {
          content: '';
          position: absolute;
          top: -100px; left: -100px;
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(193,154,74,0.15) 0%, transparent 65%);
          pointer-events: none;
        }
        .panel-visual::after {
          content: '';
          position: absolute;
          bottom: -80px; right: -80px;
          width: 380px; height: 380px;
          background: radial-gradient(circle, rgba(193,154,74,0.1) 0%, transparent 65%);
          pointer-events: none;
        }

        .panel-logo {
          font-family: 'Playfair Display', serif;
          font-size: 1.7rem;
          font-weight: 900;
          color: var(--white);
          letter-spacing: -0.02em;
          text-decoration: none;
          position: relative; z-index: 1;
        }
        .panel-logo span { color: var(--gold); }

        .panel-middle { position: relative; z-index: 1; }

        .panel-tagline {
          font-family: 'Playfair Display', serif;
          font-size: clamp(1.8rem, 2.8vw, 2.6rem);
          font-weight: 900;
          color: var(--white);
          line-height: 1.15;
          margin-bottom: 1.2rem;
        }
        .panel-tagline em { font-style: italic; color: var(--gold); }
        .panel-sub {
          font-size: 0.92rem; color: #A89070;
          line-height: 1.7; max-width: 340px;
          margin-bottom: 2.5rem;
        }

        /* Big decorative print badge */
        .print-badge {
          background: rgba(193,154,74,0.1);
          border: 1px solid rgba(193,154,74,0.25);
          border-radius: 16px;
          padding: 2rem;
          max-width: 340px;
        }
        .print-badge-title {
          font-family: 'Playfair Display', serif;
          font-size: 1rem; font-weight: 700;
          color: var(--gold-light); margin-bottom: 1rem;
        }
        .order-item {
          display: flex; align-items: center;
          gap: 0.8rem; padding: 0.6rem 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .order-item:last-child { border-bottom: none; }
        .order-dot {
          width: 8px; height: 8px; border-radius: 50%;
          flex-shrink: 0;
        }
        .order-name { font-size: 0.85rem; color: #C8B89A; flex: 1; }
        .order-status {
          font-size: 0.72rem; font-weight: 600;
          padding: 0.2rem 0.6rem; border-radius: 99px;
        }

        .panel-bottom { position: relative; z-index: 1; }
        .panel-bottom-text { font-size: 0.8rem; color: #5C4A38; }

        /* ── FORM BOX ── */
        .form-box { width: 100%; max-width: 400px; }

        .form-header { margin-bottom: 2rem; }
        .form-eyebrow {
          font-size: 0.72rem; font-weight: 600;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: var(--gold); margin-bottom: 0.5rem;
        }
        .form-title {
          font-family: 'Playfair Display', serif;
          font-size: 2.2rem; font-weight: 900;
          color: var(--ink); line-height: 1.1;
          margin-bottom: 0.4rem;
        }
        .form-subtitle { font-size: 0.88rem; color: var(--ink-soft); }
        .form-subtitle a {
          color: var(--gold); text-decoration: none; font-weight: 600;
        }
        .form-subtitle a:hover { text-decoration: underline; }

        .field { margin-bottom: 1.25rem; }
        .label {
          display: block;
          font-size: 0.74rem; font-weight: 600;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--ink-soft); margin-bottom: 0.45rem;
        }
        .input-wrap { position: relative; }
        .input {
          width: 100%;
          background: var(--off);
          border: 1.5px solid var(--cream-border);
          border-radius: 8px;
          padding: 0.8rem 1rem;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.95rem; color: var(--ink);
          transition: border-color 0.2s, background 0.2s;
          outline: none;
        }
        .input:focus { border-color: var(--gold); background: var(--white); }
        .input.has-error { border-color: var(--error); }
        .toggle-pass {
          position: absolute; right: 0.9rem; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          cursor: pointer; font-size: 1rem;
          opacity: 0.5; transition: opacity 0.2s;
        }
        .toggle-pass:hover { opacity: 1; }
        .err { font-size: 0.75rem; color: var(--error); margin-top: 0.3rem; }

        .meta-row {
          display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 1.5rem;
        }
        .check-wrap {
          display: flex; align-items: center; gap: 0.6rem; cursor: pointer;
        }
        .check-box {
          width: 16px; height: 16px; border-radius: 3px;
          border: 1.5px solid var(--cream-border);
          background: var(--off); flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s; cursor: pointer;
        }
        .check-box.checked { background: var(--ink); border-color: var(--ink); }
        .check-text { font-size: 0.82rem; color: var(--ink-soft); }
        .forgot-link {
          font-size: 0.82rem; color: var(--gold);
          font-weight: 600; text-decoration: none;
          cursor: pointer; background: none; border: none;
          font-family: 'DM Sans', sans-serif;
        }
        .forgot-link:hover { text-decoration: underline; }

        .btn-full {
          width: 100%;
          background: var(--ink); color: var(--white);
          border: none; border-radius: 8px;
          padding: 0.9rem;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.95rem; font-weight: 700;
          letter-spacing: 0.04em; cursor: pointer;
          transition: background 0.2s, transform 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
        }
        .btn-full:hover { background: #3D2B1A; transform: translateY(-1px); }
        .btn-full:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        .divider {
          display: flex; align-items: center; gap: 0.8rem;
          margin: 1.5rem 0;
        }
        .divider-line { flex: 1; height: 1px; background: var(--cream-border); }
        .divider-text { font-size: 0.75rem; color: #A89070; font-weight: 500; }

        .social-row { display: flex; gap: 0.8rem; }
        .btn-social {
          flex: 1;
          background: var(--off);
          border: 1.5px solid var(--cream-border);
          border-radius: 8px; padding: 0.7rem;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.82rem; font-weight: 600; color: var(--ink);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          transition: border-color 0.2s, background 0.2s;
        }
        .btn-social:hover { border-color: var(--gold); background: var(--white); }

        .spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: var(--white);
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Forgot password panel */
        .forgot-panel {
          animation: fadeUp 0.3s ease both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .back-btn {
          background: none; border: none;
          color: var(--ink-soft); cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.85rem; font-weight: 600;
          display: flex; align-items: center; gap: 0.4rem;
          margin-bottom: 1.5rem; padding: 0;
          transition: color 0.2s;
        }
        .back-btn:hover { color: var(--ink); }

        .sent-box {
          background: #F0FAF4;
          border: 1.5px solid #B8DECA;
          border-radius: 10px; padding: 1.5rem;
          text-align: center; margin-top: 1rem;
        }
        .sent-icon { font-size: 2rem; margin-bottom: 0.5rem; }
        .sent-title {
          font-family: 'Playfair Display', serif;
          font-size: 1.1rem; font-weight: 700;
          color: var(--ink); margin-bottom: 0.4rem;
        }
        .sent-desc { font-size: 0.85rem; color: #4A7A5C; line-height: 1.6; }

        /* Responsive */
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
              /* ── FORGOT PASSWORD ── */
              <div className="forgot-panel">
                <button className="back-btn" onClick={() => { setForgotMode(false); setForgotSent(false); }}>
                  ← Back to login
                </button>
                <div className="form-header">
                  <div className="form-eyebrow">Account Recovery</div>
                  <h2 className="form-title">Reset Password</h2>
                  <p className="form-subtitle">
                    Enter your email and we'll send a reset link instantly.
                  </p>
                </div>

                {forgotSent ? (
                  <div className="sent-box">
                    <div className="sent-icon">📬</div>
                    <div className="sent-title">Check your inbox!</div>
                    <p className="sent-desc">
                      We sent a password reset link to <strong>{forgotEmail}</strong>. 
                      It expires in 30 minutes.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleForgot} noValidate>
                    <div className="field">
                      <label className="label">Email Address</label>
                      <input
                        className="input"
                        type="email" placeholder="you@example.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
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
              /* ── LOGIN FORM ── */
              <>
                <div className="form-header">
                  <div className="form-eyebrow">Welcome Back</div>
                  <h2 className="form-title">Sign In</h2>
                  <p className="form-subtitle">
                    New to Frankstat?{" "}
                    <Link href="/signup">Create a free account</Link>
                  </p>
                </div>

                <form onSubmit={handleLogin} noValidate>
                  <div className="field">
                    <label className="label">Email Address</label>
                    <input
                      className={`input${errors.email ? " has-error" : ""}`}
                      type="email" placeholder="you@example.com"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
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
                        value={form.password}
                        onChange={(e) => set("password", e.target.value)}
                      />
                      <button type="button" className="toggle-pass" onClick={() => setShowPass((s) => !s)}>
                        {showPass ? "🙈" : "👁️"}
                      </button>
                    </div>
                    {errors.password && <div className="err">⚠ {errors.password}</div>}
                  </div>

                  <div className="meta-row">
                    <label className="check-wrap" onClick={() => set("remember", !form.remember)}>
                      <div className={`check-box${form.remember ? " checked" : ""}`}>
                        {form.remember && <span style={{ color: "white", fontSize: "0.65rem" }}>✓</span>}
                      </div>
                      <span className="check-text">Remember me</span>
                    </label>
                    <button type="button" className="forgot-link" onClick={() => setForgotMode(true)}>
                      Forgot password?
                    </button>
                  </div>

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
                  <button type="button" className="btn-social">
                    <span>G</span> Google
                  </button>
                  <button type="button" className="btn-social">
                    <span>f</span> Facebook
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── VISUAL PANEL ── */}
        <div className="panel-visual">
          <Link href="/" className="panel-logo">FRANK<span>STAT</span></Link>

          <div className="panel-middle">
            <h2 className="panel-tagline">
              Your account.<br />
              <em>Your orders.</em><br />
              All in one place.
            </h2>
            <p className="panel-sub">
              Track your prints in real-time, reorder favourites, and manage invoices — all from your Frankstat dashboard.
            </p>

            <div className="print-badge">
              <div className="print-badge-title">📦 Recent Orders</div>
              {[
                { name: "Event Banners × 4", status: "In Production", color: "#E09A52", bg: "rgba(224,154,82,0.15)" },
                { name: "Business Cards × 500", status: "Ready", color: "#5A9E6F", bg: "rgba(90,158,111,0.15)" },
                { name: "3D Signage × 1", status: "Delivering", color: "#C19A4A", bg: "rgba(193,154,74,0.15)" },
              ].map((item) => (
                <div key={item.name} className="order-item">
                  <div className="order-dot" style={{ background: item.color }} />
                  <div className="order-name">{item.name}</div>
                  <div className="order-status" style={{ color: item.color, background: item.bg }}>
                    {item.status}
                  </div>
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


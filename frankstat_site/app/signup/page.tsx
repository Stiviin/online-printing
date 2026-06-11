"use client";

import { useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const [form, setForm] = useState({
    fullName: "", email: "", phone: "", password: "", confirm: "", agree: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const passwordStrength = (() => {
    const p = form.password;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][passwordStrength];
  const strengthColors = ["", "#EC008C", "#FFE500", "#00AEEF", "#4EE59B"];
  const strengthColor  = strengthColors[passwordStrength];

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName = "Full name is required";
    if (!form.email.includes("@")) e.email = "Enter a valid email";
    if (form.phone.length < 9) e.phone = "Enter a valid phone number";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if (form.password.length < 8) e.password = "Minimum 8 characters";
    if (form.password !== form.confirm) e.confirm = "Passwords don't match";
    if (!form.agree) e.agree = "Please accept the terms";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => { if (validateStep1()) setStep(2); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep2()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName, email: form.email,
          phone: form.phone, password: form.password,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErrors({ general: d.error ?? `Server error (${res.status})` });
        return;
      }
      setDone(true);
    } catch {
      setErrors({ general: "Network error. Please check your connection." });
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
          background: var(--dark); min-height: 100vh;
          display: flex; align-items: stretch;
        }

        .auth-shell {
          display: grid; grid-template-columns: 1fr 1fr;
          min-height: 100vh; width: 100%;
        }

        /* ── LEFT VISUAL PANEL ── */
        .panel-left {
          background: var(--dark-2);
          display: flex; flex-direction: column;
          justify-content: space-between;
          padding: 3rem; position: relative; overflow: hidden;
        }
        .panel-left::before {
          content: ''; position: absolute;
          top: -100px; right: -100px;
          width: 420px; height: 420px;
          background: radial-gradient(circle, rgba(0,174,239,0.16) 0%, transparent 65%);
          pointer-events: none;
        }
        .panel-left::after {
          content: ''; position: absolute;
          bottom: -80px; left: -80px;
          width: 350px; height: 350px;
          background: radial-gradient(circle, rgba(236,0,140,0.13) 0%, transparent 65%);
          pointer-events: none;
        }

        .panel-logo {
          font-size: 1.5rem; font-weight: 800;
          color: var(--text); text-decoration: none;
          position: relative; z-index: 1;
        }
        .logo-img { height: 38px; width: auto; object-fit: contain; }

        .panel-middle { position: relative; z-index: 1; }

        .panel-tagline {
          font-size: clamp(1.7rem, 2.6vw, 2.4rem);
          font-weight: 800; color: var(--text);
          line-height: 1.2; letter-spacing: -0.03em;
          margin-bottom: 1rem;
        }
        .panel-tagline .c { color: var(--cyan); }
        .panel-tagline .m { color: var(--magenta); }
        .panel-tagline .y { color: var(--yellow); }

        .panel-sub {
          font-size: 0.88rem; color: var(--text-soft);
          line-height: 1.75; max-width: 320px; margin-bottom: 2.5rem;
        }

        .perks { display: flex; flex-direction: column; gap: 0.85rem; }
        .perk { display: flex; align-items: flex-start; gap: 0.9rem; }
        .perk-icon {
          width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.95rem;
        }
        .perk-icon.c { background: rgba(0,174,239,0.12); }
        .perk-icon.m { background: rgba(236,0,140,0.12); }
        .perk-icon.y { background: rgba(255,229,0,0.12); }
        .perk-icon.g { background: rgba(78,229,155,0.12); }
        .perk-text { font-size: 0.85rem; color: var(--text-soft); line-height: 1.5; padding-top: 0.5rem; }

        .panel-bottom { position: relative; z-index: 1; }
        .panel-bottom-text { font-size: 0.78rem; color: rgba(140,160,184,0.5); }

        /* ── RIGHT FORM PANEL ── */
        .panel-right {
          background: var(--dark);
          display: flex; align-items: center; justify-content: center;
          padding: 3rem 2.5rem; position: relative;
        }
        .panel-right::before {
          content: ''; position: absolute;
          bottom: -60px; right: -60px;
          width: 280px; height: 280px;
          background: radial-gradient(circle, rgba(255,229,0,0.06) 0%, transparent 65%);
          pointer-events: none;
        }

        .form-box { width: 100%; max-width: 420px; position: relative; z-index: 1; }

        .accent-bar {
          width: 40px; height: 3px; border-radius: 99px;
          background: linear-gradient(90deg, var(--cyan), var(--magenta));
          margin-bottom: 1.2rem;
        }
        .form-eyebrow {
          font-size: 0.68rem; font-weight: 700; letter-spacing: 0.2em;
          text-transform: uppercase;
          background: linear-gradient(90deg, var(--cyan), var(--magenta));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text; margin-bottom: 0.5rem;
        }
        .form-title {
          font-size: 1.9rem; font-weight: 800; color: var(--text);
          line-height: 1.1; letter-spacing: -0.03em; margin-bottom: 0.4rem;
        }
        .form-subtitle { font-size: 0.87rem; color: var(--text-soft); margin-bottom: 1.75rem; }
        .form-subtitle a { color: var(--cyan); text-decoration: none; font-weight: 600; }
        .form-subtitle a:hover { text-decoration: underline; }

        /* Step indicator */
        .steps-wrap { margin-bottom: 1.75rem; }
        .steps { display: flex; align-items: center; margin-bottom: 0.3rem; }
        .step-dot {
          width: 28px; height: 28px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.72rem; font-weight: 700; transition: all 0.3s;
          border: 2px solid rgba(255,255,255,0.1);
          color: var(--text-soft); background: var(--dark-3);
        }
        .step-dot.active {
          background: linear-gradient(135deg, var(--cyan), var(--magenta));
          border-color: transparent; color: #fff;
        }
        .step-dot.done {
          background: rgba(0,174,239,0.2); border-color: var(--cyan); color: var(--cyan);
        }
        .step-line {
          flex: 1; height: 2px;
          background: rgba(255,255,255,0.07); transition: background 0.3s;
          margin: 0 0.4rem;
        }
        .step-line.done { background: linear-gradient(90deg, var(--cyan), var(--magenta)); }
        .steps-labels { display: flex; justify-content: space-between; }
        .step-label { font-size: 0.7rem; color: var(--text-soft); font-weight: 500; }
        .step-label.active { color: var(--cyan); font-weight: 600; }

        /* Fields */
        .field { margin-bottom: 1.2rem; }
        .label {
          display: block; font-size: 0.72rem; font-weight: 600;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--text-soft); margin-bottom: 0.45rem;
        }
        .input-wrap { position: relative; }
        .input {
          width: 100%; background: var(--dark-3);
          border: 1.5px solid rgba(255,255,255,0.08);
          border-radius: 10px; padding: 0.8rem 1rem;
          font-family: 'Inter', sans-serif;
          font-size: 0.95rem; color: var(--text);
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          outline: none;
        }
        .input::placeholder { color: rgba(140,160,184,0.4); }
        .input:focus {
          border-color: var(--cyan); background: var(--dark-2);
          box-shadow: 0 0 0 3px rgba(0,174,239,0.12);
        }
        .input.has-error { border-color: var(--magenta); box-shadow: 0 0 0 3px rgba(236,0,140,0.1); }
        .input.has-prefix { padding-left: 3.2rem; }
        .prefix {
          position: absolute; left: 0.9rem; top: 50%;
          transform: translateY(-50%);
          font-size: 0.88rem; font-weight: 600;
          color: var(--text-soft); pointer-events: none;
        }
        .toggle-pass {
          position: absolute; right: 0.9rem; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          cursor: pointer; color: var(--text-soft);
          font-size: 0.9rem; padding: 0; transition: color 0.2s;
        }
        .toggle-pass:hover { color: var(--cyan); }
        .err { font-size: 0.74rem; color: var(--magenta); margin-top: 0.3rem; font-weight: 500; }

        /* Password strength */
        .strength-bar { display: flex; gap: 4px; margin-top: 0.55rem; }
        .strength-seg {
          flex: 1; height: 3px; border-radius: 99px;
          background: rgba(255,255,255,0.08); transition: background 0.3s;
        }
        .strength-label { font-size: 0.71rem; font-weight: 600; margin-top: 0.25rem; }

        /* Checkbox */
        .check-wrap { display: flex; align-items: flex-start; gap: 0.7rem; cursor: pointer; }
        .check-box {
          width: 18px; height: 18px; border-radius: 4px;
          border: 1.5px solid rgba(255,255,255,0.12);
          background: var(--dark-3); flex-shrink: 0; margin-top: 1px;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s; cursor: pointer;
        }
        .check-box.checked {
          background: linear-gradient(135deg, var(--cyan), var(--magenta));
          border-color: transparent;
        }
        .check-text { font-size: 0.82rem; color: var(--text-soft); line-height: 1.5; }
        .check-text a { color: var(--cyan); text-decoration: none; font-weight: 600; }
        .check-text a:hover { text-decoration: underline; }

        /* Buttons */
        .btn-full {
          width: 100%;
          background: linear-gradient(90deg, var(--cyan) 0%, var(--magenta) 100%);
          color: #fff; border: none; border-radius: 10px;
          padding: 0.9rem;
          font-family: 'Inter', sans-serif;
          font-size: 0.95rem; font-weight: 700;
          letter-spacing: 0.02em; cursor: pointer;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          margin-top: 0.5rem;
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          box-shadow: 0 4px 20px rgba(0,174,239,0.22);
        }
        .btn-full:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 8px 28px rgba(0,174,239,0.32); }
        .btn-full:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }

        .btn-back {
          background: transparent; border: 1.5px solid rgba(255,255,255,0.1);
          color: var(--text-soft); border-radius: 10px;
          padding: 0.85rem 1.5rem;
          font-family: 'Inter', sans-serif;
          font-size: 0.9rem; font-weight: 600;
          cursor: pointer; transition: border-color 0.2s, color 0.2s;
        }
        .btn-back:hover { border-color: var(--cyan); color: var(--cyan); }

        .btn-row { display: flex; gap: 0.8rem; margin-top: 0.5rem; }
        .btn-row .btn-full { flex: 1; margin-top: 0; }

        .divider { display: flex; align-items: center; gap: 0.8rem; margin: 1.5rem 0; }
        .divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.07); }
        .divider-text { font-size: 0.74rem; color: var(--text-soft); font-weight: 500; }

        .social-row { display: flex; gap: 0.75rem; }
        .btn-social {
          flex: 1; background: var(--dark-3);
          border: 1.5px solid rgba(255,255,255,0.08);
          border-radius: 10px; padding: 0.7rem;
          font-family: 'Inter', sans-serif;
          font-size: 0.82rem; font-weight: 600; color: var(--text-soft);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          transition: border-color 0.2s, color 0.2s, background 0.2s;
        }
        .btn-social:hover { border-color: var(--cyan); color: var(--text); background: var(--dark-2); }

        .spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.25);
          border-top-color: #fff; border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Success */
        .success-screen { text-align: center; animation: fadeUp 0.5s ease both; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .success-circle {
          width: 72px; height: 72px; border-radius: 50%;
          background: linear-gradient(135deg, var(--cyan), var(--magenta));
          display: flex; align-items: center; justify-content: center;
          font-size: 2rem; margin: 0 auto 1.25rem;
          box-shadow: 0 8px 32px rgba(0,174,239,0.4);
        }
        .success-title {
          font-size: 1.8rem; font-weight: 800;
          color: var(--text); margin-bottom: 0.6rem;
          letter-spacing: -0.02em;
        }
        .success-desc {
          font-size: 0.9rem; color: var(--text-soft);
          line-height: 1.75; margin-bottom: 2rem;
        }

        .error-box {
          background: rgba(236,0,140,0.08);
          border: 1.5px solid rgba(236,0,140,0.25);
          border-radius: 10px; padding: 1rem;
          color: #FF6EC7; margin-bottom: 1.5rem;
          font-size: 0.88rem; display: flex; gap: 0.5rem; align-items: center;
        }

        .form-field-animate { animation: slideIn 0.3s ease both; }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        @media (max-width: 768px) {
          .auth-shell { grid-template-columns: 1fr; }
          .panel-left { display: none; }
          .panel-right { padding: 2.5rem 1.5rem; align-items: flex-start; }
          .form-box { max-width: 100%; }
        }
      `}</style>

      <div className="auth-shell">
        {/* ── LEFT PANEL ── */}
        <div className="panel-left">
          <Link href="/" className="panel-logo">
            <img src="/logo.png" alt="Frankstat" className="logo-img" />
          </Link>

          <div className="panel-middle">
            <h1 className="panel-tagline">
              Your prints.<br />
              <span className="c">Delivered</span> <span className="y">fast.</span><br />
              <span className="m">Every time.</span>
            </h1>
            <p className="panel-sub">
              Join businesses and event organisers across Nairobi who trust Frankstat for premium printing.
            </p>
            <div className="perks">
              {[
                { icon: "⚡", cls: "c", text: "Real-time order tracking — know exactly when your print is ready" },
                { icon: "💾", cls: "m", text: "Save artwork & reorder in seconds" },
                { icon: "📊", cls: "y", text: "Full order history with receipts & invoices" },
                { icon: "🎁", cls: "g", text: "Members get exclusive discounts & early access" },
              ].map((p) => (
                <div key={p.text} className="perk">
                  <div className={`perk-icon ${p.cls}`}>{p.icon}</div>
                  <div className="perk-text">{p.text}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel-bottom">
            <p className="panel-bottom-text">© {new Date().getFullYear()} Frankstat Printing Solutions · Nairobi, Kenya</p>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="panel-right">
          <div className="form-box">

            {done ? (
              <div className="success-screen">
                <div className="success-circle">✓</div>
                <div className="success-title">Account Created!</div>
                <p className="success-desc">
                  Welcome to Frankstat, <strong>{form.fullName.split(" ")[0]}</strong>!<br />
                  We've sent a verification link to <strong>{form.email}</strong>.<br />
                  Check your inbox to activate your account.
                </p>
                <Link href="/login">
                  <button className="btn-full" style={{ marginTop: 0 }}>Go to Sign In →</button>
                </Link>
              </div>
            ) : (
              <>
                <div className="accent-bar" />
                <div className="form-eyebrow">
                  {step === 1 ? "Step 1 of 2 — Personal Info" : "Step 2 of 2 — Secure Your Account"}
                </div>
                <div className="form-title">
                  {step === 1 ? "Create Account" : "Set Password"}
                </div>
                <p className="form-subtitle">
                  Already have an account?{" "}
                  <Link href="/login">Sign in here</Link>
                </p>

                {/* Step bar */}
                <div className="steps-wrap">
                  <div className="steps">
                    <div className={`step-dot ${step === 1 ? "active" : "done"}`}>{step > 1 ? "✓" : "1"}</div>
                    <div className={`step-line ${step > 1 ? "done" : ""}`} />
                    <div className={`step-dot ${step === 2 ? "active" : ""}`}>2</div>
                  </div>
                  <div className="steps-labels">
                    <span className={`step-label ${step === 1 ? "active" : ""}`}>Your Details</span>
                    <span className={`step-label ${step === 2 ? "active" : ""}`}>Password</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                  {/* ── STEP 1 ── */}
                  {step === 1 && (
                    <div className="form-field-animate">
                      <div className="field">
                        <label className="label">Full Name</label>
                        <input className={`input${errors.fullName ? " has-error" : ""}`}
                          type="text" placeholder="e.g. Aisha Kamau"
                          value={form.fullName} onChange={(e) => set("fullName", e.target.value)} autoFocus />
                        {errors.fullName && <div className="err">⚠ {errors.fullName}</div>}
                      </div>

                      <div className="field">
                        <label className="label">Email Address</label>
                        <input className={`input${errors.email ? " has-error" : ""}`}
                          type="email" placeholder="you@example.com"
                          value={form.email} onChange={(e) => set("email", e.target.value)} />
                        {errors.email && <div className="err">⚠ {errors.email}</div>}
                      </div>

                      <div className="field">
                        <label className="label">M-Pesa / Phone Number</label>
                        <div className="input-wrap">
                          <span className="prefix">+254</span>
                          <input className={`input has-prefix${errors.phone ? " has-error" : ""}`}
                            type="tel" placeholder="7XX XXX XXX" maxLength={9}
                            value={form.phone}
                            onChange={(e) => set("phone", e.target.value.replace(/\D/g, ""))} />
                        </div>
                        {errors.phone && <div className="err">⚠ {errors.phone}</div>}
                      </div>

                      <button type="button" className="btn-full" onClick={handleNext}>Continue →</button>

                      <div className="divider">
                        <div className="divider-line" />
                        <div className="divider-text">or sign up with</div>
                        <div className="divider-line" />
                      </div>
                      <div className="social-row">
                        <button type="button" className="btn-social">G&nbsp; Google</button>
                        <button type="button" className="btn-social">f&nbsp; Facebook</button>
                      </div>
                    </div>
                  )}

                  {/* ── STEP 2 ── */}
                  {step === 2 && (
                    <div className="form-field-animate">
                      {errors.general && (
                        <div className="error-box">⚠ {errors.general}</div>
                      )}

                      <div className="field">
                        <label className="label">Password</label>
                        <div className="input-wrap">
                          <input className={`input${errors.password ? " has-error" : ""}`}
                            type={showPass ? "text" : "password"} placeholder="Min. 8 characters"
                            value={form.password} onChange={(e) => set("password", e.target.value)} autoFocus />
                          <button type="button" className="toggle-pass" onClick={() => setShowPass((s) => !s)}>
                            {showPass ? "🙈" : "👁"}
                          </button>
                        </div>
                        {form.password && (
                          <>
                            <div className="strength-bar">
                              {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="strength-seg"
                                  style={{ background: i <= passwordStrength ? strengthColor : undefined }} />
                              ))}
                            </div>
                            <div className="strength-label" style={{ color: strengthColor }}>{strengthLabel}</div>
                          </>
                        )}
                        {errors.password && <div className="err">⚠ {errors.password}</div>}
                      </div>

                      <div className="field">
                        <label className="label">Confirm Password</label>
                        <div className="input-wrap">
                          <input className={`input${errors.confirm ? " has-error" : ""}`}
                            type={showConfirm ? "text" : "password"} placeholder="Repeat your password"
                            value={form.confirm} onChange={(e) => set("confirm", e.target.value)} />
                          <button type="button" className="toggle-pass" onClick={() => setShowConfirm((s) => !s)}>
                            {showConfirm ? "🙈" : "👁"}
                          </button>
                        </div>
                        {form.confirm && !errors.confirm && form.password === form.confirm && (
                          <div style={{ fontSize: "0.74rem", color: "#4EE59B", marginTop: "0.3rem", fontWeight: 600 }}>✓ Passwords match</div>
                        )}
                        {errors.confirm && <div className="err">⚠ {errors.confirm}</div>}
                      </div>

                      <div className="field">
                        <label className="check-wrap" onClick={() => set("agree", !form.agree)}>
                          <div className={`check-box${form.agree ? " checked" : ""}`}>
                            {form.agree && <span style={{ color: "white", fontSize: "0.65rem" }}>✓</span>}
                          </div>
                          <span className="check-text">
                            I agree to the{" "}
                            <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Terms of Service</a>
                            {" "}and{" "}
                            <a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Privacy Policy</a>
                          </span>
                        </label>
                        {errors.agree && <div className="err">⚠ {errors.agree}</div>}
                      </div>

                      <div className="btn-row">
                        <button type="button" className="btn-back" onClick={() => { setStep(1); setErrors({}); }}>← Back</button>
                        <button type="submit" className="btn-full" disabled={loading}>
                          {loading ? <div className="spinner" /> : "Create Account 🎉"}
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

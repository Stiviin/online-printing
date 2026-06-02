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
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
    agree: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

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
  const strengthColor = ["", "#E05252", "#E09A52", "#C19A4A", "#5A9E6F"][passwordStrength];

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

  const handleNext = () => {
    if (validateStep1()) setStep(2);
  };

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!validateStep2()) return;

  setLoading(true);
  
  try {
  const response = await fetch("/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    fullName: form.fullName,
    email: form.email,
    phone: form.phone,
    password: form.password,
  }),
});

if (!response.ok) {
  let errorMessage = `Server error (${response.status})`;
  if (response.status === 404) {
    errorMessage = "Registration endpoint not found (/api/auth/register). Please ensure the API route is correctly implemented.";
  } else {
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      // response body not JSON
    }
  }
  console.error("Error:", errorMessage);
  setErrors({ general: errorMessage });
  setLoading(false);
  return;
}

    const data = await response.json();
    console.log("Success:", data);
    // You can proceed after successful registration
    setDone(true);
  } catch (error) {
    console.error("Network or parsing error:", error);
    setErrors({ general: "Network error. Please check your connection and try again." });
    // Show error message to user if needed
  } finally {
    setLoading(false);
  }
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
          --success: #5A9E6F;
        }

        body {
          font-family: 'DM Sans', sans-serif;
          background: var(--white);
          min-height: 100vh;
          display: flex;
          align-items: stretch;
        }

        /* ── LAYOUT ── */
        .auth-shell {
          display: grid;
          grid-template-columns: 1fr 1fr;
          min-height: 100vh;
          width: 100%;
        }

        /* ── PANEL LEFT ── */
        .panel-left {
          background: var(--ink);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 3rem;
          position: relative;
          overflow: hidden;
        }
        .panel-left::before {
          content: '';
          position: absolute;
          top: -80px; right: -80px;
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(193,154,74,0.18) 0%, transparent 65%);
          pointer-events: none;
        }
        .panel-left::after {
          content: '';
          position: absolute;
          bottom: -60px; left: -60px;
          width: 320px; height: 320px;
          background: radial-gradient(circle, rgba(193,154,74,0.12) 0%, transparent 65%);
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

        .panel-middle {
          position: relative; z-index: 1;
        }
        .panel-tagline {
          font-family: 'Playfair Display', serif;
          font-size: clamp(1.8rem, 3vw, 2.6rem);
          font-weight: 900;
          color: var(--white);
          line-height: 1.15;
          margin-bottom: 1.2rem;
        }
        .panel-tagline em {
          font-style: italic;
          color: var(--gold);
        }
        .panel-sub {
          font-size: 0.92rem;
          color: #A89070;
          line-height: 1.7;
          max-width: 340px;
          margin-bottom: 2.5rem;
        }

        .perks { display: flex; flex-direction: column; gap: 0.9rem; }
        .perk {
          display: flex; align-items: center; gap: 0.9rem;
        }
        .perk-icon {
          width: 36px; height: 36px; border-radius: 8px;
          background: rgba(193,154,74,0.15);
          display: flex; align-items: center; justify-content: center;
          font-size: 1rem; flex-shrink: 0;
        }
        .perk-text { font-size: 0.86rem; color: #C8B89A; line-height: 1.4; }

        .panel-bottom {
          position: relative; z-index: 1;
        }
        .panel-bottom-text {
          font-size: 0.8rem;
          color: #5C4A38;
        }

        /* ── PANEL RIGHT ── */
        .panel-right {
          background: var(--white);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 3rem 2rem;
        }

        .form-box {
          width: 100%;
          max-width: 420px;
        }

        .form-header { margin-bottom: 2rem; }
        .form-eyebrow {
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--gold);
          margin-bottom: 0.5rem;
        }
        .form-title {
          font-family: 'Playfair Display', serif;
          font-size: 2rem;
          font-weight: 900;
          color: var(--ink);
          line-height: 1.1;
          margin-bottom: 0.4rem;
        }
        .form-subtitle {
          font-size: 0.88rem;
          color: var(--ink-soft);
        }
        .form-subtitle a {
          color: var(--gold);
          text-decoration: none;
          font-weight: 600;
        }
        .form-subtitle a:hover { text-decoration: underline; }

        /* Steps indicator */
        .steps {
          display: flex;
          align-items: center;
          gap: 0;
          margin-bottom: 2rem;
        }
        .step-dot {
          width: 28px; height: 28px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.75rem; font-weight: 700;
          transition: all 0.3s;
          border: 2px solid var(--cream-border);
          color: #A89070;
          background: var(--white);
        }
        .step-dot.active {
          background: var(--ink);
          border-color: var(--ink);
          color: var(--white);
        }
        .step-dot.done {
          background: var(--gold);
          border-color: var(--gold);
          color: var(--white);
        }
        .step-line {
          flex: 1;
          height: 2px;
          background: var(--cream-border);
          transition: background 0.3s;
          margin: 0 0.4rem;
        }
        .step-line.done { background: var(--gold); }
        .step-label {
          font-size: 0.7rem;
          color: #A89070;
          font-weight: 500;
        }
        .step-label.active { color: var(--ink); font-weight: 600; }
        .steps-wrap {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          margin-bottom: 2rem;
        }
        .steps-labels {
          display: flex;
          justify-content: space-between;
          padding: 0 2px;
        }

        /* Form fields */
        .field { margin-bottom: 1.25rem; }
        .label {
          display: block;
          font-size: 0.74rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ink-soft);
          margin-bottom: 0.45rem;
        }
        .input-wrap { position: relative; }
        .input {
          width: 100%;
          background: var(--off);
          border: 1.5px solid var(--cream-border);
          border-radius: 8px;
          padding: 0.8rem 1rem;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.95rem;
          color: var(--ink);
          transition: border-color 0.2s, background 0.2s;
          outline: none;
        }
        .input:focus {
          border-color: var(--gold);
          background: var(--white);
        }
        .input.has-error { border-color: var(--error); }
        .input.has-prefix { padding-left: 3.4rem; }
        .prefix {
          position: absolute; left: 1rem; top: 50%;
          transform: translateY(-50%);
          font-size: 0.9rem; font-weight: 600;
          color: #A89070; pointer-events: none;
        }
        .toggle-pass {
          position: absolute; right: 0.9rem; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          cursor: pointer; font-size: 1rem;
          opacity: 0.5; transition: opacity 0.2s;
          padding: 0;
        }
        .toggle-pass:hover { opacity: 1; }
        .err { font-size: 0.75rem; color: var(--error); margin-top: 0.3rem; }

        /* Password strength */
        .strength-bar {
          display: flex; gap: 3px; margin-top: 0.5rem;
        }
        .strength-seg {
          flex: 1; height: 3px; border-radius: 99px;
          background: var(--cream-border);
          transition: background 0.3s;
        }
        .strength-label {
          font-size: 0.72rem; font-weight: 600;
          margin-top: 0.25rem;
          transition: color 0.3s;
        }

        /* Checkbox */
        .check-wrap {
          display: flex; align-items: flex-start; gap: 0.75rem;
          cursor: pointer;
        }
        .check-box {
          width: 18px; height: 18px; border-radius: 4px;
          border: 1.5px solid var(--cream-border);
          background: var(--off);
          flex-shrink: 0; margin-top: 1px;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
          cursor: pointer;
        }
        .check-box.checked {
          background: var(--ink);
          border-color: var(--ink);
        }
        .check-text {
          font-size: 0.82rem; color: var(--ink-soft); line-height: 1.5;
        }
        .check-text a { color: var(--gold); text-decoration: none; font-weight: 600; }
        .check-text a:hover { text-decoration: underline; }

        /* Buttons */
        .btn-full {
          width: 100%;
          background: var(--ink);
          color: var(--white);
          border: none;
          border-radius: 8px;
          padding: 0.9rem;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.95rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: background 0.2s, transform 0.15s;
          margin-top: 0.5rem;
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
        }
        .btn-full:hover { background: #3D2B1A; transform: translateY(-1px); }
        .btn-full:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        .btn-back {
          background: none; border: 1.5px solid var(--cream-border);
          color: var(--ink-soft); border-radius: 8px;
          padding: 0.85rem 1.5rem;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.9rem; font-weight: 600;
          cursor: pointer; transition: border-color 0.2s, color 0.2s;
        }
        .btn-back:hover { border-color: var(--ink); color: var(--ink); }

        .btn-row { display: flex; gap: 0.8rem; margin-top: 0.5rem; }
        .btn-row .btn-full { flex: 1; margin-top: 0; }

        /* Divider */
        .divider {
          display: flex; align-items: center; gap: 0.8rem;
          margin: 1.5rem 0;
        }
        .divider-line { flex: 1; height: 1px; background: var(--cream-border); }
        .divider-text { font-size: 0.75rem; color: #A89070; font-weight: 500; }

        /* Social login */
        .social-row { display: flex; gap: 0.8rem; }
        .btn-social {
          flex: 1;
          background: var(--off);
          border: 1.5px solid var(--cream-border);
          border-radius: 8px;
          padding: 0.7rem;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--ink);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          transition: border-color 0.2s, background 0.2s;
        }
        .btn-social:hover { border-color: var(--gold); background: var(--white); }

        /* Spinner */
        .spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: var(--white);
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Success */
        .success-screen {
          text-align: center;
          animation: fadeUp 0.5s ease both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .success-circle {
          width: 72px; height: 72px; border-radius: 50%;
          background: linear-gradient(135deg, #5A9E6F, #3D7A55);
          display: flex; align-items: center; justify-content: center;
          font-size: 2rem; margin: 0 auto 1.2rem;
          box-shadow: 0 8px 24px rgba(90,158,111,0.35);
        }
        .success-title {
          font-family: 'Playfair Display', serif;
          font-size: 1.8rem; font-weight: 900;
          color: var(--ink); margin-bottom: 0.6rem;
        }
        .success-desc {
          font-size: 0.9rem; color: var(--ink-soft);
          line-height: 1.7; margin-bottom: 2rem;
        }

        .error-box {
          background: #FFF0EE;
          border: 1.5px solid #F5C6C0;
          border-radius: 10px;
          padding: 1rem;
          color: var(--error);
          margin-bottom: 1.5rem;
          font-size: 0.88rem;
          display: flex; gap: 0.5rem; align-items: center;
        }

        /* Floating label animation */
        .form-field-animate {
          animation: slideIn 0.3s ease both;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: translateX(0); }
        }

        /* Mobile */
        @media (max-width: 768px) {
          .auth-shell { grid-template-columns: 1fr; }
          .panel-left { display: none; }
          .panel-right { padding: 2rem 1.5rem; align-items: flex-start; padding-top: 2.5rem; }
          .form-box { max-width: 100%; }
        }
      `}</style>

      <div className="auth-shell">
        {/* ── LEFT PANEL ── */}
        <div className="panel-left">
          <Link href="/" className="panel-logo">FRANK<span>STAT</span></Link>

          <div className="panel-middle">
            <h1 className="panel-tagline">
              Your prints.<br />
              <em>Delivered fast.</em>
            </h1>
            <p className="panel-sub">
              Join thousands of businesses and event organisers who trust Frankstat for premium printing across Nairobi.
            </p>
            <div className="perks">
              {[
                { icon: "⚡", text: "Order tracking — know exactly when your print is ready" },
                { icon: "💾", text: "Save your artwork & reorder in seconds" },
                { icon: "📊", text: "Full order history with receipts & invoices" },
                { icon: "🎁", text: "Members get exclusive discounts & early access" },
              ].map((p) => (
                <div key={p.text} className="perk">
                  <div className="perk-icon">{p.icon}</div>
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
              /* ── SUCCESS STATE ── */
              <div className="success-screen">
                <div className="success-circle">✓</div>
                <div className="success-title">Account Created!</div>
                <p className="success-desc">
                  Welcome to Frankstat, <strong>{form.fullName.split(" ")[0]}</strong>!<br />
                  We've sent a verification link to <strong>{form.email}</strong>.<br />
                  Check your inbox to activate your account.
                </p>
                <Link href="/login">
                  <button className="btn-full" style={{ marginTop: 0 }}>Go to Login →</button>
                </Link>
              </div>
            ) : (
              <>
                <div className="form-header">
                  <div className="form-eyebrow">
                    {step === 1 ? "Step 1 of 2 — Personal Info" : "Step 2 of 2 — Secure Your Account"}
                  </div>
                  <h2 className="form-title">
                    {step === 1 ? "Create Account" : "Set Password"}
                  </h2>
                  <p className="form-subtitle">
                    Already have an account?{" "}
                    <Link href="/login">Sign in here</Link>
                  </p>
                </div>

                {/* Steps bar */}
                <div className="steps-wrap">
                  <div className="steps">
                    <div className={`step-dot ${step === 1 ? "active" : "done"}`}>
                      {step > 1 ? "✓" : "1"}
                    </div>
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
                        <input
                          className={`input${errors.fullName ? " has-error" : ""}`}
                          type="text" placeholder="e.g. Aisha Kamau"
                          value={form.fullName}
                          onChange={(e) => set("fullName", e.target.value)}
                          autoFocus
                        />
                        {errors.fullName && <div className="err">⚠ {errors.fullName}</div>}
                      </div>

                      <div className="field">
                        <label className="label">Email Address</label>
                        <input
                          className={`input${errors.email ? " has-error" : ""}`}
                          type="email" placeholder="you@example.com"
                          value={form.email}
                          onChange={(e) => set("email", e.target.value)}
                        />
                        {errors.email && <div className="err">⚠ {errors.email}</div>}
                      </div>

                      <div className="field">
                        <label className="label">M-Pesa / Phone Number</label>
                        <div className="input-wrap">
                          <span className="prefix">+254</span>
                          <input
                            className={`input has-prefix${errors.phone ? " has-error" : ""}`}
                            type="tel" placeholder="7XX XXX XXX"
                            maxLength={9}
                            value={form.phone}
                            onChange={(e) => set("phone", e.target.value.replace(/\D/g, ""))}
                          />
                        </div>
                        {errors.phone && <div className="err">⚠ {errors.phone}</div>}
                      </div>

                      <button type="button" className="btn-full" onClick={handleNext}>
                        Continue →
                      </button>

                      <div className="divider">
                        <div className="divider-line" />
                        <div className="divider-text">or sign up with</div>
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
                    </div>
                  )}

                  {/* ── STEP 2 ── */}
                  {step === 2 && (
                    <div className="form-field-animate">
                      <div className="field">
                        <label className="label">Password</label>
                        <div className="input-wrap">
                          <input
                            className={`input${errors.password ? " has-error" : ""}`}
                            type={showPass ? "text" : "password"}
                            placeholder="Min. 8 characters"
                            value={form.password}
                            onChange={(e) => set("password", e.target.value)}
                            autoFocus
                          />
                          <button type="button" className="toggle-pass" onClick={() => setShowPass((s) => !s)}>
                            {showPass ? "🙈" : "👁️"}
                          </button>
                        </div>
                        {form.password && (
                          <>
                            <div className="strength-bar">
                              {[1, 2, 3, 4].map((i) => (
                                <div
                                  key={i}
                                  className="strength-seg"
                                  style={{ background: i <= passwordStrength ? strengthColor : undefined }}
                                />
                              ))}
                            </div>
                            <div className="strength-label" style={{ color: strengthColor }}>
                              {strengthLabel}
                            </div>
                          </>
                        )}
                        {errors.password && <div className="err">⚠ {errors.password}</div>}
                      </div>

                      <div className="field">
                        <label className="label">Confirm Password</label>
                        <div className="input-wrap">
                          <input
                            className={`input${errors.confirm ? " has-error" : ""}`}
                            type={showConfirm ? "text" : "password"}
                            placeholder="Repeat your password"
                            value={form.confirm}
                            onChange={(e) => set("confirm", e.target.value)}
                          />
                          <button type="button" className="toggle-pass" onClick={() => setShowConfirm((s) => !s)}>
                            {showConfirm ? "🙈" : "👁️"}
                          </button>
                        </div>
                        {form.confirm && !errors.confirm && form.password === form.confirm && (
                          <div style={{ fontSize: "0.75rem", color: "#5A9E6F", marginTop: "0.3rem" }}>✓ Passwords match</div>
                        )}
                        {errors.confirm && <div className="err">⚠ {errors.confirm}</div>}
                      </div>

                      <div className="field">
                        <label className="check-wrap" onClick={() => set("agree", !form.agree)}>
                          <div className={`check-box${form.agree ? " checked" : ""}`}>
                            {form.agree && <span style={{ color: "white", fontSize: "0.7rem" }}>✓</span>}
                          </div>
                          <span className="check-text">
                            I agree to the{" "}
                            <a href="#" onClick={(e) => e.stopPropagation()}>Terms of Service</a>
                            {" "}and{" "}
                            <a href="#" onClick={(e) => e.stopPropagation()}>Privacy Policy</a>
                          </span>
                        </label>
                        {errors.agree && <div className="err">⚠ {errors.agree}</div>}
                      </div>

                      <div className="btn-row">
                        <button type="button" className="btn-back" onClick={() => { setStep(1); setErrors({}); }}>
                          ← Back
                        </button>
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

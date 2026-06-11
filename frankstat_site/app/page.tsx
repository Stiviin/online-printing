/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────
type User = {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  role: string;
};

type Service = {
  id: string;
  name: string;
  icon: string;
  description: string;
  pricingType: "dimension" | "quantity";
};

type Dimension = { label: string; price: number };
type Review = { name: string; role: string; text: string; rating: number };
type PortfolioItem = { title: string; category: string; color: string; image: string };

type OrderStatus =
  | "idle"
  | "submitting"
  | "awaiting_payment"
  | "confirmed"
  | "error";

// ─── Static data ──────────────────────────────────────────────────────────────
const SERVICES: Service[] = [
  { id: "banners",        name: "Banners",               icon: "🏳️", description: "Large-format vinyl banners for indoor & outdoor events, shops, and promotions.",       pricingType: "dimension" },
  { id: "posters",        name: "Posters",               icon: "🖼️", description: "High-resolution posters on glossy or matte finish for advertising and décor.",         pricingType: "dimension" },
  { id: "signage",        name: "2D | 3D Signage",       icon: "📌", description: "Custom flat and dimensional signs for businesses, offices, and retail spaces.",         pricingType: "quantity"  },
  { id: "sublimation",    name: "Sublimation",           icon: "👕", description: "Full-colour sublimation printing on mugs, jerseys, caps, phone cases & more.",          pricingType: "quantity"  },
  { id: "plotting",       name: "Plotting & Vinyl Cutting", icon: "✂️", description: "Precision-cut vinyl decals, stickers, and vehicle wraps in any shape or colour.",  pricingType: "quantity"  },
  { id: "business-cards", name: "Business Cards",        icon: "💼", description: "Premium business cards – glossy, matte, spot UV, or textured finishes.",                pricingType: "quantity"  },
  { id: "heat-press",     name: "Heat Press",            icon: "🔥", description: "Transfer printing on t-shirts, hoodies, bags, and other fabric items.",                 pricingType: "quantity"  },
  { id: "dtf",            name: "DTF No-Cut",            icon: "🎨", description: "Direct-to-film transfers with vivid colours on any garment without weeding.",           pricingType: "quantity"  },
];

const BANNER_DIMENSIONS: Dimension[] = [
  { label: "1ft × 1ft",   price: 300  },
  { label: "2ft × 1ft",   price: 500  },
  { label: "3ft × 2ft",   price: 900  },
  { label: "4ft × 2ft",   price: 1400 },
  { label: "5ft × 3ft",   price: 2200 },
  { label: "6ft × 3ft",   price: 2800 },
  { label: "8ft × 4ft",   price: 4500 },
  { label: "10ft × 5ft",  price: 7000 },
  { label: "Custom",      price: 0    },
];

const POSTER_DIMENSIONS: Dimension[] = [
  { label: "A4 (21×29.7cm)",    price: 150  },
  { label: "A3 (29.7×42cm)",    price: 250  },
  { label: "A2 (42×59.4cm)",    price: 450  },
  { label: "A1 (59.4×84.1cm)",  price: 800  },
  { label: "A0 (84.1×118.9cm)", price: 1400 },
  { label: "18×24 in",          price: 600  },
  { label: "24×36 in",          price: 1100 },
  { label: "Custom",            price: 0    },
];

const QUANTITY_PRICING: Record<string, { base: number; unit: string }> = {
  signage:          { base: 1500, unit: "piece"    },
  sublimation:      { base: 2,  unit: "piece"    },
  plotting:         { base: 200,  unit: "sq ft"    },
  "business-cards": { base: 800,  unit: "100 cards"},
  "heat-press":     { base: 300,  unit: "piece"    },
  dtf:              { base: 250,  unit: "piece"    },
};

const REVIEWS: Review[] = [
  { name: "Aisha Kamau",    role: "Event Organiser, Nairobi",  text: "Frankstat delivered 50 banners overnight for our conference. Absolutely stunning quality — every colour popped perfectly!", rating: 5 },
  { name: "Brian Otieno",   role: "Retail Shop Owner",         text: "My shop signage looks incredible. The 3D letters really make the facade stand out. Customers keep complimenting it.", rating: 5 },
  { name: "Cynthia Wanjiku",role: "HR Manager, Safaricom",     text: "We order branded merchandise quarterly. Frankstat's sublimation work is consistently world-class. Never missed a deadline.", rating: 5 },
  { name: "David Mwangi",   role: "Startup Founder",           text: "Got 500 business cards with spot UV. Feels premium, looks premium. My clients always ask where I printed them.", rating: 5 },
];

const PORTFOLIO: PortfolioItem[] = [
  { title: "Event Banners",                    category: "Banners",       color: "#00AEEF", image: "/banners.png" },
  { title: "Outdoor 3D Signage",               category: "3D Signage",    color: "#EC008C", image: "/3d-signage.png" },
  { title: "Local Team Jersey Set – 200 pcs",  category: "Sublimation",   color: "#00AEEF", image: "/sublimation.png" },
  { title: "Food Court Vinyl Wraps",           category: "Vinyl Cutting",  color: "#EC008C", image: "/vinyl.png" },
  { title: "Tech Startup Vinyls",              category: "Vinyl Cutting",  color: "#FFE500", image: "/vinyl.png" },
  { title: "School Sports Kit – Heat Press",   category: "Heat Press",    color: "#00AEEF", image: "/heat-press.png" },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function FrankstatPage() {
  const router = useRouter();

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Banner state
  const [banner, setBanner] = useState<{ isActive: boolean; items: string[] } | null>(null);

  // UI state
  const [activeReview, setActiveReview] = useState(0);

  // Order form state
  const [formData, setFormData] = useState({
    service: "",
    dimension: "",
    customW: "",
    customH: "",
    quantity: 1,
    paperType: "glossy",
    imageFile: null as File | null,
    mpesa: "",
    notes: "",
  });
  const [totalPrice, setTotalPrice] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [orderStatus, setOrderStatus] = useState<OrderStatus>("idle");
  const [orderError, setOrderError] = useState("");
  const [orderId, setOrderId] = useState("");
  const [orderMessage, setOrderMessage] = useState("");

  const formRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);


  // ── Fetch current user ───────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setUser(d.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/banner")
      .then((r) => r.json())
      .then((d) => setBanner(d))
      .catch(() => {});
  }, []);

  // Auto-fill phone from profile if available
  useEffect(() => {
    if (user?.phone && !formData.mpesa) {
      const stripped = user.phone.replace(/^(\+?254|0)/, "");
      setFormData((f) => ({ ...f, mpesa: stripped }));
    }
  }, [user]); // intentionally omit formData.mpesa to avoid loop

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auto-scroll reviews
  useEffect(() => {
    const t = setInterval(() => setActiveReview((p) => (p + 1) % REVIEWS.length), 4000);
    return () => clearInterval(t);
  }, []);

  // Pricing calculator
  useEffect(() => {
    const svc = SERVICES.find((s) => s.id === formData.service);
    if (!svc) { setTotalPrice(0); setDeposit(0); return; }

    let unit = 0;
    if (svc.pricingType === "dimension") {
      const dims = svc.id === "banners" ? BANNER_DIMENSIONS : POSTER_DIMENSIONS;
      const dim = dims.find((d) => d.label === formData.dimension);
      unit = dim?.price ?? 0;
    } else {
      unit = QUANTITY_PRICING[svc.id]?.base ?? 0;
    }

    const total = unit * formData.quantity;
    setTotalPrice(total);
    setDeposit(Math.ceil(total / 2));
  }, [formData.service, formData.dimension, formData.quantity]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const selectedService = SERVICES.find((s) => s.id === formData.service);
  const dimensions = formData.service === "banners" ? BANNER_DIMENSIONS : POSTER_DIMENSIONS;

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  const handleOrderClick = (serviceId: string) => {
    setFormData((f) => ({ ...f, service: serviceId }));
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setUserMenuOpen(false);
    router.refresh();
  };

  const getUserInitials = (fullName: string): string => {
    return fullName
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("");
  };
     
    const [payFull, setPayFull] = useState(false);
    const [chargeAmount, setChargeAmount] = useState(0);
    const [paymentType,  setPaymentType]  = useState<"DEPOSIT"|"FULL">("DEPOSIT");

  // ── Order submit ─────────────────────────────────────────────────────────
 const handleSubmit = useCallback(async (e: React.FormEvent) => {
  e.preventDefault();
  if (!user) { router.push("/login"); return; }
  setOrderError(""); setOrderStatus("submitting");
   

      const data = new FormData();
  data.append("service",   formData.service);
  data.append("dimension", formData.dimension);
  data.append("quantity",  formData.quantity.toString());
  data.append("paperType", formData.paperType);
  data.append("mpesa",     formData.mpesa);
  data.append("notes",     formData.notes);
  data.append("payFull",   payFull ? "true" : "false");    // ← NEW
  data.append("customW",   formData.customW);
  data.append("customH",   formData.customH);
  if (formData.imageFile) data.append("imageFile", formData.imageFile);

      try {
    const res  = await fetch("/api/orders", { method: "POST", body: data });
    const json = await res.json();
    if (!res.ok) { setOrderError(json.error ?? "Failed. Please try again."); setOrderStatus("error"); return; }
    setOrderId(json.orderId);
    setOrderMessage(json.customerMessage ?? "Check your phone for the M-Pesa prompt.");
    setChargeAmount(json.chargeAmount);
    setPaymentType(json.paymentType);       // "DEPOSIT" | "FULL"
    setOrderStatus("awaiting_payment");
  } catch {
    setOrderError("Network error. Check your connection and try again.");
    setOrderStatus("error");
  }
}, [formData, payFull, user, router]);

  const resetForm = () => {
    setFormData({
      service: "",
      dimension: "",
      customW: "",
      customH: "",
      quantity: 1,
      paperType: "glossy",
      imageFile: null,
      mpesa: user?.phone ? user.phone.replace(/^(\+?254|0)/, "") : "",
      notes: "",
    });
    setOrderStatus("idle");
    setOrderError("");
    setOrderId("");
    setOrderMessage("");
    setTotalPrice(0);
    setDeposit(0);
  };

  const isSubmitDisabled =
    orderStatus === "submitting" ||
    !formData.service ||
    (["banners", "posters"].includes(formData.service) && !formData.dimension) ||
    !formData.mpesa ||
    formData.mpesa.length < 9 ||
    !formData.imageFile;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }

        :root {
          --black: #000000;
          --white: #FFFFFF;
          --off: #F4FCFF;
          --ink: #111827;
          --ink-soft: #374151;
          --cyan: #00AEEF;
          --cyan-dark: #0087C0;
          --cyan-light: #7DD8F5;
          --magenta: #EC008C;
          --magenta-dark: #B5006B;
          --magenta-light: #F566BA;
          --yellow: #FFE500;
          --yellow-dark: #CCB800;
          --cream: #E0F5FD;
          --cream-border: #BAE6F8;
          --error: #DC2626;
          --success: #059669;
          --navy: #050B14;
        }

        body {
          font-family: 'DM Sans', sans-serif;
          background: var(--white);
          color: var(--ink);
        }

        /* ── NAV ── */
        .nav {
          position: sticky; top: 0; z-index: 100;
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--cream-border);
          display: flex; align-items: center;
          padding: 0 2rem; height: 64px;
          gap: 2rem;
        }
        .nav-logo {
          font-family: 'Playfair Display', serif;
          font-size: 1.4rem; font-weight: 900;
          color: var(--ink); letter-spacing: -0.02em;
          text-decoration: none; flex-shrink: 0;
        }
        .nav-logo span { color: var(--gold); }
        .nav-links {
          display: flex; list-style: none; gap: 0.2rem;
          flex: 1;
        }
        .nav-links li a {
          font-size: 0.85rem; font-weight: 500;
          color: var(--ink-soft); padding: 0.4rem 0.75rem;
          border-radius: 6px; cursor: pointer;
          text-transform: capitalize; transition: color 0.2s, background 0.2s;
          text-decoration: none;
        }
        .nav-links li a:hover { color: var(--cyan); background: rgba(0,174,239,0.07); }

        .nav-right { display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; }

        .nav-cta {
          background: var(--ink); color: var(--white);
          border: none; border-radius: 7px;
          padding: 0.5rem 1.1rem;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.85rem; font-weight: 700;
          cursor: pointer; transition: background 0.2s;
          white-space: nowrap; text-decoration: none;
          display: inline-flex; align-items: center;
        }
        .nav-cta:hover { background: #1F2937; }

        .nav-signup {
          background: linear-gradient(135deg, #EC008C, #B5006B);
          color: var(--white);
          border: none; border-radius: 7px;
          padding: 0.5rem 1.1rem;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.85rem; font-weight: 700;
          cursor: pointer; transition: opacity 0.2s, transform 0.15s;
          white-space: nowrap; text-decoration: none;
          display: inline-flex; align-items: center;
          box-shadow: 0 2px 10px rgba(236,0,140,0.35);
        }
        .nav-signup:hover { opacity: 0.9; transform: translateY(-1px); }

        /* User menu */
        .user-menu-wrap { position: relative; }
        .user-avatar-btn {
          width: 36px; height: 36px; border-radius: 50%;
          background: linear-gradient(135deg, #00AEEF, #0087C0);
          color: var(--white);
          border: none; cursor: pointer;
          font-family: 'Playfair Display', serif;
          font-size: 0.95rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          transition: opacity 0.2s, transform 0.15s; position: relative;
          box-shadow: 0 2px 8px rgba(0,174,239,0.4);
        }
        .user-avatar-btn:hover { opacity: 0.85; transform: scale(1.05); }
        .user-avatar-btn::after {
          content: ''; position: absolute; bottom: -2px; right: -2px;
          width: 10px; height: 10px; border-radius: 50%;
          background: #059669; border: 2px solid #fff;
        }
        .user-dropdown {
          position: absolute; top: calc(100% + 10px); right: 0;
          background: var(--white);
          border: 1px solid var(--cream-border);
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
          padding: 0.5rem;
          min-width: 210px;
          animation: fadeDown 0.15s ease both;
          z-index: 200;
        }
        @keyframes fadeDown {
          from { opacity:0; transform: translateY(-6px); }
          to { opacity:1; transform: translateY(0); }
        }
        .user-dropdown-name {
          padding: 0.6rem 0.8rem 0.4rem;
          font-size: 0.82rem; font-weight: 700; color: var(--ink);
        }
        .user-dropdown-email {
          padding: 0 0.8rem 0.6rem;
          font-size: 0.75rem; color: var(--ink-soft);
          border-bottom: 1px solid var(--cream-border);
          margin-bottom: 0.4rem;
        }
        .dropdown-item {
          display: flex; align-items: center; gap: 0.6rem;
          padding: 0.55rem 0.8rem; border-radius: 7px;
          font-size: 0.83rem; color: var(--ink-soft);
          cursor: pointer; transition: background 0.15s;
          background: none; border: none; width: 100%;
          font-family: 'DM Sans', sans-serif;
          text-align: left; text-decoration: none;
        }
        .dropdown-item:hover { background: var(--off); color: var(--ink); }
        .dropdown-item.danger { color: var(--error); }
        .dropdown-item.danger:hover { background: #FFF0EE; }

        .hamburger {
          display: none; flex-direction: column; gap: 4px;
          background: none; border: none; cursor: pointer; padding: 4px;
        }
        .hamburger span {
          display: block; width: 22px; height: 2px;
          background: var(--ink); border-radius: 2px;
          transition: 0.2s;
        }
        .mobile-menu {
          display: none; flex-direction: column; gap: 0.3rem;
          background: var(--white); padding: 1rem 1.5rem 1.5rem;
          border-bottom: 1px solid var(--cream-border);
        }
        .mobile-menu.open { display: flex; }
        .mobile-menu a {
          font-size: 0.95rem; font-weight: 500; color: var(--ink-soft);
          padding: 0.5rem 0; cursor: pointer; text-transform: capitalize;
          text-decoration: none;
        }
        .mobile-menu a:hover { color: var(--cyan); }

        /* ── OFFER BANNER ── */
        .offer-banner {
          background: linear-gradient(90deg, #0087C0 0%, #00AEEF 30%, #EC008C 70%, #B5006B 100%);
          overflow: hidden;
          padding: 0.55rem 0;
        }
        .offer-ticker {
          display: flex; gap: 4rem;
          animation: ticker 28s linear infinite;
          white-space: nowrap;
        }
        .offer-ticker span { font-size: 0.78rem; color: #fff; font-weight: 600; }
        @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }

        /* ── HERO ── */
        .hero {
          display: grid; grid-template-columns: 1fr 1fr;
          min-height: 88vh; align-items: center;
          padding: 4rem 5vw; gap: 4rem;
          background: linear-gradient(135deg, #FFE500, #050B14 0%, #090F1C 35%, #050B14 100%);
          position: relative; overflow: hidden;
        }
        /* Cyan radial glow top-right */
        .hero::before {
          content: '';
          position: absolute; top: -25%; right: 5%;
          width: 520px; height: 520px;
          background: radial-gradient(circle, rgba(0,174,239,0.18) 0%, rgba(0,174,239,0.04) 50%, transparent 70%);
          border-radius: 50%; pointer-events: none;
        }
        /* Magenta glow bottom-left */
        .hero::after {
          content: '';
          position: absolute; bottom: -15%; left: -5%;
          width: 380px; height: 380px;
          background: radial-gradient(circle, rgba(236,0,140,0.14) 0%, transparent 65%);
          border-radius: 50%; pointer-events: none;
        }
        .hero-eyebrow {
          display: inline-block;
          background: rgba(0,174,239,0.12);
          border: 1px solid rgba(0,174,239,0.4);
          color: var(--cyan-light); font-size: 0.75rem;
          font-weight: 700; letter-spacing: 0.18em;
          text-transform: uppercase;
          padding: 0.35rem 0.9rem; border-radius: 99px;
          margin-bottom: 1.2rem;
        }
        .hero h1 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(2.4rem, 5vw, 3.8rem);
          font-weight: 900; line-height: 1.1;
          color: #FFFFFF; margin-bottom: 1.2rem;
        }
        .hero h1 em {
          font-style: italic;
          background: linear-gradient(90deg, #FFE500, #00AEEF, #EC008C);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-desc { font-size: 1.05rem; color: rgba(255,255,255,0.68); line-height: 1.8; margin-bottom: 2rem; max-width: 480px; }
        .hero-btns { display: flex; gap: 0.9rem; flex-wrap: wrap; margin-bottom: 2rem; }
        .btn-primary {
          background: linear-gradient(135deg, #00AEEF 0%, #0087C0 100%);
          color: var(--white);
          padding: 0.85rem 1.8rem; border: none; border-radius: 8px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.95rem; font-weight: 700;
          cursor: pointer; transition: opacity 0.2s, transform 0.15s;
          box-shadow: 0 4px 18px rgba(0,174,239,0.45);
        }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,174,239,0.5); }
        .btn-secondary {
          background: transparent; color: var(--ink);
          padding: 0.85rem 1.8rem;
          border: 2px solid #D1D5DB; border-radius: 8px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.95rem; font-weight: 600;
          cursor: pointer; transition: border-color 0.2s, background 0.2s, color 0.2s;
        }
        .btn-secondary:hover { border-color: var(--cyan); background: rgba(0,174,239,0.06); color: var(--cyan-dark); }
        /* Override btn-secondary inside the dark hero */
        .hero .btn-secondary {
          background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.9);
          border-color: rgba(255,255,255,0.2); backdrop-filter: blur(4px);
        }
        .hero .btn-secondary:hover { border-color: var(--cyan); background: rgba(0,174,239,0.15); color: var(--cyan-light); }
        .hero-stats { display: flex; gap: 2rem; }
        .stat-item {}
        .stat-number {
          font-family: 'Playfair Display', serif;
          font-size: 2rem; font-weight: 900; color: var(--cyan-light); line-height: 1;
        }
        .stat-label { font-size: 0.78rem; color: rgba(255,255,255,0.48); margin-top: 0.15rem; }

        .hero-visual { position: relative; z-index: 1; }
        .hero-img-wrap {
          background: linear-gradient(135deg, #090F1C 0%, #0A1525 40%, #050B14 100%);
          border-radius: 24px; aspect-ratio: 1/1;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          border: 1px solid rgba(0,174,239,0.2);
          box-shadow: 0 36px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04);
          position: relative;
        }
        /* Rotating CMY conic gradient */
        .hero-img-wrap::before {
          content: '';
          position: absolute; top: -50%; left: -50%;
          width: 200%; height: 200%;
          background: conic-gradient(
            from 0deg at 50% 50%,
            rgba(0,174,239,0.07) 0deg, rgba(236,0,140,0.08) 120deg,
            rgba(255,229,0,0.05) 240deg, rgba(0,174,239,0.07) 360deg
          );
          animation: rotate 24s linear infinite;
          pointer-events: none;
        }
        @keyframes rotate { to { transform: rotate(360deg); } }
        .hero-img-placeholder { text-align: center; padding: 2rem; position: relative; }
        .hero-img-icon { font-size: 5rem; margin-bottom: 1rem; filter: drop-shadow(0 0 24px rgba(0,174,239,0.55)); }
        .hero-badge {
          position: absolute; bottom: -1rem; left: -1.5rem;
          background: linear-gradient(135deg, #090F1C, #0A1525);
          border-radius: 14px;
          padding: 0.9rem 1.3rem;
          box-shadow: 0 10px 32px rgba(0,0,0,0.45);
          border: 1px solid rgba(0,174,239,0.25);
          display: flex; flex-direction: column; align-items: center;
        }
        .hero-badge-num {
          font-family: 'Playfair Display', serif;
          font-size: 1.5rem; font-weight: 900; color: var(--cyan-light);
        }
        .hero-badge-txt { font-size: 0.7rem; font-weight: 600; color: rgba(255,255,255,0.55); }

        /* ── SERVICES ── */
        .services-section { padding: 5rem 5vw; background: var(--white); }
        .section-label {
          font-size: 0.72rem; font-weight: 700; letter-spacing: 0.2em;
          text-transform: uppercase; color: var(--cyan);
          display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem;
        }
        .section-divider { width: 40px; height: 3px; background: linear-gradient(90deg, #00AEEF, #EC008C, #FFE500); border-radius: 99px; margin-bottom: 1rem; }
        .section-title {
          font-family: 'Playfair Display', serif;
          font-size: clamp(1.8rem, 3.5vw, 2.6rem);
          font-weight: 900; color: var(--ink); margin-bottom: 0.8rem; line-height: 1.15;
        }
        .section-desc { font-size: 1rem; color: var(--ink-soft); line-height: 1.7; max-width: 560px; margin-bottom: 3rem; }
        .services-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 1.2rem;
        }
        /* Each card a unique deep gradient — white text */
        .service-card {
          border-radius: 16px; padding: 1.8rem 1.5rem;
          cursor: pointer;
          transition: box-shadow 0.25s, border-color 0.22s, transform 0.22s;
          border: 1.5px solid transparent;
          position: relative; overflow: hidden;
        }
        .service-card::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(rgba(255,255,255,0.04), rgba(255,255,255,0));
          border-radius: 16px; pointer-events: none;
        }
        .service-card:nth-child(1) { background: linear-gradient(140deg, #006994 0%, #003A55 100%); }
        .service-card:nth-child(2) { background: linear-gradient(140deg, #8C0060 0%, #4D0033 100%); }
        .service-card:nth-child(3) { background: linear-gradient(140deg, #007DB0 0%, #00405A 100%); }
        .service-card:nth-child(4) { background: linear-gradient(140deg, #750050 0%, #3D002A 100%); }
        .service-card:nth-child(5) { background: linear-gradient(140deg, #005C82 0%, #003044 100%); }
        .service-card:nth-child(6) { background: linear-gradient(140deg, #9D006B 0%, #560039 100%); }
        .service-card:nth-child(7) { background: linear-gradient(140deg, #004F70 0%, #00293A 100%); }
        .service-card:nth-child(8) { background: linear-gradient(140deg, #0D1B2A 0%, #060F18 100%); }
        .service-card:hover { box-shadow: 0 20px 50px rgba(0,0,0,0.3); border-color: rgba(0,174,239,0.5); transform: translateY(-4px); }
        .service-icon { font-size: 2.2rem; margin-bottom: 0.9rem; filter: drop-shadow(0 2px 10px rgba(0,0,0,0.3)); }
        .service-name {
          font-family: 'Playfair Display', serif;
          font-weight: 700; font-size: 1.05rem; color: #FFFFFF;
          margin-bottom: 0.5rem;
        }
        .service-desc { font-size: 0.83rem; color: rgba(255,255,255,0.62); line-height: 1.65; margin-bottom: 1.2rem; }
        .service-price { font-size: 0.78rem; font-weight: 700; color: var(--cyan-light); margin-bottom: 1rem; }
        .service-order-btn {
          background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.85);
          border: 1px solid rgba(255,255,255,0.2); border-radius: 6px;
          padding: 0.4rem 0.9rem; font-size: 0.8rem; font-weight: 600;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.2s;
        }
        .service-card:hover .service-order-btn { background: rgba(0,174,239,0.25); color: var(--cyan-light); border-color: rgba(0,174,239,0.5); }

        /* ── WHY ── */
        .why-section {
          padding: 5rem 5vw;
          background: linear-gradient(180deg, #050B14 0%, #090F1C 50%, #050B14 100%);
          position: relative; overflow: hidden;
        }
        .why-section::before {
          content: '';
          position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
          width: 800px; height: 400px;
          background: radial-gradient(ellipse, rgba(0,174,239,0.07) 0%, transparent 70%);
          pointer-events: none;
        }
        /* Override section text for dark background */
        .why-section .section-label { color: var(--cyan-light); }
        .why-section .section-title { color: #fff; }
        .why-section .section-desc { color: rgba(255,255,255,0.55); }
        .why-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 1.4rem; margin-top: 3rem;
        }
        .why-item {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 1.8rem 1.5rem;
          transition: background 0.2s, border-color 0.2s, transform 0.2s;
        }
        .why-item:hover { background: rgba(255,255,255,0.07); border-color: rgba(0,174,239,0.25); transform: translateY(-2px); }
        /* Colored icon box per card */
        .why-icon {
          font-size: 1.5rem; margin-bottom: 1rem;
          width: 52px; height: 52px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
        }
        .why-item:nth-child(1) .why-icon { background: linear-gradient(135deg, #00AEEF, #0087C0); }
        .why-item:nth-child(2) .why-icon { background: linear-gradient(135deg, #EC008C, #B5006B); }
        .why-item:nth-child(3) .why-icon { background: linear-gradient(135deg, #FFE500, #CCB800); }
        .why-item:nth-child(4) .why-icon { background: linear-gradient(135deg, #EC008C, #B5006B); }
        .why-item:nth-child(5) .why-icon { background: linear-gradient(135deg, #00AEEF, #0087C0); }
        .why-item:nth-child(6) .why-icon { background: linear-gradient(135deg, #FFE500, #CCB800); }
        .why-title { font-weight: 700; font-size: 0.95rem; color: #fff; margin-bottom: 0.4rem; }
        .why-desc { font-size: 0.83rem; color: rgba(255,255,255,0.52); line-height: 1.65; }

        /* ── PORTFOLIO ── */
        .portfolio-section { padding: 5rem 5vw; background: var(--off); }
        .portfolio-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.2rem; margin-top: 3rem;
        }
        .portfolio-card {
          border-radius: 16px; overflow: hidden;
          aspect-ratio: 4/3; position: relative; cursor: pointer;
          border: none;
          box-shadow: 0 4px 18px rgba(0,0,0,0.1);
          transition: transform 0.25s, box-shadow 0.25s;
        }
        .portfolio-card:hover { transform: scale(1.03); box-shadow: 0 16px 48px rgba(0,0,0,0.2); }
        .portfolio-bg {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          font-size: 3.5rem;
        }
        .portfolio-overlay {
          position: absolute; bottom: 0; left: 0; right: 0;
          background: linear-gradient(transparent, rgba(28,20,16,0.85));
          padding: 1.5rem 1.2rem 1rem;
        }
        .portfolio-overlay-cat { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--cyan-light); margin-bottom: 0.2rem; }
        .portfolio-overlay-title { font-family: 'Playfair Display', serif; font-size: 1rem; font-weight: 700; color: #fff; }

        /* ── FORM SECTION ── */
        .form-section { padding: 5rem 5vw; background: var(--off); }
        .form-layout {
          display: grid; grid-template-columns: 1fr 1.4fr;
          gap: 3rem; margin-top: 3rem; align-items: start;
        }
        .form-info-box { position: sticky; top: 80px; display: flex; flex-direction: column; gap: 1.2rem; }
        .price-display {
          background: linear-gradient(135deg, #090F1C 0%, #050B14 100%);
          border: 1px solid rgba(0,174,239,0.25);
          border-radius: 14px; padding: 1.8rem;
          box-shadow: 0 8px 32px rgba(0,0,0,0.18);
        }
        .price-label { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.5); margin-bottom: 0.4rem; }
        .price-total {
          font-family: 'Playfair Display', serif;
          font-size: 2.4rem; font-weight: 900; color: var(--cyan-light);
          display: flex; align-items: flex-start; gap: 0.3rem; line-height: 1.1; margin-bottom: 1.2rem;
        }
        .price-currency { font-size: 1rem; font-weight: 700; color: rgba(255,255,255,0.55); margin-top: 0.5rem; }
        .price-deposit { background: rgba(255,255,255,0.06); border-radius: 8px; padding: 0.9rem 1rem; }
        .price-deposit-amount { font-size: 1.3rem; font-weight: 800; color: var(--cyan-light); margin-top: 0.2rem; }

        /* Pricing table for logged-out users */
        .pricing-preview {
          background: var(--white); border: 1.5px solid var(--cream-border);
          border-radius: 14px; overflow: hidden;
        }
        .pricing-preview-hdr {
          background: linear-gradient(135deg, #090F1C, #050B14); padding: 1rem 1.5rem;
          font-family: 'Playfair Display', serif; font-size: 0.95rem;
          font-weight: 900; color: #fff;
        }
        .pricing-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0.7rem 1.5rem; border-bottom: 1px solid var(--cream-border);
          font-size: 0.84rem;
        }
        .pricing-row:last-child { border-bottom: none; }
        .pricing-row-name { color: var(--ink); font-weight: 500; }
        .pricing-row-price { color: var(--cyan-dark); font-weight: 700; }

        .form-card {
          background: var(--white); border-radius: 16px;
          padding: 2rem; border: 1px solid var(--cream-border);
          box-shadow: 0 4px 24px rgba(0,0,0,0.07);
        }
        .form-group { margin-bottom: 1.3rem; }
        .form-label { display: block; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 0.45rem; }
        .form-control {
          width: 100%; background: var(--off); border: 1.5px solid var(--cream-border);
          border-radius: 8px; padding: 0.72rem 0.9rem;
          font-family: 'DM Sans', sans-serif; font-size: 0.9rem; color: var(--ink);
          outline: none; transition: border-color 0.2s;
        }
        .form-control:focus { border-color: var(--cyan); background: #fff; }
        .form-control option { color: var(--ink); }

        .dim-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.5rem; }
        .dim-option {
          background: var(--off); border: 1.5px solid var(--cream-border);
          border-radius: 8px; padding: 0.55rem 0.6rem;
          cursor: pointer; transition: all 0.15s; text-align: left; width: 100%;
          font-family: 'DM Sans', sans-serif;
        }
        .dim-option:hover { border-color: var(--cyan); background: rgba(0,174,239,0.06); }
        .dim-option.selected { border-color: var(--cyan); background: rgba(0,174,239,0.1); }
        .dim-option-label { display: block; font-size: 0.82rem; font-weight: 600; color: var(--ink); }
        .dim-option-price { display: block; font-size: 0.72rem; color: var(--cyan-dark); font-weight: 700; margin-top: 0.15rem; }

        .qty-control { display: flex; align-items: center; gap: 0.5rem; }
        .qty-btn {
          width: 36px; height: 36px; background: var(--off);
          border: 1.5px solid var(--cream-border); border-radius: 7px;
          font-size: 1.1rem; font-weight: 700; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-family: 'DM Sans', sans-serif; transition: background 0.15s;
        }
        .qty-btn:hover { background: var(--cream); }
        .qty-value { width: 70px; text-align: center; }

        .file-upload {
          background: var(--off); border: 2px dashed var(--cream-deeper);
          border-radius: 10px; padding: 1.5rem; text-align: center;
          cursor: pointer; transition: border-color 0.2s; position: relative;
        }
        .file-upload:hover { border-color: var(--cyan); }
        .file-upload input[type=file] {
          position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%;
        }
        .file-upload-icon { font-size: 2rem; margin-bottom: 0.5rem; }
        .file-upload-text { font-size: 0.85rem; color: var(--ink-soft); white-space: pre-line; line-height: 1.5; }

        .mpesa-wrap { display: flex; align-items: stretch; }
        .mpesa-prefix {
          background: var(--cream); border: 1.5px solid var(--cream-border);
          border-right: none; border-radius: 8px 0 0 8px;
          padding: 0 0.8rem; font-size: 0.88rem; font-weight: 600;
          color: var(--ink-soft); display: flex; align-items: center;
          white-space: nowrap;
        }
        .mpesa-input { border-radius: 0 8px 8px 0 !important; flex: 1; }

        .submit-btn {
          width: 100%;
          background: linear-gradient(#000000 100%);
          color: var(--white);
          border: none; border-radius: 10px; padding: 1rem;
          font-family: 'DM Sans', sans-serif;
          font-size: 1rem; font-weight: 700;
          cursor: pointer; transition: opacity 0.2s, transform 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 0.6rem;
          margin-top: 0.5rem;
          box-shadow: 0 4px 14px rgba(236,0,140,0.42);
        }
        .submit-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 8px 28px rgba(236,0,140,0.48); }
        .submit-btn:disabled { opacity: 0.42; cursor: not-allowed; transform: none; box-shadow: none; }

        /* Sign-in nudge for submit area */
        .signin-nudge {
          background: linear-gradient(135deg, rgba(0,174,239,0.07), rgba(236,0,140,0.05));
          border: 1.5px solid rgba(0,174,239,0.25);
          border-radius: 12px; padding: 1.2rem 1.4rem;
          text-align: center; margin-top: 0.5rem;
        }
        .signin-nudge p { font-size: 0.88rem; color: var(--ink-soft); margin-bottom: 0.9rem; }
        .signin-nudge-btns { display: flex; gap: 0.6rem; justify-content: center; flex-wrap: wrap; }

        /* Auth wall */
        .auth-wall {
          background: var(--white); border: 1.5px solid var(--cream-border);
          border-radius: 16px; padding: 2.5rem 2rem; text-align: center;
          box-shadow: 0 4px 20px rgba(0,0,0,0.06);
        }
        .auth-wall-icon { font-size: 3rem; margin-bottom: 1rem; }
        .auth-wall-title {
          font-family: 'Playfair Display', serif;
          font-size: 1.3rem; font-weight: 900; color: var(--ink);
          margin-bottom: 0.6rem;
        }
        .auth-wall-desc { font-size: 0.88rem; color: var(--ink-soft); line-height: 1.7; margin-bottom: 1.5rem; }
        .auth-wall-btns { display: flex; gap: 0.8rem; justify-content: center; flex-wrap: wrap; }
        /* Order states */
        .awaiting-box {
          background: linear-gradient(135deg, rgba(0,174,239,0.06) 0%, rgba(236,0,140,0.04) 100%);
          border: 1.5px solid rgba(0,174,239,0.3);
          border-radius: 14px; padding: 2rem; text-align: center;
          box-shadow: 0 4px 20px rgba(0,174,239,0.1);
        }
        .awaiting-icon { font-size: 2.5rem; margin-bottom: 0.8rem; animation: pulse 2s ease infinite; }
        @keyframes pulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.1);} }
        .awaiting-title {
          font-family: 'Playfair Display', serif;
          font-size: 1.3rem; font-weight: 900;
          color: var(--ink); margin-bottom: 0.6rem;
        }
        .awaiting-desc { font-size: 0.88rem; color: var(--ink-soft); line-height: 1.7; }
        .awaiting-ref {
          display: inline-block; background: rgba(0,174,239,0.1);
          border: 1px solid var(--cyan); border-radius: 8px;
          padding: 0.4rem 0.9rem; font-size: 0.78rem;
          font-weight: 700; color: var(--cyan-dark);
          margin: 1rem 0;
        }

        .error-box {
          background: #FFF0EE; border: 1.5px solid #F5C6C0;
          border-radius: 10px; padding: 1rem 1.2rem;
          font-size: 0.88rem; color: var(--error);
          margin-bottom: 1rem; display: flex; gap: 0.5rem; align-items: flex-start;
        }

        .spinner {
          width: 20px; height: 20px;
          border: 2.5px solid rgba(255,255,255,0.3);
          border-top-color: var(--white);
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── REVIEWS ── */
        .reviews-section {
          padding: 5rem 5vw;
          background: linear-gradient(135deg, #050B14 0%, #090F1C 40%, #050B14 100%);
          position: relative; overflow: hidden;
        }
        .reviews-section::before {
          content: '';
          position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
          width: 600px; height: 320px;
          background: radial-gradient(ellipse, rgba(0,174,239,0.08) 0%, transparent 70%);
          pointer-events: none;
        }
        .reviews-track { max-width: 640px; margin: 0 auto; }
        .review-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px; padding: 2rem;
          animation: fadeUp 0.4s ease;
          position: relative; overflow: hidden;
        }
        /* Gold accent line at top of review card */
        .review-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, #00AEEF, #EC008C, #FFE500);
        }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px);} to{opacity:1;transform:translateY(0);} }
        .review-stars { color: var(--yellow); font-size: 1.1rem; margin-bottom: 1rem; letter-spacing: 2px; }
        .review-text { font-size: 0.95rem; color: #D4C4AC; line-height: 1.8; margin-bottom: 1.5rem; font-style: italic; }
        .review-author { display: flex; align-items: center; gap: 0.9rem; }
        .review-avatar {
          width: 40px; height: 40px; border-radius: 50%;
          background: linear-gradient(135deg, #00AEEF, #EC008C);
          color: var(--white);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Playfair Display', serif;
          font-size: 1rem; font-weight: 700; flex-shrink: 0;
          box-shadow: 0 4px 14px rgba(0,174,239,0.4);
        }
        .review-name { font-weight: 700; font-size: 0.88rem; color: var(--white); }
        .review-role { font-size: 0.78rem; color: rgba(0,174,239,0.7); }
        .review-dots { display: flex; justify-content: center; gap: 0.5rem; margin-top: 1.5rem; }
        .dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: rgba(255,255,255,0.15); cursor: pointer;
          transition: background 0.2s, transform 0.2s;
        }
        .dot.active { background: var(--cyan); transform: scale(1.35); }

        /* ── FOOTER ── */
        footer {
          background: #0E0A07;
          position: relative; overflow: hidden;
        }
        footer::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, #00AEEF, #EC008C, #FFE500, #EC008C, #00AEEF);
        }

        /* Pre-footer CTA strip */
        .footer-cta-strip {
          background: linear-gradient(135deg, #090F1C 0%, #0A1525 50%, #090F1C 100%);
          border-bottom: 1px solid rgba(0,174,239,0.15);
          padding: 2.5rem 5vw;
          display: flex; align-items: center; justify-content: space-between; gap: 2rem;
          position: relative; overflow: hidden;
        }
        .footer-cta-strip::before {
          content: '';
          position: absolute; top: -60%; right: -5%;
          width: 280px; height: 280px;
          background: radial-gradient(circle, rgba(0,174,239,0.14) 0%, transparent 65%);
          pointer-events: none;
        }
        .footer-cta-text h3 {
          font-family: 'Playfair Display', serif;
          font-size: 1.4rem; font-weight: 700; color: var(--white);
          margin-bottom: 0.3rem;
        }
        .footer-cta-text p { font-size: 0.85rem; color: rgba(255,255,255,0.42); }
        .footer-cta-btn {
          background: linear-gradient(135deg, #00AEEF, #0087C0);
          color: var(--white);
          border: none; border-radius: 8px;
          padding: 0.75rem 1.6rem;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.88rem; font-weight: 700;
          cursor: pointer; white-space: nowrap;
          transition: opacity 0.2s, transform 0.15s;
          text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem;
          flex-shrink: 0; box-shadow: 0 4px 16px rgba(0,174,239,0.45);
        }
        .footer-cta-btn:hover { opacity: 0.9; transform: translateY(-1px); }

        /* Main footer body */
        .footer-body { padding: 3.5rem 5vw 0; }
        .footer-grid {
          display: grid; grid-template-columns: 2fr 1fr 1fr 1.4fr;
          gap: 3rem; padding-bottom: 3rem;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .footer-brand-name {
          font-family: 'Playfair Display', serif;
          font-size: 1.45rem; font-weight: 900;
          color: var(--white); letter-spacing: -0.02em;
          margin-bottom: 0.75rem;
        }
        .footer-brand-name span { color: var(--cyan); }
        .footer-brand-desc {
          font-size: 0.83rem; color: #FFFFFF;
          line-height: 1.75; margin-bottom: 1.5rem; max-width: 240px;
        }

        /* Social icons */
        .footer-social { display: flex; gap: 0.55rem; flex-wrap: wrap; }
        .social-btn {
          width: 38px; height: 38px; border-radius: 10px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background 0.2s, border-color 0.2s, transform 0.15s;
          text-decoration: none; color: #FFFFFF;
        }
        .social-btn svg { width: 16px; height: 16px; fill: currentColor; flex-shrink: 0; }
        .social-btn:hover {
          background: rgba(0,174,239,0.15);
          border-color: rgba(0,174,239,0.35);
          color: var(--cyan); transform: translateY(-2px);
        }
        .social-btn.whatsapp:hover { background: rgba(37,211,102,0.12); border-color: rgba(37,211,102,0.3); color: #25D366; }
        .social-btn.tiktok:hover  { background: rgba(236,0,140,0.1); border-color: rgba(236,0,140,0.3); color: var(--magenta); }

        .footer-col-title {
          font-size: 0.7rem; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(0,174,239,0.6); margin-bottom: 1.1rem;
          display: flex; align-items: center; gap: 0.5rem;
        }
        .footer-col-title::after {
          content: ''; display: block; height: 1px; width: 24px;
          background: linear-gradient(90deg, var(--cyan), var(--magenta)); opacity: 0.5;
        }
        .footer-links { list-style: none; display: flex; flex-direction: column; gap: 0.55rem; }
        .footer-links li a {
          font-size: 0.84rem; color: #FFFFFF;
          cursor: pointer; text-decoration: none;
          transition: color 0.2s, padding-left 0.2s;
          display: inline-block;
        }
        .footer-links li a:hover { color: var(--cyan); padding-left: 4px; }
        .footer-contact-item {
          display: flex; align-items: flex-start; gap: 0.75rem;
          margin-bottom: 0.75rem; font-size: 0.83rem; color: #FFFFFF;
          line-height: 1.5;
        }
        .footer-contact-icon {
          width: 28px; height: 28px; border-radius: 7px;
          background: rgba(0,174,239,0.08);
          border: 1px solid rgba(0,174,239,0.15);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.8rem; flex-shrink: 0; margin-top: 1px;
        }

        /* Footer bottom bar */
        .footer-bottom {
          padding: 1.4rem 5vw;
          display: flex; justify-content: space-between; align-items: center;
          flex-wrap: wrap; gap: 0.75rem;
        }
        .footer-copy { font-size: 0.76rem; color: #FFFFFF; }
        .footer-bottom-links { display: flex; gap: 1.4rem; }
        .footer-bottom-links a {
          font-size: 0.76rem; color: #FFFFFF;
          text-decoration: none; cursor: pointer;
          transition: color 0.2s;
        }
        .footer-bottom-links a:hover { color: #FFFFFF; }
        .footer-made { font-size: 0.76rem; color: #FFFFFF; }

        /* ── RESPONSIVE ── */
        @media (max-width: 1024px) {
          .hero { grid-template-columns: 1fr; min-height: auto; padding: 3rem 5vw; }
          .hero-visual { display: none; }
          .form-layout { grid-template-columns: 1fr; }
          .form-info-box { position: static; }
          .footer-grid { grid-template-columns: 1fr 1fr; gap: 2.5rem; }
        }
        @media (max-width: 768px) {
          .nav { justify-content: space-between; padding: 0 1.25rem; gap: 0; }
          .nav-links { display: none; }
          .nav-cta { display: none; }
          .hamburger { display: flex; }
          .footer-grid { grid-template-columns: 1fr 1fr; gap: 2rem; }
          .footer-brand-col { grid-column: 1 / -1; }
          .footer-bottom { flex-direction: column; align-items: center; text-align: center; gap: 0.4rem; }
          .hero-stats { flex-wrap: wrap; gap: 1rem; }
          .footer-cta-strip { flex-direction: column; gap: 1rem; text-align: center; }
        }
        @media (max-width: 480px) {
          .footer-grid { grid-template-columns: 1fr; }
          .footer-brand-col { grid-column: auto; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav className="nav">
        <a onClick={() => scrollTo("home")} style={{ cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}>
          <img src="/logo.png" alt="Frankstat Logo" style={{ height: "42px", width: "auto", objectFit: "contain" }} />
        </a>
        <ul className="nav-links">
          {["home", "services", "portfolio", "order", "contact"].map((s) => (
            <li key={s}><a onClick={() => scrollTo(s)}>{s}</a></li>
          ))}
        </ul>

        <div className="nav-right">
          {authLoading ? (
            /* skeleton while checking auth */
            <div style={{ width: 80, height: 32, background: "var(--cream)", borderRadius: 7, animation: "pulse 1.4s ease infinite" }} />
          ) : user ? (
            /* ── LOGGED-IN STATE ── */
            <div className="user-menu-wrap" ref={userMenuRef}>
              <button
                className="user-avatar-btn"
                onClick={() => setUserMenuOpen((o) => !o)}
                title={`${user.fullName} — click to open menu`}
              >
                {getUserInitials(user.fullName)}
              </button>
              {userMenuOpen && (
                <div className="user-dropdown">
                  <div className="user-dropdown-name">{user.fullName}</div>
                  <div className="user-dropdown-email">{user.email}</div>
                  <Link href={user.role === "ADMIN" ? "/admin" : user.role === "STAFF" ? "/staff" : "/dashboard"} className="dropdown-item" onClick={() => setUserMenuOpen(false)}>
                    🗂️ My Dashboard
                  </Link>
                  <button className="dropdown-item" onClick={() => { scrollTo("order"); setUserMenuOpen(false); }}>
                    📦 Place Order
                  </button>
                  <hr style={{ margin: "0.3rem 0.5rem", border: "none", borderTop: "1px solid var(--cream-border)" }} />
                  <button className="dropdown-item danger" onClick={handleLogout}>
                    🚪 Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ── LOGGED-OUT STATE ── */
            <>
              <Link href="/login" style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink-soft)", textDecoration: "none" }}>
                Sign In
              </Link>
              <Link href="/signup" className="nav-signup">
                Sign Up →
              </Link>
            </>
          )}
          <button className="hamburger" onClick={() => setMenuOpen((o) => !o)}>
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div className={`mobile-menu${menuOpen ? " open" : ""}`}>
        {["home", "services", "portfolio", "order", "contact"].map((s) => (
          <a key={s} onClick={() => scrollTo(s)}>{s.charAt(0).toUpperCase() + s.slice(1)}</a>
        ))}
        {user ? (
          <>
            <Link href={user.role === "ADMIN" ? "/admin" : user.role === "STAFF" ? "/staff" : "/dashboard"} style={{ fontWeight: 700, color: "var(--gold)", textDecoration: "none" }} onClick={() => setMenuOpen(false)}>
              🗂️ My Dashboard
            </Link>
            <button
              style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: "0.95rem", fontWeight: 600, color: "var(--error)", padding: "0.5rem 0" }}
              onClick={handleLogout}
            >
              🚪 Sign Out ({user.fullName.split(" ")[0]})
            </button>
          </>
        ) : (
          <>
            <Link href="/login" style={{ fontWeight: 600, color: "var(--ink-soft)", textDecoration: "none" }}>Sign In</Link>
            <Link href="/signup" style={{ fontWeight: 700, color: "var(--gold)", textDecoration: "none" }}>Sign Up →</Link>
          </>
        )}
      </div>

      {/* ── OFFER BANNER ── */}
      {banner?.isActive && banner.items.length > 0 && (
        <div className="offer-banner">
          <div className="offer-ticker">
            {/* Duplicate items for seamless infinite loop */}
            {[...banner.items, ...banner.items].map((text, i) => (
              <span key={i}>{text}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── HERO ── */}
      <section id="home" className="hero">
        <div className="hero-text">
          <span className="hero-eyebrow">Premium Printing in Nairobi</span>
          <h1><em>Print that Commands Attention.</em> </h1>
          <p className="hero-desc">
            From vinyl banners to 3D signage, sublimation to business cards —
            Frankstat delivers sharp, vibrant, professional prints that make your brand impossible to ignore.
          </p>
          <div className="hero-btns">
            <button className="btn-primary" onClick={() => scrollTo("order")}>Get Instant Quote</button>
            <button className="btn-secondary" onClick={() => scrollTo("portfolio")}>View Our Work</button>
          </div>
          <div className="hero-stats">
            <div className="stat-item">
              <div className="stat-number">2,400+</div>
              <div className="stat-label">Projects Delivered</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">8+</div>
              <div className="stat-label">Years Experience</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">98%</div>
              <div className="stat-label">Client Satisfaction</div>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-img-wrap">
            <div className="hero-img-placeholder">
              <img
                src="/logo.png"
                alt="Frankstat"
                style={{ width: "75%", maxWidth: "320px", height: "auto", objectFit: "contain", filter: "drop-shadow(0 4px 24px rgba(193,154,74,0.5))" }}
              />
            </div>
          </div>
          <div className="hero-badge">
            <div className="hero-badge-num">24h</div>
            <div className="hero-badge-txt">Fast Delivery</div>
          </div>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section id="services" className="services-section">
        <div className="section-label">What We Do</div>
        <div className="section-divider" />
        <h2 className="section-title">Our Printing Services</h2>
        <p className="section-desc">
          Every service is executed with precision-grade equipment and premium materials.
          What do you need printed today?
        </p>
        <div className="services-grid">
          {SERVICES.map((svc) => (
            <div key={svc.id} className="service-card" onClick={() => handleOrderClick(svc.id)}>
              <div className="service-icon">{svc.icon}</div>
              <div className="service-name">{svc.name}</div>
              <p className="service-desc">{svc.description}</p>
              <div className="service-price">
                {svc.pricingType === "dimension"
                  ? "From KES 150 / print"
                  : `From KES ${QUANTITY_PRICING[svc.id]?.base ?? 200} / ${QUANTITY_PRICING[svc.id]?.unit ?? "piece"}`}
              </div>
              <button className="service-order-btn">Order This →</button>
            </div>
          ))}
        </div>
      </section>

      {/* ── WHY US ── */}
      <section className="why-section">
        <div className="section-label">Why Frankstat</div>
        <div className="section-divider" />
        <h2 className="section-title">Built for Quality, Speed &amp; Value</h2>
        <div className="why-grid">
          {[
            { icon: "⚡", title: "24-Hour Turnaround",     desc: "Urgent order? Most standard jobs are ready within 24 hours." },
            { icon: "🎨", title: "Vibrant, True Colours",  desc: "Calibrated wide-format printers ensure your brand colours print exactly as designed." },
            { icon: "🛡️", title: "Weather-Proof Materials",desc: "Outdoor banners and signage built to withstand Nairobi's sun, rain, and wind." },
            { icon: "💬", title: "Free Design Consultation",desc: "Not sure about sizing? Our team guides you from concept to final print." },
            { icon: "🚚", title: "Nairobi-Wide Delivery",  desc: "We deliver to all Nairobi CBD and suburb locations. Large orders get free delivery." },
            { icon: "📱", title: "M-Pesa Payments",        desc: "Pay securely via M-Pesa. A 50% deposit confirms your order and we start immediately." },
          ].map((item) => (
            <div key={item.title} className="why-item">
              <div className="why-icon">{item.icon}</div>
              <div className="why-title">{item.title}</div>
              <p className="why-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PORTFOLIO ── */}
      <section id="portfolio" className="portfolio-section">
        <div className="section-label">Our Work</div>
        <div className="section-divider" />
        <h2 className="section-title">Portfolio Showcase</h2>
        <p className="section-desc">
          A glimpse of what we have created for businesses, events, and brands across Nairobi and beyond.
        </p>
        <div className="portfolio-grid">
          {PORTFOLIO.map((item, i) => (
            <div key={i} className="portfolio-card">
              <div className="portfolio-bg" style={{ background: `linear-gradient(135deg,${item.color}22,${item.color}55)` }}>
                <img
                  src={item.image}
                  alt={item.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
              <div className="portfolio-overlay">
                <div className="portfolio-overlay-cat">{item.category}</div>
                <div className="portfolio-overlay-title">{item.title}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── ORDER FORM ── (visible to all, submit gated) */}

      
    <section id="order" className="form-section" ref={formRef as any}>
  <div className="section-label">Pricing Calculator &amp; Order</div>
  <div className="section-divider" />
  <h2 className="section-title">Get an Instant Quote</h2>
  <p className="section-desc">
    Select your service and options below. Pricing updates in real-time.
    Choose a 50% deposit to get started, or pay in full for faster processing.
  </p>

   <div className="form-layout">
    {/* ── LEFT: price display ── */}
    <div className="form-info-box">

      {/* How it works */}
      <div style={{ background: "var(--cream)", border: "1px solid var(--cream-deeper)", borderRadius: "10px", padding: "1.8rem" }}>
        <p style={{ fontSize: "0.85rem", color: "#6B5440", lineHeight: "1.7", marginBottom: "1rem" }}>
          <strong style={{ color: "var(--ink)" }}>How it works:</strong><br />
          Choose your service → configure size &amp; quantity → upload your artwork →
          choose deposit or full payment → enter your M-Pesa number → pay. We confirm
          and start production within the hour.
        </p>
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {[
            "✅ Transparent pricing – no hidden fees",
            "📐 Common size presets included",
            "🎨 Artwork review before printing",
            "📱 M-Pesa STK push — no manual transfer",
          ].map((t) => <li key={t} style={{ fontSize: "0.83rem", color: "#6B5440" }}>{t}</li>)}
        </ul>
      </div>

        {/* Payment mode toggle */}
      {totalPrice > 0 && (
        <div style={{ background: "var(--white)", border: "1.5px solid var(--cream-border)", borderRadius: "10px", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            <button
              type="button"
              onClick={() => setPayFull(false)}
              style={{
                padding: "0.85rem 0.5rem", border: "none", cursor: "pointer",
                fontFamily: "var(--font-sans, 'DM Sans', sans-serif)",
                fontSize: "0.83rem", fontWeight: 700,
                background: !payFull ? "var(--ink)" : "var(--off)",
                color: !payFull ? "#fff" : "var(--ink-soft)",
                transition: "all 0.18s",
              }}
            >
              50% Deposit<br />
              <span style={{ fontSize: "0.72rem", fontWeight: 400, opacity: 0.75 }}>
                KES {deposit.toLocaleString()} now
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPayFull(true)}
              style={{
                padding: "0.85rem 0.5rem", border: "none", cursor: "pointer",
                fontFamily: "var(--font-sans, 'DM Sans', sans-serif)",
                fontSize: "0.83rem", fontWeight: 700,
                background: payFull ? "var(--ink)" : "var(--off)",
                color: payFull ? "#fff" : "var(--ink-soft)",
                transition: "all 0.18s",
              }}
            >
              Pay in Full<br />
              <span style={{ fontSize: "0.72rem", fontWeight: 400, opacity: 0.75 }}>
                KES {totalPrice.toLocaleString()} now
              </span>
            </button>
          </div>
          {payFull && (
            <div style={{ padding: "0.6rem 1rem", background: "rgba(90,158,111,0.08)", borderTop: "1px solid rgba(90,158,111,0.2)", fontSize: "0.78rem", color: "#3D7A55", textAlign: "center" }}>
              ✓ No balance due on collection — full priority processing
            </div>
          )}
          {!payFull && totalPrice > 0 && (
            <div style={{ padding: "0.6rem 1rem", background: "rgba(193,154,74,0.07)", borderTop: "1px solid rgba(193,154,74,0.15)", fontSize: "0.78rem", color: "#8B6914", textAlign: "center" }}>
              Balance of KES {(totalPrice - deposit).toLocaleString()} payable on collection
            </div>
          )}
        </div>
      )}

            {/* Price display */}
      <div className="price-display">
        <div className="price-label">
          {payFull ? "Total (Pay Now)" : "Estimated Total"}
        </div>
        <div className="price-total">
          <span className="price-currency">KES</span>
          {totalPrice.toLocaleString()}
        </div>
        <div className="price-deposit">
          <div className="price-label">
            {payFull ? "You pay now (in full)" : "50% Deposit (Pay Now)"}
          </div>
          <div className="price-deposit-amount">
            KES {(payFull ? totalPrice : deposit).toLocaleString()}
          </div>
        </div>
        {!payFull && deposit > 0 && (
          <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.42)", marginTop: "0.5rem" }}>
            Balance: KES {(totalPrice - deposit).toLocaleString()} on collection
          </p>
        )}
        {selectedService && (
          <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.42)", marginTop: "0.5rem" }}>
            {selectedService.name} × {formData.quantity}
            {formData.dimension && formData.dimension !== "Custom" ? ` — ${formData.dimension}` : ""}
          </p>
        )}
      </div>

            {/* Pricing reference table */}
            <div className="pricing-preview">
              <div className="pricing-preview-hdr">📋 Service Pricing Guide</div>
              {SERVICES.map((svc) => (
                <div key={svc.id} className="pricing-row">
                  <span className="pricing-row-name">{svc.icon} {svc.name}</span>
                  <span className="pricing-row-price">
                    {svc.pricingType === "dimension"
                      ? "From KES 150"
                      : `KES ${QUANTITY_PRICING[svc.id]?.base ?? 200}/${QUANTITY_PRICING[svc.id]?.unit ?? "pc"}`}
                  </span>
                </div>
              ))}

              <div style={{ padding: "0.7rem 1.5rem", fontSize: "0.75rem", color: "#A89070", background: "var(--off)" }}>
                * Prices shown are base rates. Final price depends on size, quantity, and finish.
              </div>
            </div>

            {/* Show user's name if logged in */}
           {user && (
        <div style={{ background: "rgba(90,158,111,0.1)", border: "1px solid rgba(90,158,111,0.3)", borderRadius: "10px", padding: "0.9rem 1.1rem", fontSize: "0.83rem", color: "#3D7A55" }}>
          ✓ Ordering as <strong>{user.fullName}</strong>
        </div>
      )}
    </div>

          {/* RIGHT: Form (always visible) */}
         <div>
      {!authLoading && !user ? (
        /* Auth wall */
        <div className="auth-wall">
          <div className="auth-wall-icon">🔐</div>
          <div className="auth-wall-title">Sign in to Place an Order</div>
          <p className="auth-wall-desc">
            You need a Frankstat account to place orders and pay via M-Pesa.
            It only takes a minute — it&apos;s free.
          </p>
          <div className="auth-wall-btns">
            <Link href="/login"><button className="btn-primary">Sign In →</button></Link>
            <Link href="/signup"><button className="btn-secondary">Create Account</button></Link>
          </div>
        </div>

      ) : orderStatus === "awaiting_payment" ? (
        /* Awaiting M-Pesa */
        <div className="awaiting-box">
          <div className="awaiting-icon">📱</div>
          <div className="awaiting-title">Check Your Phone!</div>
          <p className="awaiting-desc">
            We&apos;ve sent an M-Pesa STK push to <strong>+254{formData.mpesa}</strong>.<br />
            Enter your PIN to confirm{" "}
            <strong>
              KES {(payFull ? totalPrice : deposit).toLocaleString()}
            </strong>
            {payFull ? " (full payment)" : " (50% deposit)"}.
          </p>
          <div className="awaiting-ref">Order ref: {orderId.slice(-8).toUpperCase()}</div>
          <p className="awaiting-desc" style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
            {orderMessage}
          </p>
          {!payFull && deposit > 0 && (
            <p style={{ fontSize: "0.8rem", color: "#A89070", marginTop: "1rem" }}>
              Balance of KES {(totalPrice - deposit).toLocaleString()} is payable on collection.
            </p>
          )}
          {payFull && (
            <p style={{ fontSize: "0.8rem", color: "#3D7A55", marginTop: "1rem" }}>
              ✓ Fully paid — no balance due on collection.
            </p>
          )}
          <button className="btn-secondary" style={{ marginTop: "1.5rem" }} onClick={resetForm}>
            Place Another Order
          </button>
        </div>

      ) : (
        /* Order form */
        <form className="form-card" onSubmit={handleSubmit}>
          {orderStatus === "error" && (
            <div className="error-box">
              <span>⚠️</span>
              <span>{orderError}</span>
            </div>
          )}

            {/* Service */}
          <div className="form-group">
            <label className="form-label">Service *</label>
            <select
              className="form-control" required value={formData.service}
              onChange={(e) => setFormData((f) => ({ ...f, service: e.target.value, dimension: "", quantity: 1 }))}
            >
              <option value="">— Select a service —</option>
              {SERVICES.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
            </select>
          </div>

          {/* Dimensions */}
          {(formData.service === "banners" || formData.service === "posters") && (
            <div className="form-group">
              <label className="form-label">Size / Dimensions *</label>
              <div className="dim-grid">
                {dimensions.map((d) => (
                  <button type="button" key={d.label}
                    className={`dim-option${formData.dimension === d.label ? " selected" : ""}`}
                    onClick={() => setFormData((f) => ({ ...f, dimension: d.label }))}>
                    <span className="dim-option-label">{d.label}</span>
                    <span className="dim-option-price">{d.price > 0 ? `KES ${d.price.toLocaleString()}` : "Quoted"}</span>
                  </button>
                ))}
              </div>
              {formData.dimension === "Custom" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginTop: "0.8rem" }}>
                  <div>
                    <label className="form-label">Width (ft)</label>
                    <input type="number" min="0.5" step="0.5" className="form-control" placeholder="e.g. 5"
                      value={formData.customW} onChange={(e) => setFormData((f) => ({ ...f, customW: e.target.value }))} />
                  </div>
                  <div>
                    <label className="form-label">Height (ft)</label>
                    <input type="number" min="0.5" step="0.5" className="form-control" placeholder="e.g. 3"
                      value={formData.customH} onChange={(e) => setFormData((f) => ({ ...f, customH: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Finish */}
          {formData.service === "posters" && (
            <div className="form-group">
              <label className="form-label">Finish</label>
              <select className="form-control" value={formData.paperType}
                onChange={(e) => setFormData((f) => ({ ...f, paperType: e.target.value }))}>
                <option value="glossy">Glossy</option>
                <option value="matte">Matte</option>
                <option value="satin">Satin</option>
              </select>
            </div>
          )}

          {/* Quantity */}
          {formData.service && (
            <div className="form-group">
              <label className="form-label">
                Quantity {QUANTITY_PRICING[formData.service] ? `(per ${QUANTITY_PRICING[formData.service].unit})` : ""}
              </label>
              <div className="qty-control">
                <button type="button" className="qty-btn"
                  onClick={() => setFormData((f) => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))}>−</button>
                <input type="number" className="qty-value" min={1} value={formData.quantity}
                  onChange={(e) => setFormData((f) => ({ ...f, quantity: Math.max(1, parseInt(e.target.value) || 1) }))} />
                <button type="button" className="qty-btn"
                  onClick={() => setFormData((f) => ({ ...f, quantity: f.quantity + 1 }))}>+</button>
              </div>
            </div>
          )}

          {/* Artwork */}
          {formData.service && (
            <div className="form-group">
              <label className="form-label">Upload Artwork / Design *</label>
              <div className="file-upload">
                <input type="file" accept="image/jpeg,image/png,image/webp,.pdf,.ai,.eps,.psd"
                  onChange={(e) => setFormData((f) => ({ ...f, imageFile: e.target.files?.[0] ?? null }))} />
                <div className="file-upload-icon">{formData.imageFile ? "✅" : "📁"}</div>
                <div className="file-upload-text">
                  {formData.imageFile ? formData.imageFile.name : "Click or drag your file here\nJPG, PNG, PDF, AI, EPS, PSD"}
                </div>
                <p style={{ fontSize: "0.72rem", color: "#A89070", marginTop: "0.4rem" }}>Min 300 DPI · Max 100 MB</p>
              </div>
            </div>
          )}

          {/* M-Pesa */}
          {formData.service && (
            <div className="form-group">
              <label className="form-label">M-Pesa Phone Number *</label>
              <div className="mpesa-wrap">
                <span className="mpesa-prefix">+254</span>
                <input type="tel" className="form-control mpesa-input" required
                  placeholder="7XX XXX XXX" maxLength={9} value={formData.mpesa}
                  onChange={(e) => setFormData((f) => ({ ...f, mpesa: e.target.value.replace(/\\D/g, "") }))} />
              </div>
              <p style={{ fontSize: "0.75rem", color: "#8B7355", marginTop: "0.4rem" }}>
                STK push for{" "}
                <strong>KES {(payFull ? totalPrice : deposit).toLocaleString()}</strong>
                {" "}will be sent to this number.
              </p>
            </div>
          )}

          {/* Notes */}
          {formData.service && (
            <div className="form-group">
              <label className="form-label">Special Instructions (optional)</label>
              <textarea className="form-control" rows={3}
                placeholder="e.g. Grommets on all edges, double-sided, specific Pantone colours..."
                value={formData.notes}
                onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          )}

        {/* Submit */}
          <button type="submit" className="submit-btn" disabled={isSubmitDisabled}>
            {orderStatus === "submitting" ? (
              <><div className="spinner" /> Processing…</>
            ) : payFull ? (
              <><span>📱</span> Pay in Full — KES {totalPrice.toLocaleString()} via M-Pesa</>
            ) : (
              <><span>📱</span> Pay Deposit — KES {deposit.toLocaleString()} via M-Pesa</>
            )}
          </button>

          {!payFull && deposit > 0 && (
            <p style={{ fontSize: "0.75rem", color: "#8B7355", textAlign: "center", marginTop: "0.6rem" }}>
              Balance of KES {(totalPrice - deposit).toLocaleString()} payable on collection / delivery
            </p>
          )}
          {payFull && totalPrice > 0 && (
            <p style={{ fontSize: "0.75rem", color: "#3D7A55", textAlign: "center", marginTop: "0.6rem" }}>
              ✓ Full payment — no balance due
            </p>
          )}
        </form>
      )}
    </div>
  </div>
</section>

      {/* ── REVIEWS ── */}
      <section className="reviews-section">
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div className="section-label" style={{ justifyContent: "center", display: "flex" }}>Customer Reviews</div>
          <div className="section-divider" style={{ margin: "0.6rem auto 1rem" }} />
          <h2 className="section-title" style={{ textAlign: "center", color: "var(--white)" }}>What Our Clients Say</h2>
        </div>
        <div className="reviews-track">
          <div className="review-card" key={activeReview}>
            <div className="review-stars">{"★".repeat(REVIEWS[activeReview].rating)}</div>
            <div className="review-text">{REVIEWS[activeReview].text}</div>
            <div className="review-author">
              <div className="review-avatar">{REVIEWS[activeReview].name[0]}</div>
              <div>
                <div className="review-name">{REVIEWS[activeReview].name}</div>
                <div className="review-role">{REVIEWS[activeReview].role}</div>
              </div>
            </div>
          </div>
          <div className="review-dots">
            {REVIEWS.map((_, i) => (
              <div key={i} className={`dot${i === activeReview ? " active" : ""}`} onClick={() => setActiveReview(i)} />
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer id="contact">

        {/* Pre-footer CTA strip */}
        <div className="footer-cta-strip">
          <div className="footer-cta-text">
            <h3>Ready to bring your brand to life?</h3>
            <p>Get an instant quote — no sign-up required.</p>
          </div>
          <button className="footer-cta-btn" onClick={() => scrollTo("order")}>
            Start Your Order →
          </button>
        </div>

        {/* Main footer body */}
        <div className="footer-body">
          <div className="footer-grid">

            {/* Brand + social */}
            <div className="footer-brand-col">
              <img src="/logo.png" alt="Frankstat" style={{ height: "48px", width: "auto", objectFit: "contain", marginBottom: "0.75rem" }} />
              <p className="footer-brand-desc">
                Nairobi&apos;s trusted printing partner for businesses, events &amp; entrepreneurs.
                Premium prints. Fast turnaround. Fair pricing.
              </p>
              <div className="footer-social">
                {/* Facebook */}
                <a className="social-btn" href="#" aria-label="Facebook">
                  <svg viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                {/* Instagram */}
                <a className="social-btn" href="#" aria-label="Instagram">
                  <svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
                {/* X / Twitter */}
                <a className="social-btn" href="#" aria-label="X (Twitter)">
                  <svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                {/* LinkedIn */}
                <a className="social-btn" href="#" aria-label="LinkedIn">
                  <svg viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
                {/* WhatsApp */}
                <a className="social-btn whatsapp" href="https://wa.me/254700000000" aria-label="WhatsApp">
                  <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </a>
                {/* TikTok */}
                <a className="social-btn tiktok" href="#" aria-label="TikTok">
                  <svg viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                </a>
              </div>
            </div>

            {/* Services */}
            <div>
              <div className="footer-col-title">Services</div>
              <ul className="footer-links">
                {SERVICES.map((s) => (
                  <li key={s.id}><a onClick={() => scrollTo("order")}>{s.name}</a></li>
                ))}
              </ul>
            </div>

            {/* Quick Links */}
            <div>
              <div className="footer-col-title">Quick Links</div>
              <ul className="footer-links">
                {["Home", "Services", "Portfolio", "Order", "Contact"].map((l) => (
                  <li key={l}><a onClick={() => scrollTo(l.toLowerCase())}>{l}</a></li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <div className="footer-col-title">Contact Us</div>
              {[
                { icon: "📍", text: "Odeon, Nairobi" },
                { icon: "📞", text: "+254 700 000 000" },
                { icon: "📧", text: "hello@frankstat.co.ke" },
                { icon: "🕐", text: "Mon–Sat · 8am – 8pm" },
              ].map((c) => (
                <div key={c.text} className="footer-contact-item">
                  <span className="footer-contact-icon">{c.icon}</span>
                  <span>{c.text}</span>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Bottom bar */}
        <div className="footer-bottom">
          <div className="footer-copy" suppressHydrationWarning>© {new Date().getFullYear()} Frankstat Printing Solutions. All rights reserved.</div>
          <div className="footer-bottom-links">
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
          </div>
          <div className="footer-made">Made with ❤️ in Nairobi</div>
        </div>

      </footer>
    </>
  );
}

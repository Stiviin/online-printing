"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

// ─── STATUS MAPPING ──────────────────────────────────────────────────────────
// Prisma OrderStatus enum → display values used by the UI
type ProjectStatus =
  | "Pending"
  | "In Production"
  | "Quality Check"
  | "Ready"
  | "Delivering"
  | "Completed"
  | "Payment Failed"
  | "Payment Error"
  | "Cancelled"
  | "Refunded";

const PRISMA_TO_UI: Record<string, ProjectStatus> = {
  PENDING_PAYMENT: "Pending",
  IN_PRODUCTION:   "In Production",
  QUALITY_CHECK:   "Quality Check",
  READY:           "Ready",
  DELIVERING:      "Delivering",
  COMPLETED:       "Completed",
  PAYMENT_FAILED:  "Payment Failed",
  PAYMENT_ERROR:   "Payment Error",
  CANCELLED:       "Cancelled",
  REFUNDED:        "Refunded",
};

const BALANCE_ALLOWED = ["IN_PRODUCTION","QUALITY_CHECK","READY","DELIVERING"];

// ─── TYPES ───────────────────────────────────────────────────────────────────
type Tab = "overview" | "orders" | "track" | "payments" | "profile" | "support";

interface Order {
  id: string;
  serviceId: string;
  serviceName: string;
  dimensions?: string | null;
  quantity: number;
  finishType?: string | null;
  specialNotes?: string | null;
  totalPrice: number;
  depositAmount: number;
  artworkUrl: string;
  mpesaPhone: string;
  balanceDue: number;
  status: string;        // raw Prisma enum string
  mpesaReceipt?: string | null;
  createdAt: string;
  updatedAt: string;
  // UI helpers derived client-side
  uiStatus: ProjectStatus;
}

interface PaymentRecord {
  id: string;
  order?: { id: string; serviceName?: string } | null;
  type: string;
  amount: number;
  method: string;
  mpesaRef?: string | null;
  date?: string;
  createdAt?: string;
  status: string;
}

interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  isVerified: boolean;
  createdAt: string;
}

interface DashboardStats {
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  totalPaid: number;
  pendingBalance: number;
  totalTransactions: number;
}

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────
const STATUS_META: Record<
  ProjectStatus,
  { color: string; bg: string; icon: string; step: number; label: string }
> = {
  "Pending":       { color: "#8A7200", bg: "#FFFBE0", icon: "⏳", step: 1, label: "Order Received"  },
  "In Production": { color: "#006680", bg: "#DFFBFF", icon: "🖨️", step: 2, label: "In Production"   },
  "Quality Check": { color: "#3D3070", bg: "#F4F2FF", icon: "🔍", step: 3, label: "Quality Check"   },
  "Ready":         { color: "#006680", bg: "#DFFBFF", icon: "📦", step: 4, label: "Ready"            },
  "Delivering":    { color: "#8A7200", bg: "#FFFBE0", icon: "🚚", step: 5, label: "Out for Delivery" },
  "Completed":     { color: "#155724", bg: "#F0FDF4", icon: "✅", step: 6, label: "Completed"        },
  "Payment Failed":{ color: "#CC005A", bg: "#FFF0F8", icon: "❌", step: 0, label: "Payment Failed"   },
  "Payment Error": { color: "#CC005A", bg: "#FFF0F8", icon: "⚠️", step: 0, label: "Payment Error"   },
  "Cancelled":     { color: "#374151", bg: "#F9FAFB", icon: "🚫", step: 0, label: "Cancelled"        },
  "Refunded":      { color: "#374151", bg: "#F3F4F6", icon: "↩️", step: 0, label: "Refunded"         },
};

const PROGRESS_STEPS = [
  "Order Received",
  "In Production",
  "Quality Check",
  "Ready",
  "Out for Delivery",
  "Completed",
];

const fmt  = (n: number) => `KES ${n.toLocaleString()}`;
const fmtD = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.2rem 0.7rem",
        borderRadius: "99px",
        background: bg,
        color,
        fontSize: "0.73rem",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function Toast({
  msg,
  type,
}: {
  msg: string;
  type: "success" | "error" | "info";
}) {
  const bg =
    type === "success" ? "#1A6B3A" : type === "error" ? "#922B21" : "#1A5276";
  const icon =
    type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️";
  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        background: bg,
        color: "#fff",
        padding: "0.85rem 1.4rem",
        borderRadius: "10px",
        fontSize: "0.88rem",
        fontWeight: 500,
        boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
      }}
    >
      {icon} {msg}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(14,10,7,0.55)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: wide ? "700px" : "800px",
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "0 24px 60px rgba(0,0,0,0.22)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1.4rem 2rem",
            borderBottom: "1px solid #F0E8DC",
            position: "sticky",
            top: 0,
            background: "#fff",
            zIndex: 1,
            borderRadius: "16px 16px 0 0",
          }}
        >
          <h3
            style={{
              fontFamily: "'Playfair Display',serif",
              fontSize: "1.1rem",
              fontWeight: 800,
              color: "#1C1410",
            }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "#F5EFE6",
              border: "none",
              borderRadius: "8px",
              width: "30px",
              height: "30px",
              cursor: "pointer",
              fontSize: "1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#5C4A38",
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: "1.8rem 2rem" }}>{children}</div>
      </div>
    </div>
  );
}

// ─── PROGRESS TRACKER ─────────────────────────────────────────────────────────
function ProgressTracker({ order }: { order: Order }) {
  const meta = STATUS_META[order.uiStatus];
  const currentStep = meta.step;
  const isTerminalError = ["Cancelled","Payment Failed","Payment Error","Refunded"].includes(order.uiStatus);

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #F0E8DC",
        borderRadius: "14px",
        padding: "1.8rem",
        marginBottom: "1.2rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "0.6rem",
          marginBottom: "1.6rem",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'Playfair Display',serif",
              fontSize: "1.05rem",
              fontWeight: 800,
              color: "#1C1410",
            }}
          >
            {order.id.slice(0, 12).toUpperCase()}
          </div>
          <div style={{ fontSize: "0.85rem", color: "#7A6050", marginTop: "0.2rem" }}>
            🖨️ {order.serviceName}
            {order.dimensions ? ` · ${order.dimensions}` : ""}
          </div>
        </div>
        <Badge
          label={`${meta.icon} ${order.uiStatus}`}
          color={meta.color}
          bg={meta.bg}
        />
      </div>

      {isTerminalError ? (
        <div
          style={{
            background: order.uiStatus === "Refunded" ? "#F4F2FF" : "#FFF0F8",
            border: `1.5px solid ${order.uiStatus === "Refunded" ? "#E4DEFF" : "#FFD6ED"}`,
            borderRadius: "10px",
            padding: "1rem 1.2rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: "0.4rem" }}>{meta.icon}</div>
          <div style={{ fontWeight: 700, color: meta.color, fontSize: "0.9rem" }}>
            {order.uiStatus === "Cancelled"     && "This order was cancelled."}
            {order.uiStatus === "Payment Failed"&& "Payment was not completed."}
            {order.uiStatus === "Payment Error" && "A payment error occurred."}
            {order.uiStatus === "Refunded"      && "A refund has been processed."}
          </div>
          <div style={{ fontSize: "0.82rem", color: "#9CA3AF", marginTop: "0.25rem" }}>
            Contact support if you need assistance.
          </div>
        </div>
      ) : (
        <>
          {/* Step bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "1.2rem",
              position: "relative",
            }}
          >
            {PROGRESS_STEPS.map((step, i) => {
              const stepNum = i + 1;
              const done = currentStep >= stepNum;
              const active = currentStep === stepNum;
              return (
                <div
                  key={step}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flex: i < PROGRESS_STEPS.length - 1 ? 1 : "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: done
                          ? active
                            ? "#C19A4A"
                            : "#1C1410"
                          : "#F0E8DC",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        color: done ? "#fff" : "#C8B89A",
                        boxShadow: active
                          ? "0 0 0 4px rgba(193,154,74,0.25)"
                          : "none",
                        transition: "all 0.3s",
                        flexShrink: 0,
                      }}
                    >
                      {done && !active ? "✓" : stepNum}
                    </div>
                    <div
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 600,
                        color: done ? "#1C1410" : "#C8B89A",
                        textAlign: "center",
                        width: "64px",
                        lineHeight: 1.3,
                        whiteSpace: "normal",
                      }}
                    >
                      {step}
                    </div>
                  </div>
                  {i < PROGRESS_STEPS.length - 1 && (
                    <div
                      style={{
                        flex: 1,
                        height: "3px",
                        background:
                          currentStep > stepNum ? "#1C1410" : "#F0E8DC",
                        borderRadius: "99px",
                        margin: "0 4px 20px",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Details row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "0.8rem",
            }}
          >
            {[
              { label: "Quantity",     value: String(order.quantity) },
              { label: "Total",        value: fmt(order.totalPrice) },
              { label: "Deposit Paid", value: fmt(order.depositAmount) },
              {
                label: "Balance Due",
                value: fmt(order.totalPrice - order.depositAmount),
                highlight: order.totalPrice - order.depositAmount > 0,
              },
              { label: "Last Update",  value: fmtD(order.updatedAt) },
            ].map((d) => (
              <div
                key={d.label}
                style={{
                  background: "#FAF6F1",
                  borderRadius: "8px",
                  padding: "0.7rem 0.9rem",
                }}
              >
                <div
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "#A89070",
                    marginBottom: "0.2rem",
                  }}
                >
                  {d.label}
                </div>
                <div
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    color:
                      "highlight" in d && d.highlight ? "#C0392B" : "#1C1410",
                  }}
                >
                  {d.value}
                </div>
              </div>
            ))}
          </div>

          {/* Special notes */}
          {order.specialNotes && (
            <div
              style={{
                marginTop: "1rem",
                background: "#FFFBF4",
                border: "1.5px solid #F0D98C",
                borderRadius: "8px",
                padding: "0.8rem 1rem",
                display: "flex",
                gap: "0.6rem",
                alignItems: "flex-start",
              }}
            >
              <span style={{ fontSize: "1rem" }}>💬</span>
              <div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "#8B6914",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginBottom: "0.2rem",
                  }}
                >
                  Order Notes
                </div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "#5C4A38",
                    lineHeight: 1.6,
                  }}
                >
                  {order.specialNotes}
                </div>
              </div>
            </div>
          )}

          {/* Artwork warning */}
          {!order.artworkUrl && (
            <div
              style={{
                marginTop: "0.8rem",
                background: "#FDEDEC",
                border: "1.5px solid #FADBD8",
                borderRadius: "8px",
                padding: "0.8rem 1rem",
                display: "flex",
                gap: "0.6rem",
                alignItems: "center",
              }}
            >
              <span>⚠️</span>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "#922B21",
                  fontWeight: 600,
                }}
              >
                Artwork not yet uploaded. Please send your design file to
                hello@frankstat.co.ke or WhatsApp +254 700 000 000 to avoid
                delays.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── LOADING SKELETON ─────────────────────────────────────────────────────────
function Skeleton({ w = "100%", h = "1rem" }: { w?: string; h?: string }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        background: "#F0E8DC",
        borderRadius: "6px",
        animation: "pulse 1.4s ease infinite",
      }}
    />
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function UserDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [orderDetailModal, setOrderDetailModal] = useState<Order | null>(null);
  const [paymentDetailModal, setPaymentDetailModal] =
    useState<PaymentRecord | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [orderFilter, setOrderFilter] = useState<ProjectStatus | "All">("All");
  const [orderSearch, setOrderSearch] = useState("");
  const avatarRef = useRef<HTMLInputElement>(null);

  // ── Profile edit state ────────────────────────────────────────────────────
  const [profileEditing, setProfileEditing] = useState(false);
  const [editName,  setEditName]  = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Pay-balance state ─────────────────────────────────────────────────────
  const [payBalanceOrder,  setPayBalanceOrder]  = useState<Order | null>(null);
  const [payBalancePhone,  setPayBalancePhone]  = useState("");
  const [payBalanceSaving, setPayBalanceSaving] = useState(false);

  // ── Password change state ─────────────────────────────────────────────────
  const [pwOpen,   setPwOpen]   = useState(false);
  const [currPw,   setCurrPw]   = useState("");
  const [newPw,    setNewPw]    = useState("");
  const [confPw,   setConfPw]   = useState("");
  const [pwErr,    setPwErr]    = useState("");
  const [savingPw, setSavingPw] = useState(false);

  // ── Remote data state ──────────────────────────────────────────────────────
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Fetch dashboard data on mount ─────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/dashboard");
        if (!res.ok) {
          if (res.status === 401) {
            // Not logged in — redirect to sign-in
            window.location.href = "/auth/signin";
            return;
          }
          throw new Error(`Server error ${res.status}`);
        }
        const data = await res.json();

        // Privileged users shouldn't be on the customer dashboard
        if (data.user?.role === "ADMIN") { window.location.href = "/admin"; return; }
        if (data.user?.role === "STAFF") { window.location.href = "/staff"; return; }

        setProfile(data.user);
        setPayments(data.payments);
        setStats(data.stats);

        // Attach uiStatus to every order
        const mapped: Order[] = (data.orders as Order[]).map((o) => ({
          ...o,
          uiStatus: PRISMA_TO_UI[o.status] ?? "Pending",
        }));
        setOrders(mapped);
      } catch (err: any) {
        setFetchError(err.message ?? "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const showToast = (
    msg: string,
    type: "success" | "error" | "info" = "success"
  ) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Pay balance ───────────────────────────────────────────────────────────
  const handlePayBalance = async () => {
    if (!payBalanceOrder) return;
    setPayBalanceSaving(true);
    try {
      const phone = payBalancePhone.trim();
      const r = await fetch(`/api/orders/${payBalanceOrder.id}/pay-balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(phone ? { mpesa: phone } : {}),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { showToast(d.error ?? "Payment could not be initiated.", "error"); return; }
      showToast(d.customerMessage ?? "M-Pesa prompt sent! Check your phone.", "success");
      setPayBalanceOrder(null);
      setPayBalancePhone("");
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setPayBalanceSaving(false);
    }
  };

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!editName.trim()) { showToast("Full name is required.", "error"); return; }
    setSavingProfile(true);
    try {
      const res  = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: editName.trim(), phone: editPhone.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "Save failed.", "error"); return; }
      setProfile((p) => p ? { ...p, ...json.user } : p);
      setProfileEditing(false);
      showToast("Profile updated successfully.");
    } catch { showToast("Network error. Please try again.", "error"); }
    finally  { setSavingProfile(false); }
  };

  // ── Change password ───────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    setPwErr("");
    if (!currPw || !newPw || !confPw) { setPwErr("All fields are required."); return; }
    if (newPw.length < 8)              { setPwErr("New password must be at least 8 characters."); return; }
    if (newPw !== confPw)              { setPwErr("New passwords do not match."); return; }
    setSavingPw(true);
    try {
      const res  = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currPw, newPassword: newPw }),
      });
      const json = await res.json();
      if (!res.ok) { setPwErr(json.error ?? "Failed to change password."); return; }
      setPwOpen(false); setCurrPw(""); setNewPw(""); setConfPw(""); setPwErr("");
      showToast("Password changed successfully.");
    } catch { setPwErr("Network error. Please try again."); }
    finally  { setSavingPw(false); }
  };

  // ── Print receipt ─────────────────────────────────────────────────────────
  const printReceipt = (p: PaymentRecord) => {
    const w = window.open("", "_blank", "width=520,height=700");
    if (!w) return;
    const html = `<!DOCTYPE html><html><head><title>Frankstat Receipt</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Segoe UI',Arial,sans-serif,monospace,roboto;background:#fff;color:#1C1410;padding:40px 32px;}
  .logo{font-size:1.5rem;font-weight:900;letter-spacing:-0.02em;margin-bottom:4px;}
  .logo span{color:#C19A4A;}
  .sub{font-size:0.78rem;color:#888;margin-bottom:32px;}
  h2{font-size:1.1rem;font-weight:700;margin-bottom:20px;padding-bottom:10px;border-bottom:2px solid #F0E8DC;}
  .row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #F9F5EF;font-size:0.88rem;}
  .row .lbl{color:#888;font-weight:500;}
  .row .val{font-weight:600;color:#1C1410;}
  .amount{font-size:1.8rem;font-weight:900;color:#1C1410;margin:24px 0 4px;}
  .status-ok{display:inline-block;background:#D4EDDA;color:#155724;padding:4px 14px;border-radius:99px;font-size:0.78rem;font-weight:700;margin-bottom:24px;}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #F0E8DC;font-size:0.72rem;color:#aaa;text-align:center;line-height:1.8;}
  @media print{body{padding:24px;}}
</style></head><body>
  <div class="logo">FRAN<span>STAT</span></div>
  <div class="sub">Frankstat Printing Solutions · Nairobi, Kenya</div>
  <h2>Official Payment Receipt</h2>
  <div class="amount">KES ${p.amount.toLocaleString()}</div>
  <div class="status-ok">✓ ${p.status}</div>
  <div class="row"><span class="lbl">Receipt #</span><span class="val">${p.id.slice(0, 16).toUpperCase()}</span></div>
  <div class="row"><span class="lbl">Order Reference</span><span class="val">${(p.order?.id ?? p.id).slice(0, 12).toUpperCase()}…</span></div>
  <div class="row"><span class="lbl">Payment Type</span><span class="val">${p.type}</span></div>
  <div class="row"><span class="lbl">Method</span><span class="val">📱 M-Pesa</span></div>
  <div class="row"><span class="lbl">M-Pesa Code</span><span class="val">${p.mpesaRef || "—"}</span></div>
  <div class="row"><span class="lbl">Date</span><span class="val">${new Date(p.date ?? p.createdAt ?? new Date().toISOString()).toLocaleString("en-GB", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span></div>
  <div class="footer">
    This is an official Frankstat receipt.<br>
    Keep this for your records. Contact us at hello@frankstat.co.ke for any queries.<br>
    Generated ${new Date().toLocaleString("en-GB")}
  </div>
  <script>window.onload=()=>{window.print();}</script>
</body></html>`;
    w.document.write(html);
    w.document.close();
  };

  // ── Derived data ───────────────────────────────────────────────────────────
  const activeOrders = orders.filter(
    (o) => !["Completed", "Cancelled", "Refunded", "Payment Failed", "Payment Error"].includes(o.uiStatus)
  );
  const completedOrders = orders.filter((o) => o.uiStatus === "Completed");

  const filteredOrders = orders.filter((o) => {
    const matchFilter =
      orderFilter === "All" || o.uiStatus === orderFilter;
    const matchSearch =
      o.id.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.serviceName.toLowerCase().includes(orderSearch.toLowerCase());
    return matchFilter && matchSearch;
  });

  const latestActive = [...activeOrders].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0];

  const NAV_ITEMS: { id: Tab; icon: string; label: string }[] = [
    { id: "overview",  icon: "◈",  label: "Overview"    },
    { id: "orders",    icon: "🗂️", label: "My Orders"   },
    { id: "track",     icon: "📍", label: "Track Order" },
    { id: "payments",  icon: "💳", label: "Payments"    },
    { id: "profile",   icon: "👤", label: "My Profile"  },
  ];

  // ── Early returns ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'DM Sans', sans-serif",
          flexDirection: "column",
          gap: "1rem",
          color: "#7A6050",
        }}
      >
        <div style={{ fontSize: "2rem" }}>⏳</div>
        <div>Loading your dashboard…</div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'DM Sans', sans-serif",
          flexDirection: "column",
          gap: "1rem",
          color: "#922B21",
        }}
      >
        <div style={{ fontSize: "2rem" }}>❌</div>
        <div style={{ fontWeight: 700 }}>Error: {fetchError}</div>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: "0.5rem",
            background: "#1C1410",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "0.6rem 1.4rem",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const firstName = profile?.fullName?.split(" ")[0] ?? "there";
  const avatarInitial = profile?.fullName?.[0]?.toUpperCase() ?? "U";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @import url('https://googleapis.com');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Shell ── */
        .dash-shell {
          display: flex;
          min-height: 100vh;
          background: #F2F0FF;
          font-family: 'DM Sans', sans-serif;
        }

        /* ── Sidebar ── */
        .sidebar {
          width: 224px;
          min-height: 100vh;
          background: #0C0B1A;
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0; left: 0; bottom: 0;
          z-index: 200;
          transition: width 0.22s ease;
          overflow: hidden;
        }
        .sidebar.closed { width: 64px; }

        .sb-logo {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 1.2rem 1.2rem 1rem;
          text-decoration: none;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          white-space: nowrap;
          flex-shrink: 0;
        }
        .sb-logo-img { height: 32px; width: auto; object-fit: contain; flex-shrink: 0; }
        .gold { color: #FFD600; }
        .sb-txt { letter-spacing: 0.12em; font-size: 0.85rem; color: #fff; font-family: 'DM Sans', sans-serif; font-weight: 700; }
        .pill {
          background: rgba(220,0,110,0.18);
          color: #FF80C8;
          border: 1px solid rgba(220,0,110,0.35);
          font-size: 0.58rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          padding: 2px 7px;
          border-radius: 99px;
          margin-left: 0.3rem;
        }

        .sb-nav {
          flex: 1;
          padding: 1rem 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow: hidden;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.9rem;
          padding: 0.75rem 1.2rem;
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          border-radius: 0;
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
          font-size: 0.88rem;
          font-weight: 500;
          border-left: 3px solid transparent;
        }
        .nav-item:hover { background: rgba(255,255,255,0.05); color: #E0DDFF; }
        .nav-item.active { background: rgba(255,214,0,0.1); color: #FFD600; font-weight: 700; border-left-color: #FFD600; }
        .nav-icon { font-size: 1.05rem; flex-shrink: 0; width: 22px; text-align: center; }
        .nav-label { overflow: hidden; text-overflow: ellipsis; }

        .sb-footer {
          padding: 1rem 1rem 1.4rem;
          border-top: 1px solid rgba(255,255,255,0.07);
        }
        .user-chip {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          overflow: hidden;
        }
        .u-avatar {
          width: 36px; height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, #FFD600, #DC006E);
          color: #fff;
          font-size: 0.9rem;
          font-weight: 800;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          cursor: pointer;
          user-select: none;
        }
        .u-name { font-size: 0.82rem; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .u-tag { font-size: 0.7rem; color: #FFD600; font-weight: 600; }

        /* ── Main ── */
        .main {
          margin-left: 224px;
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          transition: margin-left 0.22s ease;
        }
        .main.closed { margin-left: 64px; }

        /* ── Topbar ── */
        .topbar {
          position: sticky; top: 0; z-index: 100;
          background: #fff;
          border-bottom: 1px solid #E4DEFF;
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0 1.8rem;
          height: 58px;
          box-shadow: 0 1px 4px rgba(12,11,26,0.06);
        }
        .collapse-btn {
          background: #F4F2FF;
          border: none;
          border-radius: 8px;
          width: 34px; height: 34px;
          font-size: 0.75rem;
          cursor: pointer;
          color: #3D3070;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s;
        }
        .collapse-btn:hover { background: #E4DEFF; }
        .topbar-title {
          flex: 1;
          font-family: "'DM Sans', sans-serif;
          font-size: 1rem;
          font-weight: 800;
          color: #12101E;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .topbar-actions { display: flex; align-items: center; gap: 0.6rem; }
        .icon-btn {
          background: #F4F2FF;
          border: none;
          border-radius: 8px;
          width: 34px; height: 34px;
          font-size: 1rem;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .icon-btn:hover { background: #E4DEFF; }

        /* notification panel */
        .notif-panel {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 280px;
          background: #fff;
          border: 1px solid #E4DEFF;
          border-radius: 12px;
          box-shadow: 0 8px 28px rgba(12,11,26,0.15);
          z-index: 400;
        }
        .notif-hdr {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.9rem 1rem 0.7rem;
          border-bottom: 1px solid #E4DEFF;
        }
        .notif-hdr-title {
          font-family: 'DM Sans', sans-serif;
          font-size: 0.88rem;
          font-weight: 800;
          color: #12101E;
        }

        /* ── Content ── */
        .content {
          flex: 1;
          padding: 2rem 2rem 3rem;
          max-width: 1200px;
          width: 100%;
        }

        /* ── Stats row ── */
        .stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1.1rem;
          margin-bottom: 1.8rem;
        }
        .stat-card {
          background: #fff;
          border: 1px solid #E4DEFF;
          border-radius: 14px;
          padding: 1.4rem 1.5rem;
        }
        .stat-icon { font-size: 1.4rem; margin-bottom: 0.5rem; }
        .stat-lbl { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin-bottom: 0.35rem; }
        .stat-val { font-size: 1.8rem; font-weight: 800; color: #12101E; line-height: 1; }
        .stat-sub { font-size: 0.75rem; color: #9CA3AF; margin-top: 0.3rem; }

        /* ── Section header ── */
        .sec-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
        .sec-title { font-family: 'DM Sans', sans-serif; font-size: 1rem; font-weight: 800; color: #12101E; }
        .sec-link { background: none; border: none; color: #FFD600; font-size: 0.82rem; font-weight: 700; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .sec-link:hover { text-decoration: underline; }

        /* ── Quick actions ── */
        .quick-actions { display: flex; gap: 1rem; margin-bottom: 1.8rem; flex-wrap: wrap; }
        .qa-btn {
          flex: 1; min-width: 120px;
          background: #fff;
          border: 1.5px solid #E4DEFF;
          border-radius: 12px;
          padding: 1.1rem 1rem;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .qa-btn:hover { border-color: #FFD600; box-shadow: 0 4px 14px rgba(255,214,0,0.14); }
        .qa-icon { font-size: 1.6rem; margin-bottom: 0.4rem; }
        .qa-label { font-size: 0.8rem; font-weight: 700; color: #12101E; }

        /* ── Two-column ── */
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.4rem; }
        @media (max-width: 900px) { .two-col { grid-template-columns: 1fr; } }

        /* ── Table wrapper ── */
        .tbl-wrap {
          background: #fff;
          border: 1px solid #E4DEFF;
          border-radius: 14px;
          overflow: hidden;
          margin-bottom: 1.4rem;
        }
        .tbl-bar {
          display: flex;
          gap: 0.8rem;
          padding: 1rem 1.2rem;
          border-bottom: 1px solid #E4DEFF;
          flex-wrap: wrap;
          align-items: center;
        }
        .srch-wrap {
          display: flex; align-items: center; gap: 0.5rem;
          background: #F4F2FF;
          border: 1px solid #E4DEFF;
          border-radius: 8px;
          padding: 0.45rem 0.85rem;
          flex: 1; min-width: 160px;
        }
        .srch-icon { font-size: 0.85rem; color: #9CA3AF; flex-shrink: 0; }
        .srch-inp { border: none; background: transparent; outline: none; font-size: 0.85rem; color: #12101E; width: 100%; font-family: 'DM Sans', sans-serif; }
        .flt-sel {
          background: #F4F2FF;
          border: 1px solid #E4DEFF;
          border-radius: 8px;
          padding: 0.45rem 0.85rem;
          font-size: 0.82rem;
          color: #12101E;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          outline: none;
        }
        .tbl-wrap table { width: 100%; border-collapse: collapse; }
        .tbl-wrap thead th {
          padding: 0.75rem 1.1rem;
          text-align: left;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #9CA3AF;
          background: #F8F7FF;
          border-bottom: 1px solid #E4DEFF;
          white-space: nowrap;
        }
        .tbl-wrap tbody td { padding: 0.85rem 1.1rem; font-size: 0.85rem; color: #12101E; border-bottom: 1px solid #F4F2FF; }
        .tbl-wrap tbody tr:last-child td { border-bottom: none; }
        .tbl-wrap tbody tr { cursor: pointer; transition: background 0.12s; }
        .tbl-wrap tbody tr:hover { background: #F8F7FF; }
        .tbl-foot { padding: 0.75rem 1.2rem; font-size: 0.75rem; color: #9CA3AF; border-top: 1px solid #E4DEFF; background: #F8F7FF; }

        /* ── Action / badge buttons ── */
        .act-btn {
          display: inline-block;
          padding: 0.22rem 0.75rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          border: none;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
        }
        .act-view { background: #DFFBFF; color: #006680; }
        .act-view:hover { background: #B0F0FA; }
        .pay-type-dep { background: #DFFBFF; color: #006680; }
        .pay-type-bal { background: #FFFBE0; color: #7A6200; }
        .pay-conf { background: #FFFBE0; color: #7A6200; }
        .pay-pend { background: #FFF0F8; color: #CC005A; }

        /* ── Profile ── */
        .profile-shell { display: grid; grid-template-columns: 280px 1fr; gap: 1.5rem; align-items: start; }
        @media (max-width: 860px) { .profile-shell { grid-template-columns: 1fr; } }
        .profile-card {
          background: #fff;
          border: 1px solid #E4DEFF;
          border-radius: 16px;
          padding: 2rem 1.5rem;
          text-align: center;
        }
        .profile-avatar-big {
          width: 72px; height: 72px; border-radius: 50%;
          background: linear-gradient(135deg, #FFD600, #DC006E);
          color: #fff; font-size: 1.8rem; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 1rem;
        }
        .profile-name { font-family: 'DM Sans', sans-serif; font-size: 1.15rem; font-weight: 900; color: #12101E; }
        .profile-email { font-size: 0.82rem; color: #9CA3AF; margin-top: 0.25rem; }
        .profile-badge {
          display: inline-block; margin-top: 0.7rem;
          background: #FFFBE0; color: #7A6200;
          font-size: 0.72rem; font-weight: 700;
          padding: 3px 10px; border-radius: 99px;
        }
        .profile-stat-row { display: flex; justify-content: center; gap: 1.5rem; margin-top: 1.3rem; padding-top: 1.1rem; border-top: 1px solid #E4DEFF; }
        .profile-stat { text-align: center; }
        .profile-stat-num { font-size: 1.3rem; font-weight: 800; color: #12101E; }
        .profile-stat-lbl { font-size: 0.68rem; color: #9CA3AF; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 1px; }
        .profile-details { background: #fff; border: 1px solid #E4DEFF; border-radius: 14px; padding: 1.5rem 1.6rem; }
        .info-grid { display: flex; flex-direction: column; gap: 0; }
        .info-item { display: flex; justify-content: space-between; align-items: center; padding: 0.7rem 0; border-bottom: 1px solid #F4F2FF; gap: 1rem; flex-wrap: wrap; }
        .info-item:last-child { border-bottom: none; }
        .info-item label { font-size: 0.78rem; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.08em; flex-shrink: 0; }
        .info-item span { font-size: 0.88rem; font-weight: 600; color: #12101E; text-align: right; word-break: break-all; }
        .prof-btn {
          width: 100%;
          padding: 0.7rem 1rem;
          background: #fff;
          border: 1.5px solid #E4DEFF;
          border-radius: 9px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.88rem;
          font-weight: 600;
          color: #12101E;
          cursor: pointer;
          text-align: left;
          transition: border-color 0.15s, background 0.15s;
        }
        .prof-btn:hover { border-color: #FFD600; background: #F8F7FF; }

        /* ── Skeleton pulse ── */
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }

        /* ── Responsive: collapse sidebar on small screens ── */
        @media (max-width: 640px) {
          .sidebar { width: 64px; }
          .main { margin-left: 64px; }
          .main.closed { margin-left: 64px; }
          .content { padding: 1.2rem 1rem 2rem; }
          .stats-row { grid-template-columns: 1fr 1fr; gap: 0.8rem; }
          .topbar { padding: 0 1rem; }
        }
      `}</style>
      <div className="dash-shell">
        {/* ══ SIDEBAR ══ */}
        <aside className={`sidebar${sidebarOpen ? "" : " closed"}`}>
          <Link href="/" className="sb-logo">
            <img src="/logo.png" alt="FrankStat" className="sb-logo-img"/>
            {sidebarOpen && (
              <span className="pill">MY ACCOUNT</span>
            )}
          </Link>
          <nav className="sb-nav">
            {NAV_ITEMS.map((item) => (
              <div
                key={item.id}
                className={`nav-item${tab === item.id ? " active" : ""}`}
                onClick={() => setTab(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                {sidebarOpen && (
                  <span className="nav-label">{item.label}</span>
                )}
              </div>
            ))}
          </nav>
          <div className="sb-footer">
            <div className="user-chip">
              <div
                className="u-avatar"
                onClick={() => setTab("profile")}
                title="View profile"
              >
                {avatarInitial}
              </div>
              {sidebarOpen && profile && (
                <div>
                  <div className="u-name">{profile.fullName}</div>
                  <div className="u-tag">
                    {profile.isVerified ? "✓ Verified" : "Member"}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ══ MAIN ══ */}
        <div className={`main${sidebarOpen ? "" : " closed"}`}>
          {/* TOPBAR */}
          <header className="topbar">
            <button
              className="collapse-btn"
              onClick={() => setSidebarOpen((o) => !o)}
            >
              {sidebarOpen ? "◀" : "▶"}
            </button>
            <div className="topbar-title">
              {tab === "overview"  && `Hi ${firstName} 👋`}
              {tab === "orders"    && "My Orders"}
              {tab === "track"     && "Track My Order"}
              {tab === "payments"  && "Payment History"}
              {tab === "profile"   && "My Profile"}
            </div>
            <div className="topbar-actions">
              <div style={{ position: "relative" }}>
                <button
                  className="icon-btn"
                  onClick={() => setNotifOpen((o) => !o)}
                >
                  🔔
                </button>
                {notifOpen && (
                  <div className="notif-panel">
                    <div className="notif-hdr">
                      <span className="notif-hdr-title">Notifications</span>
                      <button
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          color: "#C19A4A",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                        }}
                        onClick={() => setNotifOpen(false)}
                      >
                        Close
                      </button>
                    </div>
                    <div
                      style={{
                        padding: "1rem",
                        fontSize: "0.82rem",
                        color: "#A89070",
                      }}
                    >
                      Notifications coming soon.
                    </div>
                  </div>
                )}
              </div>
              <Link href="/" style={{ textDecoration: "none" }}>
                <button className="icon-btn" title="Back to site">
                  🏠
                </button>
              </Link>
              <div
                className="u-avatar"
                style={{ width: "34px", height: "34px", cursor: "pointer" }}
                onClick={() => setTab("profile")}
              >
                {avatarInitial}
              </div>
            </div>
          </header>

          <div className="content">
            {/* ══════════ OVERVIEW ══════════ */}
            {tab === "overview" && stats && (
              <>
                <div className="stats-row">
                  <div
                    className="stat-card"
                    style={{ borderTop: "3px solid #FFD600" }}
                  >
                    <div className="stat-icon">🗂️</div>
                    <div className="stat-lbl">Total Orders</div>
                    <div className="stat-val">{stats.totalOrders}</div>
                    <div className="stat-sub">{stats.activeOrders} active</div>
                  </div>
                  <div
                    className="stat-card"
                    style={{ borderTop: "3px solid #00CCDD" }}
                  >
                    <div className="stat-icon">✅</div>
                    <div className="stat-lbl">Completed</div>
                    <div className="stat-val">{stats.completedOrders}</div>
                    <div className="stat-sub">Projects done</div>
                  </div>
                  <div
                    className="stat-card"
                    style={{ borderTop: "3px solid #DC006E" }}
                  >
                    <div className="stat-icon">💰</div>
                    <div className="stat-lbl">Total Paid</div>
                    <div
                      className="stat-val"
                      style={{ fontSize: "1.3rem" }}
                    >
                      {fmt(stats.totalPaid)}
                    </div>
                    <div className="stat-sub">Across all orders</div>
                  </div>
                  <div
                    className="stat-card"
                    style={{ borderTop: "3px solid #FFD600" }}
                  >
                    <div className="stat-icon">⏳</div>
                    <div className="stat-lbl">Pending Balance</div>
                    <div
                      className="stat-val"
                      style={{
                        fontSize: "1.3rem",
                        color:
                          stats.pendingBalance > 0 ? "#DC006E" : "#00CCDD",
                      }}
                    >
                      {fmt(stats.pendingBalance)}
                    </div>
                    <div className="stat-sub">Balance on active orders</div>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="sec-hdr">
                  <div className="sec-title">Quick Actions</div>
                </div>
                <div className="quick-actions">
                  {[
                    {
                      icon: "📦",
                      label: "Place New Order",
                      action: () => window.open("/", "_blank"),
                    },
                    {
                      icon: "📍",
                      label: "Track Order",
                      action: () => setTab("track"),
                    },
                    {
                      icon: "👤",
                      label: "Edit Profile",
                      action: () => setTab("profile"),
                    },
                  ].map((q) => (
                    <div key={q.label} className="qa-btn" onClick={q.action}>
                      <div className="qa-icon">{q.icon}</div>
                      <div className="qa-label">{q.label}</div>
                    </div>
                  ))}
                </div>

                {/* Active order tracker */}
                {latestActive && (
                  <div style={{ marginBottom: "1.5rem" }}>
                    <div className="sec-hdr">
                      <div className="sec-title">Currently Active Order</div>
                      <button
                        className="sec-link"
                        onClick={() => setTab("track")}
                      >
                        See all active →
                      </button>
                    </div>
                    <ProgressTracker order={latestActive} />
                  </div>
                )}

                {/* Recent orders mini */}
                <div className="two-col">
                  <div>
                    <div className="sec-hdr">
                      <div className="sec-title">Recent Orders</div>
                      <button
                        className="sec-link"
                        onClick={() => setTab("orders")}
                      >
                        View all →
                      </button>
                    </div>
                    <div className="tbl-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Order</th>
                            <th>Service</th>
                            <th>Amount</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.slice(0, 5).map((o) => (
                            <tr
                              key={o.id}
                              onClick={() => setOrderDetailModal(o)}
                            >
                              <td>
                                <span
                                  style={{
                                    fontFamily: "monospace",
                                    fontSize: "0.78rem",
                                    color: "#8B7355",
                                  }}
                                >
                                  {o.id.slice(0, 10)}…
                                </span>
                              </td>
                              <td>🖨️ {o.serviceName}</td>
                              <td style={{ fontWeight: 700 }}>
                                {fmt(o.totalPrice)}
                              </td>
                              <td>
                                <Badge
                                  label={
                                    STATUS_META[o.uiStatus].icon +
                                    " " +
                                    o.uiStatus
                                  }
                                  color={STATUS_META[o.uiStatus].color}
                                  bg={STATUS_META[o.uiStatus].bg}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Recent payments */}
                  <div>
                    <div className="sec-hdr">
                      <div className="sec-title">Recent Payments</div>
                      <button
                        className="sec-link"
                        onClick={() => setTab("payments")}
                      >
                        View all →
                      </button>
                    </div>
                    <div className="tbl-wrap">
                      {payments.slice(0, 5).map((p, i) => (
                        <div
                          key={p.id}
                          style={{
                            padding: "0.8rem 1.2rem",
                            borderBottom:
                              i < 4 ? "1px solid #FAF6F1" : "none",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "0.5rem",
                            cursor: "pointer",
                          }}
                          onClick={() => setPaymentDetailModal(p)}
                        >
                          <div>
                            <div
                              style={{
                                fontWeight: 600,
                                fontSize: "0.85rem",
                                color: "#1C1410",
                              }}
                            >
                              {p.type} — {(p.order?.id ?? p.id).slice(0, 10)}…
                            </div>
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "#A89070",
                                marginTop: "1px",
                              }}
                            >
                              {fmtD(p.date ?? p.createdAt ?? "")} · {p.mpesaRef}
                            </div>
                          </div>
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: "0.9rem",
                              color:
                                p.type === "Deposit" ? "#1A5276" : "#1A6B3A",
                              flexShrink: 0,
                            }}
                          >
                            {fmt(p.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ══════════ ORDERS ══════════ */}
            {tab === "orders" && (
              <div className="tbl-wrap">
                <div className="tbl-bar">
                  <div className="srch-wrap">
                    <span className="srch-icon">🔍</span>
                    <input
                      className="srch-inp"
                      placeholder="Search orders…"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                    />
                  </div>
                  <select
                    className="flt-sel"
                    value={orderFilter}
                    onChange={(e) =>
                      setOrderFilter(e.target.value as any)
                    }
                  >
                    <option value="All">All Statuses</option>
                    {(
                      [
                        "Pending",
                        "In Production",
                        "Quality Check",
                        "Ready",
                        "Delivering",
                        "Completed",
                        "Payment Failed",
                        "Payment Error",
                        "Cancelled",
                        "Refunded",
                      ] as ProjectStatus[]
                    ).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Service</th>
                        <th>Dimensions</th>
                        <th>Qty</th>
                        <th>Total</th>
                        <th>Deposit</th>
                        <th>Balance</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td
                            colSpan={10}
                            style={{
                              textAlign: "center",
                              padding: "2.5rem",
                              color: "#A89070",
                            }}
                          >
                            No orders found.
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((o) => (
                          <tr
                            key={o.id}
                            onClick={() => setOrderDetailModal(o)}
                          >
                            <td>
                              <span
                                style={{
                                  fontFamily: "monospace",
                                  fontSize: "0.8rem",
                                  color: "#8B7355",
                                  fontWeight: 700,
                                }}
                              >
                                {o.id.slice(0, 12)}…
                              </span>
                            </td>
                            <td>🖨️ {o.serviceName}</td>
                            <td
                              style={{
                                fontSize: "0.82rem",
                                color: "#5C4A38",
                              }}
                            >
                              {o.dimensions ?? "—"}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {o.quantity}
                            </td>
                            <td style={{ fontWeight: 700 }}>
                              {fmt(o.totalPrice)}
                            </td>
                            <td
                              style={{
                                color: "#1A6B3A",
                                fontWeight: 600,
                              }}
                            >
                              {fmt(o.depositAmount)}
                            </td>
                            <td
                              style={{
                                color: o.balanceDue > 0 ? "#CC005A" : "#15803D",
                                fontWeight: 600,
                              }}
                            >
                              {fmt(o.balanceDue)}
                            </td>
                            <td>
                              <Badge
                                label={STATUS_META[o.uiStatus].icon + " " + o.uiStatus}
                                color={STATUS_META[o.uiStatus].color}
                                bg={STATUS_META[o.uiStatus].bg}
                              />
                            </td>
                            <td
                              style={{
                                color: "#9CA3AF",
                                fontSize: "0.8rem",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {fmtD(o.createdAt)}
                            </td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <div style={{ display: "flex", gap: 5 }}>
                                <button
                                  className="act-btn act-view"
                                  onClick={() => setOrderDetailModal(o)}
                                >
                                  View
                                </button>
                                {o.balanceDue > 0 && BALANCE_ALLOWED.includes(o.status) && (
                                  <button
                                    className="act-btn"
                                    style={{ background: "#FFFBE0", color: "#7A6200", border: "1px solid #FFD600" }}
                                    onClick={() => { setPayBalanceOrder(o); setPayBalancePhone(o.mpesaPhone ?? ""); }}
                                  >
                                    Pay Balance
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="tbl-foot">
                  {filteredOrders.length} of {orders.length} orders · Click
                  any row for details
                </div>
              </div>
            )}

            {/* ══════════ TRACK ══════════ */}
            {tab === "track" && (
              <>
                <p
                  style={{
                    fontSize: "0.88rem",
                    color: "#7A6050",
                    marginBottom: "1.5rem",
                    lineHeight: 1.7,
                  }}
                >
                  Live progress of all your active orders, updated by the
                  Frankstat team in real time.
                </p>
                {activeOrders.length === 0 ? (
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #F0E8DC",
                      borderRadius: "14px",
                      padding: "3rem",
                      textAlign: "center",
                      color: "#A89070",
                    }}
                  >
                    <div style={{ fontSize: "2.5rem", marginBottom: "0.8rem" }}>
                      📭
                    </div>
                    <div
                      style={{
                        fontFamily: "'Playfair Display',serif",
                        fontSize: "1rem",
                        fontWeight: 700,
                        marginBottom: "0.4rem",
                        color: "#1C1410",
                      }}
                    >
                      No active orders
                    </div>
                    <p style={{ fontSize: "0.85rem" }}>
                      All your orders have been completed or cancelled.
                    </p>
                    <button
                      style={{
                        marginTop: "1.2rem",
                        background: "#1C1410",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        padding: "0.7rem 1.5rem",
                        fontFamily: "'DM Sans',sans-serif",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      onClick={() => window.open("/", "_blank")}
                    >
                      Place a New Order
                    </button>
                  </div>
                ) : (
                  [...activeOrders]
                    .sort(
                      (a, b) =>
                        new Date(b.updatedAt).getTime() -
                        new Date(a.updatedAt).getTime()
                    )
                    .map((o) => <ProgressTracker key={o.id} order={o} />)
                )}

                {completedOrders.length > 0 && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <div
                      className="sec-hdr"
                      style={{ marginBottom: "0.8rem" }}
                    >
                      <div className="sec-title">Recently Completed</div>
                    </div>
                    {completedOrders.map((o) => (
                      <div
                        key={o.id}
                        style={{
                          background: "#fff",
                          border: "1px solid #F0E8DC",
                          borderRadius: "12px",
                          padding: "1.2rem 1.5rem",
                          marginBottom: "0.8rem",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "0.5rem",
                          cursor: "pointer",
                        }}
                        onClick={() => setOrderDetailModal(o)}
                      >
                        <div>
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: "0.8rem",
                              color: "#8B7355",
                              marginRight: "0.7rem",
                            }}
                          >
                            {o.id.slice(0, 12)}…
                          </span>
                          <span
                            style={{ fontWeight: 600, fontSize: "0.88rem" }}
                          >
                            🖨️ {o.serviceName}
                          </span>
                          <span
                            style={{
                              fontSize: "0.8rem",
                              color: "#A89070",
                              marginLeft: "0.6rem",
                            }}
                          >
                            · {fmtD(o.updatedAt)}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.8rem",
                          }}
                        >
                          <span
                            style={{ fontWeight: 700, fontSize: "0.88rem" }}
                          >
                            {fmt(o.totalPrice)}
                          </span>
                          <Badge
                            label="✅ Completed"
                            color="#155724"
                            bg="#D4EDDA"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ══════════ PAYMENTS ══════════ */}
            {tab === "payments" && stats && (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3,1fr)",
                    gap: "1.1rem",
                    marginBottom: "1.5rem",
                  }}
                >
                  {[
                    {
                      label: "Total Paid",
                      value: fmt(stats.totalPaid),
                      icon: "💳",
                      color: "#1A6B3A",
                    },
                    {
                      label: "No. of Transactions",
                      value: String(stats.totalTransactions),
                      icon: "📋",
                      color: "#1A5276",
                    },
                    {
                      label: "Pending Balance",
                      value: fmt(stats.pendingBalance),
                      icon: "⏳",
                      color: stats.pendingBalance > 0 ? "#C0392B" : "#1A6B3A",
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="stat-card"
                      style={{ borderTop: `3px solid ${s.color}` }}
                    >
                      <div className="stat-icon">{s.icon}</div>
                      <div className="stat-lbl">{s.label}</div>
                      <div
                        className="stat-val"
                        style={{ fontSize: "1.4rem", color: s.color }}
                      >
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Outstanding Balances ── */}
                {orders.filter(o => o.balanceDue > 0 && BALANCE_ALLOWED.includes(o.status)).length > 0 && (
                  <div style={{ background: "#FFFBE0", border: "1.5px solid #FFD600", borderRadius: 12, padding: "14px 18px", marginBottom: "1.4rem" }}>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "#7A6200", marginBottom: 10 }}>
                      ⚠️ Outstanding Balances
                    </div>
                    {orders.filter(o => o.balanceDue > 0 && BALANCE_ALLOWED.includes(o.status)).map(o => (
                      <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,214,0,0.25)", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#12101E" }}>🖨️ {o.serviceName}</div>
                          <div style={{ fontSize: "0.75rem", color: "#9CA3AF", marginTop: 2 }}>
                            {STATUS_META[o.uiStatus].icon} {o.uiStatus} · Balance due: <strong style={{ color: "#CC005A" }}>{fmt(o.balanceDue)}</strong>
                          </div>
                        </div>
                        <button
                          style={{ background: "#0C0B1A", color: "#FFD600", border: "none", borderRadius: 7, padding: "7px 16px", fontFamily: "'DM Sans',sans-serif", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}
                          onClick={() => { setPayBalanceOrder(o); setPayBalancePhone(o.mpesaPhone ?? ""); }}
                        >
                          Pay Now
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="tbl-wrap">
                  <div
                    style={{
                      padding: "1rem 1.5rem",
                      borderBottom: "1px solid #E4DEFF",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: "0.95rem",
                        fontWeight: 800,
                        color: "#12101E",
                      }}
                    >
                      All Transactions
                    </span>
                    <span
                      style={{ fontSize: "0.78rem", color: "#9CA3AF" }}
                    >
                      Read-only · All payments via M-Pesa
                    </span>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Ref ID</th>
                          <th>Order</th>
                          <th>Type</th>
                          <th>Amount</th>
                          <th>M-Pesa Ref</th>
                          <th>Date</th>
                          <th>Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.length === 0 ? (
                          <tr>
                            <td
                              colSpan={8}
                              style={{
                                textAlign: "center",
                                padding: "2.5rem",
                                color: "#A89070",
                              }}
                            >
                              No payment records yet.
                            </td>
                          </tr>
                        ) : (
                          payments.map((p) => (
                            <tr
                              key={p.id}
                              onClick={() => setPaymentDetailModal(p)}
                            >
                              <td>
                                <span
                                  style={{
                                    fontFamily: "monospace",
                                    fontSize: "0.78rem",
                                    color: "#8B7355",
                                  }}
                                >
                                  {p.id.slice(0, 14)}…
                                </span>
                              </td>
                              <td>
                                <span
                                  style={{
                                    fontFamily: "monospace",
                                    fontSize: "0.8rem",
                                    color: "#1A5276",
                                    fontWeight: 600,
                                  }}
                                >
                                  {(p.order?.id ?? p.id).slice(0, 12)}…
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`act-btn ${
                                    p.type === "Deposit"
                                      ? "pay-type-dep"
                                      : "pay-type-bal"
                                  }`}
                                >
                                  {p.type}
                                </span>
                              </td>
                              <td style={{ fontWeight: 800, fontSize: "0.92rem" }}>
                                {fmt(p.amount)}
                              </td>
                              <td>
                                <code
                                  style={{
                                    fontSize: "0.78rem",
                                    background: "#F5EFE6",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    color: "#5C4A38",
                                  }}
                                >
                                  {p.mpesaRef}
                                </code>
                              </td>
                              <td
                                style={{
                                  color: "#A89070",
                                  fontSize: "0.82rem",
                                }}
                              >
                                {fmtD(p.date ?? p.createdAt ?? "")}
                              </td>
                              <td>
                                <span
                                  className={`act-btn ${
                                    p.status === "Confirmed"
                                      ? "pay-conf"
                                      : "pay-pend"
                                  }`}
                                >
                                  {p.status === "Confirmed" ? "✓ " : "⏳ "}
                                  {p.status}
                                </span>
                              </td>
                              <td onClick={(e) => e.stopPropagation()}>
                                <button
                                  className="act-btn act-view"
                                  onClick={() => setPaymentDetailModal(p)}
                                >
                                  Receipt
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="tbl-foot">
                    All M-Pesa transactions are automatically confirmed.
                    Contact support for any discrepancies.
                  </div>
                </div>
              </>
            )}

            {/* ══════════ PROFILE ══════════ */}
            {tab === "profile" && profile && (
              <div className="profile-shell">
                <div className="profile-card">
                  <div className="profile-avatar-big">{avatarInitial}</div>
                  <div className="profile-name">{profile.fullName}</div>
                  <div className="profile-email">{profile.email}</div>
                  {profile.isVerified && (
                    <div className="profile-badge">✓ Verified Member</div>
                  )}
                  <div className="profile-stat-row">
                    <div className="profile-stat">
                      <div className="profile-stat-num">{orders.length}</div>
                      <div className="profile-stat-lbl">Orders</div>
                    </div>
                    <div className="profile-stat">
                      <div className="profile-stat-num">
                        {completedOrders.length}
                      </div>
                      <div className="profile-stat-lbl">Done</div>
                    </div>
                    <div className="profile-stat">
                      <div className="profile-stat-num">
                        {payments.length}
                      </div>
                      <div className="profile-stat-lbl">Pays</div>
                    </div>
                  </div>
                </div>

                <div>
                  {/* ── Personal Information ── */}
                  <div
                    className="profile-details"
                    style={{ marginBottom: "1.2rem" }}
                  >
                    <div
                      style={{
                        fontFamily: "'DM Sans',serif",
                        fontWeight: 900,
                        fontSize: "1rem",
                        color: "#1C1410",
                        marginBottom: "1.2rem",
                        paddingBottom: "0.8rem",
                        borderBottom: "1px solid #F0E8DC",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      Personal Information
                      {!profileEditing && (
                        <button
                          className="act-btn act-view"
                          onClick={() => {
                            setEditName(profile.fullName);
                            setEditPhone(profile.phone ?? "");
                            setProfileEditing(true);
                          }}
                        >
                          ✏️ Edit
                        </button>
                      )}
                    </div>

                    {profileEditing ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                        <div>
                          <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#A89070", textTransform: "uppercase" as const, letterSpacing: "0.08em", display: "block", marginBottom: "0.35rem" }}>
                            Full Name
                          </label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            style={{ width: "100%", padding: "0.6rem 0.85rem", border: "1.5px solid #F0E8DC", borderRadius: "8px", fontSize: "0.88rem", fontFamily: "'DM Sans',sans-serif", color: "#1C1410", outline: "none" }}
                            onFocus={(e) => (e.target.style.borderColor = "#C19A4A")}
                            onBlur={(e)  => (e.target.style.borderColor = "#F0E8DC")}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#A89070", textTransform: "uppercase" as const, letterSpacing: "0.08em", display: "block", marginBottom: "0.35rem" }}>
                            Phone
                          </label>
                          <input
                            type="tel"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            placeholder="e.g. 0712345678"
                            style={{ width: "100%", padding: "0.6rem 0.85rem", border: "1.5px solid #F0E8DC", borderRadius: "8px", fontSize: "0.88rem", fontFamily: "'DM Sans',sans-serif", color: "#1C1410", outline: "none" }}
                            onFocus={(e) => (e.target.style.borderColor = "#C19A4A")}
                            onBlur={(e)  => (e.target.style.borderColor = "#F0E8DC")}
                          />
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "#A89070", background: "#FAF6F1", borderRadius: "6px", padding: "0.5rem 0.75rem" }}>
                          Email cannot be changed here. Contact support if needed.
                        </div>
                        <div style={{ display: "flex", gap: "0.6rem" }}>
                          <button
                            onClick={handleSaveProfile}
                            disabled={savingProfile}
                            style={{ flex: 1, padding: "0.65rem 1rem", background: "#1C1410", color: "#fff", border: "none", borderRadius: "8px", fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: "0.88rem", cursor: savingProfile ? "not-allowed" : "pointer", opacity: savingProfile ? 0.6 : 1 }}
                          >
                            {savingProfile ? "Saving…" : "Save Changes"}
                          </button>
                          <button
                            onClick={() => setProfileEditing(false)}
                            disabled={savingProfile}
                            style={{ padding: "0.65rem 1rem", background: "#F5EFE6", color: "#5C4A38", border: "none", borderRadius: "8px", fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="info-grid">
                        {[
                          { label: "Full Name",    value: profile.fullName        },
                          { label: "Email",        value: profile.email           },
                          { label: "Phone",        value: profile.phone ?? "—"    },
                          { label: "Member Since", value: fmtD(profile.createdAt) },
                          { label: "Verified",     value: profile.isVerified ? "Yes ✓" : "Pending" },
                        ].map((f) => (
                          <div key={f.label} className="info-item">
                            <label>{f.label}</label>
                            <span>{f.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Account Actions ── */}
                  <div className="profile-details">
                    <div
                      style={{
                        fontFamily: "'Playfair Display',serif",
                        fontWeight: 900,
                        fontSize: "1rem",
                        color: "#1C1410",
                        marginBottom: "1rem",
                      }}
                    >
                      Account Actions
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                      <button
                        className="prof-btn"
                        onClick={() => {
                          setEditName(profile.fullName);
                          setEditPhone(profile.phone ?? "");
                          setProfileEditing(true);
                        }}
                      >
                        ✏️ Edit Profile
                      </button>
                      <button
                        className="prof-btn"
                        onClick={() => { setPwErr(""); setPwOpen(true); }}
                      >
                        🔒 Change Password
                      </button>
                      <button
                        className="prof-btn"
                        style={{ color: "#922B21", borderColor: "#FADBD8" }}
                        onClick={() => (window.location.href = "/api/auth/logout")}
                      >
                        ↩ Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════ MODALS ══════════ */}

      {/* Order Detail */}
      {orderDetailModal && (
        <Modal
          title={`Order Details`}
          onClose={() => setOrderDetailModal(null)}
          wide
        >
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              flexWrap: "wrap",
              marginBottom: "1.2rem",
            }}
          >
            <Badge
              label={
                STATUS_META[orderDetailModal.uiStatus].icon +
                " " +
                orderDetailModal.uiStatus
              }
              color={STATUS_META[orderDetailModal.uiStatus].color}
              bg={STATUS_META[orderDetailModal.uiStatus].bg}
            />
            <Badge
              label={`🖨️ ${orderDetailModal.serviceName}`}
              color="#5C4A38"
              bg="#F0E8DC"
            />
            {!orderDetailModal.artworkUrl && (
              <Badge label="⚠️ No Artwork" color="#922B21" bg="#FDEDEC" />
            )}
          </div>

          {!["Completed", "Cancelled"].includes(
            orderDetailModal.uiStatus
          ) && (
            <div style={{ marginBottom: "1.2rem" }}>
              <ProgressTracker order={orderDetailModal} />
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.6rem 1.5rem",
              marginBottom: "1.2rem",
            }}
          >
            {[
              { l: "Order ID",      v: orderDetailModal.id                         },
              { l: "Service",       v: orderDetailModal.serviceName                 },
              ...(orderDetailModal.dimensions
                ? [{ l: "Dimensions", v: orderDetailModal.dimensions }]
                : []),
              ...(orderDetailModal.finishType
                ? [{ l: "Finish", v: orderDetailModal.finishType }]
                : []),
              { l: "Quantity",      v: String(orderDetailModal.quantity)            },
              { l: "Total Amount",  v: fmt(orderDetailModal.totalPrice)             },
              { l: "Deposit Paid",  v: fmt(orderDetailModal.depositAmount)          },
              {
                l: "Balance Due",
                v: fmt(
                  orderDetailModal.totalPrice - orderDetailModal.depositAmount
                ),
              },
              {
                l: "Artwork",
                v: orderDetailModal.artworkUrl ? "✅ Uploaded" : "❌ Pending",
              },
              { l: "Date Placed",   v: fmtD(orderDetailModal.createdAt)            },
              { l: "Last Updated",  v: fmtD(orderDetailModal.updatedAt)            },
              ...(orderDetailModal.mpesaReceipt
                ? [{ l: "M-Pesa Receipt", v: orderDetailModal.mpesaReceipt }]
                : []),
            ].map((d) => (
              <div
                key={d.l}
                style={{
                  paddingBottom: "0.6rem",
                  borderBottom: "1px solid #FAF6F1",
                }}
              >
                <div
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "#A89070",
                    marginBottom: "0.15rem",
                  }}
                >
                  {d.l}
                </div>
                <div
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    color: "#1C1410",
                    wordBreak: "break-all",
                  }}
                >
                  {d.v}
                </div>
              </div>
            ))}
          </div>

          {orderDetailModal.specialNotes && (
            <div
              style={{
                background: "#FFFBF4",
                border: "1.5px solid #F0D98C",
                borderRadius: "8px",
                padding: "0.85rem 1rem",
                marginBottom: "1rem",
                display: "flex",
                gap: "0.5rem",
              }}
            >
              <span>💬</span>
              <div>
                <div
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    color: "#8B6914",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: "0.2rem",
                  }}
                >
                  Order Notes
                </div>
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "#5C4A38",
                    lineHeight: 1.6,
                  }}
                >
                  {orderDetailModal.specialNotes}
                </p>
              </div>
            </div>
          )}

          <button
            onClick={() => setOrderDetailModal(null)}
            style={{
              width: "100%",
              padding: "0.75rem",
              background: "#1C1410",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 700,
              color: "#fff",
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            Close
          </button>
        </Modal>
      )}

      {/* Payment Receipt */}
      {paymentDetailModal && (
        <Modal
          title="Payment Receipt"
          onClose={() => setPaymentDetailModal(null)}
        >
          <div
            style={{
              textAlign: "center",
              marginBottom: "1.5rem",
            }}
          >
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: "#D4EDDA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.8rem",
                margin: "0 auto 0.8rem",
              }}
            >
              ✅
            </div>
            <div
              style={{
                fontFamily: "'Playfair Display',serif",
                fontSize: "1.6rem",
                fontWeight: 900,
                color: "#1C1410",
              }}
            >
              {fmt(paymentDetailModal.amount)}
            </div>
            <div
              style={{ fontSize: "0.84rem", color: "#A89070", marginTop: "0.3rem" }}
            >
              Payment Confirmed
            </div>
          </div>
          <div
            style={{
              background: "#FAF6F1",
              borderRadius: "12px",
              padding: "1.2rem 1.4rem",
            }}
          >
            {[
              { label: "Order",        value: paymentDetailModal.order?.id ?? paymentDetailModal.id },
              { label: "Payment Type", value: paymentDetailModal.type     },
              { label: "Method",       value: "📱 M-Pesa"                 },
              { label: "M-Pesa Code",  value: paymentDetailModal.mpesaRef },
              { label: "Date",         value: fmtD(paymentDetailModal.date ?? paymentDetailModal.createdAt ?? "") },
              { label: "Status",       value: paymentDetailModal.status   },
            ].map((r) => (
              <div
                key={r.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.55rem 0",
                  borderBottom: "1px solid #F0E8DC",
                  fontSize: "0.85rem",
                }}
              >
                <span style={{ color: "#7A6050", fontWeight: 500 }}>
                  {r.label}
                </span>
                <span
                  style={{
                    color: "#1C1410",
                    fontWeight: 700,
                    fontFamily:
                      r.label === "M-Pesa Code" ? "monospace" : "inherit",
                  }}
                >
                  {r.value}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem" }}>
            <button
              onClick={() => printReceipt(paymentDetailModal)}
              style={{
                flex: 1,
                padding: "0.8rem",
                background: "#F5EFE6",
                border: "1.5px solid #F0E8DC",
                borderRadius: "8px",
                color: "#5C4A38",
                fontFamily: "'DM Sans',sans-serif",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: "0.88rem",
              }}
            >
              🖨️ Print / Download
            </button>
            <button
              onClick={() => setPaymentDetailModal(null)}
              style={{
                flex: 1,
                padding: "0.8rem",
                background: "#1C1410",
                border: "none",
                borderRadius: "8px",
                color: "#fff",
                fontFamily: "'DM Sans',sans-serif",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: "0.88rem",
              }}
            >
              Done
            </button>
          </div>
        </Modal>
      )}

      {/* ══════════ PAY BALANCE MODAL ══════════ */}
      {payBalanceOrder && (
        <Modal
          title="Complete Payment"
          onClose={() => { setPayBalanceOrder(null); setPayBalancePhone(""); }}
        >
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ background: "#FFFBE0", border: "1px solid #FFD600", borderRadius: 8, padding: "10px 14px", marginBottom: "1rem" }}>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#7A6200" }}>🖨️ {payBalanceOrder.serviceName}</div>
              <div style={{ fontSize: "0.82rem", color: "#9CA3AF", marginTop: 3 }}>
                Balance due: <strong style={{ color: "#CC005A", fontSize: "1rem" }}>{fmt(payBalanceOrder.balanceDue)}</strong>
              </div>
            </div>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: "0.35rem" }}>
              M-Pesa Phone Number
            </label>
            <input
              type="tel"
              placeholder="e.g. 0712 345 678"
              value={payBalancePhone}
              onChange={(e) => setPayBalancePhone(e.target.value)}
              style={{ width: "100%", background: "#F4F2FF", border: "1.5px solid #E4DEFF", borderRadius: 8, padding: "10px 12px", fontFamily: "'DM Sans',sans-serif", fontSize: "0.88rem", color: "#12101E", outline: "none" }}
            />
            <p style={{ fontSize: "0.75rem", color: "#9CA3AF", marginTop: "0.4rem" }}>
              You will receive an M-Pesa STK push prompt on this number to complete the payment.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button
              onClick={() => { setPayBalanceOrder(null); setPayBalancePhone(""); }}
              style={{ flex: 1, padding: "0.8rem", background: "#F4F2FF", border: "1.5px solid #E4DEFF", borderRadius: 8, color: "#374151", fontFamily: "'DM Sans',sans-serif", fontWeight: 600, cursor: "pointer", fontSize: "0.88rem" }}
            >
              Cancel
            </button>
            <button
              onClick={handlePayBalance}
              disabled={payBalanceSaving || !payBalancePhone.trim()}
              style={{ flex: 1, padding: "0.8rem", background: payBalanceSaving ? "#3D3070" : "#0C0B1A", border: "none", borderRadius: 8, color: "#FFD600", fontFamily: "'DM Sans',sans-serif", fontWeight: 700, cursor: payBalanceSaving ? "default" : "pointer", fontSize: "0.88rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: (!payBalancePhone.trim() && !payBalanceSaving) ? 0.5 : 1 }}
            >
              {payBalanceSaving ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.25)", borderTopColor: "#FFD600", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }}/> Sending…</> : "Send M-Pesa Prompt"}
            </button>
          </div>
        </Modal>
      )}

      {/* ══════════ CHANGE PASSWORD MODAL ══════════ */}
      {pwOpen && (
        <Modal
          title="Change Password"
          onClose={() => {
            setPwOpen(false);
            setCurrPw(""); setNewPw(""); setConfPw(""); setPwErr("");
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#A89070", textTransform: "uppercase" as const, letterSpacing: "0.08em", display: "block", marginBottom: "0.35rem" }}>
                Current Password
              </label>
              <input
                type="password"
                value={currPw}
                onChange={(e) => setCurrPw(e.target.value)}
                style={{ width: "100%", padding: "0.65rem 0.9rem", border: "1.5px solid #F0E8DC", borderRadius: "8px", fontSize: "0.88rem", fontFamily: "'DM Sans',sans-serif", color: "#1C1410", outline: "none" }}
                onFocus={(e) => (e.target.style.borderColor = "#C19A4A")}
                onBlur={(e)  => (e.target.style.borderColor = "#F0E8DC")}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#A89070", textTransform: "uppercase" as const, letterSpacing: "0.08em", display: "block", marginBottom: "0.35rem" }}>
                New Password
              </label>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                style={{ width: "100%", padding: "0.65rem 0.9rem", border: "1.5px solid #F0E8DC", borderRadius: "8px", fontSize: "0.88rem", fontFamily: "'DM Sans',sans-serif", color: "#1C1410", outline: "none" }}
                onFocus={(e) => (e.target.style.borderColor = "#C19A4A")}
                onBlur={(e)  => (e.target.style.borderColor = "#F0E8DC")}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#A89070", textTransform: "uppercase" as const, letterSpacing: "0.08em", display: "block", marginBottom: "0.35rem" }}>
                Confirm New Password
              </label>
              <input
                type="password"
                value={confPw}
                onChange={(e) => setConfPw(e.target.value)}
                style={{ width: "100%", padding: "0.65rem 0.9rem", border: "1.5px solid #F0E8DC", borderRadius: "8px", fontSize: "0.88rem", fontFamily: "'DM Sans',sans-serif", color: "#1C1410", outline: "none" }}
                onFocus={(e) => (e.target.style.borderColor = "#C19A4A")}
                onBlur={(e)  => (e.target.style.borderColor = "#F0E8DC")}
              />
            </div>
            {pwErr && (
              <div style={{ background: "#FDEDEC", border: "1px solid #FADBD8", borderRadius: "7px", padding: "0.6rem 0.85rem", fontSize: "0.82rem", color: "#922B21", fontWeight: 600 }}>
                ⚠️ {pwErr}
              </div>
            )}
            <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.3rem" }}>
              <button
                onClick={handleChangePassword}
                disabled={savingPw}
                style={{ flex: 1, padding: "0.75rem", background: "#1C1410", color: "#fff", border: "none", borderRadius: "8px", fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: "0.88rem", cursor: savingPw ? "not-allowed" : "pointer", opacity: savingPw ? 0.6 : 1 }}
              >
                {savingPw ? "Saving…" : "Update Password"}
              </button>
              <button
                onClick={() => { setPwOpen(false); setCurrPw(""); setNewPw(""); setConfPw(""); setPwErr(""); }}
                disabled={savingPw}
                style={{ padding: "0.75rem 1.2rem", background: "#F5EFE6", color: "#5C4A38", border: "none", borderRadius: "8px", fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </>
  );
}

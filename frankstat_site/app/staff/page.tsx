
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────
type OrderStatus =
  | "PENDING_PAYMENT" | "IN_PRODUCTION" | "QUALITY_CHECK"
  | "READY" | "DELIVERING" | "COMPLETED"
  | "PAYMENT_FAILED" | "PAYMENT_ERROR" | "CANCELLED" | "REFUNDED";

interface Customer { id: string; fullName: string; email: string; phone?: string | null; }
interface Payment  { id: string; type: string; amount: number; method: string; mpesaRef?: string | null; status: string; createdAt: string; }
interface History  { id: string; fromStatus?: string | null; toStatus: string; changedBy?: string | null; note?: string | null; createdAt: string; }

interface Order {
  id: string;
  serviceName: string;
  dimensions?: string | null;
  quantity: number;
  finishType?: string | null;
  specialNotes?: string | null;
  unitPrice: number;
  totalPrice: number;
  depositAmount: number;
  balanceDue: number;
  artworkUrl: string;
  artworkFilename?: string | null;
  mpesaPhone: string;
  mpesaReceipt?: string | null;
  status: OrderStatus;
  assignedTo?: string | null;
  expectedReadyAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: Customer | null;
  payments: Payment[];
  statusHistory: History[];
}

interface StaffUser { id: string; fullName: string; email: string; role: string; phone?: string | null; createdAt?: string; lastLoginAt?: string | null; }

type SidebarView = "orders" | "payments" | "profile";

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_META: Record<OrderStatus, { label: string; color: string; bg: string; dot: string }> = {
  PENDING_PAYMENT: { label: "Awaiting Payment",  color: "#92620A", bg: "#FFFBEB", dot: "#F59E0B" },
  IN_PRODUCTION:   { label: "In Production",     color: "#1E4D8C", bg: "#EFF6FF", dot: "#3B82F6" },
  QUALITY_CHECK:   { label: "Quality Check",     color: "#5B21B6", bg: "#F5F3FF", dot: "#8B5CF6" },
  READY:           { label: "Ready",             color: "#065F46", bg: "#ECFDF5", dot: "#10B981" },
  DELIVERING:      { label: "Delivering",        color: "#0E7490", bg: "#ECFEFF", dot: "#06B6D4" },
  COMPLETED:       { label: "Completed",         color: "#14532D", bg: "#F0FDF4", dot: "#22C55E" },
  PAYMENT_FAILED:  { label: "Payment Failed",    color: "#991B1B", bg: "#FEF2F2", dot: "#EF4444" },
  PAYMENT_ERROR:   { label: "Payment Error",     color: "#7F1D1D", bg: "#FEF2F2", dot: "#EF4444" },
  CANCELLED:       { label: "Cancelled",         color: "#374151", bg: "#F9FAFB", dot: "#9CA3AF" },
  REFUNDED:        { label: "Refunded",          color: "#4B5563", bg: "#F3F4F6", dot: "#6B7280" },
};

const VALID_TRANSITIONS: Record<string, OrderStatus[]> = {
  PENDING_PAYMENT: ["CANCELLED"],
  IN_PRODUCTION:   ["QUALITY_CHECK", "CANCELLED"],
  QUALITY_CHECK:   ["IN_PRODUCTION", "READY", "CANCELLED"],
  READY:           ["DELIVERING", "COMPLETED", "CANCELLED"],
  DELIVERING:      ["COMPLETED", "CANCELLED"],
  PAYMENT_FAILED:  ["CANCELLED"],
  PAYMENT_ERROR:   ["CANCELLED"],
  COMPLETED:       [], CANCELLED: [], REFUNDED: [],
};

const ALL_STATUSES = Object.keys(STATUS_META) as OrderStatus[];
const fmt  = (n: number) => `KES ${n.toLocaleString()}`;
const fmtD = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const fmtDT = (d: string) => new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: OrderStatus }) {
  const m = STATUS_META[status];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:"5px", padding:"3px 10px", borderRadius:"99px", background:m.bg, color:m.color, fontSize:"0.72rem", fontWeight:700, whiteSpace:"nowrap", border:`1px solid ${m.dot}30` }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:m.dot, display:"inline-block", flexShrink:0 }} />
      {m.label}
    </span>
  );
}

function Toast({ msg, type, onDone }: { msg:string; type:"ok"|"err"; onDone:()=>void }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position:"fixed", bottom:24, right:24, zIndex:9999, background: type==="ok" ? "#14532D" : "#991B1B", color:"#fff", padding:"12px 20px", borderRadius:10, fontSize:"0.875rem", fontWeight:600, boxShadow:"0 8px 32px rgba(0,0,0,0.22)", display:"flex", alignItems:"center", gap:10, maxWidth:380, animation:"slideup 0.25s ease" }}>
      <span style={{ fontSize:"1.1rem" }}>{type==="ok" ? "✓" : "✕"}</span>
      {msg}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function StaffDashboard() {
  const router = useRouter();

  // Auth
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Data
  const [orders, setOrders]   = useState<Order[]>([]);
  const [total, setTotal]     = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");
  const [search, setSearch]   = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage]       = useState(1);
  const LIMIT = 30;

  // Panel
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [panelOpen, setPanelOpen]         = useState(false);

  // Edit state (inside panel)
  const [editStatus,   setEditStatus]   = useState<OrderStatus | "">("");
  const [editAssigned, setEditAssigned] = useState("");
  const [editETA,      setEditETA]      = useState("");
  const [editNote,     setEditNote]     = useState("");
  const [saving, setSaving]             = useState(false);

  // Active sidebar view
  const [view, setView] = useState<SidebarView>("orders");

  // Payments (admin only)
  const [payments, setPayments]       = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError]     = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ msg:string; type:"ok"|"err" } | null>(null);
  const showToast = useCallback((msg:string, type:"ok"|"err"="ok") => setToast({ msg, type }), []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 380);
    return () => clearTimeout(t);
  }, [search]);

  // ── Fetch session ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => {
        if (!d.user || !["STAFF","ADMIN"].includes(d.user.role)) {
          router.replace("/login?reason=staff");
          return;
        }
        setStaffUser(d.user);
      })
      .catch(() => router.replace("/login"))
      .finally(() => setAuthLoading(false));
  }, [router]);

  // ── Fetch payments (admin only, when payments view is active) ──────────────
  const fetchPayments = useCallback(async () => {
    setPaymentsLoading(true); setPaymentsError(null);
    try {
      const res  = await fetch("/api/admin/payments");
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load payments");
      const data = await res.json();
      setPayments(data.payments ?? []);
    } catch (e: any) {
      setPaymentsError(e.message);
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === "payments" && staffUser?.role === "ADMIN") fetchPayments();
  }, [view, staffUser, fetchPayments]);

  // ── Fetch orders ───────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res  = await fetch(`/api/staff/orders?${params}`);
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load orders");
      const data = await res.json();
      setOrders(data.orders);
      setTotal(data.total);
      // Build status count map
      const counts: Record<string, number> = {};
      for (const g of (data.statusCounts ?? [])) counts[g.status] = g._count.id;
      setStatusCounts(counts);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, debouncedSearch]);

  useEffect(() => { if (!authLoading && staffUser) fetchOrders(); }, [fetchOrders, authLoading, staffUser]);

  // ── Open panel ─────────────────────────────────────────────────────────────
  const openPanel = (order: Order) => {
    setSelectedOrder(order);
    setEditStatus(order.status);
    setEditAssigned(order.assignedTo ?? "");
    setEditETA(order.expectedReadyAt ? order.expectedReadyAt.slice(0, 16) : "");
    setEditNote("");
    setPanelOpen(true);
  };

  // ── Save changes ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (editStatus   && editStatus   !== selectedOrder.status)   body.status          = editStatus;
      if (editAssigned !== (selectedOrder.assignedTo ?? ""))        body.assignedTo      = editAssigned || null;
      if (editETA      !== (selectedOrder.expectedReadyAt?.slice(0,16) ?? ""))
                                                                    body.expectedReadyAt = editETA ? new Date(editETA).toISOString() : null;
      if (editNote.trim())                                          body.note            = editNote.trim();

      if (Object.keys(body).length === 0) { showToast("No changes to save.", "err"); setSaving(false); return; }

      const res  = await fetch(`/api/staff/orders/${selectedOrder.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "Save failed.", "err"); return; }

      showToast("Order updated successfully.");
      // Refresh orders and update panel
      await fetchOrders();
      // Update panel's local copy
      setSelectedOrder(prev => prev ? { ...prev, ...json.order } : prev);
      setEditNote("");
    } catch {
      showToast("Network error. Please try again.", "err");
    } finally {
      setSaving(false);
    }
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method:"POST" });
    router.push("/login");
  };

  const totalPages = Math.ceil(total / LIMIT);
  const allowedNext = selectedOrder ? (VALID_TRANSITIONS[selectedOrder.status] ?? []) : [];

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{height:100%;font-family:'DM Sans',sans-serif;background:#F2F0FF;color:#12101E;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(0,204,221,0.35);border-radius:99px;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes slideup{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
        @keyframes slidein{from{transform:translateX(100%);}to{transform:translateX(0);}}
        @keyframes fadein{from{opacity:0;}to{opacity:1;}}

        /* ── Layout ── */
        .shell{display:flex;min-height:100vh;}
        .sidebar{width:220px;min-height:100vh;background:#0C0B1A;display:flex;flex-direction:column;flex-shrink:0;position:sticky;top:0;height:100vh;overflow-y:auto;}
        .main{flex:1;min-width:0;display:flex;flex-direction:column;}

        /* ── Sidebar ── */
        .sb-logo{padding:18px 20px 14px;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;flex-direction:column;gap:8px;}
        .sb-logo-img{height:34px;width:auto;object-fit:contain;display:block;}
        .sb-pill{display:inline-block;background:rgba(0,204,221,0.15);border:1px solid rgba(0,204,221,0.3);color:#00CCDD;font-size:0.62rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;padding:2px 9px;border-radius:99px;width:fit-content;}
        .sb-nav{flex:1;padding:12px 0;}
        .sb-item{display:flex;align-items:center;gap:10px;padding:10px 20px;font-size:0.83rem;font-weight:500;color:#8B8FA8;cursor:pointer;transition:background 0.15s,color 0.15s;border-left:3px solid transparent;}
        .sb-item:hover{background:rgba(255,255,255,0.04);color:#E0DDFF;}
        .sb-item.active{background:rgba(0,204,221,0.1);color:#00CCDD;border-left-color:#00CCDD;}
        .sb-icon{font-size:1rem;width:20px;text-align:center;flex-shrink:0;}
        .sb-footer{padding:16px 20px;border-top:1px solid rgba(255,255,255,0.07);}
        .sb-user{display:flex;align-items:center;gap:10px;}
        .sb-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#00CCDD,#006680);display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif;font-size:0.85rem;font-weight:700;color:#fff;flex-shrink:0;}
        .sb-uname{font-size:0.78rem;font-weight:600;color:#00CCDD;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .sb-urole{font-size:0.68rem;color:#6B7280;}
        .sb-logout{background:none;border:none;cursor:pointer;font-size:0.75rem;color:#6B7280;padding:6px 0;transition:color 0.15s;font-family:'DM Sans',sans-serif;}
        .sb-logout:hover{color:#FF80C8;}

        /* ── Topbar ── */
        .topbar{background:#fff;border-bottom:1px solid #E4DEFF;padding:0 28px;height:58px;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:30;box-shadow:0 1px 4px rgba(12,11,26,0.06);}
        .topbar-title{font-family:'DM Sans',sans-serif;font-size:1.05rem;font-weight:700;color:#12101E;flex:1;}
        .topbar-badge{background:#DFFBFF;color:#006680;border:1px solid rgba(0,204,221,0.35);font-size:0.7rem;font-weight:700;padding:2px 9px;border-radius:99px;}

        /* ── Content ── */
        .content{padding:24px 28px;flex:1;}

        /* ── Stats row ── */
        .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px;}
        .stat-card{background:#fff;border:1px solid #E4DEFF;border-radius:12px;padding:16px 18px;position:relative;overflow:hidden;}
        .stat-accent{position:absolute;top:0;left:0;right:0;height:3px;border-radius:12px 12px 0 0;}
        .stat-icon{font-size:1.4rem;margin-bottom:8px;}
        .stat-label{font-size:0.7rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;margin-bottom:4px;}
        .stat-val{font-family:'DM Sans',sans-serif;font-size:1.6rem;font-weight:800;color:#12101E;line-height:1;}
        .stat-sub{font-size:0.72rem;color:#9CA3AF;margin-top:4px;}

        /* ── Filter bar ── */
        .filter-bar{background:#fff;border:1px solid #E4DEFF;border-radius:12px;padding:14px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
        .search-wrap{position:relative;flex:1;min-width:200px;}
        .search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#9CA3AF;font-size:0.9rem;pointer-events:none;}
        .search-inp{width:100%;background:#F4F2FF;border:1.5px solid #E4DEFF;border-radius:8px;padding:7px 10px 7px 32px;font-family:'DM Sans',sans-serif;font-size:0.85rem;color:#12101E;outline:none;transition:border-color 0.2s;}
        .search-inp:focus{border-color:#00CCDD;}
        .filter-pills{display:flex;gap:6px;flex-wrap:wrap;}
        .pill{padding:5px 12px;border-radius:99px;font-size:0.72rem;font-weight:700;cursor:pointer;border:1.5px solid #E4DEFF;background:#F4F2FF;color:#6B7280;transition:all 0.15s;white-space:nowrap;}
        .pill.active{background:#0C0B1A;color:#FFD600;border-color:#0C0B1A;}
        .pill:hover:not(.active){border-color:#00CCDD;color:#006680;}

        /* ── Table ── */
        .table-wrap{background:#fff;border:1px solid #E4DEFF;border-radius:12px;overflow:hidden;}
        .table-scroll{overflow-x:auto;}
        table{width:100%;border-collapse:collapse;min-width:820px;}
        thead th{padding:10px 14px;font-size:0.68rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;background:#F8F7FF;border-bottom:1px solid #E4DEFF;text-align:left;white-space:nowrap;}
        tbody td{padding:12px 14px;font-size:0.84rem;color:#12101E;border-bottom:1px solid #EBE8FF;vertical-align:middle;}
        tbody tr:last-child td{border-bottom:none;}
        tbody tr{cursor:pointer;transition:background 0.12s;}
        tbody tr:hover td{background:#F8F7FF;}
        .cell-mono{font-family:monospace;font-size:0.78rem;color:#6B7280;}
        .cell-name{font-weight:600;}
        .cell-sub{font-size:0.72rem;color:#9CA3AF;margin-top:2px;}
        .tbl-foot{padding:10px 16px;background:#F8F7FF;border-top:1px solid #E4DEFF;display:flex;justify-content:space-between;align-items:center;font-size:0.75rem;color:#9CA3AF;}
        .pg-btn{background:#F4F2FF;border:1.5px solid #E4DEFF;border-radius:7px;padding:4px 12px;font-family:'DM Sans',sans-serif;font-size:0.78rem;font-weight:600;cursor:pointer;color:#374151;transition:all 0.15s;}
        .pg-btn:hover:not(:disabled){border-color:#FFD600;color:#8A7200;}
        .pg-btn:disabled{opacity:0.4;cursor:default;}
        .view-btn{background:#DFFBFF;color:#006680;border:none;border-radius:6px;padding:4px 12px;font-family:'DM Sans',sans-serif;font-size:0.75rem;font-weight:700;cursor:pointer;transition:background 0.15s;}
        .view-btn:hover{background:#B0F0FA;}

        /* ── Slide-over panel ── */
        .overlay{position:fixed;inset:0;background:rgba(12,11,26,0.55);z-index:50;animation:fadein 0.2s ease;}
        .panel{position:fixed;top:0;right:0;bottom:0;width:min(580px,100vw);background:#fff;z-index:51;display:flex;flex-direction:column;box-shadow:-8px 0 40px rgba(0,0,0,0.18);animation:slidein 0.25s ease;}
        .panel-head{padding:20px 24px;border-bottom:1px solid #E4DEFF;display:flex;justify-content:space-between;align-items:flex-start;flex-shrink:0;}
        .panel-title{font-family:'DM Sans',sans-serif;font-size:1rem;font-weight:700;color:#12101E;margin-bottom:4px;}
        .panel-sub{font-size:0.78rem;color:#9CA3AF;}
        .panel-close{background:#F4F2FF;border:1.5px solid #E4DEFF;border-radius:8px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1rem;color:#6B7280;flex-shrink:0;transition:background 0.15s;}
        .panel-close:hover{background:#E4DEFF;}
        .panel-body{flex:1;overflow-y:auto;padding:20px 24px;}
        .panel-foot{padding:16px 24px;border-top:1px solid #E4DEFF;display:flex;gap:10px;flex-shrink:0;}

        /* ── Panel sections ── */
        .psec{margin-bottom:20px;}
        .psec-title{font-size:0.68rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#9CA3AF;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #EBE8FF;}
        .prow{display:flex;justify-content:space-between;align-items:flex-start;padding:6px 0;border-bottom:1px solid #F4F2FF;gap:8px;}
        .prow:last-child{border-bottom:none;}
        .prow-label{font-size:0.75rem;color:#9CA3AF;font-weight:500;white-space:nowrap;flex-shrink:0;}
        .prow-val{font-size:0.84rem;font-weight:600;color:#12101E;text-align:right;word-break:break-word;}
        .prow-val.green{color:#15803D;}
        .prow-val.amber{color:#D97706;}
        .prow-val.red{color:#DC2626;}
        .pgrid{display:grid;grid-template-columns:1fr 1fr;gap:0 16px;}

        /* ── Edit form ── */
        .field{margin-bottom:14px;}
        .field label{display:block;font-size:0.7rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6B7280;margin-bottom:5px;}
        .finp{width:100%;background:#F4F2FF;border:1.5px solid #E4DEFF;border-radius:8px;padding:8px 12px;font-family:'DM Sans',sans-serif;font-size:0.875rem;color:#12101E;outline:none;transition:border-color 0.2s;}
        .finp:focus{border-color:#00CCDD;}
        select.finp{cursor:pointer;}
        textarea.finp{resize:vertical;min-height:70px;}

        /* ── Timeline ── */
        .timeline{display:flex;flex-direction:column;gap:0;}
        .tl-item{display:flex;gap:12px;padding-bottom:14px;}
        .tl-item:last-child{padding-bottom:0;}
        .tl-left{display:flex;flex-direction:column;align-items:center;width:20px;flex-shrink:0;}
        .tl-dot{width:10px;height:10px;border-radius:50%;background:#FFD600;flex-shrink:0;margin-top:3px;}
        .tl-line{flex:1;width:2px;background:#E4DEFF;margin-top:3px;}
        .tl-body{flex:1;min-width:0;}
        .tl-status{font-size:0.78rem;font-weight:700;color:#12101E;}
        .tl-meta{font-size:0.7rem;color:#9CA3AF;margin-top:2px;}
        .tl-note{font-size:0.75rem;color:#3D3070;background:#FFFBE0;border-radius:5px;padding:4px 8px;margin-top:5px;border-left:2px solid #FFD600;}

        /* ── Payment row ── */
        .pay-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #F4F2FF;}
        .pay-row:last-child{border-bottom:none;}
        .pay-type{display:inline-block;padding:2px 8px;border-radius:99px;font-size:0.68rem;font-weight:700;}
        .pay-dep{background:#DFFBFF;color:#006680;}
        .pay-bal{background:#FFFBE0;color:#7A6200;}
        .pay-full{background:#FFF0F8;color:#CC005A;}
        .pay-status-ok{color:#15803D;font-size:0.72rem;font-weight:700;}
        .pay-status-fail{color:#DC2626;font-size:0.72rem;font-weight:700;}
        .pay-status-pend{color:#D97706;font-size:0.72rem;font-weight:700;}
        .pay-readonly-note{font-size:0.72rem;color:#9CA3AF;font-style:italic;margin-top:8px;padding:6px 10px;background:#F4F2FF;border-radius:6px;border-left:2px solid #E4DEFF;}

        /* ── Buttons ── */
        .btn-save{flex:1;background:#0C0B1A;color:#FFD600;border:none;border-radius:8px;padding:10px;font-family:'DM Sans',sans-serif;font-size:0.88rem;font-weight:700;cursor:pointer;transition:background 0.15s;display:flex;align-items:center;justify-content:center;gap:8px;}
        .btn-save:hover:not(:disabled){background:#1E1A3A;}
        .btn-save:disabled{opacity:0.55;cursor:default;}
        .btn-cancel-panel{background:#F4F2FF;border:1.5px solid #E4DEFF;color:#374151;border-radius:8px;padding:10px 18px;font-family:'DM Sans',sans-serif;font-size:0.88rem;font-weight:600;cursor:pointer;transition:all 0.15s;}
        .btn-cancel-panel:hover{border-color:#00CCDD;}
        .spinner-sm{width:16px;height:16px;border:2.5px solid rgba(255,255,255,0.25);border-top-color:#FFD600;border-radius:50%;animation:spin 0.7s linear infinite;}

        /* ── Empty / error ── */
        .empty{text-align:center;padding:60px 20px;color:#9CA3AF;}
        .empty-icon{font-size:2.5rem;margin-bottom:12px;}

        /* ── Artwork link ── */
        .art-link{display:inline-flex;align-items:center;gap:5px;font-size:0.78rem;color:#006680;font-weight:600;text-decoration:none;background:#DFFBFF;border-radius:5px;padding:3px 9px;transition:background 0.15s;}
        .art-link:hover{background:#B0F0FA;}

        /* ── Responsive ── */
        @media(max-width:900px){
          .sidebar{width:64px;}
          .sb-pill,.sb-uname,.sb-urole,.sb-logout{display:none;}
          .sb-item span:not(.sb-icon){display:none;}
          .sb-item{padding:10px;justify-content:center;}
          .stats-row{grid-template-columns:1fr 1fr;}
          .content{padding:16px;}
          .topbar{padding:0 16px;}
          .filter-bar{flex-direction:column;align-items:stretch;}
        }
        @media(max-width:600px){
          .stats-row{grid-template-columns:1fr;}
          .panel{width:100vw;}
        }
      `}</style>

      {authLoading ? (
        <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif", color:"#6B7280" }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ width:40, height:40, border:"3px solid #E5E7EB", borderTopColor:"#1C1410", borderRadius:"50%", animation:"spin 0.7s linear infinite", margin:"0 auto 12px" }} />
            Verifying access…
          </div>
        </div>
      ) : (
        <div className="shell">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sb-logo">
            <img src="/logo.png" alt="FrankStat" className="sb-logo-img"/>
            <span className="sb-pill">Staff Portal</span>
          </div>
          <nav className="sb-nav">
            {([
              { icon:"🗂️", label:"Orders",   id:"orders"   as SidebarView },
              ...(staffUser?.role === "ADMIN" ? [{ icon:"💳", label:"Payments", id:"payments" as SidebarView }] : []),
              { icon:"👤", label:"My Profile", id:"profile"  as SidebarView },
            ] as { icon:string; label:string; id:SidebarView }[]).map(item => (
              <div key={item.id} className={`sb-item${view === item.id ? " active" : ""}`}
                onClick={() => setView(item.id)} style={{ cursor:"pointer" }}>
                <span className="sb-icon">{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </nav>
          <div className="sb-footer">
            <div className="sb-user">
              <div className="sb-avatar">{staffUser?.fullName?.[0]?.toUpperCase() ?? "S"}</div>
              <div style={{ minWidth:0 }}>
                <div className="sb-uname">{staffUser?.fullName ?? "Staff"}</div>
                <div className="sb-urole">{staffUser?.role ?? ""}</div>
              </div>
            </div>
            <button className="sb-logout" onClick={handleLogout}>Sign out →</button>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="main">
          {/* Topbar */}
          <header className="topbar">
            <div className="topbar-title">
              {view === "orders" ? "Orders" : view === "payments" ? "Payments" : "My Profile"}
            </div>
            <span className="topbar-badge">{staffUser?.role === "ADMIN" ? "Admin View" : "Staff View"}</span>
            <div style={{ fontSize:"0.78rem", color:"#9CA3AF" }}>
              {staffUser?.email}
            </div>
          </header>

          <div className="content">

            {/* ── Profile view ─────────────────────────────────────────────── */}
            {view === "profile" && staffUser && (
              <div style={{ maxWidth:520 }}>
                <div style={{ background:"#fff", border:"1px solid #EDE8E0", borderRadius:14, padding:"28px 28px 24px", marginBottom:16 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:18, marginBottom:24 }}>
                    <div style={{ width:56, height:56, borderRadius:"50%", background:"linear-gradient(135deg,#C19A4A,#8B5E3C)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif", fontSize:"1.5rem", fontWeight:800, color:"#fff", flexShrink:0 }}>
                      {staffUser.fullName?.[0]?.toUpperCase() ?? "S"}
                    </div>
                    <div>
                      <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"1.1rem", fontWeight:800, color:"#1C1410" }}>{staffUser.fullName}</div>
                      <div style={{ fontSize:"0.78rem", color:"#9CA3AF", marginTop:2 }}>{staffUser.email}</div>
                    </div>
                  </div>
                  {[
                    { label:"Role",        val: staffUser.role },
                    { label:"Email",       val: staffUser.email },
                    { label:"Phone",       val: staffUser.phone ?? "—" },
                    { label:"Member since", val: staffUser.createdAt ? new Date(staffUser.createdAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) : "—" },
                    { label:"Last login",  val: staffUser.lastLoginAt ? new Date(staffUser.lastLoginAt).toLocaleString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—" },
                  ].map(r => (
                    <div key={r.label} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:"1px solid #F5F3EF" }}>
                      <span style={{ fontSize:"0.78rem", color:"#9CA3AF", fontWeight:500 }}>{r.label}</span>
                      <span style={{ fontSize:"0.875rem", fontWeight:600, color:"#1C1410" }}>{r.val}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize:"0.75rem", color:"#9CA3AF", paddingLeft:4 }}>To change your password or email, contact your administrator.</p>
              </div>
            )}

            {/* ── Payments view (admin only) ────────────────────────────────── */}
            {view === "payments" && (
              <div>
                <div style={{ background:"#fff", border:"1px solid #EDE8E0", borderRadius:12, overflow:"hidden" }}>
                  {paymentsLoading ? (
                    <div className="empty">
                      <div style={{ width:36, height:36, border:"3px solid #EDE8E0", borderTopColor:"#C19A4A", borderRadius:"50%", animation:"spin 0.7s linear infinite", margin:"0 auto 12px" }} />
                      Loading payments…
                    </div>
                  ) : paymentsError ? (
                    <div className="empty">
                      <div className="empty-icon">⚠️</div>
                      <div style={{ color:"#DC2626", fontWeight:600 }}>{paymentsError}</div>
                      <button onClick={fetchPayments} style={{ marginTop:12, background:"#1C1410", color:"#fff", border:"none", borderRadius:7, padding:"7px 16px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:600 }}>Retry</button>
                    </div>
                  ) : payments.length === 0 ? (
                    <div className="empty"><div className="empty-icon">💳</div><div style={{ fontWeight:600 }}>No payments yet.</div></div>
                  ) : (
                    <div style={{ overflowX:"auto" }}>
                      <table style={{ width:"100%", borderCollapse:"collapse", minWidth:700 }}>
                        <thead>
                          <tr>
                            {["Order","Customer","Type","Amount","Method","M-Pesa Ref","Status","Date"].map(h => (
                              <th key={h} style={{ padding:"10px 14px", fontSize:"0.68rem", fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#9CA3AF", background:"#FAFAF9", borderBottom:"1px solid #EDE8E0", textAlign:"left", whiteSpace:"nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map((p: any) => (
                            <tr key={p.id} style={{ borderBottom:"1px solid #F5F3EF" }}>
                              <td style={{ padding:"11px 14px", fontFamily:"monospace", fontSize:"0.78rem", color:"#6B7280" }}>{p.order?.id?.slice(-8).toUpperCase() ?? "—"}</td>
                              <td style={{ padding:"11px 14px", fontSize:"0.84rem" }}>
                                <div style={{ fontWeight:600 }}>{p.order?.user?.fullName ?? "—"}</div>
                                <div style={{ fontSize:"0.72rem", color:"#9CA3AF" }}>{p.order?.user?.email ?? ""}</div>
                              </td>
                              <td style={{ padding:"11px 14px" }}>
                                <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:99, fontSize:"0.68rem", fontWeight:700, background: p.type==="DEPOSIT"?"#EFF6FF":p.type==="BALANCE"?"#F0FDF4":"#F5F3FF", color: p.type==="DEPOSIT"?"#1D4ED8":p.type==="BALANCE"?"#15803D":"#5B21B6" }}>{p.type}</span>
                              </td>
                              <td style={{ padding:"11px 14px", fontWeight:700, fontSize:"0.875rem" }}>KES {p.amount?.toLocaleString()}</td>
                              <td style={{ padding:"11px 14px", fontSize:"0.82rem", color:"#374151" }}>{p.method}</td>
                              <td style={{ padding:"11px 14px", fontFamily:"monospace", fontSize:"0.72rem", color:"#6B7280" }}>{p.mpesaRef ?? "—"}</td>
                              <td style={{ padding:"11px 14px" }}>
                                <span style={{ fontWeight:700, fontSize:"0.72rem", color: p.status==="COMPLETED"?"#15803D":p.status==="FAILED"?"#DC2626":"#D97706" }}>
                                  {p.status==="COMPLETED"?"✓ ":p.status==="FAILED"?"✕ ":"⏳ "}{p.status}
                                </span>
                              </td>
                              <td style={{ padding:"11px 14px", fontSize:"0.75rem", color:"#9CA3AF", whiteSpace:"nowrap" }}>{new Date(p.createdAt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Orders view ───────────────────────────────────────────────── */}
            {view === "orders" && <>
            {/* Stats */}
            <div className="stats-row">
              {[
                { icon:"🗂️", label:"Total Orders", val:total, sub:"across all statuses", accent:"#C19A4A" },
                { icon:"⚙️", label:"In Production", val:statusCounts["IN_PRODUCTION"] ?? 0, sub:"being printed", accent:"#3B82F6" },
                { icon:"✅", label:"Ready / Done", val:(statusCounts["READY"] ?? 0) + (statusCounts["COMPLETED"] ?? 0), sub:"ready + completed", accent:"#10B981" },
                { icon:"⚠️", label:"Needs Attention", val:(statusCounts["PAYMENT_FAILED"] ?? 0) + (statusCounts["PAYMENT_ERROR"] ?? 0), sub:"payment issues", accent:"#EF4444" },
              ].map(s => (
                <div key={s.label} className="stat-card">
                  <div className="stat-accent" style={{ background:s.accent }} />
                  <div className="stat-icon">{s.icon}</div>
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-val">{s.val}</div>
                  <div className="stat-sub">{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Filter bar */}
            <div className="filter-bar">
              <div className="search-wrap">
                <span className="search-icon">🔍</span>
                <input className="search-inp" placeholder="Search by customer name, email, order ID, service…"
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="filter-pills">
                <button className={`pill${statusFilter === "ALL" ? " active" : ""}`} onClick={() => { setStatusFilter("ALL"); setPage(1); }}>
                  All
                </button>
                {ALL_STATUSES.map(s => (
                  <button key={s} className={`pill${statusFilter === s ? " active" : ""}`} onClick={() => { setStatusFilter(s); setPage(1); }}>
                    {STATUS_META[s].label}
                    {statusCounts[s] ? ` (${statusCounts[s]})` : ""}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="table-wrap">
              {loading ? (
                <div className="empty">
                  <div style={{ width:36, height:36, border:"3px solid #EDE8E0", borderTopColor:"#C19A4A", borderRadius:"50%", animation:"spin 0.7s linear infinite", margin:"0 auto 12px" }} />
                  Loading orders…
                </div>
              ) : error ? (
                <div className="empty">
                  <div className="empty-icon">⚠️</div>
                  <div style={{ color:"#DC2626", fontWeight:600 }}>{error}</div>
                  <button onClick={fetchOrders} style={{ marginTop:12, background:"#1C1410", color:"#fff", border:"none", borderRadius:7, padding:"7px 16px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:600 }}>Retry</button>
                </div>
              ) : orders.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">📭</div>
                  <div style={{ fontWeight:600, color:"#374151", marginBottom:4 }}>No orders found</div>
                  <div style={{ fontSize:"0.83rem" }}>Try clearing the search or changing the filter.</div>
                </div>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Customer</th>
                        <th>Service</th>
                        <th>Qty</th>
                        <th>Total</th>
                        <th>Balance</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(order => (
                        <tr key={order.id} onClick={() => openPanel(order)}>
                          <td><span className="cell-mono">{order.id.slice(-10).toUpperCase()}</span></td>
                          <td>
                            <div className="cell-name">{order.user?.fullName ?? "—"}</div>
                            <div className="cell-sub">{order.user?.email ?? ""}</div>
                          </td>
                          <td>
                            <div style={{ fontWeight:600 }}>{order.serviceName}</div>
                            {order.dimensions && <div className="cell-sub">{order.dimensions}</div>}
                          </td>
                          <td style={{ textAlign:"center" }}>{order.quantity}</td>
                          <td style={{ fontWeight:700 }}>{fmt(order.totalPrice)}</td>
                          <td style={{ fontWeight:600, color: order.balanceDue > 0 ? "#D97706" : "#15803D" }}>
                            {fmt(order.balanceDue)}
                          </td>
                          <td><StatusBadge status={order.status} /></td>
                          <td style={{ color:"#9CA3AF", fontSize:"0.78rem", whiteSpace:"nowrap" }}>{fmtD(order.createdAt)}</td>
                          <td onClick={e => e.stopPropagation()}>
                            <button className="view-btn" onClick={() => openPanel(order)}>Open</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="tbl-foot">
                <span>Showing {orders.length} of {total} orders</span>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <button className="pg-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                  <span>Page {page} / {Math.max(1, totalPages)}</span>
                  <button className="pg-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
                </div>
              </div>
            </div>
            </>}

          </div>
        </div>
      </div>
      )}

      {/* ── Slide-over panel ── */}
      {panelOpen && selectedOrder && (
        <>
          <div className="overlay" onClick={() => setPanelOpen(false)} />
          <aside className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">Order {selectedOrder.id.slice(-10).toUpperCase()}</div>
                <div className="panel-sub">{selectedOrder.serviceName} · Placed {fmtD(selectedOrder.createdAt)}</div>
              </div>
              <button className="panel-close" onClick={() => setPanelOpen(false)}>✕</button>
            </div>

            <div className="panel-body">
              {/* Current status */}
              <div style={{ marginBottom:18 }}>
                <StatusBadge status={selectedOrder.status} />
              </div>

              {/* Customer */}
              <div className="psec">
                <div className="psec-title">Customer</div>
                <div className="pgrid">
                  <div className="prow"><span className="prow-label">Name</span><span className="prow-val">{selectedOrder.user?.fullName ?? "—"}</span></div>
                  <div className="prow"><span className="prow-label">Email</span><span className="prow-val">{selectedOrder.user?.email ?? "—"}</span></div>
                  <div className="prow"><span className="prow-label">Phone</span><span className="prow-val">{selectedOrder.user?.phone ?? "—"}</span></div>
                  <div className="prow"><span className="prow-label">M-Pesa</span><span className="prow-val">+{selectedOrder.mpesaPhone}</span></div>
                </div>
              </div>

              {/* Order details */}
              <div className="psec">
                <div className="psec-title">Order Details</div>
                <div className="pgrid">
                  <div className="prow"><span className="prow-label">Service</span><span className="prow-val">{selectedOrder.serviceName}</span></div>
                  {selectedOrder.dimensions && <div className="prow"><span className="prow-label">Size</span><span className="prow-val">{selectedOrder.dimensions}</span></div>}
                  {selectedOrder.finishType && <div className="prow"><span className="prow-label">Finish</span><span className="prow-val">{selectedOrder.finishType}</span></div>}
                  <div className="prow"><span className="prow-label">Quantity</span><span className="prow-val">{selectedOrder.quantity}</span></div>
                  <div className="prow"><span className="prow-label">Unit Price</span><span className="prow-val">{fmt(selectedOrder.unitPrice)}</span></div>
                  <div className="prow"><span className="prow-label">Total</span><span className="prow-val">{fmt(selectedOrder.totalPrice)}</span></div>
                  <div className="prow"><span className="prow-label">Deposit Paid</span><span className="prow-val green">{fmt(selectedOrder.depositAmount)}</span></div>
                  <div className="prow"><span className="prow-label">Balance Due</span><span className={`prow-val ${selectedOrder.balanceDue > 0 ? "amber" : "green"}`}>{fmt(selectedOrder.balanceDue)}</span></div>
                  {selectedOrder.expectedReadyAt && <div className="prow"><span className="prow-label">ETA</span><span className="prow-val">{fmtDT(selectedOrder.expectedReadyAt)}</span></div>}
                  {selectedOrder.assignedTo && <div className="prow"><span className="prow-label">Assigned To</span><span className="prow-val">{selectedOrder.assignedTo}</span></div>}
                </div>
                {selectedOrder.specialNotes && (
                  <div style={{ marginTop:8, background:"#FFFBEE", border:"1px solid #FDE68A", borderRadius:7, padding:"8px 12px", fontSize:"0.8rem", color:"#78350F" }}>
                    <span style={{ fontWeight:700 }}>Notes: </span>{selectedOrder.specialNotes}
                  </div>
                )}
              </div>

              {/* Artwork */}
              <div className="psec">
                <div className="psec-title">Artwork</div>
                <a href={selectedOrder.artworkUrl} target="_blank" rel="noreferrer" className="art-link">
                  📎 {selectedOrder.artworkFilename ?? "View artwork file"} ↗
                </a>
              </div>

              {/* Payments — READ ONLY */}
              <div className="psec">
                <div className="psec-title">Payments (read only)</div>
                {selectedOrder.payments.length === 0 ? (
                  <div style={{ fontSize:"0.8rem", color:"#9CA3AF" }}>No payments recorded yet.</div>
                ) : selectedOrder.payments.map(p => (
                  <div key={p.id} className="pay-row">
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span className={`pay-type ${p.type === "DEPOSIT" ? "pay-dep" : p.type === "BALANCE" ? "pay-bal" : "pay-full"}`}>{p.type}</span>
                      <span style={{ fontSize:"0.78rem", color:"#6B7280" }}>{fmtD(p.createdAt)}</span>
                      {p.mpesaRef && <span style={{ fontFamily:"monospace", fontSize:"0.72rem", background:"#F9F7F4", padding:"1px 6px", borderRadius:4 }}>{p.mpesaRef}</span>}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontWeight:700, fontSize:"0.85rem" }}>{fmt(p.amount)}</span>
                      <span className={p.status === "COMPLETED" ? "pay-status-ok" : p.status === "FAILED" ? "pay-status-fail" : "pay-status-pend"}>
                        {p.status === "COMPLETED" ? "✓" : p.status === "FAILED" ? "✕" : "⏳"} {p.status}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="pay-readonly-note">Payments are managed automatically by M-Pesa. Staff cannot edit payment records.</div>
              </div>

              {/* ── Edit section ── */}
              {allowedNext.length > 0 || true ? (
                <div className="psec">
                  <div className="psec-title">Update Order</div>

                  {/* Status */}
                  <div className="field">
                    <label>Status</label>
                    <select className="finp" value={editStatus}
                      onChange={e => setEditStatus(e.target.value as OrderStatus)}>
                      <option value={selectedOrder.status}>{STATUS_META[selectedOrder.status]?.label} (current)</option>
                      {allowedNext.map(s => (
                        <option key={s} value={s}>{STATUS_META[s]?.label}</option>
                      ))}
                    </select>
                    {allowedNext.length === 0 && (
                      <div style={{ fontSize:"0.72rem", color:"#9CA3AF", marginTop:5 }}>
                        This order is in a terminal state — no further status changes allowed.
                      </div>
                    )}
                  </div>

                  {/* Assigned to */}
                  <div className="field">
                    <label>Assigned To</label>
                    <input className="finp" placeholder="Staff member name or email" value={editAssigned}
                      onChange={e => setEditAssigned(e.target.value)} />
                  </div>

                  {/* ETA */}
                  <div className="field">
                    <label>Expected Ready Date & Time</label>
                    <input type="datetime-local" className="finp" value={editETA}
                      onChange={e => setEditETA(e.target.value)} />
                  </div>

                  {/* Note */}
                  <div className="field">
                    <label>Internal Note (attached to status change)</label>
                    <textarea className="finp" placeholder="e.g. Artwork approved, starting print run…"
                      value={editNote} onChange={e => setEditNote(e.target.value)} />
                  </div>
                </div>
              ) : null}

              {/* Status history */}
              <div className="psec">
                <div className="psec-title">Status History</div>
                {selectedOrder.statusHistory.length === 0 ? (
                  <div style={{ fontSize:"0.8rem", color:"#9CA3AF" }}>No history yet.</div>
                ) : (
                  <div className="timeline">
                    {selectedOrder.statusHistory.map((h, i) => (
                      <div key={h.id} className="tl-item">
                        <div className="tl-left">
                          <div className="tl-dot" style={{ background: i === 0 ? "#C19A4A" : "#D1C9BC" }} />
                          {i < selectedOrder.statusHistory.length - 1 && <div className="tl-line" />}
                        </div>
                        <div className="tl-body">
                          <div className="tl-status">
                            {h.fromStatus ? `${STATUS_META[h.fromStatus as OrderStatus]?.label ?? h.fromStatus} → ` : ""}
                            {STATUS_META[h.toStatus as OrderStatus]?.label ?? h.toStatus}
                          </div>
                          <div className="tl-meta">
                            {fmtDT(h.createdAt)} · {h.changedBy ?? "system"}
                          </div>
                          {h.note && <div className="tl-note">{h.note}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="panel-foot">
              <button className="btn-cancel-panel" onClick={() => setPanelOpen(false)}>Close</button>
              <button className="btn-save" disabled={saving} onClick={handleSave}>
                {saving ? <><div className="spinner-sm" /> Saving…</> : "Save Changes"}
              </button>
            </div>
          </aside>
        </>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </>
  );
}

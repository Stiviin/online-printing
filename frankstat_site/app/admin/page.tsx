/**
 * app/admin/page.tsx — Frankstat Admin Dashboard
 * "use client" — fully dynamic, talks to /api/admin/* endpoints
 *
 * Tabs: Overview · Users · Orders · Payments · Support · Audit Log
 * Protected: middleware + client-side role check redirect to /login
 */
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────
type Role = "CUSTOMER" | "STAFF" | "ADMIN";
type OrderStatus = "PENDING_PAYMENT"|"IN_PRODUCTION"|"QUALITY_CHECK"|"READY"|"DELIVERING"|"COMPLETED"|"PAYMENT_FAILED"|"PAYMENT_ERROR"|"CANCELLED"|"REFUNDED";
type PayStatus   = "PENDING"|"COMPLETED"|"FAILED"|"REFUNDED"|"CANCELLED";
type TicketStatus= "OPEN"|"IN_PROGRESS"|"RESOLVED"|"CLOSED";
type Tab = "overview"|"users"|"orders"|"payments"|"support"|"audit";

interface AdminUser  { id:string; fullName:string; email:string; role:string; }
interface User       { id:string; fullName:string; email:string; phone?:string|null; role:Role; isActive:boolean; isVerified:boolean; createdAt:string; lastLoginAt?:string|null; _count:{orders:number}; }
interface Order      { id:string; serviceName:string; dimensions?:string|null; quantity:number; totalPrice:number; depositAmount:number; balanceDue:number; status:OrderStatus; assignedTo?:string|null; expectedReadyAt?:string|null; completedAt?:string|null; createdAt:string; updatedAt:string; artworkUrl:string; specialNotes?:string|null; discountCode?:string|null; discountAmount?:number|null; user?:{id:string;fullName:string;email:string;phone?:string|null}|null; payments:Payment[]; statusHistory:SHItem[]; }
interface Payment    { id:string; type:string; amount:number; method:string; mpesaRef?:string|null; mpesaPhone?:string|null; status:PayStatus; failReason?:string|null; createdAt:string; order?:{id:string;user?:{fullName:string;email:string}|null;serviceName?:string}|null; }
interface SHItem     { id:string; fromStatus?:string|null; toStatus:string; changedBy?:string|null; note?:string|null; createdAt:string; }
interface Ticket     { id:string; subject:string; message:string; status:TicketStatus; response?:string|null; respondedAt?:string|null; orderId?:string|null; createdAt:string; user?:{fullName:string;email:string}|null; }
interface AuditEntry { id:string; action:string; entity?:string|null; entityId?:string|null; metadata?:any; ipAddress?:string|null; createdAt:string; user?:{fullName:string;email:string;role:string}|null; }
interface Stats      { users:{total:number}; orders:{total:number;byStatus:Record<string,number>;active:number}; revenue:{totalCollected:number;totalTransactions:number;pendingBalance:number}; openTickets:number; recentAudit:AuditEntry[]; recentPayments:Payment[]; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt   = (n:number) => `KES ${n.toLocaleString()}`;
const fmtD  = (d:string) => new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
const fmtDT = (d:string) => new Date(d).toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});

// Groups an array by calendar month, most-recent first
function groupByMonth<T extends {createdAt:string}>(items:T[]):{month:string;items:T[]}[] {
  const map=new Map<string,T[]>();
  for(const it of items){
    const key=new Date(it.createdAt).toLocaleDateString("en-GB",{month:"long",year:"numeric"});
    if(!map.has(key))map.set(key,[]);
    map.get(key)!.push(it);
  }
  return Array.from(map.entries()).map(([month,items])=>({month,items}));
}

const ORDER_STATUS_META: Record<string,{label:string;color:string;bg:string}> = {
  PENDING_PAYMENT: {label:"Awaiting Payment",color:"#92620A",bg:"#FFFBEB"},
  IN_PRODUCTION:   {label:"In Production",   color:"#1E4D8C",bg:"#EFF6FF"},
  QUALITY_CHECK:   {label:"Quality Check",   color:"#5B21B6",bg:"#F5F3FF"},
  READY:           {label:"Ready",           color:"#065F46",bg:"#ECFDF5"},
  DELIVERING:      {label:"Delivering",      color:"#0E7490",bg:"#ECFEFF"},
  COMPLETED:       {label:"Completed",       color:"#14532D",bg:"#F0FDF4"},
  PAYMENT_FAILED:  {label:"Payment Failed",  color:"#991B1B",bg:"#FEF2F2"},
  PAYMENT_ERROR:   {label:"Payment Error",   color:"#7F1D1D",bg:"#FEF2F2"},
  CANCELLED:       {label:"Cancelled",       color:"#374151",bg:"#F9FAFB"},
  REFUNDED:        {label:"Refunded",        color:"#4B5563",bg:"#F3F4F6"},
};
const PAY_STATUS_META: Record<string,{color:string;bg:string}> = {
  PENDING:   {color:"#92620A",bg:"#FFFBEB"},
  COMPLETED: {color:"#14532D",bg:"#F0FDF4"},
  FAILED:    {color:"#991B1B",bg:"#FEF2F2"},
  REFUNDED:  {color:"#4B5563",bg:"#F3F4F6"},
  CANCELLED: {color:"#374151",bg:"#F9FAFB"},
};
const ROLE_META: Record<string,{color:string;bg:string}> = {
  CUSTOMER: {color:"#374151",bg:"#F3F4F6"},
  STAFF:    {color:"#1E4D8C",bg:"#EFF6FF"},
  ADMIN:    {color:"#7F1D1D",bg:"#FEF2F2"},
};
const TICKET_META: Record<string,{color:string;bg:string;label:string}> = {
  OPEN:        {color:"#991B1B",bg:"#FEF2F2",label:"Open"},
  IN_PROGRESS: {color:"#92620A",bg:"#FFFBEB",label:"In Progress"},
  RESOLVED:    {color:"#14532D",bg:"#F0FDF4",label:"Resolved"},
  CLOSED:      {color:"#374151",bg:"#F9FAFB",label:"Closed"},
};
const ALL_ORDER_STATUSES = Object.keys(ORDER_STATUS_META) as OrderStatus[];

// ─── Reusable micro-components ────────────────────────────────────────────────
function Badge({label,color,bg}:{label:string;color:string;bg:string}) {
  return <span style={{display:"inline-flex",alignItems:"center",padding:"3px 10px",borderRadius:99,background:bg,color,fontSize:"0.7rem",fontWeight:700,whiteSpace:"nowrap"}}>{label}</span>;
}

function Modal({title,onClose,children,wide}:{title:string;onClose:()=>void;children:React.ReactNode;wide?:boolean}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,12,8,0.6)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:14,width:"100%",maxWidth:wide?760:520,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 60px rgba(0,0,0,0.25)"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 24px",borderBottom:"1px solid #EDE8E0",position:"sticky",top:0,background:"#fff",zIndex:1,borderRadius:"14px 14px 0 0"}}>
          <h3 style={{fontFamily:"'DM Sans',sans-serif",fontSize:"1rem",fontWeight:800,color:"#1C1410"}}>{title}</h3>
          <button onClick={onClose} style={{background:"#F5F0EA",border:"none",borderRadius:7,width:28,height:28,cursor:"pointer",fontSize:"1rem",color:"#6B7280",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        <div style={{padding:"20px 24px"}}>{children}</div>
      </div>
    </div>
  );
}

function Toast({msg,type,onDone}:{msg:string;type:"ok"|"err";onDone:()=>void}) {
  useEffect(()=>{const t=setTimeout(onDone,3500);return()=>clearTimeout(t);},[onDone]);
  return <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,background:type==="ok"?"#14532D":"#991B1B",color:"#fff",padding:"12px 20px",borderRadius:10,fontSize:"0.875rem",fontWeight:600,boxShadow:"0 8px 32px rgba(0,0,0,0.22)",display:"flex",alignItems:"center",gap:10,maxWidth:420,animation:"slideup 0.25s ease"}}><span>{type==="ok"?"✓":"✕"}</span>{msg}</div>;
}

function Field({label,children}:{label:string;children:React.ReactNode}) {
  return <div style={{marginBottom:14}}><label style={{display:"block",fontSize:"0.68rem",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"#6B7280",marginBottom:5}}>{label}</label>{children}</div>;
}
const inp: React.CSSProperties = {width:"100%",background:"#F9F7F4",border:"1.5px solid #EDE8E0",borderRadius:8,padding:"8px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:"0.875rem",color:"#1C1410",outline:"none"};
const selStyle: React.CSSProperties = {...inp,cursor:"pointer"};

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const [admin, setAdmin]   = useState<AdminUser|null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab]       = useState<Tab>("overview");
  const [toast, setToast]   = useState<{msg:string;type:"ok"|"err"}|null>(null);
  const showToast = useCallback((msg:string,type:"ok"|"err"="ok")=>setToast({msg,type}),[]);
  const [confirmDlg, setConfirmDlg] = useState<{icon:string;title:string;body:string;confirmLabel:string;danger:boolean;onConfirm:()=>void}|null>(null);
  const askConfirm = (opts:{icon:string;title:string;body:string;confirmLabel:string;danger?:boolean;onConfirm:()=>void})=>setConfirmDlg({...opts,danger:opts.danger??false});

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(()=>{
    fetch("/api/auth/me").then(r=>r.json()).then(d=>{
      if(!d.user||d.user.role!=="ADMIN"){router.replace("/login?reason=admin");return;}
      setAdmin(d.user);
    }).catch(()=>router.replace("/login")).finally(()=>setAuthLoading(false));
  },[router]);

  const handleLogout = async()=>{ await fetch("/api/auth/logout",{method:"POST"}); router.push("/login"); };

  // ── Shared state ──────────────────────────────────────────────────────────
  const [stats,       setStats]       = useState<Stats|null>(null);
  const [users,       setUsers]       = useState<User[]>([]);
  const [orders,      setOrders]      = useState<Order[]>([]);
  const [payments,    setPayments]    = useState<Payment[]>([]);
  const [tickets,     setTickets]     = useState<Ticket[]>([]);
  const [auditLogs,   setAuditLogs]   = useState<AuditEntry[]>([]);
  const [_loading,    setLoading]     = useState(false); void _loading;
  const [totals,      setTotals]      = useState({users:0,orders:0,payments:0,tickets:0,audit:0});
  const [pages,       setPages]       = useState({users:1,orders:1,payments:1,tickets:1,audit:1});
  const LIMIT = 30;

  // Filters
  const [userSearch,  setUserSearch]  = useState(""); const [userRole,   setUserRole]   = useState("");
  const [orderSearch, setOrderSearch] = useState(""); const [orderSt,    setOrderSt]    = useState("");
  const [paySearch,   setPaySearch]   = useState(""); const [paySt,      setPaySt]      = useState("");
  const [tickSearch,  setTickSearch]  = useState(""); const [tickSt,     setTickSt]     = useState("");
  const [auditSearch, setAuditSearch] = useState(""); const [auditAct,   setAuditAct]   = useState("");

  // ── Monthly view state ────────────────────────────────────────────────────
  const [ordersMonthly,   setOrdersMonthly]   = useState(false);
  const [paymentsMonthly, setPaymentsMonthly] = useState(false);
  const [allOrders2,      setAllOrders2]      = useState<Order[]>([]);
  const [allPayments2,    setAllPayments2]    = useState<Payment[]>([]);
  const [monthlyLoading,  setMonthlyLoading]  = useState(false);

  const fetchAllOrders2 = useCallback(async()=>{
    setMonthlyLoading(true);
    const sp=new URLSearchParams({page:"1",limit:"500"});
    if(orderSt) sp.set("status",orderSt); if(orderSearch) sp.set("search",orderSearch);
    const r=await fetch(`/api/admin/orders?${sp}`);
    if(r.ok){const d=await r.json();setAllOrders2(d.orders);}
    setMonthlyLoading(false);
  },[orderSt,orderSearch]);

  const fetchAllPayments2 = useCallback(async()=>{
    setMonthlyLoading(true);
    const sp=new URLSearchParams({page:"1",limit:"500"});
    if(paySt) sp.set("status",paySt); if(paySearch) sp.set("search",paySearch);
    const r=await fetch(`/api/admin/payments?${sp}`);
    if(r.ok){const d=await r.json();setAllPayments2(d.payments);}
    setMonthlyLoading(false);
  },[paySt,paySearch]);

  // Modals
  const [userModal,    setUserModal]    = useState<{mode:"create"|"edit"|"view";user?:User}|null>(null);
  const [orderModal,   setOrderModal]   = useState<Order|null>(null);
  const [payModal,     setPayModal]     = useState<Payment|null>(null);
  const [tickModal,    setTickModal]    = useState<Ticket|null>(null);

  // ── Fetchers ──────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async()=>{
    const r=await fetch("/api/admin/stats"); if(r.ok) setStats(await r.json());
  },[]);

  const fetchUsers = useCallback(async(pg=pages.users)=>{
    setLoading(true);
    const sp=new URLSearchParams({page:String(pg),limit:String(LIMIT)});
    if(userRole) sp.set("role",userRole); if(userSearch) sp.set("search",userSearch);
    const r=await fetch(`/api/admin/users?${sp}`);
    if(r.ok){const d=await r.json();setUsers(d.users);setTotals(t=>({...t,users:d.total}));}
    setLoading(false);
  },[userRole,userSearch,pages.users]);

  const fetchOrders = useCallback(async(pg=pages.orders)=>{
    setLoading(true);
    const sp=new URLSearchParams({page:String(pg),limit:String(LIMIT)});
    if(orderSt) sp.set("status",orderSt); if(orderSearch) sp.set("search",orderSearch);
    const r=await fetch(`/api/admin/orders?${sp}`);
    if(r.ok){const d=await r.json();setOrders(d.orders);setTotals(t=>({...t,orders:d.total}));}
    setLoading(false);
  },[orderSt,orderSearch,pages.orders]);

  const fetchPayments = useCallback(async(pg=pages.payments)=>{
    setLoading(true);
    const sp=new URLSearchParams({page:String(pg),limit:String(LIMIT)});
    if(paySt) sp.set("status",paySt); if(paySearch) sp.set("search",paySearch);
    const r=await fetch(`/api/admin/payments?${sp}`);
    if(r.ok){const d=await r.json();setPayments(d.payments);setTotals(t=>({...t,payments:d.total}));}
    setLoading(false);
  },[paySt,paySearch,pages.payments]);

  const fetchTickets = useCallback(async(pg=pages.tickets)=>{
    setLoading(true);
    const sp=new URLSearchParams({page:String(pg),limit:String(LIMIT)});
    if(tickSt) sp.set("status",tickSt); if(tickSearch) sp.set("search",tickSearch);
    const r=await fetch(`/api/admin/tickets?${sp}`);
    if(r.ok){const d=await r.json();setTickets(d.tickets);setTotals(t=>({...t,tickets:d.total}));}
    setLoading(false);
  },[tickSt,tickSearch,pages.tickets]);

  const fetchAudit = useCallback(async(pg=pages.audit)=>{
    setLoading(true);
    const sp=new URLSearchParams({page:String(pg),limit:String(LIMIT)});
    if(auditAct) sp.set("action",auditAct); if(auditSearch) sp.set("search",auditSearch);
    const r=await fetch(`/api/admin/audit?${sp}`);
    if(r.ok){const d=await r.json();setAuditLogs(d.logs);setTotals(t=>({...t,audit:d.total}));}
    setLoading(false);
  },[auditAct,auditSearch,pages.audit]);

  useEffect(()=>{if(authLoading||!admin)return;
    if(tab==="overview") fetchStats();
    if(tab==="users")    fetchUsers();
    if(tab==="orders")   fetchOrders();
    if(tab==="payments") fetchPayments();
    if(tab==="support")  fetchTickets();
    if(tab==="audit")    fetchAudit();
  },[tab,admin,authLoading]);

  // Debounced re-fetch when filters change
  useEffect(()=>{if(tab!=="users"||!admin)return;const t=setTimeout(()=>fetchUsers(1),350);return()=>clearTimeout(t);},[userSearch,userRole]);
  useEffect(()=>{if(tab!=="orders"||!admin)return;const t=setTimeout(()=>fetchOrders(1),350);return()=>clearTimeout(t);},[orderSearch,orderSt]);
  useEffect(()=>{if(tab!=="payments"||!admin)return;const t=setTimeout(()=>fetchPayments(1),350);return()=>clearTimeout(t);},[paySearch,paySt]);
  useEffect(()=>{if(tab!=="support"||!admin)return;const t=setTimeout(()=>fetchTickets(1),350);return()=>clearTimeout(t);},[tickSearch,tickSt]);
  useEffect(()=>{if(tab!=="audit"||!admin)return;const t=setTimeout(()=>fetchAudit(1),350);return()=>clearTimeout(t);},[auditSearch,auditAct]);
  useEffect(()=>{if(!ordersMonthly||!admin)return;const t=setTimeout(()=>fetchAllOrders2(),350);return()=>clearTimeout(t);},[orderSearch,orderSt,ordersMonthly]);
  useEffect(()=>{if(!paymentsMonthly||!admin)return;const t=setTimeout(()=>fetchAllPayments2(),350);return()=>clearTimeout(t);},[paySearch,paySt,paymentsMonthly]);

  // ── User form state ───────────────────────────────────────────────────────
  const [uForm, setUForm] = useState({fullName:"",email:"",phone:"",password:"",role:"STAFF" as "STAFF"|"ADMIN",isActive:true,isVerified:true});
  const [uSaving, setUSaving] = useState(false);

  const openCreateUser = ()=>{ setUForm({fullName:"",email:"",phone:"",password:"",role:"STAFF",isActive:true,isVerified:true}); setUserModal({mode:"create"}); };
  const openEditUser   = (u:User)=>{ setUForm({fullName:u.fullName,email:u.email,phone:u.phone??"",password:"",role:u.role as "STAFF"|"ADMIN",isActive:u.isActive,isVerified:u.isVerified}); setUserModal({mode:"edit",user:u}); };

  const saveUser = async()=>{
    setUSaving(true);
    try{
      const isCreate = userModal?.mode==="create";
      const body: Record<string,unknown> = { fullName:uForm.fullName, email:uForm.email, role:uForm.role };
      if(uForm.phone)    body.phone      = uForm.phone;
      if(uForm.password) body.password   = uForm.password;
      if(!isCreate)      { body.isActive = uForm.isActive; body.isVerified = uForm.isVerified; }

      const url = isCreate ? "/api/admin/users" : `/api/admin/users/${userModal?.user?.id}`;
      const method = isCreate ? "POST" : "PATCH";
      const r = await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const d = await r.json().catch(()=>({}));
      if(!r.ok){showToast(d.error??"Save failed","err");return;}
      showToast(isCreate?"Staff account created.":"User updated.");
      setUserModal(null); fetchUsers();
    }finally{setUSaving(false);}
  };

  const deactivateUser = (id:string)=>askConfirm({
    icon:"🔒", title:"Deactivate account?", body:"This user will be unable to log in until reactivated.",
    confirmLabel:"Deactivate", danger:false,
    onConfirm: async()=>{
      const r=await fetch(`/api/admin/users/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({isActive:false})});
      if(r.ok){showToast("Account deactivated.");fetchUsers();}
      else showToast((await r.json()).error??"Failed","err");
    }
  });

  const activateUser = (id:string)=>askConfirm({
    icon:"🔓", title:"Activate account?", body:"This user will be able to log in again.",
    confirmLabel:"Activate", danger:false,
    onConfirm: async()=>{
      const r=await fetch(`/api/admin/users/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({isActive:true})});
      if(r.ok){showToast("Account activated.");fetchUsers();}
      else showToast((await r.json()).error??"Failed","err");
    }
  });

  const deleteUser = (id:string)=>askConfirm({
    icon:"🗑️", title:"Delete this user?", body:"This action is permanent and cannot be undone. All their session data will be removed.",
    confirmLabel:"Delete permanently", danger:true,
    onConfirm: async()=>{
      const r=await fetch(`/api/admin/users/${id}`,{method:"DELETE"});
      const d=await r.json().catch(()=>({}));
      if(r.ok){showToast("User deleted.");fetchUsers();}
      else showToast(d.error??"Failed","err");
    }
  });

  // ── Order edit state ──────────────────────────────────────────────────────
  const [oForm,  setOForm]  = useState({status:"" as OrderStatus|"",assignedTo:"",expectedReadyAt:"",specialNotes:"",discountCode:"",discountAmount:"",note:""});
  const [oSaving,setOSaving]= useState(false);

  const openOrder = (o:Order)=>{ setOForm({status:o.status,assignedTo:o.assignedTo??"",expectedReadyAt:o.expectedReadyAt?o.expectedReadyAt.slice(0,16):"",specialNotes:o.specialNotes??"",discountCode:o.discountCode??"",discountAmount:o.discountAmount?String(o.discountAmount):"",note:""}); setOrderModal(o); };

  const saveOrder = async()=>{
    if(!orderModal)return; setOSaving(true);
    try{
      const body: Record<string,unknown> = {};
      if(oForm.status&&oForm.status!==orderModal.status)            body.status=oForm.status;
      if(oForm.assignedTo!==orderModal.assignedTo)                  body.assignedTo=oForm.assignedTo||null;
      if(oForm.expectedReadyAt)                                      body.expectedReadyAt=new Date(oForm.expectedReadyAt).toISOString();
      if(oForm.specialNotes!==orderModal.specialNotes)               body.specialNotes=oForm.specialNotes||null;
      if(oForm.discountCode!==orderModal.discountCode)               body.discountCode=oForm.discountCode||null;
      if(oForm.discountAmount&&parseFloat(oForm.discountAmount)>=0)  body.discountAmount=parseFloat(oForm.discountAmount);
      if(oForm.note)                                                  body.note=oForm.note;
      if(!Object.keys(body).length){showToast("No changes.","err");return;}
      const r=await fetch(`/api/admin/orders/${orderModal.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const d=await r.json().catch(()=>({}));
      if(!r.ok){showToast(d.error??"Failed","err");return;}
      showToast("Order updated."); setOrderModal(null); fetchOrders();
    }finally{setOSaving(false);}
  };

  const deleteOrder = (id:string)=>askConfirm({
    icon:"🗑️", title:"Delete this order?", body:"This is permanent. Orders with completed payments cannot be deleted — cancel or refund them instead.",
    confirmLabel:"Delete order", danger:true,
    onConfirm: async()=>{
      const r=await fetch(`/api/admin/orders/${id}`,{method:"DELETE"});
      const d=await r.json().catch(()=>({}));
      if(r.ok){showToast("Order deleted.");fetchOrders();if(ordersMonthly)fetchAllOrders2();}
      else showToast(d.error??"Failed","err");
    }
  });

  // ── Payment correction state ──────────────────────────────────────────────
  const [pForm,  setPForm]  = useState({status:"" as PayStatus|"",amount:"",mpesaRef:"",failReason:"",adminNote:""});
  const [pSaving,setPSaving]= useState(false);

  const openPayment = (p:Payment)=>{ setPForm({status:p.status,amount:String(p.amount),mpesaRef:p.mpesaRef??"",failReason:p.failReason??"",adminNote:""}); setPayModal(p); };

  const savePayment = async()=>{
    if(!payModal)return; setPSaving(true);
    try{
      const body: Record<string,unknown> = {};
      if(pForm.status&&pForm.status!==payModal.status) body.status=pForm.status;
      if(pForm.amount&&parseFloat(pForm.amount)!==payModal.amount) body.amount=parseFloat(pForm.amount);
      if(pForm.mpesaRef!==payModal.mpesaRef)           body.mpesaRef=pForm.mpesaRef||null;
      if(pForm.failReason)                             body.failReason=pForm.failReason;
      if(pForm.adminNote)                              body.adminNote=pForm.adminNote;
      if(!Object.keys(body).filter(k=>k!=="adminNote").length&&!body.adminNote){showToast("No changes.","err");return;}
      const r=await fetch(`/api/admin/payments/${payModal.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const d=await r.json().catch(()=>({}));
      if(!r.ok){showToast(d.error??"Failed","err");return;}
      showToast("Payment corrected."); setPayModal(null); fetchPayments(); if(tab==="overview")fetchStats();
    }finally{setPSaving(false);}
  };

  // ── Ticket reply state ────────────────────────────────────────────────────
  const [tForm,  setTForm]  = useState({status:"" as TicketStatus|"",response:""});
  const [tSaving,setTSaving]= useState(false);

  const openTicket=(t:Ticket)=>{setTForm({status:t.status,response:t.response??""}); setTickModal(t);};
  const saveTicket=async()=>{
    if(!tickModal)return; setTSaving(true);
    try{
      const body: Record<string,unknown>={};
      if(tForm.status&&tForm.status!==tickModal.status) body.status=tForm.status;
      if(tForm.response.trim()) body.response=tForm.response;
      if(!Object.keys(body).length){showToast("Nothing to save.","err");return;}
      const r=await fetch(`/api/admin/tickets/${tickModal.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const d=await r.json().catch(()=>({}));
      if(!r.ok){showToast(d.error??"Failed","err");return;}
      showToast("Ticket updated."); setTickModal(null); fetchTickets();
    }finally{setTSaving(false);}
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if(authLoading) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",color:"#6B7280"}}><div style={{textAlign:"center"}}><div style={{width:40,height:40,border:"3px solid #EDE8E0",borderTopColor:"#1C1410",borderRadius:"50%",animation:"spin 0.7s linear infinite",margin:"0 auto 12px"}}/>Verifying…</div></div>;

  const NAV: {id:Tab;icon:string;label:string}[] = [
    {id:"overview",icon:"◈",label:"Overview"},
    {id:"users",   icon:"👥",label:"Users & Staff"},
    {id:"orders",  icon:"🗂️",label:"Orders"},
    {id:"payments",icon:"💳",label:"Payments"},
    {id:"support", icon:"🎫",label:"Support"},
    {id:"audit",   icon:"📋",label:"Audit Log"},
  ];

  const totalPages=(key:keyof typeof totals)=>Math.max(1,Math.ceil(totals[key]/LIMIT));
  const pg=(key:keyof typeof pages)=>pages[key];
  const setPg=(key:keyof typeof pages,v:number)=>setPages(p=>({...p,[key]:v}));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{height:100%;font-family:'DM Sans',sans-serif;background:#F2F0FF;color:#12101E;}
        ::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(0,204,221,0.35);border-radius:99px;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes slideup{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
        @keyframes fadein{from{opacity:0;}to{opacity:1;}}
        .shell{display:flex;min-height:100vh;}
        .sidebar{width:230px;min-height:100vh;background:#0C0B1A;display:flex;flex-direction:column;flex-shrink:0;position:sticky;top:0;height:100vh;overflow-y:auto;}
        .main{flex:1;min-width:0;display:flex;flex-direction:column;}
        .sb-logo{padding:18px 20px 14px;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;flex-direction:column;gap:8px;}
        .sb-logo-img{height:36px;width:auto;object-fit:contain;display:block;}
        .sb-pill{display:inline-block;background:rgba(220,0,110,0.2);border:1px solid rgba(220,0,110,0.4);color:#FF80C8;font-size:0.6rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;padding:2px 9px;border-radius:99px;width:fit-content;}
        .sb-nav{flex:1;padding:10px 0;}
        .sb-item{display:flex;align-items:center;gap:10px;padding:10px 20px;font-size:0.83rem;font-weight:500;color:#8B8FA8;cursor:pointer;transition:background 0.15s,color 0.15s;border-left:3px solid transparent;}
        .sb-item:hover{background:rgba(255,255,255,0.04);color:#E0DDFF;}
        .sb-item.active{background:rgba(255,214,0,0.1);color:#FFD600;border-left-color:#FFD600;}
        .sb-icon{font-size:1rem;width:20px;text-align:center;flex-shrink:0;}
        .sb-footer{padding:14px 20px;border-top:1px solid rgba(255,255,255,0.07);}
        .sb-user{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
        .sb-avatar{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#DC006E,#7A003D);display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-size:0.8rem;font-weight:700;color:#fff;flex-shrink:0;}
        .sb-uname{font-size:0.75rem;font-weight:600;color:#FFD600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .sb-logout{background:none;border:none;cursor:pointer;font-size:0.72rem;color:#6B7280;padding:0;transition:color 0.15s;font-family:'DM Sans',sans-serif;width:100%;text-align:left;}
        .sb-logout:hover{color:#FF80C8;}
        .topbar{background:#fff;border-bottom:1px solid #E4DEFF;padding:0 28px;height:56px;display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:30;box-shadow:0 1px 4px rgba(12,11,26,0.06);}
        .topbar-title{font-family:'DM Sans',sans-serif;font-size:1rem;font-weight:700;color:#12101E;flex:1;}
        .content{padding:22px 28px;flex:1;}
        .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px;}
        .sc{background:#fff;border:1px solid #E4DEFF;border-radius:12px;padding:16px 18px;position:relative;overflow:hidden;}
        .sc-accent{position:absolute;top:0;left:0;right:0;height:3px;border-radius:12px 12px 0 0;}
        .sc-icon{font-size:1.3rem;margin-bottom:8px;}
        .sc-label{font-size:0.68rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;margin-bottom:3px;}
        .sc-val{font-family:'DM Sans',sans-serif;font-size:1.55rem;font-weight:800;color:#12101E;line-height:1;}
        .sc-sub{font-size:0.7rem;color:#9CA3AF;margin-top:3px;}
        .tbl-wrap{background:#fff;border:1px solid #E4DEFF;border-radius:12px;overflow:hidden;}
        .tbl-toolbar{padding:12px 16px;border-bottom:1px solid #E4DEFF;display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
        .srch{position:relative;flex:1;min-width:180px;}
        .srch-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#9CA3AF;font-size:0.85rem;pointer-events:none;}
        .srch-inp{width:100%;background:#F4F2FF;border:1.5px solid #E4DEFF;border-radius:8px;padding:7px 10px 7px 30px;font-family:'DM Sans',sans-serif;font-size:0.84rem;color:#12101E;outline:none;}
        .srch-inp:focus{border-color:#FFD600;}
        .flt-sel{background:#F4F2FF;border:1.5px solid #E4DEFF;border-radius:8px;padding:7px 10px;font-family:'DM Sans',sans-serif;font-size:0.82rem;color:#12101E;cursor:pointer;outline:none;}
        .add-btn{background:#0C0B1A;color:#FFD600;border:none;border-radius:8px;padding:7px 14px;font-family:'DM Sans',sans-serif;font-size:0.82rem;font-weight:700;cursor:pointer;white-space:nowrap;transition:background 0.15s;display:flex;align-items:center;gap:5px;}
        .add-btn:hover{background:#1E1A3A;}
        .tbl-scroll{overflow-x:auto;}
        table{width:100%;border-collapse:collapse;min-width:700px;}
        thead th{padding:9px 14px;font-size:0.67rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;background:#F8F7FF;border-bottom:1px solid #E4DEFF;text-align:left;white-space:nowrap;}
        tbody td{padding:11px 14px;font-size:0.83rem;color:#12101E;border-bottom:1px solid #EBE8FF;vertical-align:middle;}
        tbody tr:last-child td{border-bottom:none;}
        tbody tr:hover td{background:#F8F7FF;}
        .mono{font-family:monospace;font-size:0.76rem;color:#6B7280;}
        .tbl-foot{padding:9px 16px;background:#F8F7FF;border-top:1px solid #E4DEFF;display:flex;justify-content:space-between;align-items:center;font-size:0.73rem;color:#9CA3AF;flex-wrap:wrap;gap:8px;}
        .pg-btn{background:#F4F2FF;border:1.5px solid #E4DEFF;border-radius:6px;padding:3px 10px;font-family:'DM Sans',sans-serif;font-size:0.75rem;font-weight:600;cursor:pointer;color:#374151;transition:all 0.15s;}
        .pg-btn:hover:not(:disabled){border-color:#FFD600;color:#8A7200;}
        .pg-btn:disabled{opacity:0.35;cursor:default;}
        .act-btn{padding:3px 10px;border-radius:6px;font-size:0.72rem;font-weight:700;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.15s;white-space:nowrap;}
        .btn-edit{background:#DFFBFF;color:#006680;}
        .btn-edit:hover{background:#B0F0FA;}
        .btn-deact{background:#FFF0F8;color:#CC005A;}
        .btn-deact:hover{background:#FFD6ED;}
        .btn-actv{background:#FFFBE0;color:#7A6200;}
        .btn-actv:hover{background:#FFF580;}
        .btn-del{background:#5C0030;color:#FFD6ED;}
        .btn-del:hover{background:#8A0048;}
        .section-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
        .section-title{font-family:'DM Sans',sans-serif;font-size:0.95rem;font-weight:700;color:#12101E;}
        .two-col{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px;}
        .card{background:#fff;border:1px solid #E4DEFF;border-radius:12px;padding:16px 18px;}
        .card-title{font-size:0.7rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #EBE8FF;}
        .audit-item{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid #F4F2FF;}
        .audit-item:last-child{border-bottom:none;}
        .audit-dot{width:8px;height:8px;border-radius:50%;background:#FFD600;flex-shrink:0;margin-top:4px;}
        .audit-body{flex:1;min-width:0;}
        .audit-action{font-size:0.78rem;font-weight:700;color:#12101E;}
        .audit-meta{font-size:0.7rem;color:#9CA3AF;margin-top:1px;}
        .save-btn{flex:1;background:#0C0B1A;color:#FFD600;border:none;border-radius:8px;padding:10px;font-family:'DM Sans',sans-serif;font-size:0.88rem;font-weight:700;cursor:pointer;transition:background 0.15s;display:flex;align-items:center;justify-content:center;gap:8px;}
        .save-btn:hover:not(:disabled){background:#1E1A3A;}
        .save-btn:disabled{opacity:0.5;cursor:default;}
        .cancel-btn{background:#F4F2FF;border:1.5px solid #E4DEFF;color:#374151;border-radius:8px;padding:10px 16px;font-family:'DM Sans',sans-serif;font-size:0.88rem;font-weight:600;cursor:pointer;}
        .spinner-sm{width:15px;height:15px;border:2px solid rgba(255,255,255,0.25);border-top-color:#FFD600;border-radius:50%;animation:spin 0.7s linear infinite;}
        .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 16px;}
        .info-row{padding:5px 0;border-bottom:1px solid #F4F2FF;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;}
        .info-label{font-size:0.7rem;color:#9CA3AF;white-space:nowrap;}
        .info-val{font-size:0.82rem;font-weight:600;color:#12101E;text-align:right;word-break:break-word;}
        .tl{display:flex;flex-direction:column;}
        .tl-item{display:flex;gap:10px;padding-bottom:12px;}
        .tl-dot-w{display:flex;flex-direction:column;align-items:center;width:16px;flex-shrink:0;}
        .tl-dot{width:8px;height:8px;border-radius:50%;background:#FFD600;margin-top:3px;}
        .tl-line{flex:1;width:1.5px;background:#E4DEFF;margin-top:3px;}
        .tl-body{flex:1;}
        .tl-status{font-size:0.76rem;font-weight:700;color:#12101E;}
        .tl-meta{font-size:0.68rem;color:#9CA3AF;}
        .tl-note{font-size:0.72rem;color:#3D3070;background:#FFFBE0;border-radius:4px;padding:3px 7px;margin-top:4px;border-left:2px solid #FFD600;}
        .readonly-note{font-size:0.7rem;color:#9CA3AF;font-style:italic;padding:6px 10px;background:#F4F2FF;border-radius:6px;margin-top:8px;}
        .psec-title{font-size:0.67rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#9CA3AF;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #EBE8FF;margin-top:16px;}
        .cdlg-overlay{position:fixed;inset:0;background:rgba(12,11,26,0.6);z-index:900;display:flex;align-items:center;justify-content:center;animation:fadein 0.15s ease;}
        .cdlg{background:#fff;border-radius:14px;padding:28px 26px 22px;width:min(420px,92vw);box-shadow:0 20px 60px rgba(0,0,0,0.22);animation:slideup 0.2s ease;}
        .cdlg-icon{font-size:2rem;margin-bottom:12px;text-align:center;}
        .cdlg-title{font-family:'Syne',sans-serif;font-size:1.05rem;font-weight:700;color:#12101E;margin-bottom:6px;text-align:center;}
        .cdlg-body{font-size:0.85rem;color:#6B7280;text-align:center;line-height:1.55;margin-bottom:22px;}
        .cdlg-btns{display:flex;gap:10px;}
        .cdlg-cancel{flex:1;background:#F4F2FF;border:1.5px solid #E4DEFF;color:#374151;border-radius:8px;padding:10px;font-family:'DM Sans',sans-serif;font-size:0.88rem;font-weight:600;cursor:pointer;}
        .cdlg-confirm{flex:1;border:none;border-radius:8px;padding:10px;font-family:'DM Sans',sans-serif;font-size:0.88rem;font-weight:700;cursor:pointer;}
        .cdlg-confirm.danger{background:#5C0030;color:#FFD6ED;}
        .cdlg-confirm.normal{background:#0C0B1A;color:#FFD600;}
        @media(max-width:1024px){.stats-grid{grid-template-columns:1fr 1fr;}.two-col{grid-template-columns:1fr;}}
        @media(max-width:768px){.sidebar{width:58px;}.sb-pill,.sb-uname,.sb-logout{display:none;}.sb-item span:not(.sb-icon){display:none;}.sb-item{padding:10px;justify-content:center;}.content{padding:14px;}.topbar{padding:0 14px;}.stats-grid{grid-template-columns:1fr 1fr;}}
        @media(max-width:480px){.stats-grid{grid-template-columns:1fr;}}
      `}</style>

      <div className="shell">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sb-logo">
            <img src="/logo.png" alt="FrankStat" className="sb-logo-img"/>
            <span className="sb-pill">Admin</span>
          </div>
          <nav className="sb-nav">
            {NAV.map(n=>(
              <div key={n.id} className={`sb-item${tab===n.id?" active":""}`} onClick={()=>setTab(n.id)}>
                <span className="sb-icon">{n.icon}</span>
                <span>{n.label}</span>
              </div>
            ))}
            <div style={{margin:"8px 20px",borderTop:"1px solid rgba(255,255,255,0.07)"}}/>
            <a href="/admin/banner" className="sb-item" style={{textDecoration:"none",color:"#00CCDD",gap:10}}>
              <span className="sb-icon">📢</span>
              <span>Offer Banner</span>
            </a>
          </nav>
          <div className="sb-footer">
            <div className="sb-user">
              <div className="sb-avatar">{admin?.fullName?.[0]?.toUpperCase()??"A"}</div>
              <div style={{minWidth:0}}><div className="sb-uname">{admin?.fullName}</div></div>
            </div>
            <button className="sb-logout" onClick={handleLogout}>Sign out →</button>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="main">
          <header className="topbar">
            <div className="topbar-title">
              {NAV.find(n=>n.id===tab)?.label ?? "Dashboard"}
            </div>
            <div style={{fontSize:"0.75rem",color:"#9CA3AF"}}>{admin?.email}</div>
          </header>

          <div className="content">

            {/* ══ OVERVIEW ══ */}
            {tab==="overview"&&(
              <>
                <div className="stats-grid">
                  {[
                    {icon:"👥",label:"Total Users",    val:stats?.users.total??0,       sub:"registered accounts",  accent:"#FFD600"},
                    {icon:"🗂️",label:"Total Orders",   val:stats?.orders.total??0,      sub:`${stats?.orders.active??0} active`,accent:"#00CCDD"},
                    {icon:"💰",label:"Revenue Collected",val:stats?fmt(stats.revenue.totalCollected):"—",sub:`${stats?.revenue.totalTransactions??0} transactions`,accent:"#DC006E",big:true},
                    {icon:"⏳",label:"Balance Pending",  val:stats?fmt(stats.revenue.pendingBalance):"—",sub:"on active orders",accent:"#FFD600",big:true},
                  ].map(s=>(
                    <div key={s.label} className="sc">
                      <div className="sc-accent" style={{background:s.accent}}/>
                      <div className="sc-icon">{s.icon}</div>
                      <div className="sc-label">{s.label}</div>
                      <div className="sc-val" style={(s as any).big?{fontSize:"1.2rem"}:{}}>{s.val}</div>
                      <div className="sc-sub">{s.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Quick actions */}
                <div className="card" style={{marginBottom:18}}>
                  <div className="card-title">Quick Actions</div>
                  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                    <a href="/admin/banner" style={{display:"inline-flex",alignItems:"center",gap:7,background:"rgba(0,204,221,0.08)",border:"1px solid rgba(0,204,221,0.3)",borderRadius:9,padding:"9px 16px",textDecoration:"none",color:"#00CCDD",fontSize:"0.82rem",fontWeight:600,transition:"background 0.15s"}}
                      onMouseEnter={e=>(e.currentTarget.style.background="rgba(0,204,221,0.18)")}
                      onMouseLeave={e=>(e.currentTarget.style.background="rgba(0,204,221,0.08)")}>
                      <span>📢</span> Manage Offer Banner
                    </a>
                  </div>
                </div>

                <div className="two-col">
                  {/* Recent payments */}
                  <div className="card">
                    <div className="card-title">Recent Payments</div>
                    {(stats?.recentPayments??[]).map((p:any)=>(
                      <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid #F9F7F4"}}>
                        <div>
                          <div style={{fontSize:"0.8rem",fontWeight:600}}>{p.order?.user?.fullName??"—"} · {p.order?.serviceName??"—"}</div>
                          <div style={{fontSize:"0.7rem",color:"#9CA3AF"}}>{fmtDT(p.createdAt)} · {p.type}</div>
                        </div>
                        <div style={{fontWeight:700,fontSize:"0.85rem"}}>{fmt(p.amount)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Recent audit */}
                  <div className="card">
                    <div className="card-title">Recent Activity</div>
                    <div className="tl">
                      {(stats?.recentAudit??[]).map((a:any,i:number,arr:any[])=>(
                        <div key={a.id} className="tl-item">
                          <div className="tl-dot-w">
                            <div className="tl-dot" style={{background:i===0?"#FFD600":i===1?"#00CCDD":i===2?"#DC006E":"#8B8FA8"}}/>
                            {i<arr.length-1&&<div className="tl-line"/>}
                          </div>
                          <div className="tl-body">
                            <div className="tl-status">{a.action}</div>
                            <div className="tl-meta">{a.user?.email??""} · {fmtDT(a.createdAt)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Order status breakdown */}
                <div className="card">
                  <div className="card-title">Orders by Status</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:4}}>
                    {stats&&Object.entries(stats.orders.byStatus).map(([s,c])=>{
                      const m=ORDER_STATUS_META[s];
                      return m?<div key={s} style={{background:m.bg,border:`1px solid ${m.color}25`,borderRadius:8,padding:"8px 14px",display:"flex",flexDirection:"column",gap:2}}>
                        <span style={{fontSize:"0.68rem",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:m.color}}>{m.label}</span>
                        <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:"1.4rem",fontWeight:800,color:m.color}}>{c as number}</span>
                      </div>:null;
                    })}
                  </div>
                </div>
              </>
            )}

            {/* ══ USERS ══ */}
            {tab==="users"&&(
              <div className="tbl-wrap">
                <div className="tbl-toolbar">
                  <div className="srch"><span className="srch-icon">🔍</span><input className="srch-inp" placeholder="Search name, email, phone…" value={userSearch} onChange={e=>setUserSearch(e.target.value)}/></div>
                  <select className="flt-sel" value={userRole} onChange={e=>setUserRole(e.target.value)}><option value="">All Roles</option><option value="CUSTOMER">Customer</option><option value="STAFF">Staff</option><option value="ADMIN">Admin</option></select>
                  <button className="add-btn" onClick={openCreateUser}>+ Add Staff / Admin</button>
                </div>
                <div className="tbl-scroll">
                  <table>
                    <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th>Orders</th><th>Joined</th><th>Last Login</th><th>Actions</th></tr></thead>
                    <tbody>
                      {users.map(u=>(
                        <tr key={u.id}>
                          <td style={{fontWeight:600}}>{u.fullName}</td>
                          <td style={{fontSize:"0.8rem"}}>{u.email}</td>
                          <td style={{fontSize:"0.8rem"}}>{u.phone??"—"}</td>
                          <td><Badge label={u.role} color={ROLE_META[u.role]?.color??""} bg={ROLE_META[u.role]?.bg??""}/></td>
                          <td>
                            <span style={{fontSize:"0.72rem",fontWeight:700,color:u.isActive?"#14532D":"#991B1B"}}>{u.isActive?"Active":"Inactive"}</span>
                            {!u.isVerified&&<span style={{marginLeft:5,fontSize:"0.68rem",color:"#92620A"}}>Unverified</span>}
                          </td>
                          <td style={{textAlign:"center"}}>{u._count.orders}</td>
                          <td style={{fontSize:"0.75rem",color:"#9CA3AF",whiteSpace:"nowrap"}}>{fmtD(u.createdAt)}</td>
                          <td style={{fontSize:"0.75rem",color:"#9CA3AF",whiteSpace:"nowrap"}}>{u.lastLoginAt?fmtDT(u.lastLoginAt):"Never"}</td>
                          <td>
                            <div style={{display:"flex",gap:5}}>
                              <button className="act-btn btn-edit" onClick={()=>openEditUser(u)}>Edit</button>
                              {u.isActive
                                ? <button className="act-btn btn-deact" onClick={()=>deactivateUser(u.id)}>Deactivate</button>
                                : <button className="act-btn btn-actv" onClick={()=>activateUser(u.id)}>Activate</button>
                              }
                              <button className="act-btn btn-del" onClick={()=>deleteUser(u.id)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="tbl-foot">
                  <span>{totals.users} users</span>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <button className="pg-btn" disabled={pg("users")<=1} onClick={()=>{setPg("users",pg("users")-1);fetchUsers(pg("users")-1);}}>← Prev</button>
                    <span>Page {pg("users")} / {totalPages("users")}</span>
                    <button className="pg-btn" disabled={pg("users")>=totalPages("users")} onClick={()=>{setPg("users",pg("users")+1);fetchUsers(pg("users")+1);}}>Next →</button>
                  </div>
                </div>
              </div>
            )}

            {/* ══ ORDERS ══ */}
            {tab==="orders"&&(
              <div className="tbl-wrap">
                <div className="tbl-toolbar">
                  <div className="srch"><span className="srch-icon">🔍</span><input className="srch-inp" placeholder="Search order, customer, receipt…" value={orderSearch} onChange={e=>setOrderSearch(e.target.value)}/></div>
                  <select className="flt-sel" value={orderSt} onChange={e=>setOrderSt(e.target.value)}><option value="">All Statuses</option>{ALL_ORDER_STATUSES.map(s=><option key={s} value={s}>{ORDER_STATUS_META[s]?.label}</option>)}</select>
                  <button
                    style={{background:ordersMonthly?"#1C1410":"#F9F7F4",color:ordersMonthly?"#fff":"#374151",border:"1.5px solid #EDE8E0",borderRadius:8,padding:"7px 14px",fontSize:"0.82rem",fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'DM Sans',sans-serif"}}
                    onClick={()=>{const next=!ordersMonthly;setOrdersMonthly(next);if(next)fetchAllOrders2();}}
                  >
                    {ordersMonthly?"📋 Table View":"📅 Monthly View"}
                  </button>
                </div>

                {ordersMonthly ? (
                  monthlyLoading ? (
                    <div style={{padding:"2.5rem",textAlign:"center",color:"#9CA3AF",fontSize:"0.88rem"}}>⏳ Loading monthly data…</div>
                  ) : (
                    <>
                      {groupByMonth(allOrders2).map(({month,items})=>{
                        const total  =items.reduce((s,o)=>s+o.totalPrice,0);
                        const balance=items.reduce((s,o)=>s+o.balanceDue,0);
                        return (
                          <div key={month} style={{borderBottom:"1px solid #EDE8E0"}}>
                            <div style={{background:"#FAFAF9",borderBottom:"1px solid #EDE8E0",padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                              <div>
                                <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:"0.88rem",fontWeight:700,color:"#1C1410"}}>📅 {month}</span>
                                <span style={{marginLeft:10,fontSize:"0.73rem",color:"#9CA3AF"}}>{items.length} order{items.length!==1?"s":""}</span>
                              </div>
                              <div style={{display:"flex",gap:18,fontSize:"0.75rem",flexWrap:"wrap"}}>
                                <span>Revenue: <strong style={{color:"#14532D"}}>{fmt(total)}</strong></span>
                                {balance>0&&<span>Balance due: <strong style={{color:"#D97706"}}>{fmt(balance)}</strong></span>}
                              </div>
                            </div>
                            <div className="tbl-scroll">
                              <table>
                                <thead><tr><th>ID</th><th>Customer</th><th>Service</th><th>Qty</th><th>Total</th><th>Balance</th><th>Status</th><th>Date</th><th></th></tr></thead>
                                <tbody>
                                  {items.map(o=>(
                                    <tr key={o.id}>
                                      <td><span className="mono">{o.id.slice(-10).toUpperCase()}</span></td>
                                      <td><div style={{fontWeight:600,fontSize:"0.83rem"}}>{o.user?.fullName??"—"}</div><div style={{fontSize:"0.72rem",color:"#9CA3AF"}}>{o.user?.email??""}</div></td>
                                      <td><div style={{fontWeight:600}}>{o.serviceName}</div>{o.dimensions&&<div style={{fontSize:"0.72rem",color:"#9CA3AF"}}>{o.dimensions}</div>}</td>
                                      <td style={{textAlign:"center"}}>{o.quantity}</td>
                                      <td style={{fontWeight:700}}>{fmt(o.totalPrice)}</td>
                                      <td style={{fontWeight:600,color:o.balanceDue>0?"#D97706":"#14532D"}}>{fmt(o.balanceDue)}</td>
                                      <td><Badge label={ORDER_STATUS_META[o.status]?.label??o.status} color={ORDER_STATUS_META[o.status]?.color??""} bg={ORDER_STATUS_META[o.status]?.bg??""}/></td>
                                      <td style={{fontSize:"0.75rem",color:"#9CA3AF",whiteSpace:"nowrap"}}>{fmtD(o.createdAt)}</td>
                                      <td><div style={{display:"flex",gap:5}}><button className="act-btn btn-edit" onClick={()=>openOrder(o)}>Edit</button><button className="act-btn btn-del" onClick={()=>deleteOrder(o.id)}>Delete</button></div></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                      {allOrders2.length===0&&<div style={{padding:"2.5rem",textAlign:"center",color:"#9CA3AF"}}>No orders found.</div>}
                      <div className="tbl-foot"><span>{allOrders2.length} orders (all months)</span></div>
                    </>
                  )
                ) : (
                  <>
                    <div className="tbl-scroll">
                      <table>
                        <thead><tr><th>ID</th><th>Customer</th><th>Service</th><th>Qty</th><th>Total</th><th>Balance</th><th>Status</th><th>Date</th><th></th></tr></thead>
                        <tbody>
                          {orders.map(o=>(
                            <tr key={o.id}>
                              <td><span className="mono">{o.id.slice(-10).toUpperCase()}</span></td>
                              <td><div style={{fontWeight:600,fontSize:"0.83rem"}}>{o.user?.fullName??"—"}</div><div style={{fontSize:"0.72rem",color:"#9CA3AF"}}>{o.user?.email??""}</div></td>
                              <td><div style={{fontWeight:600}}>{o.serviceName}</div>{o.dimensions&&<div style={{fontSize:"0.72rem",color:"#9CA3AF"}}>{o.dimensions}</div>}</td>
                              <td style={{textAlign:"center"}}>{o.quantity}</td>
                              <td style={{fontWeight:700}}>{fmt(o.totalPrice)}</td>
                              <td style={{fontWeight:600,color:o.balanceDue>0?"#D97706":"#14532D"}}>{fmt(o.balanceDue)}</td>
                              <td><Badge label={ORDER_STATUS_META[o.status]?.label??o.status} color={ORDER_STATUS_META[o.status]?.color??""} bg={ORDER_STATUS_META[o.status]?.bg??""}/></td>
                              <td style={{fontSize:"0.75rem",color:"#9CA3AF",whiteSpace:"nowrap"}}>{fmtD(o.createdAt)}</td>
                              <td><div style={{display:"flex",gap:5}}><button className="act-btn btn-edit" onClick={()=>openOrder(o)}>Edit</button><button className="act-btn btn-del" onClick={()=>deleteOrder(o.id)}>Delete</button></div></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="tbl-foot">
                      <span>{totals.orders} orders</span>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <button className="pg-btn" disabled={pg("orders")<=1} onClick={()=>{setPg("orders",pg("orders")-1);fetchOrders(pg("orders")-1);}}>← Prev</button>
                        <span>Page {pg("orders")} / {totalPages("orders")}</span>
                        <button className="pg-btn" disabled={pg("orders")>=totalPages("orders")} onClick={()=>{setPg("orders",pg("orders")+1);fetchOrders(pg("orders")+1);}}>Next →</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ══ PAYMENTS ══ */}
            {tab==="payments"&&(
              <div className="tbl-wrap">
                <div className="tbl-toolbar">
                  <div className="srch"><span className="srch-icon">🔍</span><input className="srch-inp" placeholder="Search M-Pesa ref, customer, order…" value={paySearch} onChange={e=>setPaySearch(e.target.value)}/></div>
                  <select className="flt-sel" value={paySt} onChange={e=>setPaySt(e.target.value)}><option value="">All</option>{["PENDING","COMPLETED","FAILED","REFUNDED","CANCELLED"].map(s=><option key={s} value={s}>{s}</option>)}</select>
                  <button
                    style={{background:paymentsMonthly?"#1C1410":"#F9F7F4",color:paymentsMonthly?"#fff":"#374151",border:"1.5px solid #EDE8E0",borderRadius:8,padding:"7px 14px",fontSize:"0.82rem",fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'DM Sans',sans-serif"}}
                    onClick={()=>{const next=!paymentsMonthly;setPaymentsMonthly(next);if(next)fetchAllPayments2();}}
                  >
                    {paymentsMonthly?"📋 Table View":"📅 Monthly View"}
                  </button>
                </div>

                {paymentsMonthly ? (
                  monthlyLoading ? (
                    <div style={{padding:"2.5rem",textAlign:"center",color:"#9CA3AF",fontSize:"0.88rem"}}>⏳ Loading monthly data…</div>
                  ) : (
                    <>
                      {groupByMonth(allPayments2).map(({month,items})=>{
                        const collected=items.filter(p=>p.status==="COMPLETED").reduce((s,p)=>s+p.amount,0);
                        return (
                          <div key={month} style={{borderBottom:"1px solid #EDE8E0"}}>
                            <div style={{background:"#FAFAF9",borderBottom:"1px solid #EDE8E0",padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                              <div>
                                <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:"0.88rem",fontWeight:700,color:"#1C1410"}}>📅 {month}</span>
                                <span style={{marginLeft:10,fontSize:"0.73rem",color:"#9CA3AF"}}>{items.length} transaction{items.length!==1?"s":""}</span>
                              </div>
                              <span style={{fontSize:"0.75rem"}}>Collected: <strong style={{color:"#14532D"}}>{fmt(collected)}</strong></span>
                            </div>
                            <div className="tbl-scroll">
                              <table>
                                <thead><tr><th>Order</th><th>Customer</th><th>Type</th><th>Amount</th><th>M-Pesa Ref</th><th>Method</th><th>Status</th><th>Date</th><th></th></tr></thead>
                                <tbody>
                                  {items.map(p=>(
                                    <tr key={p.id}>
                                      <td><span className="mono">{(p.order?.id ?? p.id).slice(-10).toUpperCase()}</span></td>
                                      <td style={{fontSize:"0.8rem"}}>{(p as any).order?.user?.fullName??p.mpesaPhone??""}</td>
                                      <td><span style={{fontSize:"0.72rem",fontWeight:700,background:"#EFF6FF",color:"#1D4ED8",padding:"2px 8px",borderRadius:99}}>{p.type}</span></td>
                                      <td style={{fontWeight:700}}>{fmt(p.amount)}</td>
                                      <td><span className="mono">{p.mpesaRef??"—"}</span></td>
                                      <td style={{fontSize:"0.78rem"}}>{p.method}</td>
                                      <td><Badge label={p.status} color={PAY_STATUS_META[p.status]?.color??""} bg={PAY_STATUS_META[p.status]?.bg??""}/></td>
                                      <td style={{fontSize:"0.75rem",color:"#9CA3AF",whiteSpace:"nowrap"}}>{fmtDT(p.createdAt)}</td>
                                      <td><button className="act-btn btn-edit" onClick={()=>openPayment(p)}>Correct</button></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                      {allPayments2.length===0&&<div style={{padding:"2.5rem",textAlign:"center",color:"#9CA3AF"}}>No payments found.</div>}
                      <div className="tbl-foot"><span>{allPayments2.length} payments (all months)</span></div>
                    </>
                  )
                ) : (
                  <>
                    <div className="tbl-scroll">
                      <table>
                        <thead><tr><th>Order</th><th>Customer</th><th>Type</th><th>Amount</th><th>M-Pesa Ref</th><th>Method</th><th>Status</th><th>Date</th><th></th></tr></thead>
                        <tbody>
                          {payments.map(p=>(
                            <tr key={p.id}>
                              <td><span className="mono">{(p.order?.id ?? p.id).slice(-10).toUpperCase()}</span></td>
                              <td style={{fontSize:"0.8rem"}}>{(p as any).order?.user?.fullName??p.mpesaPhone??""}</td>
                              <td><span style={{fontSize:"0.72rem",fontWeight:700,background:"#EFF6FF",color:"#1D4ED8",padding:"2px 8px",borderRadius:99}}>{p.type}</span></td>
                              <td style={{fontWeight:700}}>{fmt(p.amount)}</td>
                              <td><span className="mono">{p.mpesaRef??"—"}</span></td>
                              <td style={{fontSize:"0.78rem"}}>{p.method}</td>
                              <td><Badge label={p.status} color={PAY_STATUS_META[p.status]?.color??""} bg={PAY_STATUS_META[p.status]?.bg??""}/></td>
                              <td style={{fontSize:"0.75rem",color:"#9CA3AF",whiteSpace:"nowrap"}}>{fmtDT(p.createdAt)}</td>
                              <td><button className="act-btn btn-edit" onClick={()=>openPayment(p)}>Correct</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="tbl-foot">
                      <span>{totals.payments} payments</span>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <button className="pg-btn" disabled={pg("payments")<=1} onClick={()=>{setPg("payments",pg("payments")-1);fetchPayments(pg("payments")-1);}}>← Prev</button>
                        <span>Page {pg("payments")} / {totalPages("payments")}</span>
                        <button className="pg-btn" disabled={pg("payments")>=totalPages("payments")} onClick={()=>{setPg("payments",pg("payments")+1);fetchPayments(pg("payments")+1);}}>Next →</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ══ SUPPORT ══ */}
            {tab==="support"&&(
              <div className="tbl-wrap">
                <div className="tbl-toolbar">
                  <div className="srch"><span className="srch-icon">🔍</span><input className="srch-inp" placeholder="Search subject, message, email…" value={tickSearch} onChange={e=>setTickSearch(e.target.value)}/></div>
                  <select className="flt-sel" value={tickSt} onChange={e=>setTickSt(e.target.value)}><option value="">All</option>{["OPEN","IN_PROGRESS","RESOLVED","CLOSED"].map(s=><option key={s} value={s}>{s}</option>)}</select>
                </div>
                <div className="tbl-scroll">
                  <table>
                    <thead><tr><th>Customer</th><th>Subject</th><th>Order</th><th>Status</th><th>Opened</th><th></th></tr></thead>
                    <tbody>
                      {tickets.map(t=>(
                        <tr key={t.id}>
                          <td><div style={{fontWeight:600,fontSize:"0.82rem"}}>{t.user?.fullName??"—"}</div><div style={{fontSize:"0.7rem",color:"#9CA3AF"}}>{t.user?.email??""}</div></td>
                          <td style={{fontWeight:600,maxWidth:220}}><div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.subject}</div></td>
                          <td><span className="mono">{t.orderId?t.orderId.slice(-8).toUpperCase():"—"}</span></td>
                          <td><Badge label={TICKET_META[t.status]?.label??t.status} color={TICKET_META[t.status]?.color??""} bg={TICKET_META[t.status]?.bg??""}/></td>
                          <td style={{fontSize:"0.75rem",color:"#9CA3AF",whiteSpace:"nowrap"}}>{fmtD(t.createdAt)}</td>
                          <td><button className="act-btn btn-edit" onClick={()=>openTicket(t)}>Reply</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="tbl-foot">
                  <span>{totals.tickets} tickets</span>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <button className="pg-btn" disabled={pg("tickets")<=1} onClick={()=>{setPg("tickets",pg("tickets")-1);fetchTickets(pg("tickets")-1);}}>← Prev</button>
                    <span>Page {pg("tickets")} / {totalPages("tickets")}</span>
                    <button className="pg-btn" disabled={pg("tickets")>=totalPages("tickets")} onClick={()=>{setPg("tickets",pg("tickets")+1);fetchTickets(pg("tickets")+1);}}>Next →</button>
                  </div>
                </div>
              </div>
            )}

            {/* ══ AUDIT LOG ══ */}
            {tab==="audit"&&(
              <div className="tbl-wrap">
                <div className="tbl-toolbar">
                  <div className="srch"><span className="srch-icon">🔍</span><input className="srch-inp" placeholder="Search action, email, entity…" value={auditSearch} onChange={e=>setAuditSearch(e.target.value)}/></div>
                  <input className="srch-inp" style={{width:180}} placeholder="Filter by action…" value={auditAct} onChange={e=>setAuditAct(e.target.value)}/>
                </div>
                <div className="tbl-scroll">
                  <table>
                    <thead><tr><th>Action</th><th>Performed By</th><th>Entity</th><th>Entity ID</th><th>IP</th><th>Metadata</th><th>Time</th></tr></thead>
                    <tbody>
                      {auditLogs.map(a=>(
                        <tr key={a.id}>
                          <td><span style={{fontWeight:700,fontSize:"0.78rem",fontFamily:"monospace",color:"#1C1410"}}>{a.action}</span></td>
                          <td><div style={{fontSize:"0.78rem",fontWeight:600}}>{a.user?.fullName??"System"}</div><div style={{fontSize:"0.7rem",color:"#9CA3AF"}}>{a.user?.email??""}</div></td>
                          <td style={{fontSize:"0.78rem",color:"#6B7280"}}>{a.entity??""}</td>
                          <td><span className="mono">{a.entityId?.slice(-10)??""}</span></td>
                          <td style={{fontSize:"0.73rem",color:"#9CA3AF"}}>{a.ipAddress??"—"}</td>
                          <td style={{maxWidth:200}}>
                            {a.metadata&&<details style={{cursor:"pointer"}}><summary style={{fontSize:"0.7rem",color:"#6B7280"}}>View</summary><pre style={{fontSize:"0.65rem",background:"#F9F7F4",padding:"4px 6px",borderRadius:5,marginTop:3,maxHeight:120,overflow:"auto",whiteSpace:"pre-wrap"}}>{JSON.stringify(a.metadata,null,2)}</pre></details>}
                          </td>
                          <td style={{fontSize:"0.73rem",color:"#9CA3AF",whiteSpace:"nowrap"}}>{fmtDT(a.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="tbl-foot">
                  <span>{totals.audit} entries</span>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <button className="pg-btn" disabled={pg("audit")<=1} onClick={()=>{setPg("audit",pg("audit")-1);fetchAudit(pg("audit")-1);}}>← Prev</button>
                    <span>Page {pg("audit")} / {totalPages("audit")}</span>
                    <button className="pg-btn" disabled={pg("audit")>=totalPages("audit")} onClick={()=>{setPg("audit",pg("audit")+1);fetchAudit(pg("audit")+1);}}>Next →</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ USER MODAL ══ */}
      {userModal&&(
        <Modal title={userModal.mode==="create"?"Add Staff / Admin Account":`Edit — ${userModal.user?.fullName}`} onClose={()=>setUserModal(null)}>
          <Field label="Full Name"><input style={inp} value={uForm.fullName} onChange={e=>setUForm(f=>({...f,fullName:e.target.value}))} placeholder="Full name"/></Field>
          <Field label="Email"><input style={inp} type="email" value={uForm.email} onChange={e=>setUForm(f=>({...f,email:e.target.value}))} placeholder="email@example.com"/></Field>
          <Field label="Phone (optional)"><input style={inp} value={uForm.phone} onChange={e=>setUForm(f=>({...f,phone:e.target.value}))} placeholder="07XX XXX XXX"/></Field>
          <Field label="Role"><select style={selStyle} value={uForm.role} onChange={e=>setUForm(f=>({...f,role:e.target.value as "STAFF"|"ADMIN"}))}><option value="STAFF">Staff</option><option value="ADMIN">Admin</option></select></Field>
          <Field label={userModal.mode==="create"?"Password (required)":"New Password (leave blank to keep current)"}><input style={inp} type="password" value={uForm.password} onChange={e=>setUForm(f=>({...f,password:e.target.value}))} placeholder="Min 8 chars, uppercase + number"/></Field>
          {userModal.mode==="edit"&&(
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
                <Field label="Active"><select style={selStyle} value={uForm.isActive?"true":"false"} onChange={e=>setUForm(f=>({...f,isActive:e.target.value==="true"}))}><option value="true">Active</option><option value="false">Inactive</option></select></Field>
                <Field label="Verified"><select style={selStyle} value={uForm.isVerified?"true":"false"} onChange={e=>setUForm(f=>({...f,isVerified:e.target.value==="true"}))}><option value="true">Verified</option><option value="false">Unverified</option></select></Field>
              </div>
            </>
          )}
          <div style={{display:"flex",gap:10,marginTop:6}}>
            <button className="cancel-btn" onClick={()=>setUserModal(null)}>Cancel</button>
            <button className="save-btn" disabled={uSaving} onClick={saveUser}>{uSaving?<><div className="spinner-sm"/>Saving…</>:userModal.mode==="create"?"Create Account":"Save Changes"}</button>
          </div>
        </Modal>
      )}

      {/* ══ ORDER MODAL ══ */}
      {orderModal&&(
        <Modal title={`Edit Order — ${orderModal.id.slice(-10).toUpperCase()}`} onClose={()=>setOrderModal(null)} wide>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
            <div>
              <div className="psec-title">Customer</div>
              <div className="info-grid">
                <div className="info-row"><span className="info-label">Name</span><span className="info-val">{orderModal.user?.fullName??"—"}</span></div>
                <div className="info-row"><span className="info-label">Email</span><span className="info-val">{orderModal.user?.email??"—"}</span></div>
                <div className="info-row"><span className="info-label">Total</span><span className="info-val">{fmt(orderModal.totalPrice)}</span></div>
                <div className="info-row"><span className="info-label">Balance</span><span className="info-val" style={{color:orderModal.balanceDue>0?"#D97706":"#14532D"}}>{fmt(orderModal.balanceDue)}</span></div>
              </div>
              <div className="psec-title">Payments (read-only)</div>
              {orderModal.payments.map(p=>(
                <div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #F9F7F4",fontSize:"0.78rem"}}>
                  <span style={{fontWeight:700}}>{p.type}</span>
                  <span className="mono">{p.mpesaRef??"—"}</span>
                  <span style={{fontWeight:700}}>{fmt(p.amount)}</span>
                  <Badge label={p.status} color={PAY_STATUS_META[p.status]?.color??""} bg={PAY_STATUS_META[p.status]?.bg??""}/>
                </div>
              ))}
              <div className="psec-title">Status History</div>
              <div className="tl">
                {orderModal.statusHistory.slice(0,8).map((h,i,arr)=>(
                  <div key={h.id} className="tl-item">
                    <div className="tl-dot-w"><div className="tl-dot" style={{background:i===0?"#C19A4A":"#D1C9BC"}}/>{i<arr.length-1&&<div className="tl-line"/>}</div>
                    <div className="tl-body">
                      <div className="tl-status">{h.fromStatus?`${ORDER_STATUS_META[h.fromStatus]?.label??h.fromStatus} → `:""}{ ORDER_STATUS_META[h.toStatus]?.label??h.toStatus}</div>
                      <div className="tl-meta">{fmtDT(h.createdAt)} · {h.changedBy??"system"}</div>
                      {h.note&&<div className="tl-note">{h.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="psec-title">Edit Order</div>
              <Field label="Status"><select style={selStyle} value={oForm.status} onChange={e=>setOForm(f=>({...f,status:e.target.value as OrderStatus}))}>{ALL_ORDER_STATUSES.map(s=><option key={s} value={s}>{ORDER_STATUS_META[s]?.label}</option>)}</select></Field>
              <Field label="Assigned To"><input style={inp} value={oForm.assignedTo} onChange={e=>setOForm(f=>({...f,assignedTo:e.target.value}))} placeholder="Staff name or email"/></Field>
              <Field label="Expected Ready (date & time)"><input type="datetime-local" style={inp} value={oForm.expectedReadyAt} onChange={e=>setOForm(f=>({...f,expectedReadyAt:e.target.value}))}/></Field>
              <Field label="Special Notes"><textarea style={{...inp,minHeight:70,resize:"vertical"}} value={oForm.specialNotes} onChange={e=>setOForm(f=>({...f,specialNotes:e.target.value}))}/></Field>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
                <Field label="Discount Code"><input style={inp} value={oForm.discountCode} onChange={e=>setOForm(f=>({...f,discountCode:e.target.value}))} placeholder="e.g. FRANKSTAT10"/></Field>
                <Field label="Discount Amount (KES)"><input type="number" min="0" style={inp} value={oForm.discountAmount} onChange={e=>setOForm(f=>({...f,discountAmount:e.target.value}))}/></Field>
              </div>
              <Field label="Admin Note (for status change)"><textarea style={{...inp,minHeight:60,resize:"vertical"}} value={oForm.note} onChange={e=>setOForm(f=>({...f,note:e.target.value}))} placeholder="Reason for change — saved in status history"/></Field>
              <div style={{display:"flex",gap:10,marginTop:10}}>
                <button className="cancel-btn" onClick={()=>setOrderModal(null)}>Cancel</button>
                <button className="save-btn" disabled={oSaving} onClick={saveOrder}>{oSaving?<><div className="spinner-sm"/>Saving…</>:"Save Changes"}</button>
              </div>
              <a href={orderModal.artworkUrl} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:12,fontSize:"0.78rem",color:"#1D4ED8",background:"#EFF6FF",padding:"4px 10px",borderRadius:6,textDecoration:"none"}}>📎 View Artwork ↗</a>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ PAYMENT CORRECTION MODAL ══ */}
      {payModal&&(
        <Modal title={`Correct Payment — ${payModal.id.slice(-10).toUpperCase()}`} onClose={()=>setPayModal(null)}>
          <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:"0.8rem",color:"#991B1B"}}>
            ⚠️ Payment corrections are irreversible and fully audited. Use only for genuine errors, disputes, or verified refunds.
          </div>
          <div className="info-grid" style={{marginBottom:16}}>
            <div className="info-row"><span className="info-label">Order</span><span className="info-val mono">{(payModal.order?.id ?? payModal.id).slice(-10).toUpperCase()}</span></div>
            <div className="info-row"><span className="info-label">Type</span><span className="info-val">{payModal.type}</span></div>
            <div className="info-row"><span className="info-label">Original Amount</span><span className="info-val">{fmt(payModal.amount)}</span></div>
            <div className="info-row"><span className="info-label">Current Status</span><span className="info-val"><Badge label={payModal.status} color={PAY_STATUS_META[payModal.status]?.color??""} bg={PAY_STATUS_META[payModal.status]?.bg??""}/></span></div>
            <div className="info-row"><span className="info-label">M-Pesa Ref</span><span className="info-val mono">{payModal.mpesaRef??"Not set"}</span></div>
            <div className="info-row"><span className="info-label">Phone</span><span className="info-val">{payModal.mpesaPhone??"—"}</span></div>
          </div>
          <Field label="New Status"><select style={selStyle} value={pForm.status} onChange={e=>setPForm(f=>({...f,status:e.target.value as PayStatus}))}>{["PENDING","COMPLETED","FAILED","REFUNDED","CANCELLED"].map(s=><option key={s} value={s}>{s}</option>)}</select></Field>
          <Field label="Corrected Amount (KES)"><input type="number" min="0" step="0.01" style={inp} value={pForm.amount} onChange={e=>setPForm(f=>({...f,amount:e.target.value}))}/></Field>
          <Field label="M-Pesa Receipt Ref (manual)"><input style={inp} value={pForm.mpesaRef} onChange={e=>setPForm(f=>({...f,mpesaRef:e.target.value}))} placeholder="e.g. MPESA12345ABC"/></Field>
          <Field label="Fail / Dispute Reason (if applicable)"><input style={inp} value={pForm.failReason} onChange={e=>setPForm(f=>({...f,failReason:e.target.value}))} placeholder="e.g. Duplicate transaction"/></Field>
          <Field label={<span>Admin Note <span style={{color:"#DC2626"}}>*required for refunds</span></span> as any}><textarea style={{...inp,minHeight:70,resize:"vertical"}} value={pForm.adminNote} onChange={e=>setPForm(f=>({...f,adminNote:e.target.value}))} placeholder="Explain the reason for this correction — saved in audit log"/></Field>
          <div style={{display:"flex",gap:10,marginTop:6}}>
            <button className="cancel-btn" onClick={()=>setPayModal(null)}>Cancel</button>
            <button className="save-btn" style={{background:"#7F1D1D"}} disabled={pSaving} onClick={savePayment}>{pSaving?<><div className="spinner-sm"/>Saving…</>:"Apply Correction"}</button>
          </div>
        </Modal>
      )}

      {/* ══ TICKET MODAL ══ */}
      {tickModal&&(
        <Modal title={`Ticket — ${tickModal.subject}`} onClose={()=>setTickModal(null)}>
          <div style={{background:"#F9F7F4",border:"1px solid #EDE8E0",borderRadius:8,padding:"12px 14px",marginBottom:14,fontSize:"0.83rem",color:"#374151",lineHeight:1.6}}>
            <strong>{tickModal.user?.fullName??"Anonymous"}</strong> · {tickModal.user?.email??""}<br/>
            <span style={{fontSize:"0.72rem",color:"#9CA3AF"}}>{fmtDT(tickModal.createdAt)}</span>
            <div style={{marginTop:8}}>{tickModal.message}</div>
          </div>
          {tickModal.response&&(
            <div style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:"0.82rem",color:"#14532D"}}>
              <strong>Previous response</strong> · {tickModal.respondedAt?fmtDT(tickModal.respondedAt):""}<br/>
              <div style={{marginTop:6}}>{tickModal.response}</div>
            </div>
          )}
          <Field label="Status"><select style={selStyle} value={tForm.status} onChange={e=>setTForm(f=>({...f,status:e.target.value as TicketStatus}))}><option value="OPEN">Open</option><option value="IN_PROGRESS">In Progress</option><option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option></select></Field>
          <Field label="Response"><textarea style={{...inp,minHeight:120,resize:"vertical"}} value={tForm.response} onChange={e=>setTForm(f=>({...f,response:e.target.value}))} placeholder="Type your reply to the customer…"/></Field>
          <div style={{display:"flex",gap:10,marginTop:6}}>
            <button className="cancel-btn" onClick={()=>setTickModal(null)}>Cancel</button>
            <button className="save-btn" disabled={tSaving} onClick={saveTicket}>{tSaving?<><div className="spinner-sm"/>Saving…</>:"Send Reply & Update"}</button>
          </div>
        </Modal>
      )}

      {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}

      {confirmDlg&&(
        <div className="cdlg-overlay" onClick={()=>setConfirmDlg(null)}>
          <div className="cdlg" onClick={e=>e.stopPropagation()}>
            <div className="cdlg-icon">{confirmDlg.icon}</div>
            <div className="cdlg-title">{confirmDlg.title}</div>
            <div className="cdlg-body">{confirmDlg.body}</div>
            <div className="cdlg-btns">
              <button className="cdlg-cancel" onClick={()=>setConfirmDlg(null)}>Cancel</button>
              <button className={`cdlg-confirm ${confirmDlg.danger?"danger":"normal"}`} onClick={()=>{const fn=confirmDlg.onConfirm;setConfirmDlg(null);fn();}}>
                {confirmDlg.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

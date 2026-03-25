import { useState, useMemo, useEffect, useCallback } from "react";
import { useDB } from "./useDB";

// ═══════════════════════════════════════════════════════════════
//  VIEWPORT LOCK
// ═══════════════════════════════════════════════════════════════
const lockViewport = () => {
  let m = document.querySelector("meta[name=viewport]");
  if (!m) { m = document.createElement("meta"); m.name = "viewport"; document.head.appendChild(m); }
  m.content = "width=device-width,initial-scale=1.0,maximum-scale=1.0,minimum-scale=1.0,user-scalable=no,viewport-fit=cover";
  // Prevenir bounce scroll en iOS
  document.body.style.overscrollBehavior = "none";
};

// Detecta si está instalada como PWA (standalone)
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

const useIsMobile = () => {
  const [mob, setMob] = useState(window.innerWidth < 768);
  useEffect(() => { const h = () => setMob(window.innerWidth < 768); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  return mob;
};

// Detecta plataforma para ajustes nativos
const getPlatform = () => {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "web";
};

// ═══════════════════════════════════════════════════════════════
//  THEME SYSTEM
// ═══════════════════════════════════════════════════════════════
const THEME_KEY = "inventapp_theme";

const THEMES = {
  light: {
    "--bg":             "#f5f5f7",   // gris Apple
    "--bg2":            "#ffffff",
    "--bg3":            "#f5f5f7",
    "--bg4":            "#ebebf0",
    "--border":         "#e8e8ed",
    "--text":           "#1c1c1e",   // negro Apple
    "--text2":          "#3a3a3c",
    "--text3":          "#aeaeb2",
    "--text4":          "#6c6c70",
    "--accent":         "#6366f1",
    "--accent2":        "#8b5cf6",
    "--card-shadow":    "0 1px 3px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.04)",
    "--card-radius":    "16px",
    "--sidebar-bg":     "#1c1c1e",
    "--sidebar-border": "#2c2c2e",
    "--sidebar-text":   "#8e8e93",
    "--sidebar-sub":    "#48484a",
    "--input-bg":       "#f5f5f7",
    "--row-alt":        "#fafafa",
    "--destructive":    "#ff3b30",
    "--success":        "#34c759",
    "--warning":        "#ff9500",
  },
  dark: {
    "--bg":             "#000000",   // negro puro iOS dark
    "--bg2":            "#1c1c1e",
    "--bg3":            "#2c2c2e",
    "--bg4":            "#3a3a3c",
    "--border":         "#38383a",
    "--text":           "#ffffff",
    "--text2":          "#ebebf5cc",
    "--text3":          "#48484a",
    "--text4":          "#8e8e93",
    "--accent":         "#7c7cff",
    "--accent2":        "#a78bfa",
    "--card-shadow":    "0 1px 3px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.25)",
    "--card-radius":    "16px",
    "--sidebar-bg":     "#000000",
    "--sidebar-border": "#1c1c1e",
    "--sidebar-text":   "#48484a",
    "--sidebar-sub":    "#2c2c2e",
    "--input-bg":       "#1c1c1e",
    "--row-alt":        "#1c1c1e",
    "--destructive":    "#ff453a",
    "--success":        "#30d158",
    "--warning":        "#ffd60a",
  },
};

const applyTheme = (mode) => {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = mode === "system" ? (prefersDark ? "dark" : "light") : mode;
  const vars = THEMES[resolved];
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.setAttribute("data-theme", resolved);
};

const useTheme = () => {
  const [theme, setThemeState] = useState(() => localStorage.getItem(THEME_KEY) || "system");

  useEffect(() => {
    applyTheme(theme);
    // Escuchar cambios del sistema si está en modo "system"
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => { if (theme === "system") applyTheme("system"); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (t) => {
    localStorage.setItem(THEME_KEY, t);
    setThemeState(t);
    applyTheme(t);
  };

  return { theme, setTheme };
};

const injectGlobalCSS = () => {
  if (document.getElementById("inventapp-theme-css")) return;
  const style = document.createElement("style");
  style.id = "inventapp-theme-css";
  style.textContent = `
    /* ── Reset & Base ─────────────────────────────────── */
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
      -webkit-touch-callout: none;
    }
    html {
      height: 100%;
      height: -webkit-fill-available;
    }
    body {
      margin: 0;
      min-height: 100vh;
      min-height: -webkit-fill-available;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      overscroll-behavior: none;
      overflow-x: hidden;
    }

    /* ── Transiciones suaves ──────────────────────────── */
    *, *::before, *::after {
      transition: background-color 0.18s ease, border-color 0.18s ease, color 0.12s ease, box-shadow 0.18s ease;
    }
    button, a { transition: opacity 0.1s ease, transform 0.1s ease, background-color 0.15s ease !important; }
    button:active { transform: scale(0.97); opacity: 0.85; }

    /* ── Safe areas (notch / Dynamic Island / nav bar) ── */
    .safe-top    { padding-top:    env(safe-area-inset-top,    0px); }
    .safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
    .safe-left   { padding-left:   env(safe-area-inset-left,   0px); }
    .safe-right  { padding-right:  env(safe-area-inset-right,  0px); }

    /* ── Inputs nativos ───────────────────────────────── */
    input, select, textarea {
      color-scheme: light dark;
      font-size: 16px !important; /* evita zoom en iOS */
      font-family: inherit;
      border-radius: 12px;
      outline: none;
      -webkit-appearance: none;
      appearance: none;
    }
    input:focus, select:focus, textarea:focus {
      border-color: #6366f1 !important;
      box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
    }
    select {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%2394a3b8' d='M1 1l5 5 5-5'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      padding-right: 32px !important;
    }

    /* ── Scrollbar sutil ──────────────────────────────── */
    ::-webkit-scrollbar { width: 3px; height: 3px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }

    /* ── Cards con blur en iOS ────────────────────────── */
    .glass-card {
      background: rgba(255,255,255,0.72);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }
    [data-theme="dark"] .glass-card {
      background: rgba(30,41,59,0.72);
    }

    /* ── Bottom nav safe area ─────────────────────────── */
    .bottom-nav {
      padding-bottom: max(env(safe-area-inset-bottom, 0px), 8px);
    }

    /* ── Header safe area iOS ─────────────────────────── */
    .top-bar {
      padding-top: env(safe-area-inset-top, 0px);
    }

    /* ── Animación de entrada ─────────────────────────── */
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fade-up { animation: fadeUp 0.22s ease both; }

    /* ── Ripple en botones ────────────────────────────── */
    @keyframes ripple {
      to { transform: scale(4); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
};


// ═══════════════════════════════════════════════════════════════
//  PUSH NOTIFICATIONS — cada 8 horas
// ═══════════════════════════════════════════════════════════════
const NOTIFY_INTERVAL = 8 * 60 * 60 * 1000;
const NOTIFY_TS_KEY   = "inventapp_last_notify";

const useNotifications = (db) => {
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  const requestPermission = async () => {
    if (typeof Notification === "undefined") return "denied";
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  };

  const sendAlerts = useCallback(() => {
    if (permission !== "granted") return;
    if (!("serviceWorker" in navigator)) return;
    const threshold = db.settings.lowStockThreshold || 5;
    const lowStock  = db.products.filter(p => p.stock <= threshold).map(p => ({ name:p.name, stock:p.stock, unit:p.unit }));
    const pendingOrders = db.orders.filter(o => o.state === "Pendiente").length;
    if (lowStock.length === 0 && pendingOrders === 0) return;
    navigator.serviceWorker.ready.then(reg => {
      reg.active?.postMessage({ type:"CHECK_ALERTS", payload:{ lowStock, pendingOrders, threshold } });
    });
    localStorage.setItem(NOTIFY_TS_KEY, Date.now().toString());
  }, [permission, db.products, db.orders, db.settings.lowStockThreshold]);

  useEffect(() => {
    if (permission !== "granted" || db.products.length === 0) return;
    const last  = Number(localStorage.getItem(NOTIFY_TS_KEY) || 0);
    const delay = Date.now() - last >= NOTIFY_INTERVAL ? 0 : NOTIFY_INTERVAL - (Date.now() - last);
    const t = setTimeout(() => { sendAlerts(); }, delay);
    const iv = setInterval(sendAlerts, NOTIFY_INTERVAL);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [permission, sendAlerts, db.products.length]);

  return { permission, requestPermission, sendAlerts };
};

const ORDER_STATES = ["Pendiente", "En proceso", "Enviado", "Entregado"];
const ORDER_STATE_COLORS = {
  "Pendiente":   { bg:"#fef9c3", text:"#a16207", dot:"#f59e0b" },
  "En proceso":  { bg:"#dbeafe", text:"#1d4ed8", dot:"#3b82f6" },
  "Enviado":     { bg:"#ede9fe", text:"#6d28d9", dot:"#8b5cf6" },
  "Entregado":   { bg:"#dcfce7", text:"#15803d", dot:"#22c55e" },
  "Cancelado":   { bg:"#fee2e2", text:"#b91c1c", dot:"#ef4444" },
};

const NAV_GROUPS = [
  { label: "Principal",      items: ["Dashboard","Pedidos","Inventario","Movimientos"] },
  { label: "Clientes",       items: ["Clientes","Domicilios"] },
  { label: "Reportes",       items: ["Reportes","Alertas"] },
  { label: "Configuración",  items: ["Productos·Config","Categorías","Proveedores","Métodos de pago","Ajustes"] },
];

const NAV_ICONS = {
  Dashboard:"📊", Pedidos:"🛒", Inventario:"📦", Movimientos:"🔄",
  Clientes:"👥", Domicilios:"🛵", Reportes:"📈", Alertas:"🔔",
  "Productos·Config":"📦", Categorías:"🏷️", Proveedores:"🏭",
  "Métodos de pago":"💳", Ajustes:"⚙️",
};

const ALL_TABS = NAV_GROUPS.flatMap(g => g.items);

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
const formatCOP = (v) => new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(v||0);
const today = () => new Date().toLocaleDateString("es-CO");
const nowStr = () => new Date().toLocaleString("es-CO");

// ═══════════════════════════════════════════════════════════════
//  PDF
// ═══════════════════════════════════════════════════════════════
let jsPDFLoaded = false;
const loadJsPDF = () => new Promise((resolve) => {
  if (window.jspdf) { resolve(window.jspdf.jsPDF); return; }
  if (jsPDFLoaded) { const t = setInterval(()=>{if(window.jspdf){clearInterval(t);resolve(window.jspdf.jsPDF);}},50); return; }
  jsPDFLoaded = true;
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  s.onload = () => resolve(window.jspdf.jsPDF);
  document.head.appendChild(s);
});

const generateInvoicePDF = async (items, opts, invoiceNum) => {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  const W=210,M=18,date=nowStr();
  const DARK=[15,23,42],GRAY=[100,116,139],LIGHT=[241,245,249],WHITE=[255,255,255],RED=[239,68,68],PURPLE=[99,102,241];
  doc.setFillColor(...DARK); doc.rect(0,0,W,44,"F");
  doc.setFillColor(...RED);  doc.rect(0,0,5,44,"F");
  doc.setFont("helvetica","bold"); doc.setFontSize(28); doc.setTextColor(...WHITE);
  doc.text("FACTURA", M+4, 21);
  doc.setFontSize(12); doc.text(`N\u00B0 ${invoiceNum}`, W-M, 18, {align:"right"});
  doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(180,190,210);
  doc.text(`Fecha: ${date}`, W-M, 27, {align:"right"});
  if (opts.clientName) { doc.setTextColor(...WHITE); doc.setFontSize(9); doc.text(`Cliente: ${opts.clientName}`, M+4, 30); }
  if (opts.paymentMethod) { doc.setTextColor(180,190,210); doc.setFontSize(8); doc.text(`Pago: ${opts.paymentMethod}`, M+4, 37); }
  let y=54;
  if (opts.note) {
    doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.setTextColor(...GRAY); doc.text("REFERENCIA:", M, y);
    doc.setFont("helvetica","normal"); doc.setTextColor(...DARK); doc.text(opts.note, M+30, y); y+=8;
  }
  doc.setDrawColor(...LIGHT); doc.setLineWidth(0.4); doc.line(M,y,W-M,y); y+=7;
  doc.setFillColor(...DARK); doc.roundedRect(M,y,W-M*2,10,2,2,"F");
  doc.setTextColor(...WHITE); doc.setFont("helvetica","bold"); doc.setFontSize(8);
  const C={num:M+2,name:M+8,sku:M+68,qty:M+103,unit:M+118,vUnit:M+133,vTot:W-M-2};
  doc.text("#",C.num,y+7); doc.text("PRODUCTO",C.name,y+7); doc.text("SKU",C.sku,y+7);
  doc.text("CANT.",C.qty,y+7); doc.text("UNID.",C.unit,y+7); doc.text("V.UNIT.",C.vUnit,y+7); doc.text("V.TOTAL",C.vTot,y+7,{align:"right"});
  y+=10;
  let subtotal=0;
  items.forEach(({product,qty},i)=>{
    const vt=product.price*qty; subtotal+=vt;
    doc.setFillColor(...(i%2===0?LIGHT:[248,250,252])); doc.rect(M,y,W-M*2,12,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(8.5); doc.setTextColor(...DARK);
    doc.text(String(i+1),C.num,y+8); doc.text(product.name,C.name,y+8);
    doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(...GRAY);
    doc.text(product.sku,C.sku,y+8); doc.setTextColor(...DARK);
    doc.text(String(qty),C.qty,y+8); doc.text(product.unit,C.unit,y+8);
    doc.text(formatCOP(product.price),C.vUnit,y+8);
    doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(...RED);
    doc.text(formatCOP(vt),C.vTot,y+8,{align:"right"}); y+=12;
  });
  doc.setDrawColor(...LIGHT); doc.setLineWidth(0.3); doc.line(M,y,W-M,y); y+=10;
  const bx=W/2+10, disc=Number(opts.discount)||0, dv=Number(opts.deliveryVal)||0, total=subtotal-disc+dv;
  const rw=(l,v,c=DARK)=>{doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(...GRAY);doc.text(l,bx,y);doc.setTextColor(...c);doc.text(formatCOP(v),W-M,y,{align:"right"});y+=6;};
  rw("Subtotal:",subtotal); if(disc>0)rw("Descuento:",-disc,RED); if(dv>0)rw("Domicilio:",dv);
  doc.setDrawColor(...RED); doc.setLineWidth(0.7); doc.line(bx,y,W-M,y); y+=3;
  doc.setFillColor(...RED); doc.roundedRect(bx,y,W-M-bx,14,2,2,"F");
  doc.setTextColor(...WHITE); doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.text("TOTAL:",bx+3,y+9);
  doc.setFontSize(12); doc.text(formatCOP(total),W-M-3,y+9,{align:"right"});
  doc.setFillColor(...DARK); doc.rect(0,277,W,20,"F");
  doc.setFillColor(...RED); doc.rect(0,277,5,20,"F");
  doc.setTextColor(180,190,210); doc.setFont("helvetica","normal"); doc.setFontSize(7.5);
  doc.text(`InventApp  \u00B7  Factura N\u00B0 ${invoiceNum}  \u00B7  ${date}`,W/2,289,{align:"center"});
  doc.save(`Factura-${invoiceNum}.pdf`);
};

// ═══════════════════════════════════════════════════════════════
//  UI ATOMS  — diseño minimalista nativo
// ═══════════════════════════════════════════════════════════════
const Badge = ({children,color="gray"}) => {
  const C = {
    green:  ["rgba(52,199,89,0.12)",  "#34c759"],
    red:    ["rgba(255,59,48,0.12)",  "var(--destructive)"],
    yellow: ["rgba(255,149,0,0.12)",  "#ff9500"],
    blue:   ["rgba(99,102,241,0.12)", "var(--accent)"],
    purple: ["rgba(175,82,222,0.12)", "#af52de"],
    gray:   ["var(--bg3)",            "var(--text4)"],
  };
  const [bg, tc] = C[color] || C.gray;
  return (
    <span style={{display:"inline-flex",alignItems:"center",background:bg,color:tc,padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:600,letterSpacing:0.2,whiteSpace:"nowrap",lineHeight:1.4}}>
      {children}
    </span>
  );
};

const Modal = ({title, onClose, children, maxWidth=540}) => (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:3000,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",overflowY:"auto"}}>
    <div style={{background:"var(--bg2)",borderRadius:"22px 22px 0 0",padding:"0",width:"100%",maxWidth,boxShadow:"0 -2px 24px rgba(0,0,0,0.15)",margin:"0 auto",boxSizing:"border-box",maxHeight:"92vh",overflowY:"auto",paddingBottom:"env(safe-area-inset-bottom,16px)"}}>
      <div style={{display:"flex",justifyContent:"center",paddingTop:10,paddingBottom:2}}>
        <div style={{width:36,height:4,borderRadius:99,background:"var(--border)"}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 20px 14px"}}>
        <h2 style={{margin:0,fontSize:17,fontWeight:700,color:"var(--text)",letterSpacing:-0.3}}>{title}</h2>
        <button onClick={onClose} style={{background:"var(--bg3)",border:"none",borderRadius:99,width:30,height:30,cursor:"pointer",fontSize:15,color:"var(--text4)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:600}}>✕</button>
      </div>
      <div style={{padding:"0 20px 20px"}}>{children}</div>
    </div>
  </div>
);

const Inp = ({label, ...p}) => (
  <div style={{marginBottom:14}}>
    {label && <label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--text4)",marginBottom:5,letterSpacing:0.1}}>{label}</label>}
    <input {...p} style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid var(--border)",fontSize:16,color:"var(--text)",outline:"none",boxSizing:"border-box",background:"var(--input-bg)",...p.style}}/>
  </div>
);

const Sel = ({label, options, ...p}) => (
  <div style={{marginBottom:14}}>
    {label && <label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--text4)",marginBottom:5,letterSpacing:0.1}}>{label}</label>}
    <select {...p} style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid var(--border)",fontSize:16,color:"var(--text)",background:"var(--input-bg)",outline:"none",boxSizing:"border-box"}}>
      {options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
    </select>
  </div>
);

const Btn = ({children, variant="primary", size="md", ...p}) => {
  const styles = {
    primary:   {bg:"linear-gradient(135deg,var(--accent),var(--accent2))", color:"#fff", shadow:"0 2px 8px rgba(99,102,241,0.3)"},
    secondary: {bg:"var(--bg3)", color:"var(--text)", shadow:"none"},
    danger:    {bg:"rgba(255,59,48,0.1)", color:"var(--destructive)", shadow:"none"},
    green:     {bg:"linear-gradient(135deg,#34c759,#30d158)", color:"#fff", shadow:"0 2px 8px rgba(52,199,89,0.3)"},
    ghost:     {bg:"transparent", color:"var(--accent)", shadow:"none"},
  };
  const sizes = {sm:"7px 14px", md:"11px 20px", lg:"13px 26px"};
  const fss   = {sm:12, md:14, lg:15};
  const st = styles[variant] || styles.primary;
  return (
    <button {...p} style={{padding:sizes[size],borderRadius:12,border:"none",cursor:"pointer",fontWeight:600,fontSize:fss[size],background:st.bg,color:st.color,boxShadow:st.shadow,opacity:p.disabled?0.45:1,display:"inline-flex",alignItems:"center",gap:5,whiteSpace:"nowrap",letterSpacing:0.1,...p.style}}>{children}</button>
  );
};

const EmptyState = ({icon, text, action}) => (
  <div style={{padding:"52px 20px",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
    <div style={{fontSize:44,marginBottom:4,opacity:0.35}}>{icon}</div>
    <div style={{fontSize:14,fontWeight:500,color:"var(--text3)",maxWidth:240,lineHeight:1.5}}>{text}</div>
    {action}
  </div>
);

// ═══════════════════════════════════════════════════════════════
//  SIDEBAR
// ═══════════════════════════════════════════════════════════════
const Sidebar = ({tab,setTab,db,sideOpen,setSideOpen,isMobile,theme,setTheme}) => {
  const lowStock = db.products.filter(p=>p.stock<=(db.settings.lowStockThreshold||5)).length;
  const pendingOrders = db.orders.filter(o=>o.state==="Pendiente").length;

  const content = (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Logo */}
      <div style={{padding:"20px 18px 16px",borderBottom:"1px solid #1e293b"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:17,fontWeight:900,color:"#fff",letterSpacing:-0.5}}>📦 InventApp</div>
            <div style={{fontSize:10,color:"var(--text4)",marginTop:1}}>{db.settings.businessName}</div>
          </div>
          {isMobile&&<button onClick={()=>setSideOpen(false)} style={{background:"none",border:"none",color:"var(--text4)",fontSize:20,cursor:"pointer"}}>×</button>}
        </div>
      </div>

      {/* Nav groups */}
      <nav style={{flex:1,overflowY:"auto",padding:"10px 10px"}}>
        {NAV_GROUPS.map(group=>(
          <div key={group.label} style={{marginBottom:6}}>
            <div style={{fontSize:9,fontWeight:700,color:"var(--text)",letterSpacing:1,textTransform:"uppercase",padding:"6px 8px 4px"}}>{group.label}</div>
            {group.items.map(t=>{
              const active = tab===t;
              const badge = t==="Alertas"&&lowStock>0?lowStock : t==="Pedidos"&&pendingOrders>0?pendingOrders : null;
              return (
                <button key={t} onClick={()=>{setTab(t);if(isMobile)setSideOpen(false);}} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 10px",borderRadius:9,cursor:"pointer",marginBottom:2,background:active?"linear-gradient(135deg,#6366f1,#8b5cf6)":"transparent",color:active?"#fff":"#94a3b8",fontWeight:active?700:500,fontSize:13,border:"none",width:"100%",textAlign:"left"}}>
                  <span style={{fontSize:15}}>{NAV_ICONS[t]}</span>
                  <span style={{flex:1}}>{t.replace("·Config","")}</span>
                  {badge&&<span style={{background:active?"rgba(255,255,255,0.3)":"#ef4444",color:"#fff",borderRadius:20,padding:"0 6px",fontSize:10,fontWeight:800,lineHeight:"18px"}}>{badge}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{padding:"10px 14px",fontSize:10,color:"var(--sidebar-sub)",borderTop:"1px solid var(--sidebar-border)"}}>
        {db.products.length} productos · {db.clients.length} clientes
      </div>

      {/* Selector de tema */}
      <div style={{padding:"10px 14px 14px",borderTop:"1px solid var(--sidebar-border)"}}>
        <div style={{fontSize:9,fontWeight:700,color:"var(--sidebar-text)",letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>Apariencia</div>
        <div style={{display:"flex",gap:4}}>
          {[
            {key:"light",  icon:"☀️", label:"Claro"},
            {key:"dark",   icon:"🌙", label:"Oscuro"},
            {key:"system", icon:"💻", label:"Sistema"},
          ].map(t=>(
            <button key={t.key} onClick={()=>setTheme(t.key)} title={t.label}
              style={{flex:1,padding:"5px 0",borderRadius:7,border:theme===t.key?"1.5px solid #6366f1":"1.5px solid var(--sidebar-border)",background:theme===t.key?"#6366f1":"transparent",color:theme===t.key?"#fff":"var(--sidebar-text)",cursor:"pointer",fontSize:14,display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
              <span>{t.icon}</span>
              <span style={{fontSize:8,fontWeight:600}}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    if (!sideOpen) return null;
    return (
      <>
        <div onClick={()=>setSideOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:1500,backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)"}}/>
        <aside style={{position:"fixed",top:0,right:0,bottom:0,width:280,background:"var(--sidebar-bg)",zIndex:1600,overflowY:"auto",boxShadow:"-4px 0 32px rgba(0,0,0,0.25)",paddingTop:"env(safe-area-inset-top,0px)"}}>
          {content}
        </aside>
      </>
    );
  }

  return (
    <aside style={{width:220,background:"var(--sidebar-bg)",minHeight:"100vh",position:"fixed",top:0,right:0,bottom:0,overflowY:"auto",zIndex:100,borderLeft:"0.5px solid var(--sidebar-border)"}}>
      {content}
    </aside>
  );
};

// ═══════════════════════════════════════════════════════════════
//  STYLES FACTORY  — diseño nativo minimalista
// ═══════════════════════════════════════════════════════════════
const makeStyles = (isMobile) => ({
  main:     {
    marginRight: isMobile ? 0 : 220,
    padding: isMobile ? "0 0 88px" : "28px 32px",
    minHeight: "100vh",
    background: "var(--bg)",
  },
  header:   {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10},
  title:    {fontSize:isMobile?20:24,fontWeight:700,color:"var(--text)",margin:0,letterSpacing:-0.5},
  kpiGrid:  (cols)=>({display:"grid",gridTemplateColumns:`repeat(${isMobile?Math.min(cols,2):cols},1fr)`,gap:10,marginBottom:16}),
  kpiCard:  (c)=>({
    background:"var(--bg2)",
    borderRadius:20,
    padding: isMobile ? "16px 16px" : "18px 20px",
    boxShadow:"var(--card-shadow)",
    borderTop:`3px solid ${c}`,
    borderLeft:"none",
  }),
  kpiVal:   {fontSize:isMobile?20:26,fontWeight:700,color:"var(--text)",lineHeight:1.1,marginBottom:3,letterSpacing:-0.5},
  kpiLabel: {fontSize:isMobile?10:12,color:"var(--text4)",fontWeight:500},
  card:     {background:"var(--bg2)",borderRadius:20,boxShadow:"var(--card-shadow)",overflow:"hidden",marginBottom:12},
  tHead:    (cols)=>({display:"grid",gridTemplateColumns:cols,padding:"10px 16px",background:"var(--bg3)",borderBottom:"1px solid var(--border)"}),
  tRow:     (cols)=>({display:"grid",gridTemplateColumns:cols,alignItems:"center",padding:"13px 16px",borderBottom:"1px solid var(--bg4)"}),
  th:       {fontSize:10,fontWeight:600,color:"var(--text3)",textTransform:"uppercase",letterSpacing:0.8},
  toolbar:  {display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap"},
  searchW:  {position:"relative",flex:1,minWidth:140},
  searchI:  {width:"100%",padding:"11px 16px 11px 38px",borderRadius:14,border:"1.5px solid var(--border)",fontSize:15,outline:"none",background:"var(--input-bg)",color:"var(--text)",boxSizing:"border-box"},
  iconBtn:  {background:"none",border:"none",cursor:"pointer",padding:"8px",borderRadius:10,fontSize:17,color:"var(--text4)"},
  bottomNav:{
    position:"fixed", bottom:0, left:0, right:0,
    background:"var(--bg2)",
    zIndex:500, display:"flex",
    borderTop:"0.5px solid var(--border)",
    paddingBottom:"env(safe-area-inset-bottom,8px)",
    backdropFilter:"blur(20px)",
    WebkitBackdropFilter:"blur(20px)",
  },
  bottomBtn:(a)=>({
    flex:1, display:"flex", flexDirection:"column",
    alignItems:"center", justifyContent:"center",
    padding:"10px 2px 6px",
    border:"none", background:"transparent", cursor:"pointer",
    color: a ? "var(--accent)" : "var(--text3)",
    fontSize:9, fontWeight: a ? 700 : 400,
    gap:3, minWidth:0,
    position:"relative",
  }),
});

// ═══════════════════════════════════════════════════════════════
//  ORDERS MODULE
// ═══════════════════════════════════════════════════════════════
const OrderForm = ({db, addOrder, editOrder, onClose, initial}) => {
  const [lines,   setLines]   = useState(initial?.items||[{productId:"",qty:""}]);
  const [clientId,setClientId]= useState(initial?.clientId||"");
  const [pmId,    setPmId]    = useState(initial?.paymentMethodId||"");
  const [note,    setNote]    = useState(initial?.note||"");
  const [discount,setDiscount]= useState(initial?.discount||"");
  const [delivery,setDelivery]= useState(initial?.delivery||{name:"",address:"",phone:"",value:""});

  const addLine    = ()=>setLines(l=>[...l,{productId:"",qty:""}]);
  const removeLine = (i)=>setLines(l=>l.filter((_,idx)=>idx!==i));
  const setLine    = (i,k,v)=>setLines(l=>l.map((r,idx)=>idx===i?{...r,[k]:v}:r));

  const resolved = lines.map(r=>({product:db.products.find(p=>p.id===Number(r.productId)),qty:Number(r.qty)})).filter(r=>r.product&&r.qty>0);
  const subtotal = resolved.reduce((s,r)=>s+r.product.price*r.qty,0);
  const dv = Number(delivery.value)||0;
  const disc = Number(discount)||0;
  const total = subtotal-disc+dv;

  const handleSave = async ()=>{
    if(resolved.length===0) return alert("Agrega al menos un producto.");
    try {
      if(initial){ await editOrder({...initial,clientId,paymentMethodId:pmId,items:lines,note,discount:disc,delivery,total}); }
      else { await addOrder({clientId,paymentMethodId:pmId,items:lines,note,discount:disc,delivery,total}); }
      onClose();
    } catch(e) { alert("Error: " + e.message); }
  };

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
        <Sel label="Cliente" value={clientId} onChange={e=>setClientId(e.target.value)}
          options={[{value:"",label:"— Sin cliente —"},...db.clients.map(c=>({value:c.id,label:c.name}))]}/>
        <Sel label="Método de pago" value={pmId} onChange={e=>setPmId(e.target.value)}
          options={[{value:"",label:"— Selecciona —"},...db.paymentMethods.map(p=>({value:p.id,label:`${p.icon} ${p.name}`}))]}/>
      </div>

      <div style={{fontSize:12,fontWeight:700,color:"var(--text2)",textTransform:"uppercase",letterSpacing:0.6,margin:"10px 0 8px"}}>📦 Productos</div>
      {lines.map((line,idx)=>{
        const prod=db.products.find(p=>p.id===Number(line.productId));
        return (
          <div key={idx} style={{background:"var(--input-bg)",borderRadius:9,padding:"10px 12px",border:"1.5px solid var(--border)",marginBottom:8}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 80px 30px",gap:8,alignItems:"end"}}>
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:600,color:"var(--text4)",marginBottom:3}}>Producto</label>
                <select value={line.productId} onChange={e=>setLine(idx,"productId",e.target.value)}
                  style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid var(--border)",fontSize:14,color:line.productId?"#0f172a":"#94a3b8",background:"var(--bg2)",outline:"none"}}>
                  <option value="">— Selecciona —</option>
                  {db.products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.stock} {p.unit}</option>)}
                </select>
                {prod&&<div style={{fontSize:10,color:"#6366f1",fontWeight:600,marginTop:3}}>{prod.sku} · {formatCOP(prod.price)} · Stock: {prod.stock}</div>}
              </div>
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:600,color:"var(--text4)",marginBottom:3}}>Cant.</label>
                <input type="number" value={line.qty} onChange={e=>setLine(idx,"qty",e.target.value)} placeholder="0"
                  style={{width:"100%",padding:"8px 8px",borderRadius:8,border:"1.5px solid var(--border)",fontSize:15,fontWeight:700,color:"var(--text)",outline:"none",background:"var(--bg2)",boxSizing:"border-box"}}/>
              </div>
              <button onClick={()=>removeLine(idx)} disabled={lines.length===1}
                style={{padding:"8px",borderRadius:8,border:"none",background:lines.length===1?"#f1f5f9":"#fee2e2",color:lines.length===1?"#cbd5e1":"#b91c1c",cursor:lines.length===1?"not-allowed":"pointer",fontSize:15,fontWeight:700,alignSelf:"end"}}>×</button>
            </div>
          </div>
        );
      })}
      <button onClick={addLine} style={{width:"100%",padding:"8px",borderRadius:8,border:"1.5px dashed #c7d2fe",background:"#eef2ff",color:"#6366f1",cursor:"pointer",fontWeight:700,fontSize:13,marginBottom:4}}>+ Agregar producto</button>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px",marginTop:10}}>
        <Inp label="Nota / Referencia" value={note} onChange={e=>setNote(e.target.value)} placeholder="Nota del pedido…"/>
        <Inp label="Descuento (COP)" type="number" value={discount} onChange={e=>setDiscount(e.target.value)} placeholder="0"/>
      </div>

      <div style={{fontSize:12,fontWeight:700,color:"var(--text2)",textTransform:"uppercase",letterSpacing:0.6,margin:"6px 0 8px"}}>🛵 Domicilio (opcional)</div>
      <div style={{background:"var(--input-bg)",borderRadius:9,padding:"12px",border:"1.5px solid var(--border)"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 10px"}}>
          <Inp label="Nombre cliente" value={delivery.name}    onChange={e=>setDelivery(d=>({...d,name:e.target.value}))}    placeholder="Juan Pérez"/>
          <Inp label="Teléfono"       value={delivery.phone}   onChange={e=>setDelivery(d=>({...d,phone:e.target.value}))}   placeholder="+57 300…"/>
        </div>
        <Inp label="Dirección" value={delivery.address} onChange={e=>setDelivery(d=>({...d,address:e.target.value}))} placeholder="Cra 5 #10-20…"/>
        <Inp label="Valor domicilio" type="number" value={delivery.value} onChange={e=>setDelivery(d=>({...d,value:e.target.value}))} placeholder="0"/>
      </div>

      {resolved.length>0&&(
        <div style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:10,padding:"12px 16px",marginTop:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{color:"rgba(255,255,255,0.75)",fontSize:11}}>TOTAL DEL PEDIDO</div>
          <div style={{color:"#fff",fontWeight:900,fontSize:20}}>{formatCOP(total)}</div>
        </div>
      )}

      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:14,paddingTop:12,borderTop:"1px solid #f1f5f9"}}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleSave}>{initial?"Guardar cambios":"Crear pedido"}</Btn>
      </div>
    </div>
  );
};

const OrderStateProgress = ({order,onAdvance,onCancel}) => {
  const idx = ORDER_STATES.indexOf(order.state);
  const isCancelled = order.state==="Cancelled"||order.state==="Cancelado";
  const isDelivered  = order.state==="Entregado";

  return (
    <div>
      {/* Barra de progreso */}
      <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:14}}>
        {ORDER_STATES.map((st,i)=>{
          const done = idx>=i;
          const sc = ORDER_STATE_COLORS[st];
          return (
            <div key={st} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{width:"100%",height:4,background:done?sc.dot:"#e2e8f0",borderRadius:4,transition:"background 0.3s"}}/>
              <div style={{fontSize:9,fontWeight:600,color:done?sc.text:"#94a3b8",textAlign:"center",lineHeight:1.2}}>{st}</div>
            </div>
          );
        })}
      </div>

      {/* Estado actual */}
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{background:ORDER_STATE_COLORS[order.state]?.bg,color:ORDER_STATE_COLORS[order.state]?.text,padding:"6px 14px",borderRadius:20,fontWeight:700,fontSize:13}}>
          ● {order.state}
        </div>

        {!isCancelled&&!isDelivered&&(
          <Btn size="sm" variant="green" onClick={onAdvance}>
            → {ORDER_STATES[idx+1]||"Entregar"}
          </Btn>
        )}

        {!isCancelled&&!isDelivered&&(
          <Btn size="sm" variant="danger" onClick={onCancel}>🚫 Cancelar pedido</Btn>
        )}
      </div>
    </div>
  );
};

const OrderCard = ({order,db,onEdit,onAdvance,onCancel,onPDF}) => {
  const [expanded,setExpanded]=useState(false);
  const client = db.clients.find(c=>c.id===Number(order.clientId));
  const pm     = db.paymentMethods.find(p=>p.id===Number(order.paymentMethodId));
  const sc     = ORDER_STATE_COLORS[order.state]||ORDER_STATE_COLORS["Pendiente"];

  return (
    <div style={{background:"var(--bg2)",borderRadius:13,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",marginBottom:10,overflow:"hidden",border:`1.5px solid ${sc.dot}22`}}>
      {/* Header */}
      <div style={{padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",gap:10}} onClick={()=>setExpanded(e=>!e)}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
            <span style={{fontWeight:800,fontSize:14,color:"var(--text)"}}>Pedido #{String(order.id).padStart(4,"0")}</span>
            <div style={{background:sc.bg,color:sc.text,padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>● {order.state}</div>
          </div>
          <div style={{fontSize:12,color:"var(--text4)"}}>
            {client?`👤 ${client.name}`:"Sin cliente"}
            {pm?` · ${pm.icon} ${pm.name}`:""}
          </div>
          <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>{order.createdAt}</div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontWeight:900,fontSize:16,color:"var(--text)"}}>{formatCOP(order.total)}</div>
          <div style={{fontSize:10,color:"var(--text3)"}}>{expanded?"▲":"▼"}</div>
        </div>
      </div>

      {expanded&&(
        <div style={{padding:"0 14px 14px",borderTop:"1px solid #f1f5f9"}}>
          {/* Productos del pedido */}
          <div style={{margin:"12px 0 10px"}}>
            {order.items.map((line,i)=>{
              const prod=db.products.find(p=>p.id===Number(line.productId));
              if(!prod) return null;
              return (
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f8fafc",fontSize:13}}>
                  <span style={{color:"var(--text)"}}>{prod.name} <span style={{color:"var(--text3)",fontSize:11}}>×{line.qty}</span></span>
                  <span style={{fontWeight:700}}>{formatCOP(prod.price*Number(line.qty))}</span>
                </div>
              );
            })}
            {order.discount>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:12,color:"#b91c1c"}}><span>Descuento</span><span>-{formatCOP(order.discount)}</span></div>}
            {order.delivery?.value>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:12,color:"var(--text4)"}}><span>🛵 Domicilio</span><span>{formatCOP(order.delivery.value)}</span></div>}
          </div>

          {/* Domicilio info */}
          {order.delivery?.name&&(
            <div style={{background:"var(--input-bg)",borderRadius:8,padding:"8px 10px",marginBottom:10,fontSize:12}}>
              <div style={{fontWeight:700,color:"var(--text)"}}>{order.delivery.name}</div>
              {order.delivery.address&&<div style={{color:"var(--text4)"}}>📍 {order.delivery.address}</div>}
              {order.delivery.phone&&<div style={{color:"var(--text4)"}}>📞 {order.delivery.phone}</div>}
            </div>
          )}

          {/* Estado + avanzar */}
          <OrderStateProgress order={order} onAdvance={()=>onAdvance(order.id)} onCancel={()=>onCancel(order.id)}/>

          {/* Acciones */}
          <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
            <Btn size="sm" variant="secondary" onClick={()=>onEdit(order)}>✏️ Editar</Btn>
            {(order.state==="Enviado"||order.state==="Entregado")&&<Btn size="sm" variant="secondary" onClick={()=>onPDF(order)}>📄 Factura PDF</Btn>}
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
//  GENERIC CRUD TABLE
// ═══════════════════════════════════════════════════════════════
const CRUDTable = ({title,icon,items,columns,renderForm,emptyText,onAdd,onEdit,onDelete,s}) => {
  const [search,setSearch]=useState("");
  const [showForm,setShowForm]=useState(false);
  const [editing,setEditing]=useState(null);

  const filtered = items.filter(i=>
    columns.some(c=>String(i[c.key]||"").toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <>
      <div style={s.header}>
        <h1 style={s.title}>{icon} {title}</h1>
        <Btn onClick={()=>{setEditing(null);setShowForm(true);}}>+ Agregar</Btn>
      </div>
      <div style={s.toolbar}>
        <div style={s.searchW}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--text3)",fontSize:14}}>🔍</span>
          <input style={s.searchI} placeholder="Buscar…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
      </div>
      <div style={s.card}>
        {filtered.length===0?<EmptyState icon="🔍" text={emptyText}/>:(
          filtered.map((item,idx)=>(
            <div key={item.id} style={{...s.tRow("1fr"),background:idx%2===0?"#fff":"#fafafa",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <div style={{flex:1,minWidth:0}}>
                {columns.map(col=>(
                  <div key={col.key} style={{fontSize:col.primary?14:11,fontWeight:col.primary?700:400,color:col.primary?"#0f172a":"#64748b"}}>
                    {col.prefix&&`${col.prefix} `}{item[col.key]||"—"}
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:4,flexShrink:0}}>
                <button style={s.iconBtn} onClick={()=>{setEditing(item);setShowForm(true);}}>✏️</button>
                <button style={s.iconBtn} onClick={()=>{ if(confirm(`¿Eliminar "${item.name||item.id}"?`)) onDelete(item.id); }}>🗑️</button>
              </div>
            </div>
          ))
        )}
      </div>
      {showForm&&(
        <Modal title={editing?`Editar ${title.slice(0,-1)}`:`Nuevo ${title.slice(0,-1)}`} onClose={()=>{setShowForm(false);setEditing(null);}}>
          {renderForm({
            initial:editing,
            onSave:(data)=>{ if(editing) onEdit(data); else onAdd(data); setShowForm(false); setEditing(null); },
            onClose:()=>{setShowForm(false);setEditing(null);}
          })}
        </Modal>
      )}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════
//  FORM COMPONENTS (must be top-level to follow Rules of Hooks)
// ═══════════════════════════════════════════════════════════════

const CategoryForm = ({initial, onSave, onClose}) => {
  const [name, setName] = useState(initial?.name || "");
  return (
    <div>
      <Inp label="Nombre *" value={name} onChange={e=>setName(e.target.value)} placeholder="Ej: Bebidas"/>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:10}}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={()=>{if(!name.trim())return alert("Nombre requerido"); onSave({...initial,name:name.trim()});}}>Guardar</Btn>
      </div>
    </div>
  );
};

const ProviderForm = ({initial, onSave, onClose}) => {
  const [f, setF] = useState(initial || {name:"",contact:"",phone:"",email:"",notes:""});
  const set = (k,v) => setF(x=>({...x,[k]:v}));
  return (
    <div>
      <Inp label="Nombre empresa *" value={f.name}    onChange={e=>set("name",e.target.value)}    placeholder="TechDistrib S.A.S"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
        <Inp label="Contacto" value={f.contact} onChange={e=>set("contact",e.target.value)} placeholder="Carlos Ríos"/>
        <Inp label="Teléfono" value={f.phone}   onChange={e=>set("phone",e.target.value)}   placeholder="605-3001001"/>
        <Inp label="Email"    value={f.email}   onChange={e=>set("email",e.target.value)}   placeholder="ventas@empresa.co"/>
      </div>
      <Inp label="Notas" value={f.notes} onChange={e=>set("notes",e.target.value)} placeholder="Ej: Mínimo 10 unidades…"/>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:10}}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={()=>{if(!f.name)return alert("Nombre requerido"); onSave({...initial,...f});}}>Guardar</Btn>
      </div>
    </div>
  );
};

const PaymentMethodForm = ({initial, onSave, onClose}) => {
  const [f, setF] = useState(initial || {name:"",icon:"💳"});
  const set = (k,v) => setF(x=>({...x,[k]:v}));
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"80px 1fr",gap:"0 12px"}}>
        <Inp label="Ícono"    value={f.icon} onChange={e=>set("icon",e.target.value)} placeholder="💵"/>
        <Inp label="Nombre *" value={f.name} onChange={e=>set("name",e.target.value)} placeholder="Efectivo"/>
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:10}}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={()=>{if(!f.name)return alert("Nombre requerido"); onSave({...initial,...f});}}>Guardar</Btn>
      </div>
    </div>
  );
};

// ── Generador de SKU único ────────────────────────────────────────────────────
// Toma las primeras letras del nombre + timestamp corto, garantiza unicidad
const generateSKU = (name, existingSkus = []) => {
  // Prefijo: primeras 3 letras del nombre en mayúsculas, sin espacios ni tildes
  const clean = name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar tildes
    .replace(/[^a-zA-Z0-9]/g, "")                     // solo alfanumérico
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, "X");                                   // mínimo 3 chars

  // Sufijo: número correlativo hasta encontrar uno libre
  let i = 1;
  let candidate;
  do {
    candidate = `${clean}-${String(i).padStart(3, "0")}`;
    i++;
  } while (existingSkus.includes(candidate));

  return candidate;
};

const ProductConfigForm = ({initial, onSave, onClose, categories, providers, existingSkus}) => {
  const [f, setF] = useState(() => {
    if (initial) return initial;
    return {name:"",sku:"",categoryId:"",providerId:"",price:"",cost:"",stock:"",unit:"und",description:"",image:""};
  });

  const set = (k,v) => setF(x=>({...x,[k]:v}));

  const handleNameChange = (e) => {
    const name = e.target.value;
    set("name", name);
    if (!initial && name.trim().length >= 2) {
      set("sku", generateSKU(name, existingSkus));
    }
  };

  // Convierte la imagen a base64
  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500_000) return alert("La imagen no debe superar 500KB. Usa una imagen más pequeña.");
    const reader = new FileReader();
    reader.onload = (ev) => set("image", ev.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div>
      {/* Zona de imagen */}
      <div style={{marginBottom:14}}>
        <label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--text2)",marginBottom:6}}>📷 Imagen del producto</label>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          <div style={{width:72,height:72,borderRadius:10,border:"2px dashed var(--border)",background:"var(--bg3)",overflow:"hidden",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>
            {f.image
              ? <img src={f.image} alt="producto" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              : "📦"
            }
          </div>
          <div style={{flex:1}}>
            <label style={{display:"inline-block",padding:"8px 14px",borderRadius:8,border:"1.5px solid var(--border)",background:"var(--bg3)",color:"var(--text)",cursor:"pointer",fontSize:13,fontWeight:600}}>
              {f.image ? "Cambiar imagen" : "Subir imagen"}
              <input type="file" accept="image/*" onChange={handleImage} style={{display:"none"}}/>
            </label>
            {f.image && (
              <button onClick={()=>set("image","")} style={{marginLeft:8,padding:"8px 12px",borderRadius:8,border:"1.5px solid #fee2e2",background:"var(--bg2)",color:"#b91c1c",cursor:"pointer",fontSize:12,fontWeight:600}}>
                ✕ Quitar
              </button>
            )}
            <div style={{fontSize:10,color:"var(--text3)",marginTop:4}}>JPG, PNG o WEBP · Máx. 500KB</div>
          </div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
        <Inp label="Nombre *"       value={f.name}  onChange={handleNameChange}                              placeholder="Ej: Camiseta azul"/>
        <div style={{marginBottom:12}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--text2)",marginBottom:4}}>
            SKU {!initial && <span style={{fontSize:10,color:"#6366f1",fontWeight:500}}>— generado automáticamente</span>}
          </label>
          <div style={{position:"relative"}}>
            <input
              value={f.sku}
              onChange={e=>set("sku",e.target.value)}
              placeholder="Auto"
              style={{width:"100%",padding:"9px 36px 9px 12px",borderRadius:8,border:"1.5px solid #6366f1",fontSize:14,color:"#6366f1",fontWeight:700,fontFamily:"monospace",outline:"none",boxSizing:"border-box",background:"#eef2ff"}}
            />
            {!initial && (
              <button type="button" title="Regenerar SKU"
                onClick={()=>set("sku", generateSKU(f.name||"PRD", existingSkus))}
                style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:14,color:"#6366f1",padding:"2px"}}>🔄</button>
            )}
          </div>
        </div>
        <Sel label="Categoría"      value={f.categoryId||""} onChange={e=>set("categoryId",Number(e.target.value)||"")}
          options={[{value:"",label:"— Sin categoría —"},...categories.map(c=>({value:c.id,label:c.name}))]}/>
        <Sel label="Proveedor"      value={f.providerId||""} onChange={e=>set("providerId",Number(e.target.value)||"")}
          options={[{value:"",label:"— Sin proveedor —"},...providers.map(p=>({value:p.id,label:p.name}))]}/>
        <Inp label="Precio venta *" type="number" value={f.price} onChange={e=>set("price",+e.target.value)} placeholder="0"/>
        <Inp label="Costo"          type="number" value={f.cost}  onChange={e=>set("cost",+e.target.value)}  placeholder="0"/>
        <Inp label="Stock *"        type="number" value={f.stock} onChange={e=>set("stock",+e.target.value)} placeholder="0"/>
        <Inp label="Unidad"         value={f.unit} onChange={e=>set("unit",e.target.value)}                  placeholder="und, kg…"/>
      </div>
      <Inp label="Descripción" value={f.description} onChange={e=>set("description",e.target.value)} placeholder="Opcional"/>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:10}}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={()=>{if(!f.name||!f.sku||f.stock==="")return alert("Campos requeridos incompletos"); onSave({...initial,...f});}}>Guardar</Btn>
      </div>
    </div>
  );
};

const SettingsTab = ({settings, isMobile, s, saveSettings, resetDB, theme, setTheme, notifPermission, onRequestNotif, onTestNotif}) => {
  const [cfg, setCfg] = useState(settings);
  useEffect(() => setCfg(settings), [settings]);

  const themeOptions = [
    {key:"light",  icon:"☀️", label:"Modo claro"},
    {key:"dark",   icon:"🌙", label:"Modo oscuro"},
    {key:"system", icon:"💻", label:"Igual al sistema"},
  ];

  return (
    <>
      <div style={s.header}><h1 style={s.title}>⚙️ Ajustes</h1></div>

      {/* Apariencia */}
      <div style={s.card}>
        <div style={{padding:"18px"}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:14,color:"var(--text)"}}>🎨 Apariencia</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
            {themeOptions.map(t=>(
              <button key={t.key} onClick={()=>setTheme(t.key)}
                style={{padding:"14px 10px",borderRadius:10,border:theme===t.key?"2px solid #6366f1":"1.5px solid var(--border)",background:theme===t.key?"linear-gradient(135deg,#6366f1,#8b5cf6)":"var(--bg3)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6,transition:"all 0.2s"}}>
                <span style={{fontSize:22}}>{t.icon}</span>
                <span style={{fontSize:12,fontWeight:700,color:theme===t.key?"#fff":"var(--text)"}}>{t.label}</span>
                {theme===t.key&&<span style={{fontSize:10,color:"rgba(255,255,255,0.8)"}}>✓ Activo</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notificaciones */}
      <div style={s.card}>
        <div style={{padding:"18px"}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:4,color:"var(--text)"}}>🔔 Notificaciones push</div>
          <div style={{fontSize:12,color:"var(--text4)",marginBottom:14,lineHeight:1.5}}>
            Recibe alertas de stock bajo y pedidos pendientes directamente en tu teléfono, cada 8 horas.
          </div>

          {/* Estado actual */}
          <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,background:"var(--bg3)",border:"1px solid var(--border)",marginBottom:12}}>
            <span style={{fontSize:28}}>
              {notifPermission==="granted" ? "✅" : notifPermission==="denied" ? "🚫" : "🔕"}
            </span>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:13,color:"var(--text)"}}>
                {notifPermission==="granted" ? "Notificaciones activas" : notifPermission==="denied" ? "Notificaciones bloqueadas" : "Notificaciones desactivadas"}
              </div>
              <div style={{fontSize:11,color:"var(--text4)",marginTop:2}}>
                {notifPermission==="granted"
                  ? "Recibirás alertas automáticas cada 8 horas"
                  : notifPermission==="denied"
                  ? "Ve a ajustes del navegador para permitirlas"
                  : "Toca el botón para activarlas"}
              </div>
            </div>
            {/* Indicador visual */}
            {notifPermission==="granted" && (
              <div style={{width:10,height:10,borderRadius:"50%",background:"var(--success,#34c759)",boxShadow:"0 0 6px rgba(52,199,89,0.5)"}}/>
            )}
          </div>

          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {notifPermission !== "granted" && notifPermission !== "denied" && (
              <Btn onClick={onRequestNotif}>🔔 Activar notificaciones</Btn>
            )}
            {notifPermission === "granted" && (
              <Btn variant="secondary" onClick={onTestNotif}>📣 Probar ahora</Btn>
            )}
            {notifPermission === "denied" && (
              <div style={{fontSize:12,color:"var(--text4)",padding:"8px 0",lineHeight:1.5}}>
                Para activarlas: ve al ícono de 🔒 en la barra del navegador → Permisos → Notificaciones → Permitir.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info negocio */}
      <div style={s.card}>
        <div style={{padding:"18px"}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:14,color:"var(--text)"}}>🏪 Información del negocio</div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"0 14px"}}>
            <Inp label="Nombre del negocio" value={cfg.businessName}    onChange={e=>setCfg(c=>({...c,businessName:e.target.value}))}    placeholder="Mi Negocio"/>
            <Inp label="Teléfono"           value={cfg.businessPhone}   onChange={e=>setCfg(c=>({...c,businessPhone:e.target.value}))}   placeholder="+57 300…"/>
          </div>
          <Inp label="Dirección"            value={cfg.businessAddress} onChange={e=>setCfg(c=>({...c,businessAddress:e.target.value}))} placeholder="Cra 5 #10-20, Ciudad"/>
          <div style={{height:1,background:"var(--border)",margin:"14px 0"}}/>
          <div style={{fontWeight:700,fontSize:13,marginBottom:14,color:"var(--text)"}}>📦 Inventario</div>
          <Inp label={`Umbral stock bajo (actual: ${cfg.lowStockThreshold})`} type="number"
            value={cfg.lowStockThreshold} onChange={e=>setCfg(c=>({...c,lowStockThreshold:Number(e.target.value)}))} placeholder="5"/>
          <div style={{height:1,background:"var(--border)",margin:"14px 0"}}/>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn onClick={async()=>{ try{ await saveSettings(cfg); alert("✅ Ajustes guardados"); }catch(e){ alert(e.message); } }}>💾 Guardar ajustes</Btn>
          </div>
        </div>
      </div>

      {/* Zona de peligro */}
      <div style={{...s.card,padding:"14px 18px",marginTop:14}}>
        <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:"#b91c1c"}}>⚠️ Zona de peligro</div>
        <div style={{fontSize:12,color:"var(--text4)",marginBottom:10}}>Elimina todos los datos. Esta acción no se puede deshacer.</div>
        <Btn variant="danger" onClick={async()=>{ if(confirm("¿Seguro? Esto borrará TODOS los datos permanentemente.")) await resetDB(); }}>🗑️ Reiniciar base de datos</Btn>
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════
//  APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const isMobile = useIsMobile();
  useEffect(()=>{ lockViewport(); injectGlobalCSS(); },[]);

  const { theme, setTheme } = useTheme();

  // ── Supabase DB hook ────────────────────────────────────────
  const {
    db, loading, error, reload,
    addProduct, editProduct, deleteProduct,
    addCategory, editCategory, deleteCategory,
    addClient, editClient, deleteClient,
    addProvider, editProvider, deleteProvider,
    addPaymentMethod, editPaymentMethod, deletePaymentMethod,
    addOrder, editOrder, advanceOrder, cancelOrder,
    registerMovement,
    saveSettings,
    resetDB,
  } = useDB();

  // ── Notificaciones push ─────────────────────────────────────
  const { permission, requestPermission, sendAlerts } = useNotifications(db);

  const [tab, setTab] = useState("Dashboard");
  const [sideOpen, setSideOpen] = useState(false);
  const [editProd,   setEditProd]   = useState(null);
  const [showAddProd, setShowAddProd] = useState(false);

  // Modals
  const [showOrderForm,  setShowOrderForm]  = useState(false);
  const [editingOrder,   setEditingOrder]   = useState(null);
  const [showMovForm,    setShowMovForm]    = useState(false);
  const [movPreProduct,  setMovPreProduct]  = useState(null);

  const s = makeStyles(isMobile);

  // ── KPIs ────────────────────────────────────────────────────
  const lowStock    = db.products.filter(p=>p.stock<=(db.settings.lowStockThreshold||5));
  const totalValue  = db.products.reduce((s,p)=>s+p.price*p.stock,0);
  const pendOrders  = db.orders.filter(o=>o.state==="Pendiente");

  // ── Movement modal state ────────────────────────────────────
  const [movLines,    setMovLines]    = useState([{productId:"",qty:""}]);
  const [movType,     setMovType]     = useState("salida");
  const [movNote,     setMovNote]     = useState("");
  const [movDiscount, setMovDiscount] = useState("");
  const [movDelivery, setMovDelivery] = useState({name:"",address:"",phone:"",value:""});
  const [movProvider, setMovProvider] = useState("");
  const [movGen,      setMovGen]      = useState(false);

  const openMovModal = (product=null) => {
    setMovLines(product?[{productId:product.id,qty:""}]:[{productId:"",qty:""}]);
    setMovType("salida"); setMovNote(""); setMovDiscount("");
    setMovDelivery({name:"",address:"",phone:"",value:""});
    setMovProvider("");
    setMovPreProduct(product); setShowMovForm(true);
  };

  const resolvedMovLines = movLines.map(r=>({product:db.products.find(p=>p.id===Number(r.productId)),qty:Number(r.qty)})).filter(r=>r.product&&r.qty>0);
  const movSubtotal = resolvedMovLines.reduce((s,r)=>s+r.product.price*r.qty,0);
  // Domicilio solo aplica a salidas
  const movTotal = movType==="salida"
    ? movSubtotal-(Number(movDiscount)||0)+(Number(movDelivery.value)||0)
    : movSubtotal;

  const handleMovSave = async ()=>{
    if(resolvedMovLines.length===0) return alert("Agrega al menos un producto.");
    for(const {product,qty} of resolvedMovLines) if(movType==="salida"&&qty>product.stock) return alert(`Stock insuficiente: ${product.name}`);

    // Para entradas, añadir proveedor a la nota
    const prov = db.providers.find(p=>p.id===Number(movProvider));
    const noteConProveedor = movType==="entrada" && prov
      ? `${movNote ? movNote+" · " : ""}Proveedor: ${prov.name}`
      : movNote;

    // Para entradas/ajustes, no enviar domicilio
    const delivery = movType==="salida" ? movDelivery : {name:"",address:"",phone:"",value:""};

    try {
      await registerMovement(resolvedMovLines, movType, noteConProveedor, movDiscount, delivery);
      if(movType==="salida"){
        setMovGen(true);
        try{
          const invoiceNum = String(Date.now()).slice(-5);
          await generateInvoicePDF(resolvedMovLines,{note:movNote,discount:Number(movDiscount)||0,deliveryVal:Number(movDelivery.value)||0,clientName:movDelivery.name,paymentMethod:""},invoiceNum);
        }catch(e){console.error(e);}
        setMovGen(false);
      }
      setShowMovForm(false);
    } catch(e) { alert("Error al registrar: " + e.message); }
  };

  const handleOrderPDF = async (order)=>{
    const items=order.items.map(l=>({product:db.products.find(p=>p.id===Number(l.productId)),qty:Number(l.qty)})).filter(r=>r.product);
    const client=db.clients.find(c=>c.id===Number(order.clientId));
    const pm=db.paymentMethods.find(p=>p.id===Number(order.paymentMethodId));
    await generateInvoicePDF(items,{note:order.note,discount:order.discount,deliveryVal:order.delivery?.value||0,clientName:client?.name||"",paymentMethod:pm?`${pm.icon} ${pm.name}`:""}, String(order.id).padStart(5,"0"));
  };

  // ── Loading / Error screens ──────────────────────────────────
  if (loading) return (
    <div style={{minHeight:"100vh",background:"var(--bg4)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{fontSize:48}}>📦</div>
      <div style={{fontSize:20,fontWeight:800,color:"var(--text)"}}>InventApp</div>
      <div style={{fontSize:14,color:"var(--text4)"}}>Conectando con la base de datos…</div>
      <div style={{width:40,height:40,border:"4px solid #e2e8f0",borderTop:"4px solid #6366f1",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{minHeight:"100vh",background:"var(--bg4)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:24}}>
      <div style={{fontSize:48}}>⚠️</div>
      <div style={{fontSize:18,fontWeight:800,color:"#b91c1c"}}>Error de conexión</div>
      <div style={{fontSize:13,color:"var(--text4)",textAlign:"center",maxWidth:360}}>{error}</div>
      <div style={{background:"#fee2e2",borderRadius:10,padding:"12px 18px",fontSize:12,color:"#7f1d1d",maxWidth:400}}>
        Verifica que las variables <strong>VITE_SUPABASE_URL</strong> y <strong>VITE_SUPABASE_ANON_KEY</strong> estén configuradas correctamente en tu archivo <strong>.env</strong>
      </div>
      <button onClick={reload} style={{padding:"10px 24px",borderRadius:9,border:"none",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14}}>🔄 Reintentar</button>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div style={{minHeight:"100vh",background:"var(--bg4)",fontFamily:"'Segoe UI',sans-serif",color:"var(--text)"}}>

      <Sidebar tab={tab} setTab={setTab} db={db} sideOpen={sideOpen} setSideOpen={setSideOpen} isMobile={isMobile} theme={theme} setTheme={setTheme}/>

      {/* ── Banner de permiso de notificaciones ── */}
      {permission === "default" && !loading && db.products.length > 0 && (
        <div style={{
          position:"fixed", bottom: isMobile ? 90 : 20, left: isMobile ? 12 : "auto",
          right: isMobile ? 12 : 240, zIndex:2000,
          background:"var(--bg2)", borderRadius:16,
          boxShadow:"0 4px 24px rgba(0,0,0,0.15)",
          border:"1px solid var(--border)",
          padding:"14px 16px",
          display:"flex", alignItems:"center", gap:12,
          maxWidth:380,
          animation:"fadeUp .3s ease",
        }}>
          <span style={{fontSize:28,flexShrink:0}}>🔔</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:13,color:"var(--text)",marginBottom:2}}>Activar alertas</div>
            <div style={{fontSize:12,color:"var(--text4)",lineHeight:1.4}}>Recibe notificaciones de stock bajo y pedidos pendientes cada 8 horas</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
            <Btn size="sm" onClick={async()=>{ const r=await requestPermission(); if(r==="granted") sendAlerts(); }}>Activar</Btn>
            <Btn size="sm" variant="ghost" onClick={()=>localStorage.setItem(NOTIFY_TS_KEY,"dismissed")} style={{fontSize:11,color:"var(--text3)"}}>Ahora no</Btn>
          </div>
        </div>
      )}

      <main style={{...s.main, paddingTop: isMobile ? "16px" : undefined}}>

        {/* Mobile top bar */}
        {isMobile&&(
          <div style={{
            display:"flex", justifyContent:"space-between", alignItems:"center",
            padding:"12px 16px 10px",
            paddingTop:"calc(env(safe-area-inset-top, 0px) + 12px)",
            background:"var(--bg2)",
            borderBottom:"0.5px solid var(--border)",
            marginBottom:0,
            position:"sticky", top:0, zIndex:50,
            backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
          }}>
            <div>
              <div style={{fontWeight:700,fontSize:16,color:"var(--text)",letterSpacing:-0.3}}>📦 InventApp</div>
              <div style={{fontSize:11,color:"var(--text4)"}}>{tab}</div>
            </div>
            <button onClick={()=>setSideOpen(true)} style={{
              background:"var(--bg3)", border:"none", borderRadius:10,
              width:36, height:36, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:16, color:"var(--text)",
            }}>☰</button>
          </div>
        )}

        {/* ─── DASHBOARD ─── */}
        {tab==="Dashboard"&&(
          <>
            {!isMobile&&<div style={s.header}><h1 style={s.title}>📊 Dashboard</h1><Btn onClick={()=>openMovModal()}>🔄 Registrar movimiento</Btn></div>}
            {isMobile&&<div style={{marginBottom:14,display:"flex",gap:8}}><Btn style={{flex:1}} onClick={()=>openMovModal()}>🔄 Movimiento</Btn><Btn style={{flex:1}} onClick={()=>{setEditingOrder(null);setShowOrderForm(true);}}>🛒 Pedido</Btn></div>}
            <div style={s.kpiGrid(4)}>
              {[
                {label:"Productos",val:db.products.length,color:"#6366f1",icon:"📦"},
                {label:"Pedidos pendientes",val:pendOrders.length,color:"#f59e0b",icon:"🛒"},
                {label:"Valor inventario",val:formatCOP(totalValue),color:"#10b981",icon:"💰"},
                {label:"Stock bajo",val:lowStock.length,color:"#ef4444",icon:"🔔"},
              ].map(k=>(
                <div key={k.label} style={s.kpiCard(k.color)}>
                  <div style={{fontSize:18,marginBottom:5}}>{k.icon}</div>
                  <div style={s.kpiVal}>{k.val}</div>
                  <div style={s.kpiLabel}>{k.label}</div>
                </div>
              ))}
            </div>

            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
              {/* Pedidos recientes */}
              <div style={s.card}>
                <div style={{padding:"14px 16px 10px",fontWeight:800,fontSize:13,borderBottom:"1px solid var(--bg4)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>🛒 Pedidos recientes</span>
                  <button onClick={()=>setTab("Pedidos")} style={{fontSize:11,color:"#6366f1",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Ver todos →</button>
                </div>
                {db.orders.length===0?<EmptyState icon="🛒" text="Sin pedidos aún"/>:
                  db.orders.slice(0,4).map(o=>{
                    const sc=ORDER_STATE_COLORS[o.state]||ORDER_STATE_COLORS["Pendiente"];
                    const client=db.clients.find(c=>c.id===Number(o.clientId));
                    return (
                      <div key={o.id} style={{padding:"10px 16px",borderBottom:"1px solid var(--bg4)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:13}}>#{String(o.id).padStart(4,"0")} {client?`· ${client.name}`:""}</div>
                          <div style={{background:sc.bg,color:sc.text,padding:"1px 8px",borderRadius:20,fontSize:10,fontWeight:700,display:"inline-block",marginTop:3}}>● {o.state}</div>
                        </div>
                        <div style={{fontWeight:800,fontSize:14}}>{formatCOP(o.total)}</div>
                      </div>
                    );
                  })
                }
              </div>

              {/* Stock bajo */}
              <div style={s.card}>
                <div style={{padding:"14px 16px 10px",fontWeight:800,fontSize:13,borderBottom:"1px solid var(--bg4)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>🔔 Stock bajo</span>
                  {lowStock.length>0&&<Badge color="red">{lowStock.length}</Badge>}
                </div>
                {lowStock.length===0?<EmptyState icon="✅" text="Todo el stock está OK"/>:
                  lowStock.map(p=>(
                    <div key={p.id} style={{padding:"9px 16px",borderBottom:"1px solid var(--bg4)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div><div style={{fontWeight:600,fontSize:13}}>{p.name}</div><div style={{fontSize:10,color:"var(--text3)"}}>{p.sku}</div></div>
                      <Badge color={p.stock===0?"red":"yellow"}>{p.stock===0?"Agotado":`${p.stock} ${p.unit}`}</Badge>
                    </div>
                  ))
                }
              </div>
            </div>
          </>
        )}

        {/* ─── PEDIDOS ─── */}
        {tab==="Pedidos"&&(
          <>
            <div style={s.header}>
              <h1 style={s.title}>🛒 Pedidos</h1>
              <Btn onClick={()=>{setEditingOrder(null);setShowOrderForm(true);}}>+ Nuevo pedido</Btn>
            </div>

            {/* Filtro por estado */}
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
              {["Todos","Pendiente","En proceso","Enviado","Entregado","Cancelado"].map(st=>{
                const count=st==="Todos"?db.orders.length:db.orders.filter(o=>o.state===st).length;
                const sc=ORDER_STATE_COLORS[st]||{bg:"#f1f5f9",text:"#334155"};
                return (
                  <button key={st} onClick={()=>setTab("Pedidos:"+st)}
                    style={{padding:"6px 12px",borderRadius:8,border:"1.5px solid var(--border)",background:"var(--bg2)",color:"var(--text)",cursor:"pointer",fontSize:12,fontWeight:600}}>
                    {st} <span style={{background:sc.bg,color:sc.text,padding:"1px 6px",borderRadius:20,fontSize:10,fontWeight:800,marginLeft:4}}>{count}</span>
                  </button>
                );
              })}
            </div>

            {db.orders.length===0?<EmptyState icon="🛒" text="Sin pedidos. Crea el primero con '+ Nuevo pedido'"/>:
              db.orders.map(o=>(
                <OrderCard key={o.id} order={o} db={db}
                  onEdit={(order)=>{setEditingOrder(order);setShowOrderForm(true);}}
                  onAdvance={async(id)=>{
                    try {
                      await advanceOrder(id);
                      // Buscar el pedido actualizado para saber a qué estado pasó
                      const order = db.orders.find(o=>o.id===id);
                      if (!order) return;
                      const idx = ORDER_STATES.indexOf(order.state);
                      const nextState = ORDER_STATES[idx+1];
                      // Generar PDF automáticamente al pasar a "Enviado"
                      if (nextState === "Enviado") {
                        await handleOrderPDF(order);
                      }
                    } catch(e) { alert(e.message); }
                  }}
                  onCancel={(id)=>{ if(confirm("¿Cancelar este pedido?")) cancelOrder(id).catch(e=>alert(e.message)); }}
                  onPDF={handleOrderPDF}
                />
              ))
            }
          </>
        )}

        {/* ─── INVENTARIO ─── */}
        {tab==="Inventario"&&(
          <>
            <div style={s.header}>
              <h1 style={s.title}>📦 Inventario</h1>
              <div style={{display:"flex",gap:8}}>
                <Btn onClick={()=>openMovModal()}>🔄 Movimiento</Btn>
                <Btn onClick={()=>setShowAddProd(true)}>+ Producto</Btn>
              </div>
            </div>
            <div style={s.toolbar}>
              <div style={s.searchW}>
                <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--text3)",fontSize:14}}>🔍</span>
                <input style={s.searchI} placeholder="Buscar producto…" id="inv-search"
                  onChange={e=>{
                    const q=e.target.value.toLowerCase();
                    document.querySelectorAll("[data-prod-row]").forEach(el=>{
                      el.style.display=el.dataset.prodRow.toLowerCase().includes(q)?"":"none";
                    });
                  }}
                />
              </div>
            </div>
            <div style={s.card}>
              {db.products.length===0?<EmptyState icon="📦" text="Sin productos. Crea el primero con '+ Producto'"/>:
                db.products.map(p=>{
                  const cat=db.categories.find(c=>c.id===p.categoryId);
                  const prov=db.providers.find(v=>v.id===p.providerId);
                  const sc=p.stock===0?"red":p.stock<=(db.settings.lowStockThreshold||5)?"yellow":"green";
                  return (
                    <div key={p.id} data-prod-row={`${p.name} ${p.sku}`}
                      style={{padding:"12px 16px",borderBottom:"1px solid var(--bg4)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
                      <div style={{display:"flex",gap:12,alignItems:"center",flex:1,minWidth:0}}>
                        {/* Imagen — clic para editar */}
                        <div onClick={()=>setEditProd(p)}
                          style={{width:52,height:52,borderRadius:9,border:"1.5px solid var(--border)",background:"var(--bg3)",overflow:"hidden",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,cursor:"pointer",position:"relative"}}>
                          {p.image
                            ? <img src={p.image} alt={p.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                            : "📦"
                          }
                          {/* Overlay de edición */}
                          <div style={{position:"absolute",inset:0,background:"rgba(99,102,241,0.0)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,transition:"background 0.2s"}}
                            onMouseEnter={e=>e.currentTarget.style.background="rgba(99,102,241,0.45)"}
                            onMouseLeave={e=>e.currentTarget.style.background="rgba(99,102,241,0)"}
                          >✏️</div>
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:700,fontSize:14,color:"var(--text)"}}>{p.name}</div>
                          <div style={{fontSize:11,color:"#6366f1",fontFamily:"monospace",fontWeight:600}}>{p.sku}</div>
                          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:3}}>
                            {cat&&<Badge color="blue">{cat.name}</Badge>}
                            {prov&&<span style={{fontSize:10,color:"var(--text3)"}}>🏭 {prov.name}</span>}
                          </div>
                          <div style={{fontSize:12,color:"var(--text4)",marginTop:3}}>
                            Precio: <strong>{formatCOP(p.price)}</strong> · Costo: {formatCOP(p.cost)}
                          </div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                        <Badge color={sc}>{p.stock} {p.unit}</Badge>
                        <button style={s.iconBtn} title="Registrar movimiento" onClick={()=>openMovModal(p)}>🔄</button>
                        <button style={s.iconBtn} title="Editar producto"      onClick={()=>setEditProd(p)}>✏️</button>
                        <button style={s.iconBtn} title="Eliminar producto"    onClick={()=>{ if(confirm(`¿Eliminar "${p.name}"?`)) deleteProduct(p.id).catch(e=>alert(e.message)); }}>🗑️</button>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          </>
        )}

        {/* ─── MOVIMIENTOS ─── */}
        {tab==="Movimientos"&&(
          <>
            <div style={s.header}><h1 style={s.title}>🔄 Movimientos</h1><Btn onClick={()=>openMovModal()}>+ Registrar</Btn></div>
            {db.movements.length===0?<EmptyState icon="📋" text="Sin movimientos"/>:
              db.movements.map(m=>{
                const prod=db.products.find(p=>p.id===m.productId);
                return (
                  <div key={m.id} style={{...s.card,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      {/* Imagen o ícono de tipo */}
                      <div style={{width:44,height:44,borderRadius:9,border:"1.5px solid var(--border)",background:"var(--bg3)",overflow:"hidden",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,position:"relative"}}>
                        {prod?.image
                          ? <img src={prod.image} alt={prod.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                          : <span>{m.type==="entrada"?"📥":m.type==="salida"?"📤":"🔄"}</span>
                        }
                        {/* Badge de tipo sobre la imagen */}
                        {prod?.image && (
                          <span style={{position:"absolute",bottom:0,right:0,fontSize:10,background:"rgba(0,0,0,0.55)",borderRadius:"4px 0 8px 0",padding:"1px 3px"}}>
                            {m.type==="entrada"?"📥":m.type==="salida"?"📤":"🔄"}
                          </span>
                        )}
                      </div>
                      <div>
                        <div style={{fontWeight:700,fontSize:13,color:"var(--text)"}}>{m.productName}</div>
                        <div style={{fontSize:10,color:"var(--text3)"}}>{m.date}{m.note?` · ${m.note}`:""}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <Badge color={m.type==="entrada"?"green":m.type==="salida"?"red":"blue"}>{m.type==="entrada"?"+":m.type==="salida"?"-":"="}{m.qty}</Badge>
                      {prod&&m.type==="salida"&&<span style={{fontWeight:700,fontSize:13,color:"var(--text)"}}>{formatCOP(prod.price*m.qty)}</span>}
                    </div>
                  </div>
                );
              })
            }
          </>
        )}

        {/* ─── CLIENTES ─── */}
        {tab==="Clientes"&&(
          <CRUDTable title="Clientes" icon="👥" items={db.clients} s={s}
            columns={[{key:"name",primary:true},{key:"phone",prefix:"📞"},{key:"email",prefix:"✉️"},{key:"address",prefix:"📍"}]}
            emptyText="Sin clientes registrados"
            onAdd={addClient} onEdit={editClient} onDelete={deleteClient}
            renderForm={({initial,onSave,onClose})=>{
              const [f,setF]=useState(initial||{name:"",phone:"",email:"",address:""});
              const set=(k,v)=>setF(x=>({...x,[k]:v}));
              return <div>
                <Inp label="Nombre *" value={f.name} onChange={e=>set("name",e.target.value)} placeholder="Juan Pérez"/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
                  <Inp label="Teléfono" value={f.phone} onChange={e=>set("phone",e.target.value)} placeholder="+57 300…"/>
                  <Inp label="Email" value={f.email} onChange={e=>set("email",e.target.value)} placeholder="juan@mail.com"/>
                </div>
                <Inp label="Dirección" value={f.address} onChange={e=>set("address",e.target.value)} placeholder="Cra 5 #10-20…"/>
                <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:10}}>
                  <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
                  <Btn onClick={()=>{if(!f.name)return alert("Nombre requerido");onSave({...initial,...f});}}>Guardar</Btn>
                </div>
              </div>;
            }}
          />
        )}

        {/* ─── DOMICILIOS ─── */}
        {tab==="Domicilios"&&(
          <>
            <div style={s.header}><h1 style={s.title}>🛵 Domicilios</h1></div>
            <div style={s.kpiGrid(3)}>
              {[
                {label:"Total",val:db.deliveries.length,color:"#6366f1",icon:"🛵"},
                {label:"Valor domicilios",val:formatCOP(db.deliveries.reduce((s,d)=>s+d.value,0)),color:"#10b981",icon:"💵"},
                {label:"Valor pedidos",val:formatCOP(db.deliveries.reduce((s,d)=>s+d.orderValue,0)),color:"#f59e0b",icon:"🛒"},
              ].map(k=><div key={k.label} style={s.kpiCard(k.color)}><div style={{fontSize:18,marginBottom:5}}>{k.icon}</div><div style={s.kpiVal}>{k.val}</div><div style={s.kpiLabel}>{k.label}</div></div>)}
            </div>
            {db.deliveries.length===0?<EmptyState icon="🛵" text="Sin domicilios. Llena el campo Domicilio al registrar un movimiento"/>:
              db.deliveries.map(d=>(
                <div key={d.id} style={{...s.card,padding:"12px 16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                    <div><div style={{fontWeight:700,fontSize:14}}>{d.name}</div>{d.phone&&<div style={{fontSize:11,color:"var(--text4)"}}>{d.phone}</div>}{d.address&&<div style={{fontSize:11,color:"var(--text4)"}}>📍 {d.address}</div>}</div>
                    <div style={{textAlign:"right"}}><div style={{fontWeight:800,fontSize:15,color:"#6366f1"}}>{formatCOP(d.value)}</div><div style={{fontSize:10,color:"var(--text3)"}}>domicilio</div></div>
                  </div>
                  <div style={{display:"flex",gap:12,fontSize:12,color:"var(--text4)",flexWrap:"wrap"}}>
                    <span>Pedido: <strong style={{color:"var(--text)"}}>{formatCOP(d.orderValue)}</strong></span>
                    {d.discount>0&&<span>Desc: <strong style={{color:"#b91c1c"}}>-{formatCOP(d.discount)}</strong></span>}
                    <span style={{color:"var(--text3)"}}>{d.date}</span>
                  </div>
                </div>
              ))
            }
          </>
        )}

        {/* ─── ALERTAS ─── */}
        {tab==="Alertas"&&(
          <>
            <div style={s.header}><h1 style={s.title}>🔔 Alertas de Stock</h1></div>
            {lowStock.filter(p=>p.stock===0).length>0&&(
              <div style={{marginBottom:16}}>
                <div style={{fontWeight:800,color:"#b91c1c",marginBottom:8,fontSize:14}}>🚨 Agotados</div>
                <div style={s.card}>
                  {lowStock.filter(p=>p.stock===0).map(p=>(
                    <div key={p.id} style={{padding:"11px 16px",borderBottom:"1px solid #fee2e2",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div><div style={{fontWeight:700,fontSize:13}}>{p.name}</div><div style={{fontSize:10,color:"var(--text3)"}}>{p.sku}</div></div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}><Badge color="red">Agotado</Badge><Btn size="sm" onClick={()=>openMovModal(p)}>Reponer</Btn></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {lowStock.filter(p=>p.stock>0).length>0&&(
              <div>
                <div style={{fontWeight:800,color:"#a16207",marginBottom:8,fontSize:14}}>⚠️ Stock bajo (≤{db.settings.lowStockThreshold||5})</div>
                <div style={s.card}>
                  {lowStock.filter(p=>p.stock>0).map(p=>(
                    <div key={p.id} style={{padding:"11px 16px",borderBottom:"1px solid #fef9c3",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div><div style={{fontWeight:700,fontSize:13}}>{p.name}</div><div style={{fontSize:10,color:"var(--text3)"}}>{p.sku}</div></div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}><Badge color="yellow">{p.stock} {p.unit}</Badge><Btn size="sm" onClick={()=>openMovModal(p)}>Reponer</Btn></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {lowStock.length===0&&<EmptyState icon="✅" text="¡Todo el inventario está en buen estado!"/>}
          </>
        )}

        {/* ─── REPORTES ─── */}
        {tab==="Reportes"&&(
          <>
            <div style={s.header}><h1 style={s.title}>📈 Reportes</h1></div>
            {(() => {
              const salidas = db.movements.filter(m => m.type === "salida");

              // Acumulados por producto
              const topMap = {};
              salidas.forEach(m => {
                const p = db.products.find(x => x.id === m.productId);
                if (!topMap[m.productId]) topMap[m.productId] = { name:m.productName, qty:0, val:0, profit:0 };
                topMap[m.productId].qty    += m.qty;
                topMap[m.productId].val    += p ? p.price * m.qty : 0;
                topMap[m.productId].profit += p ? (p.price - p.cost) * m.qty : 0;
              });

              const top      = Object.values(topMap).sort((a,b) => b.qty - a.qty).slice(0, 5);
              const maxQ     = top[0]?.qty || 1;

              // KPIs globales
              const totalSales  = salidas.reduce((s, m) => { const p = db.products.find(x => x.id === m.productId); return s + (p ? p.price * m.qty : 0); }, 0);
              const totalCost   = salidas.reduce((s, m) => { const p = db.products.find(x => x.id === m.productId); return s + (p ? p.cost  * m.qty : 0); }, 0);
              const totalProfit = totalSales - totalCost;
              const margin      = totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : 0;

              const sinMov = db.products.filter(p => !salidas.some(m => m.productId === p.id));

              return <>
                {/* ── KPIs ── */}
                <div style={s.kpiGrid(isMobile ? 2 : 4)}>
                  {[
                    { label:"Total movimientos",   val:db.movements.length,     color:"#6366f1", icon:"🔄" },
                    { label:"Salidas registradas",  val:salidas.length,          color:"#b91c1c", icon:"📤" },
                    { label:"Ventas acumuladas",    val:formatCOP(totalSales),   color:"#3b82f6", icon:"💰" },
                    { label:"Ganancia real",        val:formatCOP(totalProfit),  color:"#34c759", icon:"📊" },
                  ].map(k => (
                    <div key={k.label} style={s.kpiCard(k.color)}>
                      <div style={{fontSize:18,marginBottom:5}}>{k.icon}</div>
                      <div style={s.kpiVal}>{k.val}</div>
                      <div style={s.kpiLabel}>{k.label}</div>
                    </div>
                  ))}
                </div>

                {/* ── Tarjeta de ganancia detallada ── */}
                <div style={{...s.card, marginBottom:14}}>
                  <div style={{padding:"14px 18px 12px", borderBottom:"1px solid var(--bg4)", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8}}>
                    <span style={{fontWeight:700, fontSize:14}}>📊 Desglose de ganancia</span>
                    <span style={{fontSize:12, color:"var(--text4)", background:"var(--bg3)", padding:"3px 10px", borderRadius:99, fontWeight:600}}>Margen: {margin}%</span>
                  </div>
                  <div style={{padding:"14px 18px", display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap:12}}>
                    {/* Ingresos */}
                    <div style={{background:"rgba(59,130,246,0.07)", borderRadius:14, padding:"14px 16px", border:"1px solid rgba(59,130,246,0.15)"}}>
                      <div style={{fontSize:11, fontWeight:600, color:"#3b82f6", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6}}>💰 Ingresos brutos</div>
                      <div style={{fontSize:22, fontWeight:700, color:"var(--text)", letterSpacing:-0.5}}>{formatCOP(totalSales)}</div>
                      <div style={{fontSize:11, color:"var(--text4)", marginTop:3}}>Precio venta × unidades</div>
                    </div>
                    {/* Costos */}
                    <div style={{background:"rgba(255,59,48,0.07)", borderRadius:14, padding:"14px 16px", border:"1px solid rgba(255,59,48,0.15)"}}>
                      <div style={{fontSize:11, fontWeight:600, color:"var(--destructive,#ff3b30)", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6}}>📦 Costo de ventas</div>
                      <div style={{fontSize:22, fontWeight:700, color:"var(--text)", letterSpacing:-0.5}}>{formatCOP(totalCost)}</div>
                      <div style={{fontSize:11, color:"var(--text4)", marginTop:3}}>Costo producto × unidades</div>
                    </div>
                    {/* Ganancia */}
                    <div style={{background:"rgba(52,199,89,0.07)", borderRadius:14, padding:"14px 16px", border:`1px solid ${totalProfit >= 0 ? "rgba(52,199,89,0.2)" : "rgba(255,59,48,0.2)"}`}}>
                      <div style={{fontSize:11, fontWeight:600, color: totalProfit >= 0 ? "#34c759" : "var(--destructive,#ff3b30)", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6}}>
                        {totalProfit >= 0 ? "✅ Ganancia neta" : "❌ Pérdida neta"}
                      </div>
                      <div style={{fontSize:22, fontWeight:700, color: totalProfit >= 0 ? "#34c759" : "var(--destructive,#ff3b30)", letterSpacing:-0.5}}>{formatCOP(totalProfit)}</div>
                      <div style={{fontSize:11, color:"var(--text4)", marginTop:3}}>Ingresos − Costos · {margin}% margen</div>
                    </div>
                  </div>
                </div>

                {/* ── Top 5 + Baja rotación ── */}
                <div style={{display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14}}>
                  <div style={s.card}>
                    <div style={{padding:"14px 16px 10px", fontWeight:700, fontSize:13, borderBottom:"1px solid var(--bg4)"}}>🏆 Top 5 más vendidos</div>
                    {top.length === 0 ? <EmptyState icon="📊" text="Sin ventas aún"/> : top.map((item, i) => (
                      <div key={i} style={{padding:"10px 16px", borderBottom:"1px solid var(--bg4)"}}>
                        <div style={{display:"flex", justifyContent:"space-between", marginBottom:5}}>
                          <div style={{display:"flex", gap:8, alignItems:"center"}}>
                            <span style={{background:i===0?"rgba(245,158,11,0.15)":"var(--bg3)", color:i===0?"#f59e0b":"var(--text4)", width:22, height:22, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800}}>{i+1}</span>
                            <span style={{fontWeight:700, fontSize:13, color:"var(--text)"}}>{item.name}</span>
                          </div>
                          <div style={{textAlign:"right"}}>
                            <div style={{fontWeight:700, fontSize:12, color:"var(--destructive,#ff3b30)"}}>{item.qty} und</div>
                            <div style={{fontSize:10, color:"var(--text4)"}}>{formatCOP(item.val)}</div>
                          </div>
                        </div>
                        {/* Barra de cantidad */}
                        <div style={{height:4, background:"var(--bg4)", borderRadius:10, marginBottom:4}}>
                          <div style={{width:`${(item.qty/maxQ)*100}%`, height:"100%", background:i===0?"linear-gradient(90deg,#f59e0b,#fbbf24)":"linear-gradient(90deg,#6366f1,#8b5cf6)", borderRadius:10}}/>
                        </div>
                        {/* Ganancia por producto */}
                        <div style={{display:"flex", justifyContent:"space-between", fontSize:11}}>
                          <span style={{color:"var(--text4)"}}>Ganancia</span>
                          <span style={{fontWeight:700, color: item.profit >= 0 ? "#34c759" : "var(--destructive,#ff3b30)"}}>{formatCOP(item.profit)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={s.card}>
                    <div style={{padding:"14px 16px 10px", fontWeight:700, fontSize:13, borderBottom:"1px solid var(--bg4)"}}>🐢 Baja rotación ({sinMov.length})</div>
                    {sinMov.length === 0
                      ? <EmptyState icon="✅" text="Todos los productos se han vendido"/>
                      : sinMov.map(p => (
                        <div key={p.id} style={{padding:"10px 16px", borderBottom:"1px solid var(--bg4)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                          <div>
                            <div style={{fontWeight:600, fontSize:13, color:"var(--text)"}}>{p.name}</div>
                            <div style={{fontSize:10, color:"var(--text3)"}}>{p.sku} · Margen: {p.cost > 0 ? (((p.price-p.cost)/p.price)*100).toFixed(0) : "—"}%</div>
                          </div>
                          <Badge color={p.stock===0?"red":p.stock<=5?"yellow":"gray"}>{p.stock===0?"Agotado":`${p.stock} ${p.unit}`}</Badge>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </>;
            })()}
          </>
        )}

        {/* ─── CONFIG: CATEGORÍAS ─── */}
        {tab==="Categorías"&&(
          <CRUDTable title="Categorías" icon="🏷️" items={db.categories} s={s}
            columns={[{key:"name",primary:true}]} emptyText="Sin categorías"
            onAdd={addCategory} onEdit={editCategory} onDelete={deleteCategory}
            renderForm={(props)=><CategoryForm {...props}/>}
          />
        )}

        {/* ─── CONFIG: PROVEEDORES ─── */}
        {tab==="Proveedores"&&(
          <CRUDTable title="Proveedores" icon="🏭" items={db.providers} s={s}
            columns={[{key:"name",primary:true},{key:"contact",prefix:"👤"},{key:"phone",prefix:"📞"},{key:"email",prefix:"✉️"},{key:"notes"}]}
            emptyText="Sin proveedores"
            onAdd={addProvider} onEdit={editProvider} onDelete={deleteProvider}
            renderForm={(props)=><ProviderForm {...props}/>}
          />
        )}

        {/* ─── CONFIG: MÉTODOS DE PAGO ─── */}
        {tab==="Métodos de pago"&&(
          <CRUDTable title="Métodos de pago" icon="💳" items={db.paymentMethods} s={s}
            columns={[{key:"icon"},{key:"name",primary:true}]} emptyText="Sin métodos de pago"
            onAdd={addPaymentMethod} onEdit={editPaymentMethod} onDelete={deletePaymentMethod}
            renderForm={(props)=><PaymentMethodForm {...props}/>}
          />
        )}

        {/* ─── CONFIG: PRODUCTOS ─── */}
        {tab==="Productos·Config"&&(
          <CRUDTable title="Productos" icon="📦" items={db.products} s={s}
            columns={[{key:"name",primary:true},{key:"sku"},{key:"stock"}]}
            emptyText="Sin productos"
            onAdd={addProduct} onEdit={editProduct} onDelete={deleteProduct}
            renderForm={(props)=><ProductConfigForm {...props} categories={db.categories} providers={db.providers} existingSkus={db.products.map(p=>p.sku)}/>}
          />
        )}

        {/* ─── AJUSTES ─── */}
        {tab==="Ajustes"&&(
          <SettingsTab
            settings={db.settings}
            isMobile={isMobile}
            s={s}
            saveSettings={saveSettings}
            resetDB={resetDB}
            theme={theme}
            setTheme={setTheme}
            notifPermission={permission}
            onRequestNotif={async()=>{ const r=await requestPermission(); if(r==="granted") sendAlerts(); }}
            onTestNotif={sendAlerts}
          />
        )}

      </main>

      {/* ── BOTTOM NAV (móvil) — estilo tab bar nativo ── */}
      {isMobile&&(
        <nav style={s.bottomNav}>
          {["Dashboard","Pedidos","Inventario","Reportes","Alertas"].map(t=>{
            const active = tab===t;
            const badge = t==="Alertas"&&lowStock.length>0 ? lowStock.length
                        : t==="Pedidos"&&pendOrders.length>0 ? pendOrders.length : null;
            return (
              <button key={t} onClick={()=>setTab(t)} style={s.bottomBtn(active)}>
                {/* Indicador activo */}
                {active && <div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:20,height:2.5,borderRadius:99,background:"var(--accent)"}}/>}
                <span style={{fontSize:20,position:"relative",lineHeight:1}}>
                  {NAV_ICONS[t]}
                  {badge&&<span style={{position:"absolute",top:-3,right:-7,background:"var(--destructive)",color:"#fff",borderRadius:99,fontSize:9,fontWeight:700,padding:"0 4px",lineHeight:"15px",minWidth:15,textAlign:"center"}}>{badge}</span>}
                </span>
                <span style={{fontSize:10,letterSpacing:0.1}}>{t}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* ── MODAL: NUEVO/EDITAR PEDIDO ── */}
      {showOrderForm&&(
        <Modal title={editingOrder?"Editar pedido":"Nuevo pedido"} onClose={()=>{setShowOrderForm(false);setEditingOrder(null);}} maxWidth={640}>
        <OrderForm db={db} addOrder={addOrder} editOrder={editOrder} initial={editingOrder} onClose={()=>{setShowOrderForm(false);setEditingOrder(null);}}/>
        </Modal>
      )}

      {/* ── MODAL: AGREGAR PRODUCTO (desde Inventario) ── */}
      {showAddProd&&(
        <Modal title="Nuevo producto" onClose={()=>setShowAddProd(false)} maxWidth={560}>
          <ProductConfigForm
            categories={db.categories}
            providers={db.providers}
            existingSkus={db.products.map(p=>p.sku)}
            onSave={async(data)=>{ try{ await addProduct(data); setShowAddProd(false); }catch(e){ alert(e.message); } }}
            onClose={()=>setShowAddProd(false)}
          />
        </Modal>
      )}

      {/* ── MODAL: EDITAR PRODUCTO (desde Inventario) ── */}
      {editProd&&(
        <Modal title="Editar producto" onClose={()=>setEditProd(null)} maxWidth={560}>
          <ProductConfigForm
            initial={editProd}
            categories={db.categories}
            providers={db.providers}
            existingSkus={db.products.filter(p=>p.id!==editProd.id).map(p=>p.sku)}
            onSave={async(data)=>{ try{ await editProduct(data); setEditProd(null); }catch(e){ alert(e.message); } }}
            onClose={()=>setEditProd(null)}
          />
        </Modal>
      )}

      {/* ── MODAL: MOVIMIENTO DE INVENTARIO ── */}
      {showMovForm&&(
        <Modal title="Registrar movimiento" onClose={()=>setShowMovForm(false)} maxWidth={600}>
          {/* Tipo */}
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            {[{key:"entrada",icon:"📥",label:"Entrada",c:"#15803d",bg:"#dcfce7"},{key:"salida",icon:"📤",label:"Salida",c:"#b91c1c",bg:"#fee2e2"},{key:"ajuste",icon:"🔄",label:"Ajuste",c:"#1d4ed8",bg:"#dbeafe"}].map(t=>(
              <button key={t.key} onClick={()=>setMovType(t.key)} style={{flex:1,padding:"9px 0",borderRadius:9,border:movType===t.key?`2px solid ${t.c}`:"1.5px solid #e2e8f0",background:movType===t.key?t.bg:"#f8fafc",cursor:"pointer",fontWeight:700,color:movType===t.key?t.c:"#64748b",fontSize:12}}>
                {t.icon}<br/>{t.label}
              </button>
            ))}
          </div>

          {/* Productos */}
          <div style={{fontSize:11,fontWeight:700,color:"var(--text2)",textTransform:"uppercase",letterSpacing:0.6,marginBottom:8}}>📦 Productos</div>
          {movLines.map((line,idx)=>{
            const prod=db.products.find(p=>p.id===Number(line.productId));
            return (
              <div key={idx} style={{background:"var(--input-bg)",borderRadius:9,padding:"10px 12px",border:"1.5px solid var(--border)",marginBottom:8}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 80px 30px",gap:8,alignItems:"end"}}>
                  <div>
                    <label style={{display:"block",fontSize:11,fontWeight:600,color:"var(--text4)",marginBottom:3}}>Producto</label>
                    <select value={line.productId} onChange={e=>{ const nl=[...movLines]; nl[idx]={...nl[idx],productId:e.target.value}; setMovLines(nl); }}
                      style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid var(--border)",fontSize:14,color:line.productId?"#0f172a":"#94a3b8",background:"var(--bg2)",outline:"none"}}>
                      <option value="">— Selecciona —</option>
                      {db.products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.stock} {p.unit}</option>)}
                    </select>
                    {prod&&<div style={{fontSize:10,color:"#6366f1",fontWeight:600,marginTop:3}}>{prod.sku} · {formatCOP(prod.price)} · Stock: {prod.stock}</div>}
                  </div>
                  <div>
                    <label style={{display:"block",fontSize:11,fontWeight:600,color:"var(--text4)",marginBottom:3}}>Cant.</label>
                    <input type="number" value={line.qty} onChange={e=>{ const nl=[...movLines]; nl[idx]={...nl[idx],qty:e.target.value}; setMovLines(nl); }} placeholder="0"
                      style={{width:"100%",padding:"8px 8px",borderRadius:8,border:"1.5px solid var(--border)",fontSize:15,fontWeight:700,color:"var(--text)",outline:"none",background:"var(--bg2)",boxSizing:"border-box"}}/>
                  </div>
                  <button onClick={()=>setMovLines(l=>l.filter((_,i)=>i!==idx))} disabled={movLines.length===1}
                    style={{padding:"8px",borderRadius:8,border:"none",background:movLines.length===1?"#f1f5f9":"#fee2e2",color:movLines.length===1?"#cbd5e1":"#b91c1c",cursor:movLines.length===1?"not-allowed":"pointer",fontSize:15,fontWeight:700,alignSelf:"end"}}>×</button>
                </div>
              </div>
            );
          })}
          <button onClick={()=>setMovLines(l=>[...l,{productId:"",qty:""}])} style={{width:"100%",padding:"8px",borderRadius:8,border:"1.5px dashed #c7d2fe",background:"#eef2ff",color:"#6366f1",cursor:"pointer",fontWeight:700,fontSize:13,marginBottom:8}}>+ Agregar producto</button>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
            <Inp label="Nota" value={movNote} onChange={e=>setMovNote(e.target.value)} placeholder="Referencia…"/>
            {movType==="salida" && (
              <Inp label="Descuento" type="number" value={movDiscount} onChange={e=>setMovDiscount(e.target.value)} placeholder="0"/>
            )}
          </div>

          {/* ENTRADA: selector de proveedor */}
          {movType==="entrada" && (
            <>
              <div style={{fontSize:11,fontWeight:700,color:"var(--text2)",textTransform:"uppercase",letterSpacing:0.6,marginBottom:8}}>🏭 Proveedor</div>
              <div style={{background:"var(--input-bg)",borderRadius:9,padding:"12px 14px",border:"1.5px solid var(--border)",marginBottom:10}}>
                <Sel label="Selecciona el proveedor" value={movProvider} onChange={e=>setMovProvider(e.target.value)}
                  options={[{value:"",label:"— Sin proveedor —"},...db.providers.map(p=>({value:p.id,label:`${p.name}${p.contact?" · "+p.contact:""}`}))]}/>
                {movProvider && (() => {
                  const prov = db.providers.find(p=>p.id===Number(movProvider));
                  return prov ? (
                    <div style={{display:"flex",gap:12,flexWrap:"wrap",fontSize:11,color:"var(--text4)"}}>
                      {prov.phone && <span>📞 {prov.phone}</span>}
                      {prov.email && <span>✉️ {prov.email}</span>}
                      {prov.notes && <span>📝 {prov.notes}</span>}
                    </div>
                  ) : null;
                })()}
              </div>
            </>
          )}

          {/* SALIDA: domicilio */}
          {movType==="salida" && (
            <>
              <div style={{fontSize:11,fontWeight:700,color:"var(--text2)",textTransform:"uppercase",letterSpacing:0.6,marginBottom:8}}>🛵 Domicilio (opcional)</div>
              <div style={{background:"var(--input-bg)",borderRadius:9,padding:"10px 12px",border:"1.5px solid var(--border)",marginBottom:10}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 10px"}}>
                  <Inp label="Cliente"  value={movDelivery.name}    onChange={e=>setMovDelivery(d=>({...d,name:e.target.value}))}    placeholder="Juan Pérez"/>
                  <Inp label="Teléfono" value={movDelivery.phone}   onChange={e=>setMovDelivery(d=>({...d,phone:e.target.value}))}   placeholder="+57 300…"/>
                </div>
                <Inp label="Dirección"     value={movDelivery.address} onChange={e=>setMovDelivery(d=>({...d,address:e.target.value}))} placeholder="Cra 5 #10-20…"/>
                <Inp label="Valor domicilio" type="number" value={movDelivery.value} onChange={e=>setMovDelivery(d=>({...d,value:e.target.value}))} placeholder="0"/>
              </div>
            </>
          )}

          {resolvedMovLines.length>0&&(
            <div style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:10,padding:"10px 14px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:"rgba(255,255,255,0.75)",fontSize:11}}>TOTAL</span>
              <span style={{color:"#fff",fontWeight:900,fontSize:18}}>{formatCOP(movTotal)}</span>
            </div>
          )}

          <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:10,borderTop:"1px solid #f1f5f9"}}>
            <Btn variant="secondary" onClick={()=>setShowMovForm(false)}>Cancelar</Btn>
            <Btn onClick={handleMovSave} disabled={movGen}>
              {movGen?"⏳ Generando PDF…":movType==="salida"?"✅ Confirmar y descargar factura":"✅ Confirmar movimiento"}
            </Btn>
          </div>
        </Modal>
      )}

    </div>
  );
}

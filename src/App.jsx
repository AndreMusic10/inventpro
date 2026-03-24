import { useState, useMemo, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
//  VIEWPORT LOCK
// ═══════════════════════════════════════════════════════════════
const lockViewport = () => {
  let m = document.querySelector("meta[name=viewport]");
  if (!m) { m = document.createElement("meta"); m.name = "viewport"; document.head.appendChild(m); }
  m.content = "width=device-width,initial-scale=1.0,maximum-scale=1.0,minimum-scale=1.0,user-scalable=no";
};

const useIsMobile = () => {
  const [mob, setMob] = useState(window.innerWidth < 768);
  useEffect(() => { const h = () => setMob(window.innerWidth < 768); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  return mob;
};

// ═══════════════════════════════════════════════════════════════
//  DATABASE  (state-based, in-memory with localStorage persistence)
// ═══════════════════════════════════════════════════════════════
const DB_KEY = "invenpro_db";

const defaultDB = {
  products: [
    { id:1, name:"Audífonos Bluetooth", sku:"ELEC-001", categoryId:1, providerId:1, price:350000, cost:180000, stock:12, unit:"und", description:"Audífonos inalámbricos con cancelación de ruido" },
    { id:2, name:"Camiseta Básica",     sku:"ROPA-001", categoryId:2, providerId:2, price:45000,  cost:18000,  stock:3,  unit:"und", description:"Camiseta 100% algodón talla M" },
    { id:3, name:"Arroz Premium 5kg",   sku:"ALIM-001", categoryId:3, providerId:1, price:28000,  cost:20000,  stock:30, unit:"kg",  description:"Arroz de grano largo premium" },
    { id:4, name:"Lámpara LED",         sku:"HOG-001",  categoryId:4, providerId:3, price:65000,  cost:32000,  stock:2,  unit:"und", description:"Lámpara de escritorio LED regulable" },
  ],
  categories: [
    { id:1, name:"Electrónica" },
    { id:2, name:"Ropa" },
    { id:3, name:"Alimentos" },
    { id:4, name:"Hogar" },
    { id:5, name:"Otro" },
  ],
  clients: [
    { id:1, name:"Juan Pérez",    phone:"300-1111111", email:"juan@mail.com",    address:"Cra 5 #10-20, Barranquilla" },
    { id:2, name:"María García",  phone:"301-2222222", email:"maria@mail.com",   address:"Cll 72 #46-30, Bogotá" },
  ],
  providers: [
    { id:1, name:"TechDistrib S.A.S", phone:"605-3001001", email:"ventas@techdistrib.co", contact:"Carlos Ríos",   notes:"Entrega en 3 días hábiles" },
    { id:2, name:"TextilAndes",       phone:"604-3002002", email:"pedidos@textilandes.co", contact:"Ana Torres",   notes:"Mínimo 10 unidades" },
    { id:3, name:"LumiCo",            phone:"601-3003003", email:"info@lumico.co",          contact:"Pedro Soto",  notes:"Pago anticipado" },
  ],
  paymentMethods: [
    { id:1, name:"Efectivo",         icon:"💵" },
    { id:2, name:"Tarjeta débito",   icon:"💳" },
    { id:3, name:"Tarjeta crédito",  icon:"💳" },
    { id:4, name:"Transferencia",    icon:"🏦" },
    { id:5, name:"Nequi / Daviplata",icon:"📱" },
  ],
  orders: [],
  movements: [],
  deliveries: [],
  settings: {
    businessName: "Mi Negocio",
    businessPhone: "",
    businessAddress: "",
    lowStockThreshold: 5,
    currency: "COP",
  },
  _seq: { product:5, category:6, client:3, provider:4, paymentMethod:6, order:1, movement:1, delivery:1 },
};

const loadDB = () => {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return { ...defaultDB, ...JSON.parse(raw) };
  } catch {}
  return defaultDB;
};

const saveDB = (db) => {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch {}
};

const nextSeq = (db, key) => {
  const id = db._seq[key];
  return { id, db: { ...db, _seq: { ...db._seq, [key]: id + 1 } } };
};

// ═══════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════
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
  doc.text(`InvenPro  \u00B7  Factura N\u00B0 ${invoiceNum}  \u00B7  ${date}`,W/2,289,{align:"center"});
  doc.save(`Factura-${invoiceNum}.pdf`);
};

// ═══════════════════════════════════════════════════════════════
//  UI ATOMS
// ═══════════════════════════════════════════════════════════════
const Badge = ({children,color="gray"}) => {
  const C={green:["#dcfce7","#15803d"],red:["#fee2e2","#b91c1c"],yellow:["#fef9c3","#a16207"],blue:["#dbeafe","#1d4ed8"],purple:["#ede9fe","#6d28d9"],gray:["#f3f4f6","#374151"]};
  const [bg,tc]=C[color]||C.gray;
  return <span style={{background:bg,color:tc,padding:"2px 9px",borderRadius:20,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{children}</span>;
};

const Modal = ({title,onClose,children,maxWidth=540}) => (
  <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.65)",zIndex:3000,display:"flex",alignItems:"flex-start",justifyContent:"center",backdropFilter:"blur(4px)",overflowY:"auto",padding:"16px 12px"}}>
    <div style={{background:"#fff",borderRadius:16,padding:"22px 22px",width:"100%",maxWidth,boxShadow:"0 24px 80px rgba(0,0,0,0.25)",margin:"auto",boxSizing:"border-box"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <h2 style={{margin:0,fontSize:16,fontWeight:800,color:"#0f172a"}}>{title}</h2>
        <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:8,width:32,height:32,cursor:"pointer",fontSize:20,color:"#64748b"}}>×</button>
      </div>
      {children}
    </div>
  </div>
);

const Inp = ({label,...p}) => (
  <div style={{marginBottom:12}}>
    {label&&<label style={{display:"block",fontSize:12,fontWeight:600,color:"#475569",marginBottom:4}}>{label}</label>}
    <input {...p} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:15,color:"#0f172a",outline:"none",boxSizing:"border-box",background:"#f8fafc",...p.style}}/>
  </div>
);

const Sel = ({label,options,...p}) => (
  <div style={{marginBottom:12}}>
    {label&&<label style={{display:"block",fontSize:12,fontWeight:600,color:"#475569",marginBottom:4}}>{label}</label>}
    <select {...p} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:15,color:"#0f172a",background:"#f8fafc",outline:"none",boxSizing:"border-box"}}>
      {options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
    </select>
  </div>
);

const Btn = ({children,variant="primary",size="md",...p}) => {
  const bg={primary:"linear-gradient(135deg,#6366f1,#8b5cf6)",danger:"#fee2e2",secondary:"#f1f5f9",green:"linear-gradient(135deg,#10b981,#059669)"};
  const col={primary:"#fff",danger:"#b91c1c",secondary:"#334155",green:"#fff"};
  const pad={md:"10px 18px",sm:"7px 13px",lg:"12px 24px"};
  return <button {...p} style={{padding:pad[size],borderRadius:9,border:"none",cursor:"pointer",fontWeight:700,fontSize:size==="sm"?12:14,background:bg[variant],color:col[variant],boxShadow:variant==="primary"||variant==="green"?"0 3px 10px rgba(99,102,241,0.25)":"none",opacity:p.disabled?0.6:1,...p.style}}>{children}</button>;
};

const EmptyState = ({icon,text}) => (
  <div style={{padding:"44px 16px",textAlign:"center",color:"#94a3b8"}}>
    <div style={{fontSize:36,marginBottom:8}}>{icon}</div>
    <div style={{fontSize:13}}>{text}</div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
//  SIDEBAR
// ═══════════════════════════════════════════════════════════════
const Sidebar = ({tab,setTab,db,sideOpen,setSideOpen,isMobile}) => {
  const lowStock = db.products.filter(p=>p.stock<=(db.settings.lowStockThreshold||5)).length;
  const pendingOrders = db.orders.filter(o=>o.state==="Pendiente").length;

  const content = (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Logo */}
      <div style={{padding:"20px 18px 16px",borderBottom:"1px solid #1e293b"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:17,fontWeight:900,color:"#fff",letterSpacing:-0.5}}>📦 InvenPro</div>
            <div style={{fontSize:10,color:"#64748b",marginTop:1}}>{db.settings.businessName}</div>
          </div>
          {isMobile&&<button onClick={()=>setSideOpen(false)} style={{background:"none",border:"none",color:"#64748b",fontSize:20,cursor:"pointer"}}>×</button>}
        </div>
      </div>

      {/* Nav groups */}
      <nav style={{flex:1,overflowY:"auto",padding:"10px 10px"}}>
        {NAV_GROUPS.map(group=>(
          <div key={group.label} style={{marginBottom:6}}>
            <div style={{fontSize:9,fontWeight:700,color:"#334155",letterSpacing:1,textTransform:"uppercase",padding:"6px 8px 4px"}}>{group.label}</div>
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

      <div style={{padding:"10px 14px",fontSize:10,color:"#334155",borderTop:"1px solid #1e293b"}}>
        {db.products.length} productos · {db.clients.length} clientes
      </div>
    </div>
  );

  if (isMobile) {
    if (!sideOpen) return null;
    return (
      <>
        <div onClick={()=>setSideOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1500}}/>
        <aside style={{position:"fixed",top:0,left:0,bottom:0,width:240,background:"#0f172a",zIndex:1600,overflowY:"auto"}}>
          {content}
        </aside>
      </>
    );
  }

  return (
    <aside style={{width:220,background:"#0f172a",minHeight:"100vh",position:"fixed",top:0,left:0,bottom:0,overflowY:"auto",zIndex:100}}>
      {content}
    </aside>
  );
};

// ═══════════════════════════════════════════════════════════════
//  STYLES FACTORY
// ═══════════════════════════════════════════════════════════════
const makeStyles = (isMobile) => ({
  main:     {marginLeft:isMobile?0:220,padding:isMobile?"12px 12px 80px":"26px 28px",minHeight:"100vh"},
  header:   {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10},
  title:    {fontSize:isMobile?18:22,fontWeight:900,color:"#0f172a",margin:0},
  kpiGrid:  (cols)=>({display:"grid",gridTemplateColumns:`repeat(${isMobile?Math.min(cols,2):cols},1fr)`,gap:12,marginBottom:18}),
  kpiCard:  (c)=>({background:"#fff",borderRadius:12,padding:isMobile?"12px 14px":"16px 18px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",borderLeft:`4px solid ${c}`}),
  kpiVal:   {fontSize:isMobile?18:24,fontWeight:900,color:"#0f172a",lineHeight:1.1,marginBottom:3},
  kpiLabel: {fontSize:isMobile?10:12,color:"#64748b",fontWeight:500},
  card:     {background:"#fff",borderRadius:13,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",overflow:"hidden",marginBottom:16},
  tHead:    (cols)=>({display:"grid",gridTemplateColumns:cols,padding:"8px 16px",background:"#f8fafc",borderBottom:"1px solid #e2e8f0"}),
  tRow:     (cols)=>({display:"grid",gridTemplateColumns:cols,alignItems:"center",padding:"11px 16px",borderBottom:"1px solid #f1f5f9"}),
  th:       {fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.6},
  toolbar:  {display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap"},
  searchW:  {position:"relative",flex:1,minWidth:140},
  searchI:  {width:"100%",padding:"9px 14px 9px 34px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:14,outline:"none",background:"#f8fafc",color:"#0f172a",boxSizing:"border-box"},
  iconBtn:  {background:"none",border:"none",cursor:"pointer",padding:"6px 7px",borderRadius:8,fontSize:16},
  bottomNav:{position:"fixed",bottom:0,left:0,right:0,background:"#0f172a",zIndex:500,display:"flex",borderTop:"1px solid #1e293b",paddingBottom:"env(safe-area-inset-bottom,0)"},
  bottomBtn:(a)=>({flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"8px 2px 6px",border:"none",background:"transparent",cursor:"pointer",color:a?"#818cf8":"#64748b",fontSize:9,fontWeight:a?700:500,gap:2,minWidth:0}),
});

// ═══════════════════════════════════════════════════════════════
//  ORDERS MODULE
// ═══════════════════════════════════════════════════════════════
const OrderForm = ({db,setDB,onClose,initial}) => {
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

  const handleSave = ()=>{
    if(resolved.length===0) return alert("Agrega al menos un producto.");
    if(initial){
      setDB(db=>{ const d={...db,orders:db.orders.map(o=>o.id===initial.id?{...o,clientId,paymentMethodId:pmId,items:lines,note,discount:disc,delivery,total,updatedAt:nowStr()}:o)}; saveDB(d); return d; });
    } else {
      setDB(db=>{ const {id,db:d2}=nextSeq(db,"order"); const order={id,clientId,paymentMethodId:pmId,items:lines,note,discount:disc,delivery,total,state:"Pendiente",createdAt:nowStr(),updatedAt:nowStr()}; const d3={...d2,orders:[order,...d2.orders]}; saveDB(d3); return d3; });
    }
    onClose();
  };

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
        <Sel label="Cliente" value={clientId} onChange={e=>setClientId(e.target.value)}
          options={[{value:"",label:"— Sin cliente —"},...db.clients.map(c=>({value:c.id,label:c.name}))]}/>
        <Sel label="Método de pago" value={pmId} onChange={e=>setPmId(e.target.value)}
          options={[{value:"",label:"— Selecciona —"},...db.paymentMethods.map(p=>({value:p.id,label:`${p.icon} ${p.name}`}))]}/>
      </div>

      <div style={{fontSize:12,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:0.6,margin:"10px 0 8px"}}>📦 Productos</div>
      {lines.map((line,idx)=>{
        const prod=db.products.find(p=>p.id===Number(line.productId));
        return (
          <div key={idx} style={{background:"#f8fafc",borderRadius:9,padding:"10px 12px",border:"1.5px solid #e2e8f0",marginBottom:8}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 80px 30px",gap:8,alignItems:"end"}}>
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:600,color:"#64748b",marginBottom:3}}>Producto</label>
                <select value={line.productId} onChange={e=>setLine(idx,"productId",e.target.value)}
                  style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:14,color:line.productId?"#0f172a":"#94a3b8",background:"#fff",outline:"none"}}>
                  <option value="">— Selecciona —</option>
                  {db.products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.stock} {p.unit}</option>)}
                </select>
                {prod&&<div style={{fontSize:10,color:"#6366f1",fontWeight:600,marginTop:3}}>{prod.sku} · {formatCOP(prod.price)} · Stock: {prod.stock}</div>}
              </div>
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:600,color:"#64748b",marginBottom:3}}>Cant.</label>
                <input type="number" value={line.qty} onChange={e=>setLine(idx,"qty",e.target.value)} placeholder="0"
                  style={{width:"100%",padding:"8px 8px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:15,fontWeight:700,color:"#0f172a",outline:"none",background:"#fff",boxSizing:"border-box"}}/>
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

      <div style={{fontSize:12,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:0.6,margin:"6px 0 8px"}}>🛵 Domicilio (opcional)</div>
      <div style={{background:"#f8fafc",borderRadius:9,padding:"12px",border:"1.5px solid #e2e8f0"}}>
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
    <div style={{background:"#fff",borderRadius:13,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",marginBottom:10,overflow:"hidden",border:`1.5px solid ${sc.dot}22`}}>
      {/* Header */}
      <div style={{padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",gap:10}} onClick={()=>setExpanded(e=>!e)}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
            <span style={{fontWeight:800,fontSize:14,color:"#0f172a"}}>Pedido #{String(order.id).padStart(4,"0")}</span>
            <div style={{background:sc.bg,color:sc.text,padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>● {order.state}</div>
          </div>
          <div style={{fontSize:12,color:"#64748b"}}>
            {client?`👤 ${client.name}`:"Sin cliente"}
            {pm?` · ${pm.icon} ${pm.name}`:""}
          </div>
          <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{order.createdAt}</div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontWeight:900,fontSize:16,color:"#0f172a"}}>{formatCOP(order.total)}</div>
          <div style={{fontSize:10,color:"#94a3b8"}}>{expanded?"▲":"▼"}</div>
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
                  <span style={{color:"#334155"}}>{prod.name} <span style={{color:"#94a3b8",fontSize:11}}>×{line.qty}</span></span>
                  <span style={{fontWeight:700}}>{formatCOP(prod.price*Number(line.qty))}</span>
                </div>
              );
            })}
            {order.discount>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:12,color:"#b91c1c"}}><span>Descuento</span><span>-{formatCOP(order.discount)}</span></div>}
            {order.delivery?.value>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:12,color:"#64748b"}}><span>🛵 Domicilio</span><span>{formatCOP(order.delivery.value)}</span></div>}
          </div>

          {/* Domicilio info */}
          {order.delivery?.name&&(
            <div style={{background:"#f8fafc",borderRadius:8,padding:"8px 10px",marginBottom:10,fontSize:12}}>
              <div style={{fontWeight:700,color:"#0f172a"}}>{order.delivery.name}</div>
              {order.delivery.address&&<div style={{color:"#64748b"}}>📍 {order.delivery.address}</div>}
              {order.delivery.phone&&<div style={{color:"#64748b"}}>📞 {order.delivery.phone}</div>}
            </div>
          )}

          {/* Estado + avanzar */}
          <OrderStateProgress order={order} onAdvance={()=>onAdvance(order.id)} onCancel={()=>onCancel(order.id)}/>

          {/* Acciones */}
          <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
            <Btn size="sm" variant="secondary" onClick={()=>onEdit(order)}>✏️ Editar</Btn>
            {order.state==="Entregado"&&<Btn size="sm" variant="secondary" onClick={()=>onPDF(order)}>📄 Factura PDF</Btn>}
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
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#94a3b8",fontSize:14}}>🔍</span>
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
//  APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const isMobile = useIsMobile();
  useEffect(()=>lockViewport(),[]);

  const [db, setDB] = useState(()=>loadDB());
  const [tab, setTab] = useState("Dashboard");
  const [sideOpen, setSideOpen] = useState(false);

  // Modals
  const [showOrderForm,  setShowOrderForm]  = useState(false);
  const [editingOrder,   setEditingOrder]   = useState(null);
  const [showMovForm,    setShowMovForm]    = useState(false);
  const [movPreProduct,  setMovPreProduct]  = useState(null);

  const s = makeStyles(isMobile);

  // ── DB helpers ──────────────────────────────────────────────
  const dbOp = useCallback((fn) => setDB(db=>{ const d=fn(db); saveDB(d); return d; }),[]);

  // Products
  const addProduct    = d => dbOp(db=>{ const {id,db:d2}=nextSeq(db,"product"); return {...d2,products:[...d2.products,{...d,id}]}; });
  const editProduct   = d => dbOp(db=>({...db,products:db.products.map(p=>p.id===d.id?d:p)}));
  const deleteProduct = id=> dbOp(db=>({...db,products:db.products.filter(p=>p.id!==id)}));

  // Categories
  const addCat    = d => dbOp(db=>{ const {id,db:d2}=nextSeq(db,"category"); return {...d2,categories:[...d2.categories,{...d,id}]}; });
  const editCat   = d => dbOp(db=>({...db,categories:db.categories.map(c=>c.id===d.id?d:c)}));
  const deleteCat = id=> dbOp(db=>({...db,categories:db.categories.filter(c=>c.id!==id)}));

  // Clients
  const addClient    = d => dbOp(db=>{ const {id,db:d2}=nextSeq(db,"client"); return {...d2,clients:[...d2.clients,{...d,id}]}; });
  const editClient   = d => dbOp(db=>({...db,clients:db.clients.map(c=>c.id===d.id?d:c)}));
  const deleteClient = id=> dbOp(db=>({...db,clients:db.clients.filter(c=>c.id!==id)}));

  // Providers
  const addProvider    = d => dbOp(db=>{ const {id,db:d2}=nextSeq(db,"provider"); return {...d2,providers:[...d2.providers,{...d,id}]}; });
  const editProvider   = d => dbOp(db=>({...db,providers:db.providers.map(p=>p.id===d.id?d:p)}));
  const deleteProvider = id=> dbOp(db=>({...db,providers:db.providers.filter(p=>p.id!==id)}));

  // PaymentMethods
  const addPM    = d => dbOp(db=>{ const {id,db:d2}=nextSeq(db,"paymentMethod"); return {...d2,paymentMethods:[...d2.paymentMethods,{...d,id}]}; });
  const editPM   = d => dbOp(db=>({...db,paymentMethods:db.paymentMethods.map(p=>p.id===d.id?d:p)}));
  const deletePM = id=> dbOp(db=>({...db,paymentMethods:db.paymentMethods.filter(p=>p.id!==id)}));

  // Orders
  const advanceOrder = (id) => dbOp(db=>{
    return {...db,orders:db.orders.map(o=>{
      if(o.id!==id) return o;
      const idx=ORDER_STATES.indexOf(o.state);
      const next=ORDER_STATES[idx+1]||o.state;
      return {...o,state:next,updatedAt:nowStr()};
    })};
  });
  const cancelOrder = (id) => dbOp(db=>({...db,orders:db.orders.map(o=>o.id===id?{...o,state:"Cancelado",updatedAt:nowStr()}:o)}));

  // Movements
  const registerMovement = (resolvedLines,type,note,discount,delivery) => {
    const date=nowStr();
    dbOp(db=>{
      let d={...db};
      resolvedLines.forEach(({product,qty})=>{
        const sa=type==="entrada"?product.stock+qty:type==="salida"?product.stock-qty:qty;
        d={...d,products:d.products.map(p=>p.id===product.id?{...p,stock:sa}:p)};
        const {id,db:d2}=nextSeq(d,"movement");
        d={...d2,movements:[{id,productId:product.id,productName:product.name,sku:product.sku,type,qty,note,stockAfter:sa,discount:Number(discount)||0,date},...d2.movements]};
      });
      if(delivery?.name){
        const sub=resolvedLines.reduce((s,r)=>s+r.product.price*r.qty,0);
        const {id,db:d2}=nextSeq(d,"delivery");
        d={...d2,deliveries:[{id,date,name:delivery.name,address:delivery.address,phone:delivery.phone,value:Number(delivery.value)||0,orderValue:sub,discount:Number(discount)||0,products:resolvedLines.map(r=>`${r.product.name} x${r.qty}`)},...d2.deliveries]};
      }
      return d;
    });
  };

  // Settings
  const saveSettings = (settings) => dbOp(db=>({...db,settings}));

  // ── KPIs ────────────────────────────────────────────────────
  const lowStock    = db.products.filter(p=>p.stock<=(db.settings.lowStockThreshold||5));
  const totalValue  = db.products.reduce((s,p)=>s+p.price*p.stock,0);
  const pendOrders  = db.orders.filter(o=>o.state==="Pendiente");
  const todaySales  = db.movements.filter(m=>m.type==="salida"&&m.date?.startsWith(new Date().toLocaleDateString("es-CO")));

  // ── Movement modal state ─────────────────────────────────────
  const [movLines,    setMovLines]    = useState([{productId:"",qty:""}]);
  const [movType,     setMovType]     = useState("salida");
  const [movNote,     setMovNote]     = useState("");
  const [movDiscount, setMovDiscount] = useState("");
  const [movDelivery, setMovDelivery] = useState({name:"",address:"",phone:"",value:""});
  const [movGen,      setMovGen]      = useState(false);

  const openMovModal = (product=null) => {
    setMovLines(product?[{productId:product.id,qty:""}]:[{productId:"",qty:""}]);
    setMovType("salida"); setMovNote(""); setMovDiscount(""); setMovDelivery({name:"",address:"",phone:"",value:""});
    setMovPreProduct(product); setShowMovForm(true);
  };

  const resolvedMovLines = movLines.map(r=>({product:db.products.find(p=>p.id===Number(r.productId)),qty:Number(r.qty)})).filter(r=>r.product&&r.qty>0);
  const movSubtotal = resolvedMovLines.reduce((s,r)=>s+r.product.price*r.qty,0);
  const movTotal = movSubtotal-(Number(movDiscount)||0)+(Number(movDelivery.value)||0);

  const handleMovSave = async ()=>{
    if(resolvedMovLines.length===0) return alert("Agrega al menos un producto.");
    for(const {product,qty} of resolvedMovLines) if(movType==="salida"&&qty>product.stock) return alert(`Stock insuficiente: ${product.name}`);
    registerMovement(resolvedMovLines,movType,movNote,movDiscount,movDelivery);
    if(movType==="salida"){
      const {id}=nextSeq(db,"movement");
      setMovGen(true);
      try{ await generateInvoicePDF(resolvedMovLines,{note:movNote,discount:Number(movDiscount)||0,deliveryVal:Number(movDelivery.value)||0,clientName:movDelivery.name,paymentMethod:""},String(id).padStart(5,"0")); }catch(e){console.error(e);}
      setMovGen(false);
    }
    setShowMovForm(false);
  };

  const handleOrderPDF = async (order)=>{
    const items=order.items.map(l=>({product:db.products.find(p=>p.id===Number(l.productId)),qty:Number(l.qty)})).filter(r=>r.product);
    const client=db.clients.find(c=>c.id===Number(order.clientId));
    const pm=db.paymentMethods.find(p=>p.id===Number(order.paymentMethodId));
    await generateInvoicePDF(items,{note:order.note,discount:order.discount,deliveryVal:order.delivery?.value||0,clientName:client?.name||"",paymentMethod:pm?`${pm.icon} ${pm.name}`:""}, String(order.id).padStart(5,"0"));
  };

  // ═══════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div style={{minHeight:"100vh",background:"#f1f5f9",fontFamily:"'Segoe UI',sans-serif",color:"#0f172a"}}>

      <Sidebar tab={tab} setTab={setTab} db={db} sideOpen={sideOpen} setSideOpen={setSideOpen} isMobile={isMobile}/>

      <main style={s.main}>

        {/* Mobile top bar */}
        {isMobile&&(
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <button onClick={()=>setSideOpen(true)} style={{background:"#0f172a",border:"none",borderRadius:9,width:36,height:36,cursor:"pointer",color:"#fff",fontSize:18}}>☰</button>
            <div style={{fontWeight:800,fontSize:15,color:"#0f172a"}}>{tab}</div>
            <div style={{width:36}}/>
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
                <div style={{padding:"14px 16px 10px",fontWeight:800,fontSize:13,borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>🛒 Pedidos recientes</span>
                  <button onClick={()=>setTab("Pedidos")} style={{fontSize:11,color:"#6366f1",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Ver todos →</button>
                </div>
                {db.orders.length===0?<EmptyState icon="🛒" text="Sin pedidos aún"/>:
                  db.orders.slice(0,4).map(o=>{
                    const sc=ORDER_STATE_COLORS[o.state]||ORDER_STATE_COLORS["Pendiente"];
                    const client=db.clients.find(c=>c.id===Number(o.clientId));
                    return (
                      <div key={o.id} style={{padding:"10px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
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
                <div style={{padding:"14px 16px 10px",fontWeight:800,fontSize:13,borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>🔔 Stock bajo</span>
                  {lowStock.length>0&&<Badge color="red">{lowStock.length}</Badge>}
                </div>
                {lowStock.length===0?<EmptyState icon="✅" text="Todo el stock está OK"/>:
                  lowStock.map(p=>(
                    <div key={p.id} style={{padding:"9px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div><div style={{fontWeight:600,fontSize:13}}>{p.name}</div><div style={{fontSize:10,color:"#94a3b8"}}>{p.sku}</div></div>
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
                    style={{padding:"6px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#fff",color:"#334155",cursor:"pointer",fontSize:12,fontWeight:600}}>
                    {st} <span style={{background:sc.bg,color:sc.text,padding:"1px 6px",borderRadius:20,fontSize:10,fontWeight:800,marginLeft:4}}>{count}</span>
                  </button>
                );
              })}
            </div>

            {db.orders.length===0?<EmptyState icon="🛒" text="Sin pedidos. Crea el primero con '+ Nuevo pedido'"/>:
              db.orders.map(o=>(
                <OrderCard key={o.id} order={o} db={db}
                  onEdit={(order)=>{setEditingOrder(order);setShowOrderForm(true);}}
                  onAdvance={advanceOrder}
                  onCancel={(id)=>{ if(confirm("¿Cancelar este pedido?")) cancelOrder(id); }}
                  onPDF={handleOrderPDF}
                />
              ))
            }
          </>
        )}

        {/* ─── INVENTARIO ─── */}
        {tab==="Inventario"&&(
          <>
            <div style={s.header}><h1 style={s.title}>📦 Inventario</h1><Btn onClick={()=>openMovModal()}>🔄 Movimiento</Btn></div>
            <div style={s.toolbar}>
              <div style={s.searchW}>
                <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#94a3b8",fontSize:14}}>🔍</span>
                <input style={s.searchI} placeholder="Buscar producto…" id="inv-search"/>
              </div>
            </div>
            <div style={s.card}>
              {db.products.length===0?<EmptyState icon="📦" text="Sin productos"/>:
                db.products.map(p=>{
                  const cat=db.categories.find(c=>c.id===p.categoryId);
                  const prov=db.providers.find(v=>v.id===p.providerId);
                  const sc=p.stock===0?"red":p.stock<=(db.settings.lowStockThreshold||5)?"yellow":"green";
                  return (
                    <div key={p.id} style={{padding:"12px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:700,fontSize:14}}>{p.name}</div>
                        <div style={{fontSize:11,color:"#6366f1",fontFamily:"monospace",fontWeight:600}}>{p.sku}</div>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:4}}>
                          {cat&&<Badge color="blue">{cat.name}</Badge>}
                          {prov&&<span style={{fontSize:10,color:"#94a3b8"}}>🏭 {prov.name}</span>}
                        </div>
                        <div style={{fontSize:12,color:"#64748b",marginTop:4}}>Precio: <strong>{formatCOP(p.price)}</strong> · Costo: {formatCOP(p.cost)}</div>
                      </div>
                      <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                        <Badge color={sc}>{p.stock} {p.unit}</Badge>
                        <button style={{...s.iconBtn,fontSize:14}} onClick={()=>openMovModal(p)}>🔄</button>
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
                      <span style={{fontSize:22}}>{m.type==="entrada"?"📥":m.type==="salida"?"📤":"🔄"}</span>
                      <div>
                        <div style={{fontWeight:700,fontSize:13}}>{m.productName}</div>
                        <div style={{fontSize:10,color:"#94a3b8"}}>{m.date}{m.note?` · ${m.note}`:""}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <Badge color={m.type==="entrada"?"green":m.type==="salida"?"red":"blue"}>{m.type==="entrada"?"+":m.type==="salida"?"-":"="}{m.qty}</Badge>
                      {prod&&m.type==="salida"&&<span style={{fontWeight:700,fontSize:13}}>{formatCOP(prod.price*m.qty)}</span>}
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
                    <div><div style={{fontWeight:700,fontSize:14}}>{d.name}</div>{d.phone&&<div style={{fontSize:11,color:"#64748b"}}>{d.phone}</div>}{d.address&&<div style={{fontSize:11,color:"#64748b"}}>📍 {d.address}</div>}</div>
                    <div style={{textAlign:"right"}}><div style={{fontWeight:800,fontSize:15,color:"#6366f1"}}>{formatCOP(d.value)}</div><div style={{fontSize:10,color:"#94a3b8"}}>domicilio</div></div>
                  </div>
                  <div style={{display:"flex",gap:12,fontSize:12,color:"#64748b",flexWrap:"wrap"}}>
                    <span>Pedido: <strong style={{color:"#0f172a"}}>{formatCOP(d.orderValue)}</strong></span>
                    {d.discount>0&&<span>Desc: <strong style={{color:"#b91c1c"}}>-{formatCOP(d.discount)}</strong></span>}
                    <span style={{color:"#94a3b8"}}>{d.date}</span>
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
                      <div><div style={{fontWeight:700,fontSize:13}}>{p.name}</div><div style={{fontSize:10,color:"#94a3b8"}}>{p.sku}</div></div>
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
                      <div><div style={{fontWeight:700,fontSize:13}}>{p.name}</div><div style={{fontSize:10,color:"#94a3b8"}}>{p.sku}</div></div>
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
              const salidas=db.movements.filter(m=>m.type==="salida");
              const topMap={};
              salidas.forEach(m=>{ if(!topMap[m.productId])topMap[m.productId]={name:m.productName,qty:0,val:0}; const p=db.products.find(x=>x.id===m.productId); topMap[m.productId].qty+=m.qty; topMap[m.productId].val+=p?p.price*m.qty:0; });
              const top=Object.values(topMap).sort((a,b)=>b.qty-a.qty).slice(0,5);
              const maxQ=top[0]?.qty||1;
              const totalSales=salidas.reduce((s,m)=>{const p=db.products.find(x=>x.id===m.productId);return s+(p?p.price*m.qty:0);},0);
              const sinMov=db.products.filter(p=>!salidas.some(m=>m.productId===p.id));
              return <>
                <div style={s.kpiGrid(3)}>
                  {[
                    {label:"Total movimientos",val:db.movements.length,color:"#6366f1",icon:"🔄"},
                    {label:"Salidas registradas",val:salidas.length,color:"#b91c1c",icon:"📤"},
                    {label:"Ventas acumuladas",val:formatCOP(totalSales),color:"#10b981",icon:"💰"},
                  ].map(k=><div key={k.label} style={s.kpiCard(k.color)}><div style={{fontSize:18,marginBottom:5}}>{k.icon}</div><div style={s.kpiVal}>{k.val}</div><div style={s.kpiLabel}>{k.label}</div></div>)}
                </div>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
                  <div style={s.card}>
                    <div style={{padding:"14px 16px 10px",fontWeight:800,fontSize:13,borderBottom:"1px solid #f1f5f9"}}>🏆 Top 5 más vendidos</div>
                    {top.length===0?<EmptyState icon="📊" text="Sin ventas aún"/>:top.map((item,i)=>(
                      <div key={i} style={{padding:"10px 16px",borderBottom:"1px solid #f1f5f9"}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            <span style={{background:i===0?"#fef9c3":"#f1f5f9",color:i===0?"#a16207":"#64748b",width:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800}}>{i+1}</span>
                            <span style={{fontWeight:700,fontSize:13}}>{item.name}</span>
                          </div>
                          <div style={{textAlign:"right"}}><div style={{fontWeight:800,fontSize:13,color:"#b91c1c"}}>{item.qty} und</div><div style={{fontSize:10,color:"#64748b"}}>{formatCOP(item.val)}</div></div>
                        </div>
                        <div style={{height:5,background:"#f1f5f9",borderRadius:10}}><div style={{width:`${(item.qty/maxQ)*100}%`,height:"100%",background:i===0?"linear-gradient(90deg,#f59e0b,#fbbf24)":"linear-gradient(90deg,#6366f1,#8b5cf6)",borderRadius:10}}/></div>
                      </div>
                    ))}
                  </div>
                  <div style={s.card}>
                    <div style={{padding:"14px 16px 10px",fontWeight:800,fontSize:13,borderBottom:"1px solid #f1f5f9"}}>🐢 Baja rotación ({sinMov.length})</div>
                    {sinMov.length===0?<EmptyState icon="✅" text="Todos los productos se han vendido"/>:sinMov.map(p=>(
                      <div key={p.id} style={{padding:"10px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div><div style={{fontWeight:600,fontSize:13}}>{p.name}</div><div style={{fontSize:10,color:"#94a3b8"}}>{p.sku}</div></div>
                        <Badge color={p.stock===0?"red":p.stock<=5?"yellow":"gray"}>{p.stock===0?"Agotado":`${p.stock} ${p.unit}`}</Badge>
                      </div>
                    ))}
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
            onAdd={addCat} onEdit={editCat} onDelete={deleteCat}
            renderForm={({initial,onSave,onClose})=>{
              const [name,setName]=useState(initial?.name||"");
              return <div>
                <Inp label="Nombre *" value={name} onChange={e=>setName(e.target.value)} placeholder="Ej: Bebidas"/>
                <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:10}}>
                  <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
                  <Btn onClick={()=>{if(!name.trim())return alert("Nombre requerido");onSave({...initial,name:name.trim()});}}>Guardar</Btn>
                </div>
              </div>;
            }}
          />
        )}

        {/* ─── CONFIG: PROVEEDORES ─── */}
        {tab==="Proveedores"&&(
          <CRUDTable title="Proveedores" icon="🏭" items={db.providers} s={s}
            columns={[{key:"name",primary:true},{key:"contact",prefix:"👤"},{key:"phone",prefix:"📞"},{key:"email",prefix:"✉️"},{key:"notes"}]}
            emptyText="Sin proveedores"
            onAdd={addProvider} onEdit={editProvider} onDelete={deleteProvider}
            renderForm={({initial,onSave,onClose})=>{
              const [f,setF]=useState(initial||{name:"",contact:"",phone:"",email:"",notes:""});
              const set=(k,v)=>setF(x=>({...x,[k]:v}));
              return <div>
                <Inp label="Nombre empresa *" value={f.name}    onChange={e=>set("name",e.target.value)}    placeholder="TechDistrib S.A.S"/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
                  <Inp label="Contacto"   value={f.contact} onChange={e=>set("contact",e.target.value)} placeholder="Carlos Ríos"/>
                  <Inp label="Teléfono"   value={f.phone}   onChange={e=>set("phone",e.target.value)}   placeholder="605-3001001"/>
                  <Inp label="Email"      value={f.email}   onChange={e=>set("email",e.target.value)}   placeholder="ventas@empresa.co"/>
                </div>
                <Inp label="Notas" value={f.notes} onChange={e=>set("notes",e.target.value)} placeholder="Ej: Mínimo 10 unidades, entrega 3 días…"/>
                <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:10}}>
                  <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
                  <Btn onClick={()=>{if(!f.name)return alert("Nombre requerido");onSave({...initial,...f});}}>Guardar</Btn>
                </div>
              </div>;
            }}
          />
        )}

        {/* ─── CONFIG: MÉTODOS DE PAGO ─── */}
        {tab==="Métodos de pago"&&(
          <CRUDTable title="Métodos de pago" icon="💳" items={db.paymentMethods} s={s}
            columns={[{key:"icon"},{key:"name",primary:true}]} emptyText="Sin métodos de pago"
            onAdd={addPM} onEdit={editPM} onDelete={deletePM}
            renderForm={({initial,onSave,onClose})=>{
              const [f,setF]=useState(initial||{name:"",icon:"💳"});
              const set=(k,v)=>setF(x=>({...x,[k]:v}));
              return <div>
                <div style={{display:"grid",gridTemplateColumns:"80px 1fr",gap:"0 12px"}}>
                  <Inp label="Ícono" value={f.icon} onChange={e=>set("icon",e.target.value)} placeholder="💵"/>
                  <Inp label="Nombre *" value={f.name} onChange={e=>set("name",e.target.value)} placeholder="Efectivo"/>
                </div>
                <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:10}}>
                  <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
                  <Btn onClick={()=>{if(!f.name)return alert("Nombre requerido");onSave({...initial,...f});}}>Guardar</Btn>
                </div>
              </div>;
            }}
          />
        )}

        {/* ─── CONFIG: PRODUCTOS ─── */}
        {tab==="Productos·Config"&&(
          <CRUDTable title="Productos" icon="📦" items={db.products} s={s}
            columns={[{key:"name",primary:true},{key:"sku"},{key:"stock"}]}
            emptyText="Sin productos"
            onAdd={addProduct} onEdit={editProduct} onDelete={deleteProduct}
            renderForm={({initial,onSave,onClose})=>{
              const [f,setF]=useState(initial||{name:"",sku:"",categoryId:"",providerId:"",price:"",cost:"",stock:"",unit:"und",description:""});
              const set=(k,v)=>setF(x=>({...x,[k]:v}));
              return <div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
                  <Inp label="Nombre *"      value={f.name}  onChange={e=>set("name",e.target.value)}  placeholder="Producto"/>
                  <Inp label="SKU *"         value={f.sku}   onChange={e=>set("sku",e.target.value)}   placeholder="SKU-001"/>
                  <Sel label="Categoría"     value={f.categoryId} onChange={e=>set("categoryId",Number(e.target.value))}
                    options={[{value:"",label:"— Sin categoría —"},...db.categories.map(c=>({value:c.id,label:c.name}))]}/>
                  <Sel label="Proveedor"     value={f.providerId} onChange={e=>set("providerId",Number(e.target.value))}
                    options={[{value:"",label:"— Sin proveedor —"},...db.providers.map(p=>({value:p.id,label:p.name}))]}/>
                  <Inp label="Precio venta *" type="number" value={f.price}  onChange={e=>set("price",+e.target.value)}  placeholder="0"/>
                  <Inp label="Costo"          type="number" value={f.cost}   onChange={e=>set("cost",+e.target.value)}   placeholder="0"/>
                  <Inp label="Stock *"        type="number" value={f.stock}  onChange={e=>set("stock",+e.target.value)}  placeholder="0"/>
                  <Inp label="Unidad"                       value={f.unit}   onChange={e=>set("unit",e.target.value)}    placeholder="und, kg…"/>
                </div>
                <Inp label="Descripción" value={f.description} onChange={e=>set("description",e.target.value)} placeholder="Opcional"/>
                <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:10}}>
                  <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
                  <Btn onClick={()=>{if(!f.name||!f.sku||f.stock==="")return alert("Campos requeridos incompletos");onSave({...initial,...f});}}>Guardar</Btn>
                </div>
              </div>;
            }}
          />
        )}

        {/* ─── AJUSTES ─── */}
        {tab==="Ajustes"&&(()=>{
          const [cfg,setCfg]=useState(db.settings);
          return <>
            <div style={s.header}><h1 style={s.title}>⚙️ Ajustes</h1></div>
            <div style={s.card}>
              <div style={{padding:"18px 18px"}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:14,color:"#0f172a"}}>🏪 Información del negocio</div>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:"0 14px"}}>
                  <Inp label="Nombre del negocio" value={cfg.businessName}    onChange={e=>setCfg(c=>({...c,businessName:e.target.value}))}    placeholder="Mi Negocio"/>
                  <Inp label="Teléfono"           value={cfg.businessPhone}   onChange={e=>setCfg(c=>({...c,businessPhone:e.target.value}))}   placeholder="+57 300…"/>
                </div>
                <Inp label="Dirección"            value={cfg.businessAddress} onChange={e=>setCfg(c=>({...c,businessAddress:e.target.value}))} placeholder="Cra 5 #10-20, Ciudad"/>
                <div style={{height:1,background:"#f1f5f9",margin:"14px 0"}}/>
                <div style={{fontWeight:700,fontSize:13,marginBottom:14,color:"#0f172a"}}>📦 Inventario</div>
                <Inp label={`Umbral de stock bajo (actual: ${cfg.lowStockThreshold})`} type="number" value={cfg.lowStockThreshold} onChange={e=>setCfg(c=>({...c,lowStockThreshold:Number(e.target.value)}))} placeholder="5"/>
                <div style={{height:1,background:"#f1f5f9",margin:"14px 0"}}/>
                <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                  <Btn onClick={()=>saveSettings(cfg)}>💾 Guardar ajustes</Btn>
                </div>
              </div>
            </div>
            <div style={{...s.card,padding:"14px 18px",marginTop:14}}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:"#b91c1c"}}>⚠️ Zona de peligro</div>
              <div style={{fontSize:12,color:"#64748b",marginBottom:10}}>Elimina todos los datos de la base de datos. Esta acción no se puede deshacer.</div>
              <Btn variant="danger" onClick={()=>{ if(confirm("¿Seguro? Esto borrará TODOS los datos permanentemente.")) { localStorage.removeItem(DB_KEY); window.location.reload(); } }}>🗑️ Reiniciar base de datos</Btn>
            </div>
          </>;
        })()}

      </main>

      {/* ── BOTTOM NAV (móvil) ── */}
      {isMobile&&(
        <nav style={s.bottomNav}>
          {["Dashboard","Pedidos","Inventario","Reportes","Alertas"].map(t=>{
            const badge=t==="Alertas"&&lowStock.length>0?lowStock.length:t==="Pedidos"&&pendOrders.length>0?pendOrders.length:null;
            return (
              <button key={t} onClick={()=>setTab(t)} style={s.bottomBtn(tab===t)}>
                <span style={{fontSize:18,position:"relative"}}>
                  {NAV_ICONS[t]}
                  {badge&&<span style={{position:"absolute",top:-4,right:-6,background:"#ef4444",color:"#fff",borderRadius:20,fontSize:8,fontWeight:800,padding:"0 4px",lineHeight:"14px"}}>{badge}</span>}
                </span>
                <span style={{fontSize:9,lineHeight:1}}>{t}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* ── MODAL: NUEVO/EDITAR PEDIDO ── */}
      {showOrderForm&&(
        <Modal title={editingOrder?"Editar pedido":"Nuevo pedido"} onClose={()=>{setShowOrderForm(false);setEditingOrder(null);}} maxWidth={640}>
          <OrderForm db={db} setDB={setDB} initial={editingOrder} onClose={()=>{setShowOrderForm(false);setEditingOrder(null);}}/>
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
          <div style={{fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:0.6,marginBottom:8}}>📦 Productos</div>
          {movLines.map((line,idx)=>{
            const prod=db.products.find(p=>p.id===Number(line.productId));
            return (
              <div key={idx} style={{background:"#f8fafc",borderRadius:9,padding:"10px 12px",border:"1.5px solid #e2e8f0",marginBottom:8}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 80px 30px",gap:8,alignItems:"end"}}>
                  <div>
                    <label style={{display:"block",fontSize:11,fontWeight:600,color:"#64748b",marginBottom:3}}>Producto</label>
                    <select value={line.productId} onChange={e=>{ const nl=[...movLines]; nl[idx]={...nl[idx],productId:e.target.value}; setMovLines(nl); }}
                      style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:14,color:line.productId?"#0f172a":"#94a3b8",background:"#fff",outline:"none"}}>
                      <option value="">— Selecciona —</option>
                      {db.products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.stock} {p.unit}</option>)}
                    </select>
                    {prod&&<div style={{fontSize:10,color:"#6366f1",fontWeight:600,marginTop:3}}>{prod.sku} · {formatCOP(prod.price)} · Stock: {prod.stock}</div>}
                  </div>
                  <div>
                    <label style={{display:"block",fontSize:11,fontWeight:600,color:"#64748b",marginBottom:3}}>Cant.</label>
                    <input type="number" value={line.qty} onChange={e=>{ const nl=[...movLines]; nl[idx]={...nl[idx],qty:e.target.value}; setMovLines(nl); }} placeholder="0"
                      style={{width:"100%",padding:"8px 8px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:15,fontWeight:700,color:"#0f172a",outline:"none",background:"#fff",boxSizing:"border-box"}}/>
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
            <Inp label="Descuento" type="number" value={movDiscount} onChange={e=>setMovDiscount(e.target.value)} placeholder="0"/>
          </div>

          <div style={{fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:0.6,marginBottom:8}}>🛵 Domicilio (opcional)</div>
          <div style={{background:"#f8fafc",borderRadius:9,padding:"10px 12px",border:"1.5px solid #e2e8f0",marginBottom:10}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 10px"}}>
              <Inp label="Cliente" value={movDelivery.name}    onChange={e=>setMovDelivery(d=>({...d,name:e.target.value}))}    placeholder="Juan Pérez"/>
              <Inp label="Teléfono" value={movDelivery.phone}  onChange={e=>setMovDelivery(d=>({...d,phone:e.target.value}))}   placeholder="+57 300…"/>
            </div>
            <Inp label="Dirección" value={movDelivery.address} onChange={e=>setMovDelivery(d=>({...d,address:e.target.value}))} placeholder="Cra 5 #10-20…"/>
            <Inp label="Valor domicilio" type="number" value={movDelivery.value} onChange={e=>setMovDelivery(d=>({...d,value:e.target.value}))} placeholder="0"/>
          </div>

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

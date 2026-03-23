import { useState, useMemo, useEffect } from "react";

// ── Bloquear zoom y fijar viewport ──────────────────────────────────────────
const lockViewport = () => {
  let meta = document.querySelector("meta[name=viewport]");
  if (!meta) { meta = document.createElement("meta"); meta.name = "viewport"; document.head.appendChild(meta); }
  meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no";
};

// ── Breakpoint helper ────────────────────────────────────────────────────────
const useIsMobile = () => {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mobile;
};

const DEFAULT_CATEGORIES = ["Electrónica", "Ropa", "Alimentos", "Hogar", "Otro"];
const LOW_STOCK_THRESHOLD = 5;
const TABS = ["Dashboard", "Inventario", "Movimientos", "Domicilios", "Alertas", "Categorías"];

const initialProducts = [
  { id: 1, name: "Audífonos Bluetooth", sku: "ELEC-001", category: "Electrónica", price: 350000, cost: 180000, stock: 12, unit: "und", description: "Audífonos inalámbricos con cancelación de ruido" },
  { id: 2, name: "Camiseta Básica",     sku: "ROPA-001", category: "Ropa",        price: 45000,  cost: 18000,  stock: 3,  unit: "und", description: "Camiseta 100% algodón talla M" },
  { id: 3, name: "Arroz Premium 5kg",   sku: "ALIM-001", category: "Alimentos",   price: 28000,  cost: 20000,  stock: 30, unit: "kg",  description: "Arroz de grano largo premium" },
  { id: 4, name: "Lámpara LED",         sku: "HOG-001",  category: "Hogar",       price: 65000,  cost: 32000,  stock: 2,  unit: "und", description: "Lámpara de escritorio LED regulable" },
];

let nextId = 5, invoiceCounter = 1, deliveryId = 1;

const formatCOP = (val) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(val || 0);

// ── jsPDF ────────────────────────────────────────────────────────────────────
let jsPDFLoaded = false;
const loadJsPDF = () => new Promise((resolve) => {
  if (window.jspdf) { resolve(window.jspdf.jsPDF); return; }
  if (jsPDFLoaded) { const t = setInterval(() => { if (window.jspdf) { clearInterval(t); resolve(window.jspdf.jsPDF); } }, 50); return; }
  jsPDFLoaded = true;
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  s.onload = () => resolve(window.jspdf.jsPDF);
  document.head.appendChild(s);
});

const generateInvoicePDF = async (items, opts) => {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, M = 18;
  const invoiceNum = String(invoiceCounter++).padStart(5, "0");
  const date = new Date().toLocaleString("es-CO");
  const PURPLE=[99,102,241], DARK=[15,23,42], GRAY=[100,116,139], LIGHT=[241,245,249], WHITE=[255,255,255], GREEN=[16,185,129], RED=[239,68,68];
  const typeColor = opts.type === "entrada" ? GREEN : opts.type === "salida" ? RED : PURPLE;

  doc.setFillColor(...DARK); doc.rect(0,0,W,44,"F");
  doc.setFillColor(...typeColor); doc.rect(0,0,5,44,"F");
  doc.setFont("helvetica","bold"); doc.setFontSize(30); doc.setTextColor(...WHITE);
  doc.text("FACTURA", M+4, 22);
  doc.setFont("helvetica","bold"); doc.setFontSize(13); doc.text(`N\u00B0 ${invoiceNum}`, W-M, 18, {align:"right"});
  doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(180,190,210);
  doc.text(`Fecha: ${date}`, W-M, 27, {align:"right"});

  let y = 54;
  doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.setTextColor(...GRAY);
  doc.text("TIPO", M, y); doc.text("REFERENCIA / NOTA", M+35, y);
  if (opts.delivery?.name) doc.text("DATOS DOMICILIO", W/2+5, y);
  y += 5;
  doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(...typeColor);
  doc.text(opts.type === "entrada" ? "Entrada" : opts.type === "salida" ? "Salida" : "Ajuste", M, y);
  doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(...DARK);
  doc.text(opts.note || "Sin referencia", M+35, y);
  if (opts.delivery?.name) {
    const dl = opts.delivery;
    doc.setFontSize(8.5); doc.text(dl.name, W/2+5, y);
    if (dl.address) doc.text(`Dir: ${dl.address}`, W/2+5, y+5);
    if (dl.phone)   doc.text(`Tel: ${dl.phone}`, W/2+5, y+10);
    if (dl.value)   { doc.setTextColor(...typeColor); doc.setFont("helvetica","bold"); doc.text(`Dom: ${formatCOP(dl.value)}`, W/2+5, y+15); }
  }
  y += 16;
  doc.setDrawColor(...LIGHT); doc.setLineWidth(0.5); doc.line(M,y,W-M,y);
  y += 7;
  doc.setFillColor(...DARK); doc.roundedRect(M,y,W-M*2,10,2,2,"F");
  doc.setTextColor(...WHITE); doc.setFont("helvetica","bold"); doc.setFontSize(8);
  const C = {num:M+3,name:M+9,sku:M+68,qty:M+104,unit:M+119,vUnit:M+134,vTot:W-M-2};
  doc.text("#",C.num,y+7); doc.text("PRODUCTO",C.name,y+7); doc.text("SKU",C.sku,y+7);
  doc.text("CANT.",C.qty,y+7); doc.text("UNID.",C.unit,y+7); doc.text("V. UNITARIO",C.vUnit,y+7); doc.text("V. TOTAL",C.vTot,y+7,{align:"right"});
  y += 10;
  let subtotal = 0;
  items.forEach(({product,qty},idx) => {
    const vt = product.price * qty; subtotal += vt;
    doc.setFillColor(...(idx%2===0 ? LIGHT : [248,250,252])); doc.rect(M,y,W-M*2,12,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(8.5); doc.setTextColor(...DARK);
    doc.text(String(idx+1),C.num,y+8); doc.text(product.name,C.name,y+8);
    doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(...GRAY);
    doc.text(product.sku,C.sku,y+8); doc.setTextColor(...DARK);
    doc.text(String(qty),C.qty,y+8); doc.text(product.unit,C.unit,y+8);
    doc.text(formatCOP(product.price),C.vUnit,y+8);
    doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(...typeColor);
    doc.text(formatCOP(vt),C.vTot,y+8,{align:"right"}); y+=12;
    if (product.description) {
      doc.setFillColor(250,250,253); doc.rect(M,y,W-M*2,7,"F");
      doc.setFont("helvetica","italic"); doc.setFontSize(7.5); doc.setTextColor(...GRAY);
      doc.text(`   ${product.description}`,C.name,y+5); y+=7;
    }
  });
  doc.setDrawColor(...LIGHT); doc.setLineWidth(0.3); doc.line(M,y,W-M,y);
  y += 10;
  const bx=W/2+10, discount=Number(opts.discount)||0, deliveryVal=(opts.delivery&&Number(opts.delivery.value))||0, grandTotal=subtotal-discount+deliveryVal;
  const rowT=(label,val,color=DARK)=>{ doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(...GRAY); doc.text(label,bx,y); doc.setTextColor(...color); doc.text(formatCOP(val),W-M,y,{align:"right"}); y+=6; };
  rowT("Subtotal:",subtotal);
  if(discount>0) rowT("Descuento:",-discount,RED);
  if(deliveryVal>0) rowT("Domicilio:",deliveryVal);
  doc.setDrawColor(...typeColor); doc.setLineWidth(0.7); doc.line(bx,y,W-M,y); y+=3;
  doc.setFillColor(...typeColor); doc.roundedRect(bx,y,W-M-bx,14,2,2,"F");
  doc.setTextColor(...WHITE); doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.text("VALOR TOTAL:",bx+3,y+9);
  doc.setFontSize(12); doc.text(formatCOP(grandTotal),W-M-3,y+9,{align:"right"});
  doc.setFillColor(...DARK); doc.rect(0,277,W,20,"F");
  doc.setFillColor(...typeColor); doc.rect(0,277,5,20,"F");
  doc.setTextColor(180,190,210); doc.setFont("helvetica","normal"); doc.setFontSize(7.5);
  doc.text(`InvenPro  \u00B7  Factura N\u00B0 ${invoiceNum}  \u00B7  ${date}`, W/2, 289, {align:"center"});
  doc.save(`Factura-${invoiceNum}.pdf`);
};

// ── UI helpers ───────────────────────────────────────────────────────────────
const Badge = ({ children, color }) => {
  const C = { green:["#dcfce7","#15803d"], red:["#fee2e2","#b91c1c"], yellow:["#fef9c3","#a16207"], blue:["#dbeafe","#1d4ed8"], gray:["#f3f4f6","#374151"] };
  const [bg,text] = C[color]||C.gray;
  return <span style={{background:bg,color:text,padding:"2px 9px",borderRadius:20,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{children}</span>;
};

const Modal = ({ title, onClose, children, maxWidth=520 }) => (
  <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.65)",zIndex:2000,display:"flex",alignItems:"flex-start",justifyContent:"center",backdropFilter:"blur(4px)",overflowY:"auto",padding:"16px 12px",WebkitOverflowScrolling:"touch"}}>
    <div style={{background:"#fff",borderRadius:16,padding:"22px 20px",width:"100%",maxWidth,boxShadow:"0 24px 80px rgba(0,0,0,0.25)",margin:"auto",boxSizing:"border-box"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h2 style={{margin:0,fontSize:17,fontWeight:800,color:"#0f172a"}}>{title}</h2>
        <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:8,width:34,height:34,cursor:"pointer",fontSize:20,color:"#64748b",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>×</button>
      </div>
      {children}
    </div>
  </div>
);

const Inp = ({ label, ...p }) => (
  <div style={{marginBottom:12}}>
    {label && <label style={{display:"block",fontSize:12,fontWeight:600,color:"#475569",marginBottom:4}}>{label}</label>}
    <input {...p} style={{width:"100%",padding:"10px 13px",borderRadius:9,border:"1.5px solid #e2e8f0",fontSize:16,color:"#0f172a",outline:"none",boxSizing:"border-box",background:"#f8fafc",...p.style}} />
  </div>
);

const Sel = ({ label, options, ...p }) => (
  <div style={{marginBottom:12}}>
    {label && <label style={{display:"block",fontSize:12,fontWeight:600,color:"#475569",marginBottom:4}}>{label}</label>}
    <select {...p} style={{width:"100%",padding:"10px 13px",borderRadius:9,border:"1.5px solid #e2e8f0",fontSize:16,color:"#0f172a",background:"#f8fafc",outline:"none",boxSizing:"border-box"}}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

// ── ProductForm ───────────────────────────────────────────────────────────────
const ProductForm = ({ initial, onSave, onClose, categories }) => {
  const [f, setF] = useState(initial || { name:"", sku:"", category:categories[0]||"Otro", price:"", cost:"", stock:"", unit:"und", description:"" });
  const set = (k,v) => setF(x=>({...x,[k]:v}));
  return (
    <div>
      <Inp label="Nombre *"       value={f.name}        onChange={e=>set("name",e.target.value)}        placeholder="Producto" />
      <Inp label="SKU / Código *" value={f.sku}         onChange={e=>set("sku",e.target.value)}         placeholder="SKU-001" />
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
        <Sel label="Categoría"    value={f.category}    onChange={e=>set("category",e.target.value)}    options={categories} />
        <Inp label="Unidad"       value={f.unit}        onChange={e=>set("unit",e.target.value)}        placeholder="und, kg…" />
        <Inp label="Precio venta *" type="number"       value={f.price}  onChange={e=>set("price",e.target.value)}  placeholder="0" />
        <Inp label="Costo"          type="number"       value={f.cost}   onChange={e=>set("cost",e.target.value)}   placeholder="0" />
        <Inp label="Stock actual *" type="number"       value={f.stock}  onChange={e=>set("stock",e.target.value)}  placeholder="0" />
      </div>
      <Inp label="Descripción" value={f.description} onChange={e=>set("description",e.target.value)} placeholder="Opcional" />
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
        <button onClick={onClose} style={{padding:"10px 18px",borderRadius:9,border:"1.5px solid #e2e8f0",background:"#f8fafc",cursor:"pointer",fontWeight:600,color:"#64748b",fontSize:14}}>Cancelar</button>
        <button onClick={()=>{ if(!f.name||!f.sku||!f.price||f.stock==="") return alert("Campos requeridos incompletos."); onSave({...f,price:+f.price,cost:+f.cost,stock:+f.stock}); }}
          style={{padding:"10px 22px",borderRadius:9,border:"none",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14}}>
          {initial?"Guardar":"Agregar"}
        </button>
      </div>
    </div>
  );
};

// ── MovementModal ─────────────────────────────────────────────────────────────
const MovementModal = ({ preProduct, allProducts, onClose, onSave }) => {
  const isMobile = useIsMobile();
  const [lines,    setLines]    = useState(preProduct ? [{productId:preProduct.id,qty:""}] : [{productId:"",qty:""}]);
  const [type,     setType]     = useState("salida");
  const [note,     setNote]     = useState("");
  const [discount, setDiscount] = useState("");
  const [delivery, setDelivery] = useState({name:"",address:"",phone:"",value:""});
  const [generating, setGen]    = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const addLine    = () => setLines(l=>[...l,{productId:"",qty:""}]);
  const removeLine = (i) => setLines(l=>l.filter((_,idx)=>idx!==i));
  const setLine    = (i,k,v) => setLines(l=>l.map((r,idx)=>idx===i?{...r,[k]:v}:r));

  const resolvedLines = lines.map(r=>({product:allProducts.find(p=>p.id===Number(r.productId)),qty:Number(r.qty)})).filter(r=>r.product&&r.qty>0);
  const subtotal    = resolvedLines.reduce((s,r)=>s+r.product.price*r.qty,0);
  const discountVal = Number(discount)||0;
  const deliveryVal = Number(delivery.value)||0;
  const grandTotal  = subtotal-discountVal+deliveryVal;

  const typeColors = {
    entrada:{border:"#15803d",bg:"#dcfce7",text:"#15803d",accent:"#4ade80"},
    salida: {border:"#b91c1c",bg:"#fee2e2",text:"#b91c1c",accent:"#f87171"},
    ajuste: {border:"#1d4ed8",bg:"#dbeafe",text:"#1d4ed8",accent:"#818cf8"},
  };
  const tc = typeColors[type];

  const handleSave = async () => {
    if(resolvedLines.length===0) return alert("Agrega al menos un producto con cantidad válida.");
    for(const {product,qty} of resolvedLines) if(type==="salida"&&qty>product.stock) return alert(`Stock insuficiente para "${product.name}".`);
    onSave(resolvedLines,type,note,discount,delivery);
    if(type==="salida"){
      setGen(true);
      try { await generateInvoicePDF(resolvedLines,{type,note,discount:discountVal,delivery}); } catch(e){ console.error(e); }
      setGen(false);
    }
    onClose();
  };

  const sec = (t) => <div style={{fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:0.6,marginBottom:8,marginTop:14}}>{t}</div>;

  // Preview panel (shared between mobile and desktop)
  const previewPanel = (
    <div style={{background:"#0f172a",borderRadius:14,overflow:"hidden",fontSize:12}}>
      <div style={{background:tc.border,padding:"10px 14px 8px"}}>
        <div style={{color:"#fff",fontWeight:900,fontSize:16}}>FACTURA</div>
        <div style={{color:"rgba(255,255,255,0.65)",fontSize:9,marginTop:1}}>
          {type==="salida"?"📄 PDF al confirmar":"ℹ️ Solo salidas generan factura"}
        </div>
      </div>
      <div style={{padding:"12px 14px"}}>
        <div style={{marginBottom:8}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:"0 8px",marginBottom:5}}>
            <span style={{fontSize:9,color:"#64748b",fontWeight:700}}>PRODUCTO</span>
            <span style={{fontSize:9,color:"#64748b",fontWeight:700,textAlign:"right"}}>V.UNIT.</span>
            <span style={{fontSize:9,color:"#64748b",fontWeight:700,textAlign:"right"}}>V.TOTAL</span>
          </div>
          {resolvedLines.length===0
            ? <div style={{color:"#475569",fontSize:11,padding:"4px 0"}}>Sin productos aún…</div>
            : resolvedLines.map(({product,qty},i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:"0 8px",padding:"5px 7px",background:i%2===0?"#1e293b":"#162032",borderRadius:6,marginBottom:3}}>
                <span style={{fontSize:11,color:"#fff",fontWeight:600}}>{product.name}<br/><span style={{color:"#64748b",fontWeight:400,fontSize:9}}>{qty} {product.unit}</span></span>
                <span style={{fontSize:10,color:"#94a3b8",textAlign:"right",alignSelf:"center"}}>{formatCOP(product.price)}</span>
                <span style={{fontSize:11,color:tc.accent,fontWeight:700,textAlign:"right",alignSelf:"center"}}>{formatCOP(product.price*qty)}</span>
              </div>
            ))
          }
        </div>
        {resolvedLines.length>0&&(
          <>
            <div style={{height:1,background:"#1e293b",margin:"6px 0"}}/>
            {[["Subtotal",subtotal,"#94a3b8"],discountVal>0?["Descuento",-discountVal,"#f87171"]:null,deliveryVal>0?["Domicilio",deliveryVal,"#94a3b8"]:null].filter(Boolean).map(([l,v,c])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:2}}>
                <span style={{color:"#64748b"}}>{l}:</span><span style={{color:c,fontWeight:600}}>{formatCOP(v)}</span>
              </div>
            ))}
            <div style={{height:1,background:tc.border,margin:"5px 0"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 9px",background:tc.border,borderRadius:8,marginTop:3}}>
              <span style={{color:"#fff",fontSize:10,fontWeight:700}}>TOTAL</span>
              <span style={{color:"#fff",fontWeight:900,fontSize:15}}>{formatCOP(grandTotal)}</span>
            </div>
          </>
        )}
        {delivery.name&&(
          <div style={{marginTop:8,background:"#1e293b",borderRadius:8,padding:"7px 9px",fontSize:10}}>
            <div style={{color:"#64748b",fontWeight:700,marginBottom:2}}>🛵 DOMICILIO</div>
            {delivery.name&&<div style={{color:"#fff"}}>{delivery.name}</div>}
            {delivery.address&&<div style={{color:"#94a3b8"}}>{delivery.address}</div>}
            {delivery.phone&&<div style={{color:"#94a3b8"}}>{delivery.phone}</div>}
            {delivery.value&&<div style={{color:tc.accent,fontWeight:700}}>{formatCOP(delivery.value)}</div>}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Modal title="Registrar movimiento" onClose={onClose} maxWidth={isMobile?460:860}>
      {/* Tipo */}
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {[{key:"entrada",icon:"📥",label:"Entrada"},{key:"salida",icon:"📤",label:"Salida"},{key:"ajuste",icon:"🔄",label:"Ajuste"}].map(t=>(
          <button key={t.key} onClick={()=>setType(t.key)} style={{flex:1,padding:"9px 0",borderRadius:9,border:type===t.key?`2px solid ${typeColors[t.key].border}`:"1.5px solid #e2e8f0",background:type===t.key?typeColors[t.key].bg:"#f8fafc",cursor:"pointer",fontWeight:700,color:type===t.key?typeColors[t.key].text:"#64748b",fontSize:12}}>
            {t.icon}<br/>{t.label}
          </button>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 300px",gap:isMobile?0:20}}>
        {/* Formulario */}
        <div style={{overflowY:"auto",maxHeight:isMobile?"60vh":"65vh",paddingRight:4}}>
          {sec("📦 Productos")}
          {lines.map((line,idx)=>{
            const prod = allProducts.find(p=>p.id===Number(line.productId));
            return (
              <div key={idx} style={{background:"#f8fafc",borderRadius:10,padding:"10px 12px",border:"1.5px solid #e2e8f0",marginBottom:10}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 90px 32px",gap:8,alignItems:"end"}}>
                  <div>
                    <label style={{display:"block",fontSize:11,fontWeight:600,color:"#64748b",marginBottom:3}}>Producto</label>
                    <select value={line.productId} onChange={e=>setLine(idx,"productId",e.target.value)}
                      style={{width:"100%",padding:"9px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:14,color:line.productId?"#0f172a":"#94a3b8",background:"#fff",outline:"none"}}>
                      <option value="">— Selecciona —</option>
                      {allProducts.map(p=><option key={p.id} value={p.id}>{p.name} · {p.stock} {p.unit}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{display:"block",fontSize:11,fontWeight:600,color:"#64748b",marginBottom:3}}>Cant.</label>
                    <input type="number" value={line.qty} onChange={e=>setLine(idx,"qty",e.target.value)} placeholder="0"
                      style={{width:"100%",padding:"9px 8px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:15,fontWeight:700,color:"#0f172a",outline:"none",background:"#fff",boxSizing:"border-box"}}/>
                  </div>
                  <button onClick={()=>removeLine(idx)} disabled={lines.length===1}
                    style={{padding:"9px",borderRadius:8,border:"none",background:lines.length===1?"#f1f5f9":"#fee2e2",color:lines.length===1?"#cbd5e1":"#b91c1c",cursor:lines.length===1?"not-allowed":"pointer",fontSize:15,fontWeight:700,alignSelf:"end"}}>×</button>
                </div>
                {prod&&<div style={{fontSize:11,color:"#6366f1",fontWeight:600,marginTop:4}}>{prod.sku} · {formatCOP(prod.price)} · Stock: {prod.stock}</div>}
              </div>
            );
          })}
          <button onClick={addLine} style={{width:"100%",padding:"9px",borderRadius:9,border:"1.5px dashed #c7d2fe",background:"#eef2ff",color:"#6366f1",cursor:"pointer",fontWeight:700,fontSize:13,marginBottom:2}}>
            + Agregar producto
          </button>

          {sec("📝 Referencia")}
          <Inp label="" value={note} onChange={e=>setNote(e.target.value)} placeholder="Nota o referencia…" />

          {sec("🏷️ Descuento")}
          <Inp label="" type="number" value={discount} onChange={e=>setDiscount(e.target.value)} placeholder="0 (vacío si no aplica)" />

          {sec("🛵 Domicilio (opcional)")}
          <div style={{background:"#f8fafc",borderRadius:10,padding:"12px",border:"1.5px solid #e2e8f0"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 10px"}}>
              <Inp label="Nombre cliente" value={delivery.name}    onChange={e=>setDelivery(d=>({...d,name:e.target.value}))}    placeholder="Juan Pérez" />
              <Inp label="Teléfono"       value={delivery.phone}   onChange={e=>setDelivery(d=>({...d,phone:e.target.value}))}   placeholder="+57 300…" />
            </div>
            <Inp label="Dirección"        value={delivery.address} onChange={e=>setDelivery(d=>({...d,address:e.target.value}))} placeholder="Cra 5 #10-20…" />
            <Inp label="Valor domicilio"  type="number" value={delivery.value} onChange={e=>setDelivery(d=>({...d,value:e.target.value}))} placeholder="0" />
          </div>

          {/* Preview colapsable en móvil */}
          {isMobile&&(
            <div style={{marginTop:14}}>
              <button onClick={()=>setShowPreview(v=>!v)} style={{width:"100%",padding:"9px",borderRadius:9,border:"1.5px solid #1e293b",background:"#0f172a",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:13}}>
                {showPreview?"▲ Ocultar vista previa":"▼ Ver vista previa de factura"}
              </button>
              {showPreview&&<div style={{marginTop:10}}>{previewPanel}</div>}
            </div>
          )}
        </div>

        {/* Preview solo en desktop */}
        {!isMobile&&(
          <div style={{flexShrink:0}}>
            <div style={{fontSize:11,fontWeight:700,color:"#475569",marginBottom:8}}>
              {type==="salida"?"Vista previa · PDF":"Vista previa"}
            </div>
            {previewPanel}
          </div>
        )}
      </div>

      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16,paddingTop:14,borderTop:"1px solid #f1f5f9",flexWrap:"wrap"}}>
        <button onClick={onClose} style={{padding:"10px 18px",borderRadius:9,border:"1.5px solid #e2e8f0",background:"#f8fafc",cursor:"pointer",fontWeight:600,color:"#64748b",fontSize:14}}>Cancelar</button>
        <button onClick={handleSave} disabled={generating} style={{flex:1,minWidth:180,padding:"11px 18px",borderRadius:9,border:"none",background:generating?"#94a3b8":"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",cursor:generating?"not-allowed":"pointer",fontWeight:700,fontSize:14,boxShadow:generating?"none":"0 4px 14px rgba(99,102,241,0.3)"}}>
          {generating?"⏳ Generando PDF…":type==="salida"?"✅ Confirmar y descargar factura":"✅ Confirmar movimiento"}
        </button>
      </div>
    </Modal>
  );
};

// ── CategoriesTab ─────────────────────────────────────────────────────────────
const CategoriesTab = ({ categories, setCategories, products, setProducts, s }) => {
  const [newCat,setNewCat]=useState(""); const [editIdx,setEditIdx]=useState(null); const [editVal,setEditVal]=useState("");
  const addCat=()=>{ const t=newCat.trim(); if(!t)return; if(categories.includes(t))return alert("Ya existe."); setCategories(c=>[...c,t]); setNewCat(""); };
  const startEdit=(idx)=>{setEditIdx(idx);setEditVal(categories[idx]);};
  const saveEdit=()=>{ const t=editVal.trim(); if(!t)return; if(categories.some((c,i)=>c===t&&i!==editIdx))return alert("Ya existe."); const old=categories[editIdx]; setCategories(c=>c.map((x,i)=>i===editIdx?t:x)); setProducts(ps=>ps.map(p=>p.category===old?{...p,category:t}:p)); setEditIdx(null); };
  const deleteCat=(idx)=>{ const n=categories[idx]; if(products.some(p=>p.category===n))return alert(`No puedes eliminar "${n}" porque tiene productos asignados.`); setCategories(c=>c.filter((_,i)=>i!==idx)); };
  return (
    <>
      <div style={s.header}>
        <h1 style={s.pageTitle}>Categorías</h1>
        <span style={{fontSize:12,color:"#64748b"}}>{categories.length} registradas</span>
      </div>
      <div style={{...s.card,padding:"18px 18px",marginBottom:18}}>
        <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>➕ Nueva categoría</div>
        <div style={{display:"flex",gap:10}}>
          <input value={newCat} onChange={e=>setNewCat(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCat()}
            placeholder="Ej: Bebidas, Papelería…"
            style={{flex:1,padding:"10px 13px",borderRadius:9,border:"1.5px solid #e2e8f0",fontSize:15,color:"#0f172a",outline:"none",background:"#f8fafc"}}/>
          <button onClick={addCat} style={s.btn()}>Agregar</button>
        </div>
      </div>
      <div style={s.card}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px",padding:"8px 16px",background:"#f8fafc",borderBottom:"1px solid #e2e8f0"}}>
          <span style={s.th}>Categoría</span>
          <span style={{...s.th,textAlign:"center"}}>Productos</span>
          <span style={{...s.th,textAlign:"right"}}>Acciones</span>
        </div>
        {categories.length===0&&<div style={{padding:"32px",textAlign:"center",color:"#94a3b8"}}>Sin categorías.</div>}
        {categories.map((cat,idx)=>{
          const count=products.filter(p=>p.category===cat).length;
          return (
            <div key={cat+idx} style={{display:"grid",gridTemplateColumns:"1fr 80px 80px",alignItems:"center",padding:"12px 16px",borderBottom:"1px solid #f1f5f9",gap:8}}>
              {editIdx===idx?(
                <div style={{display:"flex",gap:6,gridColumn:"1/-1"}}>
                  <input value={editVal} onChange={e=>setEditVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")saveEdit();if(e.key==="Escape")setEditIdx(null);}} autoFocus
                    style={{flex:1,padding:"7px 11px",borderRadius:8,border:"1.5px solid #6366f1",fontSize:14,outline:"none",background:"#f8fafc"}}/>
                  <button onClick={saveEdit} style={{padding:"7px 12px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:13}}>✓</button>
                  <button onClick={()=>setEditIdx(null)} style={{padding:"7px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#64748b",cursor:"pointer",fontWeight:600,fontSize:13}}>✕</button>
                </div>
              ):(
                <>
                  <span style={{background:"#eef2ff",color:"#6366f1",padding:"4px 12px",borderRadius:20,fontSize:13,fontWeight:700,display:"inline-block"}}>{cat}</span>
                  <span style={{fontSize:12,color:"#64748b",textAlign:"center"}}>{count}</span>
                  <div style={{display:"flex",gap:2,justifyContent:"flex-end"}}>
                    <button style={s.iconBtn} onClick={()=>startEdit(idx)}>✏️</button>
                    <button style={s.iconBtn} onClick={()=>deleteCat(idx)}>🗑️</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const isMobile = useIsMobile();

  useEffect(() => { lockViewport(); }, []);

  const [products,   setProducts]   = useState(initialProducts);
  const [movements,  setMovements]  = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [tab,        setTab]        = useState("Dashboard");
  const [search,     setSearch]     = useState("");
  const [catFilter,  setCatFilter]  = useState("Todos");
  const [showAdd,    setShowAdd]    = useState(false);
  const [editProd,   setEditProd]   = useState(null);
  const [preProduct, setPreProduct] = useState(null);
  const [showMov,    setShowMov]    = useState(false);
  const [deleteId,   setDeleteId]   = useState(null);

  const totalProducts  = products.length;
  const totalStock     = products.reduce((s,p)=>s+p.stock,0);
  const inventoryValue = products.reduce((s,p)=>s+p.price*p.stock,0);
  const lowStock       = products.filter(p=>p.stock<=LOW_STOCK_THRESHOLD);
  const outOfStock     = products.filter(p=>p.stock===0);

  const filtered = useMemo(()=>
    products.filter(p=>(catFilter==="Todos"||p.category===catFilter)&&(p.name.toLowerCase().includes(search.toLowerCase())||p.sku.toLowerCase().includes(search.toLowerCase())))
  ,[products,search,catFilter]);

  const addProduct    = (d)=>{setProducts(ps=>[...ps,{...d,id:nextId++}]);setShowAdd(false);};
  const updateProduct = (d)=>{setProducts(ps=>ps.map(p=>p.id===editProd.id?{...p,...d}:p));setEditProd(null);};
  const deleteProduct = (id)=>{setProducts(ps=>ps.filter(p=>p.id!==id));setDeleteId(null);};

  const registerMovement = (resolvedLines,type,note,discount,delivery) => {
    const date=new Date().toLocaleString("es-CO");
    resolvedLines.forEach(({product,qty})=>{
      const sa=type==="entrada"?product.stock+qty:type==="salida"?product.stock-qty:qty;
      setProducts(ps=>ps.map(p=>p.id===product.id?{...p,stock:sa}:p));
      setMovements(ms=>[{id:Date.now()+Math.random(),productId:product.id,productName:product.name,sku:product.sku,type,qty,note,stockAfter:sa,discount:Number(discount)||0,date},...ms]);
    });
    if(delivery?.name){
      const sub=resolvedLines.reduce((s,r)=>s+r.product.price*r.qty,0);
      setDeliveries(ds=>[{id:deliveryId++,date,name:delivery.name,address:delivery.address,phone:delivery.phone,value:Number(delivery.value)||0,orderValue:sub,discount:Number(discount)||0,products:resolvedLines.map(r=>`${r.product.name} x${r.qty}`)},...ds]);
    }
    setPreProduct(null); setShowMov(false);
  };

  const stockColor=(s)=>s===0?"red":s<=LOW_STOCK_THRESHOLD?"yellow":"green";

  // ── Estilos ─────────────────────────────────────────────────────────────────
  const SIDEBAR_W = 200;
  const s = {
    app:      {minHeight:"100vh",background:"#f1f5f9",fontFamily:"'Segoe UI',sans-serif",color:"#0f172a"},
    sidebar:  {width:SIDEBAR_W,background:"#0f172a",minHeight:"100vh",padding:"24px 0",position:"fixed",top:0,left:0,display:"flex",flexDirection:"column",zIndex:100},
    logoText: {fontSize:18,fontWeight:900,color:"#fff",letterSpacing:-0.5},
    logoSub:  {fontSize:10,color:"#64748b",fontWeight:500,marginTop:2},
    nav:      {padding:"14px 10px",flex:1},
    navItem:  (a)=>({display:"flex",alignItems:"center",gap:9,padding:"10px 12px",borderRadius:10,cursor:"pointer",marginBottom:3,background:a?"linear-gradient(135deg,#6366f1,#8b5cf6)":"transparent",color:a?"#fff":"#94a3b8",fontWeight:a?700:500,fontSize:13,border:"none",width:"100%",textAlign:"left"}),
    // Mobile bottom nav
    bottomNav:{position:"fixed",bottom:0,left:0,right:0,background:"#0f172a",zIndex:100,display:"flex",borderTop:"1px solid #1e293b",paddingBottom:"env(safe-area-inset-bottom,0px)"},
    bottomItem:(a)=>({flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"8px 4px 6px",border:"none",background:"transparent",cursor:"pointer",color:a?"#818cf8":"#64748b",fontSize:9,fontWeight:a?700:500,gap:2,minWidth:0}),
    main:     isMobile?{padding:"14px 12px 80px",minHeight:"100vh"}:{marginLeft:SIDEBAR_W,padding:"28px 30px",minHeight:"100vh"},
    header:   {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10},
    pageTitle:{fontSize:isMobile?20:24,fontWeight:900,color:"#0f172a",margin:0},
    kpiGrid:  {display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:12,marginBottom:20},
    kpiCard:  (c)=>({background:"#fff",borderRadius:14,padding:isMobile?"14px 16px":"18px 20px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",borderLeft:`4px solid ${c}`}),
    kpiVal:   {fontSize:isMobile?20:26,fontWeight:900,color:"#0f172a",lineHeight:1.1,marginBottom:3},
    kpiLabel: {fontSize:isMobile?10:12,color:"#64748b",fontWeight:500},
    card:     {background:"#fff",borderRadius:14,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",overflow:"hidden"},
    tRow:     {display:"grid",alignItems:"center",padding:isMobile?"11px 14px":"12px 18px",borderBottom:"1px solid #f1f5f9"},
    th:       {fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.6},
    btn:      (v="primary")=>({padding:"10px 18px",borderRadius:9,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,background:v==="primary"?"linear-gradient(135deg,#6366f1,#8b5cf6)":v==="danger"?"#fee2e2":"#f1f5f9",color:v==="primary"?"#fff":v==="danger"?"#b91c1c":"#334155",boxShadow:v==="primary"?"0 4px 14px rgba(99,102,241,0.25)":"none"}),
    iconBtn:  {background:"none",border:"none",cursor:"pointer",padding:"6px 7px",borderRadius:8,fontSize:16},
    toolbar:  {display:"flex",gap:8,alignItems:"center",marginBottom:16,flexWrap:"wrap"},
    searchInp:{flex:1,minWidth:160,padding:"9px 14px 9px 36px",borderRadius:9,border:"1.5px solid #e2e8f0",fontSize:14,outline:"none",background:"#f8fafc",color:"#0f172a"},
  };

  const navIcon=(t)=>({Dashboard:"📊",Inventario:"📦",Movimientos:"🔄",Domicilios:"🛵",Alertas:"🔔","Categorías":"🏷️"}[t]);

  // Tarjeta compacta para móvil en Inventario
  const MobileProductCard = ({p}) => (
    <div style={{background:"#fff",borderRadius:12,padding:"14px",marginBottom:10,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:14,color:"#0f172a",marginBottom:2}}>{p.name}</div>
          <div style={{fontSize:11,color:"#6366f1",fontWeight:600,fontFamily:"monospace"}}>{p.sku}</div>
        </div>
        <Badge color={stockColor(p.stock)}>{p.stock} {p.unit}</Badge>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
        <Badge color="blue">{p.category}</Badge>
        <span style={{fontSize:12,color:"#334155",fontWeight:600}}>{formatCOP(p.price)}</span>
      </div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>{setPreProduct(p);setShowMov(true);}} style={{flex:1,padding:"8px",borderRadius:8,border:"1.5px solid #c7d2fe",background:"#eef2ff",color:"#6366f1",cursor:"pointer",fontWeight:700,fontSize:12}}>🔄 Movimiento</button>
        <button onClick={()=>setEditProd(p)} style={{padding:"8px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#334155",cursor:"pointer",fontSize:14}}>✏️</button>
        <button onClick={()=>setDeleteId(p.id)} style={{padding:"8px 12px",borderRadius:8,border:"1.5px solid #fee2e2",background:"#fff5f5",color:"#b91c1c",cursor:"pointer",fontSize:14}}>🗑️</button>
      </div>
    </div>
  );

  // Tarjeta compacta para móvil en Movimientos
  const MobileMovCard = ({m}) => {
    const prod=products.find(p=>p.id===m.productId);
    return (
      <div style={{background:"#fff",borderRadius:12,padding:"12px 14px",marginBottom:8,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <span style={{fontWeight:700,fontSize:13,color:"#0f172a"}}>{m.productName}</span>
          <Badge color={m.type==="entrada"?"green":m.type==="salida"?"red":"blue"}>
            {m.type==="entrada"?"📥":m.type==="salida"?"📤":"🔄"} {m.type}
          </Badge>
        </div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",fontSize:12,color:"#64748b"}}>
          <span>Cant: <strong style={{color:m.type==="entrada"?"#15803d":m.type==="salida"?"#b91c1c":"#1d4ed8"}}>{m.type==="entrada"?"+":m.type==="salida"?"-":"="}{m.qty}</strong></span>
          {prod&&<span>Total: <strong style={{color:"#0f172a"}}>{formatCOP(prod.price*m.qty)}</strong></span>}
          {m.note&&<span>{m.note}</span>}
        </div>
        <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>{m.date}</div>
      </div>
    );
  };

  // Tarjeta domicilio móvil
  const MobileDeliveryCard = ({d}) => (
    <div style={{background:"#fff",borderRadius:12,padding:"12px 14px",marginBottom:8,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
        <div>
          <div style={{fontWeight:700,fontSize:14}}>{d.name}</div>
          {d.phone&&<div style={{fontSize:11,color:"#64748b"}}>{d.phone}</div>}
          {d.address&&<div style={{fontSize:11,color:"#64748b"}}>📍 {d.address}</div>}
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontWeight:700,fontSize:14,color:"#6366f1"}}>{formatCOP(d.value)}</div>
          <div style={{fontSize:10,color:"#94a3b8"}}>domicilio</div>
        </div>
      </div>
      <div style={{display:"flex",gap:10,fontSize:12,color:"#64748b",flexWrap:"wrap"}}>
        <span>Pedido: <strong style={{color:"#0f172a"}}>{formatCOP(d.orderValue)}</strong></span>
        {d.discount>0&&<span>Desc: <strong style={{color:"#b91c1c"}}>-{formatCOP(d.discount)}</strong></span>}
      </div>
      <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>{d.date}</div>
    </div>
  );

  return (
    <div style={s.app}>
      {/* ── SIDEBAR (solo desktop) ── */}
      {!isMobile&&(
        <aside style={s.sidebar}>
          <div style={{padding:"0 20px 22px",borderBottom:"1px solid #1e293b"}}>
            <div style={s.logoText}>📦 InvenPro</div>
            <div style={s.logoSub}>Control de inventario</div>
          </div>
          <nav style={s.nav}>
            {TABS.map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={s.navItem(tab===t)}>
                {navIcon(t)}{" "}{t}
                {t==="Alertas"&&lowStock.length>0&&<span style={{marginLeft:"auto",background:"#ef4444",color:"#fff",borderRadius:20,padding:"1px 6px",fontSize:10,fontWeight:800}}>{lowStock.length}</span>}
              </button>
            ))}
          </nav>
          <div style={{padding:"0 14px 16px",fontSize:10,color:"#334155",textAlign:"center"}}>{products.length} productos</div>
        </aside>
      )}

      {/* ── MAIN ── */}
      <main style={s.main}>

        {/* Header móvil */}
        {isMobile&&(
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div>
              <div style={{fontSize:16,fontWeight:900,color:"#0f172a"}}>📦 InvenPro</div>
              <div style={{fontSize:10,color:"#64748b"}}>{tab}</div>
            </div>
            {(tab==="Dashboard"||tab==="Movimientos")&&(
              <button style={s.btn()} onClick={()=>setShowMov(true)}>🔄 Movimiento</button>
            )}
            {tab==="Inventario"&&(
              <button style={s.btn()} onClick={()=>setShowAdd(true)}>+ Agregar</button>
            )}
          </div>
        )}

        {/* ─── DASHBOARD ─── */}
        {tab==="Dashboard"&&(
          <>
            {!isMobile&&(
              <div style={s.header}>
                <h1 style={s.pageTitle}>Dashboard</h1>
                <button style={s.btn()} onClick={()=>setShowMov(true)}>🔄 Registrar movimiento</button>
              </div>
            )}
            <div style={s.kpiGrid}>
              {[
                {label:"Productos",val:totalProducts,color:"#6366f1",icon:"📦"},
                {label:"En stock",val:totalStock,color:"#10b981",icon:"🏷️"},
                {label:"Valor inventario",val:formatCOP(inventoryValue),color:"#f59e0b",icon:"💰"},
                {label:"Stock bajo",val:lowStock.length,color:"#ef4444",icon:"🔔"},
              ].map(k=>(
                <div key={k.label} style={s.kpiCard(k.color)}>
                  <div style={{fontSize:20,marginBottom:6}}>{k.icon}</div>
                  <div style={s.kpiVal}>{k.val}</div>
                  <div style={s.kpiLabel}>{k.label}</div>
                </div>
              ))}
            </div>

            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:16}}>
              <div style={s.card}>
                <div style={{padding:"14px 16px 10px",fontWeight:800,fontSize:13}}>Productos por categoría</div>
                <div style={{padding:"0 16px 14px"}}>
                  {categories.map(cat=>{
                    const count=products.filter(p=>p.category===cat).length;
                    const pct=totalProducts?(count/totalProducts)*100:0;
                    return (
                      <div key={cat} style={{marginBottom:11}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                          <span style={{fontWeight:600}}>{cat}</span>
                          <span style={{color:"#64748b"}}>{count}</span>
                        </div>
                        <div style={{height:6,background:"#f1f5f9",borderRadius:10}}>
                          <div style={{width:`${pct}%`,height:"100%",background:"linear-gradient(90deg,#6366f1,#8b5cf6)",borderRadius:10}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={s.card}>
                <div style={{padding:"14px 16px 10px",fontWeight:800,fontSize:13,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>Stock bajo</span>
                  {lowStock.length>0&&<Badge color="red">{lowStock.length}</Badge>}
                </div>
                {lowStock.length===0
                  ?<div style={{padding:"14px 16px",color:"#64748b",fontSize:12}}>✅ Todo OK</div>
                  :lowStock.map(p=>(
                    <div key={p.id} style={{padding:"10px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div><div style={{fontWeight:600,fontSize:12}}>{p.name}</div><div style={{fontSize:10,color:"#94a3b8"}}>{p.sku}</div></div>
                      <Badge color={p.stock===0?"red":"yellow"}>{p.stock===0?"Agotado":`${p.stock} ${p.unit}`}</Badge>
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Movimientos recientes */}
            <div style={s.card}>
              <div style={{padding:"14px 16px 10px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #f1f5f9"}}>
                <span style={{fontWeight:800,fontSize:13}}>Movimientos recientes</span>
                {movements.length>0&&<button onClick={()=>setTab("Movimientos")} style={{fontSize:11,color:"#6366f1",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Ver todos →</button>}
              </div>
              {movements.length===0
                ?<div style={{padding:"28px 16px",textAlign:"center",color:"#94a3b8",fontSize:12}}><div style={{fontSize:28,marginBottom:6}}>📋</div>Sin movimientos aún.</div>
                :isMobile
                  ?<div style={{padding:"10px 12px"}}>{movements.slice(0,5).map(m=><MobileMovCard key={m.id} m={m}/>)}</div>
                  :(
                    <>
                      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 0.7fr 1.2fr 1.8fr 1.2fr",padding:"8px 18px",background:"#f8fafc",borderBottom:"1px solid #e2e8f0"}}>
                        {["Producto","SKU","Tipo","Cant.","Valor","Nota","Fecha"].map(h=><span key={h} style={s.th}>{h}</span>)}
                      </div>
                      {movements.slice(0,8).map(m=>{
                        const prod=products.find(p=>p.id===m.productId);
                        return (
                          <div key={m.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 0.7fr 1.2fr 1.8fr 1.2fr",padding:"11px 18px",borderBottom:"1px solid #f1f5f9",alignItems:"center"}}>
                            <span style={{fontWeight:600,fontSize:12}}>{m.productName}</span>
                            <span style={{fontFamily:"monospace",fontSize:11,color:"#6366f1",fontWeight:700}}>{m.sku}</span>
                            <Badge color={m.type==="entrada"?"green":m.type==="salida"?"red":"blue"}>{m.type==="entrada"?"📥":m.type==="salida"?"📤":"🔄"} {m.type}</Badge>
                            <span style={{fontWeight:800,fontSize:13,color:m.type==="entrada"?"#15803d":m.type==="salida"?"#b91c1c":"#1d4ed8"}}>{m.type==="entrada"?"+":m.type==="salida"?"-":"="}{m.qty}</span>
                            <span style={{fontSize:12,fontWeight:700}}>{prod?formatCOP(prod.price*m.qty):"—"}</span>
                            <span style={{fontSize:11,color:"#64748b"}}>{m.note||"—"}</span>
                            <span style={{fontSize:10,color:"#94a3b8"}}>{m.date}</span>
                          </div>
                        );
                      })}
                    </>
                  )
              }
            </div>
          </>
        )}

        {/* ─── INVENTARIO ─── */}
        {tab==="Inventario"&&(
          <>
            {!isMobile&&(
              <div style={s.header}>
                <h1 style={s.pageTitle}>Inventario</h1>
                <button style={s.btn()} onClick={()=>setShowAdd(true)}>+ Agregar producto</button>
              </div>
            )}
            <div style={s.toolbar}>
              <div style={{position:"relative",flex:1,minWidth:140}}>
                <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#94a3b8",fontSize:14}}>🔍</span>
                <input style={s.searchInp} placeholder="Buscar…" value={search} onChange={e=>setSearch(e.target.value)}/>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {["Todos",...categories].map(c=>(
                  <button key={c} onClick={()=>setCatFilter(c)} style={{padding:"7px 12px",borderRadius:8,border:catFilter===c?"2px solid #6366f1":"1.5px solid #e2e8f0",background:catFilter===c?"#eef2ff":"#fff",color:catFilter===c?"#6366f1":"#64748b",cursor:"pointer",fontSize:12,fontWeight:catFilter===c?700:500}}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Móvil: tarjetas */}
            {isMobile?(
              <div>
                {filtered.length===0?<div style={{padding:"32px",textAlign:"center",color:"#94a3b8"}}>Sin productos</div>:filtered.map(p=><MobileProductCard key={p.id} p={p}/>)}
              </div>
            ):(
              <div style={s.card}>
                <div style={{...s.tRow,gridTemplateColumns:"2fr 1.1fr 1.1fr 1fr 1fr 1fr 1.4fr",borderBottom:"1px solid #e2e8f0",background:"#f8fafc"}}>
                  {["Producto","SKU","Categoría","Precio","Costo","Stock","Acciones"].map(h=><span key={h} style={s.th}>{h}</span>)}
                </div>
                {filtered.length===0?<div style={{padding:"32px",textAlign:"center",color:"#94a3b8"}}>Sin productos</div>:filtered.map(p=>(
                  <div key={p.id} style={{...s.tRow,gridTemplateColumns:"2fr 1.1fr 1.1fr 1fr 1fr 1fr 1.4fr"}}>
                    <div><div style={{fontWeight:700,fontSize:13}}>{p.name}</div><div style={{fontSize:10,color:"#94a3b8"}}>{p.description}</div></div>
                    <span style={{fontFamily:"monospace",fontWeight:600,color:"#6366f1",fontSize:11}}>{p.sku}</span>
                    <Badge color="blue">{p.category}</Badge>
                    <span style={{fontSize:12}}>{formatCOP(p.price)}</span>
                    <span style={{fontSize:12,color:"#64748b"}}>{p.cost?formatCOP(p.cost):"—"}</span>
                    <Badge color={stockColor(p.stock)}>{p.stock} {p.unit}</Badge>
                    <div style={{display:"flex",gap:2}}>
                      <button title="Movimiento" style={s.iconBtn} onClick={()=>{setPreProduct(p);setShowMov(true);}}>🔄</button>
                      <button title="Editar" style={s.iconBtn} onClick={()=>setEditProd(p)}>✏️</button>
                      <button title="Eliminar" style={s.iconBtn} onClick={()=>setDeleteId(p.id)}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{marginTop:8,fontSize:11,color:"#94a3b8"}}>{filtered.length} de {products.length} productos</div>
          </>
        )}

        {/* ─── MOVIMIENTOS ─── */}
        {tab==="Movimientos"&&(
          <>
            {!isMobile&&(
              <div style={s.header}>
                <h1 style={s.pageTitle}>Movimientos</h1>
                <button style={s.btn()} onClick={()=>setShowMov(true)}>🔄 Registrar movimiento</button>
              </div>
            )}
            {movements.length===0
              ?<div style={{...s.card,padding:"48px",textAlign:"center",color:"#94a3b8"}}><div style={{fontSize:32,marginBottom:8}}>📋</div>Sin movimientos.</div>
              :isMobile
                ?<div>{movements.map(m=><MobileMovCard key={m.id} m={m}/>)}</div>
                :(
                  <div style={s.card}>
                    <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr 1fr 0.7fr 1fr 1.4fr 1fr",padding:"8px 18px",background:"#f8fafc",borderBottom:"1px solid #e2e8f0"}}>
                      {["Producto","SKU","Tipo","Cant.","Valor","Nota","Fecha"].map(h=><span key={h} style={s.th}>{h}</span>)}
                    </div>
                    {movements.map(m=>{
                      const prod=products.find(p=>p.id===m.productId);
                      return (
                        <div key={m.id} style={{display:"grid",gridTemplateColumns:"1.4fr 1fr 1fr 0.7fr 1fr 1.4fr 1fr",padding:"11px 18px",borderBottom:"1px solid #f1f5f9",alignItems:"center"}}>
                          <span style={{fontWeight:600,fontSize:12}}>{m.productName}</span>
                          <span style={{fontFamily:"monospace",fontSize:11,color:"#6366f1",fontWeight:600}}>{m.sku}</span>
                          <Badge color={m.type==="entrada"?"green":m.type==="salida"?"red":"blue"}>{m.type==="entrada"?"📥 Entrada":m.type==="salida"?"📤 Salida":"🔄 Ajuste"}</Badge>
                          <span style={{fontWeight:700,fontSize:13}}>{m.type==="entrada"?"+":m.type==="salida"?"-":"="}{m.qty}</span>
                          <span style={{fontWeight:700,fontSize:12}}>{prod?formatCOP(prod.price*m.qty):"—"}</span>
                          <span style={{fontSize:11,color:"#64748b"}}>{m.note||"—"}</span>
                          <span style={{fontSize:10,color:"#94a3b8"}}>{m.date}</span>
                        </div>
                      );
                    })}
                  </div>
                )
            }
          </>
        )}

        {/* ─── DOMICILIOS ─── */}
        {tab==="Domicilios"&&(
          <>
            {!isMobile&&<div style={s.header}><h1 style={s.pageTitle}>Domicilios</h1></div>}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:12,marginBottom:16}}>
              {[
                {label:"Total domicilios",val:deliveries.length,color:"#6366f1",icon:"🛵"},
                {label:"Valor domicilios",val:formatCOP(deliveries.reduce((s,d)=>s+d.value,0)),color:"#10b981",icon:"💵"},
                {label:"Valor pedidos",val:formatCOP(deliveries.reduce((s,d)=>s+d.orderValue,0)),color:"#f59e0b",icon:"🛒"},
              ].map(k=>(
                <div key={k.label} style={s.kpiCard(k.color)}>
                  <div style={{fontSize:18,marginBottom:5}}>{k.icon}</div>
                  <div style={s.kpiVal}>{k.val}</div>
                  <div style={s.kpiLabel}>{k.label}</div>
                </div>
              ))}
            </div>
            {deliveries.length===0
              ?<div style={{...s.card,padding:"44px",textAlign:"center",color:"#94a3b8"}}><div style={{fontSize:32,marginBottom:8}}>🛵</div>Sin domicilios.<br/><span style={{fontSize:11}}>Llena el campo Domicilio al registrar un movimiento.</span></div>
              :isMobile
                ?<div>{deliveries.map(d=><MobileDeliveryCard key={d.id} d={d}/>)}</div>
                :(
                  <div style={s.card}>
                    <div style={{display:"grid",gridTemplateColumns:"1.4fr 0.9fr 1fr 1fr 1fr 1.4fr 0.9fr",padding:"8px 18px",background:"#f8fafc",borderBottom:"1px solid #e2e8f0"}}>
                      {["Cliente","Teléfono","V.Pedido","V.Domicilio","Descuento","Productos","Fecha"].map(h=><span key={h} style={s.th}>{h}</span>)}
                    </div>
                    {deliveries.map(d=>(
                      <div key={d.id} style={{display:"grid",gridTemplateColumns:"1.4fr 0.9fr 1fr 1fr 1fr 1.4fr 0.9fr",padding:"11px 18px",borderBottom:"1px solid #f1f5f9",alignItems:"start"}}>
                        <div><div style={{fontWeight:700,fontSize:12}}>{d.name}</div>{d.address&&<div style={{fontSize:10,color:"#64748b"}}>📍 {d.address}</div>}</div>
                        <span style={{fontSize:11,color:"#475569"}}>{d.phone||"—"}</span>
                        <span style={{fontWeight:700,fontSize:11}}>{formatCOP(d.orderValue)}</span>
                        <span style={{fontWeight:700,fontSize:11,color:"#6366f1"}}>{formatCOP(d.value)}</span>
                        <span style={{fontSize:11,color:d.discount>0?"#b91c1c":"#94a3b8"}}>{d.discount>0?`-${formatCOP(d.discount)}`:"—"}</span>
                        <div style={{fontSize:10,color:"#64748b"}}>{d.products.join(", ")}</div>
                        <span style={{fontSize:9,color:"#94a3b8"}}>{d.date}</span>
                      </div>
                    ))}
                  </div>
                )
            }
          </>
        )}

        {/* ─── ALERTAS ─── */}
        {tab==="Alertas"&&(
          <>
            {!isMobile&&<div style={s.header}><h1 style={s.pageTitle}>Alertas de Stock</h1></div>}
            {outOfStock.length>0&&(
              <div style={{marginBottom:18}}>
                <h3 style={{fontWeight:800,color:"#b91c1c",marginBottom:10,fontSize:14}}>🚨 Agotados</h3>
                <div style={s.card}>
                  {outOfStock.map(p=>(
                    <div key={p.id} style={{...s.tRow,gridTemplateColumns:isMobile?"1fr auto":"2fr 1fr 1fr 1fr",borderBottom:"1px solid #fee2e2",gap:8}}>
                      <div><div style={{fontWeight:700,fontSize:13}}>{p.name}</div><div style={{fontSize:10,color:"#94a3b8"}}>{p.sku}</div></div>
                      {!isMobile&&<><Badge color="gray">{p.category}</Badge><Badge color="red">Agotado</Badge></>}
                      <button style={{...s.btn(),padding:"7px 12px",fontSize:12}} onClick={()=>{setPreProduct(p);setShowMov(true);}}>Reponer</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {lowStock.filter(p=>p.stock>0).length>0&&(
              <div>
                <h3 style={{fontWeight:800,color:"#a16207",marginBottom:10,fontSize:14}}>⚠️ Stock bajo (≤{LOW_STOCK_THRESHOLD})</h3>
                <div style={s.card}>
                  {lowStock.filter(p=>p.stock>0).map(p=>(
                    <div key={p.id} style={{...s.tRow,gridTemplateColumns:isMobile?"1fr auto":"2fr 1fr 1fr 1fr",borderBottom:"1px solid #fef9c3",gap:8}}>
                      <div><div style={{fontWeight:700,fontSize:13}}>{p.name}</div><div style={{fontSize:10,color:"#94a3b8"}}>{p.sku}</div></div>
                      {!isMobile&&<><Badge color="gray">{p.category}</Badge><Badge color="yellow">{p.stock} {p.unit}</Badge></>}
                      <button style={{...s.btn(),padding:"7px 12px",fontSize:12}} onClick={()=>{setPreProduct(p);setShowMov(true);}}>Reponer</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {lowStock.length===0&&(
              <div style={{...s.card,padding:"44px",textAlign:"center",color:"#94a3b8"}}>
                <div style={{fontSize:32,marginBottom:8}}>✅</div>
                <div>¡Todo el inventario está bien!</div>
              </div>
            )}
          </>
        )}

        {/* ─── CATEGORÍAS ─── */}
        {tab==="Categorías"&&(
          <CategoriesTab categories={categories} setCategories={setCategories} products={products} setProducts={setProducts} s={s}/>
        )}
      </main>

      {/* ── BOTTOM NAV (solo móvil) ── */}
      {isMobile&&(
        <nav style={s.bottomNav}>
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={s.bottomItem(tab===t)}>
              <span style={{fontSize:18,position:"relative"}}>
                {navIcon(t)}
                {t==="Alertas"&&lowStock.length>0&&<span style={{position:"absolute",top:-4,right:-6,background:"#ef4444",color:"#fff",borderRadius:20,fontSize:8,fontWeight:800,padding:"0 4px",lineHeight:"14px"}}>{lowStock.length}</span>}
              </span>
              <span style={{fontSize:9,lineHeight:1}}>{t}</span>
            </button>
          ))}
        </nav>
      )}

      {/* ── MODALS ── */}
      {showAdd  &&<Modal title="Agregar producto" onClose={()=>setShowAdd(false)}><ProductForm categories={categories} onSave={addProduct} onClose={()=>setShowAdd(false)}/></Modal>}
      {editProd &&<Modal title="Editar producto"  onClose={()=>setEditProd(null)}><ProductForm categories={categories} initial={editProd} onSave={updateProduct} onClose={()=>setEditProd(null)}/></Modal>}
      {showMov&&<MovementModal preProduct={preProduct} allProducts={products} onClose={()=>{setShowMov(false);setPreProduct(null);}} onSave={registerMovement}/>}
      {deleteId&&(
        <Modal title="Eliminar producto" onClose={()=>setDeleteId(null)}>
          <p style={{color:"#475569",marginBottom:20}}>¿Seguro que deseas eliminar este producto?</p>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button onClick={()=>setDeleteId(null)} style={s.btn("secondary")}>Cancelar</button>
            <button onClick={()=>deleteProduct(deleteId)} style={s.btn("danger")}>Sí, eliminar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

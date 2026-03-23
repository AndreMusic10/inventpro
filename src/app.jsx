import { useState, useMemo } from "react";

const CATEGORIES = ["Todos", "Electrónica", "Ropa", "Alimentos", "Hogar", "Otro"];
const LOW_STOCK_THRESHOLD = 5;
const TABS = ["Dashboard", "Inventario", "Movimientos", "Domicilios", "Alertas"];

const initialProducts = [
  { id: 1, name: "Audífonos Bluetooth", sku: "ELEC-001", category: "Electrónica", price: 350000, cost: 180000, stock: 12, unit: "und", description: "Audífonos inalámbricos con cancelación de ruido" },
  { id: 2, name: "Camiseta Básica",     sku: "ROPA-001", category: "Ropa",        price: 45000,  cost: 18000,  stock: 3,  unit: "und", description: "Camiseta 100% algodón talla M" },
  { id: 3, name: "Arroz Premium 5kg",   sku: "ALIM-001", category: "Alimentos",   price: 28000,  cost: 20000,  stock: 30, unit: "kg",  description: "Arroz de grano largo premium" },
  { id: 4, name: "Lámpara LED",         sku: "HOG-001",  category: "Hogar",       price: 65000,  cost: 32000,  stock: 2,  unit: "und", description: "Lámpara de escritorio LED regulable" },
];

let nextId       = 5;
let invoiceCounter = 1;
let deliveryId   = 1;

const formatCOP = (val) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(val || 0);

// ── jsPDF loader ──────────────────────────────────────────────────────────────
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

// ── PDF: genera factura con múltiples items ───────────────────────────────────
// items = [{ product, qty }]
// opts  = { type, note, discount, delivery }
const generateInvoicePDF = async (items, opts) => {
  const JsPDF    = await loadJsPDF();
  const doc      = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, M = 18;
  const invoiceNum = String(invoiceCounter++).padStart(5, "0");
  const date       = new Date().toLocaleString("es-CO");

  const PURPLE = [99,  102, 241];
  const DARK   = [15,  23,  42 ];
  const GRAY   = [100, 116, 139];
  const LIGHT  = [241, 245, 249];
  const WHITE  = [255, 255, 255];
  const GREEN  = [16,  185, 129];
  const RED    = [239, 68,  68 ];

  const typeColor = opts.type === "entrada" ? GREEN : opts.type === "salida" ? RED : PURPLE;

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 44, "F");
  doc.setFillColor(...typeColor);
  doc.rect(0, 0, 5, 44, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(...WHITE);
  doc.text("FACTURA", M + 4, 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text(`N\u00B0 ${invoiceNum}`, W - M, 18, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(180, 190, 210);
  doc.text(`Fecha: ${date}`, W - M, 27, { align: "right" });

  // ── Info superior (tipo + nota) ──────────────────────────────────────────────
  let y = 54;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GRAY);
  doc.text("TIPO", M, y);
  doc.text("REFERENCIA / NOTA", M + 35, y);

  // Datos domicilio si aplica
  if (opts.delivery && opts.delivery.name) {
    doc.text("DATOS DOMICILIO", W / 2 + 5, y);
  }

  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...typeColor);
  doc.text(opts.type === "entrada" ? "Entrada" : opts.type === "salida" ? "Salida" : "Ajuste", M, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(opts.note || "Sin referencia", M + 35, y);

  if (opts.delivery && opts.delivery.name) {
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    const dl = opts.delivery;
    doc.text(`${dl.name}`, W / 2 + 5, y);
    if (dl.address) doc.text(`Dir: ${dl.address}`, W / 2 + 5, y + 5);
    if (dl.phone)   doc.text(`Tel: ${dl.phone}`,   W / 2 + 5, y + 10);
    if (dl.value)   { doc.setTextColor(...typeColor); doc.setFont("helvetica","bold"); doc.text(`Domicilio: ${formatCOP(dl.value)}`, W / 2 + 5, y + 15); }
  }

  // ── Separador ────────────────────────────────────────────────────────────────
  y += 16;
  doc.setDrawColor(...LIGHT);
  doc.setLineWidth(0.5);
  doc.line(M, y, W - M, y);

  // ── Encabezado tabla ─────────────────────────────────────────────────────────
  y += 7;
  doc.setFillColor(...DARK);
  doc.roundedRect(M, y, W - M * 2, 10, 2, 2, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);

  const C = { num: M + 3, name: M + 9, sku: M + 68, qty: M + 104, unit: M + 119, vUnit: M + 134, vTot: W - M - 2 };
  doc.text("#",           C.num,  y + 7);
  doc.text("PRODUCTO",    C.name, y + 7);
  doc.text("SKU",         C.sku,  y + 7);
  doc.text("CANT.",       C.qty,  y + 7);
  doc.text("UNID.",       C.unit, y + 7);
  doc.text("V. UNITARIO", C.vUnit,y + 7);
  doc.text("V. TOTAL",    C.vTot, y + 7, { align: "right" });
  y += 10;

  // ── Filas de productos ───────────────────────────────────────────────────────
  let subtotal = 0;
  items.forEach(({ product, qty }, idx) => {
    const vt = product.price * qty;
    subtotal += vt;
    const shade = idx % 2 === 0 ? LIGHT : [248, 250, 252];
    doc.setFillColor(...shade);
    doc.rect(M, y, W - M * 2, 12, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    doc.text(String(idx + 1),     C.num,  y + 8);
    doc.text(product.name,        C.name, y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(product.sku,         C.sku,  y + 8);
    doc.setTextColor(...DARK);
    doc.text(String(qty),         C.qty,  y + 8);
    doc.text(product.unit,        C.unit, y + 8);
    doc.text(formatCOP(product.price), C.vUnit, y + 8);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...typeColor);
    doc.text(formatCOP(vt),       C.vTot, y + 8, { align: "right" });
    y += 12;

    // Descripción del producto
    if (product.description) {
      doc.setFillColor(250, 250, 253);
      doc.rect(M, y, W - M * 2, 7, "F");
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(...GRAY);
      doc.text(`   ${product.description}`, C.name, y + 5);
      y += 7;
    }
  });

  // Línea cierre
  doc.setDrawColor(...LIGHT);
  doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);

  // ── Bloque de totales ────────────────────────────────────────────────────────
  y += 10;
  const bx  = W / 2 + 10;
  const bw  = W - M - bx;
  const discount     = Number(opts.discount) || 0;
  const deliveryVal  = (opts.delivery && Number(opts.delivery.value)) || 0;
  const grandTotal   = subtotal - discount + deliveryVal;

  const rowTot = (label, val, bold = false, color = DARK) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(label, bx, y);
    doc.setTextColor(...color);
    doc.text(formatCOP(val), W - M, y, { align: "right" });
    y += 6;
  };

  rowTot("Subtotal:", subtotal);
  if (discount > 0) rowTot("Descuento:", -discount, false, RED);
  if (deliveryVal > 0) rowTot("Domicilio:", deliveryVal);

  // Línea
  doc.setDrawColor(...typeColor);
  doc.setLineWidth(0.7);
  doc.line(bx, y, W - M, y);
  y += 3;

  // Caja total
  doc.setFillColor(...typeColor);
  doc.roundedRect(bx, y, bw, 14, 2, 2, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("VALOR TOTAL:", bx + 3, y + 9);
  doc.setFontSize(12);
  doc.text(formatCOP(grandTotal), W - M - 3, y + 9, { align: "right" });

  // ── Pie de página ─────────────────────────────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 277, W, 20, "F");
  doc.setFillColor(...typeColor);
  doc.rect(0, 277, 5, 20, "F");
  doc.setTextColor(180, 190, 210);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`InvenPro  \u00B7  Factura N\u00B0 ${invoiceNum}  \u00B7  ${date}`, W / 2, 289, { align: "center" });

  doc.save(`Factura-${invoiceNum}.pdf`);
};

// ── UI helpers ────────────────────────────────────────────────────────────────
const Badge = ({ children, color }) => {
  const C = { green: ["#dcfce7","#15803d"], red: ["#fee2e2","#b91c1c"], yellow: ["#fef9c3","#a16207"], blue: ["#dbeafe","#1d4ed8"], gray: ["#f3f4f6","#374151"] };
  const [bg, text] = C[color] || C.gray;
  return <span style={{ background: bg, color: text, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}>{children}</span>;
};

const Modal = ({ title, onClose, children, maxWidth = 520 }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)", overflowY: "auto", padding: "20px 0" }}>
    <div style={{ background: "#fff", borderRadius: 18, padding: "30px 34px", width: "100%", maxWidth, boxShadow: "0 24px 80px rgba(0,0,0,0.2)", margin: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#0f172a" }}>{title}</h2>
        <button onClick={onClose} style={{ background: "#f1f5f9", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 18, color: "#64748b" }}>×</button>
      </div>
      {children}
    </div>
  </div>
);

const Inp = ({ label, ...p }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 5 }}>{label}</label>}
    <input {...p} style={{ width: "100%", padding: "9px 13px", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 14, color: "#0f172a", outline: "none", boxSizing: "border-box", background: "#f8fafc", ...p.style }} />
  </div>
);

const Sel = ({ label, options, ...p }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 5 }}>{label}</label>}
    <select {...p} style={{ width: "100%", padding: "9px 13px", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 14, color: "#0f172a", background: "#f8fafc", outline: "none", boxSizing: "border-box" }}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

// ── ProductForm ───────────────────────────────────────────────────────────────
const ProductForm = ({ initial, onSave, onClose }) => {
  const [f, setF] = useState(initial || { name: "", sku: "", category: "Otro", price: "", cost: "", stock: "", unit: "und", description: "" });
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
        <Inp label="Nombre *"        value={f.name}     onChange={e => set("name", e.target.value)}     placeholder="Producto" />
        <Inp label="SKU / Código *"  value={f.sku}      onChange={e => set("sku",  e.target.value)}     placeholder="SKU-001" />
        <Sel label="Categoría"       value={f.category} onChange={e => set("category", e.target.value)} options={CATEGORIES.filter(c => c !== "Todos")} />
        <Inp label="Unidad"          value={f.unit}     onChange={e => set("unit", e.target.value)}     placeholder="und, kg…" />
        <Inp label="Precio venta *"  type="number"      value={f.price}   onChange={e => set("price",  e.target.value)} placeholder="0" />
        <Inp label="Costo"           type="number"      value={f.cost}    onChange={e => set("cost",   e.target.value)} placeholder="0" />
        <Inp label="Stock actual *"  type="number"      value={f.stock}   onChange={e => set("stock",  e.target.value)} placeholder="0" />
      </div>
      <Inp label="Descripción" value={f.description} onChange={e => set("description", e.target.value)} placeholder="Opcional" />
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
        <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontWeight: 600, color: "#64748b", fontSize: 14 }}>Cancelar</button>
        <button onClick={() => { if (!f.name || !f.sku || !f.price || f.stock === "") return alert("Campos requeridos incompletos."); onSave({ ...f, price: +f.price, cost: +f.cost, stock: +f.stock }); }}
          style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
          {initial ? "Guardar" : "Agregar"}
        </button>
      </div>
    </div>
  );
};

// ── MovementModal: múltiples productos, descuento, domicilio ──────────────────
const MovementModal = ({ preProduct, allProducts, onClose, onSave }) => {
  // Lista de líneas: [{ productId, qty }]
  const [lines, setLines] = useState(
    preProduct ? [{ productId: preProduct.id, qty: "" }] : [{ productId: "", qty: "" }]
  );
  const [type,     setType]     = useState("salida");
  const [note,     setNote]     = useState("");
  const [discount, setDiscount] = useState("");
  const [delivery, setDelivery] = useState({ name: "", address: "", phone: "", value: "" });
  const [generating, setGen]    = useState(false);

  const addLine    = () => setLines(l => [...l, { productId: "", qty: "" }]);
  const removeLine = (i) => setLines(l => l.filter((_, idx) => idx !== i));
  const setLine    = (i, k, v) => setLines(l => l.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  const resolvedLines = lines
    .map(r => ({ product: allProducts.find(p => p.id === Number(r.productId)), qty: Number(r.qty) }))
    .filter(r => r.product && r.qty > 0);

  const subtotal    = resolvedLines.reduce((s, r) => s + r.product.price * r.qty, 0);
  const discountVal = Number(discount) || 0;
  const deliveryVal = Number(delivery.value) || 0;
  const grandTotal  = subtotal - discountVal + deliveryVal;

  const typeColors = {
    entrada: { border: "#15803d", bg: "#dcfce7", text: "#15803d", accent: "#4ade80" },
    salida:  { border: "#b91c1c", bg: "#fee2e2", text: "#b91c1c", accent: "#f87171" },
    ajuste:  { border: "#1d4ed8", bg: "#dbeafe", text: "#1d4ed8", accent: "#818cf8" },
  };
  const tc = typeColors[type];

  const handleSave = async () => {
    if (resolvedLines.length === 0) return alert("Agrega al menos un producto con cantidad válida.");
    for (const { product, qty } of resolvedLines) {
      if (type === "salida" && qty > product.stock) return alert(`Stock insuficiente para "${product.name}".`);
    }
    onSave(resolvedLines, type, note, discount, delivery);
    setGen(true);
    try {
      await generateInvoicePDF(resolvedLines, { type, note, discount: discountVal, delivery });
    } catch (e) { console.error(e); }
    setGen(false);
    onClose();
  };

  const sectionTitle = (t) => (
    <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10, marginTop: 16 }}>{t}</div>
  );

  return (
    <Modal title="Registrar movimiento" onClose={onClose} maxWidth={860}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>

        {/* ── Columna izquierda: formulario ── */}
        <div style={{ overflowY: "auto", maxHeight: "72vh", paddingRight: 4 }}>

          {/* Tipo */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[
              { key: "entrada", icon: "📥", label: "Entrada" },
              { key: "salida",  icon: "📤", label: "Salida"  },
              { key: "ajuste",  icon: "🔄", label: "Ajuste"  },
            ].map(t => (
              <button key={t.key} onClick={() => setType(t.key)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: type === t.key ? `2px solid ${typeColors[t.key].border}` : "1.5px solid #e2e8f0", background: type === t.key ? typeColors[t.key].bg : "#f8fafc", cursor: "pointer", fontWeight: 700, color: type === t.key ? typeColors[t.key].text : "#64748b", fontSize: 12 }}>
                {t.icon}<br />{t.label}
              </button>
            ))}
          </div>

          {/* Productos */}
          {sectionTitle("📦 Productos")}
          {lines.map((line, idx) => {
            const prod = allProducts.find(p => p.id === Number(line.productId));
            return (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 100px 36px", gap: 8, alignItems: "end", marginBottom: 10, background: "#f8fafc", borderRadius: 10, padding: "10px 12px", border: "1.5px solid #e2e8f0" }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>Producto</label>
                  <select value={line.productId} onChange={e => setLine(idx, "productId", e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, color: line.productId ? "#0f172a" : "#94a3b8", background: "#fff", outline: "none" }}>
                    <option value="">— Selecciona —</option>
                    {allProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku}) · {p.stock} {p.unit}</option>)}
                  </select>
                  {prod && <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 600, marginTop: 3 }}>{prod.sku} · Stock: {prod.stock} {prod.unit} · {formatCOP(prod.price)}</div>}
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>Cantidad</label>
                  <input type="number" value={line.qty} onChange={e => setLine(idx, "qty", e.target.value)} placeholder="0"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 14, fontWeight: 700, color: "#0f172a", outline: "none", background: "#fff", boxSizing: "border-box" }} />
                </div>
                <button onClick={() => removeLine(idx)} disabled={lines.length === 1}
                  style={{ padding: "8px", borderRadius: 8, border: "none", background: lines.length === 1 ? "#f1f5f9" : "#fee2e2", color: lines.length === 1 ? "#cbd5e1" : "#b91c1c", cursor: lines.length === 1 ? "not-allowed" : "pointer", fontSize: 16, fontWeight: 700, alignSelf: "end" }}>
                  ×
                </button>
              </div>
            );
          })}
          <button onClick={addLine} style={{ width: "100%", padding: "9px", borderRadius: 9, border: "1.5px dashed #c7d2fe", background: "#eef2ff", color: "#6366f1", cursor: "pointer", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
            + Agregar otro producto
          </button>

          {/* Nota */}
          {sectionTitle("📝 Referencia")}
          <Inp label="" value={note} onChange={e => setNote(e.target.value)} placeholder="Nota o referencia del movimiento..." />

          {/* Descuento */}
          {sectionTitle("🏷️ Descuento")}
          <Inp label="" type="number" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0 (dejar vacío si no aplica)" />

          {/* Domicilio */}
          {sectionTitle("🛵 Domicilio (opcional)")}
          <div style={{ background: "#f8fafc", borderRadius: 10, padding: "14px", border: "1.5px solid #e2e8f0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <Inp label="Nombre del cliente" value={delivery.name}    onChange={e => setDelivery(d => ({ ...d, name:    e.target.value }))} placeholder="Ej: Juan Pérez" />
              <Inp label="Teléfono"           value={delivery.phone}   onChange={e => setDelivery(d => ({ ...d, phone:   e.target.value }))} placeholder="+57 300..." />
            </div>
            <Inp label="Dirección"            value={delivery.address} onChange={e => setDelivery(d => ({ ...d, address: e.target.value }))} placeholder="Ej: Cra 5 #10-20, Barranquilla" />
            <Inp label="Valor del domicilio (COP)" type="number" value={delivery.value} onChange={e => setDelivery(d => ({ ...d, value: e.target.value }))} placeholder="0" />
          </div>
        </div>

        {/* ── Columna derecha: preview ── */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 10 }}>Vista previa · Factura PDF</div>
          <div style={{ background: "#0f172a", borderRadius: 14, overflow: "hidden", fontSize: 12 }}>
            <div style={{ background: tc.border, padding: "12px 16px 10px" }}>
              <div style={{ color: "#fff", fontWeight: 900, fontSize: 18 }}>FACTURA</div>
            </div>
            <div style={{ padding: "14px 16px" }}>
              {/* Lista de items */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0 8px", marginBottom: 6 }}>
                  <span style={{ fontSize: 9, color: "#64748b", fontWeight: 700 }}>PRODUCTO</span>
                  <span style={{ fontSize: 9, color: "#64748b", fontWeight: 700, textAlign: "right" }}>V.UNIT.</span>
                  <span style={{ fontSize: 9, color: "#64748b", fontWeight: 700, textAlign: "right" }}>V.TOTAL</span>
                </div>
                {resolvedLines.length === 0
                  ? <div style={{ color: "#475569", fontSize: 11, padding: "6px 0" }}>Sin productos aún…</div>
                  : resolvedLines.map(({ product, qty }, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0 8px", padding: "6px 8px", background: i % 2 === 0 ? "#1e293b" : "#162032", borderRadius: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>{product.name}<br /><span style={{ color: "#64748b", fontWeight: 400, fontSize: 9 }}>{qty} {product.unit}</span></span>
                      <span style={{ fontSize: 10, color: "#94a3b8", textAlign: "right", alignSelf: "center" }}>{formatCOP(product.price)}</span>
                      <span style={{ fontSize: 11, color: tc.accent, fontWeight: 700, textAlign: "right", alignSelf: "center" }}>{formatCOP(product.price * qty)}</span>
                    </div>
                  ))
                }
              </div>

              {resolvedLines.length > 0 && (
                <>
                  <div style={{ height: 1, background: "#1e293b", margin: "8px 0" }} />
                  {/* Totales */}
                  {[
                    ["Subtotal",    subtotal,    "#94a3b8"],
                    discountVal > 0 ? ["Descuento", -discountVal, "#f87171"] : null,
                    deliveryVal > 0 ? ["Domicilio", deliveryVal, "#94a3b8"] : null,
                  ].filter(Boolean).map(([label, val, color]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 3 }}>
                      <span style={{ color: "#64748b" }}>{label}:</span>
                      <span style={{ color, fontWeight: 600 }}>{formatCOP(val)}</span>
                    </div>
                  ))}
                  <div style={{ height: 1, background: tc.border, margin: "6px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: tc.border, borderRadius: 8, marginTop: 4 }}>
                    <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>TOTAL</span>
                    <span style={{ color: "#fff", fontWeight: 900, fontSize: 16 }}>{formatCOP(grandTotal)}</span>
                  </div>
                </>
              )}

              {/* Info domicilio en preview */}
              {delivery.name && (
                <div style={{ marginTop: 10, background: "#1e293b", borderRadius: 8, padding: "8px 10px", fontSize: 10 }}>
                  <div style={{ color: "#64748b", fontWeight: 700, marginBottom: 3 }}>🛵 DOMICILIO</div>
                  {delivery.name    && <div style={{ color: "#fff" }}>{delivery.name}</div>}
                  {delivery.address && <div style={{ color: "#94a3b8" }}>{delivery.address}</div>}
                  {delivery.phone   && <div style={{ color: "#94a3b8" }}>{delivery.phone}</div>}
                  {delivery.value   && <div style={{ color: tc.accent, fontWeight: 700 }}>{formatCOP(delivery.value)}</div>}
                </div>
              )}

              <div style={{ marginTop: 10, fontSize: 9, color: "#334155", textAlign: "center" }}>📄 PDF se descarga al confirmar</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer botones */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20, paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
        <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontWeight: 600, color: "#64748b", fontSize: 14 }}>Cancelar</button>
        <button onClick={handleSave} disabled={generating} style={{ padding: "11px 26px", borderRadius: 9, border: "none", background: generating ? "#94a3b8" : "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", cursor: generating ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 14, boxShadow: generating ? "none" : "0 4px 14px rgba(99,102,241,0.3)" }}>
          {generating ? "⏳ Generando PDF…" : "✅ Confirmar y descargar factura"}
        </button>
      </div>
    </Modal>
  );
};

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [products,   setProducts]   = useState(initialProducts);
  const [movements,  setMovements]  = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [tab,        setTab]        = useState("Dashboard");
  const [search,     setSearch]     = useState("");
  const [catFilter,  setCatFilter]  = useState("Todos");
  const [showAdd,    setShowAdd]    = useState(false);
  const [editProd,   setEditProd]   = useState(null);
  const [preProduct, setPreProduct] = useState(null);   // preselected product for modal
  const [showMov,    setShowMov]    = useState(false);  // open movement modal (no preselect)
  const [deleteId,   setDeleteId]   = useState(null);

  const totalProducts  = products.length;
  const totalStock     = products.reduce((s, p) => s + p.stock, 0);
  const inventoryValue = products.reduce((s, p) => s + p.price * p.stock, 0);
  const lowStock       = products.filter(p => p.stock <= LOW_STOCK_THRESHOLD);
  const outOfStock     = products.filter(p => p.stock === 0);

  const filtered = useMemo(() =>
    products.filter(p =>
      (catFilter === "Todos" || p.category === catFilter) &&
      (p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
    ), [products, search, catFilter]);

  const addProduct    = (d) => { setProducts(ps => [...ps, { ...d, id: nextId++ }]); setShowAdd(false); };
  const updateProduct = (d) => { setProducts(ps => ps.map(p => p.id === editProd.id ? { ...p, ...d } : p)); setEditProd(null); };
  const deleteProduct = (id) => { setProducts(ps => ps.filter(p => p.id !== id)); setDeleteId(null); };

  // resolvedLines = [{ product, qty }]
  const registerMovement = (resolvedLines, type, note, discount, delivery) => {
    const date = new Date().toLocaleString("es-CO");
    // Actualizar stock de cada producto
    resolvedLines.forEach(({ product, qty }) => {
      const stockAfter = type === "entrada" ? product.stock + qty : type === "salida" ? product.stock - qty : qty;
      setProducts(ps => ps.map(p => p.id === product.id ? { ...p, stock: stockAfter } : p));
      setMovements(ms => [{
        id: Date.now() + Math.random(), productId: product.id, productName: product.name,
        sku: product.sku, type, qty, note,
        stockAfter: type === "entrada" ? product.stock + qty : type === "salida" ? product.stock - qty : qty,
        discount: Number(discount) || 0, date
      }, ...ms]);
    });
    // Guardar domicilio si tiene datos
    if (delivery && delivery.name) {
      const subtotal = resolvedLines.reduce((s, r) => s + r.product.price * r.qty, 0);
      setDeliveries(ds => [{
        id: deliveryId++, date, name: delivery.name, address: delivery.address,
        phone: delivery.phone, value: Number(delivery.value) || 0,
        orderValue: subtotal, discount: Number(discount) || 0,
        products: resolvedLines.map(r => `${r.product.name} x${r.qty}`)
      }, ...ds]);
    }
    setPreProduct(null);
    setShowMov(false);
  };

  const stockColor = (s) => s === 0 ? "red" : s <= LOW_STOCK_THRESHOLD ? "yellow" : "green";

  const s = {
    app:       { minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Segoe UI', sans-serif", color: "#0f172a" },
    sidebar:   { width: 220, background: "#0f172a", minHeight: "100vh", padding: "28px 0", position: "fixed", top: 0, left: 0, display: "flex", flexDirection: "column" },
    logoText:  { fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: -0.5 },
    logoSub:   { fontSize: 11, color: "#64748b", fontWeight: 500, marginTop: 2 },
    nav:       { padding: "16px 12px", flex: 1 },
    navItem:   (a) => ({ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, cursor: "pointer", marginBottom: 4, background: a ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "transparent", color: a ? "#fff" : "#94a3b8", fontWeight: a ? 700 : 500, fontSize: 14, border: "none", width: "100%", textAlign: "left" }),
    main:      { marginLeft: 220, padding: "32px 36px", minHeight: "100vh" },
    header:    { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 26 },
    pageTitle: { fontSize: 26, fontWeight: 900, color: "#0f172a", margin: 0 },
    kpiGrid:   { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18, marginBottom: 26 },
    kpiCard:   (c) => ({ background: "#fff", borderRadius: 16, padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${c}` }),
    kpiVal:    { fontSize: 28, fontWeight: 900, color: "#0f172a", lineHeight: 1.1, marginBottom: 4 },
    kpiLabel:  { fontSize: 13, color: "#64748b", fontWeight: 500 },
    card:      { background: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" },
    tRow:      { display: "grid", alignItems: "center", padding: "13px 20px", borderBottom: "1px solid #f1f5f9" },
    th:        { fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.7 },
    btn:       (v = "primary") => ({ padding: "10px 20px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, background: v === "primary" ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : v === "danger" ? "#fee2e2" : "#f1f5f9", color: v === "primary" ? "#fff" : v === "danger" ? "#b91c1c" : "#334155", boxShadow: v === "primary" ? "0 4px 14px rgba(99,102,241,0.25)" : "none" }),
    iconBtn:   { background: "none", border: "none", cursor: "pointer", padding: "6px 8px", borderRadius: 8, fontSize: 16 },
    toolbar:   { display: "flex", gap: 12, alignItems: "center", marginBottom: 18, flexWrap: "wrap" },
    searchInp: { flex: 1, minWidth: 200, padding: "9px 16px 9px 40px", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", background: "#f8fafc", color: "#0f172a" },
  };

  const COLS = "2fr 1.2fr 1.2fr 1fr 1fr 1fr 1.5fr";

  const navIcon = (t) => ({ Dashboard: "📊", Inventario: "📦", Movimientos: "🔄", Domicilios: "🛵", Alertas: "🔔" }[t]);

  return (
    <div style={s.app}>
      {/* SIDEBAR */}
      <aside style={s.sidebar}>
        <div style={{ padding: "0 24px 26px", borderBottom: "1px solid #1e293b" }}>
          <div style={s.logoText}>📦 InvenPro</div>
          <div style={s.logoSub}>Control de inventario</div>
        </div>
        <nav style={s.nav}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={s.navItem(tab === t)}>
              {navIcon(t)}{" "}{t}
              {t === "Alertas" && lowStock.length > 0 && (
                <span style={{ marginLeft: "auto", background: "#ef4444", color: "#fff", borderRadius: 20, padding: "1px 7px", fontSize: 11, fontWeight: 800 }}>{lowStock.length}</span>
              )}
              {t === "Domicilios" && deliveries.length > 0 && (
                <span style={{ marginLeft: "auto", background: "#6366f1", color: "#fff", borderRadius: 20, padding: "1px 7px", fontSize: 11, fontWeight: 800 }}>{deliveries.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div style={{ padding: "0 16px 20px", fontSize: 11, color: "#334155", textAlign: "center" }}>{products.length} productos registrados</div>
      </aside>

      <main style={s.main}>

        {/* ─── DASHBOARD ─── */}
        {tab === "Dashboard" && (
          <>
            <div style={s.header}>
              <h1 style={s.pageTitle}>Dashboard</h1>
              <button style={s.btn()} onClick={() => setShowMov(true)}>🔄 Registrar movimiento</button>
            </div>
            <div style={s.kpiGrid}>
              {[
                { label: "Productos registrados", val: totalProducts,             color: "#6366f1", icon: "📦" },
                { label: "Unidades en stock",      val: totalStock,                color: "#10b981", icon: "🏷️" },
                { label: "Valor del inventario",   val: formatCOP(inventoryValue), color: "#f59e0b", icon: "💰" },
                { label: "Alertas stock bajo",     val: lowStock.length,           color: "#ef4444", icon: "🔔" },
              ].map(k => (
                <div key={k.label} style={s.kpiCard(k.color)}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{k.icon}</div>
                  <div style={s.kpiVal}>{k.val}</div>
                  <div style={s.kpiLabel}>{k.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              <div style={s.card}>
                <div style={{ padding: "18px 22px 12px", fontWeight: 800, fontSize: 14 }}>Productos por categoría</div>
                <div style={{ padding: "0 22px 18px" }}>
                  {CATEGORIES.filter(c => c !== "Todos").map(cat => {
                    const count = products.filter(p => p.category === cat).length;
                    const pct   = totalProducts ? (count / totalProducts) * 100 : 0;
                    return (
                      <div key={cat} style={{ marginBottom: 13 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                          <span style={{ fontWeight: 600 }}>{cat}</span>
                          <span style={{ color: "#64748b" }}>{count}</span>
                        </div>
                        <div style={{ height: 6, background: "#f1f5f9", borderRadius: 10 }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#6366f1,#8b5cf6)", borderRadius: 10 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={s.card}>
                <div style={{ padding: "18px 22px 12px", fontWeight: 800, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Stock bajo</span>
                  {lowStock.length > 0 && <Badge color="red">{lowStock.length}</Badge>}
                </div>
                {lowStock.length === 0
                  ? <div style={{ padding: "16px 22px", color: "#64748b", fontSize: 13 }}>✅ Todo el stock está OK</div>
                  : lowStock.map(p => (
                    <div key={p.id} style={{ padding: "11px 22px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div><div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{p.sku}</div></div>
                      <Badge color={p.stock === 0 ? "red" : "yellow"}>{p.stock === 0 ? "Agotado" : `${p.stock} ${p.unit}`}</Badge>
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Movimientos recientes */}
            <div style={s.card}>
              <div style={{ padding: "18px 22px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ fontWeight: 800, fontSize: 14 }}>Movimientos recientes</span>
                {movements.length > 0 && <button onClick={() => setTab("Movimientos")} style={{ fontSize: 12, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Ver todos →</button>}
              </div>
              {movements.length === 0
                ? <div style={{ padding: "32px 22px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}><div style={{ fontSize: 30, marginBottom: 8 }}>📋</div>Usa "Registrar movimiento" para comenzar.</div>
                : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.7fr 1.2fr 1.8fr 1.2fr", padding: "9px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      {["Producto","SKU","Tipo","Cant.","Valor","Nota","Fecha"].map(h => <span key={h} style={s.th}>{h}</span>)}
                    </div>
                    {movements.slice(0, 8).map(m => {
                      const prod = products.find(p => p.id === m.productId);
                      return (
                        <div key={m.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.7fr 1.2fr 1.8fr 1.2fr", padding: "12px 20px", borderBottom: "1px solid #f1f5f9", alignItems: "center" }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{m.productName}</span>
                          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#6366f1", fontWeight: 700 }}>{m.sku}</span>
                          <Badge color={m.type === "entrada" ? "green" : m.type === "salida" ? "red" : "blue"}>
                            {m.type === "entrada" ? "📥" : m.type === "salida" ? "📤" : "🔄"} {m.type}
                          </Badge>
                          <span style={{ fontWeight: 800, fontSize: 13, color: m.type === "entrada" ? "#15803d" : m.type === "salida" ? "#b91c1c" : "#1d4ed8" }}>
                            {m.type === "entrada" ? "+" : m.type === "salida" ? "-" : "="}{m.qty}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{prod ? formatCOP(prod.price * m.qty) : "—"}</span>
                          <span style={{ fontSize: 11, color: "#64748b" }}>{m.note || "—"}</span>
                          <span style={{ fontSize: 10, color: "#94a3b8" }}>{m.date}</span>
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
        {tab === "Inventario" && (
          <>
            <div style={s.header}>
              <h1 style={s.pageTitle}>Inventario</h1>
              <button style={s.btn()} onClick={() => setShowAdd(true)}>+ Agregar producto</button>
            </div>
            <div style={s.toolbar}>
              <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}>🔍</span>
                <input style={s.searchInp} placeholder="Buscar nombre o SKU…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCatFilter(c)} style={{ padding: "8px 14px", borderRadius: 8, border: catFilter === c ? "2px solid #6366f1" : "1.5px solid #e2e8f0", background: catFilter === c ? "#eef2ff" : "#fff", color: catFilter === c ? "#6366f1" : "#64748b", cursor: "pointer", fontSize: 13, fontWeight: catFilter === c ? 700 : 500 }}>
                  {c}
                </button>
              ))}
            </div>
            <div style={s.card}>
              <div style={{ ...s.tRow, gridTemplateColumns: COLS, borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                {["Producto","SKU","Categoría","Precio","Costo","Stock","Acciones"].map(h => <span key={h} style={s.th}>{h}</span>)}
              </div>
              {filtered.length === 0
                ? <div style={{ padding: "36px", textAlign: "center", color: "#94a3b8" }}>No se encontraron productos</div>
                : filtered.map(p => (
                  <div key={p.id} style={{ ...s.tRow, gridTemplateColumns: COLS }}>
                    <div><div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{p.description}</div></div>
                    <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#6366f1", fontSize: 12 }}>{p.sku}</span>
                    <Badge color="blue">{p.category}</Badge>
                    <span style={{ fontSize: 13 }}>{formatCOP(p.price)}</span>
                    <span style={{ fontSize: 13, color: "#64748b" }}>{p.cost ? formatCOP(p.cost) : "—"}</span>
                    <Badge color={stockColor(p.stock)}>{p.stock} {p.unit}</Badge>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button title="Movimiento" style={s.iconBtn} onClick={() => { setPreProduct(p); setShowMov(true); }}>🔄</button>
                      <button title="Editar"     style={s.iconBtn} onClick={() => setEditProd(p)}>✏️</button>
                      <button title="Eliminar"   style={s.iconBtn} onClick={() => setDeleteId(p.id)}>🗑️</button>
                    </div>
                  </div>
                ))
              }
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: "#94a3b8" }}>Mostrando {filtered.length} de {products.length} productos</div>
          </>
        )}

        {/* ─── MOVIMIENTOS ─── */}
        {tab === "Movimientos" && (
          <>
            <div style={s.header}>
              <h1 style={s.pageTitle}>Movimientos</h1>
              <button style={s.btn()} onClick={() => setShowMov(true)}>🔄 Registrar movimiento</button>
            </div>
            <div style={s.card}>
              {movements.length === 0
                ? <div style={{ padding: "52px", textAlign: "center", color: "#94a3b8" }}><div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>Aún no hay movimientos.</div>
                : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 0.8fr 1fr 1.5fr 1fr", padding: "9px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      {["Producto","SKU","Tipo","Cant.","Valor total","Nota","Fecha"].map(h => <span key={h} style={s.th}>{h}</span>)}
                    </div>
                    {movements.map(m => {
                      const prod = products.find(p => p.id === m.productId);
                      return (
                        <div key={m.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 0.8fr 1fr 1.5fr 1fr", padding: "12px 20px", borderBottom: "1px solid #f1f5f9", alignItems: "center" }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{m.productName}</span>
                          <span style={{ fontFamily: "monospace", fontSize: 12, color: "#6366f1", fontWeight: 600 }}>{m.sku}</span>
                          <Badge color={m.type === "entrada" ? "green" : m.type === "salida" ? "red" : "blue"}>
                            {m.type === "entrada" ? "📥 Entrada" : m.type === "salida" ? "📤 Salida" : "🔄 Ajuste"}
                          </Badge>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{m.type === "entrada" ? "+" : m.type === "salida" ? "-" : "="}{m.qty}</span>
                          <span style={{ fontWeight: 700, fontSize: 12 }}>{prod ? formatCOP(prod.price * m.qty) : "—"}</span>
                          <span style={{ fontSize: 12, color: "#64748b" }}>{m.note || "—"}</span>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>{m.date}</span>
                        </div>
                      );
                    })}
                  </>
                )
              }
            </div>
          </>
        )}

        {/* ─── DOMICILIOS ─── */}
        {tab === "Domicilios" && (
          <>
            <div style={s.header}>
              <h1 style={s.pageTitle}>Domicilios</h1>
              <div style={{ fontSize: 13, color: "#64748b" }}>Registro de entregas y clientes</div>
            </div>

            {/* KPIs domicilios */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, marginBottom: 24 }}>
              {[
                { label: "Total domicilios",      val: deliveries.length,                                        color: "#6366f1", icon: "🛵" },
                { label: "Valor total domicilios",val: formatCOP(deliveries.reduce((s,d) => s + d.value, 0)),   color: "#10b981", icon: "💵" },
                { label: "Valor total pedidos",   val: formatCOP(deliveries.reduce((s,d) => s + d.orderValue, 0)), color: "#f59e0b", icon: "🛒" },
              ].map(k => (
                <div key={k.label} style={s.kpiCard(k.color)}>
                  <div style={{ fontSize: 22, marginBottom: 7 }}>{k.icon}</div>
                  <div style={s.kpiVal}>{k.val}</div>
                  <div style={s.kpiLabel}>{k.label}</div>
                </div>
              ))}
            </div>

            <div style={s.card}>
              {deliveries.length === 0
                ? <div style={{ padding: "52px", textAlign: "center", color: "#94a3b8" }}><div style={{ fontSize: 36, marginBottom: 10 }}>🛵</div>Aún no hay domicilios registrados.<br /><span style={{ fontSize: 12 }}>Completa el campo "Domicilio" al registrar un movimiento.</span></div>
                : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1.2fr 1.5fr 1fr", padding: "9px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      {["Cliente","Teléfono","V. Pedido","V. Domicilio","Descuento","Productos","Fecha"].map(h => <span key={h} style={s.th}>{h}</span>)}
                    </div>
                    {deliveries.map(d => (
                      <div key={d.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1.2fr 1.5fr 1fr", padding: "13px 20px", borderBottom: "1px solid #f1f5f9", alignItems: "start" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{d.name}</div>
                          {d.address && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>📍 {d.address}</div>}
                        </div>
                        <span style={{ fontSize: 12, color: "#475569" }}>{d.phone || "—"}</span>
                        <span style={{ fontWeight: 700, fontSize: 12 }}>{formatCOP(d.orderValue)}</span>
                        <span style={{ fontWeight: 700, fontSize: 12, color: "#6366f1" }}>{formatCOP(d.value)}</span>
                        <span style={{ fontSize: 12, color: d.discount > 0 ? "#b91c1c" : "#94a3b8" }}>{d.discount > 0 ? `-${formatCOP(d.discount)}` : "—"}</span>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{d.products.join(", ")}</div>
                        <span style={{ fontSize: 10, color: "#94a3b8" }}>{d.date}</span>
                      </div>
                    ))}
                  </>
                )
              }
            </div>
          </>
        )}

        {/* ─── ALERTAS ─── */}
        {tab === "Alertas" && (
          <>
            <div style={s.header}><h1 style={s.pageTitle}>Alertas de Stock</h1></div>
            {outOfStock.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <h3 style={{ fontWeight: 800, color: "#b91c1c", marginBottom: 10, fontSize: 15 }}>🚨 Productos agotados</h3>
                <div style={s.card}>
                  {outOfStock.map(p => (
                    <div key={p.id} style={{ ...s.tRow, gridTemplateColumns: "2fr 1fr 1fr 1fr", borderBottom: "1px solid #fee2e2" }}>
                      <div><div style={{ fontWeight: 700 }}>{p.name}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{p.sku}</div></div>
                      <Badge color="gray">{p.category}</Badge>
                      <Badge color="red">Agotado</Badge>
                      <button style={s.btn()} onClick={() => { setPreProduct(p); setShowMov(true); }}>Reponer</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {lowStock.filter(p => p.stock > 0).length > 0 && (
              <div>
                <h3 style={{ fontWeight: 800, color: "#a16207", marginBottom: 10, fontSize: 15 }}>⚠️ Stock bajo (≤{LOW_STOCK_THRESHOLD})</h3>
                <div style={s.card}>
                  {lowStock.filter(p => p.stock > 0).map(p => (
                    <div key={p.id} style={{ ...s.tRow, gridTemplateColumns: "2fr 1fr 1fr 1fr", borderBottom: "1px solid #fef9c3" }}>
                      <div><div style={{ fontWeight: 700 }}>{p.name}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{p.sku}</div></div>
                      <Badge color="gray">{p.category}</Badge>
                      <Badge color="yellow">{p.stock} {p.unit}</Badge>
                      <button style={s.btn()} onClick={() => { setPreProduct(p); setShowMov(true); }}>Reponer</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {lowStock.length === 0 && (
              <div style={{ ...s.card, padding: "52px", textAlign: "center", color: "#94a3b8" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                <div>¡Todo el inventario está en buen estado!</div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── MODALS ── */}
      {showAdd   && <Modal title="Agregar producto" onClose={() => setShowAdd(false)}><ProductForm onSave={addProduct} onClose={() => setShowAdd(false)} /></Modal>}
      {editProd  && <Modal title="Editar producto"  onClose={() => setEditProd(null)}><ProductForm initial={editProd} onSave={updateProduct} onClose={() => setEditProd(null)} /></Modal>}

      {showMov && (
        <MovementModal
          preProduct={preProduct}
          allProducts={products}
          onClose={() => { setShowMov(false); setPreProduct(null); }}
          onSave={registerMovement}
        />
      )}

      {deleteId && (
        <Modal title="Eliminar producto" onClose={() => setDeleteId(null)}>
          <p style={{ color: "#475569", marginBottom: 22 }}>¿Seguro que deseas eliminar este producto? Esta acción no se puede deshacer.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => setDeleteId(null)} style={s.btn("secondary")}>Cancelar</button>
            <button onClick={() => deleteProduct(deleteId)} style={s.btn("danger")}>Sí, eliminar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

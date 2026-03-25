// useDB.js
// Hook centralizado para todas las operaciones de base de datos con Supabase.
// La app consume este hook y nunca llama a supabase directamente.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// Estado inicial vacío mientras carga
const EMPTY = {
  products: [], categories: [], clients: [], providers: [],
  paymentMethods: [], orders: [], movements: [], deliveries: [],
  settings: { businessName:'Mi Negocio', businessPhone:'', businessAddress:'', lowStockThreshold:5 },
}

export function useDB() {
  const [db,     setDb]     = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // ── Carga inicial de todos los datos ──────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [
        { data: products },
        { data: categories },
        { data: clients },
        { data: providers },
        { data: paymentMethods },
        { data: orders },
        { data: movements },
        { data: deliveries },
        { data: settingsRows },
      ] = await Promise.all([
        supabase.from('products').select('*').order('id'),
        supabase.from('categories').select('*').order('id'),
        supabase.from('clients').select('*').order('id'),
        supabase.from('providers').select('*').order('id'),
        supabase.from('payment_methods').select('*').order('id'),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('movements').select('*').order('created_at', { ascending: false }),
        supabase.from('deliveries').select('*').order('created_at', { ascending: false }),
        supabase.from('settings').select('*').eq('id', 1),
      ])

      // Mapea snake_case de Supabase → camelCase de la app
      const mapProduct   = p => ({ id:p.id, name:p.name, sku:p.sku, categoryId:p.category_id, providerId:p.provider_id, price:Number(p.price), cost:Number(p.cost), stock:p.stock, unit:p.unit, description:p.description, image:p.image||"" })
      const mapOrder     = o => ({ id:o.id, clientId:o.client_id, paymentMethodId:o.payment_method_id, state:o.state, items:o.items||[], note:o.note, discount:Number(o.discount||0), delivery:o.delivery, total:Number(o.total||0), createdAt:new Date(o.created_at).toLocaleString('es-CO'), updatedAt:new Date(o.updated_at).toLocaleString('es-CO') })
      const mapMovement  = m => ({ id:m.id, productId:m.product_id, productName:m.product_name, sku:m.sku, type:m.type, qty:m.qty, note:m.note, stockAfter:m.stock_after, discount:Number(m.discount||0), date:new Date(m.created_at).toLocaleString('es-CO') })
      const mapDelivery  = d => ({ id:d.id, name:d.name, phone:d.phone, address:d.address, value:Number(d.value||0), orderValue:Number(d.order_value||0), discount:Number(d.discount||0), products:d.products||[], date:new Date(d.created_at).toLocaleString('es-CO') })
      const mapPM        = p => ({ id:p.id, name:p.name, icon:p.icon })
      const mapSettings  = s => ({ businessName:s.business_name, businessPhone:s.business_phone||'', businessAddress:s.business_address||'', lowStockThreshold:s.low_stock_threshold||5 })

      setDb({
        products:       (products||[]).map(mapProduct),
        categories:     categories||[],
        clients:        clients||[],
        providers:      providers||[],
        paymentMethods: (paymentMethods||[]).map(mapPM),
        orders:         (orders||[]).map(mapOrder),
        movements:      (movements||[]).map(mapMovement),
        deliveries:     (deliveries||[]).map(mapDelivery),
        settings:       settingsRows?.[0] ? mapSettings(settingsRows[0]) : EMPTY.settings,
      })
    } catch (e) {
      setError('Error conectando con la base de datos: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Helper genérico de error ──────────────────────────────────────────────
  const check = ({ error }) => { if (error) throw new Error(error.message) }

  // ══════════════════════════════════════════════════════════════════════════
  //  PRODUCTS
  // ══════════════════════════════════════════════════════════════════════════
  const addProduct = async (d) => {
    const { data, error } = await supabase.from('products').insert({
      name:d.name, sku:d.sku, category_id:d.categoryId||null, provider_id:d.providerId||null,
      price:d.price, cost:d.cost, stock:d.stock, unit:d.unit, description:d.description,
      image:d.image||null,
    }).select().single()
    if (error) throw new Error(error.message)
    setDb(db => ({ ...db, products: [...db.products, { id:data.id, name:data.name, sku:data.sku, categoryId:data.category_id, providerId:data.provider_id, price:Number(data.price), cost:Number(data.cost), stock:data.stock, unit:data.unit, description:data.description, image:data.image||"" }] }))
  }

  const editProduct = async (d) => {
    check(await supabase.from('products').update({ name:d.name, sku:d.sku, category_id:d.categoryId||null, provider_id:d.providerId||null, price:d.price, cost:d.cost, stock:d.stock, unit:d.unit, description:d.description, image:d.image||null }).eq('id', d.id))
    setDb(db => ({ ...db, products: db.products.map(p => p.id===d.id ? d : p) }))
  }

  const deleteProduct = async (id) => {
    check(await supabase.from('products').delete().eq('id', id))
    setDb(db => ({ ...db, products: db.products.filter(p => p.id!==id) }))
  }

  const updateStock = async (productId, newStock) => {
    check(await supabase.from('products').update({ stock: newStock }).eq('id', productId))
    setDb(db => ({ ...db, products: db.products.map(p => p.id===productId ? { ...p, stock: newStock } : p) }))
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  CATEGORIES
  // ══════════════════════════════════════════════════════════════════════════
  const addCategory = async (d) => {
    const { data, error } = await supabase.from('categories').insert({ name: d.name }).select().single()
    if (error) throw new Error(error.message)
    setDb(db => ({ ...db, categories: [...db.categories, data] }))
  }

  const editCategory = async (d) => {
    check(await supabase.from('categories').update({ name: d.name }).eq('id', d.id))
    setDb(db => ({ ...db, categories: db.categories.map(c => c.id===d.id ? d : c) }))
  }

  const deleteCategory = async (id) => {
    check(await supabase.from('categories').delete().eq('id', id))
    setDb(db => ({ ...db, categories: db.categories.filter(c => c.id!==id) }))
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  CLIENTS
  // ══════════════════════════════════════════════════════════════════════════
  const addClient = async (d) => {
    // Buscar duplicado por teléfono, email o nombre exacto (case-insensitive)
    const normalize = s => (s||"").trim().toLowerCase();
    const existing = db.clients.find(c =>
      (d.phone && normalize(c.phone) === normalize(d.phone)) ||
      (d.email && normalize(c.email) === normalize(d.email)) ||
      normalize(c.name) === normalize(d.name)
    );

    if (existing) {
      // Retorna el cliente existente sin crear uno nuevo
      return { existing: true, client: existing };
    }

    const { data, error } = await supabase
      .from('clients')
      .insert({ name:d.name, phone:d.phone, email:d.email, address:d.address })
      .select().single()
    if (error) throw new Error(error.message)
    setDb(db => ({ ...db, clients: [...db.clients, data] }))
    return { existing: false, client: data };
  }

  const editClient = async (d) => {
    check(await supabase.from('clients').update({ name:d.name, phone:d.phone, email:d.email, address:d.address }).eq('id', d.id))
    setDb(db => ({ ...db, clients: db.clients.map(c => c.id===d.id ? d : c) }))
  }

  const deleteClient = async (id) => {
    check(await supabase.from('clients').delete().eq('id', id))
    setDb(db => ({ ...db, clients: db.clients.filter(c => c.id!==id) }))
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PROVIDERS
  // ══════════════════════════════════════════════════════════════════════════
  const addProvider = async (d) => {
    const { data, error } = await supabase.from('providers').insert({ name:d.name, contact:d.contact, phone:d.phone, email:d.email, notes:d.notes }).select().single()
    if (error) throw new Error(error.message)
    setDb(db => ({ ...db, providers: [...db.providers, data] }))
  }

  const editProvider = async (d) => {
    check(await supabase.from('providers').update({ name:d.name, contact:d.contact, phone:d.phone, email:d.email, notes:d.notes }).eq('id', d.id))
    setDb(db => ({ ...db, providers: db.providers.map(p => p.id===d.id ? d : p) }))
  }

  const deleteProvider = async (id) => {
    check(await supabase.from('providers').delete().eq('id', id))
    setDb(db => ({ ...db, providers: db.providers.filter(p => p.id!==id) }))
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PAYMENT METHODS
  // ══════════════════════════════════════════════════════════════════════════
  const addPaymentMethod = async (d) => {
    const { data, error } = await supabase.from('payment_methods').insert({ name:d.name, icon:d.icon }).select().single()
    if (error) throw new Error(error.message)
    setDb(db => ({ ...db, paymentMethods: [...db.paymentMethods, data] }))
  }

  const editPaymentMethod = async (d) => {
    check(await supabase.from('payment_methods').update({ name:d.name, icon:d.icon }).eq('id', d.id))
    setDb(db => ({ ...db, paymentMethods: db.paymentMethods.map(p => p.id===d.id ? d : p) }))
  }

  const deletePaymentMethod = async (id) => {
    check(await supabase.from('payment_methods').delete().eq('id', id))
    setDb(db => ({ ...db, paymentMethods: db.paymentMethods.filter(p => p.id!==id) }))
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ORDERS
  // ══════════════════════════════════════════════════════════════════════════

  // Helper interno: inserta un movimiento y actualiza el stock
  const _insertMovement = async (product, qty, type, note) => {
    const sa = type === 'entrada' ? product.stock + qty
             : type === 'salida'  ? product.stock - qty
             : qty

    const { data: movData, error: movErr } = await supabase.from('movements').insert({
      product_id:   product.id,
      product_name: product.name,
      sku:          product.sku,
      type,
      qty,
      note,
      stock_after:  sa,
      discount:     0,
    }).select().single()
    if (movErr) throw new Error(movErr.message)

    await supabase.from('products').update({ stock: sa }).eq('id', product.id)

    const mapped = {
      id:          movData.id,
      productId:   movData.product_id,
      productName: movData.product_name,
      sku:         movData.sku,
      type:        movData.type,
      qty:         movData.qty,
      note:        movData.note,
      stockAfter:  movData.stock_after,
      discount:    0,
      date:        new Date(movData.created_at).toLocaleString('es-CO'),
    }

    // Actualiza estado local: movimiento + stock del producto
    setDb(db => ({
      ...db,
      movements: [mapped, ...db.movements],
      products:  db.products.map(p => p.id === product.id ? { ...p, stock: sa } : p),
    }))

    return mapped
  }

  const addOrder = async (d) => {
    // 1. Verificar stock suficiente antes de crear el pedido
    for (const line of d.items) {
      const prod = db.products.find(p => p.id === Number(line.productId))
      if (!prod) continue
      const qty = Number(line.qty)
      if (qty > prod.stock) {
        throw new Error(`Stock insuficiente para "${prod.name}". Disponible: ${prod.stock} ${prod.unit}`)
      }
    }

    // 2. Crear el pedido en Supabase
    const { data, error } = await supabase.from('orders').insert({
      client_id:         d.clientId || null,
      payment_method_id: d.paymentMethodId || null,
      state:             'Pendiente',
      items:             d.items,
      note:              d.note,
      discount:          d.discount || 0,
      delivery:          d.delivery,
      total:             d.total,
    }).select().single()
    if (error) throw new Error(error.message)

    const mapped = {
      id:              data.id,
      clientId:        data.client_id,
      paymentMethodId: data.payment_method_id,
      state:           data.state,
      items:           data.items,
      note:            data.note,
      discount:        Number(data.discount),
      delivery:        data.delivery,
      total:           Number(data.total),
      createdAt:       new Date(data.created_at).toLocaleString('es-CO'),
      updatedAt:       new Date(data.updated_at).toLocaleString('es-CO'),
    }
    setDb(db => ({ ...db, orders: [mapped, ...db.orders] }))

    // 3. Generar movimiento de SALIDA por cada producto del pedido
    const noteMovimiento = `Pedido #${String(data.id).padStart(4,'0')}${d.note ? ' · ' + d.note : ''}`
    for (const line of d.items) {
      const prod = db.products.find(p => p.id === Number(line.productId))
      if (!prod || !Number(line.qty)) continue
      await _insertMovement(prod, Number(line.qty), 'salida', noteMovimiento)
    }

    // 4. Registrar domicilio si el pedido tiene datos de entrega
    if (d.delivery?.name) {
      const { data: delData, error: delErr } = await supabase.from('deliveries').insert({
        name:        d.delivery.name,
        phone:       d.delivery.phone,
        address:     d.delivery.address,
        value:       Number(d.delivery.value) || 0,
        order_value: d.total,
        discount:    d.discount || 0,
        products:    d.items.map(l => {
          const p = db.products.find(x => x.id === Number(l.productId))
          return p ? `${p.name} x${l.qty}` : `Producto x${l.qty}`
        }),
      }).select().single()
      if (!delErr && delData) {
        const delMapped = {
          id:         delData.id,
          name:       delData.name,
          phone:      delData.phone,
          address:    delData.address,
          value:      Number(delData.value),
          orderValue: Number(delData.order_value),
          discount:   Number(delData.discount),
          products:   delData.products,
          date:       new Date(delData.created_at).toLocaleString('es-CO'),
        }
        setDb(db => ({ ...db, deliveries: [delMapped, ...db.deliveries] }))
      }
    }
  }

  const editOrder = async (d) => {
    // Obtener el pedido original para calcular diferencias de stock
    const original = db.orders.find(o => o.id === d.id)

    check(await supabase.from('orders').update({
      client_id:         d.clientId || null,
      payment_method_id: d.paymentMethodId || null,
      items:             d.items,
      note:              d.note,
      discount:          d.discount || 0,
      delivery:          d.delivery,
      total:             d.total,
      updated_at:        new Date().toISOString(),
    }).eq('id', d.id))

    setDb(db => ({ ...db, orders: db.orders.map(o => o.id===d.id ? { ...o, ...d, updatedAt: new Date().toLocaleString('es-CO') } : o) }))

    // Ajustar stock: devolver stock del pedido original y descontar el nuevo
    if (original) {
      const noteAjuste = `Ajuste pedido #${String(d.id).padStart(4,'0')}`

      // Devolver stock de los items originales (entrada)
      for (const line of original.items) {
        const prod = db.products.find(p => p.id === Number(line.productId))
        if (!prod || !Number(line.qty)) continue
        await _insertMovement(prod, Number(line.qty), 'entrada', noteAjuste + ' (reverso)')
      }

      // Descontar stock de los items nuevos (salida)
      for (const line of d.items) {
        const prod = db.products.find(p => p.id === Number(line.productId))
        if (!prod || !Number(line.qty)) continue
        await _insertMovement(prod, Number(line.qty), 'salida', noteAjuste + ' (nuevo)')
      }
    }
  }

  const advanceOrder = async (id) => {
    const ORDER_STATES = ['Pendiente', 'En proceso', 'Enviado', 'Entregado']
    const order = db.orders.find(o => o.id === id)
    if (!order) return
    const idx  = ORDER_STATES.indexOf(order.state)
    const next = ORDER_STATES[idx + 1] || order.state
    check(await supabase.from('orders').update({ state: next, updated_at: new Date().toISOString() }).eq('id', id))
    setDb(db => ({ ...db, orders: db.orders.map(o => o.id===id ? { ...o, state: next, updatedAt: new Date().toLocaleString('es-CO') } : o) }))
  }

  const cancelOrder = async (id) => {
    const order = db.orders.find(o => o.id === id)

    // Devolver stock primero: entrada por cada producto del pedido
    if (order) {
      const noteDevolucion = `Cancelación pedido #${String(id).padStart(4,'0')}`
      for (const line of order.items) {
        const prod = db.products.find(p => p.id === Number(line.productId))
        if (!prod || !Number(line.qty)) continue
        await _insertMovement(prod, Number(line.qty), 'entrada', noteDevolucion)
      }
    }

    // Eliminar el pedido definitivamente de la base de datos
    check(await supabase.from('orders').delete().eq('id', id))
    setDb(db => ({ ...db, orders: db.orders.filter(o => o.id !== id) }))
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MOVEMENTS
  // ══════════════════════════════════════════════════════════════════════════
  const registerMovement = async (resolvedLines, type, note, discount, delivery) => {
    for (const { product, qty } of resolvedLines) {
      const sa = type==='entrada' ? product.stock+qty : type==='salida' ? product.stock-qty : qty

      // Insertar movimiento
      const { data: movData, error: movErr } = await supabase.from('movements').insert({
        product_id: product.id, product_name: product.name, sku: product.sku,
        type, qty, note, stock_after: sa, discount: Number(discount)||0,
      }).select().single()
      if (movErr) throw new Error(movErr.message)

      // Actualizar stock del producto
      await updateStock(product.id, sa)

      const mapped = { id:movData.id, productId:movData.product_id, productName:movData.product_name, sku:movData.sku, type:movData.type, qty:movData.qty, note:movData.note, stockAfter:movData.stock_after, discount:Number(movData.discount), date:new Date(movData.created_at).toLocaleString('es-CO') }
      setDb(db => ({ ...db, movements: [mapped, ...db.movements] }))
    }

    // Registrar domicilio si aplica
    if (delivery?.name) {
      const orderValue = resolvedLines.reduce((s,r) => s + r.product.price * r.qty, 0)
      const { data: delData, error: delErr } = await supabase.from('deliveries').insert({
        name: delivery.name, phone: delivery.phone, address: delivery.address,
        value: Number(delivery.value)||0, order_value: orderValue,
        discount: Number(discount)||0,
        products: resolvedLines.map(r => `${r.product.name} x${r.qty}`),
      }).select().single()
      if (!delErr && delData) {
        const mapped = { id:delData.id, name:delData.name, phone:delData.phone, address:delData.address, value:Number(delData.value), orderValue:Number(delData.order_value), discount:Number(delData.discount), products:delData.products, date:new Date(delData.created_at).toLocaleString('es-CO') }
        setDb(db => ({ ...db, deliveries: [mapped, ...db.deliveries] }))
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SETTINGS
  // ══════════════════════════════════════════════════════════════════════════
  const saveSettings = async (s) => {
    check(await supabase.from('settings').update({
      business_name: s.businessName, business_phone: s.businessPhone,
      business_address: s.businessAddress, low_stock_threshold: s.lowStockThreshold,
    }).eq('id', 1))
    setDb(db => ({ ...db, settings: s }))
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  RESET DB
  // ══════════════════════════════════════════════════════════════════════════
  const resetDB = async () => {
    await Promise.all([
      supabase.from('movements').delete().neq('id', 0),
      supabase.from('deliveries').delete().neq('id', 0),
      supabase.from('orders').delete().neq('id', 0),
      supabase.from('products').delete().neq('id', 0),
      supabase.from('clients').delete().neq('id', 0),
      supabase.from('providers').delete().neq('id', 0),
      supabase.from('payment_methods').delete().neq('id', 0),
      supabase.from('categories').delete().neq('id', 0),
      supabase.from('settings').update({ business_name:'Mi Negocio', business_phone:'', business_address:'', low_stock_threshold:5 }).eq('id',1),
    ])
    await loadAll()
  }

  return {
    db, loading, error, reload: loadAll,
    // products
    addProduct, editProduct, deleteProduct,
    // categories
    addCategory, editCategory, deleteCategory,
    // clients
    addClient, editClient, deleteClient,
    // providers
    addProvider, editProvider, deleteProvider,
    // payment methods
    addPaymentMethod, editPaymentMethod, deletePaymentMethod,
    // orders
    addOrder, editOrder, advanceOrder, cancelOrder,
    // movements
    registerMovement,
    // settings
    saveSettings,
    // reset
    resetDB,
  }
}

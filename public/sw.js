const CACHE_NAME = "invenpro-v2";
const ASSETS = ["/", "/index.html", "/manifest.json"];
const NOTIFY_INTERVAL = 8 * 60 * 60 * 1000; // 8 horas en ms
const NOTIFY_KEY = "invenpro_last_notify";

// ── Instalar ─────────────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

// ── Activar ──────────────────────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
  // Programar el primer chequeo al activar
  scheduleCheck();
});

// ── Fetch: cache-first ───────────────────────────────────────
self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).catch(() => caches.match("/index.html"))
    )
  );
});

// ── Mensajes desde la app ────────────────────────────────────
self.addEventListener("message", (e) => {
  if (e.data?.type === "CHECK_ALERTS") {
    // La app envía los datos de stock bajo y pedidos pendientes
    handleAlerts(e.data.payload);
  }
  if (e.data?.type === "SCHEDULE_CHECK") {
    scheduleCheck();
  }
});

// ── Click en notificación ────────────────────────────────────
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      // Si la app ya está abierta, la enfoca
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      // Si no, la abre
      return clients.openWindow("/");
    })
  );
});

// ── Programar chequeo periódico ──────────────────────────────
function scheduleCheck() {
  // Usamos setTimeout encadenado dentro del SW
  // (el SW puede ser suspendido por el browser entre checks)
  self.registration.showNotification; // mantiene el SW activo
}

// ── Procesar alertas y mostrar notificaciones ─────────────────
function handleAlerts({ lowStock = [], pendingOrders = 0, threshold = 5 }) {
  const now = Date.now();

  const notifications = [];

  if (lowStock.length > 0) {
    const agotados = lowStock.filter(p => p.stock === 0);
    const bajos    = lowStock.filter(p => p.stock > 0);

    if (agotados.length > 0) {
      notifications.push({
        title: `🚨 ${agotados.length} producto${agotados.length > 1 ? "s" : ""} agotado${agotados.length > 1 ? "s" : ""}`,
        body: agotados.map(p => p.name).join(", "),
        tag: "agotado",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { tab: "Alertas" },
        vibrate: [200, 100, 200],
      });
    }

    if (bajos.length > 0) {
      notifications.push({
        title: `⚠️ Stock bajo en ${bajos.length} producto${bajos.length > 1 ? "s" : ""}`,
        body: bajos.map(p => `${p.name} (${p.stock} ${p.unit})`).join(", "),
        tag: "stock-bajo",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { tab: "Alertas" },
        vibrate: [100, 50, 100],
      });
    }
  }

  if (pendingOrders > 0) {
    notifications.push({
      title: `🛒 ${pendingOrders} pedido${pendingOrders > 1 ? "s" : ""} pendiente${pendingOrders > 1 ? "s" : ""}`,
      body: "Tienes pedidos esperando ser procesados",
      tag: "pedidos",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { tab: "Pedidos" },
      vibrate: [100],
    });
  }

  // Mostrar cada notificación
  notifications.forEach(n => {
    self.registration.showNotification(n.title, {
      body:    n.body,
      tag:     n.tag,
      icon:    n.icon,
      badge:   n.badge,
      data:    n.data,
      vibrate: n.vibrate,
      renotify: true,
      requireInteraction: false,
      silent: false,
    });
  });
}

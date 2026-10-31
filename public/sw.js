// Service Worker del panel: solo para las notificaciones push (ver
// lib/push.js). No cachea nada: la app siempre va a la red.

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

// El servidor manda JSON { title, body, url }.
self.addEventListener("push", (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        // Payload no JSON: se muestra algo genérico igualmente.
    }
    event.waitUntil(
        self.registration.showNotification(data.title || "FilmRD", {
            body: data.body || "",
            icon: "/icon.png",
            badge: "/icon.png",
            data: { url: data.url || "/admin" },
        })
    );
});

// Tocar la notificación abre la URL. openWindow es lo más fiable: si la
// PWA ya está abierta, el sistema la trae al frente (igual que en
// pandora-tcg, donde client.navigate dio problemas).
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = new URL((event.notification.data && event.notification.data.url) || "/admin", self.location.origin).href;
    event.waitUntil(self.clients.openWindow(url));
});

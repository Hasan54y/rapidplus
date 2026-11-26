// Service worker for Rapid+ Blog article alerts. It only shows push notifications; it caches nothing.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : "" }; }
  const title = String(d.title || "New on Rapid+ Blog").slice(0, 120);
  const img = typeof d.image === "string" && d.image.startsWith("/") ? d.image : "";
  const android = /Android/i.test(self.navigator.userAgent || "");
  const opts = {
    body: String(d.body || "").slice(0, 240),
    // Android shows the icon beside the title even when the alert is collapsed, so use the article thumbnail there;
    // desktops show the icon as a small square, so keep the logo and show the thumbnail as the large image.
    icon: img && android ? img : "/assets/favicon-192.png",
    badge: "/assets/notify-badge.png",
    tag: d.tag || "rapid-blog",
    data: { url: typeof d.url === "string" && d.url.startsWith("/") ? d.url : "/blog/" },
    timestamp: Date.now(),
    renotify: false
  };
  if (img) opts.image = img;
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/blog/", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url === url && "focus" in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});

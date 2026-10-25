// This worker receives FCM web push through an explicit registration. No
// Firebase configuration or user credentials are embedded in the worker.
self.addEventListener('push', event => {
    let message;
    try { message = event.data?.json(); } catch { return; }
    const data = message?.data ?? message;
    if (!data || typeof data.title !== 'string' || typeof data.body !== 'string') return;
    let target;
    try { target = new URL(data.url || '/mobile-remote', self.location.origin); } catch { return; }
    if (target.origin !== self.location.origin || target.pathname !== '/mobile-remote') return;
    event.waitUntil(self.registration.showNotification(data.title.slice(0, 100), {
        body: data.body.slice(0, 200),
        icon: '/icon-remote-192.png',
        badge: '/favicon-remote.svg',
        tag: typeof data.tag === 'string' ? data.tag.slice(0, 100) : undefined,
        data: { url: target.href },
    }));
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    let target;
    try { target = new URL(event.notification.data?.url || '/mobile-remote', self.location.origin); } catch { return; }
    if (target.origin !== self.location.origin || target.pathname !== '/mobile-remote') return;
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
        const existing = clients.find(client => new URL(client.url).origin === target.origin);
        if (existing) {
            await existing.navigate(target.href);
            return existing.focus();
        }
        return self.clients.openWindow(target.href);
    }));
});

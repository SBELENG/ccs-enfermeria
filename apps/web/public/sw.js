self.addEventListener('push', function (event) {
    if (!event.data) return;

    const data = event.data.json();
    const options = {
        body: data.body,
        icon: '/logo-icon.png', // Asegúrate de que esta ruta sea válida
        badge: '/logo-icon.png',
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});

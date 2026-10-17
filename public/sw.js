// Retire the service worker left by an older app on this origin.
// EasyJob does not use offline navigation: every route must reach Next.js.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: 'window' });
    await Promise.all(windows.map(async (client) => {
      if (new URL(client.url).origin !== self.location.origin) return;
      try {
        await client.navigate(client.url);
      } catch {
        // A tab may have closed while the worker was being retired.
      }
    }));
  })());
});

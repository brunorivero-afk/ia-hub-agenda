// Força ativação imediata sem esperar fechar todas as abas
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(clients.claim()));

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Nunca servir index.html do cache HTTP — sempre buscar do servidor
  if (url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
  } else {
    event.respondWith(fetch(event.request));
  }
});

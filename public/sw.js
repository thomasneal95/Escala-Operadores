// Service worker do Jornada 360.
//
// Só guarda os arquivos do próprio site: as telas (index.html) vêm sempre da
// rede primeiro, e os arquivos de /assets/ (que mudam de nome a cada deploy)
// ficam guardados para abrir rápido. Dados do Supabase nunca passam por aqui,
// então ninguém vê escala ou valores desatualizados.

const CACHE = 'jornada360-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put('/', copia));
          return resp;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (salvo) =>
          salvo ||
          fetch(req).then((resp) => {
            if (resp.ok) {
              const copia = resp.clone();
              caches.open(CACHE).then((c) => c.put(req, copia));
            }
            return resp;
          })
      )
    );
  }
});

// Notificações (Web Push): o servidor manda { titulo, corpo, aba }.
self.addEventListener('push', (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { corpo: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(dados.titulo || 'Jornada 360', {
      body: dados.corpo || '',
      icon: '/icone-192.png',
      badge: '/icone-192.png',
      data: { aba: dados.aba || null },
    })
  );
});

// Ao tocar: abre o app (ou traz para a frente) já na aba da notificação.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const aba = event.notification.data && event.notification.data.aba;
  const url = aba ? `/?aba=${encodeURIComponent(aba)}` : '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      const aberta = janelas.find((j) => new URL(j.url).origin === self.location.origin);
      if (aberta) {
        return aberta
          .navigate(url)
          .then((j) => (j || aberta).focus())
          .catch(() => self.clients.openWindow(url));
      }
      return self.clients.openWindow(url);
    })
  );
});

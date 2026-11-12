// Puerta de entrada mínima: todo lo sirve la carpeta dist/ (ASSETS), salvo los
// archivos de verificación de Google, que deben responder en su URL exacta (.html incluido).
const VERIFICACIONES = {
  '/google90dd58e28f6c53c0.html': 'google-site-verification: google90dd58e28f6c53c0.html'
};
export default {
  async fetch(request, env) {
    const ruta = new URL(request.url).pathname;
    if (VERIFICACIONES[ruta]) {
      return new Response(VERIFICACIONES[ruta], { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' } });
    }
    return env.ASSETS.fetch(request);
  }
};

// Puerta de entrada de la web:
// 1) Una sola dirección oficial: http:// y www. se redirigen (301) a https://metalicassincelejo.com
// 2) Archivos de verificación de Google en su URL exacta (.html incluido)
// 3) Todo lo demás lo sirve la carpeta dist/ (ASSETS)
const DOMINIO = 'metalicassincelejo.com';
const VERIFICACIONES = {
  '/google90dd58e28f6c53c0.html': 'google-site-verification: google90dd58e28f6c53c0.html'
};
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const esNuestro = url.hostname === DOMINIO || url.hostname === 'www.' + DOMINIO;
    if (esNuestro && (url.protocol === 'http:' || url.hostname !== DOMINIO)) {
      url.protocol = 'https:';
      url.hostname = DOMINIO;
      return Response.redirect(url.toString(), 301);
    }
    if (VERIFICACIONES[url.pathname]) {
      return new Response(VERIFICACIONES[url.pathname], { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' } });
    }
    return env.ASSETS.fetch(request);
  }
};

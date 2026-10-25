# Vitrina — Almacén Metálicas Sincelejo

Tienda web estática (sin servidor) para **metalicassincelejo.com**, publicada en Cloudflare Pages. Toma los productos de la colección `catalogo` de Firestore (la misma que llenas desde el panel y que usa el bot de WhatsApp) y genera todo lo que Google y Meta necesitan para mostrarte.

## Qué incluye

| Para vender | Para Google | Para redes |
|---|---|---|
| Catálogo con buscador, filtros por categoría, marca, ofertas y orden por cuota | Una página propia por producto y por categoría ("Neveras a crédito en Sincelejo") | Feed de catálogo para Facebook/Instagram Shopping (`/feeds/meta.csv`) |
| Cuota mensual destacada en cada producto | Datos estructurados: Tienda local, Producto, Migas, Preguntas frecuentes, Buscador | Vista previa al compartir (Open Graph) en WhatsApp, Facebook, X |
| "Mi cotización": varios productos enviados juntos a WhatsApp Ventas | `sitemap.xml` con imágenes y `robots.txt` | Meta Pixel con eventos de compra (Ver producto, Agregar, Lead) |
| Botón flotante con las 3 líneas: ventas, cartera, soporte | Feed para Google Merchant Center (`/feeds/google.xml`) → listados gratis en Google Shopping | |
| Reseñas reales con aprobación manual | Google Analytics 4 con los mismos eventos | |
| Mapa, "Cómo llegar", preguntas frecuentes | Fotos extraídas a archivos livianos (no base64) | |
| Aviso de cookies y política de datos (Ley 1581) | Tiempos de carga bajos: sin librerías, HTML prerenderizado | |

## Departamentos y categorías

La web agrupa las categorías del panel en **departamentos** (Neveras y congeladores, Lavadoras, Estufas y cocina, etc.).
Se configuran en `public/assets/config.js` → `departamentos`. Si creas una categoría nueva en el panel y no la agregas a
ningún departamento, aparece en "Más para tu hogar". Para corregir cómo se ve el nombre de una categoría usa `aliasCategorias`.

Direcciones:
- `/categoria/<departamento>/` y `/categoria/<departamento>/<categoria>/` con 24 productos por página (`/pagina/2/`, …)
- `/buscar/?q=…` buscador
- `/producto/<id>/` ficha del producto
Las direcciones viejas (`/categoria/neveras/`, etc.) redirigen solas a las nuevas.

## Archivos

```
public/             ← el sitio (plantillas)
  assets/config.js  ← ★ ÚNICO archivo que debes editar: teléfonos, redes, horario, GA4, Pixel
  assets/app.js     ← lógica del navegador
  assets/styles.css
  index.html        ← página de inicio (plantilla)
  politica-de-privacidad/
build.js            ← genera dist/ leyendo Firestore
firestore.rules     ← reglas que debes agregar en Firebase
```

## 1. Antes de publicar (5 minutos)

1. **Reglas de Firebase** — en la consola de `prueba-para-debido` → Firestore → Reglas, agrega los bloques de `catalogo` y `resenas` de `firestore.rules` **sin borrar tus reglas actuales**. Sin esto el build no puede leer el catálogo.
2. **`public/assets/config.js`** — confirma el WhatsApp de ventas y llena: WhatsApp de cartera y soporte, horario, coordenadas del local, redes sociales y, si tienes, el logo (`/img/logo.png`).

## 2. Publicar (elige una opción)

### Opción A — Firebase Hosting (la más simple, recomendada)
Usa el mismo proyecto de Firebase donde ya está tu catálogo. No necesitas GitHub.

1. Instala Node.js (nodejs.org, versión LTS) si no lo tienes.
2. Haz **doble clic en `publicar.bat`**. La primera vez te pide iniciar sesión con la cuenta de Google dueña de Firebase.
   Eso genera la web con tus productos reales y la publica en `https://prueba-para-debido.web.app`.
3. Dominio propio: Firebase Console → Hosting → **Agregar dominio personalizado** → `metalicassincelejo.com`.
   Firebase te muestra 2 registros (A / TXT); créalos en Cloudflare → DNS con la nube **gris** (solo DNS).
4. Cada vez que cambies productos en el panel, vuelve a hacer doble clic en `publicar.bat`.

⚠️ Las reglas: **no uses** `firebase deploy` sin `--only hosting` hasta revisar `firestore.rules`, porque reemplazaría todas tus reglas actuales. Copia los bloques a mano en la consola.

### Opción B — Cloudflare Pages

1. Sube esta carpeta a un repositorio de GitHub.
2. Cloudflare → Workers & Pages → Crear → Pages → Conectar con Git → elige el repositorio.
3. Configuración de compilación:
   - **Comando de compilación:** `node build.js`
   - **Directorio de salida:** `dist`
   - Variable de entorno `NODE_VERSION` = `20`
4. En "Dominios personalizados" agrega `metalicassincelejo.com` y `www.metalicassincelejo.com`.

## 3. Cuando cambies productos en el panel (si usas Cloudflare)

Las páginas se generan al publicar, así que hay que volver a construir el sitio:

- **Manual:** Cloudflare Pages → tu proyecto → Implementaciones → "Reintentar implementación".
- **Automático (recomendado):** en Configuración → Compilaciones → **Deploy hooks** crea uno y copia la URL. Luego:
  - agrega un botón "Publicar en la web" en el panel que haga `fetch(URL_DEL_HOOK, {method:'POST'})`, o
  - prográmalo a diario (por ejemplo con un cron gratis en cron-job.org que llame esa URL a las 6 a. m.).

Mientras tanto, el sitio carga el catálogo publicado (`/catalogo.json`); si no existe, lo lee directo de Firestore.

**Consejo:** productos sin foto no aparecen en Google Shopping ni en Instagram. El build te avisa cuántos son.

## 4. Posicionamiento: lo que debes hacer tú (en orden)

**Semana 1 — Google**
1. **Google Search Console** (search.google.com/search-console): agrega `metalicassincelejo.com` como "Dominio" (se verifica solo con un registro DNS en Cloudflare). Envía `https://metalicassincelejo.com/sitemap.xml`.
2. **Perfil de Empresa en Google**: pon el sitio web `https://metalicassincelejo.com`, categoría principal "Tienda de electrodomésticos" y secundaria "Tienda de muebles". El nombre, dirección y teléfono deben ser **idénticos** a los de la web (Google compara). Sube fotos reales de la fachada y del interior.
3. **Google Merchant Center** (merchants.google.com): verifica el sitio, en Productos → Fuentes agrega una "fuente programada" con `https://metalicassincelejo.com/feeds/google.xml` (diaria). Activa "Fichas gratuitas". Configura envío (domicilio en Sincelejo) y la política de devoluciones, que Google exige.
4. **Google Analytics 4**: crea la propiedad, copia el ID `G-XXXX` en `config.js` y vincúlala con Merchant Center.

**Semana 2 — Meta (Facebook / Instagram / WhatsApp)**
1. **Meta Business Suite** → Administrador de ventas → Catálogo → Fuente de datos → "Feed programado" con `https://metalicassincelejo.com/feeds/meta.csv`.
2. Verifica el dominio (Configuración del negocio → Seguridad de la marca → Dominios) y pega el código en `metaVerificacion`.
3. Crea el Pixel y pega su ID en `metaPixel`. Con el catálogo + Pixel puedes etiquetar productos en publicaciones de Instagram y hacer anuncios de catálogo.
4. En **WhatsApp Business** de Ventas, conecta el mismo catálogo de Meta para que aparezca dentro del chat.

**Cada semana — lo que más mueve el posicionamiento local**
- Pide reseñas en Google a cada cliente que recibe su producto (envíale por WhatsApp el enlace de tu perfil). Las reseñas recientes pesan mucho.
- Publica 1 vez por semana en el Perfil de Google (oferta o producto nuevo) y en Instagram/TikTok (video corto mostrando el producto en la tienda, siempre con la cuota mensual).
- Mantén las descripciones de productos completas (medidas, capacidad, voltaje): son lo que Google lee.
- Aprueba las reseñas de la web en Firestore → `resenas` → cambia `aprobado` a `true`.

## Prueba local

```bash
node build.js                     # con Firestore real
node build.js --local datos.json  # con un JSON de prueba
npx serve dist                    # abrir http://localhost:3000
```

## Cosas pendientes de confirmar

- WhatsApp de ventas (`573215383870` es provisional), cartera y soporte.
- Horario y coordenadas exactas del local.
- Logo real en `public/img/logo.png` (mientras tanto se usa el logotipo de texto).
- Revisión de la política de datos por un abogado si vas a usar los datos para publicidad.

# Diseño — Almacén Metálicas Sincelejo

Referencias: Alkosto/Ktronix, Éxito, Falabella y Mercado Libre (tiendas más visitadas de Colombia).
Esencia: tienda de barrio con más de 30 años, crédito directo, cuota mensual como protagonista.

## Colores
| Token | Hex | Uso |
|---|---|---|
| --azul | #2E3095 | Marca, barra de departamentos, cuota, botones primarios |
| --azul-900 | #1B1D63 | Franja superior, banda de negocio |
| --rojo | #E4131F | Descuentos (-%), llamadas a la acción de venta, acento |
| --wa | #1FAF55 | Solo para WhatsApp |
| --ink / --ink-2 / --ink-3 | #14163A / #4A4D6E / #6E7192 | Texto |
| --fondo / --linea | #F4F5FA / #E3E5F0 | Secciones alternas, bordes |

## Tipografía
- Títulos y cifras de cuota: Bricolage Grotesque 800, tracking -0.03em.
- Texto: Figtree 400–800.

## Estructura (rediseño nov 2026, con impeccable + taste-skill + Emil Kowalski)
- Inicio: portada única (sin carrusel) con el producto en oferta en grande, su etiqueta de cuota, el sello rojo "Más de 30 años en Sucre" y "Cuotas desde" → cinta de entregas reales que desfila → franja de confianza en una línea → mosaico de departamentos (2 grandes + resto) → ofertas en franja roja → banda negocio → 2 vitrinas por departamento → así compras (producto real, chat de WhatsApp, entrega) → canales → opiniones → momento "Más de 30 años en Sucre" con fachada y mapa (la Avenida Okola queda como dirección) → preguntas.
- Departamentos (config.js) → categorías → producto. 24 productos por página, cada página con su URL.
- Tarjeta: marca, nombre (2 líneas), etiqueta de precio (fondo azul-50 con "ojal": cuota grande en azul, contado debajo), -% en rojo con forma de etiqueta, botón "Agregar a cotización".
- Ficha de producto en celular: barra fija abajo con la cuota y "Lo quiero"; sin botón flotante.

## Movimiento
- Curvas: --ease-out cubic-bezier(0.23,1,0.32,1) para UI, --ease-drawer cubic-bezier(0.32,0.72,0,1) para el panel, --ease-mov cubic-bezier(0.77,0,0.175,1) para el vuelo a la cotización.
- Un momento por página: entrada de la portada (700 ms, escalonada 80 ms) y la foto que vuela a "Mi cotización" (560 ms) con salto del contador.
- Hover solo con mouse: tarjeta sube 2 px y la foto se acerca 3 %. Todo se apaga con "reducir movimiento".

## Fotos pendientes (reemplazan elementos dibujados)
- Camión o moto entregando (paso 3 de "Así compras", marcado con comentario FOTO en build.js).
- Fachada en alta resolución (la actual es de 647 px).

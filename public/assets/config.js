/* ================================================================
   CONFIGURACIÓN DE LA TIENDA — edita SOLO este archivo.
   Lo usan la página (navegador) y el script build.js (SEO).
   Campos vacíos ('') simplemente no se muestran.
   ================================================================ */
window.TIENDA = {
  nombre: 'Almacén Metálicas Sincelejo',
  nombreCorto: 'Metálicas Sincelejo',
  lema: 'Calidad y servicio',
  anios: 30,                                   // "más de 30 años"
  dominio: 'https://metalicassincelejo.com',   // sin "/" al final
  logo: '',                                    // ej: '/img/logo.png' (si lo dejas vacío se usa el logotipo de texto)

  // Números de WhatsApp en formato internacional, solo dígitos (57 + celular)
  whatsapp: {
    ventas:  '573215383870',   // ⚠️ confirmar
    cartera: '',               // pendiente
    soporte: ''                // pendiente
  },
  telefono: '+57 321 538 3870',
  correo: '',

  direccion: {
    calle: 'Cra. 25 #25-82, Avenida Okola',
    ciudad: 'Sincelejo',
    departamento: 'Sucre',
    codigoPostal: '700001',
    pais: 'CO'
  },
  // Coordenadas exactas del local (cópialas de Google Maps: clic derecho sobre el pin).
  geo: { lat: null, lng: null },

  // Horario. Formato 24h. Déjalo vacío si aún no lo confirmas.
  // Ej: { dias: ['Mo','Tu','We','Th','Fr'], abre: '08:00', cierra: '18:00' }
  horario: [],
  horarioTexto: '',            // ej: 'Lunes a sábado, 8:00 a. m. – 6:00 p. m.'

  redes: {
    facebook: '',              // URL completa
    instagram: '',
    tiktok: '',
    youtube: ''
  },
  googlePerfil: 'https://share.google/iZpN5yipGssH2x0Dc',

  // Medición (se activan solo si el visitante acepta cookies)
  ga4: '',                     // ej: 'G-XXXXXXXXXX'
  metaPixel: '',               // ej: '123456789012345'
  googleVerificacion: '',      // contenido de la meta "google-site-verification"
  metaVerificacion: '',        // contenido de la meta "facebook-domain-verification"

  // Firestore (proyecto principal, colección 'catalogo' y 'resenas')
  firebase: {
    projectId: 'prueba-para-debido',
    apiKey: 'AIzaSyA0-xfeXa5KcHVo011p0RTIHQ81-8pvsjY'
  },

  nit: '901.159.954-3'
};

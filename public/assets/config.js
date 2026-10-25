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
  logo: '/img/logo.png',                                  // ej: '/img/logo.png' (si lo dejas vacío se usa el logotipo de texto)

  // Números de WhatsApp en formato internacional, solo dígitos (57 + celular)
  whatsapp: {
    ventas:  '573163327031',
    cartera: '573052399487',
    soporte: '573215383876'
  },
  telefono: '+57 316 332 7031',
  correo: '',

  direccion: {
    calle: 'Cra. 25 #25-82, Avenida Okola',
    ciudad: 'Sincelejo',
    departamento: 'Sucre',
    codigoPostal: '700001',
    pais: 'CO'
  },
  // Coordenadas exactas del local (cópialas de Google Maps: clic derecho sobre el pin).
  geo: { lat: 9.304722, lng: -75.397778 },

  // Horario. Formato 24h. Déjalo vacío si aún no lo confirmas.
  // Ej: { dias: ['Mo','Tu','We','Th','Fr'], abre: '08:00', cierra: '18:00' }
  horario: [{ dias: ['Mo','Tu','We','Th','Fr','Sa'], abre: '08:00', cierra: '18:00' }],
  horarioTexto: 'Lunes a sábado, 8:00 a. m. a 6:00 p. m.',

  redes: {
    facebook: '',              // URL completa
    instagram: 'https://www.instagram.com/metalicassincelejo',
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

  nit: '901.159.954-3',

  /* ---------------------------------------------------------------
     DEPARTAMENTOS — agrupan las categorías que escribes en el panel.
     'categorias' usa el nombre de la categoría tal como está en el panel,
     sin importar mayúsculas ni tildes. Si una categoría nueva no está
     en ninguna lista, cae en el último departamento ("Más para tu hogar").
     --------------------------------------------------------------- */
  departamentos: [
    { slug: 'neveras-y-congeladores', nombre: 'Neveras y congeladores', icono: 'nevera',
      categorias: ['Neveras', 'Neveras Inverter', 'Congeladores'] },
    { slug: 'lavadoras', nombre: 'Lavadoras', icono: 'lavadora',
      categorias: ['Lavadoras', 'Secadoras'] },
    { slug: 'estufas-y-cocina', nombre: 'Estufas y cocina', icono: 'estufa',
      categorias: ['Estufas', 'Cocina', 'Estufas de Gabinete', 'Estufas con Horno', 'Menaje', 'Hornos'] },
    { slug: 'televisores-y-audio', nombre: 'Televisores y audio', icono: 'tv',
      categorias: ['Televisores', 'Audio', 'Parlantes de Sonido'] },
    { slug: 'muebles-y-descanso', nombre: 'Muebles y descanso', icono: 'cama',
      categorias: ['Camas', 'Colchones', 'Closeth', 'Comedores', 'Salas'] },
    { slug: 'aires-acondicionados', nombre: 'Aires acondicionados', icono: 'aire',
      categorias: ['Aires Acondicionados', 'Ventiladores'] },
    { slug: 'equipos-para-negocio', nombre: 'Equipos para tu negocio', icono: 'vitrina',
      descripcion: 'Vitrinas, cubeteros y botelleros para tiendas, restaurantes y negocios.',
      categorias: ['Vitrina', 'Vitrinas', 'Cubeteros', 'Botelleros'] },
    { slug: 'muebles-metalicos', nombre: 'Muebles metálicos', icono: 'locker',
      descripcion: 'Archivadores, lockers y estanterías metálicas para oficina, colegio o bodega.',
      categorias: ['Archivadores Metálicos', 'Lockers Metálicos', 'Lockers s', 'Estantería Metálica'] },
    { slug: 'mas-para-tu-hogar', nombre: 'Más para tu hogar', icono: 'hogar',
      categorias: ['Máquinas de Coser', 'Gimnasio'] }
  ],

  // Corrige o une nombres de categorías del panel (izquierda) → nombre que se muestra (derecha)
  aliasCategorias: {
    'Closeth': 'Clósets',
    'Lockers s': 'Lockers metálicos',
    'Lockers Metálicos': 'Lockers metálicos',
    'Audio': 'Audio y parlantes',
    'Parlantes de Sonido': 'Audio y parlantes',
    'Cocina': 'Estufas',
    'comedores': 'Comedores y salas',
    'Vitrina': 'Vitrinas',
    'Neveras Inverter': 'Neveras inverter',
    'Estantería Metálica': 'Estanterías metálicas',
    'Archivadores Metálicos': 'Archivadores metálicos',
    'Estufas de Gabinete': 'Estufas de gabinete',
    'Estufas con Horno': 'Estufas con horno',
    'Aires Acondicionados': 'Aires acondicionados',
    'Máquinas de Coser': 'Máquinas de coser'
  },

  productosPorPagina: 24
};

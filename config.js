window.STORE_CONFIG = {
  supabaseUrl: 'https://minqplrkeatulamldvvb.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnFwbHJrZWF0dWxhbWxkdnZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NDA2NDcsImV4cCI6MjEwNjMxNjY0N30.4Z8sxZGq0aP57_ZI204_8ggGWmynp3NI86e-025Jb9k',
  // Datos del negocio. Déjalos vacíos hasta tener los reales: la tienda oculta lo que no esté configurado.
  business: {
    legalName: '',        // Razón social, p. ej. 'MSJ Fashion Store S.A.C.'
    ruc: '',              // RUC de 11 dígitos
    address: '',          // Domicilio fiscal
    email: '',            // Correo de atención al cliente
    whatsapp: '51903117997', // Solo dígitos con código de país (903 117 997)
    instagram: 'https://www.instagram.com/fashionstore47692/',        // URL completa del perfil
    tiktok: 'https://www.tiktok.com/@msj_fashion_store',
    facebook: 'https://www.facebook.com/people/Msj-Fashionstore/pfbid02AbJmzhJkUewgjJsncmURX1QahJbDcz9ojN6eArdX61utW2aQueDyjE6ZtpsDytRdl/'
  },
  // Monto (PEN) desde el que el envío es gratis; null para ocultar la barra de envío gratis.
  freeShippingFrom: null,
  // Pago con billeteras por QR. El dinero llega directo a tu Yape o a tu Lemon (y de ahí a la cuenta o tarjeta vinculada);
  // el equipo confirma cada número de operación en el panel. Deja qrImage vacío para ocultar una billetera.
  // number es opcional (celular para yapear sin escanear).
  yape: { number: '', holder: 'Samuel Amos Villanueva Chinchay', qrImage: 'yape-qr.png' },
  // QR interoperable de Lemon: se paga desde Yape, Plin o la app de cualquier banco con «Pago con QR».
  lemon: { holder: 'Samuel Amos Villanueva Chinchay', qrImage: 'lemon-qr.png' },
  // Campaña solidaria: aporte voluntario del cliente + 1% de cada venta (ver donation_stats en database/campaigns.sql).
  // Cada causa tiene su meta. beneficiary: la organización que recibirá lo recaudado; escríbela solo cuando esté confirmada.
  // Las claves (key) deben coincidir con las de checkout_cart: el-nino, cancer, arboles, friaje, educacion.
  donation: { title: 'MSJ Unidos por el Perú', cause: 'causas solidarias del Perú', goal: 5000, storePercent: 1,
    // sample: % de avance de muestra que se ve mientras la causa aún no tiene donaciones reales (se marca como «muestra»).
    // reward: lo que se entrega al llegar a la meta. impacts: tipos de ayuda (ícono, texto).
    causes: [
      { key: 'el-nino', icon: '🌊', title: 'Fenómeno El Niño', text: 'Ayuda para familias del norte afectadas por lluvias e inundaciones.', goal: 8000, sample: 68, beneficiary: '',
        reward: '200 kits familiares de víveres, agua y ropa + 100 árboles para proteger las laderas', impacts: [['🥫','Víveres'],['💧','Agua'],['👕','Ropa'],['🌳','Árboles']] },
      { key: 'cancer', icon: '🎗️', title: 'Niños con cáncer', text: 'Apoyo a niños en tratamiento oncológico y a sus familias.', goal: 6000, sample: 45, beneficiary: '',
        reward: 'Alojamiento, alimentación y traslados por un mes para 8 familias', impacts: [['🏠','Alojamiento'],['🍲','Alimentación'],['🚌','Traslados']] },
      { key: 'arboles', icon: '🌳', title: 'Un árbol por tu compra', text: 'Reforestación de zonas dañadas por huaicos y deforestación.', goal: 3000, sample: 82, beneficiary: '',
        reward: '600 plantones nativos sembrados en el norte y la Amazonía', impacts: [['🌱','Plantones'],['🌳','Reforestación'],['🌍','Planeta']] },
      { key: 'friaje', icon: '🧣', title: 'Abrigo contra el friaje', text: 'Abrigo para comunidades altoandinas en temporada de heladas.', goal: 5000, sample: 57, beneficiary: '',
        reward: '150 casacas, chompas y frazadas para familias altoandinas', impacts: [['🧥','Casacas'],['🧣','Chompas'],['🛏️','Frazadas']] },
      { key: 'educacion', icon: '📚', title: 'Útiles para aprender', text: 'Útiles escolares para estudiantes de zonas rurales.', goal: 4000, sample: 33, beneficiary: '',
        reward: '160 mochilas completas con útiles escolares', impacts: [['🎒','Mochilas'],['✏️','Útiles'],['📖','Libros']] }
    ] },
  // URL pública de la tienda (con https). Se usa para los enlaces de los correos (confirmar cuenta, recuperar contraseña)
  // y para volver desde Mercado Pago. Vacía = se usa la dirección desde donde se abre la tienda.
  siteUrl: '',
  // De dónde sale el catálogo: 'supabase' = solo productos, precios y stock de la base de datos (recomendado);
  // 'mixto' = además muestra los de catalog-data.js que aún no se cargaron. Para cargar todo: database/seed_catalog.sql.
  catalogSource: 'supabase',
  // Funciones opcionales. passkeys (huella / rostro): ponlo en true solo cuando la Edge Function «passkeys»
  // esté desplegada y la tienda publicada con HTTPS; mientras sea false, esas opciones no se muestran.
  // mercadoPago / mercadoLibre: APAGADOS hasta tener las credenciales (ver docs/integraciones-mercado-pago-libre.md).
  // mishiAI: respuestas con IA (Claude) en M.I.S.H.I.; actívalo después de desplegar la Edge Function «mishi-ai».
  features: { passkeys: false, mercadoPago: false, mercadoLibre: false, mishiAI: false },
  // Respaldo sin base de datos (el panel → Centro 2026 → Personalización manda cuando database/v2026.sql está instalado).
  season: { mode: 'christmas', enabled: true, starts_at: '2026-11-01T00:00:00-05:00', ends_at: '2027-01-07T00:00:00-05:00', snow: true, lights: true,
    headline: 'Navidad MSJ', subline: 'Regalos que se sienten como un abrazo. Envolvemos gratis cada pedido.', gift_wrap: true },
  teaser2027: { enabled: true, title: '2027 · Coming soon', subtitle: 'Neo Minimal: la nueva colección MSJ llega con el año nuevo.',
    launch_at: '2027-01-01T00:00:00-05:00', cta: 'Avísame primero', frequency: 'daily' },
  loyalty: { enabled: true, points_per_sol: 1, welcome_points: 50, review_points: 20, checkin_points: 5, streak_bonus: 25, streak_every: 7,
    multipliers: { gold: 1.5, black: 2 }, rewards: [{ points: 500, amount: 10, min: 80 }, { points: 1000, amount: 25, min: 150 }, { points: 2000, amount: 60, min: 300 }] }
};

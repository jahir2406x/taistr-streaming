/**
 * QUÉ ES ESTE ARCHIVO: Datos principales de tu marca (TaiSTR), contacto por WhatsApp y redes sociales.
 * QUÉ PUEDES CAMBIAR: Los textos entre comillas (nombre, eslogan, número de WhatsApp, horarios, redes).
 * QUÉ NO TOCAR: Los nombres de las propiedades a la izquierda de los dos puntos (:) ni el `export const MARCA`.
 */

export const MARCA = {
  nombre: 'TaiSTR',
  eslogan: 'Cuentas y perfiles de streaming baratos en Perú. Activación en minutos por WhatsApp.',
  descripcion:
    'Cuentas y perfiles de streaming baratos en Perú en soles (S/). Netflix 4K, Disney+, Max, Spotify y más plataformas con entrega inmediata por WhatsApp, pago con Yape o Plin y garantía total.',
  paisPorDefecto: 'Perú',
  monedaPorDefecto: 'S/',
  // Número de WhatsApp en formato internacional sin "+" ni espacios (Ej: 51999999999)
  numeroWhatsapp: '51929475325',
  correoContacto: 'taicorp2406x@gmail.com',
  anioActual: 2026,
  horarioSoporte: 'Lunes a Domingo · 9:00 a.m. a 10:30 p.m. (GMT-5)',
  // Horario en formato 24 h usado por el indicador "En línea ahora" del hero (debe coincidir con horarioSoporte).
  // utcOffset: diferencia horaria respecto a UTC (Perú = -5).
  horarioAtencion: { abre: '09:00', cierra: '22:30', utcOffset: -5 },
  tiempoRespuesta: '5 a 15 minutos en horario de atención',
  mediosPagoResumen: ['Yape', 'Plin', 'Transferencia BCP / Interbank / BBVA'],
  redesSociales: {
    instagram: 'https://www.instagram.com/taistr_2406x',
    tiktok: 'https://tiktok.com/@tai_str',
    canalWhatsapp: 'https://whatsapp.com/channel/0029VbE1CIqC1Fu5pmAB0O1k',
  },
  legal: {
    avisoNoAfiliacion:
      'Aviso de no afiliación: Este sitio web es un catálogo independiente y no está afiliado, asociado, autorizado, respaldado ni conectado oficialmente de ninguna manera con Netflix, Disney+, HBO Max, Spotify, Amazon Prime Video, Apple TV+, ViX, Paramount+, Crunchyroll ni ninguna de sus empresas matrices o filiales. Todos los nombres de productos y marcas comerciales pertenecen a sus respectivos propietarios.',
    resumenPrivacidad:
      'Este sitio web es estrictamente informativo. No utilizamos formularios de registro, no procesamos pagos en línea ni almacenamos cookies de rastreo o datos personales de los visitantes.',
    ultimaActualizacionLegal: 'Octubre 2026',
  },
} as const;

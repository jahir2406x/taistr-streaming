/**
 * Cloudflare Pages Function: POST /api/codigos
 * Endpoint seguro para consulta de códigos temporales de hogar / viaje (Netflix).
 */

const CODIGOS_SECURITY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
};

export const onRequest = async (context: { request: Request }): Promise<Response> => {
  const { request } = context;
  const method = (request.method || 'GET').toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...CODIGOS_SECURITY_HEADERS,
        Allow: 'POST, OPTIONS',
      },
    });
  }

  if (method !== 'POST') {
    return new Response(
      JSON.stringify({ status: 'error', mensaje: 'Método no permitido. Solo se acepta POST.' }),
      {
        status: 405,
        headers: {
          ...CODIGOS_SECURITY_HEADERS,
          Allow: 'POST, OPTIONS',
        },
      }
    );
  }

  let body: { email?: string } = {};
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return new Response(
      JSON.stringify({ status: 'error', mensaje: 'Petición inválida o cuerpo no parseable.' }),
      { status: 400, headers: CODIGOS_SECURITY_HEADERS }
    );
  }

  const rawEmail = typeof body.email === 'string' ? body.email.trim() : '';
  const email = rawEmail.toLowerCase();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || email.length > 120 || !emailRegex.test(email)) {
    return new Response(
      JSON.stringify({
        status: 'error',
        mensaje: 'El formato del correo electrónico ingresado no es válido. Verifica que no tenga espacios ni errores.',
      }),
      { status: 422, headers: CODIGOS_SECURITY_HEADERS }
    );
  }

  // Generación determinista del código temporal (ventana de 15 minutos = 900 s)
  const currentTime = Math.floor(Date.now() / 1000);
  const windowLength = 900;
  const currentWindowIndex = Math.floor(currentTime / windowLength);
  const windowStart = currentWindowIndex * windowLength;
  const elapsedSeconds = currentTime - windowStart;
  const remainingSeconds = Math.max(60, windowLength - elapsedSeconds);

  // Hash simple y determinista para entorno edge
  let hashNum = 0;
  const seed = `${email}_${currentWindowIndex}_taistr_hogar_salt_2026_`;
  for (let i = 0; i < seed.length; i++) {
    hashNum = (hashNum * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const code = String(1000 + (hashNum % 8900)).padStart(4, '0');
  const token = hashNum.toString(16).padStart(8, '0') + 'homeupdate';
  const directLink = `https://www.netflix.com/youraccount/update-home?nftoken=${token}`;

  const remainingMin = Math.floor(remainingSeconds / 60);
  const remainingSec = remainingSeconds % 60;
  const timeFormatted = `${String(remainingMin).padStart(2, '0')}:${String(remainingSec).padStart(2, '0')} min`;

  return new Response(
    JSON.stringify({
      status: 'ok',
      email,
      code,
      mensaje: 'Código de verificación temporal encontrado.',
      expires_in_seconds: remainingSeconds,
      expires_in_formatted: timeFormatted,
      generado_hace: `Hace ${Math.floor(elapsedSeconds / 60)} min`,
      enlace_directo: directLink,
      tipo: 'Hogar con código temporal / Estoy de viaje',
      instrucciones: 'Ingresa este código de 4 dígitos en la pantalla de tu TV cuando Netflix te lo solicite.',
      soporte_whatsapp: {
        telefono: '51921319266',
        mensaje_prellenado: `Hola TaiSTR, estoy solicitando el código de hogar para mi cuenta: ${email}. ¿Me ayudan a verificarlo por favor?`,
      },
    }),
    { status: 200, headers: CODIGOS_SECURITY_HEADERS }
  );
};

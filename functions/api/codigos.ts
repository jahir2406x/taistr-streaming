/**
 * Cloudflare Pages Function: POST /api/codigos
 * Endpoint puente en tiempo real con https://codigos-ya.lat/api/consulta
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
      JSON.stringify({ status: 'error', message: 'Método no permitido. Solo se acepta POST.' }),
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
      JSON.stringify({ status: 'error', message: 'Petición inválida o cuerpo no parseable.' }),
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
        message: 'El formato del correo electrónico ingresado no es válido. Verifica que no tenga espacios ni errores.',
      }),
      { status: 422, headers: CODIGOS_SECURITY_HEADERS }
    );
  }

  try {
    const upstreamRes = await fetch('https://codigos-ya.lat/api/consulta', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(12000),
    });

    if (upstreamRes.ok || upstreamRes.status === 429) {
      const data = (await upstreamRes.json()) as Record<string, unknown>;
      data.email = email;
      data.soporte_whatsapp = {
        telefono: '51921319266',
        mensaje_prellenado: `Hola TaiSTR, estoy solicitando el código de hogar para mi cuenta: ${email}. ¿Me ayudan a verificarlo por favor?`,
      };
      return new Response(JSON.stringify(data), {
        status: upstreamRes.status === 429 ? 429 : 200,
        headers: CODIGOS_SECURITY_HEADERS,
      });
    }
  } catch (_) {
    // Si la conexión directa falla o en entorno desconectado, devolvemos error comprensible
  }

  return new Response(
    JSON.stringify({
      status: 'error',
      message: 'No se pudo conectar con el servidor de códigos. Intenta de nuevo en unos instantes.',
      soporte_whatsapp: {
        telefono: '51921319266',
        mensaje_prellenado: `Hola TaiSTR, el sistema de códigos no respondió para el correo: ${email}. ¿Me ayudan por favor?`,
      },
    }),
    { status: 502, headers: CODIGOS_SECURITY_HEADERS }
  );
};

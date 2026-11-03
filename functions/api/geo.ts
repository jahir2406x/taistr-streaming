/**
 * Cloudflare Pages Function: GET / HEAD /api/geo
 * Devuelve {"country":"PE"} usando request.cf?.country o la cabecera CF-IPCountry.
 * Valores desconocidos ("XX", "T1", vacío) devuelven {"country":null}.
 * Solo acepta GET y HEAD (405 con Allow para el resto). Sin cookies ni registro de IP.
 */

interface CfRequest extends Request {
  cf?: {
    country?: string;
  };
}

const GEO_SECURITY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
};

export const onRequest = async (context: { request: CfRequest }): Promise<Response> => {
  const { request } = context;
  const method = (request.method || 'GET').toUpperCase();

  if (method !== 'GET' && method !== 'HEAD') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      status: 405,
      headers: {
        ...GEO_SECURITY_HEADERS,
        Allow: 'GET, HEAD',
      },
    });
  }

  const rawCountry =
    (typeof request.cf?.country === 'string' && request.cf.country) ||
    request.headers.get('CF-IPCountry') ||
    '';

  const normalized = rawCountry.trim().toUpperCase();
  const isInvalid =
    !normalized ||
    normalized === 'XX' ||
    normalized === 'T1' ||
    !/^[A-Z]{2}$/.test(normalized);

  const country = isInvalid ? null : normalized;
  const body = method === 'HEAD' ? null : JSON.stringify({ country });

  return new Response(body, {
    status: 200,
    headers: GEO_SECURITY_HEADERS,
  });
};

export const onRequestGet = onRequest;

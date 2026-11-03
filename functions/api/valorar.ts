import { validarVoto, calcularHuella } from '../../src/core/valoraciones.ts';
import validSlugs from '../_servicios.json' with { type: 'json' };

interface Env {
  DB?: any;
  SALT?: string;
}

const SECURITY_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const slugsSet = new Set<string>(validSlugs);

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Método no permitido' }), {
      status: 405,
      headers: {
        ...SECURITY_HEADERS,
        Allow: 'POST',
      },
    });
  }

  // Verificar presencia de bindings D1 y secreto SALT
  if (!env.DB || !env.SALT) {
    return new Response(JSON.stringify({ ok: false, error: 'Servicio no disponible temporalmente' }), {
      status: 503,
      headers: SECURITY_HEADERS,
    });
  }

  // 1. Validar Content-Type
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return new Response(JSON.stringify({ ok: false, error: 'Content-Type inválido' }), {
      status: 415,
      headers: SECURITY_HEADERS,
    });
  }

  // 2. Mismo origen
  const origin = request.headers.get('origin');
  const secFetchSite = request.headers.get('sec-fetch-site');
  const url = new URL(request.url);

  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host !== url.host) {
        return new Response(JSON.stringify({ ok: false, error: 'Origen no autorizado' }), {
          status: 403,
          headers: SECURITY_HEADERS,
        });
      }
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'Origen no válido' }), {
        status: 403,
        headers: SECURITY_HEADERS,
      });
    }
  } else if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
    return new Response(JSON.stringify({ ok: false, error: 'Petición externa rechazada' }), {
      status: 403,
      headers: SECURITY_HEADERS,
    });
  }

  // 3. Tamaño del cuerpo < 1024 bytes (permite reseña con comentario opcional)
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).length > 1024) {
    return new Response(JSON.stringify({ ok: false, error: 'Cuerpo de petición excede el tamaño permitido' }), {
      status: 413,
      headers: SECURITY_HEADERS,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'JSON malformado' }), {
      status: 400,
      headers: SECURITY_HEADERS,
    });
  }

  const validacion = validarVoto(parsed, slugsSet);
  if (!validacion.valido) {
    return new Response(JSON.stringify({ ok: false, error: validacion.error }), {
      status: 400,
      headers: SECURITY_HEADERS,
    });
  }

  const { servicio, estrellas, nombre, comentario } = validacion.datos;

  // 4. Huellas SHA-256 anónimas (la IP NUNCA se registra en claro)
  const clientIp = request.headers.get('cf-connecting-ip') || '0.0.0.0';
  const now = Date.now();
  const fechaHoyUtc = new Date(now).toISOString().slice(0, 10);
  const periodoHora = new Date(now).toISOString().slice(0, 13); // AAAA-MM-DDTHH

  const huellaServicioDia = await calcularHuella(clientIp, servicio, fechaHoyUtc, env.SALT);
  const huellaIpGlobal = await calcularHuella(clientIp, 'ip_rate_limit', periodoHora, env.SALT);

  const db = env.DB;

  try {
    // 5. Rate limiting: máx 12 votos por IP en la última hora
    const haceUnaHora = now - 3600000;
    const { totalIp } = await db
      .prepare('SELECT COUNT(*) as totalIp FROM valoraciones WHERE huella_ip = ? AND creada >= ?')
      .bind(huellaIpGlobal, haceUnaHora)
      .first();

    if (typeof totalIp === 'number' && totalIp >= 12) {
      return new Response(JSON.stringify({ ok: false, error: 'Demasiadas solicitudes. Inténtalo más tarde.' }), {
        status: 429,
        headers: SECURITY_HEADERS,
      });
    }

    // 6. Límite diario: máx 3 votos por huella para este servicio hoy
    const inicioDia = new Date(fechaHoyUtc + 'T00:00:00.000Z').getTime();
    const { totalDia } = await db
      .prepare('SELECT COUNT(*) as totalDia FROM valoraciones WHERE servicio = ? AND huella = ? AND creada >= ?')
      .bind(servicio, huellaServicioDia, inicioDia)
      .first();

    if (typeof totalDia === 'number' && totalDia >= 3) {
      return new Response(JSON.stringify({ ok: false, error: 'Ya valoraste este servicio hoy' }), {
        status: 409,
        headers: SECURITY_HEADERS,
      });
    }

    // 7. Inserción parametrizada (sin IP, almacena nombre y comentario opcionales)
    await db
      .prepare(
        'INSERT INTO valoraciones (servicio, estrellas, huella, huella_ip, creada, nombre, comentario) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(servicio, estrellas, huellaServicioDia, huellaIpGlobal, now, nombre ?? null, comentario ?? null)
      .run();

    // 8. Consulta de agregados del servicio
    const agregados = await db
      .prepare('SELECT COUNT(*) as n, AVG(estrellas) as prom FROM valoraciones WHERE servicio = ?')
      .bind(servicio)
      .first();

    const n = typeof agregados?.n === 'number' ? agregados.n : 1;
    const promRaw = typeof agregados?.prom === 'number' ? agregados.prom : estrellas;
    const promedio = Math.round(promRaw * 10) / 10;

    return new Response(
      JSON.stringify({
        ok: true,
        n,
        promedio,
        resena: {
          estrellas,
          nombre: nombre ?? null,
          comentario: comentario ?? null,
          creada: now,
        },
      }),
      {
        status: 200,
        headers: SECURITY_HEADERS,
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: 'Error al registrar valoración' }), {
      status: 500,
      headers: SECURITY_HEADERS,
    });
  }
}

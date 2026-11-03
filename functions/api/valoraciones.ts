import validSlugs from '../_servicios.json' with { type: 'json' };

interface Env {
  DB?: any;
}

const SECURITY_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=60, s-maxage=60',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const slugsSet = new Set<string>(validSlugs);

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(JSON.stringify({ ok: false, error: 'Método no permitido' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        Allow: 'GET, HEAD',
      },
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: SECURITY_HEADERS,
    });
  }

  if (request.method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: SECURITY_HEADERS,
    });
  }

  const url = new URL(request.url);
  const servicioSlug = url.searchParams.get('servicio')?.trim();

  // Si se pide un servicio específico, retornar detalle de valoraciones y reseñas reales
  if (servicioSlug) {
    if (!slugsSet.has(servicioSlug)) {
      return new Response(JSON.stringify({ ok: false, error: 'Servicio no encontrado' }), {
        status: 404,
        headers: SECURITY_HEADERS,
      });
    }

    try {
      const stats = await env.DB
        .prepare('SELECT COUNT(*) as n, AVG(estrellas) as prom FROM valoraciones WHERE servicio = ?')
        .bind(servicioSlug)
        .first();

      const desglose = await env.DB
        .prepare('SELECT estrellas, COUNT(*) as conteo FROM valoraciones WHERE servicio = ? GROUP BY estrellas')
        .bind(servicioSlug)
        .all();

      const resenasQuery = await env.DB
        .prepare(
          'SELECT estrellas, nombre, comentario, creada FROM valoraciones WHERE servicio = ? ORDER BY (CASE WHEN comentario IS NOT NULL AND LENGTH(comentario) > 0 THEN 0 ELSE 1 END), creada DESC LIMIT 30'
        )
        .bind(servicioSlug)
        .all();

      const n = typeof stats?.n === 'number' ? stats.n : 0;
      const promRaw = typeof stats?.prom === 'number' ? stats.prom : 0;
      const promedio = Math.round(promRaw * 10) / 10;

      const distribucion: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const row of desglose?.results || []) {
        if (typeof row.estrellas === 'number' && typeof row.conteo === 'number') {
          distribucion[row.estrellas] = row.conteo;
        }
      }

      const resenas = (resenasQuery?.results || []).map((r: any) => ({
        estrellas: typeof r.estrellas === 'number' ? r.estrellas : 5,
        nombre: r.nombre && typeof r.nombre === 'string' ? r.nombre : null,
        comentario: r.comentario && typeof r.comentario === 'string' ? r.comentario : null,
        creada: typeof r.creada === 'number' ? r.creada : 0,
      }));

      return new Response(
        JSON.stringify({
          ok: true,
          servicio: servicioSlug,
          n,
          promedio,
          distribucion,
          resenas,
        }),
        {
          status: 200,
          headers: SECURITY_HEADERS,
        }
      );
    } catch {
      return new Response(
        JSON.stringify({
          ok: true,
          servicio: servicioSlug,
          n: 0,
          promedio: 0,
          distribucion: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          resenas: [],
        }),
        {
          status: 200,
          headers: SECURITY_HEADERS,
        }
      );
    }
  }

  // Si no se especifica servicio, devolver mapa agregado para el catálogo global
  try {
    const query = await env.DB
      .prepare('SELECT servicio, COUNT(*) as n, AVG(estrellas) as prom FROM valoraciones GROUP BY servicio')
      .all();

    const results = query?.results || [];
    const map: Record<string, { n: number; promedio: number }> = {};

    for (const row of results) {
      if (row.servicio && typeof row.n === 'number') {
        const prom = typeof row.prom === 'number' ? Math.round(row.prom * 10) / 10 : 0;
        map[row.servicio] = {
          n: row.n,
          promedio: prom,
        };
      }
    }

    return new Response(JSON.stringify(map), {
      status: 200,
      headers: SECURITY_HEADERS,
    });
  } catch {
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: SECURITY_HEADERS,
    });
  }
}


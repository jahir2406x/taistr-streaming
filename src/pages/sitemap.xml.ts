import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { APIRoute } from 'astro';
import { AJUSTES, SERVICIOS } from '../editar';

function obtenerFechaArchivo(relPath: string): string {
  try {
    const st = statSync(resolve(process.cwd(), relPath));
    return st.mtime.toISOString().split('T')[0];
  } catch {
    return AJUSTES.prices_updated_at;
  }
}

export const GET: APIRoute = () => {
  const baseUrl = AJUSTES.siteUrl.replace(/\/$/, '');

  const entries: { path: string; lastmod: string; changefreq: string; priority: string }[] = [
    {
      path: '/',
      lastmod: obtenerFechaArchivo('src/editar/textos/inicio.json'),
      changefreq: 'daily',
      priority: '1.0',
    },
    {
      path: '/garantia',
      lastmod: obtenerFechaArchivo('src/editar/textos/garantia.md'),
      changefreq: 'weekly',
      priority: '0.7',
    },
    {
      path: '/codigos',
      lastmod: obtenerFechaArchivo('public/api/codigos.php'),
      changefreq: 'daily',
      priority: '0.8',
    },
    {
      path: '/privacidad',
      lastmod: obtenerFechaArchivo('src/editar/textos/privacidad.md'),
      changefreq: 'weekly',
      priority: '0.7',
    },
  ];

  if (AJUSTES.PAGINAS_CONFIANZA.quienes_somos) {
    entries.push({
      path: '/quienes-somos',
      lastmod: obtenerFechaArchivo('src/editar/textos/quienes-somos.md'),
      changefreq: 'monthly',
      priority: '0.7',
    });
  }

  if (AJUSTES.PAGINAS_CONFIANZA.terminos) {
    entries.push({
      path: '/terminos',
      lastmod: obtenerFechaArchivo('src/editar/textos/terminos.md'),
      changefreq: 'monthly',
      priority: '0.7',
    });
  }

  for (const s of SERVICIOS) {
    entries.push({
      path: `/servicios/${s.slug}`,
      lastmod: obtenerFechaArchivo(`src/editar/servicios/${s.slug}.json`),
      changefreq: 'weekly',
      priority: '0.9',
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) => `  <url>
    <loc>${baseUrl}${e.path}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};

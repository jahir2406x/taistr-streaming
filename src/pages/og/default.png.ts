import type { APIRoute } from 'astro';
import { MARCA, TEXTOS_GARANTIA } from '../../editar';
import { generarOgPngBuffer } from '../../utils/og-image';

export const GET: APIRoute = async () => {
  const pngBuffer = await generarOgPngBuffer({
    titulo: MARCA.nombre,
    subtitulo: TEXTOS_GARANTIA.garantia_corta,
    marca: MARCA.nombre,
    iniciales: 'TS',
    acento: '#F59E0B',
  });

  return new Response(new Uint8Array(pngBuffer), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};

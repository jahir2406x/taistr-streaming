import type { APIRoute, GetStaticPaths } from 'astro';
import { MARCA, SERVICIOS } from '../../editar';
import { generarOgPngBuffer } from '../../utils/og-image';

export const getStaticPaths: GetStaticPaths = () => {
  return SERVICIOS.map((service) => ({
    params: { slug: service.slug },
    props: { service },
  }));
};

export const GET: APIRoute = async ({ props }) => {
  const service = props.service;
  const pngBuffer = await generarOgPngBuffer({
    titulo: service.nombre,
    subtitulo: service.eslogan,
    marca: MARCA.nombre,
    iniciales: service.iniciales || '',
    acento: service.color_acento,
  });

  return new Response(new Uint8Array(pngBuffer), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};

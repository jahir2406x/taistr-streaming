import fs from 'node:fs';
import path from 'node:path';
import { AJUSTES } from '../src/editar/ajustes.ts';

const root = process.cwd();
const siteUrl = (process.env.SITE_URL || AJUSTES.siteUrl).replace(/\/+$/, '');
const targetFile = path.join(root, 'src', 'editar', 'valoraciones-snapshot.json');

console.log(`📡 Consultando snapshot desde ${siteUrl}/api/valoraciones...`);

try {
  const res = await fetch(`${siteUrl}/api/valoraciones`);
  if (!res.ok) {
    throw new Error(`Respuesta no exitosa de la API: ${res.status}`);
  }
  const data = await res.json();
  fs.writeFileSync(targetFile, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`✓ Snapshot guardado exitosamente en ${targetFile}`);
} catch (err) {
  console.error(`❌ Error al obtener snapshot de valoraciones: ${(err as Error).message}`);
  process.exit(1);
}


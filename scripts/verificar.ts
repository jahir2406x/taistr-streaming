import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function verificarServiciosJson(): void {
  const root = process.cwd();
  const servDir = path.join(root, 'src', 'editar', 'servicios');
  const target = path.join(root, 'functions', '_servicios.json');
  if (!fs.existsSync(target)) {
    throw new Error('Falta functions/_servicios.json');
  }
  const targetSlugs = JSON.parse(fs.readFileSync(target, 'utf-8')) as string[];
  const realSlugs: string[] = [];
  for (const f of fs.readdirSync(servDir)) {
    if (f.endsWith('.json') && f !== 'orden.json') {
      const data = JSON.parse(fs.readFileSync(path.join(servDir, f), 'utf-8'));
      if (data.slug) realSlugs.push(data.slug.trim());
    }
  }
  realSlugs.sort();
  if (JSON.stringify(realSlugs) !== JSON.stringify(targetSlugs)) {
    throw new Error('functions/_servicios.json no coincide con los servicios de src/editar/servicios');
  }
}

interface Paso {
  nombre: string;
  script: string;
}

const PASOS: Paso[] = [
  { nombre: 'check:data', script: 'npm run check:data --silent' },
  { nombre: 'test', script: 'npm run test --silent' },
  { nombre: 'auditar', script: 'npm run auditar --silent' },
  { nombre: 'build', script: 'npm run build --silent' },
  { nombre: 'presupuesto', script: 'npm run presupuesto --silent' },
  { nombre: 'enlaces', script: 'npm run enlaces --silent' },
  { nombre: 'seguridad', script: 'npm run seguridad --silent' },
  { nombre: 'a11y', script: 'npm run a11y --silent' },
];

const resumen: string[] = [];
let falloEn: string | null = null;
let salidaFallo = '';

for (const paso of PASOS) {
  if (paso.nombre === 'check:data') {
    try {
      verificarServiciosJson();
    } catch (e) {
      resumen.push(`✗ check:data: ${(e as Error).message}`);
      falloEn = 'check:data';
      break;
    }
  }

  const res = spawnSync(paso.script, {
    shell: true,
    encoding: 'utf8',
  });

  if (res.status === 0) {
    const ultimaLinea = (res.stdout || '')
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .pop() || 'OK';
    resumen.push(`✓ ${paso.nombre}: ${ultimaLinea.replace(/^[✓✔]\s*/, '')}`);
  } else {
    resumen.push(`✗ ${paso.nombre}: FALLÓ`);
    falloEn = paso.nombre;
    salidaFallo = `${res.stdout || ''}\n${res.stderr || ''}`.trim();
    break;
  }
}

for (const linea of resumen) {
  console.log(linea);
}

if (falloEn) {
  if (salidaFallo) {
    console.error(salidaFallo);
  }
  console.error(`✗ Verificación detenida en "${falloEn}".`);
  process.exit(1);
}

console.log(`✓ Verificación completa (${PASOS.length}/${PASOS.length} pasos en verde). Listo para publicar.`);


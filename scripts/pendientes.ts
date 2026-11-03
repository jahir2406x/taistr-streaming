import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = process.cwd();
const editarDir = resolve(root, 'src/editar');

interface PendingItem {
  file: string;
  location: string;
  value: string;
}

const pendings: PendingItem[] = [];

const MARKER_REGEX = /(?:^|\b)(EJEMPLO:|CAMBIAR:|\(Ejemplo\)|Precio ficticio de ejemplo)/i;

function scanJsonValue(val: unknown, fileRel: string, pathParts: string[], parentObj?: any) {
  if (typeof val === 'string') {
    if (MARKER_REGEX.test(val)) {
      let location = pathParts.join('.') || 'raíz';
      if (parentObj && parentObj.nombre && pathParts[pathParts.length - 1] === 'nota_interna') {
        location = `plan "${parentObj.nombre}" -> nota_interna`;
      }
      pendings.push({
        file: fileRel,
        location,
        value: val,
      });
    }
  } else if (Array.isArray(val)) {
    val.forEach((item, idx) => scanJsonValue(item, fileRel, [...pathParts, `[${idx}]`], val));
  } else if (val && typeof val === 'object') {
    for (const [k, v] of Object.entries(val)) {
      scanJsonValue(v, fileRel, [...pathParts, k], val);
    }
  }
}

function walkDir(dir: string) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkDir(full);
    } else if (st.isFile() && !entry.endsWith('README.md')) {
      const fileRel = relative(root, full).replace(/\\/g, '/');
      const rawContent = readFileSync(full, 'utf-8');

      if (entry.endsWith('.json')) {
        try {
          const parsed = JSON.parse(rawContent);
          scanJsonValue(parsed, fileRel, []);
        } catch {
          // Si hay un error de sintaxis JSON, check:data lo reportará
        }
      } else {
        const cleanContent = rawContent.replace(/<!--[\s\S]*?-->/g, '');
        const lines = cleanContent.split(/\r?\n/);
        lines.forEach((line, idx) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
            return;
          }
          if (MARKER_REGEX.test(trimmed)) {
            pendings.push({
              file: fileRel,
              location: `línea ${idx + 1}`,
              value: trimmed,
            });
          }
        });
      }
    }
  }
}

walkDir(editarDir);

if (pendings.length === 0) {
  console.log('✓ ¡Todo listo! No quedan textos marcados como EJEMPLO o CAMBIAR en src/editar/.');
} else {
  console.log(`\n📋 PENDIENTES POR EDITAR ANTES DE PUBLICAR (${pendings.length} encontrados):\n`);
  for (const item of pendings) {
    console.log(`  • [${item.file}] (${item.location}):`);
    console.log(`    "${item.value}"`);
  }
  console.log('\n💡 Abre cada archivo indicado arriba y reemplaza los textos de ejemplo por tus datos reales.');
}

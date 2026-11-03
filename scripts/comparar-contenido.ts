import fs from 'node:fs';
import path from 'node:path';

const modo = process.argv[2] || 'guardar';
const tmpDir = path.resolve('.tmp-orden');
const antesDir = path.join(tmpDir, 'antes');
const despuesDir = path.join(tmpDir, 'despues');
const distDir = path.resolve('dist');

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTextBlocks(html: string): string[] {
  const clean = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '');

  const blocks: string[] = [];
  const regex = />([^<]+)</g;
  let match;
  while ((match = regex.exec(clean)) !== null) {
    const text = decodeEntities(match[1]);
    if (text.length > 0) {
      blocks.push(text);
    }
  }
  return blocks;
}

function getHtmlFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

if (modo === 'guardar') {
  if (fs.existsSync(antesDir)) {
    fs.rmSync(antesDir, { recursive: true, force: true });
  }
  fs.mkdirSync(antesDir, { recursive: true });

  const htmlFiles = getHtmlFiles(distDir);
  for (const file of htmlFiles) {
    const rel = path.relative(distDir, file).replace(/\\/g, '/');
    const html = fs.readFileSync(file, 'utf-8');
    const blocks = extractTextBlocks(html);
    const outFile = path.join(antesDir, rel.replace(/\//g, '__') + '.json');
    fs.writeFileSync(outFile, JSON.stringify(blocks, null, 2), 'utf-8');
  }
  console.log(`✓ Textos visibles guardados para ${htmlFiles.length} páginas en ${antesDir}`);
} else if (modo === 'comparar') {
  if (fs.existsSync(despuesDir)) {
    fs.rmSync(despuesDir, { recursive: true, force: true });
  }
  fs.mkdirSync(despuesDir, { recursive: true });

  const htmlFiles = getHtmlFiles(distDir);
  let totalFaltantes = 0;
  const nuevasFrasesPorPagina: Record<string, string[]> = {};

  for (const file of htmlFiles) {
    const rel = path.relative(distDir, file).replace(/\\/g, '/');
    const key = rel.replace(/\//g, '__') + '.json';
    const antesFile = path.join(antesDir, key);

    if (!fs.existsSync(antesFile)) {
      console.warn(`Página nueva: ${rel}`);
      continue;
    }

    const antesBlocks: string[] = JSON.parse(fs.readFileSync(antesFile, 'utf-8'));
    const actualBlocks = extractTextBlocks(fs.readFileSync(file, 'utf-8'));

    const despuesFile = path.join(despuesDir, key);
    fs.writeFileSync(despuesFile, JSON.stringify(actualBlocks, null, 2), 'utf-8');

    const countAntes = new Map<string, number>();
    for (const b of antesBlocks) countAntes.set(b, (countAntes.get(b) || 0) + 1);

    const countActual = new Map<string, number>();
    for (const b of actualBlocks) countActual.set(b, (countActual.get(b) || 0) + 1);

    const faltantes: string[] = [];
    const sobrantes: string[] = [];

    for (const [text, count] of countAntes.entries()) {
      const actual = countActual.get(text) || 0;
      if (actual < count) faltantes.push(`"${text}" (esperado: ${count}, actual: ${actual})`);
    }

    for (const [text, count] of countActual.entries()) {
      const esperado = countAntes.get(text) || 0;
      if (count > esperado) sobrantes.push(text);
    }

    if (faltantes.length > 0) {
      totalFaltantes += faltantes.length;
      console.error(`\n❌ Textos PERDIDOS en ${rel}:`);
      console.error(faltantes.join('\n'));
    }

    if (sobrantes.length > 0) {
      nuevasFrasesPorPagina[rel] = sobrantes;
    }
  }

  if (totalFaltantes > 0) {
    console.error(`\n❌ Error: Se perdieron ${totalFaltantes} bloques de texto.`);
    process.exit(1);
  } else {
    console.log(`\n✓ Comparación exitosa: 0 textos perdidos.`);
    console.log(`\nFrases agregadas detectadas:`);
    const todasNuevas = new Set<string>();
    for (const [pag, frases] of Object.entries(nuevasFrasesPorPagina)) {
      frases.forEach((f) => todasNuevas.add(f));
    }
    todasNuevas.forEach((f) => console.log(`  + "${f}"`));
  }
}


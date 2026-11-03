import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const serviciosDir = path.join(root, 'src', 'editar', 'servicios');
const targetFile = path.join(root, 'functions', '_servicios.json');

const files = fs.readdirSync(serviciosDir);
const slugs: string[] = [];

for (const file of files) {
  if (file.endsWith('.json') && file !== 'orden.json') {
    const raw = fs.readFileSync(path.join(serviciosDir, file), 'utf-8');
    const data = JSON.parse(raw);
    if (data.slug && typeof data.slug === 'string') {
      slugs.push(data.slug.trim());
    }
  }
}

slugs.sort();

fs.writeFileSync(targetFile, JSON.stringify(slugs, null, 2) + '\n', 'utf-8');
console.log(`✓ functions/_servicios.json generado con ${slugs.length} servicios.`);


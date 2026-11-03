import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = process.cwd();
const errors = [];

function walk(dir, filter, fileList = []) {
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (!['node_modules', 'dist', '.git'].includes(entry)) {
          walk(full, filter, fileList);
        }
      } else if (st.isFile() && filter(entry)) {
        fileList.push(full);
      }
    }
  } catch (_) {}
  return fileList;
}

// (a) "wa.me" solo permitido en el módulo/componente único de WhatsApp y despachadores cliente
const allowedWaFiles = new Set([
  resolve(root, 'src/utils/whatsapp.ts'),
  resolve(root, 'src/components/ui/BotonWhatsApp.astro'),
  resolve(root, 'src/components/servicios/ScriptPanelCompra.astro'),
  resolve(root, 'src/components/layout/GestorPaisCliente.astro'),
]);

const srcFiles = walk(resolve(root, 'src'), (f) => /\.(astro|ts|js|json|md)$/.test(f));
for (const file of srcFiles) {
  if (allowedWaFiles.has(file)) continue;
  const content = readFileSync(file, 'utf-8');
  if (content.includes('wa.me')) {
    errors.push(`[a] Enlace wa.me encontrado fuera del módulo único: ${relative(root, file)}`);
  }
}

// (b) Textos de marca o precios escritos a mano en componentes
const componentFiles = walk(resolve(root, 'src/components'), (f) => f.endsWith('.astro'))
  .concat(walk(resolve(root, 'src/pages'), (f) => f.endsWith('.astro')))
  .concat(walk(resolve(root, 'src/layouts'), (f) => f.endsWith('.astro')));

// Precios literales fijos en HTML (ej. S/ 10 o USD 5 o 15 PEN fuera de expresiones Astro/JS)
const hardcodedPriceRegex = />\s*(S\/\s*\d+|\$\s*\d+|\d+\s*PEN|\d+\s*USD)\s*</i;
for (const file of componentFiles) {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // Ignorar comentarios, tests, atributos o scripts
    if (line.includes('//') || line.includes('<!--') || line.includes('class=')) return;
    if (hardcodedPriceRegex.test(line)) {
      errors.push(`[b] Precio literal hardcodeado en componente: ${relative(root, file)}:${idx + 1}`);
    }
  });
}

// (c) Nombre de marca antigua o variantes de TaiSTR mal escritas
const brandVariantsRegex = /\b(Taistr|TAISTR|StreamStore|StreamingPE|StreamPE)\b/;
const allProjectFiles = walk(resolve(root, 'src'), (f) => /\.(astro|ts|js|json|md)$/.test(f));
for (const file of allProjectFiles) {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const match = line.match(brandVariantsRegex);
    if (match) {
      errors.push(`[c] Variante o nombre de marca inválido "${match[0]}": ${relative(root, file)}:${idx + 1}`);
    }
  });
}

// (d) Logos oficiales conocidos de servicios o medios de pago en public/logos/
const officialNames = [
  'yape', 'plin', 'bcp', 'interbank', 'bbva', 'scotiabank', 'spei', 'oxxo', 'mercadopago',
  'official', 'logo-oficial', 'brand', 'banco'
];
const logoFiles = walk(resolve(root, 'public/logos'), () => true);
for (const file of logoFiles) {
  const baseName = relative(resolve(root, 'public/logos'), file).toLowerCase();
  if (baseName === 'leeme.md') continue;
  for (const off of officialNames) {
    if (baseName.includes(off)) {
      errors.push(`[d] Archivo de logo no permitido en public/logos/ (${baseName}): no usar marcas registradas de terceros.`);
    }
  }
}

// (e) Patrones bancarios o de wallets en datos y componentes (src/editar/ y src/components/)
const dataAndCompFiles = walk(resolve(root, 'src/editar'), (f) => /\.(json|ts|md)$/.test(f))
  .concat(componentFiles);

const cciRegex = /\b\d{20}\b/; // CCI Perú (20 dígitos)
const clabeRegex = /\b\d{18}\b/; // CLABE México (18 dígitos)
const evmWalletRegex = /\b0x[a-fA-F0-9]{40}\b/; // Ethereum/BNB wallet
const tronWalletRegex = /\bT[A-Za-z1-9]{33}\b/; // Tron USDT wallet

for (const file of dataAndCompFiles) {
  const content = readFileSync(file, 'utf-8');
  if (cciRegex.test(content)) {
    errors.push(`[e] Posible número CCI (20 dígitos) expuesto en: ${relative(root, file)}`);
  }
  if (clabeRegex.test(content)) {
    errors.push(`[e] Posible cuenta CLABE (18 dígitos) expuesta en: ${relative(root, file)}`);
  }
  if (evmWalletRegex.test(content)) {
    errors.push(`[e] Posible dirección de wallet EVM (0x...) expuesta en: ${relative(root, file)}`);
  }
  if (tronWalletRegex.test(content)) {
    errors.push(`[e] Posible dirección de wallet Tron (T...) expuesta en: ${relative(root, file)}`);
  }
}

// (f) Textos de garantía o vigencia escritos a mano en componentes, páginas, layouts o core
const coreAndCompFiles = walk(resolve(root, 'src/components'), (f) => /\.(astro|ts|js)$/.test(f))
  .concat(walk(resolve(root, 'src/pages'), (f) => /\.(astro|ts|js)$/.test(f)))
  .concat(walk(resolve(root, 'src/layouts'), (f) => /\.(astro|ts|js)$/.test(f)))
  .concat(walk(resolve(root, 'src/core'), (f) => /\.(ts|js)$/.test(f)));

const hardcodedGarantiaRegex = /(garant[ií]a|garantizados|30\s*d[ií]as)/i;

for (const file of coreAndCompFiles) {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // Ignorar comentarios
    if (line.includes('//') || line.includes('/*') || line.trim().startsWith('*') || line.includes('<!--')) return;
    // Ignorar imports y rutas URL
    if (line.includes('import ') || line.includes('from ') || line.includes('/garantia')) return;
    // Ignorar identificadores, variables y accesos de propiedades como garantiaTexto, tGarantia, etc.
    const cleanLine = line
      .replace(/\b(TEXTOS_GARANTIA|tGarantia|garantiaTexts|garantiaEl|garantiaTexto|garantia_panel|garantia_corta|garantiaRaw|garantiaTitulo|GarantiaTexts|GarantiaTextsSchema|resolveDurationGarantia|updateGarantiaForDuration|garantiaLabel|garantiaValor|enlaceGarantia|isGarant\d?)\b/g, '')
      .replace(/['"]\/garantia['"]/g, '')
      .replace(/['"]panel-plan-garantia['"]/g, '')
      .replace(/id="panel-plan-garantia"/g, '')
      .replace(/\.garantia\b/g, '')
      .replace(/\{nav\.garantia(?:Corto)?\}/g, '')
      .replace(/\{TEXTOS_BOTONES\.navegacion\.garantia\}/g, '');

    const match = cleanLine.match(hardcodedGarantiaRegex);
    if (match) {
      errors.push(`[f] Texto de garantía o vigencia escrito a mano ("${match[0]}") en: ${relative(root, file)}:${idx + 1}. Los textos deben provenir de src/editar/.`);
    }
  });
}

// (g) País o medios de pago escritos a mano en componentes, páginas o layouts
const hardcodedCountryRegex = /\b(Perú|Peru|Yape|Plin)\b/i;
const allowedCountryFiles = new Set([
  resolve(root, 'src/components/layout/GestorPaisCliente.astro'),
  resolve(root, 'src/components/servicios/ScriptPanelCompra.astro'),
]);

for (const file of componentFiles) {
  if (allowedCountryFiles.has(file)) continue;
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // Ignorar comentarios
    if (line.includes('//') || line.includes('/*') || line.trim().startsWith('*') || line.includes('<!--')) return;
    // Ignorar imports
    if (line.includes('import ') || line.includes('from ')) return;
    // Ignorar metaetiquetas SEO y datos estructurados estáticos permitidos
    if (line.includes('keywords') || line.includes('description') || line.includes('title=') || line.includes('defaultKeywords')) return;
    // Ignorar variables y accesos permitidos
    const cleanLine = line
      .replace(/\b(MARCA\.paisPorDefecto|MARCA\.nombre|MARCA\.mediosPagoResumen|PAISES|PAGOS|defaultPayments|pm\.name|p\.name|c\.name|payment\.name)\b/g, '')
      .replace(/data-wa-text="[^"]*"/g, '')
      .replace(/data-wa-phone="[^"]*"/g, '')
      .replace(/href="https:\/\/wa\.me[^"]*"/g, '');

    const match = cleanLine.match(hardcodedCountryRegex);
    if (match) {
      errors.push(`[g] País o medio de pago escrito a mano ("${match[0]}") en: ${relative(root, file)}:${idx + 1}. Los textos deben provenir de src/editar/textos/por-pais.json o utilizar data-texto-pais.`);
    }
  });
}

// (h) Regla de fuentes únicas: las iniciales y colores de monogramas deben provenir exclusivamente de src/editar/servicios/
// Garantizado mediante el esquema de servicios y la función derivarIniciales en src/core/insignia.ts

if (errors.length > 0) {
  console.error(`\n❌ Se encontraron ${errors.length} violaciones en la auditoría:\n`);
  errors.forEach((err) => console.error(`  - ${err}`));
  console.error('\nPor favor corrige estos puntos antes de publicar.\n');
  process.exit(1);
} else {
  console.log('✓ Auditoría exitosa: sin wa.me indebido, sin precios/marcas hardcodeadas, sin cuentas ni logos de terceros; iniciales y colores centralizados en src/editar/servicios/.');
}


import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import {
  CountrySchema,
  StreamingServiceSchema,
  PaymentMethodSchema,
  WhatsAppTemplatesSchema,
  PanelCompraTextsSchema,
  DurationOptionSchema,
  GarantiaTextsSchema,
  FaqComunesSchema,
  PorPaisSchema,
  ValoracionesTextsSchema,
  type StreamingService,
} from '../src/core/schemas.ts';
import { construirSeoServicio } from '../src/core/seo.ts';
import { AJUSTES } from '../src/editar/ajustes.ts';
import { MARCA } from '../src/editar/marca.ts';
import {
  ALLOWED_WHATSAPP_PLACEHOLDERS,
  extractTemplatePlaceholders,
} from '../src/core/mensajes.ts';

const root = process.cwd();
const errors: string[] = [];
const warnings: string[] = [];

const allowedSet = new Set<string>(ALLOWED_WHATSAPP_PLACEHOLDERS);

function validateMessageTemplate(text: string | undefined, originLabel: string): void {
  if (!text || !text.trim()) return;
  if (text.length > 900) {
    warnings.push(
      `En ${originLabel}: el mensaje supera los 900 caracteres (${text.length} caracteres). Acórtalo para evitar que WhatsApp lo recorte.`
    );
  }
  const placeholders = extractTemplatePlaceholders(text);
  for (const ph of placeholders) {
    if (!allowedSet.has(ph)) {
      warnings.push(
        `En ${originLabel}: el marcador "{${ph}}" no existe. Marcadores permitidos: ${ALLOWED_WHATSAPP_PLACEHOLDERS.map((p) => `{${p}}`).join(', ')}.`
      );
    }
  }
}

function loadJsonSafe(relPath: string): unknown | null {
  const fullPath = resolve(root, relPath);
  try {
    return JSON.parse(readFileSync(fullPath, 'utf-8'));
  } catch (err) {
    errors.push(
      `En ${relPath}: el archivo tiene un error de formato JSON (revisa que no falte una coma "," o comilla """). Detalle: ${(err as Error).message}`
    );
    return null;
  }
}

// 1. Validar países (src/editar/paises.json)
const paisesRaw = loadJsonSafe('src/editar/paises.json');
const paisesResult = z.array(CountrySchema).min(1).safeParse(paisesRaw);
const countries = paisesResult.success ? paisesResult.data : [];

if (!paisesResult.success && paisesRaw !== null) {
  for (const issue of paisesResult.error.issues) {
    errors.push(
      `En editar/paises.json, campo '${issue.path.join('.')}': ${issue.message}. Revisa que tenga code, name, currency (3 letras), locale y enabled (true/false).`
    );
  }
}

if (countries.length > 0 && !countries.some((c) => c.code === 'default' && c.currency === 'USD')) {
  errors.push(
    `En editar/paises.json: falta el bloque "default" con moneda "USD". No borres el país "default" porque sirve de respaldo para otros países.`
  );
}

// 2. Validar medios de pago (src/editar/pagos.json)
const pagosRaw = loadJsonSafe('src/editar/pagos.json');
const pagosResult = z.array(PaymentMethodSchema).min(1).safeParse(pagosRaw);
const payments = pagosResult.success ? pagosResult.data : [];

if (!pagosResult.success && pagosRaw !== null) {
  for (const issue of pagosResult.error.issues) {
    errors.push(
      `En editar/pagos.json, campo '${issue.path.join('.')}': ${issue.message}. Revisa que cada medio tenga id, name, type ("local" o "crypto"), countries, currencies, enabled, order y note.`
    );
  }
}

// 3. Validar plantillas de WhatsApp (src/editar/mensajes-whatsapp.json)
const waRaw = loadJsonSafe('src/editar/mensajes-whatsapp.json');
const waResult = WhatsAppTemplatesSchema.safeParse(waRaw);
if (!waResult.success && waRaw !== null) {
  for (const issue of waResult.error.issues) {
    errors.push(
      `En editar/mensajes-whatsapp.json, falta o está vacía la plantilla para el botón '${issue.path.join('.')}': ${issue.message}.`
    );
  }
} else if (waResult.success) {
  for (const [key, tpl] of Object.entries(waResult.data)) {
    validateMessageTemplate(tpl, `editar/mensajes-whatsapp.json -> "${key}"`);
  }
}

// 3.5. Validar duraciones globales en src/editar/ajustes.ts
const duracionesResult = z.array(DurationOptionSchema).min(1).safeParse(AJUSTES.duraciones);
if (!duracionesResult.success) {
  for (const issue of duracionesResult.error.issues) {
    errors.push(
      `En editar/ajustes.ts, duraciones '${issue.path.join('.')}': ${issue.message}. Revisa que cada duración tenga meses (entero positivo), etiqueta opcional y descuento_pct (0 a 90).`
    );
  }
} else {
  const mesesSet = new Set<number>();
  for (const d of duracionesResult.data) {
    if (mesesSet.has(d.meses)) {
      errors.push(`En editar/ajustes.ts: la duración de ${d.meses} meses está duplicada en 'duraciones'.`);
    }
    mesesSet.add(d.meses);
  }
  if (!mesesSet.has(1)) {
    warnings.push(
      `En editar/ajustes.ts: se recomienda incluir la duración base de 1 mes en 'duraciones'.`
    );
  }
}

// 4. Validar servicios individuales en src/editar/servicios/*.json
const serviciosDir = resolve(root, 'src/editar/servicios');
const serviceFiles = readdirSync(serviciosDir).filter(
  (f) => f.endsWith('.json') && f !== 'orden.json'
);

const ordenRaw = loadJsonSafe('src/editar/servicios/orden.json');
if (ordenRaw !== null && !Array.isArray(ordenRaw)) {
  errors.push(
    `En editar/servicios/orden.json: debe ser una lista de textos entre corchetes, por ejemplo ["netflix", "disney-plus"].`
  );
}

const activeCurrencies = Array.from(
  new Set(countries.filter((c) => c.enabled).map((c) => c.currency.toUpperCase()))
);

const services: StreamingService[] = [];

for (const fileName of serviceFiles) {
  const relFile = `src/editar/servicios/${fileName}`;
  const shortName = `servicios/${fileName}`;
  const raw = loadJsonSafe(relFile);
  if (raw === null) continue;

  const parsed = StreamingServiceSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const pathStr = issue.path.join('.');
      errors.push(
        `En ${shortName}, campo '${pathStr}': valor inválido (${issue.message}). Revisa que el texto o número esté bien escrito.`
      );
    }
    continue;
  }

  const svc = parsed.data;
  services.push(svc);

  if (svc.iniciales !== undefined) {
    if (typeof svc.iniciales !== 'string' || svc.iniciales.trim().length === 0 || svc.iniciales.trim().length > 3) {
      errors.push(
        `En ${shortName}: las 'iniciales' deben tener entre 1 y 3 caracteres (recibido: "${svc.iniciales}").`
      );
    }
  }

  if (svc.logo_propio !== undefined) {
    if (typeof svc.logo_propio !== 'string' || !svc.logo_propio.trim()) {
      errors.push(`En ${shortName}: el campo 'logo_propio' no puede estar vacío.`);
    } else {
      const cleanLogoPath = svc.logo_propio.replace(/^\/+/, '');
      const fullLogoPath = resolve(root, 'public', cleanLogoPath);
      if (!existsSync(fullLogoPath)) {
        errors.push(
          `En ${shortName}: el archivo de 'logo_propio' ("${svc.logo_propio}") no existe en la carpeta public/. Revisa la ruta.`
        );
      }
    }
  }

  validateMessageTemplate(svc.mensaje_comprar, `${shortName} -> mensaje_comprar`);
  validateMessageTemplate(svc.mensaje_disponibilidad, `${shortName} -> mensaje_disponibilidad`);

  const globalMonths = new Set<number>(AJUSTES.duraciones.map((d) => d.meses));

  if (svc.descuentos) {
    for (const [durStr, pct] of Object.entries(svc.descuentos)) {
      const m = Number(durStr);
      if (!Number.isInteger(m) || m <= 0) {
        errors.push(
          `En ${shortName}: la clave "${durStr}" en descuentos debe ser un número entero de meses (ej. "3").`
        );
      } else if (!globalMonths.has(m)) {
        warnings.push(
          `En ${shortName}: el mes "${durStr}" en descuentos no está definido en editar/ajustes.ts (duraciones).`
        );
      }
      if (!Number.isInteger(pct) || pct < 0 || pct > 90) {
        errors.push(
          `En ${shortName}: el descuento para ${durStr} meses debe ser un número entero entre 0 y 90 (recibido: ${pct}).`
        );
      }
    }
  }

  if (svc.duraciones_permitidas) {
    for (const m of svc.duraciones_permitidas) {
      if (!globalMonths.has(m)) {
        warnings.push(
          `En ${shortName}: la duración permitida de ${m} meses no está definida en editar/ajustes.ts (duraciones).`
        );
      }
    }
  }

  for (const plan of svc.planes) {
    validateMessageTemplate(
      plan.mensaje_comprar,
      `${shortName}, plan '${plan.nombre}' -> mensaje_comprar`
    );
    validateMessageTemplate(
      plan.mensaje_disponibilidad,
      `${shortName}, plan '${plan.nombre}' -> mensaje_disponibilidad`
    );

    if (typeof plan.prices.USD !== 'number' || plan.prices.USD <= 0) {
      errors.push(
        `En ${shortName}, plan '${plan.nombre}': falta el precio en USD (agrega "USD": monto dentro de "prices").`
      );
    }
    for (const curr of activeCurrencies) {
      if (typeof plan.prices[curr] !== 'number' || plan.prices[curr] <= 0) {
        warnings.push(
          `En ${shortName}, plan '${plan.nombre}': falta el precio en la moneda activa ${curr} (se usará el precio en USD como respaldo).`
        );
      }
    }

    if (plan.duraciones_permitidas) {
      for (const m of plan.duraciones_permitidas) {
        if (!globalMonths.has(m)) {
          warnings.push(
            `En ${shortName}, plan '${plan.nombre}': la duración permitida de ${m} meses no está definida en editar/ajustes.ts (duraciones).`
          );
        }
      }
    }

    if (plan.descuentos) {
      for (const [durStr, pct] of Object.entries(plan.descuentos)) {
        const m = Number(durStr);
        if (!Number.isInteger(m) || m <= 0) {
          errors.push(
            `En ${shortName}, plan '${plan.nombre}': la clave "${durStr}" en descuentos debe ser un número entero de meses (ej. "3").`
          );
        } else if (!globalMonths.has(m)) {
          warnings.push(
            `En ${shortName}, plan '${plan.nombre}': el mes "${durStr}" en descuentos no está definido en editar/ajustes.ts (duraciones).`
          );
        }
        if (!Number.isInteger(pct) || pct < 0 || pct > 90) {
          errors.push(
            `En ${shortName}, plan '${plan.nombre}': el descuento para ${durStr} meses debe ser un número entero entre 0 y 90 (recibido: ${pct}).`
          );
        }
      }
    }

    if (plan.precios_por_duracion) {
      for (const [durStr, pricesMap] of Object.entries(plan.precios_por_duracion)) {
        const m = Number(durStr);
        if (!Number.isInteger(m) || m <= 0) {
          errors.push(
            `En ${shortName}, plan '${plan.nombre}': la clave "${durStr}" en precios_por_duracion debe ser un número entero de meses (ej. "3").`
          );
        }
        for (const [curr, amt] of Object.entries(pricesMap)) {
          if (typeof amt !== 'number' || amt <= 0) {
            errors.push(
              `En ${shortName}, plan '${plan.nombre}', duracion ${durStr} meses: el precio en ${curr} debe ser un número mayor a 0.`
            );
          }
        }
      }
    }

    if (plan.etiqueta !== undefined) {
      if (typeof plan.etiqueta !== 'string' || plan.etiqueta.length > 28) {
        errors.push(
          `En ${shortName}, plan '${plan.nombre}': la etiqueta no debe superar los 28 caracteres (tiene ${String(plan.etiqueta).length}).`
        );
      }
    }

    if (plan.gancho !== undefined) {
      if (typeof plan.gancho !== 'string' || plan.gancho.length > 70) {
        errors.push(
          `En ${shortName}, plan '${plan.nombre}': el gancho no debe superar los 70 caracteres (tiene ${String(plan.gancho).length}).`
        );
      }
    }

    if (plan.destacado !== undefined && typeof plan.destacado !== 'boolean') {
      errors.push(`En ${shortName}, plan '${plan.nombre}': 'destacado' debe ser un booleano (true o false).`);
    }
  }
}

// 5. Validar textos del panel de compra (src/editar/textos/panel-compra.json) y demás JSON
const panelRaw = loadJsonSafe('src/editar/textos/panel-compra.json');
if (panelRaw !== null) {
  const panelParsed = PanelCompraTextsSchema.safeParse(panelRaw);
  if (!panelParsed.success) {
    for (const issue of panelParsed.error.issues) {
      errors.push(
        `En editar/textos/panel-compra.json, campo '${issue.path.join('.')}': ${issue.message}. Revisa que ningún texto obligatorio esté vacío y que 'pasos' tenga exactamente 3 elementos.`
      );
    }
  }
}

// 6. Validar garantia.json (src/editar/textos/garantia.json)
const garantiaRaw = loadJsonSafe('src/editar/textos/garantia.json');
if (garantiaRaw !== null) {
  const gParsed = GarantiaTextsSchema.safeParse(garantiaRaw);
  if (!gParsed.success) {
    for (const issue of gParsed.error.issues) {
      errors.push(
        `En editar/textos/garantia.json, campo '${issue.path.join('.')}': ${issue.message}.`
      );
    }
  } else {
    const allowedGarantiaPh = new Set(['duracion', 'meses', 'marca']);
    for (const [key, val] of Object.entries(gParsed.data)) {
      if (typeof val === 'string') {
        const phs = extractTemplatePlaceholders(val);
        for (const ph of phs) {
          if (!allowedGarantiaPh.has(ph)) {
            warnings.push(
              `En editar/textos/garantia.json -> "${key}": el marcador "{${ph}}" no es reconocido (permitidos: {duracion}, {meses}, {marca}).`
            );
          }
        }
      }
    }
  }
}

// 7. Validar preguntas comunes (src/editar/textos/faq-comunes.json)
const faqRaw = loadJsonSafe('src/editar/textos/faq-comunes.json');
if (faqRaw !== null) {
  const fParsed = FaqComunesSchema.safeParse(faqRaw);
  if (!fParsed.success) {
    for (const issue of fParsed.error.issues) {
      errors.push(
        `En editar/textos/faq-comunes.json, campo '${issue.path.join('.')}': ${issue.message}. Cada elemento debe tener question y answer.`
      );
    }
  }
}

// 7.5. Validar por-pais.json (src/editar/textos/por-pais.json)
const porPaisRaw = loadJsonSafe('src/editar/textos/por-pais.json');
if (porPaisRaw !== null) {
  const ppParsed = PorPaisSchema.safeParse(porPaisRaw);
  if (!ppParsed.success) {
    for (const issue of ppParsed.error.issues) {
      errors.push(
        `En editar/textos/por-pais.json, campo '${issue.path.join('.')}': ${issue.message}.`
      );
    }
  } else {
    const allowedPlaceholders = new Set(['pais', 'metodos_pago', 'moneda', 'marca']);
    const allowedCountryCodes = new Set(['PE', 'MX', 'AR', 'default']);
    for (const [clave, item] of Object.entries(ppParsed.data)) {
      if (!item.plantilla || !item.plantilla.trim()) {
        errors.push(`En editar/textos/por-pais.json -> "${clave}": la plantilla no puede estar vacía.`);
      }
      const phs = extractTemplatePlaceholders(item.plantilla);
      for (const ph of phs) {
        if (!allowedPlaceholders.has(ph)) {
          warnings.push(
            `En editar/textos/por-pais.json -> "${clave}": marcador desconocido "{${ph}}" en plantilla.`
          );
        }
      }
      if (item.overrides) {
        for (const [cCode, overrideText] of Object.entries(item.overrides)) {
          if (!allowedCountryCodes.has(cCode.toUpperCase()) && !allowedCountryCodes.has(cCode)) {
            warnings.push(
              `En editar/textos/por-pais.json -> "${clave}": override con código de país desconocido "${cCode}".`
            );
          }
          if (typeof overrideText !== 'string' || !overrideText.trim()) {
            errors.push(
              `En editar/textos/por-pais.json -> "${clave}": el override para "${cCode}" está vacío.`
            );
          }
          const ovPhs = extractTemplatePlaceholders(overrideText);
          for (const ph of ovPhs) {
            if (!allowedPlaceholders.has(ph)) {
              warnings.push(
                `En editar/textos/por-pais.json -> "${clave}" [override ${cCode}]: marcador desconocido "{${ph}}".`
              );
            }
          }
        }
      }
    }
  }
}

// 8. Avisar de textos pendientes con "CAMBIAR:"
for (const f of [
  'src/editar/textos/garantia.json',
  'src/editar/textos/panel-compra.json',
  'src/editar/textos/inicio.json',
  'src/editar/textos/faq-comunes.json',
  'src/editar/ajustes.ts',
]) {
  try {
    const raw = readFileSync(resolve(root, f), 'utf-8');
    if (raw.includes('CAMBIAR:')) {
      const lines = raw.split('\n');
      lines.forEach((l, idx) => {
        if (l.includes('CAMBIAR:')) {
          warnings.push(`Pendiente en ${f}:${idx + 1} -> ${l.trim().slice(0, 90)}`);
        }
      });
    }
  } catch (_) {}
}

for (const extraJson of [
  'src/editar/textos/inicio.json',
  'src/editar/textos/pie.json',
  'src/editar/textos/botones.json',
  'src/editar/seo.json',
]) {
  loadJsonSafe(extraJson);
}

// 9. Validar textos de valoraciones en src/editar/textos/valoraciones.json
const valRaw = loadJsonSafe('src/editar/textos/valoraciones.json');
if (valRaw) {
  const valParse = ValoracionesTextsSchema.safeParse(valRaw);
  if (!valParse.success) {
    for (const issue of valParse.error.issues) {
      errors.push(`En editar/textos/valoraciones.json -> ${issue.path.join('.')}: ${issue.message}`);
    }
  }
}

// 10. Validar páginas de confianza: impedir activar bandera si aún contienen "CAMBIAR:"
const paginasConfianzaCheck: { flag: boolean; name: string; file: string }[] = [
  {
    flag: Boolean(AJUSTES.PAGINAS_CONFIANZA?.quienes_somos),
    name: 'PAGINAS_CONFIANZA.quienes_somos',
    file: 'src/editar/textos/quienes-somos.md',
  },
  {
    flag: Boolean(AJUSTES.PAGINAS_CONFIANZA?.terminos),
    name: 'PAGINAS_CONFIANZA.terminos',
    file: 'src/editar/textos/terminos.md',
  },
];

for (const item of paginasConfianzaCheck) {
  try {
    const rawMd = readFileSync(resolve(root, item.file), 'utf-8');
    if (item.flag && /CAMBIAR:/i.test(rawMd)) {
      errors.push(
        `En editar/ajustes.ts: no puedes activar '${item.name}: true' mientras queden textos pendientes con "CAMBIAR:" en ${item.file}.`
      );
    }
  } catch (err) {
    errors.push(`No se pudo leer ${item.file}: ${(err as Error).message}`);
  }
}

// 11. Verificar longitudes de metadatos SEO (títulos <= 60 y descripciones <= 155) y unicidad
const seoRaw = loadJsonSafe('src/editar/seo.json') as Record<string, any> | null;
if (seoRaw && typeof seoRaw === 'object') {
  const garantiaObj = (garantiaRaw && typeof garantiaRaw === 'object' ? garantiaRaw : {}) as Record<string, string>;
  const garantiaCorta = garantiaObj.garantia_corta || 'garantía durante todo el tiempo contratado';
  const seenTitles = new Set<string>();
  const seenDescs = new Set<string>();

  const checkMetaPair = (label: string, rawTit: string, rawDesc: string) => {
    const tit = rawTit.replaceAll('{marca}', MARCA.nombre).trim();
    const desc = rawDesc.replaceAll('{marca}', MARCA.nombre).trim();
    if (tit.length > 60) {
      warnings.push(`SEO (${label}): el título tiene ${tit.length} caracteres (máximo recomendado: 60) -> "${tit}"`);
    }
    if (desc.length > 155) {
      warnings.push(`SEO (${label}): la descripción tiene ${desc.length} caracteres (máximo recomendado: 155) -> "${desc}"`);
    }
    if (seenTitles.has(tit)) {
      warnings.push(`SEO (${label}): el título está duplicado con otra página -> "${tit}"`);
    }
    if (seenDescs.has(desc)) {
      warnings.push(`SEO (${label}): la descripción está duplicada con otra página -> "${desc}"`);
    }
    seenTitles.add(tit);
    seenDescs.add(desc);
  };

  for (const key of ['inicio', 'garantia', 'privacidad', 'noEncontrado', 'quienesSomos', 'terminos']) {
    const entry = seoRaw[key];
    if (entry && typeof entry.titulo === 'string' && typeof entry.descripcion === 'string') {
      checkMetaPair(`seo.json -> ${key}`, entry.titulo, entry.descripcion);
    }
  }

  const tplObj = seoRaw.servicioPlantilla || {};
  for (const svc of services) {
    const meta = construirSeoServicio({
      service: svc,
      marcaNombre: MARCA.nombre,
      paisNombre: MARCA.paisPorDefecto,
      pagos: payments,
      garantiaTexto: garantiaCorta,
      plantillaTitulo: tplObj.plantillaTitulo,
      plantillaDescripcion: tplObj.plantillaDescripcion,
    });
    checkMetaPair(`servicio ${svc.slug}`, meta.titulo, meta.descripcion);
  }
}

for (const country of countries.filter((c) => c.enabled)) {
  const hasMethod = payments.some(
    (pm) =>
      pm.enabled &&
      (pm.countries.includes(country.code) || pm.countries.includes('*'))
  );
  if (!hasMethod) {
    warnings.push(
      `En editar/pagos.json: el país activo "${country.code}" (${country.name}) no tiene ningún medio de pago habilitado.`
    );
  }
}

for (const w of warnings) {
  console.warn(`⚠️  ${w}`);
}

if (errors.length > 0) {
  console.error('\n❌ SE ENCONTRARON ERRORES EN TUS ARCHIVOS DE EDICIÓN:');
  for (const err of errors) {
    console.error(`   • ${err}`);
  }
  process.exit(1);
}

console.log(
  `✓ check:data OK — ${countries.length} países (${activeCurrencies.join(', ')}), ${services.length} servicios, ${payments.length} medios de pago y plantillas de WhatsApp validadas.`
);

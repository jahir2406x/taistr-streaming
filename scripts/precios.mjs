import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { AJUSTES } from '../src/editar/ajustes.ts';
import {
  calculateDurationPrice,
  getAvailableDurationsForPlan,
} from '../src/core/pricing.ts';

const root = process.cwd();
const servicesDir = resolve(root, 'src/editar/servicios');

// Parse arguments: npm run precios -- [servicio] [moneda]
const rawArgs = process.argv.slice(2).filter((a) => a !== '--');
const knownCurrencies = new Set(['PEN', 'USD', 'MXN', 'ARS', 'COP', 'CLP']);

let filterService = null;
let filterCurrency = 'PEN';

if (rawArgs.length === 1) {
  const argUpper = rawArgs[0].toUpperCase();
  if (knownCurrencies.has(argUpper)) {
    filterCurrency = argUpper;
  } else {
    filterService = rawArgs[0].toLowerCase();
  }
} else if (rawArgs.length >= 2) {
  filterService = rawArgs[0].toLowerCase();
  filterCurrency = rawArgs[1].toUpperCase();
}

// Load services
const serviceFiles = readdirSync(servicesDir)
  .filter((f) => f.endsWith('.json') && f !== 'orden.json')
  .sort();

const allServices = [];
for (const file of serviceFiles) {
  try {
    const raw = JSON.parse(readFileSync(join(servicesDir, file), 'utf-8'));
    allServices.push(raw);
  } catch (err) {
    console.error(`Error leyendo ${file}: ${err.message}`);
  }
}

const matchedServices = filterService
  ? allServices.filter(
      (s) =>
        s.id?.toLowerCase() === filterService ||
        s.slug?.toLowerCase() === filterService ||
        s.nombre?.toLowerCase().includes(filterService)
    )
  : allServices;

if (matchedServices.length === 0) {
  console.log(`No se encontró ningún servicio que coincida con "${filterService}".`);
  console.log(`Servicios disponibles: ${allServices.map((s) => s.id).join(', ')}`);
  process.exit(0);
}

// Prepare rows
const rows = [];
for (const service of matchedServices) {
  for (const plan of service.planes || []) {
    const durations = getAvailableDurationsForPlan(
      AJUSTES.duraciones,
      plan.duraciones_permitidas,
      service.duraciones_permitidas
    );

    for (const dur of durations) {
      const res = calculateDurationPrice({
        planPrices: plan.prices,
        meses: dur.meses,
        targetCurrency: filterCurrency,
        preciosPorDuracion: plan.precios_por_duracion,
        plan,
        service,
        defaultDiscounts: AJUSTES.duraciones,
        redondeo: AJUSTES.redondeo,
      });

      const route = `${service.nombre} > ${plan.nombre} > ${dur.etiqueta}`;
      const total = res.formatted;
      const ahorro =
        res.savingsAmount > 0
          ? `${res.savingsFormatted} (-${res.discountPct}%)`
          : '-';
      const origen = res.discountSource;

      rows.push({
        route,
        total,
        ahorro,
        origen,
      });
    }
  }
}

// Calculate column widths
let maxRoute = 'Servicio > Plan > Duración'.length;
let maxTotal = 'Total'.length;
let maxAhorro = 'Ahorro'.length;
let maxOrigen = 'Origen'.length;

for (const r of rows) {
  if (r.route.length > maxRoute) maxRoute = r.route.length;
  if (r.total.length > maxTotal) maxTotal = r.total.length;
  if (r.ahorro.length > maxAhorro) maxAhorro = r.ahorro.length;
  if (r.origen.length > maxOrigen) maxOrigen = r.origen.length;
}

const sep = `+-${'-'.repeat(maxRoute)}-+-${'-'.repeat(maxTotal)}-+-${'-'.repeat(maxAhorro)}-+-${'-'.repeat(maxOrigen)}-+`;
const pad = (str, len, align = 'left') =>
  align === 'right' ? str.padStart(len) : str.padEnd(len);

console.log(`\nTarifas calculadas (Moneda: ${filterCurrency}):\n`);
console.log(sep);
console.log(
  `| ${pad('Servicio > Plan > Duración', maxRoute)} | ${pad('Total', maxTotal)} | ${pad('Ahorro', maxAhorro)} | ${pad('Origen', maxOrigen)} |`
);
console.log(sep);
for (const r of rows) {
  console.log(
    `| ${pad(r.route, maxRoute)} | ${pad(r.total, maxTotal, 'right')} | ${pad(r.ahorro, maxAhorro, 'right')} | ${pad(r.origen, maxOrigen)} |`
  );
}
console.log(sep);
console.log(`\nTotal: ${rows.length} combinaciones tarifarias evaluadas.\n`);


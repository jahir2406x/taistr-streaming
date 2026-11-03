import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MARCA } from '../src/editar/marca.ts';
import { AJUSTES } from '../src/editar/ajustes.ts';
import {
  renderWhatsAppMessage,
  sanitizeWhatsAppText,
  formatPrice,
  resolvePlanPrice,
  calculateDurationPrice,
  getAvailableDurationsForPlan,
  getPaymentMethodsForCountry,
  type StreamingService,
  type Country,
  type PaymentMethod,
  type WhatsAppTemplates,
  type WhatsAppButtonType,
} from '../src/core/index.ts';

const root = process.cwd();

function readJson<T>(relPath: string): T {
  return JSON.parse(readFileSync(resolve(root, relPath), 'utf-8')) as T;
}

const orden = readJson<string[]>('src/editar/servicios/orden.json');
const paises = readJson<Country[]>('src/editar/paises.json');
const pagos = readJson<PaymentMethod[]>('src/editar/pagos.json');
const plantillas = readJson<WhatsAppTemplates>('src/editar/mensajes-whatsapp.json');

const servicios: StreamingService[] = orden.map((slug) =>
  readJson<StreamingService>(`src/editar/servicios/${slug}.json`)
);

const filtroSlug = process.argv[2]?.trim().toLowerCase();
const cleanPhone = MARCA.numeroWhatsapp.replace(/\D/g, '');
const defaultCountry = paises.find((c) => c.code === 'PE') || paises[0];
const defaultPay = getPaymentMethodsForCountry(defaultCountry.code, pagos, paises)[0]?.name || 'Yape';

function toWaUrl(msg: string): string {
  const clean = sanitizeWhatsAppText(msg);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(clean)}`;
}

function imprimirBloque(etiqueta: string, tipo: WhatsAppButtonType, msg: string): void {
  console.log(`  • [${tipo}] ${etiqueta}`);
  console.log(`    Mensaje : "${msg}"`);
  console.log(`    URL     : ${toWaUrl(msg)}\n`);
}

console.log('========================================================================');
console.log(` VISTA PREVIA DE MENSAJES DE WHATSAPP — Marca: ${MARCA.nombre}`);
console.log(` País base: ${defaultCountry.name} (${defaultCountry.currency}) · Medio: ${defaultPay}`);
console.log('========================================================================\n');

if (!filtroSlug) {
  console.log('--- BOTONES GENERALES DE LA WEB ---');
  for (const [tipo, etiqueta] of [
    ['consulta_general', 'Encabezado / Hero / Pie / 404'],
    ['boton_flotante', 'Botón flotante inferior derecho'],
    ['soporte', 'Página de Garantía y Soporte'],
  ] as const) {
    const msg = renderWhatsAppMessage({
      tipo,
      marca: MARCA.nombre,
      pais: defaultCountry.name,
      codigoPais: defaultCountry.code,
      moneda: defaultCountry.currency,
      medioPago: defaultPay,
      mostrarPrecios: AJUSTES.SHOW_PRICES,
      plantillas,
    });
    imprimirBloque(etiqueta, tipo, msg);
  }
}

const serviciosFiltrados = filtroSlug
  ? servicios.filter(
      (s) =>
        s.slug.toLowerCase() === filtroSlug ||
        s.id.toLowerCase() === filtroSlug ||
        s.nombre.toLowerCase().includes(filtroSlug)
    )
  : servicios;

if (serviciosFiltrados.length === 0) {
  console.error(
    `No se encontró ningún servicio que coincida con "${filtroSlug}". Slugs disponibles: ${servicios.map((s) => s.slug).join(', ')}`
  );
  process.exit(1);
}

for (const svc of serviciosFiltrados) {
  const minAmount = Math.min(
    ...svc.planes.map((p) => resolvePlanPrice(p.prices, defaultCountry.currency).amount)
  );
  const minFormatted = formatPrice(minAmount, defaultCountry.currency, defaultCountry.locale);

  console.log(`------------------------------------------------------------------------`);
  console.log(
    ` SERVICIO: ${svc.nombre.toUpperCase()} (slug: ${svc.slug}) — ${svc.disponible ? 'DISPONIBLE' : 'BAJO CONSULTA'}`
  );
  console.log(`------------------------------------------------------------------------`);

  const tipoTarjeta: WhatsAppButtonType = svc.disponible ? 'barra_movil' : 'consultar_disponibilidad';
  const msgTarjeta = renderWhatsAppMessage({
    tipo: tipoTarjeta,
    marca: MARCA.nombre,
    servicio: svc.nombre,
    precio: minFormatted,
    moneda: defaultCountry.currency,
    codigoPais: defaultCountry.code,
    pais: defaultCountry.name,
    medioPago: defaultPay,
    disponible: svc.disponible,
    mostrarPrecios: AJUSTES.SHOW_PRICES,
    plantillas,
    mensajeServicioComprar: svc.mensaje_comprar,
    mensajeServicioDisponibilidad: svc.mensaje_disponibilidad,
  });
  imprimirBloque('Tarjeta de catálogo y barra móvil', tipoTarjeta, msgTarjeta);

  for (const plan of svc.planes) {
    const pRes = resolvePlanPrice(plan.prices, defaultCountry.currency);
    const pFormatted = formatPrice(pRes.amount, pRes.currency, defaultCountry.locale);

    const planDisponible = Boolean(svc.disponible && (plan.disponible ?? true));
    
    if (planDisponible) {
      const planDurations = getAvailableDurationsForPlan(
        AJUSTES.duraciones,
        plan.duraciones_permitidas
      );
      for (const dur of planDurations) {
        const durPrice = calculateDurationPrice({
          planPrices: plan.prices,
          meses: dur.meses,
          descuentoPct: dur.descuento_pct,
          targetCurrency: defaultCountry.currency,
          preciosPorDuracion: plan.precios_por_duracion,
          showPrices: AJUSTES.SHOW_PRICES,
          locale: defaultCountry.locale,
        });
        const durLabel = dur.etiqueta || (dur.meses === 1 ? '1 mes' : `${dur.meses} meses`);
        const msgPlan = renderWhatsAppMessage({
          tipo: 'comprar_plan',
          marca: MARCA.nombre,
          servicio: svc.nombre,
          plan: plan.nombre,
          duracion: durLabel,
          pantallas: plan.pantallas,
          precio: durPrice.formatted,
          moneda: durPrice.currency,
          codigoPais: defaultCountry.code,
          pais: defaultCountry.name,
          medioPago: defaultPay,
          disponible: true,
          mostrarPrecios: AJUSTES.SHOW_PRICES,
          plantillas,
          mensajePlanComprar: plan.mensaje_comprar,
          mensajePlanDisponibilidad: plan.mensaje_disponibilidad,
          mensajeServicioComprar: svc.mensaje_comprar,
          mensajeServicioDisponibilidad: svc.mensaje_disponibilidad,
        });
        const ahorroStr = durPrice.savingsAmount > 0 ? ` [Ahorras ${durPrice.savingsFormatted}]` : '';
        imprimirBloque(
          `Plan "${plan.nombre}" (${durLabel}) — Panel de compra (medio: ${defaultPay})${ahorroStr}`,
          'comprar_plan',
          msgPlan
        );
      }
    } else {
      const msgDisp = renderWhatsAppMessage({
        tipo: 'consultar_disponibilidad',
        marca: MARCA.nombre,
        servicio: svc.nombre,
        plan: plan.nombre,
        duracion: plan.duracion,
        pantallas: plan.pantallas,
        precio: pFormatted,
        moneda: pRes.currency,
        codigoPais: defaultCountry.code,
        pais: defaultCountry.name,
        medioPago: defaultPay,
        disponible: false,
        mostrarPrecios: AJUSTES.SHOW_PRICES,
        plantillas,
        mensajePlanComprar: plan.mensaje_comprar,
        mensajePlanDisponibilidad: plan.mensaje_disponibilidad,
        mensajeServicioComprar: svc.mensaje_comprar,
        mensajeServicioDisponibilidad: svc.mensaje_disponibilidad,
      });
      imprimirBloque(
        `Plan "${plan.nombre}" (${plan.duracion}) — No disponible`,
        'consultar_disponibilidad',
        msgDisp
      );
    }

    for (const [tipoBoton, desc] of [
      ['armador_pedido', `Plan "${plan.nombre}" (${plan.duracion}) — Armador rápido`],
      ['renovar', `Plan "${plan.nombre}" (${plan.duracion}) — Renovación`],
    ] as const) {
      const msgPlan = renderWhatsAppMessage({
        tipo: tipoBoton,
        marca: MARCA.nombre,
        servicio: svc.nombre,
        plan: plan.nombre,
        duracion: plan.duracion,
        pantallas: plan.pantallas,
        precio: pFormatted,
        moneda: pRes.currency,
        codigoPais: defaultCountry.code,
        pais: defaultCountry.name,
        medioPago: defaultPay,
        disponible: planDisponible,
        mostrarPrecios: AJUSTES.SHOW_PRICES,
        plantillas,
        mensajePlanComprar: plan.mensaje_comprar,
        mensajePlanDisponibilidad: plan.mensaje_disponibilidad,
        mensajeServicioComprar: svc.mensaje_comprar,
        mensajeServicioDisponibilidad: svc.mensaje_disponibilidad,
      });
      imprimirBloque(desc, tipoBoton, msgPlan);
    }
  }
}


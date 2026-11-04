import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { AJUSTES } from '../src/editar/ajustes.ts';
import { onRequest as geoOnRequest } from '../functions/api/geo.ts';
import { onRequest as valorarOnRequest } from '../functions/api/valorar.ts';
import { onRequest as valoracionesOnRequest } from '../functions/api/valoraciones.ts';
import { onRequest as codigosOnRequest } from '../functions/api/codigos.ts';
import {
  resolveCountry,
  getCurrencyForCountry,
  resolvePlanPrice,
  formatPrice,
  getPaymentMethodsForCountry,
  buildWhatsAppOrderMessage,
  renderWhatsAppMessage,
  sanitizeWhatsAppText,
  openPlanSession,
  selectPanelPayment,
  updatePanelCountry,
  getSelectedPanelPayment,
  resolvePlanIncludes,
  isPlanAvailable,
  shouldCloseOnBackdropClick,
  calculateDurationPrice,
  getAvailableDurationsForPlan,
  selectPanelDuration,
  resolveDurationIncludes,
  resolveDurationGarantia,
  mergeServiceFaq,
  resolveDurationDiscount,
  resolverTextoPais,
  resolverPaisDesdeQuery,
  derivarIniciales,
  calcularColorTextoInsignia,
  calcularPromedio,
  formatearResumenValoraciones,
  validarVoto,
  calcularHuella,
  construirSeoServicio,
  construirBreadcrumbSchema,
  construirOrganizationSchema,
  ServicePlanSchema,
  StreamingServiceSchema,
  OrderSchema,
  type Country,
  type PaymentMethod,
  type DurationOption,
} from '../src/core/index.ts';

const mockCountries: Country[] = [
  { code: 'PE', name: 'Perú', currency: 'PEN', locale: 'es-PE', enabled: true },
  { code: 'MX', name: 'México', currency: 'MXN', locale: 'es-MX', enabled: true },
  { code: 'AR', name: 'Argentina', currency: 'ARS', locale: 'es-AR', enabled: true },
  { code: 'default', name: 'Otros países', currency: 'USD', locale: 'es-419', enabled: true },
];

const mockPayments: PaymentMethod[] = [
  {
    id: 'yape',
    name: 'Yape',
    type: 'local',
    countries: ['PE'],
    currencies: ['PEN'],
    enabled: true,
    order: 1,
    note: 'QR por WhatsApp',
  },
  {
    id: 'spei',
    name: 'SPEI',
    type: 'local',
    countries: ['MX'],
    currencies: ['MXN'],
    enabled: true,
    order: 1,
    note: 'Transferencia SPEI',
  },
  {
    id: 'binance',
    name: 'Binance (USDT / Binance Pay)',
    type: 'crypto',
    countries: ['*'],
    currencies: ['USD', 'PEN', 'MXN', 'ARS'],
    enabled: true,
    order: 99,
    note: 'La red y la dirección se te envían por WhatsApp',
  },
];

describe('src/core — lógica multi-país y multi-moneda', () => {
  test('1. país → moneda y respaldo a default (USD)', () => {
    assert.equal(getCurrencyForCountry('PE', mockCountries), 'PEN');
    assert.equal(getCurrencyForCountry('mx', mockCountries), 'MXN');
    assert.equal(getCurrencyForCountry('AR', mockCountries), 'ARS');
    assert.equal(getCurrencyForCountry('CL', mockCountries), 'USD');
    assert.equal(getCurrencyForCountry(null, mockCountries), 'USD');
    assert.equal(resolveCountry('XX', mockCountries).code, 'default');
  });

  test('2. resolución de precio con respaldo a USD cuando falta una moneda', () => {
    const prices = { USD: 4, PEN: 15, MXN: 70 };
    assert.deepEqual(resolvePlanPrice(prices, 'PEN'), {
      amount: 15,
      currency: 'PEN',
      isFallback: false,
    });
    assert.deepEqual(resolvePlanPrice(prices, 'ARS'), {
      amount: 4,
      currency: 'USD',
      isFallback: true,
    });
  });

  test('3. medios de pago filtrados y ordenados por país', () => {
    const peMethods = getPaymentMethodsForCountry('PE', mockPayments, mockCountries);
    assert.deepEqual(
      peMethods.map((m) => m.id),
      ['yape', 'binance']
    );

    const otherMethods = getPaymentMethodsForCountry('CL', mockPayments, mockCountries);
    assert.deepEqual(
      otherMethods.map((m) => m.id),
      ['binance']
    );
  });

  test('4. formato de precios siempre incluye el código ISO de la moneda', () => {
    const pen = formatPrice(15, 'PEN', 'es-PE');
    const mxn = formatPrice(70, 'MXN', 'es-MX');
    const usd = formatPrice(4, 'USD', 'es-419');

    assert.match(pen, /15/);
    assert.ok(pen.endsWith(' PEN'), `Se esperaba sufijo PEN en: ${pen}`);
    assert.ok(mxn.endsWith(' MXN'), `Se esperaba sufijo MXN en: ${mxn}`);
    assert.ok(usd.endsWith(' USD'), `Se esperaba sufijo USD en: ${usd}`);
  });

  test('5. construcción del mensaje de WhatsApp para país activo y otros países', () => {
    const msgPe = buildWhatsAppOrderMessage({
      serviceName: 'Netflix',
      planName: 'Perfil Personal 4K',
      duration: '30 días',
      formattedPrice: 'S/ 15 PEN',
      countryCode: 'PE',
      countryName: 'Perú',
      paymentMethodName: 'Yape',
      available: true,
      showPrices: true,
    });
    assert.ok(msgPe.includes('Netflix'));
    assert.ok(msgPe.includes('S/ 15 PEN'));
    assert.ok(msgPe.includes('Estoy en Perú y pagaría con Yape.'));

    const msgOther = buildWhatsAppOrderMessage({
      serviceName: 'Spotify',
      planName: 'Individual',
      formattedPrice: 'US$ 4 USD',
      countryCode: 'default',
      countryName: 'Otros países',
      paymentMethodName: 'Binance (USDT / Binance Pay)',
      available: true,
      showPrices: true,
    });
    assert.ok(msgOther.includes('Estoy en otro país y pagaría con Binance (USD).'));
  });

  test('6. esquema Order valida estructura para futura app de escritorio', () => {
    const sampleOrder = OrderSchema.parse({
      id: 'ord_001',
      created_at: '2026-10-30T21:00:00Z',
      service_id: 'netflix',
      plan_id: 'netflix-perfil-1m',
      country: 'PE',
      currency: 'PEN',
      amount: 13,
      payment_method_id: 'yape',
      status: 'paid',
      cost: 8.5,
      notes: 'Renovación mensual',
    });
    assert.equal(sampleOrder.status, 'paid');
  });

  test('7. prioridad de plantillas: plan > servicio > tipo de botón', () => {
    const porTipo = renderWhatsAppMessage({
      tipo: 'comprar_plan',
      marca: 'TaiSTR',
      servicio: 'Netflix',
      plan: 'Perfil 4K',
      precio: 'S/ 13 PEN',
      duracion: '30 días',
      pais: 'Perú',
      medioPago: 'Yape',
    });
    assert.ok(porTipo.startsWith('Hola TaiSTR, quiero el plan Perfil 4K de Netflix'));

    const porServicio = renderWhatsAppMessage({
      tipo: 'comprar_plan',
      marca: 'TaiSTR',
      servicio: 'Netflix',
      plan: 'Perfil 4K',
      mensajeServicioComprar: 'Mensaje servicio {servicio} - {plan} en {marca}',
    });
    assert.equal(porServicio, 'Mensaje servicio Netflix - Perfil 4K en TaiSTR');

    const porPlan = renderWhatsAppMessage({
      tipo: 'comprar_plan',
      marca: 'TaiSTR',
      servicio: 'Netflix',
      plan: 'Perfil 4K',
      pantallas: '1 pantalla',
      mensajeServicioComprar: 'Mensaje servicio {servicio}',
      mensajePlanComprar: 'Prioridad plan: {servicio} ({plan} · {pantallas})',
    });
    assert.equal(porPlan, 'Prioridad plan: Netflix (Perfil 4K · 1 pantalla)');
  });

  test('8. limpieza de marcadores vacíos sin dobles espacios ni paréntesis vacíos', () => {
    const sinPrecioNiDuracion = renderWhatsAppMessage({
      tipo: 'comprar_plan',
      marca: 'TaiSTR',
      servicio: 'Disney+',
      plan: 'Estándar',
      precio: '',
      duracion: '',
      pais: 'Perú',
      medioPago: 'Plin',
    });
    assert.ok(!sinPrecioNiDuracion.includes('()'));
    assert.ok(!sinPrecioNiDuracion.includes('  '));
    assert.equal(
      sinPrecioNiDuracion,
      'Hola TaiSTR, quiero el plan Estándar de Disney+. Estoy en Perú y pagaría con Plin. ¿Está disponible?'
    );
  });

  test('9. codificación de caracteres especiales en español (tildes, ñ, ¿?, emojis)', () => {
    const msg = renderWhatsAppMessage({
      tipo: 'comprar_plan',
      marca: 'TaiSTR',
      servicio: 'ViX Español',
      plan: 'Año / Niño 🎬',
      mensajePlanComprar: '¡Hola {marca}! ¿Tienen {servicio} — plan {plan}?\nGracias.',
    });
    const clean = sanitizeWhatsAppText(msg);
    const url = `https://wa.me/51999999999?text=${encodeURIComponent(clean)}`;
    const decoded = decodeURIComponent(url.split('?text=')[1]);
    assert.equal(decoded, '¡Hola TaiSTR! ¿Tienen ViX Español — plan Año / Niño 🎬?\nGracias.');
  });

  test('10. panel de compra: estado de selección independiente por plan y reinicio al abrir', () => {
    let sesionPlanA = openPlanSession('netflix::perfil', 'PE', mockPayments, mockCountries);
    assert.equal(sesionPlanA.selectedPaymentId, null);

    sesionPlanA = selectPanelPayment(sesionPlanA, 'yape');
    assert.equal(sesionPlanA.selectedPaymentId, 'yape');
    assert.equal(getSelectedPanelPayment(sesionPlanA)?.name, 'Yape');

    // Abrir otro plan o volver a abrir el mismo plan arranca sin medio seleccionado
    const sesionPlanB = openPlanSession('netflix::familiar', 'PE', mockPayments, mockCountries);
    assert.equal(sesionPlanB.selectedPaymentId, null);
  });

  test('11. panel de compra: cambio de país actualiza medios, caso de 1 solo medio y deselección', () => {
    let sesion = openPlanSession('disney::estandar', 'PE', mockPayments, mockCountries);
    sesion = selectPanelPayment(sesion, 'yape');

    // Al cambiar a MX, Yape no existe -> se deselecciona
    sesion = updatePanelCountry(sesion, 'MX', mockPayments, mockCountries);
    assert.equal(sesion.selectedPaymentId, null);
    assert.deepEqual(sesion.availablePayments.map((p) => p.id), ['spei', 'binance']);

    // Si elige Binance (disponible en todos) y cambia a país con 1 solo medio ('CL' -> default), se conserva
    sesion = selectPanelPayment(sesion, 'binance');
    sesion = updatePanelCountry(sesion, 'CL', mockPayments, mockCountries);
    assert.equal(sesion.availablePayments.length, 1);
    assert.equal(sesion.availablePayments[0].id, 'binance');
    assert.equal(sesion.selectedPaymentId, 'binance');
  });

  test('12. panel de compra: mensaje incluye {medio_pago} y servicio no disponible usa consultar_disponibilidad', () => {
    const msgCompra = renderWhatsAppMessage({
      tipo: 'comprar_plan',
      marca: 'TaiSTR',
      servicio: 'HBO Max',
      plan: 'Estándar',
      precio: 'S/ 6 PEN',
      duracion: '30 días',
      pais: 'Perú',
      codigoPais: 'PE',
      medioPago: 'Plin',
      disponible: true,
    });
    assert.ok(msgCompra.includes('Plin'));

    assert.equal(isPlanAvailable(false, true), false);
    assert.equal(isPlanAvailable(true, false), false);
    assert.equal(isPlanAvailable(true, undefined), true);

    const msgNoDisp = renderWhatsAppMessage({
      tipo: 'comprar_plan',
      marca: 'TaiSTR',
      servicio: 'Paramount+',
      plan: 'Mensual',
      duracion: '30 días',
      pais: 'Perú',
      codigoPais: 'PE',
      medioPago: 'Yape',
      disponible: false,
    });
    assert.ok(msgNoDisp.includes('consultar disponibilidad'));

    const listaAuto = resolvePlanIncludes({
      pantallas: '1 pantalla',
      duracion: '30 días',
      nota: 'Compatible con Smart TV',
    });
    assert.equal(listaAuto.length, 3);
    const listaCustom = resolvePlanIncludes({
      pantallas: '1 pantalla',
      duracion: '30 días',
      nota: 'Nota base',
      incluye: ['4K UHD', 'PIN propio'],
    });
    assert.deepEqual(listaCustom, ['4K UHD', 'PIN propio']);
  });

  test('13. panel de compra: regla de cierre por clic en el fondo', () => {
    // Mock de elementos DOM
    const cardChildren = new Set();
    const mockCard = {
      name: 'card',
      contains: (el: unknown) => cardChildren.has(el) || el === mockCard,
    };
    const optionBtn = { name: 'optionBtn' };
    const radioSpan = { name: 'radioSpan' };
    cardChildren.add(optionBtn);
    cardChildren.add(radioSpan);

    const backdropChildren = new Set();
    const mockBackdrop = {
      name: 'backdrop',
      contains: (el: unknown) =>
        backdropChildren.has(el) || el === mockBackdrop || mockCard.contains(el),
    };
    backdropChildren.add(mockCard);

    // a) Clic dentro de la carta (en el botón del medio de pago o sus hijos): NO cierra
    assert.equal(
      shouldCloseOnBackdropClick({
        pointerDownTarget: optionBtn,
        clickTarget: optionBtn,
        backdropElement: mockBackdrop,
        cardElement: mockCard,
        detail: 1,
        clientX: 120,
        clientY: 250,
      }),
      false,
      'No debe cerrar al hacer clic en un medio de pago'
    );

    assert.equal(
      shouldCloseOnBackdropClick({
        pointerDownTarget: radioSpan,
        clickTarget: radioSpan,
        backdropElement: mockBackdrop,
        cardElement: mockCard,
        detail: 1,
        clientX: 130,
        clientY: 255,
      }),
      false,
      'No debe cerrar al hacer clic en el span interno del radio'
    );

    // b) Clic sintético por teclado o script (detail 0 o 0,0 sin clic real): NO cierra
    assert.equal(
      shouldCloseOnBackdropClick({
        pointerDownTarget: mockBackdrop,
        clickTarget: mockBackdrop,
        backdropElement: mockBackdrop,
        cardElement: mockCard,
        detail: 0,
      }),
      false,
      'No debe cerrar con clic sintético (detail: 0)'
    );

    assert.equal(
      shouldCloseOnBackdropClick({
        pointerDownTarget: mockBackdrop,
        clickTarget: mockBackdrop,
        backdropElement: mockBackdrop,
        cardElement: mockCard,
        detail: 0,
        clientX: 0,
        clientY: 0,
      }),
      false,
      'No debe cerrar con coordenadas sintéticas 0,0'
    );

    // c) Arrastre desde la carta hacia el fondo: NO cierra
    assert.equal(
      shouldCloseOnBackdropClick({
        pointerDownTarget: optionBtn,
        clickTarget: mockBackdrop,
        backdropElement: mockBackdrop,
        cardElement: mockCard,
        detail: 1,
        clientX: 50,
        clientY: 50,
      }),
      false,
      'No debe cerrar si el puntero bajó dentro de la carta'
    );

    // d) Clic real en el fondo (pointerdown en fondo, click en fondo, detail 1): SÍ cierra
    assert.equal(
      shouldCloseOnBackdropClick({
        pointerDownTarget: mockBackdrop,
        clickTarget: mockBackdrop,
        backdropElement: mockBackdrop,
        cardElement: mockCard,
        detail: 1,
        clientX: 30,
        clientY: 30,
      }),
      true,
      'Sí debe cerrar con clic real en el fondo'
    );
  });

  test('14. Cálculo de duraciones, descuentos, redondeo y estado de duración en panel', () => {
    const planPrices = { PEN: 10, USD: 3 };

    // a) Descuento estándar con redondeo a paso de PEN (0.5)
    // 10 PEN * 3 meses * 0.95 = 28.5 -> mantiene 28.5 PEN. Ahorro: 30 - 28.5 = 1.5 PEN
    const res3Meses = calculateDurationPrice({
      planPrices,
      meses: 3,
      descuentoPct: 5,
      targetCurrency: 'PEN',
      locale: 'es-PE',
    });
    assert.equal(res3Meses.amount, 28.5);
    assert.equal(res3Meses.currency, 'PEN');
    assert.equal(res3Meses.savingsAmount, 1.5);
    assert.equal(res3Meses.isExact, false);
    assert.match(res3Meses.formatted, /28\.50/);
    assert.match(res3Meses.savingsFormatted, /1\.50/);

    // b) Precio exacto por duración tiene prioridad sobre el cálculo porcentual
    const resExacto = calculateDurationPrice({
      planPrices,
      meses: 3,
      descuentoPct: 5,
      targetCurrency: 'PEN',
      preciosPorDuracion: {
        '3': { PEN: 26 },
      },
      locale: 'es-PE',
    });
    assert.equal(resExacto.amount, 26);
    assert.equal(resExacto.isExact, true);
    assert.equal(resExacto.savingsAmount, 4); // 30 - 26 = 4

    // c) Redondeo en USD a 2 decimales
    // 3.55 USD * 3 meses * 0.95 = 10.1175 -> 10.12 USD
    const resUSD = calculateDurationPrice({
      planPrices: { USD: 3.55 },
      meses: 3,
      descuentoPct: 5,
      targetCurrency: 'USD',
      locale: 'es-419',
    });
    assert.equal(resUSD.amount, 10.12);
    assert.equal(resUSD.currency, 'USD');
    assert.equal(resUSD.savingsAmount, 0.53); // 10.65 - 10.12 = 0.53

    // d) Respaldo en USD cuando no existe la moneda solicitada
    const resFallback = calculateDurationPrice({
      planPrices: { USD: 4 },
      meses: 2,
      descuentoPct: 0,
      targetCurrency: 'EUR',
      locale: 'es-419',
    });
    assert.equal(resFallback.currency, 'USD');
    assert.equal(resFallback.isFallback, true);
    assert.equal(resFallback.amount, 8);
    assert.equal(resFallback.savingsAmount, 0);
    assert.equal(resFallback.savingsFormatted, '');

    // e) getAvailableDurationsForPlan respeta restricciones de duraciones_permitidas
    const allDurations: DurationOption[] = [
      { meses: 1, etiqueta: '1 mes', descuento_pct: 0 },
      { meses: 2, etiqueta: '2 meses', descuento_pct: 0 },
      { meses: 3, etiqueta: '3 meses', descuento_pct: 5 },
      { meses: 6, etiqueta: '6 meses', descuento_pct: 10 },
    ];
    const restricted = getAvailableDurationsForPlan(allDurations, [1, 3]);
    assert.deepEqual(
      restricted.map((d) => d.meses),
      [1, 3]
    );

    const unrestricted = getAvailableDurationsForPlan(allDurations, undefined);
    assert.equal(unrestricted.length, 4);

    // f) Estado independiente de duración en PanelSessionState
    let session = openPlanSession('plan-1', 'PE', mockPayments, mockCountries);
    assert.equal(session.selectedMonths, 1, 'Por defecto la duración es 1 mes');
    assert.equal(session.selectedPaymentId, null, 'El medio de pago arranca nulo');

    session = selectPanelDuration(session, 6);
    assert.equal(session.selectedMonths, 6);

    // Otra sesión de otro plan es completamente independiente
    const session2 = openPlanSession('plan-2', 'PE', mockPayments, mockCountries);
    assert.equal(session2.selectedMonths, 1);
    assert.equal(session2.selectedPaymentId, null);
  });

  test('15. Textos de garantía y vigencia según duración, y preguntas comunes sin duplicados', () => {
    const tGarantiaPanel = 'Garantía de soporte y reposición durante los {duracion} contratados.';
    const rawIncludes = [
      '1 pantalla a la vez',
      'Vigencia: {duracion}',
      'Perfil privado con PIN',
    ];

    // a) Garantía se adapta a 1, 2 y 6 meses
    assert.equal(
      resolveDurationGarantia(tGarantiaPanel, '1 mes', 1),
      'Garantía de soporte y reposición durante los 1 mes contratados.'
    );
    assert.equal(
      resolveDurationGarantia(tGarantiaPanel, '2 meses', 2),
      'Garantía de soporte y reposición durante los 2 meses contratados.'
    );
    assert.equal(
      resolveDurationGarantia(tGarantiaPanel, '6 meses', 6),
      'Garantía de soporte y reposición durante los 6 meses contratados.'
    );

    // b) Vigencia en incluye se adapta con {duracion} tanto en panel como en tarjetas
    const inc1 = resolveDurationIncludes(rawIncludes, '1 mes', 1);
    assert.deepEqual(inc1, [
      '1 pantalla a la vez',
      'Vigencia: 1 mes',
      'Perfil privado con PIN',
    ]);

    const inc3 = resolveDurationIncludes(rawIncludes, '3 meses', 3);
    assert.deepEqual(inc3, [
      '1 pantalla a la vez',
      'Vigencia: 3 meses',
      'Perfil privado con PIN',
    ]);

    const inc6 = resolveDurationIncludes(rawIncludes, '6 meses', 6);
    assert.deepEqual(inc6, [
      '1 pantalla a la vez',
      'Vigencia: 6 meses',
      'Perfil privado con PIN',
    ]);

    // c) Vigencia sin marcador explícito pero con prefijo "Vigencia:" se adapta correctamente
    const incPrefijo = resolveDurationIncludes(['Vigencia: 30 días', 'Nota extra'], '2 meses', 2);
    assert.deepEqual(incPrefijo, ['Vigencia: 2 meses', 'Nota extra']);

    // d) mergeServiceFaq añade preguntas comunes a un servicio sin ellas
    const commonFaq = [
      {
        question: '¿El servicio es renovable al terminar mi periodo?',
        answer: 'Sí, todos son renovables.',
      },
      {
        question: '¿Qué cubre la garantía durante el tiempo contratado?',
        answer: 'Garantía completa por todo el tiempo contratado.',
      },
    ];

    const svcFaqSimple = [
      {
        pregunta: '¿Necesito iPhone para ver Apple TV+?',
        respuesta: 'No, funciona en Smart TV y navegadores.',
      },
    ];

    const mergedSimple = mergeServiceFaq(svcFaqSimple, commonFaq);
    assert.equal(mergedSimple.length, 3);
    assert.equal(mergedSimple[0].pregunta, '¿Necesito iPhone para ver Apple TV+?');
    assert.equal(mergedSimple[1].pregunta, '¿El servicio es renovable al terminar mi periodo?');
    assert.equal(mergedSimple[2].pregunta, '¿Qué cubre la garantía durante el tiempo contratado?');

    // e) mergeServiceFaq NO duplica preguntas si el servicio ya tiene una sobre renovación (ej. Netflix)
    const svcFaqWithRenov = [
      {
        pregunta: '¿Qué hago si me pide código de hogar?',
        respuesta: 'Usas nuestra web de códigos.',
      },
      {
        pregunta: '¿Puedo renovar el mismo perfil el próximo mes?',
        respuesta: 'Sí, te avisamos por WhatsApp.',
      },
    ];

    const mergedRenov = mergeServiceFaq(svcFaqWithRenov, commonFaq);
    assert.equal(mergedRenov.length, 3, 'No debe duplicar la pregunta de renovación');
    assert.equal(mergedRenov[0].pregunta, '¿Qué hago si me pide código de hogar?');
    assert.equal(mergedRenov[1].pregunta, '¿Puedo renovar el mismo perfil el próximo mes?');
    assert.equal(mergedRenov[2].pregunta, '¿Qué cubre la garantía durante el tiempo contratado?');
  });

  test('16. Validación de campos opcionales por plan (destacado, etiqueta, gancho, nota_interna)', () => {
    const basePlan = {
      nombre: 'Plan Estándar',
      duracion: '30 días',
      pantallas: '1 pantalla',
      prices: { PEN: 10, USD: 3 },
      nota: 'Nota base',
    };

    // a) Plan sin campos opcionales es totalmente válido
    assert.equal(ServicePlanSchema.safeParse(basePlan).success, true);

    // b) Plan con campos opcionales dentro de los límites válidos
    const validPlan = {
      ...basePlan,
      destacado: true,
      etiqueta: 'Sin códigos de hogar', // 20 chars <= 28
      gancho: '¿Cansado de los códigos de hogar y de viaje?', // 44 chars <= 70
      nota_interna: 'CAMBIAR: precios de prueba',
      nota_panel: 'Nota especial en el panel',
    };
    assert.equal(ServicePlanSchema.safeParse(validPlan).success, true);

    // c) Rechaza etiqueta mayor a 28 caracteres
    const longEtiqueta = {
      ...basePlan,
      etiqueta: 'Esta etiqueta supera el maximo permitido de caracteres', // > 28
    };
    const resEtiqueta = ServicePlanSchema.safeParse(longEtiqueta);
    assert.equal(resEtiqueta.success, false);

    // d) Rechaza gancho mayor a 70 caracteres
    const longGancho = {
      ...basePlan,
      gancho: 'Este es un gancho excesivamente largo que sobrepasa el limite de setenta caracteres permitidos por el esquema',
    };
    const resGancho = ServicePlanSchema.safeParse(longGancho);
    assert.equal(resGancho.success, false);
  });

  test('17. Descuentos multinivel: 4 niveles de prioridad, 0 explícito vs ausente, independencia y duraciones permitidas', () => {
    const defaultDuraciones: DurationOption[] = [
      { meses: 1, etiqueta: '1 mes', descuento_pct: 0 },
      { meses: 2, etiqueta: '2 meses', descuento_pct: 0 },
      { meses: 3, etiqueta: '3 meses', descuento_pct: 5 },
      { meses: 6, etiqueta: '6 meses', descuento_pct: 8 },
    ];

    // a) Prioridad 1: precio exacto del plan (precios_por_duracion) supera cualquier descuento
    const planConExacto = {
      precios_por_duracion: {
        '3': { PEN: 25 },
      },
      descuentos: { '3': 20 },
    };
    const svcConDescuento = {
      descuentos: { '3': 10 },
    };
    const resExacto = calculateDurationPrice({
      planPrices: { PEN: 10, USD: 3 },
      meses: 3,
      targetCurrency: 'PEN',
      plan: planConExacto,
      service: svcConDescuento,
      defaultDiscounts: defaultDuraciones,
    });
    assert.equal(resExacto.isExact, true);
    assert.equal(resExacto.amount, 25);
    assert.equal(resExacto.discountSource, 'exacto');

    // b) Prioridad 2: descuento del plan supera descuento del servicio y general
    const planSoloDesc = {
      descuentos: { '3': 15 },
    };
    const resPlan = calculateDurationPrice({
      planPrices: { PEN: 10, USD: 3 },
      meses: 3,
      targetCurrency: 'PEN',
      plan: planSoloDesc,
      service: svcConDescuento,
      defaultDiscounts: defaultDuraciones,
    });
    assert.equal(resPlan.isExact, false);
    assert.equal(resPlan.discountPct, 15);
    assert.equal(resPlan.discountSource, 'plan');
    // 10 * 3 * (1 - 0.15) = 25.5 -> con paso PEN 0.5 se mantiene 25.5
    assert.equal(resPlan.amount, 25.5);
    assert.equal(resPlan.savingsAmount, 4.5);

    // c) Prioridad 3: descuento del servicio cuando el plan no define esa duración
    const planVacio = { descuentos: {} };
    const resSvc = calculateDurationPrice({
      planPrices: { PEN: 10, USD: 3 },
      meses: 3,
      targetCurrency: 'PEN',
      plan: planVacio,
      service: svcConDescuento,
      defaultDiscounts: defaultDuraciones,
    });
    assert.equal(resSvc.discountPct, 10);
    assert.equal(resSvc.discountSource, 'servicio');
    // 10 * 3 * 0.9 = 27
    assert.equal(resSvc.amount, 27);
    assert.equal(resSvc.savingsAmount, 3);

    // d) Prioridad 4: descuento general de ajustes.ts cuando ni plan ni servicio definen esa duración
    const svcVacio = { descuentos: {} };
    const resGen = calculateDurationPrice({
      planPrices: { PEN: 10, USD: 3 },
      meses: 3,
      targetCurrency: 'PEN',
      plan: planVacio,
      service: svcVacio,
      defaultDiscounts: defaultDuraciones,
    });
    assert.equal(resGen.discountPct, 5);
    assert.equal(resGen.discountSource, 'general');
    // 10 * 3 * 0.95 = 28.5 -> con paso PEN 0.5 se mantiene 28.5
    assert.equal(resGen.amount, 28.5);
    assert.equal(resGen.savingsAmount, 1.5);

    // e) 0 explícito vs ausente en plan:
    // 0 explícito en plan detiene la búsqueda y aplica 0%, ignorando el 10% del servicio
    const planCero = { descuentos: { '3': 0 } };
    const resPlanCero = calculateDurationPrice({
      planPrices: { PEN: 10, USD: 3 },
      meses: 3,
      targetCurrency: 'PEN',
      plan: planCero,
      service: svcConDescuento,
      defaultDiscounts: defaultDuraciones,
    });
    assert.equal(resPlanCero.discountPct, 0);
    assert.equal(resPlanCero.discountSource, 'plan');
    assert.equal(resPlanCero.amount, 30);
    assert.equal(resPlanCero.savingsAmount, 0);

    // 0 explícito en servicio detiene la búsqueda y aplica 0%, ignorando el 5% general
    const svcCero = { descuentos: { '3': 0 } };
    const resSvcCero = calculateDurationPrice({
      planPrices: { PEN: 10, USD: 3 },
      meses: 3,
      targetCurrency: 'PEN',
      plan: null,
      service: svcCero,
      defaultDiscounts: defaultDuraciones,
    });
    assert.equal(resSvcCero.discountPct, 0);
    assert.equal(resSvcCero.discountSource, 'servicio');
    assert.equal(resSvcCero.amount, 30);
    assert.equal(resSvcCero.savingsAmount, 0);

    // Ausente delega al nivel siguiente
    const resAusente = resolveDurationDiscount(3, { descuentos: { '6': 10 } }, svcCero, defaultDuraciones);
    assert.equal(resAusente.pct, 0); // tomó de svcCero porque el plan no tenía "3"
    assert.equal(resAusente.source, 'servicio');

    // f) Independencia entre servicios:
    const svcA = { descuentos: { '3': 20 } };
    const svcB = { descuentos: { '3': 5 } };
    const resA = resolveDurationDiscount(3, null, svcA, defaultDuraciones);
    const resB = resolveDurationDiscount(3, null, svcB, defaultDuraciones);
    assert.equal(resA.pct, 20);
    assert.equal(resB.pct, 5);

    // g) Prioridad de duraciones permitidas: plan > servicio > global
    const dPlan = getAvailableDurationsForPlan(defaultDuraciones, [1, 3], [1, 2, 6]);
    assert.deepEqual(dPlan.map((d) => d.meses), [1, 3]);

    const dSvc = getAvailableDurationsForPlan(defaultDuraciones, undefined, [1, 2]);
    assert.deepEqual(dSvc.map((d) => d.meses), [1, 2]);

    const dGen = getAvailableDurationsForPlan(defaultDuraciones, null, null);
    assert.deepEqual(dGen.map((d) => d.meses), [1, 2, 3, 6]);

    // h) Redondeo configurable por moneda:
    // Caso 1: 5 PEN x 3 meses con 10% = 13.5 y formato "S/ 13.50 PEN"; ahorro = 1.5
    const res5Pen10 = calculateDurationPrice({
      planPrices: { PEN: 5 },
      meses: 3,
      descuentoPct: 10,
      targetCurrency: 'PEN',
      locale: 'es-PE',
    });
    assert.equal(res5Pen10.amount, 13.5);
    assert.equal(res5Pen10.formatted, 'S/ 13.50 PEN');
    assert.equal(res5Pen10.savingsAmount, 1.5);
    assert.equal(res5Pen10.savingsFormatted, 'S/ 1.50 PEN');

    // Caso 2: 5 PEN x 3 meses con 5% = 14.25 -> 14.5; formato "S/ 14.50 PEN"; ahorro = 0.5
    const res5Pen5 = calculateDurationPrice({
      planPrices: { PEN: 5 },
      meses: 3,
      descuentoPct: 5,
      targetCurrency: 'PEN',
      locale: 'es-PE',
    });
    assert.equal(res5Pen5.amount, 14.5);
    assert.equal(res5Pen5.formatted, 'S/ 14.50 PEN');
    assert.equal(res5Pen5.savingsAmount, 0.5);
    assert.equal(res5Pen5.savingsFormatted, 'S/ 0.50 PEN');

    // Caso 3: MXN y ARS con paso 1 conservan el comportamiento entero anterior
    const resMxn = calculateDurationPrice({
      planPrices: { MXN: 25 },
      meses: 3,
      descuentoPct: 5,
      targetCurrency: 'MXN',
      locale: 'es-MX',
    });
    // 25 * 3 * 0.95 = 71.25 -> 71 MXN
    assert.equal(resMxn.amount, 71);
    assert.equal(resMxn.savingsAmount, 4);

    const resArs = calculateDurationPrice({
      planPrices: { ARS: 2400 },
      meses: 3,
      descuentoPct: 5,
      targetCurrency: 'ARS',
      locale: 'es-AR',
    });
    // 2400 * 3 * 0.95 = 6840 ARS
    assert.equal(resArs.amount, 6840);
    assert.equal(resArs.savingsAmount, 360);

    // Caso 4: USD a céntimos (paso 0.01)
    const resUsdCent = calculateDurationPrice({
      planPrices: { USD: 3.55 },
      meses: 3,
      descuentoPct: 5,
      targetCurrency: 'USD',
      locale: 'es-419',
    });
    // 3.55 * 3 * 0.95 = 10.1175 -> 10.12 USD
    assert.equal(resUsdCent.amount, 10.12);
    assert.equal(resUsdCent.savingsAmount, 0.53);

    // Caso 5: el 0 explícito sigue sin descuento
    const resCeroDesc = calculateDurationPrice({
      planPrices: { PEN: 5 },
      meses: 3,
      targetCurrency: 'PEN',
      plan: { descuentos: { '3': 0 } },
      service: { descuentos: { '3': 10 } },
      defaultDiscounts: defaultDuraciones,
    });
    assert.equal(resCeroDesc.amount, 15);
    assert.equal(resCeroDesc.savingsAmount, 0);
    assert.equal(resCeroDesc.discountPct, 0);
    assert.equal(resCeroDesc.discountSource, 'plan');
  });

  test('18. Prueba de no-regresión de tarifas para todos los servicios, planes, monedas y duraciones', () => {
    const rootPath = process.cwd();
    const sDir = resolve(rootPath, 'src/editar/servicios');
    const sFiles = readdirSync(sDir).filter((f) => f.endsWith('.json') && f !== 'orden.json');

    const currencies = ['PEN', 'USD', 'MXN', 'ARS'];
    let evaluatedCombinations = 0;

    for (const f of sFiles) {
      const raw = JSON.parse(readFileSync(resolve(sDir, f), 'utf-8'));
      const parsedSvc = StreamingServiceSchema.parse(raw);

      for (const plan of parsedSvc.planes) {
        for (const dur of AJUSTES.duraciones) {
          for (const curr of currencies) {
            // Regla antigua: basada directamente en dur.descuento_pct
            const baseMonthly = resolvePlanPrice(plan.prices, curr);
            const m = dur.meses;
            const durKey = String(m);

            let oldAmount = 0;
            let oldExact = false;
            if (plan.precios_por_duracion && plan.precios_por_duracion[durKey]) {
              const dMap = plan.precios_por_duracion[durKey];
              if (typeof dMap[baseMonthly.currency] === 'number' && dMap[baseMonthly.currency] > 0) {
                oldAmount = dMap[baseMonthly.currency];
                oldExact = true;
              } else if (baseMonthly.currency !== 'USD' && typeof dMap.USD === 'number' && dMap.USD > 0) {
                oldAmount = dMap.USD;
                oldExact = true;
              }
            }

            if (!oldExact) {
              const resDesc = resolveDurationDiscount(m, plan, parsedSvc, AJUSTES.duraciones);
              const rawPrice = baseMonthly.amount * m * (1 - resDesc.pct / 100);
              oldAmount = baseMonthly.currency === 'USD' ? Math.round(rawPrice * 100) / 100 : Math.round(rawPrice);
            }

            let oldSavings = baseMonthly.amount * m - oldAmount;
            oldSavings = baseMonthly.currency === 'USD' ? Math.round(oldSavings * 100) / 100 : Math.round(oldSavings);
            if (oldSavings <= 0) oldSavings = 0;

            // Regla nueva con resolución multinivel
            const newRes = calculateDurationPrice({
              planPrices: plan.prices,
              meses: m,
              targetCurrency: curr,
              preciosPorDuracion: plan.precios_por_duracion,
              plan,
              service: parsedSvc,
              defaultDiscounts: AJUSTES.duraciones,
            });

            if (curr === 'PEN') {
              assert.ok(
                Math.abs(newRes.amount - oldAmount) <= 0.5,
                `Discrepancia en monto PEN: ${parsedSvc.id} > ${plan.nombre} (${m} meses, nuevo: ${newRes.amount}, anterior: ${oldAmount})`
              );
              assert.ok(
                Math.abs(newRes.savingsAmount - oldSavings) <= 0.5,
                `Discrepancia en ahorro PEN: ${parsedSvc.id} > ${plan.nombre} (${m} meses, nuevo: ${newRes.savingsAmount}, anterior: ${oldSavings})`
              );
            } else {
              assert.equal(
                newRes.amount,
                oldAmount,
                `Discrepancia en monto: ${parsedSvc.id} > ${plan.nombre} (${m} meses, ${curr})`
              );
              assert.equal(
                newRes.savingsAmount,
                oldSavings,
                `Discrepancia en ahorro: ${parsedSvc.id} > ${plan.nombre} (${m} meses, ${curr})`
              );
            }

            evaluatedCombinations++;
          }
        }
      }
    }

    assert.ok(evaluatedCombinations > 100, `Se esperaban >100 combinaciones, se evaluaron ${evaluatedCombinations}`);
  });

  test('19. Sistema de textos por país: override > plantilla > default, marcadores {pais}, {metodos_pago}, {moneda}, y casos borde', () => {
    const mockContext = {
      porPais: {
        saludo: {
          plantilla: 'Hola en {pais} con {moneda} y {metodos_pago}',
          overrides: {
            PE: 'Atención exclusiva en Perú',
            default: 'Atención internacional para tu país',
          },
        },
        solo_plantilla: {
          plantilla: 'Bienvenido a {pais} - Moneda: {moneda}',
        },
        con_marcador_desconocido: {
          plantilla: 'Texto con {inexistente} limpio',
        },
      },
      paises: mockCountries,
      pagos: mockPayments,
    };

    // 1. Prioridad: override > plantilla > default
    // PE tiene override
    const tPE = resolverTextoPais('saludo', 'PE', mockContext);
    assert.equal(tPE, 'Atención exclusiva en Perú');

    // MX no tiene override en 'saludo' -> usa plantilla base con {pais}='México' y moneda MXN
    const tMX = resolverTextoPais('saludo', 'MX', mockContext);
    assert.ok(tMX.includes('México'));
    assert.ok(tMX.includes('pesos mexicanos (MXN)') || tMX.includes('MXN'));
    assert.ok(tMX.includes('SPEI') || tMX.includes('Mercado Pago'));

    // default -> usa override 'default'
    const tDefault = resolverTextoPais('saludo', 'default', mockContext);
    assert.equal(tDefault, 'Atención internacional para tu país');

    // 2. Marcadores para PE, MX, AR y default en 'solo_plantilla'
    const sPE = resolverTextoPais('solo_plantilla', 'PE', mockContext);
    assert.ok(sPE.includes('Perú'));
    assert.ok(sPE.includes('soles'));

    const sMX = resolverTextoPais('solo_plantilla', 'MX', mockContext);
    assert.ok(sMX.includes('México'));
    assert.ok(sMX.includes('pesos mexicanos'));

    const sAR = resolverTextoPais('solo_plantilla', 'AR', mockContext);
    assert.ok(sAR.includes('Argentina'));
    assert.ok(sAR.includes('pesos argentinos'));

    const sDef = resolverTextoPais('solo_plantilla', 'default', mockContext);
    assert.ok(sDef.includes('tu país'));
    assert.ok(sDef.includes('dólares'));

    // 3. Clave inexistente
    const tVacio = resolverTextoPais('clave_no_existe', 'PE', mockContext);
    assert.equal(tVacio, '');

    // Contexto nulo o clave vacía
    assert.equal(resolverTextoPais('', 'PE', mockContext), '');
    // @ts-ignore
    assert.equal(resolverTextoPais('saludo', 'PE', null), '');

    // 4. Marcador sin dato / desconocido: se limpia sin llaves ni "undefined" ni dobles espacios
    const tLimpio = resolverTextoPais('con_marcador_desconocido', 'PE', mockContext);
    assert.equal(tLimpio, 'Texto con limpio');
    assert.ok(!tLimpio.includes('{'));
    assert.ok(!tLimpio.includes('undefined'));
  });

  test('20. Monograma e insignia de servicio: derivación de iniciales, contraste WCAG AA, color inválido y esquema', () => {
    // 1. Derivación de iniciales: explícitas > derivadas
    assert.equal(derivarIniciales('Netflix', 'N'), 'N');
    assert.equal(derivarIniciales('Disney+', 'D+'), 'D+');
    assert.equal(derivarIniciales('HBO Max', 'HBO'), 'HBO');

    // Sin iniciales explícitas: 2 palabras -> 1ra letra de cada una
    assert.equal(derivarIniciales('Prime Video'), 'PV');
    assert.equal(derivarIniciales('Apple TV+'), 'AT');

    // Sin iniciales explícitas: 1 sola palabra -> 2 primeras letras
    assert.equal(derivarIniciales('Netflix'), 'NE');
    assert.equal(derivarIniciales('Spotify'), 'SP');
    assert.equal(derivarIniciales(''), '?');

    // 2. Contraste automático texto claro / oscuro
    // Colores oscuros -> texto blanco (#FFFFFF)
    assert.equal(calcularColorTextoInsignia('#E50914'), '#FFFFFF'); // Netflix rojo
    assert.equal(calcularColorTextoInsignia('#113CCF'), '#FFFFFF'); // Disney+ azul oscuro
    assert.equal(calcularColorTextoInsignia('#000000'), '#FFFFFF'); // Negro puro
    assert.equal(calcularColorTextoInsignia('#4A4A4A'), '#FFFFFF'); // Gris oscuro

    // Colores claros -> texto oscuro (#09090B)
    assert.equal(calcularColorTextoInsignia('#1DB954'), '#09090B'); // Spotify verde claro
    assert.equal(calcularColorTextoInsignia('#FFFF00'), '#09090B'); // Amarillo puro
    assert.equal(calcularColorTextoInsignia('#FFFFFF'), '#09090B'); // Blanco puro

    // Respaldo neutro ante color inválido
    assert.equal(calcularColorTextoInsignia('invalido'), '#FFFFFF');
    assert.equal(calcularColorTextoInsignia(''), '#FFFFFF');

    // 3. Validación de esquema con iniciales y logo_propio
    const baseMockService = {
      id: 'test-svc',
      nombre: 'Test Service',
      slug: 'test-svc',
      categoria: 'video',
      eslogan: 'Eslogan de prueba',
      descripcion_corta: 'Desc corta',
      descripcion_larga: 'Desc larga',
      caracteristicas: ['Item 1'],
      color_acento: '#FF0000',
      disponible: true,
      faq: [{ pregunta: '¿P?', respuesta: 'R' }],
      planes: [
        {
          nombre: 'Plan 1',
          duracion: '1 mes',
          pantallas: '1 pantalla',
          prices: { PEN: 10, USD: 3 },
          nota: 'Nota',
        },
      ],
    };

    // Válido con iniciales y logo_propio
    const parseOk = StreamingServiceSchema.safeParse({
      ...baseMockService,
      iniciales: 'TS',
      logo_propio: '/logos/mi-logo.svg',
    });
    assert.ok(parseOk.success);

    // Inválido si iniciales superan 3 caracteres
    const parseFail = StreamingServiceSchema.safeParse({
      ...baseMockService,
      iniciales: 'TEST',
    });
    assert.equal(parseFail.success, false);
  });

  test('21. Valoraciones: cálculo de promedio, formato accesible y validación de voto', async () => {
    // a) Promedio de estrellas con un decimal
    assert.equal(calcularPromedio(0, 0), 0);
    assert.equal(calcularPromedio(24, 5), 4.8);
    assert.equal(calcularPromedio(10, 3), 3.3);

    // b) Formateo honesto y accesible
    assert.equal(formatearResumenValoraciones(1, 5.0), '★ 5,0 · 1 valoración de visitantes');
    assert.equal(formatearResumenValoraciones(23, 4.8), '★ 4,8 · 23 valoraciones de visitantes');

    // c) Validación de voto: { servicio, estrellas 1..5, nombre?, comentario?, hp? }
    const slugs = new Set(['netflix', 'disney-plus']);
    const v1 = validarVoto({ servicio: 'netflix', estrellas: 5 }, slugs);
    assert.equal(v1.valido, true);

    // Reseña opcional con nombre y comentario válidos
    const vResena = validarVoto(
      { servicio: 'netflix', estrellas: 5, nombre: ' Carlos ', comentario: ' Excelente entrega rápida <script> ' },
      slugs
    );
    assert.equal(vResena.valido, true);
    if (vResena.valido) {
      assert.equal(vResena.datos.nombre, 'Carlos');
      assert.equal(vResena.datos.comentario, 'Excelente entrega rápida script');
    }

    // Campo desconocido debe ser rechazado
    const vCampoDesconocido = validarVoto({ servicio: 'netflix', estrellas: 5, campo_extra: 'invalido' }, slugs);
    assert.equal(vCampoDesconocido.valido, false);

    // Honeypot bot activado
    const vBot = validarVoto({ servicio: 'netflix', estrellas: 5, hp: 'spam' }, slugs);
    assert.equal(vBot.valido, false);

    // Honeypot vacío permitido
    const vHpvacio = validarVoto({ servicio: 'netflix', estrellas: 5, hp: '' }, slugs);
    assert.equal(vHpvacio.valido, true);

    const vEstrellas0 = validarVoto({ servicio: 'netflix', estrellas: 0 }, slugs);
    assert.equal(vEstrellas0.valido, false);

    const vEstrellas6 = validarVoto({ servicio: 'netflix', estrellas: 6 }, slugs);
    assert.equal(vEstrellas6.valido, false);

    const vEstrellasFloat = validarVoto({ servicio: 'netflix', estrellas: 4.5 }, slugs);
    assert.equal(vEstrellasFloat.valido, false);

    const vSvcInvalido = validarVoto({ servicio: 'inexistente', estrellas: 5 }, slugs);
    assert.equal(vSvcInvalido.valido, false);

    // d) Huella anónima SHA-256 no expone la IP
    const h1 = await calcularHuella('192.168.1.1', 'netflix', '2026-11-02', 'test-salt');
    const h2 = await calcularHuella('192.168.1.1', 'netflix', '2026-11-02', 'test-salt');
    const hDiffSvc = await calcularHuella('192.168.1.1', 'disney-plus', '2026-11-02', 'test-salt');
    assert.equal(h1, h2);
    assert.notEqual(h1, hDiffSvc);
    assert.equal(h1.length, 64);
    assert.equal(h1.includes('192.168'), false);
  });

  test('22. SEO, JSON-LD sin precios y parámetro ?pais=PE|MX|AR con lista blanca', () => {
    // 1. Parámetro ?pais=PE|MX|AR en lista blanca; ignora utm_* y valores no permitidos
    assert.equal(resolverPaisDesdeQuery('?pais=PE'), 'PE');
    assert.equal(resolverPaisDesdeQuery('?pais=mx&utm_source=ig&utm_medium=social'), 'MX');
    assert.equal(resolverPaisDesdeQuery('pais=ar&ref=123'), 'AR');
    assert.equal(resolverPaisDesdeQuery('?pais=CL'), null);
    assert.equal(resolverPaisDesdeQuery('?pais=default'), null);
    assert.equal(resolverPaisDesdeQuery('?utm_source=google'), null);
    assert.equal(resolverPaisDesdeQuery(''), null);

    // 2. JSON-LD: parsear todos los bloques (Organization con sameAs, BreadcrumbList, FAQPage, Product) y verificar ausencia de precios
    const orgSchema = construirOrganizationSchema({
      brandName: 'TaiSTR',
      siteUrl: 'https://taistr.com',
      description: 'Catálogo de streaming',
      redesSociales: {
        instagram: 'https://www.instagram.com/taistr_2406x',
        tiktok: 'https://tiktok.com/@tai_str',
      },
    });
    const breadSchema = construirBreadcrumbSchema({
      siteUrl: 'https://taistr.com',
      servicioNombre: 'Netflix',
      servicioSlug: 'netflix',
    });
    const faqBlock = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [{ '@type': 'Question', name: '¿P?', acceptedAnswer: { '@type': 'Answer', text: 'R' } }],
    };
    const serialized = JSON.stringify([orgSchema, breadSchema, faqBlock]);
    const parsedBlocks = JSON.parse(serialized) as Record<string, unknown>[];
    assert.equal(parsedBlocks.length, 3);
    assert.equal(parsedBlocks[0]['@type'], 'Organization');
    assert.deepEqual(parsedBlocks[0].sameAs, [
      'https://www.instagram.com/taistr_2406x',
      'https://tiktok.com/@tai_str',
    ]);
    assert.equal(parsedBlocks[1]['@type'], 'BreadcrumbList');
    assert.equal(parsedBlocks[2]['@type'], 'FAQPage');
    assert.equal(/("offers"|"price"|"priceCurrency"|S\/\s*\d|\bPEN\b|\bUSD\b)/.test(serialized), false);

    // 3. Títulos <= 60 y descripciones <= 155 únicos para todos los servicios
    const serviciosDir = resolve(process.cwd(), 'src/editar/servicios');
    const files = readdirSync(serviciosDir).filter((f) => f.endsWith('.json') && f !== 'orden.json');
    const pagos = JSON.parse(readFileSync(resolve(process.cwd(), 'src/editar/pagos.json'), 'utf-8'));
    const garantia = JSON.parse(readFileSync(resolve(process.cwd(), 'src/editar/textos/garantia.json'), 'utf-8'));
    const seoJson = JSON.parse(readFileSync(resolve(process.cwd(), 'src/editar/seo.json'), 'utf-8'));

    const titles = new Set<string>();
    const descs = new Set<string>();
    for (const f of files) {
      const svc = JSON.parse(readFileSync(resolve(serviciosDir, f), 'utf-8'));
      const meta = construirSeoServicio({
        service: svc,
        marcaNombre: 'TaiSTR',
        paisNombre: 'Perú',
        pagos,
        garantiaTexto: garantia.garantia_corta,
        plantillaTitulo: seoJson.servicioPlantilla.plantillaTitulo,
        plantillaDescripcion: seoJson.servicioPlantilla.plantillaDescripcion,
      });
      assert.ok(meta.titulo.length <= 60, `Título de ${svc.slug} excede 60 chars (${meta.titulo.length}): ${meta.titulo}`);
      assert.ok(meta.descripcion.length <= 155, `Descripción de ${svc.slug} excede 155 chars (${meta.descripcion.length}): ${meta.descripcion}`);
      assert.ok(!titles.has(meta.titulo), `Título duplicado: ${meta.titulo}`);
      assert.ok(!descs.has(meta.descripcion), `Descripción duplicada: ${meta.descripcion}`);
      titles.add(meta.titulo);
      descs.add(meta.descripcion);
    }
  });

  test('23. Endurecimiento de seguridad: /api/geo (GET, HEAD, 405, cabeceras) y ausencia de archivos sensibles en dist/', async () => {
    // 1. /api/geo permite GET con país de 2 letras
    const reqGet = new Request('https://taistr.com/api/geo', {
      method: 'GET',
      headers: { 'CF-IPCountry': 'pe' },
    });
    const resGet = await geoOnRequest({ request: reqGet });
    assert.equal(resGet.status, 200);
    assert.equal(resGet.headers.get('Cache-Control'), 'no-store');
    assert.equal(resGet.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(resGet.headers.get('Set-Cookie'), null);
    const bodyGet = (await resGet.json()) as { country: string | null };
    assert.equal(bodyGet.country, 'PE');

    // 2. /api/geo permite HEAD sin cuerpo
    const reqHead = new Request('https://taistr.com/api/geo', {
      method: 'HEAD',
      headers: { 'CF-IPCountry': 'MX' },
    });
    const resHead = await geoOnRequest({ request: reqHead });
    assert.equal(resHead.status, 200);
    assert.equal(await resHead.text(), '');

    // 3. /api/geo rechaza POST/PUT/DELETE con 405 y cabecera Allow: GET, HEAD
    const reqPost = new Request('https://taistr.com/api/geo', { method: 'POST' });
    const resPost = await geoOnRequest({ request: reqPost });
    assert.equal(resPost.status, 405);
    assert.equal(resPost.headers.get('Allow'), 'GET, HEAD');

    // 4. País inválido o desconocido ("XX", "T1", "PER") devuelve null
    const reqInvalid = new Request('https://taistr.com/api/geo', {
      method: 'GET',
      headers: { 'CF-IPCountry': 'XX' },
    });
    const resInvalid = await geoOnRequest({ request: reqInvalid });
    assert.deepEqual(await resInvalid.json(), { country: null });

    // 5. Verificar que dist/ (si existe) no contiene .env, respaldos ni carpetas de datos crudos
    const distDir = resolve(process.cwd(), 'dist');
    if (existsSync(distDir)) {
      const walkDist = (d: string, list: string[] = []): string[] => {
        for (const entry of readdirSync(d, { withFileTypes: true })) {
          const full = join(d, entry.name);
          if (entry.isDirectory()) {
            assert.notEqual(entry.name.toLowerCase(), 'editar', 'dist/ no debe contener carpeta editar');
            assert.notEqual(entry.name.toLowerCase(), 'data', 'dist/ no debe contener carpeta data');
            walkDist(full, list);
          } else {
            list.push(entry.name);
          }
        }
        return list;
      };
      const distFiles = walkDist(distDir);
      for (const f of distFiles) {
        assert.equal(/^\.env/i.test(f), false, `Archivo sensible en dist/: ${f}`);
        assert.equal(/\.(bak|old|orig|tmp|swp|map)$/i.test(f), false, `Respaldo o sourcemap en dist/: ${f}`);
      }
    }
  });

  test('24. Backend de valoraciones (D1 simulada, validaciones, rate limit, seguridad y origen)', async () => {
    // Simulación en memoria de D1
    const filas: Array<{
      id: number;
      servicio: string;
      estrellas: number;
      huella: string;
      huella_ip: string;
      creada: number;
      nombre?: string | null;
      comentario?: string | null;
    }> = [];

    const mockDb = {
      prepare(sql: string) {
        return {
          _sql: sql,
          _params: [] as any[],
          bind(...params: any[]) {
            this._params = params;
            return this;
          },
          async first() {
            if (this._sql.includes('SELECT COUNT(*) as totalIp')) {
              const [huella_ip, creadaMin] = this._params;
              const count = filas.filter((f) => f.huella_ip === huella_ip && f.creada >= creadaMin).length;
              return { totalIp: count };
            }
            if (this._sql.includes('SELECT COUNT(*) as totalDia')) {
              const [servicio, huella, creadaMin] = this._params;
              const count = filas.filter(
                (f) => f.servicio === servicio && f.huella === huella && f.creada >= creadaMin
              ).length;
              return { totalDia: count };
            }
            if (this._sql.includes('SELECT COUNT(*) as n, AVG(estrellas) as prom')) {
              const [servicio] = this._params;
              const matches = filas.filter((f) => f.servicio === servicio);
              if (matches.length === 0) return { n: 0, prom: 0 };
              const suma = matches.reduce((acc, m) => acc + m.estrellas, 0);
              return { n: matches.length, prom: suma / matches.length };
            }
            return null;
          },
          async run() {
            if (this._sql.includes('INSERT INTO valoraciones')) {
              const [servicio, estrellas, huella, huella_ip, creada, nombre, comentario] = this._params;
              filas.push({
                id: filas.length + 1,
                servicio,
                estrellas,
                huella,
                huella_ip,
                creada,
                nombre: nombre || null,
                comentario: comentario || null,
              });
              return { success: true };
            }
            return { success: true };
          },
          async all() {
            if (this._sql.includes('GROUP BY servicio')) {
              const grupos = new Map<string, { suma: number; n: number }>();
              for (const f of filas) {
                const prev = grupos.get(f.servicio) || { suma: 0, n: 0 };
                grupos.set(f.servicio, { suma: prev.suma + f.estrellas, n: prev.n + 1 });
              }
              const results = Array.from(grupos.entries()).map(([servicio, data]) => ({
                servicio,
                n: data.n,
                prom: data.suma / data.n,
              }));
              return { results };
            }
            if (this._sql.includes('GROUP BY estrellas')) {
              const [servicio] = this._params;
              const matches = filas.filter((f) => f.servicio === servicio);
              const desglose: Record<number, number> = {};
              for (const m of matches) {
                desglose[m.estrellas] = (desglose[m.estrellas] || 0) + 1;
              }
              const results = Object.entries(desglose).map(([estrellas, conteo]) => ({
                estrellas: Number(estrellas),
                conteo,
              }));
              return { results };
            }
            if (this._sql.includes('FROM valoraciones WHERE servicio = ?')) {
              const [servicio] = this._params;
              const matches = filas.filter((f) => f.servicio === servicio);
              return { results: matches };
            }
            return { results: [] };
          },
        };
      },
    };

    const env = { DB: mockDb, SALT: 'test-salt-12345' };

    // a) Método no permitido en /api/valorar (solo POST)
    const resGet = await valorarOnRequest({
      request: new Request('https://taistr.com/api/valorar', { method: 'GET' }),
      env,
    });
    assert.equal(resGet.status, 405);
    assert.equal(resGet.headers.get('Allow'), 'POST');

    // b) Origen externo bloqueado
    const resOrigenExt = await valorarOnRequest({
      request: new Request('https://taistr.com/api/valorar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://sitio-malicioso.com',
        },
        body: JSON.stringify({ servicio: 'netflix', estrellas: 5 }),
      }),
      env,
    });
    assert.equal(resOrigenExt.status, 403);

    // c) Voto válido con mismo origen
    const resVoto1 = await valorarOnRequest({
      request: new Request('https://taistr.com/api/valorar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://taistr.com',
          'cf-connecting-ip': '200.10.20.30',
        },
        body: JSON.stringify({ servicio: 'netflix', estrellas: 5 }),
      }),
      env,
    });
    assert.equal(resVoto1.status, 200);
    const bodyVoto1 = await resVoto1.json();
    assert.equal(bodyVoto1.ok, true);
    assert.equal(bodyVoto1.n, 1);
    assert.equal(bodyVoto1.promedio, 5);

    // Comprobar que en la base de datos la IP NUNCA se guardó en claro
    assert.equal(filas.length, 1);
    assert.equal(filas[0].servicio, 'netflix');
    assert.equal(filas[0].estrellas, 5);
    assert.equal(filas[0].huella_ip.includes('200.10'), false);
    assert.equal(filas[0].huella.includes('200.10'), false);

    // d) Voto 2 y 3 para el mismo servicio
    await valorarOnRequest({
      request: new Request('https://taistr.com/api/valorar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://taistr.com', 'cf-connecting-ip': '200.10.20.30' },
        body: JSON.stringify({ servicio: 'netflix', estrellas: 4 }),
      }),
      env,
    });
    await valorarOnRequest({
      request: new Request('https://taistr.com/api/valorar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://taistr.com', 'cf-connecting-ip': '200.10.20.30' },
        body: JSON.stringify({ servicio: 'netflix', estrellas: 5 }),
      }),
      env,
    });
    assert.equal(filas.length, 3);

    // Cuarto voto hoy para el mismo servicio por la misma huella -> 409
    const resCuarto = await valorarOnRequest({
      request: new Request('https://taistr.com/api/valorar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://taistr.com', 'cf-connecting-ip': '200.10.20.30' },
        body: JSON.stringify({ servicio: 'netflix', estrellas: 5 }),
      }),
      env,
    });
    assert.equal(resCuarto.status, 409);
    const bodyCuarto = await resCuarto.json();
    assert.equal(bodyCuarto.ok, false);

    // e) Endpoint GET /api/valoraciones devuelve todos los servicios agregados
    const resList = await valoracionesOnRequest({
      request: new Request('https://taistr.com/api/valoraciones', { method: 'GET' }),
      env,
    });
    assert.equal(resList.status, 200);
    const dataList = await resList.json();
    assert.ok(dataList.netflix);
    assert.equal(dataList.netflix.n, 3);
    assert.equal(dataList.netflix.promedio, 4.7); // (5+4+5)/3 = 4.66 -> 4.7

    // e2) Endpoint GET /api/valoraciones?servicio=netflix devuelve desglose y reseñas
    const resDetalle = await valoracionesOnRequest({
      request: new Request('https://taistr.com/api/valoraciones?servicio=netflix', { method: 'GET' }),
      env,
    });
    assert.equal(resDetalle.status, 200);
    const dataDetalle = await resDetalle.json();
    assert.equal(dataDetalle.ok, true);
    assert.equal(dataDetalle.servicio, 'netflix');
    assert.equal(dataDetalle.n, 3);
    assert.equal(dataDetalle.promedio, 4.7);
    assert.ok(Array.isArray(dataDetalle.resenas));

    // f) Sin DB o SALT configurados -> 503 sin detalles
    const resSinEnv = await valorarOnRequest({
      request: new Request('https://taistr.com/api/valorar', { method: 'POST' }),
      env: {},
    });
    assert.equal(resSinEnv.status, 503);
  });

  test('25. Endpoint /api/codigos (seguridad, validación y respuesta de código)', async () => {
    // a) GET o HEAD no permitido -> 405
    const resGet = await codigosOnRequest({
      request: new Request('https://streaming.serviciostai.com/api/codigos', { method: 'GET' }),
    });
    assert.equal(resGet.status, 405);
    assert.equal(resGet.headers.get('Allow'), 'POST, OPTIONS');

    // b) OPTIONS preflight -> 204
    const resOptions = await codigosOnRequest({
      request: new Request('https://streaming.serviciostai.com/api/codigos', { method: 'OPTIONS' }),
    });
    assert.equal(resOptions.status, 204);

    // c) Body no JSON o inválido -> 400
    const resBadBody = await codigosOnRequest({
      request: new Request('https://streaming.serviciostai.com/api/codigos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'texto-no-json',
      }),
    });
    assert.equal(resBadBody.status, 400);

    // d) Email inválido -> 422
    const resBadEmail = await codigosOnRequest({
      request: new Request('https://streaming.serviciostai.com/api/codigos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'correo-sin-arroba' }),
      }),
    });
    assert.equal(resBadEmail.status, 422);

    // e) Email válido -> 200 con código de 4 dígitos, tiempo restante y soporte WhatsApp
    const resOk = await codigosOnRequest({
      request: new Request('https://streaming.serviciostai.com/api/codigos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'cliente@ejemplo.com' }),
      }),
    });
    assert.equal(resOk.status, 200);
    const data = await resOk.json();
    assert.equal(data.status, 'ok');
    assert.equal(data.email, 'cliente@ejemplo.com');
    assert.equal(typeof data.code, 'string');
    assert.equal(data.code.length, 4);
    assert.ok(/^\d{4}$/.test(data.code));
    assert.ok(data.expires_in_seconds > 0);
    assert.ok(data.soporte_whatsapp.telefono);
  });
});


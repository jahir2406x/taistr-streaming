import type { Country, PaymentMethod, ServicePlan } from './schemas.ts';
import { getPaymentMethodsForCountry, resolveCountry } from './pricing.ts';

export interface PanelSessionState {
  planKey: string;
  countryCode: string;
  availablePayments: PaymentMethod[];
  selectedPaymentId: string | null;
  selectedMonths: number;
}

/**
 * Inicia una sesión limpia del panel de compra para un plan específico.
 * Siempre arranca con `selectedPaymentId: null` para no recordar ni compartir selecciones entre planes,
 * y con la duración predeterminada (1 mes).
 */
export function openPlanSession(
  planKey: string,
  countryCode: string | null | undefined,
  allPayments: PaymentMethod[],
  allCountries: Country[],
  defaultMonths = 1
): PanelSessionState {
  const country = resolveCountry(countryCode, allCountries);
  const availablePayments = getPaymentMethodsForCountry(
    country.code,
    allPayments,
    allCountries
  );
  return {
    planKey,
    countryCode: country.code,
    availablePayments,
    selectedPaymentId: null,
    selectedMonths: defaultMonths > 0 ? defaultMonths : 1,
  };
}

/**
 * Selecciona una duración en meses dentro de la sesión activa del panel.
 */
export function selectPanelDuration(
  session: PanelSessionState,
  meses: number
): PanelSessionState {
  return {
    ...session,
    selectedMonths: meses > 0 ? meses : 1,
  };
}

/**
 * Selecciona un medio de pago dentro de la sesión abierta si pertenece a los medios disponibles del país.
 */
export function selectPanelPayment(
  session: PanelSessionState,
  paymentId: string | null | undefined
): PanelSessionState {
  if (!paymentId) {
    return { ...session, selectedPaymentId: null };
  }
  const exists = session.availablePayments.some((pm) => pm.id === paymentId);
  return {
    ...session,
    selectedPaymentId: exists ? paymentId : null,
  };
}

/**
 * Actualiza el país mientras el panel está abierto: conserva el medio elegido solo si sigue existiendo
 * en el nuevo país; de lo contrario, deselecciona (`null`). Mantiene intacta la duración elegida.
 */
export function updatePanelCountry(
  session: PanelSessionState,
  newCountryCode: string | null | undefined,
  allPayments: PaymentMethod[],
  allCountries: Country[]
): PanelSessionState {
  const country = resolveCountry(newCountryCode, allCountries);
  const availablePayments = getPaymentMethodsForCountry(
    country.code,
    allPayments,
    allCountries
  );
  const stillValid =
    session.selectedPaymentId !== null &&
    availablePayments.some((pm) => pm.id === session.selectedPaymentId);

  return {
    ...session,
    countryCode: country.code,
    availablePayments,
    selectedPaymentId: stillValid ? session.selectedPaymentId : null,
    selectedMonths: session.selectedMonths || 1,
  };
}

/**
 * Obtiene el objeto del medio de pago seleccionado actualmente o `null` si no se ha elegido ninguno.
 */
export function getSelectedPanelPayment(
  session: PanelSessionState
): PaymentMethod | null {
  if (!session.selectedPaymentId) return null;
  return (
    session.availablePayments.find((pm) => pm.id === session.selectedPaymentId) ||
    null
  );
}

/**
 * Resuelve la lista "Qué incluye" del panel: usa `plan.incluye` si tiene elementos,
 * o genera la lista a partir de `pantallas`, `duracion` y `nota_panel` / `nota`.
 */
export function resolvePlanIncludes(
  plan: Pick<ServicePlan, 'pantallas' | 'duracion' | 'nota' | 'incluye' | 'nota_panel'>,
  vigenciaPrefijo = 'Vigencia:'
): string[] {
  const custom = (plan.incluye || []).map((s) => s.trim()).filter(Boolean);
  if (custom.length > 0) {
    return custom;
  }
  const notaFinal = plan.nota_panel?.trim() ? plan.nota_panel.trim() : plan.nota.trim();
  return [
    plan.pantallas.trim(),
    `${vigenciaPrefijo} ${plan.duracion.trim()}`,
    notaFinal,
  ].filter(Boolean);
}

/**
 * Determina si tanto el servicio como el plan individual están disponibles para compra.
 */
export function isPlanAvailable(
  serviceDisponible: boolean,
  planDisponible?: boolean
): boolean {
  return Boolean(serviceDisponible && (planDisponible ?? true));
}

export interface BackdropClickInput {
  /** Target donde inició el pointerdown / mousedown */
  pointerDownTarget: unknown;
  /** Target donde ocurrió el evento click */
  clickTarget: unknown;
  /** Elemento contenedor del fondo / backdrop o dialog exterior */
  backdropElement: unknown;
  /** Elemento de la carta interna que no debe cerrar al recibir clics */
  cardElement: unknown;
  /** Número de clics (event.detail; 0 indica evento sintético por teclado o script) */
  detail?: number;
  /** Coordenadas opcionales del puntero */
  clientX?: number;
  clientY?: number;
}

/**
 * Determina de forma pura si corresponde cerrar el diálogo por clic en el fondo.
 * Reglas:
 * 1. Descarta clics sintéticos (detail === 0, o clientX === 0 y clientY === 0 cuando detail <= 0).
 * 2. Si pointerdown o click ocurrieron dentro de la carta (o sobre ella), NO cierra.
 * 3. Solo cierra si tanto pointerdown como click iniciaron y terminaron en el fondo (fuera de la carta).
 */
export function shouldCloseOnBackdropClick(input: BackdropClickInput): boolean {
  if (!input || !input.backdropElement || !input.cardElement) {
    return false;
  }

  // 1. Clic sintético: Enter, Espacio en labels/inputs, o disparado por script sin puntero
  if (input.detail === 0) {
    return false;
  }
  if (
    input.clientX === 0 &&
    input.clientY === 0 &&
    (input.detail === undefined || input.detail <= 0)
  ) {
    return false;
  }

  const isOrContains = (parent: unknown, target: unknown): boolean => {
    if (!parent || !target) return false;
    if (parent === target) return true;
    const p = parent as { contains?: (child: unknown) => boolean };
    return typeof p.contains === 'function' && p.contains(target);
  };

  // 2. Si el puntero bajó dentro de la carta, no cerrar (ej. arrastrar selección de texto hacia afuera)
  if (isOrContains(input.cardElement, input.pointerDownTarget)) {
    return false;
  }

  // 3. Si el clic terminó dentro de la carta, no cerrar
  if (isOrContains(input.cardElement, input.clickTarget)) {
    return false;
  }

  // 4. Tanto pointerdown como click deben pertenecer al fondo/backdrop
  const pointerOnBackdrop = isOrContains(input.backdropElement, input.pointerDownTarget);
  const clickOnBackdrop = isOrContains(input.backdropElement, input.clickTarget);

  return Boolean(pointerOnBackdrop && clickOnBackdrop);
}

/**
 * Adapta los elementos de "Qué incluye" a la duración seleccionada, resolviendo
 * marcadores `{duracion}` y `{meses}`, y actualizando la línea de vigencia.
 */
export function resolveDurationIncludes(
  includes: readonly string[],
  duracionLabel: string,
  meses: number,
  vigenciaPrefijo = 'Vigencia:'
): string[] {
  const normPrefijo = vigenciaPrefijo.trim();
  return includes.map((item) => {
    let res = item
      .replace(/\{duracion\}/g, duracionLabel)
      .replace(/\{meses\}/g, String(meses));
    if (res.startsWith(normPrefijo)) {
      res = `${normPrefijo} ${duracionLabel}`;
    }
    return res;
  });
}

/**
 * Resuelve la plantilla de garantía para una duración dada.
 */
export function resolveDurationGarantia(
  plantilla: string,
  duracionLabel: string,
  meses: number
): string {
  return plantilla
    .replace(/\{duracion\}/g, duracionLabel)
    .replace(/\{meses\}/g, String(meses));
}

/**
 * Comprueba si dos preguntas son semánticamente equivalentes para evitar duplicados en FAQ.
 */
export function isQuestionSimilar(q1: string, q2: string): boolean {
  const norm1 = q1.toLowerCase().replace(/[^a-záéíóúñ0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  const norm2 = q2.toLowerCase().replace(/[^a-záéíóúñ0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  if (norm1 === norm2) return true;

  const isRenov1 = /\brenov/i.test(q1);
  const isRenov2 = /\brenov/i.test(q2);
  if (isRenov1 && isRenov2) return true;

  const isGarant1 = /\bgarant/i.test(q1);
  const isGarant2 = /\bgarant/i.test(q2);
  if (isGarant1 && isGarant2) return true;

  return false;
}

/**
 * Une el FAQ propio de un servicio con las preguntas comunes de garantía y renovación,
 * asegurando que no se dupliquen preguntas ya cubiertas por el servicio.
 */
export function mergeServiceFaq(
  serviceFaq: readonly { pregunta: string; respuesta: string }[],
  commonFaq: readonly { question: string; answer: string }[]
): { pregunta: string; respuesta: string }[] {
  const result = [...serviceFaq];
  for (const common of commonFaq) {
    const alreadyExists = serviceFaq.some((item) =>
      isQuestionSimilar(item.pregunta, common.question)
    );
    if (!alreadyExists) {
      result.push({
        pregunta: common.question,
        respuesta: common.answer,
      });
    }
  }
  return result;
}



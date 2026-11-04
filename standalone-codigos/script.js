(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* -------- Toast Flotante de Alto Contraste -------- */
  let toastTimer = null;
  function toast(message, emoji = '✨') {
    const el = $('[data-toast]');
    if (!el) return;
    el.innerHTML = `<span>${emoji}</span><span>${message}</span>`;
    el.classList.add('is-visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
  }

  /* -------- Consulta al Backend Puente en Tiempo Real -------- */
  async function consultarCodigo(email) {
    const res = await fetch('api/consulta.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (res.status === 429) {
      return { status: 'rate', message: 'Demasiadas solicitudes. Espera un momento antes de volver a intentar.' };
    }
    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }
    return await res.json();
  }

  const COPY_SVG =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>';

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));

  function msgBlock(emoji, title, text) {
    return `
      <div class="result__msg">
        <span class="result__msg-icon">${emoji}</span>
        <div>
          <p class="result__msg-title">${escapeHtml(title)}</p>
          <p class="result__msg-text">${escapeHtml(text)}</p>
        </div>
      </div>`;
  }

  /* -------- Renderizar resultado 100% Marca Blanca -------- */
  function renderResult(box, data) {
    box.classList.remove('result--ok', 'result--warn', 'result--error');

    if (data.status === 'ok' && (data.link || data.code)) {
      box.classList.add('result--ok');
      const link = data.link || data.enlace_directo || '';
      const safeLink = escapeHtml(link);
      const code = data.code ? String(data.code) : '';

      let inner = `
        <div class="result__head">
          <span class="result__badge">${code ? 'Código temporal listo' : 'Enlace de acceso listo'}</span>
          <button class="result__copy" type="button" data-copy title="Copiar">${COPY_SVG}</button>
        </div>`;

      if (code) {
        inner += `
          <div class="result__code-box">
            <span style="font-size:0.7rem;text-transform:uppercase;color:var(--text-dim);display:block;margin-bottom:4px;letter-spacing:0.05em">Código de acceso</span>
            <div class="result__code">${escapeHtml(code)}</div>
          </div>`;
      }

      if (link) {
        inner += `
          <a class="result__link" href="${safeLink}" target="_blank" rel="noopener noreferrer">${safeLink}</a>
          <div class="result__actions">
            <a class="btn btn--accent btn--sm" href="${safeLink}" target="_blank" rel="noopener noreferrer" style="flex:1">Abrir enlace ↗</a>
            <button class="btn btn--ghost btn--sm" type="button" data-copy>Copiar enlace</button>
          </div>`;
      } else if (code) {
        inner += `
          <div class="result__actions">
            <button class="btn btn--accent btn--sm" type="button" data-copy style="width:100%">Copiar código</button>
          </div>`;
      }

      inner += `<p class="result__meta">Ábrelo en el dispositivo donde quieres ver Netflix.</p>`;
      box.innerHTML = inner;

      const copyTarget = code || link;
      box.querySelectorAll('[data-copy]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(copyTarget);
            toast('Copiado al portapapeles', '📋');
          } catch {
            toast('No se pudo copiar', '⚠️');
          }
        });
      });

      toast('¡Acceso obtenido!', '🎉');
    } else if (data.status === 'not_found') {
      box.classList.add('result--warn');
      const msg = data.message || 'No se encontró el código solicitado';
      box.innerHTML = msgBlock('🔍', 'Sin resultados', msg);
      toast(msg, '🔍');
    } else if (data.status === 'not_owned') {
      box.classList.add('result--error');
      box.innerHTML = msgBlock('⚠️', 'Problema con el correo', 'Hubo un problema con ese correo. Por favor, contacta a tu proveedor.');
      toast('Problema con el correo', '⚠️');
    } else if (data.status === 'home_update') {
      box.classList.add('result--warn');
      box.innerHTML = msgBlock('🏠', 'Acción no permitida', 'Parece que están intentando establecer tu Hogar de Netflix. Contacta a tu proveedor.');
      toast('Acción no permitida', '🏠');
    } else if (data.status === 'rate') {
      box.classList.add('result--warn');
      const rateMsg = data.message || 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.';
      box.innerHTML = msgBlock('⏳', 'Demasiadas solicitudes', rateMsg);
      toast('Demasiadas solicitudes', '⏳');
    } else {
      box.classList.add('result--error');
      const errorMsg = data.message || 'Error de conexión con el servidor. Intenta de nuevo en unos instantes o contacta a tu proveedor.';
      box.innerHTML = msgBlock('🛠️', 'Algo salió mal', errorMsg);
      toast('Error de servidor', '⚠️');
    }

    box.removeAttribute('hidden');
    box.hidden = false;
  }

  /* -------- Manejo de Formularios -------- */
  function wireQueryForm(form) {
    const field = $('.field', form);
    const input = $('.field__input', form);
    const errorEl = $('[data-field-error]', form);
    const submitBtn = $('[data-submit]', form);
    const resultBox = form.parentElement.querySelector('[data-result]');
    const pasteBtn = $('[data-paste]', form);

    input.addEventListener('input', () => field.classList.remove('has-error'));

    pasteBtn.addEventListener('click', async () => {
      try {
        const text = (await navigator.clipboard.readText()).trim();
        if (text && input) {
          input.value = text;
          field.classList.remove('has-error');
          toast('Pegado', '📋');
        }
        input.focus();
      } catch {
        input.focus();
        toast('Escribe tu correo directamente', '✍️');
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = input.value.trim();

      if (!EMAIL_RE.test(email)) {
        field.classList.add('has-error');
        if (errorEl) errorEl.textContent = 'Introduce un correo válido.';
        input.focus();
        return;
      }

      submitBtn.classList.add('is-loading');
      submitBtn.disabled = true;
      if (resultBox) resultBox.hidden = true;

      let data;
      try {
        data = await consultarCodigo(email);
      } catch {
        data = { status: 'error', message: 'No se pudo conectar con el servidor. Por favor intenta de nuevo.' };
      } finally {
        submitBtn.classList.remove('is-loading');
        submitBtn.disabled = false;
      }

      if (resultBox) renderResult(resultBox, data);
    });
  }

  $$('[data-query-form]').forEach(wireQueryForm);

  /* -------- Selector de Modo (easy / tutorial) -------- */
  const modeButtons = $$('.mode-switch__btn');
  const thumb = $('.mode-switch__thumb');
  const views = $$('.view');

  function positionThumb(activeBtn) {
    if (!thumb || !activeBtn) return;
    thumb.style.width = `${activeBtn.offsetWidth}px`;
    thumb.style.transform = `translateX(${activeBtn.offsetLeft - 4}px)`;
  }

  function setMode(mode) {
    modeButtons.forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
      if (active) positionThumb(btn);
    });
    views.forEach((v) => v.classList.toggle('is-active', v.dataset.view === mode));
    if (mode === 'tutorial') resetWizard();
  }

  modeButtons.forEach((btn) => btn.addEventListener('click', () => setMode(btn.dataset.mode || 'easy')));

  window.addEventListener('load', () => {
    const active = $('.mode-switch__btn.is-active');
    if (active) positionThumb(active);
  });
  window.addEventListener('resize', () => {
    const active = $('.mode-switch__btn.is-active');
    if (active) positionThumb(active);
  });

  /* -------- Wizard / Tutorial State Machine -------- */
  const TOTAL_STEPS = 4;
  const wizard = {
    current: 1,
    choice: null,
  };

  const stepEls = $$('.step');
  const progressBar = $('[data-progress]');
  const backBtn = $('[data-back]');

  function updateStepper() {
    if (progressBar) {
      progressBar.style.width = `${(wizard.current / TOTAL_STEPS) * 100}%`;
    }
    $$('.stepper__dot').forEach((dot) => {
      const n = Number(dot.dataset.dot);
      dot.classList.toggle('is-active', n === wizard.current);
      dot.classList.toggle('is-done', n < wizard.current);
    });
    if (backBtn) {
      backBtn.hidden = wizard.current === 1;
    }
  }

  function goToStep(n) {
    if (n < 1 || n > TOTAL_STEPS) return;
    const nextEl = stepEls.find((s) => Number(s.dataset.step) === n);
    if (!nextEl) return;

    wizard.current = n;
    updateStepper();

    stepEls.forEach((s) => s.classList.remove('is-active'));
    nextEl.classList.add('is-active');

    if (n === 2) renderStep2();
    if (n === 3) renderStep3();
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => goToStep(wizard.current - 1));
  }

  function resetWizard() {
    wizard.current = 1;
    wizard.choice = null;
    stepEls.forEach((s) => s.classList.remove('is-active'));
    const s1 = $('[data-step="1"]');
    if (s1) s1.classList.add('is-active');
    $$('.choice').forEach((c) => c.classList.remove('is-selected'));
    updateStepper();
  }

  // Paso 1: Elección móvil / tv
  $$('.choice').forEach((choice) => {
    choice.addEventListener('click', () => {
      const choiceType = choice.dataset.choice;
      wizard.choice = choiceType;
      $$('.choice').forEach((c) => c.classList.toggle('is-selected', c === choice));
      toast(choiceType === 'movil' ? 'Dispositivo móvil' : 'Televisor', '👍');
      setTimeout(() => {
        if (wizard.current === 1 && wizard.choice) {
          goToStep(2);
        }
      }, 650);
    });
  });

  const IMAGES = {
    paso2Movil: 'assets/paso2-movil.png',
    paso2Tv: 'assets/paso2-tv.png',
    paso3: 'assets/paso3-comun.svg',
  };

  function hablar(texto, btn) {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(texto);
      utter.lang = 'es-ES';
      utter.rate = 0.95;
      if (btn) {
        btn.innerHTML = '🔊 Reproduciendo...';
        btn.classList.add('is-playing');
        utter.onend = () => {
          btn.innerHTML = '🔊 Escuchar de nuevo';
          btn.classList.remove('is-playing');
        };
        utter.onerror = () => {
          btn.innerHTML = '🔇 Voz finalizada';
          btn.classList.remove('is-playing');
        };
      }
      window.speechSynthesis.speak(utter);
    } catch (_) {}
  }

  function buildIllus(box, opts) {
    const { caption, imgSrc, pointerStyle, ringStyle, voiceText } = opts;
    const pointer = `<span class="pointer" style="${pointerStyle}" aria-hidden="true">👆</span>`;
    const captionHtml = `<span class="illus__caption">${caption}</span>`;
    const voiceHtml = `<button type="button" class="illus__voice-btn" data-voice-btn title="Escuchar instrucción por voz">🔇 Pulsa 1 vez si quieres escuchar la voz</button>`;
    const ring = `<span class="hl-ring" style="${ringStyle}"><span class="hl-ring__core"></span></span>`;

    box.innerHTML = captionHtml + voiceHtml + '<span class="illus__stage"></span>';
    const stage = box.querySelector('.illus__stage');
    const voiceBtn = box.querySelector('[data-voice-btn]');
    if (!stage) return;

    const img = document.createElement('img');
    img.className = 'illus__frame illus__img';
    img.src = imgSrc;
    img.alt = caption;
    stage.appendChild(img);
    stage.insertAdjacentHTML('beforeend', ring + pointer);

    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => hablar(voiceText, voiceBtn));
    }
  }

  function renderStep2() {
    const box = $('[data-illus-2]');
    const title = $('[data-step2-title]');
    if (!box || !title) return;

    const isMovil = wizard.choice === 'movil';
    title.textContent = isMovil ? 'Abre los ajustes de tu móvil' : 'Abre el menú de tu televisor';

    buildIllus(box, {
      caption: isMovil ? '📱 Pulsa «Ver temporalmente»' : '📺 Pulsa «Esta es mi Cuenta»',
      imgSrc: isMovil ? IMAGES.paso2Movil : IMAGES.paso2Tv,
      pointerStyle: isMovil ? 'top: 75%; left: 50%;' : 'top: 89%; left: 50.5%;',
      ringStyle: isMovil
        ? 'top: 68%; left: 50%; width: 84%; height: 7%;'
        : 'top: 77.5%; left: 50.5%; width: 31%; height: 15%;',
      voiceText: isMovil
        ? 'En tu celular o tableta, pulsa sobre la opción Ver temporalmente.'
        : 'En la pantalla de tu televisor, pulsa sobre la opción Esta es mi Cuenta o Estoy de viaje.',
    });
  }

  function renderStep3() {
    const box = $('[data-illus-3]');
    if (!box) return;

    buildIllus(box, {
      caption: '✉️ Pulsa «Enviar email»',
      imgSrc: IMAGES.paso3,
      pointerStyle: 'top: 88%; left: 50%;',
      ringStyle: 'top: 78%; left: 50%; width: 50%; height: 26%;',
      voiceText: 'Ahora pulsa en Enviar email para recibir el código de verificación.',
    });
  }

  $$('[data-confirm-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = Number(btn.dataset.confirmStep);
      if (step === 2) {
        toast('¡Ya falta poco!', '⏳');
        setTimeout(() => goToStep(3), 600);
      } else if (step === 3) {
        toast('¡Estamos a un paso!', '🚀');
        setTimeout(() => goToStep(4), 600);
      }
    });
  });

  updateStepper();
})();

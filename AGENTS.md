# Guía del Proyecto: WEB_STREAMING

Este proyecto es una plataforma/landing page de ventas de servicios de streaming con derivación directa y segura a WhatsApp.

## Habilidades Activas (Installed Skills)
1. **`frontend-design` & `design-taste-frontend`**:
   - Evitar patrones clónicos de IA (fondos genéricos con degradados violeta/neón cliché, tarjetas idénticas con sombras genéricas).
   - Tipografía intencional y jerarquía limpia adaptada a entretenimiento/streaming.
   - Micro-interacciones interactivas para selección de planes y plataformas.

2. **`copywriting` & `cro`**:
   - Mensajes enfocados en claridad, beneficios inmediatos, garantías de servicio y entrega inmediata.
   - Textos de llamada a la acción (CTAs) específicos que generen mensajes contextualizados en WhatsApp (ej. saber qué plan y servicio solicitó el cliente exactamente).

3. **`security-and-hardening` & `turnstile-spin`**:
   - **Ofuscación anti-scraping**: El número de WhatsApp nunca se expone en texto plano en el HTML. Se ensambla en el cliente tras interacción del usuario.
   - **Honeypot / Cloudflare Turnstile**: Verificación anti-bot para evitar spam masivo hacia la línea de WhatsApp.
   - **Sanitización de parámetros**: Validación de cualquier entrada antes de construir la URL `wa.me`.

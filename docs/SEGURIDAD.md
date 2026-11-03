# Guía de Seguridad para el Dueño (`TaiSTR`)

Esta guía resume las medidas de seguridad que **solo el dueño** puede configurar en sus cuentas externas. Ningún sistema informático tiene seguridad absoluta, pero combinar la protección técnica del sitio con estos hábitos reduce drásticamente el riesgo.

## 1. Cuentas, contraseñas y verificación en dos pasos (2FA)
- **Activa la verificación en dos pasos (2FA)** con app autenticadora (Authy, Google Authenticator o 1Password) en: **Cloudflare**, **GitHub**, tu **correo electrónico** (`taicorp2406x@gmail.com`) y tu proveedor de dominio/hosting. Evita el 2FA por SMS cuando sea posible.
- **Usa contraseñas únicas y largas** (mínimo 16 caracteres) para cada servicio apoyándote en un **gestor de contraseñas** (Bitwarden o 1Password).
- **Protección de rama en GitHub**: En *Settings → Branches*, protege la rama `main` para impedir borrados accidentales (`Force push`) y exigir que las verificaciones pasen antes de publicar.

## 2. Configuración recomendada en el panel de Cloudflare
- **SSL/TLS → Edge Certificates**:
  - Activa **Always Use HTTPS** y **Automatic HTTPS Rewrites**.
  - Activa **HSTS** con `Max-Age: 12 months (31536000)` e `Include subdomains`. *(Nota: la opción `Preload` es irreversible a nivel de dominio; actívala solo cuando estés seguro de que todos tus subdominios usarán siempre HTTPS).*
- **DNS → Settings**: Activa **DNSSEC** para impedir que terceros redirijan tu dominio a un servidor falso.
- **Security → Bots**: Activa **Bot Fight Mode** para frenar rastreadores maliciosos automatizados.
- **Security → WAF → Rate limiting rules**: Crea una regla para la ruta `/api/geo` (por ejemplo, máximo 30 peticiones por minuto por IP con acción *Block* durante 1 minuto) para evitar abuso de consultas.

## 3. Qué hacer si se filtra una clave o token
1. **Revoca de inmediato** el token o sesión desde el panel correspondiente (Cloudflare API Tokens, GitHub Personal Access Tokens o sesiones de WhatsApp Web).
2. **Cambia la contraseña** de la cuenta afectada y revisa el historial de accesos recientes (*Audit Log*).
3. Ejecuta `npm run verificar` localmente y vuelve a desplegar la web limpia.

## 4. Mantenimiento mensual y prevención de suplantación
- **Revisión mensual**: Ejecuta `npm run verificar` al menos una vez al mes para comprobar enlaces, presupuesto de peso, cabeceras de seguridad, vigencia de `security.txt` y datos de edición.
- **Dependencias de compilación**: `npm audit --omit=dev` puede reportar avisos en herramientas de build (Astro/Sharp); al compilarse a HTML estático (`output: 'static'`), no hay servidor Node expuesto en producción. Actualiza versiones mayores solo de forma planificada.
- **Ante suplantación de identidad o números falsos**:
  1. Reporta de inmediato el número o perfil imitador dentro de WhatsApp, Instagram o TikTok.
  2. Publica una historia en tus redes oficiales recordando que el **único número de WhatsApp** es el que figura en el bloque *Canales oficiales* de tu web (`taistr.com`).
  3. Recuerda a tus clientes que **TaiSTR jamás pide contraseñas personales ni claves bancarias**.


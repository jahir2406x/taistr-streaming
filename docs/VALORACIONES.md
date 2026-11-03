# Guía de Valoraciones con Cloudflare D1 (Sin saber programar)

Tu web permite que los visitantes califiquen cada servicio con 1 a 5 estrellas directamente desde la página, sin formularios ni recargas.

---

### 1. Crear la base de datos D1 en Cloudflare

1. Entra a tu panel de **Cloudflare** -> menú lateral **Storage & Databases** -> **D1 SQL Database**.
2. Haz clic en **Create Database**, ponle de nombre `taistr-db` y selecciona tu región (ej. South America o Western North America).
3. Entra a tu nueva base `taistr-db`, haz clic en la pestaña **Console**, pega el contenido de `functions/schema.sql` y pulsa **Execute**.

---

### 2. Conectar la base de datos a tu proyecto de Pages

1. En Cloudflare, ve a **Workers & Pages** -> selecciona tu proyecto de **TaiSTR**.
2. Ve a **Settings** -> **Functions** -> busca la sección **D1 Database Bindings**.
3. Haz clic en **Add binding**:
   - **Variable name**: Escribe exactamente `DB` (en mayúsculas).
   - **D1 Database**: Selecciona `taistr-db`.
   - Aplícalo tanto en **Production** como en **Preview**.
4. En **Settings** -> **Environment Variables**, añade:
   - Variable name: `SALT`
   - Value: Una cadena aleatoria larga secreta (por ejemplo `t41str_s3cr3t_s4lt_9921_xK9`).

---

### 3. Consultas SQL útiles (en la Consola de D1)

- **Ver total y promedio por servicio:**
  ```sql
  SELECT servicio, COUNT(*) as votos, ROUND(AVG(estrellas), 1) as promedio FROM valoraciones GROUP BY servicio;
  ```
- **Borrar votos sospechosos de un servicio:**
  ```sql
  DELETE FROM valoraciones WHERE servicio = 'netflix' AND creada >= 1730000000000;
  ```
- **Vaciar toda la tabla:**
  ```sql
  DELETE FROM valoraciones;
  ```

---

### 4. Protección y Rate Limiting

- La API rechaza peticiones externas, limita a 3 votos diarios por servicio y máx 12 votos por IP/hora.
- Si gustas más protección en Cloudflare: **Security** -> **WAF** -> **Rate limiting rules** -> URI Path `/api/valorar` -> 10 requests / 10s -> Block.
- **¿Qué ocurre si no configuras D1?**: No hay errores en la web ni en la consola; el widget y los chips simplemente se ocultan de forma limpia.


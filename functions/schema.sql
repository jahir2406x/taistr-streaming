-- Tabla para almacenar valoraciones de 1 a 5 estrellas directamente en la web
-- Prohibido texto libre, nombres, correos o teléfonos.
-- La IP NUNCA se guarda en claro (solo huellas hash SHA-256 anónimas y temporales).

CREATE TABLE IF NOT EXISTS valoraciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  servicio TEXT NOT NULL,
  estrellas INTEGER NOT NULL CHECK(estrellas BETWEEN 1 AND 5),
  huella TEXT NOT NULL,
  huella_ip TEXT NOT NULL,
  creada INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_val_servicio_huella ON valoraciones (servicio, huella, creada);
CREATE INDEX IF NOT EXISTS idx_val_huella_ip ON valoraciones (huella_ip, creada);


#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const CPANEL_HOST = process.env.CPANEL_HOST || 'dcma.gservidor.com';
const CPANEL_PORT = process.env.CPANEL_PORT || '2083';
const CPANEL_USER = process.env.CPANEL_USER || 'servici9';
const CPANEL_TOKEN = process.env.CPANEL_TOKEN || '4DAEPR6K0RX4JR2IWP80IWQ7GNXQGWV8';
const TARGET_DIR = process.env.CPANEL_TARGET_DIR || '/home/servici9/public_html/streaming';
const REMOTE_UPLOAD_DIR = process.env.CPANEL_UPLOAD_DIR || 'public_html/streaming';
const LIVE_URL = process.env.CPANEL_LIVE_URL || 'https://streaming.serviciostai.com';

const authHeader = `cpanel ${CPANEL_USER}:${CPANEL_TOKEN}`;
const baseUrl = `https://${CPANEL_HOST}:${CPANEL_PORT}`;

async function main() {
  console.log('🚀 Iniciando despliegue automatizado a cPanel...');
  console.log(`📡 Host: ${CPANEL_HOST} | Usuario: ${CPANEL_USER} | Destino: ${TARGET_DIR}`);

  // 1. Verificar o generar compilación
  if (!fs.existsSync('dist/index.html')) {
    console.log('📦 Compilando proyecto con npm run build...');
    execSync('npm run build', { stdio: 'inherit' });
  }

  // 2. Comprimir dist en deploy.zip
  console.log('🗜️  Empaquetando dist en deploy.zip...');
  const zipPath = path.resolve('deploy.zip');
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  // Usa PowerShell Compress-Archive en Windows
  try {
    execSync('powershell -Command "Compress-Archive -Path dist\\* -DestinationPath deploy.zip -Force"', { stdio: 'ignore' });
  } catch {
    execSync('tar -a -c -f deploy.zip -C dist .', { stdio: 'ignore' });
  }

  if (!fs.existsSync(zipPath)) {
    throw new Error('No se pudo generar el archivo deploy.zip');
  }

  const zipSize = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2);
  console.log(`📦 Paquete generado (${zipSize} MB). Subiendo a cPanel...`);

  // 3. Subir deploy.zip a la carpeta del subdominio
  const fileBuffer = fs.readFileSync(zipPath);
  const fd = new FormData();
  fd.append('dir', REMOTE_UPLOAD_DIR);
  fd.append('overwrite', '1');
  fd.append('file-1', new Blob([fileBuffer]), 'deploy.zip');

  const uploadRes = await fetch(`${baseUrl}/execute/Fileman/upload_files`, {
    method: 'POST',
    headers: { Authorization: authHeader },
    body: fd
  });

  const uploadJson = await uploadRes.json();
  if (uploadJson.status !== 1) {
    throw new Error('Fallo al subir a cPanel: ' + JSON.stringify(uploadJson));
  }
  console.log('✅ Archivo deploy.zip subido exitosamente.');

  // 4. Extraer en la carpeta del subdominio
  console.log(`📂 Extrayendo archivos en ${TARGET_DIR}...`);
  const extractUrl = `${baseUrl}/json-api/cpanel?cpanel_jsonapi_module=Fileman&cpanel_jsonapi_func=fileop&cpanel_jsonapi_version=2&op=extract&sourcefiles=${REMOTE_UPLOAD_DIR}/deploy.zip&destfiles=${encodeURIComponent(TARGET_DIR)}&doubledecode=1`;
  const extractRes = await fetch(extractUrl, {
    headers: { Authorization: authHeader }
  });
  const extractJson = await extractRes.json();
  console.log('✅ Extracción completada en el servidor.');

  // 5. Limpieza en el servidor y local
  console.log('🧹 Limpiando archivos temporales...');
  await fetch(`${baseUrl}/json-api/cpanel?cpanel_jsonapi_module=Fileman&cpanel_jsonapi_func=fileop&cpanel_jsonapi_version=2&op=unlink&sourcefiles=${REMOTE_UPLOAD_DIR}/deploy.zip&doubledecode=1`, {
    headers: { Authorization: authHeader }
  }).catch(() => {});

  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  // 6. Verificación en vivo
  console.log(`🌐 Comprobando salud en vivo en ${LIVE_URL}...`);
  try {
    const checkRes = await fetch(LIVE_URL);
    if (checkRes.status === 200) {
      console.log(`🎉 ¡DESPLIEGUE EXITOSO! Tu web está en vivo en: ${LIVE_URL} (HTTP 200)`);
    } else {
      console.log(`⚠️ Sitio responde con código HTTP ${checkRes.status}`);
    }
  } catch (err) {
    console.log(`⚠️ Advertencia de conexión: ${err.message}`);
  }
}

main().catch((err) => {
  console.error('❌ Error en el despliegue:', err.message);
  process.exit(1);
});


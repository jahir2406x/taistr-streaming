#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const CPANEL_HOST = process.env.CPANEL_HOST || 'dcma.gservidor.com';
const CPANEL_PORT = process.env.CPANEL_PORT || '2083';
const CPANEL_USER = process.env.CPANEL_USER || 'servici9';
const CPANEL_TOKEN = process.env.CPANEL_TOKEN || '4DAEPR6K0RX4JR2IWP80IWQ7GNXQGWV8';
const TARGET_DIR = process.env.CPANEL_TARGET_DIR || '/home/servici9/public_html/cdg.serviciostai.com';
const REMOTE_UPLOAD_DIR = process.env.CPANEL_UPLOAD_DIR || 'public_html/cdg.serviciostai.com';
const LIVE_URL = process.env.CPANEL_LIVE_URL || 'http://cdg.serviciostai.com';

const authHeader = `cpanel ${CPANEL_USER}:${CPANEL_TOKEN}`;
const baseUrl = `https://${CPANEL_HOST}:${CPANEL_PORT}`;

async function main() {
  console.log('🚀 Iniciando despliegue de Códigos Ya (Marca Blanca) a cdg.serviciostai.com...');
  console.log(`📡 Host: ${CPANEL_HOST} | Usuario: ${CPANEL_USER} | Destino: ${TARGET_DIR}`);

  const sourceDir = path.resolve('standalone-codigos');
  if (!fs.existsSync(path.join(sourceDir, 'index.html'))) {
    throw new Error('No se encontró standalone-codigos/index.html');
  }

  // 1. Comprimir standalone-codigos en deploy-cdg.zip
  console.log('🗜️  Empaquetando standalone-codigos en deploy-cdg.zip...');
  const zipPath = path.resolve('deploy-cdg.zip');
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  try {
    execSync('powershell -Command "Compress-Archive -Path standalone-codigos\\* -DestinationPath deploy-cdg.zip -Force"', { stdio: 'ignore' });
  } catch {
    execSync('tar -a -c -f deploy-cdg.zip -C standalone-codigos .', { stdio: 'ignore' });
  }

  if (!fs.existsSync(zipPath)) {
    throw new Error('No se pudo generar el archivo deploy-cdg.zip');
  }

  const zipSize = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2);
  console.log(`📦 Paquete generado (${zipSize} MB). Subiendo a cPanel...`);

  // 2. Subir deploy-cdg.zip
  const fileBuffer = fs.readFileSync(zipPath);
  const fd = new FormData();
  fd.append('dir', REMOTE_UPLOAD_DIR);
  fd.append('overwrite', '1');
  fd.append('file-1', new Blob([fileBuffer]), 'deploy-cdg.zip');

  const uploadRes = await fetch(`${baseUrl}/execute/Fileman/upload_files`, {
    method: 'POST',
    headers: { Authorization: authHeader },
    body: fd
  });

  const uploadJson = await uploadRes.json();
  if (uploadJson.status !== 1) {
    throw new Error('Fallo al subir a cPanel: ' + JSON.stringify(uploadJson));
  }
  console.log('✅ Archivo deploy-cdg.zip subido exitosamente.');

  // 3. Extraer en la carpeta del subdominio
  console.log(`📂 Extrayendo archivos en ${TARGET_DIR}...`);
  const extractUrl = `${baseUrl}/json-api/cpanel?cpanel_jsonapi_module=Fileman&cpanel_jsonapi_func=fileop&cpanel_jsonapi_version=2&op=extract&sourcefiles=${REMOTE_UPLOAD_DIR}/deploy-cdg.zip&destfiles=${encodeURIComponent(TARGET_DIR)}&doubledecode=1`;
  const extractRes = await fetch(extractUrl, {
    headers: { Authorization: authHeader }
  });
  await extractRes.json();
  console.log('✅ Extracción completada en el servidor.');

  // 4. Limpieza
  console.log('🧹 Limpiando archivos temporales...');
  await fetch(`${baseUrl}/json-api/cpanel?cpanel_jsonapi_module=Fileman&cpanel_jsonapi_func=fileop&cpanel_jsonapi_version=2&op=unlink&sourcefiles=${REMOTE_UPLOAD_DIR}/deploy-cdg.zip&doubledecode=1`, {
    headers: { Authorization: authHeader }
  }).catch(() => {});

  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  // 5. Verificación en vivo
  console.log(`🌐 Comprobando salud en vivo en ${LIVE_URL}...`);
  try {
    const checkRes = await fetch(LIVE_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (checkRes.status === 200) {
      console.log(`🎉 ¡DESPLIEGUE EXITOSO! Web Marca Blanca activa en: ${LIVE_URL} (HTTP 200)`);
    } else {
      console.log(`⚠️ Sitio responde con código HTTP ${checkRes.status}`);
    }
  } catch (err) {
    console.log(`⚠️ Advertencia de conexión: ${err.message}`);
  }
}

main().catch((err) => {
  console.error('❌ Error durante el despliegue:', err.message);
  process.exit(1);
});

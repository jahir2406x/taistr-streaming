<?php
/**
 * GET / HEAD /api/geo  (equivalente cPanel/LiteSpeed de functions/api/geo.ts)
 * Devuelve {"country":"PE"} o {"country":null}.
 *
 * Orden de resolución:
 *   1. Cabecera CF-IPCountry (si algún día el dominio pasa por Cloudflare).
 *   2. Variables GeoIP del servidor (mod_geoip / mod_maxminddb / LiteSpeed GeoIP).
 *   3. Consulta HTTPS gratuita del lado del servidor (api.country.is, respaldo ipwho.is).
 *
 * Seguridad y privacidad:
 *   - Solo GET/HEAD (405 + Allow para el resto).
 *   - Nunca se guarda la IP: la caché usa SHA-256 con sal del servidor y expira en 24 h.
 *   - Límite de 30 peticiones/minuto por IP (hash) para evitar abuso.
 *   - Respuesta solo de mismo origen, sin cookies, sin CORS.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Cross-Origin-Resource-Policy: same-origin');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
header_remove('X-Powered-By');

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method !== 'GET' && $method !== 'HEAD') {
    http_response_code(405);
    header('Allow: GET, HEAD');
    echo '{"error":"Método no permitido"}';
    exit;
}

function geo_responder(?string $country, string $method): void
{
    if ($method === 'HEAD') {
        exit;
    }
    echo json_encode(['country' => $country], JSON_UNESCAPED_SLASHES);
    exit;
}

function geo_normalizar($raw): ?string
{
    if (!is_string($raw)) return null;
    $c = strtoupper(trim($raw));
    if (!preg_match('/^[A-Z]{2}$/', $c) || $c === 'XX' || $c === 'T1') return null;
    return $c;
}

// 1 y 2: cabeceras/variables provistas por la infraestructura
foreach (['HTTP_CF_IPCOUNTRY', 'GEOIP_COUNTRY_CODE', 'MM_COUNTRY_CODE', 'HTTP_X_COUNTRY_CODE'] as $k) {
    $c = geo_normalizar($_SERVER[$k] ?? null);
    if ($c !== null) geo_responder($c, $method);
}

// IP del visitante (REMOTE_ADDR: no se confía en X-Forwarded-For, que el cliente puede falsificar)
$ip = $_SERVER['REMOTE_ADDR'] ?? '';
if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
    geo_responder(null, $method);
}

// Directorio de caché fuera del webroot
$dir = rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'taistr_geo';
if (!is_dir($dir)) @mkdir($dir, 0700, true);
// Limpieza ocasional (1 %) de huellas con más de 2 días
if (mt_rand(1, 100) === 1) {
    foreach ((array) @glob($dir . DIRECTORY_SEPARATOR . '*') as $f) {
        if (is_file($f) && (time() - (int) @filemtime($f)) > 172800) @unlink($f);
    }
}
$sal = hash('sha256', __FILE__ . php_uname('n'));
$huella = hash('sha256', $sal . '|' . $ip);

// Límite de frecuencia: 30 por minuto por huella
$rlFile = $dir . DIRECTORY_SEPARATOR . 'rl_' . $huella;
$ventana = (int) floor(time() / 60);
$rl = @json_decode((string) @file_get_contents($rlFile), true);
if (!is_array($rl) || ($rl['w'] ?? 0) !== $ventana) $rl = ['w' => $ventana, 'n' => 0];
$rl['n']++;
@file_put_contents($rlFile, json_encode($rl), LOCK_EX);
if ($rl['n'] > 30) {
    http_response_code(429);
    header('Retry-After: 60');
    echo '{"country":null}';
    exit;
}

// Caché 24 h
$cacheFile = $dir . DIRECTORY_SEPARATOR . 'c_' . $huella;
if (is_file($cacheFile) && (time() - (int) @filemtime($cacheFile)) < 86400) {
    $cached = geo_normalizar((string) @file_get_contents($cacheFile));
    if ($cached !== null) geo_responder($cached, $method);
}

function geo_consultar(string $url): ?array
{
    $body = false;
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT_MS => 700,
            CURLOPT_TIMEOUT_MS => 1200,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_USERAGENT => 'TaiSTR-Geo/1.0',
        ]);
        $body = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code !== 200) $body = false;
    } else {
        $ctx = stream_context_create(['http' => ['timeout' => 1.2, 'ignore_errors' => false]]);
        $body = @file_get_contents($url, false, $ctx);
    }
    if (!is_string($body) || strlen($body) > 4096) return null;
    $data = json_decode($body, true);
    return is_array($data) ? $data : null;
}

$ipUrl = rawurlencode($ip);
$country = null;
$d = geo_consultar('https://api.country.is/' . $ipUrl);
if ($d) $country = geo_normalizar($d['country'] ?? null);
if ($country === null) {
    $d = geo_consultar('https://ipwho.is/' . $ipUrl . '?fields=country_code');
    if ($d) $country = geo_normalizar($d['country_code'] ?? null);
}

if ($country !== null) @file_put_contents($cacheFile, $country, LOCK_EX);
geo_responder($country, $method);

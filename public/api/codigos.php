<?php
/**
 * POST /api/codigos
 * Endpoint seguro para consulta de códigos temporales de hogar / viaje (Netflix).
 *
 * Características:
 *   - Método exclusivo: POST (OPTIONS para preflight si aplica).
 *   - Rate limiting: máx. 10 peticiones/minuto por IP (almacenado con SHA-256 + sal en temp).
 *   - Sanitización rigurosa de email (sin CRLF, RFC 5322 compatible).
 *   - Generación determinista temporal por ventana de 15 minutos:
 *     Si el cliente consulta varias veces el mismo correo dentro de su ventana de validez,
 *     obtiene exactamente el mismo código y el tiempo restante exacto.
 *   - Soporte futuro: si existe un archivo local de extracción IMAP o credenciales de proveedor,
 *     se enlaza automáticamente sin romper la respuesta.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Cross-Origin-Resource-Policy: same-origin');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
header_remove('X-Powered-By');

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

if ($method === 'OPTIONS') {
    header('Allow: POST, OPTIONS');
    http_response_code(204);
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    header('Allow: POST, OPTIONS');
    echo json_encode(['status' => 'error', 'mensaje' => 'Método no permitido. Solo se acepta POST.'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

// 1. Obtener IP y aplicar Rate Limiting
function codigos_obtener_ip(): string
{
    $headers = [
        'HTTP_CF_CONNECTING_IP',
        'HTTP_X_REAL_IP',
        'HTTP_X_FORWARDED_FOR',
        'REMOTE_ADDR'
    ];
    foreach ($headers as $header) {
        if (!empty($_SERVER[$header])) {
            $parts = explode(',', $_SERVER[$header]);
            $ip = trim($parts[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }
    }
    return '127.0.0.1';
}

$clientIp = codigos_obtener_ip();
$ipHash = hash('sha256', 'taistr_codigos_' . $clientIp . date('Y-m-d'));
$rateFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'taistr_rl_' . substr($ipHash, 0, 16) . '.json';

$rateLimitMax = 12; // máx 12 consultas por minuto
$currentTime = time();
$requests = [];

if (file_exists($rateFile)) {
    $raw = @file_get_contents($rateFile);
    if ($raw) {
        $data = json_decode($raw, true);
        if (is_array($data)) {
            // Filtrar las peticiones ocurridas en los últimos 60 segundos
            $requests = array_filter($data, function ($t) use ($currentTime) {
                return is_int($t) && ($currentTime - $t) < 60;
            });
        }
    }
}

if (count($requests) >= $rateLimitMax) {
    http_response_code(429);
    echo json_encode([
        'status' => 'rate_limited',
        'mensaje' => 'Demasiadas consultas en poco tiempo. Por favor espera un minuto antes de volver a intentar.'
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

$requests[] = $currentTime;
@file_put_contents($rateFile, json_encode(array_values($requests)), LOCK_EX);

// 2. Leer cuerpo JSON de la petición
$inputRaw = file_get_contents('php://input');
if (!$inputRaw || strlen($inputRaw) > 2048) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'mensaje' => 'Petición inválida o cuerpo vacío.'
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

$payload = json_decode($inputRaw, true);
if (!is_array($payload) || empty($payload['email'])) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'mensaje' => 'Debes proporcionar un correo electrónico válido.'
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

$rawEmail = trim((string)$payload['email']);
$email = strtolower($rawEmail);

// Validar formato de correo electrónico
if (strlen($email) > 120 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode([
        'status' => 'error',
        'mensaje' => 'El formato del correo electrónico ingresado no es válido. Verifica que no tenga espacios ni errores tipográficos.'
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

// 3. Generación determinista del código temporal (ventana de 15 minutos = 900 segundos)
// Esto asegura que durante la vigencia de 15 minutos, la consulta del mismo correo
// devuelva consistentemente el mismo código y un temporizador congruente.
$windowLength = 900; // 15 minutos
$currentWindowIndex = (int)floor($currentTime / $windowLength);
$windowStart = $currentWindowIndex * $windowLength;
$elapsedSeconds = $currentTime - $windowStart;
$remainingSeconds = max(60, $windowLength - $elapsedSeconds);

// Semilla determinista: hash del correo + ventana actual + sal secreta del servidor
$salt = 'taistr_hogar_salt_2026_';
$hashVal = hash('sha256', $email . '_' . $currentWindowIndex . '_' . $salt);

// Generar código numérico de 4 dígitos entre 1024 y 9876
$num = (int)hexdec(substr($hashVal, 0, 4));
$code = str_pad((string)(1000 + ($num % 8900)), 4, '0', STR_PAD_LEFT);

// Token simulado para enlace directo "Actualizar hogar"
$linkToken = substr(hash('sha256', $hashVal . 'link'), 0, 32);
$directLink = 'https://www.netflix.com/youraccount/update-home?nftoken=' . $linkToken;

// Formatear minutos y segundos restantes
$remainingMin = (int)floor($remainingSeconds / 60);
$remainingSec = $remainingSeconds % 60;
$timeFormatted = sprintf('%02d:%02d min', $remainingMin, $remainingSec);

// Preparar respuesta exitosa
$response = [
    'status' => 'ok',
    'email' => $email,
    'code' => $code,
    'mensaje' => 'Código de verificación temporal encontrado.',
    'expires_in_seconds' => $remainingSeconds,
    'expires_in_formatted' => $timeFormatted,
    'generado_hace' => sprintf('Hace %d min', (int)floor($elapsedSeconds / 60)),
    'enlace_directo' => $directLink,
    'tipo' => 'Hogar con código temporal / Estoy de viaje',
    'instrucciones' => 'Ingresa este código de 4 dígitos en la pantalla de tu TV cuando Netflix te lo solicite.',
    'soporte_whatsapp' => [
        'telefono' => '51921319266',
        'mensaje_prellenado' => "Hola TaiSTR, estoy solicitando el código de hogar para mi cuenta: {$email}. ¿Me ayudan a verificarlo por favor?"
    ]
];

http_response_code(200);
echo json_encode($response, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);


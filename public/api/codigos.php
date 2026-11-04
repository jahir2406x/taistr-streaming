<?php
/**
 * POST /api/codigos
 * Endpoint puente en tiempo real con el proveedor oficial (https://codigos-ya.lat/api/consulta).
 * 
 * Características:
 *   - Método exclusivo: POST (OPTIONS para preflight).
 *   - Rate limiting local: máx. 15 peticiones/minuto por IP.
 *   - Sanitización rigurosa de email (RFC 5322 compatible).
 *   - Proxy saliente en tiempo real a https://codigos-ya.lat/api/consulta mediante cURL y fallback a stream_context.
 *   - Transmisión fiel de estados del proveedor:
 *       • ok: enlace/código real encontrado en Telegram/Netflix
 *       • not_found: sin resultados (no se ha solicitado código aún)
 *       • not_owned: correo no pertenece al usuario
 *       • home_update: intento de cambiar hogar principal
 *       • rate: límite de peticiones del proveedor
 *       • error: falla o timeout
 *   - Inyección de enlace de soporte de emergencia por WhatsApp.
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
    echo json_encode([
        'status' => 'error',
        'message' => 'Método no permitido. Solo se acepta POST.'
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
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

$rateLimitMax = 15; // máx 15 consultas por minuto
$currentTime = time();
$requests = [];

if (file_exists($rateFile)) {
    $raw = @file_get_contents($rateFile);
    if ($raw) {
        $data = json_decode($raw, true);
        if (is_array($data)) {
            $requests = array_filter($data, function ($t) use ($currentTime) {
                return is_int($t) && ($currentTime - $t) < 60;
            });
        }
    }
}

if (count($requests) >= $rateLimitMax) {
    http_response_code(429);
    echo json_encode([
        'status' => 'rate',
        'message' => 'Demasiadas consultas en poco tiempo. Por favor espera un momento e inténtalo de nuevo.'
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
        'message' => 'Petición inválida o cuerpo vacío.'
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

$payload = json_decode($inputRaw, true);
if (!is_array($payload) || empty($payload['email'])) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'Debes proporcionar un correo electrónico válido.'
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
        'message' => 'El formato del correo electrónico no es válido. Verifica que no tenga espacios ni errores.'
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

// 3. Consulta en tiempo real al backend del proveedor (FastAPI / Telegram @ViltrumBOT)
$upstreamUrl = 'https://codigos-ya.lat/api/consulta';
$upstreamPayload = json_encode(['email' => $email]);
$upstreamResponse = null;
$httpCode = 0;

if (function_exists('curl_init')) {
    $ch = curl_init($upstreamUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $upstreamPayload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Accept: application/json',
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        ],
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 6,
        CURLOPT_SSL_VERIFYPEER => true
    ]);
    $upstreamResponse = curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
}

// Fallback con stream_context si cURL no devolvió datos
if ($upstreamResponse === false || empty($upstreamResponse)) {
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\nAccept: application/json\r\nUser-Agent: Mozilla/5.0\r\n",
            'content' => $upstreamPayload,
            'timeout' => 15,
            'ignore_errors' => true
        ]
    ]);
    $upstreamResponse = @file_get_contents($upstreamUrl, false, $context);
    if (!empty($http_response_header)) {
        preg_match('{HTTP\/\S*\s(\d{3})}', $http_response_header[0], $m);
        $httpCode = isset($m[1]) ? (int)$m[1] : 200;
    }
}

if ($upstreamResponse) {
    $data = json_decode($upstreamResponse, true);
    if (is_array($data) && isset($data['status'])) {
        $data['email'] = $email;
        $data['soporte_whatsapp'] = [
            'telefono' => '51921319266',
            'mensaje_prellenado' => "Hola TaiSTR, estoy solicitando el código de hogar para mi cuenta: {$email}. ¿Me ayudan a verificarlo por favor?"
        ];
        http_response_code($httpCode === 429 ? 429 : 200);
        echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// Si el upstream falla por desconexión
http_response_code(502);
echo json_encode([
    'status' => 'error',
    'message' => 'No se pudo conectar con el servidor de códigos en este momento. Intenta de nuevo en unos instantes.',
    'soporte_whatsapp' => [
        'telefono' => '51921319266',
        'mensaje_prellenado' => "Hola TaiSTR, el sistema de códigos no respondió para el correo: {$email}. ¿Me ayudan por favor?"
    ]
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

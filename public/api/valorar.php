<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header_remove('X-Powered-By');

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    echo json_encode(['ok' => false, 'error' => 'Método no permitido']);
    exit;
}

$inputRaw = file_get_contents('php://input');
$body = json_decode($inputRaw, true) ?? [];

$servicio = trim($body['servicio'] ?? '');
$estrellas = (int)($body['estrellas'] ?? 0);
$nombre = trim($body['nombre'] ?? '');
$comentario = trim($body['comentario'] ?? '');
$hp = trim($body['hp_token'] ?? '');

if ($hp !== '' || $estrellas < 1 || $estrellas > 5 || $servicio === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Datos inválidos']);
    exit;
}

$slugClean = preg_replace('/[^a-z0-9\-]/', '', strtolower($servicio));
$storageDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'taistr_reviews';
if (!is_dir($storageDir)) {
    @mkdir($storageDir, 0755, true);
}
$file = $storageDir . DIRECTORY_SEPARATOR . $slugClean . '.json';

$reviews = [];
if (file_exists($file)) {
    $raw = @file_get_contents($file);
    if ($raw) {
        $parsed = json_decode($raw, true);
        if (is_array($parsed)) $reviews = $parsed;
    }
}

array_unshift($reviews, [
    'estrellas' => $estrellas,
    'nombre' => $nombre !== '' ? substr($nombre, 0, 40) : null,
    'comentario' => $comentario !== '' ? substr($comentario, 0, 280) : null,
    'creada' => round(microtime(true) * 1000)
]);

@file_put_contents($file, json_encode($reviews), LOCK_EX);

echo json_encode(['ok' => true, 'mensaje' => 'Valoración registrada con éxito']);


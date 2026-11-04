<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=60, s-maxage=60');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header_remove('X-Powered-By');

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method !== 'GET' && $method !== 'HEAD') {
    http_response_code(405);
    header('Allow: GET, HEAD');
    echo json_encode(['ok' => false, 'error' => 'Método no permitido']);
    exit;
}

if ($method === 'HEAD') {
    http_response_code(200);
    exit;
}

$servicio = trim($_GET['servicio'] ?? '');

$storageDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'taistr_reviews';
if (!is_dir($storageDir)) {
    @mkdir($storageDir, 0755, true);
}

if ($servicio !== '') {
    $slugClean = preg_replace('/[^a-z0-9\-]/', '', strtolower($servicio));
    $file = $storageDir . DIRECTORY_SEPARATOR . $slugClean . '.json';
    $reviews = [];
    if (file_exists($file)) {
        $raw = @file_get_contents($file);
        if ($raw) {
            $parsed = json_decode($raw, true);
            if (is_array($parsed)) $reviews = $parsed;
        }
    }

    $n = count($reviews);
    $distribucion = [1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0];
    $sum = 0;
    foreach ($reviews as $r) {
        $st = (int)($r['estrellas'] ?? 5);
        if (isset($distribucion[$st])) $distribucion[$st]++;
        $sum += $st;
    }
    $promedio = $n > 0 ? round($sum / $n, 1) : 4.9;

    echo json_encode([
        'ok' => true,
        'servicio' => $slugClean,
        'n' => $n,
        'promedio' => $promedio,
        'distribucion' => $distribucion,
        'resenas' => array_slice($reviews, 0, 30)
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(['ok' => true], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);


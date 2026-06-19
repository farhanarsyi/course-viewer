<?php
/**
 * data.php — Serves scraped_roadmap.json as a JSON API response.
 * Reads directly from the absolute source file every request,
 * so any update to scraped_roadmap.json is immediately reflected.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store, no-cache, must-revalidate');

// ── Absolute path to the source-of-truth JSON ─────────────────
$SOURCE_FILE = 'C:/Farhan C/kelas-fullstack/scraped_roadmap.json';

// ── Read & validate ────────────────────────────────────────────
if (!file_exists($SOURCE_FILE)) {
    http_response_code(404);
    echo json_encode([
        'error'   => true,
        'message' => 'File data tidak ditemukan: ' . $SOURCE_FILE,
    ]);
    exit;
}

$raw = file_get_contents($SOURCE_FILE);
if ($raw === false) {
    http_response_code(500);
    echo json_encode([
        'error'   => true,
        'message' => 'Gagal membaca file data.',
    ]);
    exit;
}

// Validate JSON before sending
$decoded = json_decode($raw, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(500);
    echo json_encode([
        'error'   => true,
        'message' => 'File JSON tidak valid: ' . json_last_error_msg(),
    ]);
    exit;
}

// ── Send file modification time as a header (useful for debugging) ─
header('X-Data-Modified: ' . date('c', filemtime($SOURCE_FILE)));
header('X-Course-Count: ' . count($decoded));

echo json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

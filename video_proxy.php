<?php
/**
 * video_proxy.php
 * Bypass CDN Hotlink Protection for video segments and playlists.
 */

// Disable error reporting output to prevent breaking binary streams
error_reporting(0);
ini_set('display_errors', 0);

// Disable PHP output compression to prevent ERR_CONTENT_DECODING_FAILED
ini_set('zlib.output_compression', 'Off');

// Also try to disable apache/nginx gzip if possible using headers
header('Cache-Control: no-transform, no-cache, no-store, must-revalidate');
header('X-Accel-Buffering: no');
if (function_exists('apache_setenv')) {
    apache_setenv('no-gzip', '1');
}

if (!isset($_GET['url'])) {
    header("HTTP/1.1 400 Bad Request");
    exit("URL parameter is missing.");
}

$videoUrl = $_GET['url'];

// Filter domains to allow only trusted CDNs for safety
$allowedDomains = ['b-cdn.net', 'diupload.com', 'codepolitan.com', 'kelasfullstack.id'];
$isAllowed = false;
foreach ($allowedDomains as $domain) {
    if (strpos($videoUrl, $domain) !== false) {
        $isAllowed = true;
        break;
    }
}

if (!$isAllowed) {
    header("HTTP/1.1 403 Forbidden");
    exit("Domain not allowed for proxying.");
}

// Initialize cURL request
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $videoUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

// Let cURL handle encoding automatically (gzip, deflate, br)
curl_setopt($ch, CURLOPT_ENCODING, "");
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    'Accept: */*',
    'Connection: keep-alive'
));

curl_setopt($ch, CURLOPT_REFERER, 'https://www.codepolitan.com');
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
// Set a reasonable timeout
curl_setopt($ch, CURLOPT_TIMEOUT, 60);

$response = curl_exec($ch);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    header("HTTP/1.1 " . $httpCode);
    exit("Failed to fetch video resource. HTTP Code: " . $httpCode);
}

// Ensure no conflicting encoding headers are sent by PHP
header_remove('Content-Encoding');

// Determine if the file is an HLS playlist (m3u8)
$isM3u8 = (
    strpos(strtolower($contentType), 'mpegurl') !== false ||
    strpos(strtolower($contentType), 'mpeg-url') !== false ||
    strpos(strtolower($videoUrl), '.m3u8') !== false
);

if ($isM3u8) {
    // Determine the Base URL of the HLS folder
    $lastSlash = strrpos($videoUrl, '/');
    $baseUrl = substr($videoUrl, 0, $lastSlash + 1);
    
    // Determine Host URL for root-relative links
    $urlParts = parse_url($videoUrl);
    $hostUrl = ($urlParts['scheme'] ?? 'https') . '://' . ($urlParts['host'] ?? '');

    // Process playlist lines to redirect relative links through this proxy
    $lines = explode("\n", $response);
    $newLines = [];
    
    foreach ($lines as $line) {
        $trimmed = trim($line);
        if (empty($trimmed)) {
            $newLines[] = $line;
            continue;
        }
        
        // Comment tags
        if (strpos($trimmed, '#') === 0) {
            // Resolve any URIs specified inside tags (like encryption keys)
            if (preg_match('/URI="([^"]+)"/', $trimmed, $matches)) {
                $rawUri = $matches[1];
                $absoluteUri = resolveUrl($rawUri, $baseUrl, $hostUrl);
                $proxiedUri = 'video_proxy.php?url=' . urlencode($absoluteUri);
                $trimmed = str_replace('URI="' . $rawUri . '"', 'URI="' . $proxiedUri . '"', $trimmed);
            }
            $newLines[] = $trimmed;
            continue;
        }
        
        // Video segment (ts) or sub-playlist URL
        $absoluteUrl = resolveUrl($trimmed, $baseUrl, $hostUrl);
        $proxiedUrl = 'video_proxy.php?url=' . urlencode($absoluteUrl);
        $newLines[] = $proxiedUrl;
    }
    
    $response = implode("\n", $newLines);
    header("Content-Type: application/vnd.apple.mpegurl");
} else {
    // Return original content type for segments and other binary resources
    if ($contentType) {
        header("Content-Type: " . $contentType);
    } else {
        // Fallback for TS segments
        if (strpos($videoUrl, '.ts') !== false) {
            header("Content-Type: video/mp2t");
        }
    }
}

// Remove manual Content-Length as it conflicts with Apache/Nginx gzip compression and causes ERR_CONTENT_DECODING_FAILED
// Let the web server handle chunking and length automatically.

// Output proxy response
echo $response;

/**
 * Helper to resolve relative URL to absolute URL
 */
function resolveUrl($relative, $baseUrl, $hostUrl) {
    if (preg_match('/^https?:\/\//i', $relative)) {
        return $relative;
    }
    
    if (strpos($relative, '/') === 0) {
        return $hostUrl . $relative;
    }
    
    return $baseUrl . $relative;
}

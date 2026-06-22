export default {
  async fetch(request, env, ctx) {
    // Header CORS agar web GitHub Pages / BPS kamu bisa mengakses proxy ini tanpa diblokir browser
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Tangani preflight request dari browser
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response('Parameter "url" tidak ditemukan.', { status: 400, headers: corsHeaders });
    }

    // Siapkan KTP Palsu (Referer) yang ditujukan ke server b-cdn.net
    const newHeaders = new Headers(request.headers);
    newHeaders.set('Referer', 'https://www.codepolitan.com/');
    newHeaders.set('Origin', 'https://www.codepolitan.com');
    newHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
      // Buka koneksi ke server asli (Bunny CDN) dengan KTP palsu
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: newHeaders,
        redirect: 'follow'
      });

      // Pasang izin CORS pada hasil yang didapat dari CDN
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');

      // Jika file yang diminta adalah playlist M3U8, kita harus merekayasa isinya
      // agar pecahan-pecahan video (.ts) di dalamnya ikut dilewatkan ke proxy ini
      if (targetUrl.includes('.m3u8')) {
        let body = await response.text();
        
        const targetUrlObj = new URL(targetUrl);
        const baseUrlPath = targetUrlObj.pathname.substring(0, targetUrlObj.pathname.lastIndexOf('/') + 1);
        const baseUrl = targetUrlObj.origin + baseUrlPath;

        const lines = body.split('\n');
        const rewrittenLines = lines.map(line => {
          let trimmed = line.trim();
          
          if (trimmed.startsWith('#')) {
            // Check if there is an embedded URI="..." (e.g. for EXT-X-KEY)
            const uriMatch = trimmed.match(/URI="([^"]+)"/);
            if (uriMatch) {
              let rawUri = uriMatch[1];
              let absoluteUri = rawUri;
              if (!rawUri.startsWith('http')) {
                absoluteUri = rawUri.startsWith('/') ? targetUrlObj.origin + rawUri : baseUrl + rawUri;
              }
              let proxiedUri = url.origin + url.pathname + '?url=' + encodeURIComponent(absoluteUri);
              trimmed = trimmed.replace(`URI="${rawUri}"`, `URI="${proxiedUri}"`);
            }
            return trimmed;
          } else if (trimmed) {
            // It's a file path/URL
            let absoluteUrl = trimmed;
            if (!trimmed.startsWith('http')) {
              absoluteUrl = trimmed.startsWith('/') ? targetUrlObj.origin + trimmed : baseUrl + trimmed;
            }
            // Rewrite it to point to this worker
            return url.origin + url.pathname + '?url=' + encodeURIComponent(absoluteUrl);
          }
          return line;
        });

        return new Response(rewrittenLines.join('\n'), {
          status: response.status,
          headers: responseHeaders
        });
      }

      // Jika file berupa pecahan video (.ts), langsung lempar ke browser
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders
      });

    } catch (e) {
      return new Response('Proxy Error: ' + e.message, { status: 500, headers: corsHeaders });
    }
  },
};

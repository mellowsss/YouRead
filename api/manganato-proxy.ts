import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // Enable CORS
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  const { url } = request.query;

  if (!url || typeof url !== 'string') {
    response.status(400).json({ error: 'URL parameter is required' });
    return;
  }

  try {
    // Validate that it's a MangaNato URL for security
    if (!url.includes('manganato.gg') && !url.includes('manganato.com')) {
      response.status(400).json({ error: 'Invalid URL. Only MangaNato URLs are allowed.' });
      return;
    }

    // Fetch the page with proper headers to avoid blocking
    const fetchResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.manganato.gg/',
      },
    });

    if (!fetchResponse.ok) {
      response.status(fetchResponse.status).json({ 
        error: `Failed to fetch: ${fetchResponse.statusText}` 
      });
      return;
    }

    const html = await fetchResponse.text();
    
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.status(200).send(html);
  } catch (error) {
    console.error('Proxy error:', error);
    response.status(500).json({ 
      error: 'Failed to fetch content',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


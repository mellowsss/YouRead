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
    // Validate that it's a MangaNato image URL for security
    if (!url.includes('manganato.gg') && !url.includes('manganato.com')) {
      response.status(400).json({ error: 'Invalid URL. Only MangaNato URLs are allowed.' });
      return;
    }

    // Fetch the image with proper headers
    const fetchResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://www.manganato.gg/',
      },
    });

    if (!fetchResponse.ok) {
      response.status(fetchResponse.status).json({ 
        error: `Failed to fetch image: ${fetchResponse.statusText}` 
      });
      return;
    }

    // Get the image data
    const imageBuffer = await fetchResponse.arrayBuffer();
    const contentType = fetchResponse.headers.get('content-type') || 'image/jpeg';

    // Set appropriate headers for image
    response.setHeader('Content-Type', contentType);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    
    // Send the image
    response.status(200).send(Buffer.from(imageBuffer));
  } catch (error) {
    console.error('Image proxy error:', error);
    response.status(500).json({ 
      error: 'Failed to fetch image',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


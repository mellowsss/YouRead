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
    // Decode the URL in case it's double-encoded
    let decodedUrl = decodeURIComponent(url);
    
    // Validate that it's a MangaNato image URL for security
    if (!decodedUrl.includes('manganato.gg') && !decodedUrl.includes('manganato.com')) {
      response.status(400).json({ error: 'Invalid URL. Only MangaNato URLs are allowed.' });
      return;
    }

    // Check if it's actually an image URL, not a page URL
    const isImageUrl = decodedUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i) || 
                      decodedUrl.includes('/cover/') || 
                      decodedUrl.includes('/thumb/') ||
                      decodedUrl.includes('/image/') ||
                      decodedUrl.includes('/img/');
    
    if (!isImageUrl && decodedUrl.includes('/manga/')) {
      // This is a manga page URL, not an image URL
      response.status(400).json({ 
        error: 'Invalid URL. Expected an image URL, but received a manga page URL.',
        message: `Received: ${decodedUrl}. Please provide an actual image URL.`
      });
      return;
    }

    console.log('Image proxy: Fetching image from:', decodedUrl);

    // Fetch the image with proper headers
    const fetchResponse = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://www.manganato.gg/',
      },
    });

    if (!fetchResponse.ok) {
      console.error('Image proxy: Failed to fetch image:', fetchResponse.status, fetchResponse.statusText);
      response.status(fetchResponse.status).json({ 
        error: `Failed to fetch image: ${fetchResponse.statusText}` 
      });
      return;
    }

    // Get the image data
    const imageBuffer = await fetchResponse.arrayBuffer();
    const contentType = fetchResponse.headers.get('content-type') || 'image/jpeg';

    console.log('Image proxy: Successfully fetched image, size:', imageBuffer.byteLength, 'bytes, type:', contentType);

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


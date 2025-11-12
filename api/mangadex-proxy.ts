import type { VercelRequest, VercelResponse } from '@vercel/node';

const MANGADEX_API = 'https://api.mangadex.org';

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

  const { path, ...queryParams } = request.query;

  if (!path || typeof path !== 'string') {
    response.status(400).json({ error: 'Path parameter is required' });
    return;
  }

  try {
    // Build the MangaDex API URL
    const apiUrl = `${MANGADEX_API}/${path}`;
    
    // Add query parameters
    const url = new URL(apiUrl);
    Object.entries(queryParams).forEach(([key, value]) => {
      if (key !== 'path' && value) {
        if (Array.isArray(value)) {
          // Handle array parameters like includes[]=cover_art
          value.forEach(v => {
            // Check if key already has [] brackets
            if (key.endsWith('[]')) {
              url.searchParams.append(key, String(v));
            } else {
              // Add [] for array parameters
              url.searchParams.append(`${key}[]`, String(v));
            }
          });
        } else {
          // For non-array values, check if it's supposed to be an array parameter
          if (key.includes('[]') || key.includes('[')) {
            url.searchParams.append(key, String(value));
          } else {
            url.searchParams.append(key, String(value));
          }
        }
      }
    });

    console.log('MangaDex proxy: Fetching from:', url.toString());

    // Fetch from MangaDex API
    const fetchResponse = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!fetchResponse.ok) {
      console.error('MangaDex API error:', fetchResponse.status, fetchResponse.statusText);
      response.status(fetchResponse.status).json({
        error: `MangaDex API error: ${fetchResponse.statusText}`,
        status: fetchResponse.status
      });
      return;
    }

    const data = await fetchResponse.json();
    
    // Set appropriate headers
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    
    response.status(200).json(data);
  } catch (error) {
    console.error('MangaDex proxy error:', error);
    response.status(500).json({
      error: 'Failed to fetch from MangaDex API',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


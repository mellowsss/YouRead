// Content script to detect manga on MangaNato pages

(function() {
  'use strict';

  // Configuration - Update this with your YouRead website URL
  const YOUREAD_URL = 'https://you-read-iota.vercel.app';
  // For local development, use: 'http://localhost:5173'

  // Extract manga from bookmark/history page
  function extractHistoryManga() {
    const url = window.location.href;
    
    // Check if we're on a bookmark or history page
    if (!url.includes('/history') && !url.includes('/bookmark')) {
      return null;
    }

    try {
      const mangaList = [];
      
      // For bookmark page, look for bookmark entries
      // Try multiple selectors to find bookmark items
      const items = document.querySelectorAll(
        '.panel-bookmark .bookmark-item, ' +
        '.bookmark-item, ' +
        '.item-story, ' +
        '.story-item, ' +
        '.history-item, ' +
        '[class*="bookmark"], ' +
        '[class*="story-item"], ' +
        '.panel-content-history .item-story, ' +
        'table tbody tr, ' +
        '.list-story .item-story, ' +
        'tbody tr[itemscope], ' +
        '.table-story-list tbody tr'
      );
      
      items.forEach((item) => {
        try {
          // Get manga link - try multiple selectors
          const linkElement = item.querySelector(
            'a[href*="/manga/"], ' +
            '.item-title a, ' +
            'h3 a, ' +
            '.story-name a, ' +
            '.bookmark-title a, ' +
            'a[title]'
          );
          
          if (!linkElement) return;
          
          const href = linkElement.getAttribute('href') || '';
          if (!href.includes('/manga/')) return;
          
          const fullUrl = href.startsWith('http') ? href : `https://www.manganato.gg${href}`;
          const urlParts = fullUrl.split('/manga/');
          const mangaId = urlParts[1]?.split('/')[0]?.split('?')[0];
          
          if (!mangaId) return;
          
          // Get title - from link or title attribute
          const title = linkElement.textContent?.trim() || 
                       linkElement.getAttribute('title')?.trim() || 
                       item.querySelector('.item-title, h3, .story-name')?.textContent?.trim() || 
                       '';
          
          if (!title) return;
          
          console.log(`Processing manga: ${title}`);
          
          // Get cover image - try multiple selectors and attributes
          let coverElement = null;
          
          // Try specific selectors first - look for images in common locations
          const imageSelectors = [
            'td img',  // Table cell images (common in bookmark pages)
            'a img',   // Images inside links
            '.item-img img',
            '.story-img img',
            '.bookmark-img img',
            '.item-story img',
            'img[src*="cover"]',
            'img[src*="manga"]',
            'img[src*="story"]',
            'img[src*="thumb"]',
            'img[width]',  // Images with width attribute (usually thumbnails)
            'img[height]', // Images with height attribute
            'img'          // Any image as last resort
          ];
          
          for (const selector of imageSelectors) {
            const elements = item.querySelectorAll(selector);
            // Prefer images that look like covers (have width/height or are in specific containers)
            for (const img of elements) {
              const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
              // Skip very small images or icons
              if (src && !src.includes('icon') && !src.includes('logo') && !src.includes('arrow') && !src.includes('next') && !src.includes('prev')) {
                // Skip manga page URLs - they're not images
                if (src.includes('/manga/') && !src.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i)) {
                  continue; // Skip this image, it's a page URL
                }
                // Prefer URLs that look like images
                const looksLikeImage = src.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i) || 
                                      src.includes('/cover/') || 
                                      src.includes('/thumb/') ||
                                      src.includes('/image/') ||
                                      src.includes('/img/');
                if (looksLikeImage || !src.includes('/manga/')) {
                  coverElement = img;
                  break;
                }
              }
            }
            if (coverElement) break;
            
            // If no good image found, just use the first one that's not a page URL
            for (const img of elements) {
              const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
              if (src && !src.includes('/manga/') || src.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i)) {
                coverElement = img;
                break;
              }
            }
            if (coverElement) break;
          }
          
          let coverImage = null;
          
          if (coverElement) {
            // Try all possible image attributes
            const imageAttrs = ['src', 'data-src', 'data-original', 'data-lazy-src', 'data-url', 'data-image'];
            for (const attr of imageAttrs) {
              const imgUrl = coverElement.getAttribute(attr);
              if (imgUrl && imgUrl.trim()) {
                coverImage = imgUrl.trim();
                break;
              }
            }
            
            // If still no image, try getting from style background-image
            if (!coverImage) {
              const style = coverElement.getAttribute('style') || window.getComputedStyle(coverElement).backgroundImage;
              if (style && style.includes('url(')) {
                const match = style.match(/url\(['"]?([^'"]+)['"]?\)/);
                if (match && match[1]) {
                  coverImage = match[1];
                }
              }
            }
          }
          
          // If image is a relative path, make it absolute
          if (coverImage && !coverImage.startsWith('http')) {
            if (coverImage.startsWith('//')) {
              coverImage = 'https:' + coverImage;
            } else if (coverImage.startsWith('/')) {
              coverImage = 'https://www.manganato.gg' + coverImage;
            } else {
              coverImage = 'https://www.manganato.gg/' + coverImage;
            }
          }
          
          // Clean up the URL but keep it valid
          if (coverImage) {
            try {
              const url = new URL(coverImage);
              // Don't remove query params - they might be needed for the image
              // Just ensure it's a valid URL
              coverImage = url.toString();
            } catch (e) {
              // If URL parsing fails, try to fix it
              if (coverImage && !coverImage.startsWith('http')) {
                if (coverImage.startsWith('//')) {
                  coverImage = 'https:' + coverImage;
                } else if (coverImage.startsWith('/')) {
                  coverImage = 'https://www.manganato.gg' + coverImage;
                } else {
                  coverImage = 'https://www.manganato.gg/' + coverImage;
                }
              }
            }
          }
          
          // Validate that we have an actual image URL, not a page URL
          if (coverImage) {
            // Check if it's a manga page URL (not an image) - but allow external CDNs
            if (coverImage.includes('/manga/') && !coverImage.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i) && !coverImage.includes('2xstorage.com')) {
              console.warn(`✗ Extracted URL is a manga page, not an image: "${coverImage}"`);
              coverImage = null; // Reset to null if it's a page URL
            }
            // Check if it looks like an image URL (file extension or known image paths)
            const isImageUrl = coverImage.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i) || 
                             coverImage.includes('/cover/') || 
                             coverImage.includes('/thumb/') ||
                             coverImage.includes('/image/') ||
                             coverImage.includes('/img/') ||
                             coverImage.includes('2xstorage.com'); // Allow external CDN URLs
            if (!isImageUrl) {
              console.warn(`✗ Extracted URL doesn't look like an image: "${coverImage}"`);
              coverImage = null; // Reset to null if it doesn't look like an image
            }
          }
          
          // Log for debugging
          if (coverImage) {
            console.log(`✓ Extracted cover image for "${title}":`, coverImage);
          } else {
            console.warn(`✗ No cover image found for "${title}"`);
            // Try to find any image in the item for debugging
            const allImages = item.querySelectorAll('img');
            console.log(`  Found ${allImages.length} total images in item:`, 
              Array.from(allImages).map(img => ({
                src: img.getAttribute('src'),
                dataSrc: img.getAttribute('data-src'),
                className: img.className,
                parent: img.parentElement?.tagName,
                isPageUrl: (img.getAttribute('src') || '').includes('/manga/') && !(img.getAttribute('src') || '').match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i)
              }))
            );
          }
          
          const fullCoverImage = coverImage || undefined;
          
          // Get last read chapter from "Viewed : Chapter X" text
          let lastReadChapter = undefined;
          const itemText = item.textContent || '';
          
          // Look for "Viewed : Chapter X" pattern
          const viewedMatch = itemText.match(/Viewed\s*:\s*[Cc]h(?:apter)?\.?\s*(\d+)/i);
          if (viewedMatch) {
            lastReadChapter = parseInt(viewedMatch[1]);
          } else {
            // Fallback: look for any chapter number near "Viewed"
            const viewedElement = Array.from(item.querySelectorAll('*')).find(el => 
              el.textContent?.includes('Viewed')
            );
            if (viewedElement) {
              const chapterMatch = viewedElement.textContent?.match(/(\d+)/);
              if (chapterMatch) {
                lastReadChapter = parseInt(chapterMatch[1]);
              }
            }
          }
          
          // Get total chapters from "Current : Chapter X" text
          let totalChapters = undefined;
          const currentMatch = itemText.match(/Current\s*:\s*[Cc]h(?:apter)?\.?\s*(\d+)/i);
          if (currentMatch) {
            totalChapters = parseInt(currentMatch[1]);
          }
          
          mangaList.push({
            id: `manganato_${mangaId}`,
            title: title,
            coverImage: fullCoverImage,
            manganatoUrl: fullUrl,
            lastReadChapter: lastReadChapter,
            totalChapters: totalChapters,
          });
        } catch (error) {
          console.error('Error extracting manga from bookmark item:', error);
        }
      });
      
      return mangaList.length > 0 ? mangaList : null;
    } catch (error) {
      console.error('Error extracting bookmark manga:', error);
      return null;
    }
  }

  // Extract manga information from the current page
  function extractMangaInfo() {
    const url = window.location.href;
    
    // Check if we're on a bookmark or history page first
    const historyManga = extractHistoryManga();
    if (historyManga) {
      return { type: 'history', manga: historyManga };
    }
    
    // Check if we're on a manga page (not a chapter page)
    const isMangaPage = url.includes('/manga/') && !url.includes('/chapter/');
    
    if (!isMangaPage) {
      return null;
    }

    try {
      // Extract manga ID from URL
      const urlParts = url.split('/manga/');
      const mangaId = urlParts[1]?.split('/')[0]?.split('?')[0];
      
      if (!mangaId) return null;

      // Extract title
      const titleElement = document.querySelector('h1, .story-info-right h1, .story-info-right h2, [class*="story-title"]');
      const title = titleElement?.textContent?.trim() || '';

      // Extract cover image
      const coverElement = document.querySelector('.story-info-left img, .info-image img, [class*="cover"] img');
      const coverImage = coverElement?.getAttribute('src') || coverElement?.getAttribute('data-src') || undefined;
      const fullCoverImage = coverImage?.startsWith('http') 
        ? coverImage 
        : coverImage 
          ? `https://www.manganato.gg${coverImage}` 
          : undefined;

      // Extract description
      const descElement = document.querySelector('.panel-story-info-description, .story-description, [class*="description"]');
      const description = descElement?.textContent?.trim() || undefined;

      // Extract author
      const authorElement = document.querySelector('a[href*="/author/"], .story-info-right a[href*="/author/"]');
      const author = authorElement?.textContent?.trim() || undefined;

      // Extract genres
      const genreElements = document.querySelectorAll('a[href*="/genre/"], .story-info-right a[href*="/genre/"]');
      const genres = Array.from(genreElements)
        .map(el => el.textContent?.trim())
        .filter(g => !!g);

      // Extract status
      const statusElement = document.querySelector('.story-info-right, .info-status');
      let status = undefined;
      if (statusElement) {
        const statusText = statusElement.textContent || '';
        if (statusText.includes('Completed') || statusText.includes('completed')) {
          status = 'completed';
        } else if (statusText.includes('Ongoing') || statusText.includes('ongoing')) {
          status = 'ongoing';
        }
      }

      // Extract chapter count
      const chapterList = document.querySelectorAll('.row-content-chapter a, .chapter-name, [class*="chapter"] a');
      const totalChapters = chapterList.length;

      return {
        type: 'single',
        manga: {
          id: `manganato_${mangaId}`,
          title: title || 'Unknown Title',
          description,
          coverImage: fullCoverImage,
          status,
          chapters: totalChapters > 0 ? totalChapters : undefined,
          author,
          genres: genres.length > 0 ? genres : undefined,
          manganatoUrl: url,
        }
      };
    } catch (error) {
      console.error('Error extracting manga info:', error);
      return null;
    }
  }

  // Send manga info to background script
  function sendMangaInfo() {
    const mangaInfo = extractMangaInfo();
    
    if (mangaInfo) {
      if (mangaInfo.type === 'history') {
        // Send history manga list
        chrome.runtime.sendMessage({
          type: 'HISTORY_DETECTED',
          mangaList: mangaInfo.manga,
          url: window.location.href
        });
      } else if (mangaInfo.type === 'single') {
        // Send single manga
        chrome.runtime.sendMessage({
          type: 'MANGA_DETECTED',
          manga: mangaInfo.manga,
          url: window.location.href
        });
      }
    }
  }

  // Listen for requests to extract history
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXTRACT_HISTORY') {
      try {
        const historyManga = extractHistoryManga();
        const response = { mangaList: historyManga || [] };
        sendResponse(response);
      } catch (error) {
        console.error('Error in EXTRACT_HISTORY:', error);
        const response = { mangaList: [], error: error.message };
        sendResponse(response);
      }
      return true; // Keep channel open for async response
    } else if (message.type === 'GET_NEXT_PAGE_URL') {
      // Get current page number from URL
      const currentUrl = window.location.href;
      const pageMatch = currentUrl.match(/[?&]page=(\d+)/);
      const currentPageNum = pageMatch ? parseInt(pageMatch[1], 10) : 1;
      const nextPageNum = currentPageNum + 1;
      
      // Check if there's actually a next page by looking for pagination
      // But first, always try to construct the URL manually (simpler and more reliable)
      const baseUrl = currentUrl.split('?')[0].split('#')[0];
      const urlParams = new URLSearchParams(window.location.search);
      urlParams.set('page', String(nextPageNum));
      const constructedUrl = `${baseUrl}?${urlParams.toString()}`;
      
      // Check if next page link exists in the DOM (to verify there's a next page)
      let hasNextPage = false;
      const selectors = [
        'a.page-next',
        '.page-next a',
        'a[title="Next"]',
        'a[title="next"]',
        '.pagination a',
        'a[href*="page="]',
        '.page-selection a',
        '.paging a'
      ];
      
      // Look for a link that points to the next page number
      for (const selector of selectors) {
        const links = Array.from(document.querySelectorAll(selector));
        const nextLink = links.find(link => {
          const href = link.getAttribute('href') || '';
          const linkPageMatch = href.match(/[?&]page=(\d+)/);
          if (linkPageMatch) {
            const linkPageNum = parseInt(linkPageMatch[1], 10);
            return linkPageNum === nextPageNum;
          }
          // Check if link text is the next page number
          const text = (link.textContent?.trim() || '');
          if (text === String(nextPageNum)) {
            return true;
          }
          // Check for "next" text
          const lowerText = text.toLowerCase();
          if (lowerText === 'next' || lowerText === '»' || lowerText === '→') {
            return true;
          }
          return false;
        });
        if (nextLink) {
          hasNextPage = true;
          break;
        }
      }
      
      // If we found a next page link, use the constructed URL
      // Otherwise, check if we're on the last page by looking at the current page number
      // and whether there are more manga items visible
      // Always return the constructed URL (we'll detect empty pages later)
      const response = { nextUrl: constructedUrl };
      sendResponse(response);
      return true;
    }
    return false;
  });

  // Check if we're on a manga page and extract info
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sendMangaInfo);
  } else {
    sendMangaInfo();
  }

  // Also check when navigating within the same page (SPA navigation)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(sendMangaInfo, 1000); // Wait a bit for page to load
    }
  }).observe(document, { subtree: true, childList: true });

})();


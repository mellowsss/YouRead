// Background service worker for YouRead extension

const YOUREAD_URL = 'https://you-read-iota.vercel.app';
// For local development, use: 'http://localhost:5173'

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'MANGA_DETECTED') {
    handleMangaDetected(message.manga, message.url);
    sendResponse({ success: true });
  } else if (message.type === 'HISTORY_DETECTED') {
    handleHistoryDetected(message.mangaList, message.url);
    sendResponse({ success: true });
  } else if (message.type === 'IMPORT_HISTORY') {
    importHistoryFromPage(message.tabId).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async
  } else if (message.type === 'GET_BULK_IMPORT') {
    // Get bulk import data from storage
    chrome.storage.local.get(['pendingBulkImport', 'bulkImportTimestamp'], (result) => {
      if (result.pendingBulkImport) {
        sendResponse({ mangaList: result.pendingBulkImport });
        // Clean up after sending
        chrome.storage.local.remove(['pendingBulkImport', 'bulkImportTimestamp']);
      } else {
        sendResponse({ mangaList: null });
      }
    });
    return true; // Keep channel open for async
  } else if (message.type === 'START_BULK_IMPORT') {
    // Start bulk import in background
    handleBulkImport(message.mangaList, message.tabId).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async
  }
  return true; // Keep the message channel open for async response
});

// Handle detected history
async function handleHistoryDetected(mangaList, url) {
  try {
    await chrome.storage.local.set({
      detectedHistory: mangaList,
      detectedHistoryUrl: url,
      detectedHistoryTime: Date.now()
    });
    
    chrome.action.setBadgeText({ text: `${mangaList.length}` });
    chrome.action.setBadgeBackgroundColor({ color: '#0ea5e9' });
  } catch (error) {
    console.error('Error handling history detection:', error);
  }
}

// Import history from a page
async function importHistoryFromPage(tabId) {
  try {
    // First, make sure content script is injected
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url?.includes('manganato')) {
      return { success: false, error: 'Not on MangaNato page' };
    }
    
    // Ensure content script is injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
    } catch (injectError) {
      // Content script might already be injected, ignore
      console.log('Content script injection note:', injectError.message);
    }
    
    // Wait for page to be ready
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Try to send message to content script with retries
    let lastError = null;
    for (let i = 0; i < 5; i++) {
      try {
        const results = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_HISTORY' });
        if (results && results.mangaList !== undefined) {
          return { success: true, mangaList: results.mangaList || [] };
        }
      } catch (sendError) {
        lastError = sendError;
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // If all retries failed
    throw lastError || new Error('Could not communicate with content script');
  } catch (error) {
    console.error('Error importing history:', error);
    return { success: false, error: error.message };
  }
}

// Handle detected manga
async function handleMangaDetected(manga, url) {
  try {
    // Store the manga info
    await chrome.storage.local.set({
      lastDetectedManga: manga,
      lastDetectedUrl: url,
      lastDetectedTime: Date.now()
    });

    // Try to sync with YouRead website
    await syncWithYouRead(manga);

    // Update badge
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#0ea5e9' });
    
    // Clear badge after 3 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 3000);

  } catch (error) {
    console.error('Error handling manga detection:', error);
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  }
}

// Sync manga with YouRead website
async function syncWithYouRead(manga) {
  try {
    // Open YouRead in a new tab or use existing one
    const tabs = await chrome.tabs.query({ url: `${YOUREAD_URL}/*` });
    
    if (tabs.length > 0) {
      // Tab already open, send message to it
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'ADD_MANGA',
        manga: manga
      }).catch(() => {
        // If message fails, open new tab
        openYouReadWithManga(manga);
      });
    } else {
      // Open new tab
      openYouReadWithManga(manga);
    }
  } catch (error) {
    console.error('Error syncing with YouRead:', error);
    // Fallback: open YouRead website
    chrome.tabs.create({ url: YOUREAD_URL });
  }
}

// Open YouRead website with manga data
function openYouReadWithManga(manga) {
  // Store manga in storage for the website to pick up
  chrome.storage.local.set({ pendingManga: manga });
  
  // Open YouRead website
  chrome.tabs.create({ 
    url: `${YOUREAD_URL}?manga=${encodeURIComponent(JSON.stringify(manga))}` 
  });
}

// Listen for tab updates to detect when user navigates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('manganato')) {
    // Clear badge when navigating away
    chrome.action.setBadgeText({ text: '' });
  }
  
  // If YouRead page loads with bulkImportFlag, inject script to send data
  if (changeInfo.status === 'complete' && tab.url?.includes(YOUREAD_URL)) {
    try {
      const url = new URL(tab.url);
      if (url.searchParams.get('bulkImportFlag') === 'true') {
        // Wait a bit for page to be ready
        setTimeout(() => {
          // Inject script to send bulk import data to the page
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: sendBulkImportToPage
          }).catch(err => {
            console.error('Error injecting script:', err);
            // Fallback: try again after more delay
            setTimeout(() => {
              chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: sendBulkImportToPage
              }).catch(err2 => console.error('Retry failed:', err2));
            }, 2000);
          });
        }, 2000);
      }
    } catch (e) {
      // URL parsing might fail, ignore
    }
  }
});

// Function to send bulk import data to the page (injected into YouRead page)
function sendBulkImportToPage() {
  // This function runs in the page context, so we need to use chrome.runtime.sendMessage
  // to get data from extension storage
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage({ type: 'GET_BULK_IMPORT' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Extension error:', chrome.runtime.lastError);
        return;
      }
      if (response && response.mangaList) {
        // Send to page via postMessage
        window.postMessage({
          type: 'BULK_IMPORT_DATA',
          mangaList: response.mangaList
        }, '*');
      } else {
        console.log('No bulk import data found');
      }
    });
  } else {
    console.error('Chrome extension API not available');
  }
}

// Handle bulk import in background
async function handleBulkImport(mangaList, tabId) {
  const YOUREAD_URL = 'https://you-read-iota.vercel.app';
  
  console.log('handleBulkImport called:', { mangaCount: mangaList?.length, tabId });
  
  try {
    if (!mangaList || !Array.isArray(mangaList) || mangaList.length === 0) {
      throw new Error('Invalid manga list provided');
    }
    
    if (!tabId) {
      throw new Error('Tab ID is required');
    }
    
    console.log(`Starting bulk import for ${mangaList.length} manga from tab ${tabId}`);
    
    // Update status
    await chrome.storage.local.set({ 
      importStatus: '🔄 Starting import...',
      importTimestamp: Date.now()
    });
    
    // Import all pages
    const allManga = await importAllPagesBackground(tabId, mangaList);
    
    console.log(`Bulk import complete! Collected ${allManga.length} manga`);
    
    // Update status
    await chrome.storage.local.set({ 
      importStatus: `✓ Import complete! Collected ${allManga.length} manga`,
      importTimestamp: Date.now()
    });
    
    // Store all manga for website to pick up
    await chrome.storage.local.set({ 
      pendingBulkImport: allManga,
      bulkImportTimestamp: Date.now()
    });
    
    // Open YouRead website with import data
    if (allManga.length > 50) {
      chrome.tabs.create({ 
        url: `${YOUREAD_URL}?bulkImportFlag=true` 
      });
    } else {
      const importData = JSON.stringify(allManga);
      chrome.tabs.create({ 
        url: `${YOUREAD_URL}?bulkImport=${encodeURIComponent(importData)}` 
      });
    }
  } catch (error) {
    console.error('Error in bulk import:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    // Update status with error
    await chrome.storage.local.set({ 
      importStatus: `Error: ${errorMsg}`,
      importTimestamp: Date.now()
    });
    
    // Fallback: import what we have
    try {
      await chrome.storage.local.set({ 
        pendingBulkImport: mangaList,
        bulkImportTimestamp: Date.now()
      });
      chrome.tabs.create({ 
        url: `${YOUREAD_URL}?bulkImport=${encodeURIComponent(JSON.stringify(mangaList))}` 
      });
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
    }
  }
}

// Import all pages in background
async function importAllPagesBackground(tabId, mangaList, maxPages = 50) {
  console.log('importAllPagesBackground called with:', { tabId, mangaCount: mangaList.length, maxPages });
  
  try {
    // Verify tab exists
    const tab = await chrome.tabs.get(tabId);
    if (!tab) {
      throw new Error('Tab not found');
    }
    console.log('Tab found:', tab.url);
    
    const allManga = [...mangaList];
    let currentPage = 1;
    let hasMorePages = true;
    let consecutiveEmptyPages = 0;
    
    console.log(`Starting import from page ${currentPage} with ${mangaList.length} initial manga`);
    
    while (hasMorePages && currentPage < maxPages && consecutiveEmptyPages < 2) {
      try {
        console.log(`Processing page ${currentPage}...`);
        
        // Wait for page to be ready
        if (currentPage > 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Inject content script
        let scriptInjected = false;
        for (let injectRetry = 0; injectRetry < 5; injectRetry++) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tabId },
              files: ['content.js']
            });
            scriptInjected = true;
            console.log('Content script injected successfully');
            await new Promise(resolve => setTimeout(resolve, 2000));
            break;
          } catch (injectError) {
            console.log(`Content script injection attempt ${injectRetry + 1}/5:`, injectError.message);
            if (injectRetry < 4) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
        
        // Extract from current page
        console.log(`Extracting manga from page ${currentPage}...`);
        let response;
        let retries = 0;
        while (retries < 10) {
          try {
            const tabInfo = await chrome.tabs.get(tabId);
            if (!tabInfo) {
              throw new Error('Tab no longer exists');
            }
            
            response = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_HISTORY' });
            if (response && response.mangaList !== undefined) {
              console.log(`Extracted ${response.mangaList.length} manga from page ${currentPage}`);
              break;
            }
          } catch (err) {
            retries++;
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.log(`Retry ${retries}/10 for page ${currentPage}: ${errorMsg}`);
            
            if (retries < 10) {
              if (errorMsg.includes('Could not establish connection') || errorMsg.includes('Receiving end') || errorMsg.includes('message port closed')) {
                console.log('Connection error, re-injecting content script...');
                try {
                  await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content.js']
                  });
                  await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (reInjectError) {
                  console.log('Re-injection failed:', reInjectError.message);
                }
              }
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
              throw err;
            }
          }
        }
        
        if (response && response.mangaList && response.mangaList.length > 0) {
          const beforeCount = allManga.length;
          response.mangaList.forEach(manga => {
            if (!allManga.find(m => m.id === manga.id)) {
              allManga.push(manga);
            }
          });
          const newCount = allManga.length - beforeCount;
          consecutiveEmptyPages = 0;
          
          console.log(`Page ${currentPage}: Added ${newCount} new manga (${allManga.length} total)`);
          
          // Update status in storage
          await chrome.storage.local.set({ 
            importStatus: `📖 Page ${currentPage}: Found ${newCount} new manga (${allManga.length} total)`,
            importTimestamp: Date.now()
          });
        } else {
          consecutiveEmptyPages++;
          console.log(`Page ${currentPage}: No manga found (empty pages: ${consecutiveEmptyPages})`);
          if (consecutiveEmptyPages >= 2) {
            console.log('Two consecutive empty pages, stopping');
            hasMorePages = false;
            break;
          }
        }
        
        // Check for next page
        console.log(`Checking for next page after page ${currentPage}...`);
        let nextPageResponse;
        retries = 0;
        while (retries < 5) {
          try {
            nextPageResponse = await chrome.tabs.sendMessage(tabId, { type: 'GET_NEXT_PAGE_URL' });
            if (nextPageResponse) {
              break;
            }
          } catch (err) {
            retries++;
            if (retries < 5) {
              await new Promise(resolve => setTimeout(resolve, 1500));
            } else {
              throw err;
            }
          }
        }
        
        if (nextPageResponse && nextPageResponse.nextUrl) {
          console.log(`Navigating to page ${currentPage + 1}: ${nextPageResponse.nextUrl}`);
          
          await chrome.tabs.update(tabId, { url: nextPageResponse.nextUrl });
          currentPage++;
          
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Wait for tab to be ready
          let tabReady = false;
          let readyRetries = 0;
          while (!tabReady && readyRetries < 30) {
            try {
              const tabInfo = await chrome.tabs.get(tabId);
              if (tabInfo.status === 'complete') {
                if (tabInfo.url && tabInfo.url.includes('page=')) {
                  const urlPageMatch = tabInfo.url.match(/[?&]page=(\d+)/);
                  const urlPageNum = urlPageMatch ? parseInt(urlPageMatch[1], 10) : null;
                  if (urlPageNum === currentPage || tabInfo.url === nextPageResponse.nextUrl) {
                    tabReady = true;
                    console.log(`Page ${currentPage} loaded: ${tabInfo.url}`);
                  }
                }
              }
              if (!tabReady) {
                await new Promise(resolve => setTimeout(resolve, 500));
                readyRetries++;
              }
            } catch (e) {
              await new Promise(resolve => setTimeout(resolve, 500));
              readyRetries++;
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Re-inject content script
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tabId },
              files: ['content.js']
            });
            await new Promise(resolve => setTimeout(resolve, 1500));
          } catch (injectError) {
            console.log('Content script injection note:', injectError.message);
          }
        } else {
          console.log('No next page URL found, stopping pagination');
          hasMorePages = false;
        }
      } catch (error) {
        console.error(`Error on page ${currentPage}:`, error);
        consecutiveEmptyPages++;
        if (consecutiveEmptyPages >= 2) {
          console.log('Too many errors, stopping');
          hasMorePages = false;
        } else {
          currentPage++;
        }
      }
    }
    
    console.log(`Import complete! Total manga collected: ${allManga.length}`);
    return allManga;
  } catch (error) {
    console.error('Error importing all pages:', error);
    return mangaList;
  }
}


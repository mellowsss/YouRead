// Popup script for YouRead extension

const YOUREAD_URL = 'https://you-read-iota.vercel.app';

// Initialize popup
async function initPopup() {
  const statusDiv = document.getElementById('status');
  const mangaInfoDiv = document.getElementById('mangaInfo');
  const actionsDiv = document.getElementById('actions');

  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if we're on MangaNato
    if (tab.url?.includes('manganato')) {
      // Check if it's a bookmark or history page
      if (tab.url?.includes('/bookmark') || tab.url?.includes('/history')) {
        await showHistoryImport(tab, statusDiv, mangaInfoDiv, actionsDiv);
      } else {
        // Regular manga page
        const { lastDetectedManga } = await chrome.storage.local.get('lastDetectedManga');
        
        if (lastDetectedManga) {
          showMangaInfo(lastDetectedManga, mangaInfoDiv, actionsDiv);
          statusDiv.innerHTML = '<div class="status success">✓ Manga detected!</div>';
        } else {
          statusDiv.innerHTML = '<div class="status info">Scanning page for manga...</div>';
          mangaInfoDiv.innerHTML = '<div class="loading">Please wait...</div>';
          
          // Request content script to extract info
          chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_MANGA' }, (response) => {
            if (response && response.manga) {
              showMangaInfo(response.manga, mangaInfoDiv, actionsDiv);
              statusDiv.innerHTML = '<div class="status success">✓ Manga detected!</div>';
            } else {
              statusDiv.innerHTML = '<div class="status error">Could not detect manga on this page</div>';
              mangaInfoDiv.innerHTML = '<p style="color: #6b7280; font-size: 12px;">Make sure you\'re on a manga page (not a chapter page).</p>';
            }
          });
        }
      }
    } else {
      statusDiv.innerHTML = '<div class="status info">Visit a MangaNato manga page to track it</div>';
      actionsDiv.innerHTML = `
        <button class="button primary" id="openYouReadBtn2">
          Open YouRead
        </button>
      `;
      
      document.getElementById('openYouReadBtn2').addEventListener('click', () => {
        window.open(YOUREAD_URL, '_blank');
      });
    }
  } catch (error) {
    console.error('Error initializing popup:', error);
    statusDiv.innerHTML = '<div class="status error">Error loading extension</div>';
  }
}

// Show history import interface
async function showHistoryImport(tab, statusDiv, mangaInfoDiv, actionsDiv) {
  try {
    // Get detected history
    const { detectedHistory } = await chrome.storage.local.get('detectedHistory');
    
    if (detectedHistory && detectedHistory.length > 0) {
      statusDiv.innerHTML = `<div class="status success">✓ Found ${detectedHistory.length} manga on this page!</div>`;
      
      mangaInfoDiv.innerHTML = `
        <div class="manga-info">
          <h3>Ready to Import</h3>
          <p>Found <strong>${detectedHistory.length}</strong> manga with reading progress on this page</p>
          <p style="font-size: 11px; color: #9ca3af; margin-top: 8px;">
            Click "Import All Pages" to automatically collect manga from ALL pages of your bookmarks!
          </p>
        </div>
      `;
      
      actionsDiv.innerHTML = `
        <button class="button primary" id="importAllPages">
          Import All Pages (Auto-collect from all pages)
        </button>
        <button class="button secondary" id="importCurrentPage">
          Import This Page Only (${detectedHistory.length} manga)
        </button>
        <button class="button secondary" id="openYouReadFromHistory" style="margin-top: 8px;">
          Open YouRead
        </button>
      `;
      
      document.getElementById('importAllPages').addEventListener('click', async () => {
        // Update UI immediately
        const statusDiv = document.getElementById('status');
        if (statusDiv) {
          statusDiv.innerHTML = '<div class="status info">🔄 Starting import... This will continue in the background.</div>';
        }
        
        // Send message to background script to handle import
        // This ensures it continues even if popup closes
        chrome.runtime.sendMessage({
          type: 'START_BULK_IMPORT',
          mangaList: detectedHistory,
          tabId: tab.id
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending message to background:', chrome.runtime.lastError);
            // Fallback: try direct import
            if (statusDiv) {
              statusDiv.innerHTML = '<div class="status info">🔄 Using fallback method...</div>';
            }
            importHistoryToYouRead(detectedHistory, tab).catch(err => {
              console.error('Import error:', err);
              if (statusDiv) {
                statusDiv.innerHTML = '<div class="status error">Error: ' + (err.message || 'Unknown error') + '</div>';
              }
            });
          } else {
            console.log('Background import started:', response);
            if (statusDiv) {
              statusDiv.innerHTML = '<div class="status success">✓ Import started! This will continue in the background. You can close this popup.</div>';
            }
            // Don't close immediately - let user see the message
            setTimeout(() => {
              try {
                window.close();
              } catch (e) {
                // Already closed
              }
            }, 3000);
          }
        });
      });
      
      document.getElementById('importCurrentPage').addEventListener('click', async () => {
        await chrome.storage.local.set({ 
          pendingBulkImport: detectedHistory,
          bulkImportTimestamp: Date.now()
        });
        
        if (detectedHistory.length > 50) {
          chrome.tabs.create({ 
            url: `${YOUREAD_URL}?bulkImportFlag=true` 
          });
        } else {
          chrome.tabs.create({ 
            url: `${YOUREAD_URL}?bulkImport=${encodeURIComponent(JSON.stringify(detectedHistory))}` 
          });
        }
        window.close();
      });
      
      const openYouReadBtn = document.getElementById('openYouRead');
      if (openYouReadBtn) {
        openYouReadBtn.addEventListener('click', () => {
          window.open(YOUREAD_URL, '_blank');
        });
      }
      
      const openYouReadFromHistoryBtn = document.getElementById('openYouReadFromHistory');
      if (openYouReadFromHistoryBtn) {
        openYouReadFromHistoryBtn.addEventListener('click', () => {
          window.open(YOUREAD_URL, '_blank');
        });
      }
    } else {
      statusDiv.innerHTML = '<div class="status info">Scanning history page...</div>';
      mangaInfoDiv.innerHTML = '<div class="loading">Please wait...</div>';
      
      // Request content script to extract history directly
      try {
        // Ensure content script is injected
        let scriptInjected = false;
        for (let injectRetry = 0; injectRetry < 5; injectRetry++) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
            scriptInjected = true;
            console.log('Content script injected successfully');
            break;
          } catch (injectError) {
            console.log(`Content script injection attempt ${injectRetry + 1}/5:`, injectError.message);
            if (injectRetry < 4) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
        
        // Wait for content script to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        let response;
        let retries = 0;
        while (retries < 10) {
          try {
            response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_HISTORY' });
            if (response && response.mangaList !== undefined) {
              break;
            }
          } catch (err) {
            retries++;
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.log(`Retry ${retries}/10: ${errorMsg}`);
            
            if (retries < 10) {
              // Try re-injecting script if connection fails
              if (errorMsg.includes('Could not establish connection') || errorMsg.includes('Receiving end')) {
                console.log('Connection error, re-injecting content script...');
                try {
                  await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
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
          await chrome.storage.local.set({ detectedHistory: response.mangaList });
          showHistoryImport(tab, statusDiv, mangaInfoDiv, actionsDiv);
        } else {
          statusDiv.innerHTML = '<div class="status error">No manga found on this page</div>';
          mangaInfoDiv.innerHTML = '<p style="color: #6b7280; font-size: 12px;">Make sure you\'re logged in and on the MangaNato bookmark page: https://www.manganato.gg/bookmark</p>';
        }
      } catch (error) {
        console.error('Error extracting history:', error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        statusDiv.innerHTML = '<div class="status error">Error: Could not read bookmark page</div>';
        mangaInfoDiv.innerHTML = `<p style="color: #6b7280; font-size: 12px;">${errorMsg}. Please refresh the bookmark page and try again. Make sure you're logged into MangaNato.</p>`;
      }
    }
  } catch (error) {
    console.error('Error showing history import:', error);
    statusDiv.innerHTML = '<div class="status error">Error loading history</div>';
  }
}

// Import all pages of history
async function importAllPages(tab, mangaList, maxPages = 50) {
  try {
    const allManga = [...mangaList];
    let currentPage = 1;
    let hasMorePages = true;
    let consecutiveEmptyPages = 0;
    
    console.log(`Starting import from page ${currentPage} with ${mangaList.length} initial manga`);
    
    // Process first page (already have mangaList)
    // Then continue with remaining pages
    while (hasMorePages && currentPage < maxPages && consecutiveEmptyPages < 2) {
      try {
        console.log(`Processing page ${currentPage}...`);
        
        // Always ensure content script is injected before extracting
        console.log(`Ensuring content script is ready for page ${currentPage}...`);
        
        // Wait for page to be ready
        if (currentPage > 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Inject content script (always, to ensure it's ready)
        let scriptInjected = false;
        for (let injectRetry = 0; injectRetry < 5; injectRetry++) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
            scriptInjected = true;
            console.log('Content script injected successfully');
            // Wait for script to initialize
            await new Promise(resolve => setTimeout(resolve, 2000));
            break;
          } catch (injectError) {
            console.log(`Content script injection attempt ${injectRetry + 1}/5:`, injectError.message);
            if (injectRetry < 4) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
        
        if (!scriptInjected) {
          console.warn('Could not inject content script, but continuing...');
        }
        
        // Extract from current page
        console.log(`Extracting manga from page ${currentPage}...`);
        let response;
        let retries = 0;
        while (retries < 10) {
          try {
            // Check if tab is still valid
            const tabInfo = await chrome.tabs.get(tab.id);
            if (!tabInfo) {
              throw new Error('Tab no longer exists');
            }
            
            response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_HISTORY' });
            if (response && response.mangaList !== undefined) {
              console.log(`Extracted ${response.mangaList.length} manga from page ${currentPage}`);
              break;
            }
          } catch (err) {
            retries++;
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.log(`Retry ${retries}/10 for page ${currentPage}: ${errorMsg}`);
            
            if (retries < 10) {
              // Try re-injecting script if connection fails
              if (errorMsg.includes('Could not establish connection') || errorMsg.includes('Receiving end')) {
                console.log('Connection error, re-injecting content script...');
                try {
                  await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
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
          // Add new manga (avoid duplicates)
          const beforeCount = allManga.length;
          response.mangaList.forEach(manga => {
            if (!allManga.find(m => m.id === manga.id)) {
              allManga.push(manga);
            }
          });
          const newCount = allManga.length - beforeCount;
          consecutiveEmptyPages = 0; // Reset counter if we found manga
          
          console.log(`Page ${currentPage}: Added ${newCount} new manga (${allManga.length} total)`);
          
          // Update status if popup is still open
          try {
            const statusEl = document.getElementById('status');
            if (statusEl) {
              statusEl.innerHTML = `<div class="status info">📖 Page ${currentPage}: Found ${newCount} new manga (${allManga.length} total)</div>`;
            }
            // Also store in chrome.storage for background access
            await chrome.storage.local.set({ 
              importStatus: `📖 Page ${currentPage}: Found ${newCount} new manga (${allManga.length} total)`,
              importTimestamp: Date.now()
            });
          } catch (e) {
            // Popup might be closed, continue anyway
            console.log('Popup closed, continuing in background');
            // Still update storage
            try {
              await chrome.storage.local.set({ 
                importStatus: `📖 Page ${currentPage}: Found ${newCount} new manga (${allManga.length} total)`,
                importTimestamp: Date.now()
              });
            } catch (storageError) {
              // Ignore storage errors
            }
          }
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
        while (retries < 3) {
          try {
            nextPageResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_NEXT_PAGE_URL' });
            if (nextPageResponse) {
              break;
            }
          } catch (err) {
            retries++;
            if (retries < 3) {
              await new Promise(resolve => setTimeout(resolve, 1500));
            } else {
              throw err;
            }
          }
        }
        
        if (nextPageResponse && nextPageResponse.nextUrl) {
          console.log(`Navigating to page ${currentPage + 1}: ${nextPageResponse.nextUrl}`);
          
          // Navigate to next page
          await chrome.tabs.update(tab.id, { url: nextPageResponse.nextUrl });
          currentPage++;
          
          // Wait for navigation to start
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Wait for tab to be ready and URL to match
          let tabReady = false;
          let readyRetries = 0;
          while (!tabReady && readyRetries < 30) {
            try {
              const tabInfo = await chrome.tabs.get(tab.id);
              if (tabInfo.status === 'complete') {
                // Check if URL contains page parameter
                if (tabInfo.url && tabInfo.url.includes('page=')) {
                  const urlPageMatch = tabInfo.url.match(/[?&]page=(\d+)/);
                  const urlPageNum = urlPageMatch ? parseInt(urlPageMatch[1], 10) : null;
                  if (urlPageNum === currentPage || tabInfo.url === nextPageResponse.nextUrl) {
                    tabReady = true;
                    console.log(`Page ${currentPage} loaded: ${tabInfo.url}`);
                  } else {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    readyRetries++;
                  }
                } else {
                  await new Promise(resolve => setTimeout(resolve, 500));
                  readyRetries++;
                }
              } else {
                await new Promise(resolve => setTimeout(resolve, 500));
                readyRetries++;
              }
            } catch (e) {
              await new Promise(resolve => setTimeout(resolve, 500));
              readyRetries++;
            }
          }
          
          if (!tabReady) {
            console.warn(`Page ${currentPage} may not be fully loaded, but continuing...`);
          }
          
          // Additional wait for content to render
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Re-inject content script after navigation
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
            await new Promise(resolve => setTimeout(resolve, 1500));
          } catch (injectError) {
            console.log('Content script injection note:', injectError.message);
          }
          
          // Continue loop to process this new page
          console.log(`Continuing to process page ${currentPage}...`);
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
          // Try to continue to next page anyway
          console.log('Error occurred, but trying to continue...');
          currentPage++;
        }
      }
    }
    
    console.log(`Import complete! Total manga collected: ${allManga.length}`);
    return allManga;
  } catch (error) {
    console.error('Error importing all pages:', error);
    return mangaList; // Return what we have
  }
}

// Import history to YouRead
async function importHistoryToYouRead(mangaList, tab) {
  // Store status in chrome.storage so background can access it
  const updateStatus = async (message) => {
    try {
      await chrome.storage.local.set({ importStatus: message, importTimestamp: Date.now() });
    } catch (e) {
      console.log('Could not update status:', e);
    }
  };
  
  try {
    // Update status
    await updateStatus('🔄 Collecting manga from all pages... This may take a moment.');
    
    // Try to update popup if still open
    try {
      const statusDiv = document.getElementById('status');
      const mangaInfoDiv = document.getElementById('mangaInfo');
      if (statusDiv) {
        statusDiv.innerHTML = '<div class="status info">🔄 Collecting manga from all pages... This may take a moment.</div>';
      }
      if (mangaInfoDiv) {
        mangaInfoDiv.innerHTML = '<div class="loading">Please wait while we collect all your manga...</div>';
      }
    } catch (e) {
      // Popup might be closed, continue anyway
      console.log('Popup closed, continuing in background');
    }
    
    // Import all pages - this will continue even if popup closes
    const allManga = await importAllPages(tab, mangaList);
    
    await updateStatus(`✓ Collected ${allManga.length} manga from all pages!`);
    
    // Try to update popup if still open
    try {
      const statusDiv = document.getElementById('status');
      const mangaInfoDiv = document.getElementById('mangaInfo');
      if (statusDiv) {
        statusDiv.innerHTML = `<div class="status success">✓ Collected ${allManga.length} manga from all pages!</div>`;
      }
      if (mangaInfoDiv) {
        mangaInfoDiv.innerHTML = `<div class="manga-info"><h3>Ready to Import</h3><p>Found <strong>${allManga.length}</strong> total manga</p></div>`;
      }
    } catch (e) {
      // Popup closed, that's okay
    }
    
    // Store all manga for website to pick up
    await chrome.storage.local.set({ 
      pendingBulkImport: allManga,
      bulkImportTimestamp: Date.now()
    });
    
    // For large imports, use localStorage instead of URL (URLs have length limits)
    if (allManga.length > 50) {
      // Store in extension storage and use a flag
      chrome.tabs.create({ 
        url: `${YOUREAD_URL}?bulkImportFlag=true` 
      });
    } else {
      // For smaller imports, use URL parameter
      const importData = JSON.stringify(allManga);
      chrome.tabs.create({ 
        url: `${YOUREAD_URL}?bulkImport=${encodeURIComponent(importData)}` 
      });
    }
    
    // Close popup after a short delay (if still open)
    setTimeout(() => {
      try {
        window.close();
      } catch (e) {
        // Popup already closed
      }
    }, 1000);
  } catch (error) {
    console.error('Error importing history:', error);
    await updateStatus('Error collecting pages. Importing current page only.');
    
    // Try to update popup if still open
    try {
      const statusDiv = document.getElementById('status');
      if (statusDiv) {
        statusDiv.innerHTML = '<div class="status error">Error collecting pages. Importing current page only.</div>';
      }
    } catch (e) {
      // Popup closed
    }
    
    // Fallback: just import current page
    await chrome.storage.local.set({ 
      pendingBulkImport: mangaList,
      bulkImportTimestamp: Date.now()
    });
    chrome.tabs.create({ 
      url: `${YOUREAD_URL}?bulkImport=${encodeURIComponent(JSON.stringify(mangaList))}` 
    });
    setTimeout(() => {
      try {
        window.close();
      } catch (e) {
        // Popup already closed
      }
    }, 1000);
  }
}

// Show manga information
function showMangaInfo(manga, mangaInfoDiv, actionsDiv) {
  mangaInfoDiv.innerHTML = `
    <div class="manga-info">
      <h3>${manga.title}</h3>
      ${manga.author ? `<p>Author: ${manga.author}</p>` : ''}
      ${manga.chapters ? `<p>Chapters: ${manga.chapters}</p>` : ''}
      ${manga.status ? `<p>Status: ${manga.status}</p>` : ''}
    </div>
  `;

  actionsDiv.innerHTML = `
    <button class="button primary" id="addToYouRead">
      Add to YouRead
    </button>
    <button class="button secondary" id="openYouReadFromImport">
      Open YouRead
    </button>
  `;

  document.getElementById('addToYouRead').addEventListener('click', () => {
    addToYouRead(manga);
  });
  
  const openYouReadFromImportBtn = document.getElementById('openYouReadFromImport');
  if (openYouReadFromImportBtn) {
    openYouReadFromImportBtn.addEventListener('click', () => {
      window.open(YOUREAD_URL, '_blank');
    });
  }
}

// Add manga to YouRead
async function addToYouRead(manga) {
  try {
    // Store manga for website to pick up
    await chrome.storage.local.set({ pendingManga: manga });
    
    // Open YouRead website
    chrome.tabs.create({ 
      url: `${YOUREAD_URL}?manga=${encodeURIComponent(JSON.stringify(manga))}` 
    });
    
    // Close popup
    window.close();
  } catch (error) {
    console.error('Error adding to YouRead:', error);
    alert('Error adding manga. Please try opening YouRead manually.');
  }
}

// Initialize when popup opens
initPopup();


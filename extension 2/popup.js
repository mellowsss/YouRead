// Popup script for YouRead extension

const YOUREAD_URL = 'https://you-read-a9v7w7ug5-mellowsss-projects.vercel.app';

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
      // Get stored manga info
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
    } else {
      statusDiv.innerHTML = '<div class="status info">Visit a MangaNato manga page to track it</div>';
      actionsDiv.innerHTML = `
        <button class="button primary" onclick="window.open('${YOUREAD_URL}', '_blank')">
          Open YouRead
        </button>
      `;
    }
  } catch (error) {
    console.error('Error initializing popup:', error);
    statusDiv.innerHTML = '<div class="status error">Error loading extension</div>';
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
    <button class="button secondary" onclick="window.open('${YOUREAD_URL}', '_blank')">
      Open YouRead
    </button>
  `;

  document.getElementById('addToYouRead').addEventListener('click', () => {
    addToYouRead(manga);
  });
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


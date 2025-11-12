# YouRead Browser Extension

A browser extension that automatically detects manga you're reading on MangaNato and syncs it with your YouRead tracking website.

## Features

- 🔍 **Auto-Detection**: Automatically detects manga when you visit MangaNato pages
- 🔄 **Auto-Sync**: Seamlessly syncs detected manga to your YouRead library
- 📊 **Real-time Tracking**: See what manga you're reading in the extension popup
- 🎯 **One-Click Add**: Add manga to your tracking list with a single click

## Installation

### Chrome/Edge (Chromium-based browsers)

1. Download or clone this repository
2. Open Chrome/Edge and navigate to `chrome://extensions/` (or `edge://extensions/`)
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `extension` folder from this repository
6. The extension should now be installed!

### Firefox

1. Download or clone this repository
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox"
4. Click "Load Temporary Add-on"
5. Select the `manifest.json` file from the `extension` folder

## Configuration

Before using the extension, you need to update the YouRead website URL in the extension files:

1. Open `extension/background.js`
2. Update the `YOUREAD_URL` constant with your YouRead website URL:
   ```javascript
   const YOUREAD_URL = 'https://your-youread-url.vercel.app';
   ```

3. Do the same in:
   - `extension/content.js`
   - `extension/popup.js`

## Usage

1. **Visit a MangaNato manga page** (e.g., `https://www.manganato.gg/manga/...`)
2. The extension will automatically detect the manga
3. Click the extension icon to see the detected manga
4. Click "Add to YouRead" to sync it to your tracking list
5. The manga will be added to your YouRead library automatically!

## How It Works

1. **Content Script**: When you visit a MangaNato page, the content script extracts manga information (title, cover, chapters, etc.)

2. **Background Script**: The background script receives the manga data and stores it

3. **Popup**: The popup shows you the detected manga and lets you add it to YouRead

4. **Sync**: When you click "Add to YouRead", it opens your YouRead website with the manga data, which automatically adds it to your library

## Icons

The extension needs icons. You can:
- Create simple icons (16x16, 48x48, 128x128) and place them in `extension/icons/`
- Or use a placeholder icon generator

For now, create a simple icon or the extension will show a default puzzle piece icon.

## Troubleshooting

### Extension not detecting manga
- Make sure you're on a manga page (not a chapter page)
- Check that the extension has permission to access MangaNato
- Refresh the page after installing the extension

### Manga not syncing to YouRead
- Check that the `YOUREAD_URL` is correct in all extension files
- Make sure your YouRead website is accessible
- Check the browser console for errors

## Development

To modify the extension:

1. Make changes to the files in the `extension/` folder
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes

## Privacy

- The extension only accesses MangaNato pages
- Manga data is stored locally in your browser
- No data is sent to external servers except your own YouRead website
- All syncing happens between your browser and your YouRead website

## License

MIT


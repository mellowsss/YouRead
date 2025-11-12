# YouRead - Manga Tracker

A minimalistic, modern web application for tracking your manga reading progress. Search for manga, track your reading status, and manage your personal manga library.

## Features

- 🔍 **Search Manga**: Search for manga using the MangaDex API
- 📚 **Track Progress**: Keep track of chapters read and reading status
- 🎨 **Minimalistic Design**: Clean, modern UI with Tailwind CSS
- 💾 **Local Storage**: Your data is stored locally in your browser
- 📱 **Responsive**: Works on desktop, tablet, and mobile devices

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone or download this repository
2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Building for Production

To create a production build:

```bash
npm run build
```

The built files will be in the `dist` directory.

## Usage

1. **Search for Manga**: Use the search bar at the top to find manga titles
2. **Add to Library**: Click on a search result to add it to your tracked manga
3. **Update Progress**: Click the edit icon on any manga card to update:
   - Reading status (Reading, Completed, Paused, Planning)
   - Last read chapter
   - Total chapters
   - MangaNato URL (optional)
4. **Filter**: Use the filter tabs to view manga by status
5. **Remove**: Click the trash icon to remove manga from your list

## API

This application uses the [MangaDex API](https://api.mangadex.org/) for manga data. MangaDex is a free, open-source manga reader API that doesn't require authentication.

## Data Storage

All your tracked manga data is stored locally in your browser's localStorage. This means:
- Your data stays on your device
- No account or login required
- Data persists between sessions

## Technologies Used

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **MangaDex API** - Manga data source

## License

MIT


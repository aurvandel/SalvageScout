# SalvageScout Frontend

React + TypeScript + Vite web interface for browsing vehicle listings and managing admin settings.

## Overview

Single-page application (SPA) with two main sections:
- **Listing Browser** - View all scraped vehicles with AI-generated match scores
- **Admin Panel** - Configure search filters, evaluation criteria, LLM settings, and notifications

## Project Structure

```
src/
├── pages/
│   ├── ListingFeed.tsx      # Main listing browser with filtering
│   ├── ListingDetail.tsx    # Detailed vehicle view with score breakdown
│   └── admin/
│       ├── CriteriaPanel.tsx    # Manage evaluation criteria
│       ├── FilterPanel.tsx      # Search parameter configuration
│       ├── SettingsPanel.tsx    # LLM & notification config
│       └── AdminPanel.tsx       # Admin router
├── components/              # Reusable UI components
├── api/                     # Backend API client
├── App.tsx                  # Main app router
├── index.css                # Global styles
└── main.tsx                 # Entry point
```

## Pages

### ListingFeed
Displays paginated list of vehicle listings:
- Shows thumbnail, title, year/make/model, price, match score
- Filter by score range, price, condition
- Links to detailed view
- Responsive grid layout

### ListingDetail
Shows complete vehicle information:
- Full listing details and images
- AI match score breakdown (pros/cons/dealbreaker flags)
- Related listings (same make/model)
- Summary of evaluation criteria used

### AdminPanel
Dashboard for system configuration with tabs:
- **Search Filters** - Set marketplace search parameters (location, price range, etc.)
- **Criteria Profiles** - Define how LLM evaluates vehicles (importance, preferences, etc.)
- **Settings** - Configure LLM provider (Claude/GPT/Gemini), API keys, webhook URLs
- **Test Notification** - Send test alerts to verify Discord/Telegram setup

## Development

### Setup

```bash
npm install
npm run dev   # Start dev server at http://localhost:5173
```

### Environment

By default, frontend assumes backend at `http://localhost:8000`.
Configure via `src/api/client.ts` if needed.

### Commands

```bash
npm run dev       # Development server with HMR
npm run build     # Build for production
npm run preview   # Preview production build
npm run lint      # Run Oxlint linter
```

### Styling

Global styles in `index.css` use CSS Grid/Flexbox for responsive layouts.
Component-specific styles co-located with components (e.g., `ListingFeed.tsx` + `ListingFeed.css`).

## API Client

Located in `src/api/`:
- Fetches from backend (`/api/*` routes)
- Handles authentication (if needed)
- Request/response types based on backend schemas

### Common API Calls

```typescript
// List listings
GET /api/listings?page=1&limit=20

// Get listing detail
GET /api/listings/{id}

// Get search filters
GET /api/search-filters

// Update criteria profile
PUT /api/criteria-profiles/{id}

// Update LLM settings
PATCH /api/admin/settings/app

// Trigger scrape
POST /api/pipeline/scrape
```

## Key Features

- **Real-time Filtering** - Filter listings by score, price, condition without page reload
- **Image Gallery** - View multiple vehicle photos (served from backend `/media` directory)
- **Responsive Design** - Works on desktop, tablet, mobile
- **Admin Dashboard** - Change evaluation criteria and settings without redeployment
- **Notifications** - Configure and test Discord/Telegram alerts

## Deployment

### Docker Build

```bash
docker build -t salvagescout-frontend .
```

### Production

Built by `docker-compose up`, serves via Nginx on port 3000.
Frontend is static HTML/CSS/JS; all state managed via backend API.

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- TypeScript for type safety
- Vite for fast dev builds

## Performance

- Code splitting by route (React Router lazy loading)
- Image lazy loading for vehicle photos
- Efficient list virtualization for large listing counts (if added)

## Troubleshooting

**Cannot connect to backend**
- Ensure backend is running: `curl http://localhost:8000/health`
- Check backend URL in `src/api/client.ts`
- Check CORS headers if running on different port/domain

**Images not loading**
- Verify backend `/media` directory is accessible
- Check image paths in API responses
- Inspect network tab for 404s

**UI not responding**
- Clear browser cache and do hard refresh (Cmd/Ctrl + Shift + R)
- Check console for JavaScript errors
- Verify backend is healthy with `/health` endpoint

## Stack

- **Framework**: React 18+ with Hooks
- **Build Tool**: Vite
- **Language**: TypeScript
- **Routing**: React Router
- **Styling**: CSS Grid/Flexbox
- **Linting**: Oxlint
- **HTTP**: Native Fetch API

## Contributing

See main [README.md](../README.md) and [CLAUDE.md](../CLAUDE.md) for guidelines.

# SalvageScout

Scrape, score and source the best budget beaters on Facebook Marketplace using AI.

SalvageScout is an automated pipeline that fetches vehicle listings from Facebook Marketplace, evaluates them against custom criteria using an LLM to generate match scores, and sends real-time alerts for high-scoring deals via Discord or Telegram.

## Features

- **Automated Scraping**: Uses Apify API to reliably fetch listings from Facebook Marketplace
- **AI Scoring**: Evaluates listings against custom criteria using Claude, GPT, or Gemini
- **Real-time Alerts**: Sends notifications to Discord/Telegram for promising deals
- **Admin Dashboard**: Web UI to configure search filters, evaluation criteria, and notification settings
- **Listing Browser**: Browse all scraped listings with detailed scores and images
- **Cost-Optimized**: Designed for under $20/month in platform costs

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Python 3.10+ (for local development)
- Node.js 18+ (for frontend development)
- API Keys:
  - [Apify](https://apify.com) for Facebook Marketplace scraping
  - [Anthropic](https://anthropic.com) (or OpenAI/Google) for LLM scoring

### Using Docker Compose

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 2. Start all services
docker-compose up

# 3. Access the application
# Frontend: http://localhost:3000
# API: http://localhost:8000
# Database: localhost:5432
```

The Docker Compose setup includes:
- PostgreSQL database
- FastAPI backend (with auto-migrations)
- React frontend
- Scheduler service (for periodic scraping)

### Local Development

#### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt

# Run API
python -m uvicorn app.main:app --reload

# Run tests
pytest

# Create database migration
alembic revision --autogenerate -m "description"
alembic upgrade head
```

#### Frontend
```bash
cd frontend
npm install
npm run dev   # Start dev server with hot reload
npm run build # Build for production
npm run lint  # Lint code
```

## API Endpoints

### Listings
- `GET /api/listings` - Fetch all listings with optional filtering
- `GET /api/listings/{id}` - Get listing details with score breakdown
- `GET /api/listings/{id}/related` - Get related listings

### Search & Filtering
- `GET /api/search-filters` - Get available search filters
- `POST /api/search-filters` - Create/update search filters

### Scoring & Criteria
- `GET /api/criteria-profiles` - Get evaluation criteria profiles
- `POST /api/criteria-profiles` - Create/update criteria profiles

### Admin Settings
- `GET /api/admin/settings` - Get current app settings
- `PATCH /api/admin/settings` - Update settings (LLM config, notifications, etc.)
- `POST /api/admin/test-notification` - Send test alert

### Pipeline
- `POST /api/pipeline/scrape` - Trigger immediate scrape job
- `GET /api/pipeline/status` - Get last scrape status

## Configuration

All settings can be configured via environment variables or through the admin dashboard:

- **LLM**: Choose between Claude, GPT, or Gemini; set model name and API key
- **Notification**: Configure Discord/Telegram webhooks
- **Scraping**: Adjust frequency and parameters (set via scheduler config)
- **Scoring**: Change evaluation criteria and match thresholds

## Database Schema

Key entities:
- `listings` - Raw vehicle data from Apify
- `scores` - LLM-generated match scores with breakdown (pros/cons/flags)
- `criteria_profiles` - Custom evaluation instructions for LLM
- `search_filters` - Marketplace search parameters
- `listing_images` - Image data for vehicles
- `notification_logs` - History of sent alerts
- `app_settings` - Global configuration

Migrations are auto-applied on backend startup.

## Project Structure

```
SalvageScout/
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── api/               # API endpoints
│   │   ├── models/            # SQLAlchemy ORM models
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── scraper/           # Apify integration & parsing
│   │   ├── scorer/            # LLM-based scoring logic
│   │   ├── notifier/          # Discord/Telegram notifications
│   │   ├── main.py            # FastAPI app setup
│   │   ├── scheduler.py       # APScheduler for background jobs
│   │   ├── config.py          # Settings & configuration
│   │   └── db.py              # Database session management
│   ├── alembic/               # Database migrations
│   ├── tests/                 # Test suite
│   ├── requirements.txt       # Production dependencies
│   └── Dockerfile
├── frontend/                   # React + TypeScript + Vite
│   ├── src/
│   │   ├── pages/             # React pages
│   │   ├── components/        # Reusable UI components
│   │   ├── api/               # API client
│   │   ├── App.tsx            # Main component
│   │   └── main.tsx           # Entry point
│   └── Dockerfile
├── docker-compose.yml         # Multi-service orchestration
└── CLAUDE.md                  # Development guidelines
```

## Development Workflow

1. Create a feature branch for changes: `git checkout -b feature/my-change`
2. Make changes in backend `/app`, frontend `/src`, or both
3. Test locally with `docker-compose up` or individual dev servers
4. Run tests: `pytest` (backend) or `npm run lint` (frontend)
5. Commit and push changes
6. See [CLAUDE.md](CLAUDE.md) for detailed development setup

## Troubleshooting

### Database connection fails
- Ensure PostgreSQL is running: `docker-compose ps`
- Check DATABASE_URL in .env matches docker-compose settings

### Scraper rate limits
- Apify may throttle requests; adjust `incremental_run` settings in scheduler config
- Monitor Apify dashboard for quota usage

### LLM API errors
- Verify API keys in .env and admin settings
- Check model name matches available models (e.g., `claude-3-5-sonnet-20241022`)
- Review API rate limits and quota

### Frontend doesn't load
- Clear browser cache and check http://localhost:3000
- Verify backend is healthy: `curl http://localhost:8000/health`

## Contributing

See [CLAUDE.md](CLAUDE.md) for development guidelines and architecture decisions.

## License

See [LICENSE](LICENSE)

# SalvageScout Backend

FastAPI application for scraping Facebook Marketplace, scoring listings with LLM, and managing notifications.

## Architecture

### Core Services

**Scraper** (`app/scraper/`)
- `apify_client.py` - Apify API integration for fetching listings
- `parser.py` - Extracts structured data from raw listings
- `normalize.py` - Normalizes vehicle data (title, year, make, model, price, description)
- `ingest.py` - Deduplication and database insertion logic
- `images.py` - Downloads and stores vehicle images locally
- `url_builder.py` - Builds Facebook Marketplace search URLs

**Scorer** (`app/scorer/`)
- Abstract scorer interface for pluggable implementations
- `anthropic_scorer.py` - Uses Claude API for evaluation
- Additional scorers for OpenAI/Google (pattern available for extension)
- Generates structured output: match_score, summary, pros, cons, dealbreaker_flags

**Notifier** (`app/notifier/`)
- Discord webhook integration
- Telegram bot integration
- Notification registry for managing multiple channels
- Logs notification history

**Scheduler** (`app/scheduler.py`, `app/config.py`)
- APScheduler-based background job runner
- Configurable scrape frequency
- Manages scheduler state in database

### API Endpoints (`app/api/`)

**listings.py**
- `GET /api/listings` - List all listings with optional filters/pagination
- `GET /api/listings/{id}` - Get listing details with scoring breakdown
- `GET /api/listings/{id}/related` - Find related listings (same make/model/year)

**search_filters.py**
- `GET /api/search-filters` - Retrieve current search parameters
- `PUT /api/search-filters` - Update search filters (location, price range, etc.)

**criteria_profiles.py**
- `GET /api/criteria-profiles` - List evaluation criteria
- `POST /api/criteria-profiles` - Create new criteria profile
- `PUT /api/criteria-profiles/{id}` - Update criteria profile

**admin.py**
- `GET /api/admin/settings` - Fetch all app settings (LLM, notifications, scheduler)
- `PATCH /api/admin/settings` - Update settings
- `POST /api/admin/test-notification` - Send test alert
- `GET /api/admin/settings/app` - Get LLM/notification config
- `PATCH /api/admin/settings/app` - Update LLM/notification config
- `GET /api/admin/settings/scheduler` - Get scheduler configuration
- `PATCH /api/admin/settings/scheduler` - Update scheduler configuration

**pipeline.py**
- `POST /api/pipeline/scrape` - Trigger manual scrape job
- `GET /api/pipeline/status` - Get last scrape job status

### Models (`app/models/`)

- **Listing** - Vehicle listing from Apify (title, url, price, description, etc.)
- **Score** - LLM evaluation result with match_score and reasoning
- **ListingImage** - Vehicle images with blob storage
- **CriteriaProfile** - Custom evaluation instructions for LLM
- **SearchFilter** - Marketplace search parameters (location, price range, etc.)
- **AppSettings** - Global config for LLM provider, API keys, notification webhooks
- **SchedulerConfig** - Scrape job frequency and parameters
- **NotificationLog** - Record of sent alerts
- **ArenaRun** - Test/experiment run data

### Database (`app/db.py`)

- SQLAlchemy session management
- Connection pooling
- Transaction handling

### Configuration (`app/config.py`)

Settings loaded from `.env`:
- Apify credentials
- LLM provider & API keys
- Notification webhooks
- Database connection
- Image storage directory
- Logging configuration

## Development

### Setup

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt
```

### Environment

Copy `.env.example` to `.env` and populate:
```
APIFY_API_TOKEN=your_token
CLAUDE_API_KEY=your_key
DATABASE_URL=postgresql://user:pass@localhost:5432/salvagescout
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### Running

```bash
# Development (with auto-reload)
python -m uvicorn app.main:app --reload

# Or run via Docker
docker-compose up backend

# Database migrations
alembic upgrade head

# Create new migration
alembic revision --autogenerate -m "description"
```

### Testing

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_scorer_service.py

# Run with coverage
pytest --cov=app tests/

# Run only unit tests (no integration tests)
pytest -m "not integration"
```

### Project Layout

```
backend/
├── app/
│   ├── api/                 # API endpoints
│   ├── models/              # SQLAlchemy models
│   ├── schemas/             # Pydantic request/response schemas
│   ├── scraper/             # Apify integration & parsing
│   ├── scorer/              # LLM scoring implementations
│   ├── notifier/            # Notification handlers
│   ├── main.py              # FastAPI app
│   ├── scheduler.py         # Background job runner
│   ├── config.py            # Settings
│   ├── db.py                # Database session
│   ├── pipeline.py          # Orchestration logic
│   └── settings_service.py  # Settings CRUD
├── alembic/
│   ├── versions/            # Migration files (auto-generated)
│   └── env.py               # Migration configuration
├── tests/
│   ├── fixtures/            # Test data
│   ├── conftest.py          # Pytest configuration
│   ├── test_*.py            # Test modules
├── requirements.txt         # Production dependencies
├── requirements-dev.txt     # Development dependencies
└── Dockerfile
```

## Key Dependencies

- **FastAPI** - Web framework
- **SQLAlchemy** - ORM
- **Alembic** - Database migrations
- **Psycopg** - PostgreSQL driver
- **Pydantic** - Data validation
- **APScheduler** - Background job scheduling
- **Apify** - Scraping API client
- **Anthropic** - Claude API client
- **httpx** - HTTP client for webhooks

## Common Tasks

### Adding a New API Endpoint

1. Create schema in `app/schemas/my_schema.py`
2. Create model in `app/models/my_model.py` if needed
3. Create migration: `alembic revision --autogenerate -m "Add my_model table"`
4. Create router in `app/api/my_api.py`
5. Include router in `app/main.py`
6. Add tests in `tests/test_api_my_api.py`

### Adding a New Scorer

1. Extend `app/scorer/base.py` base class
2. Implement `score()` method
3. Add to scorer factory/registry if needed
4. Add configuration to AppSettings model
5. Write tests

### Modifying Database Schema

1. Make changes to models in `app/models/`
2. Create migration: `alembic revision --autogenerate -m "description"`
3. Review auto-generated migration for correctness
4. Run: `alembic upgrade head`
5. Test with `pytest`

## Performance Notes

- Listings are deduplicated by Apify URL to avoid re-scoring
- Images are cached locally to reduce bandwidth
- LLM scoring is done asynchronously by scheduler
- Database queries use indexed columns (url, created_at)

## Troubleshooting

**Database connection fails**
- Check DATABASE_URL format
- Ensure PostgreSQL is running and credentials are correct
- Run migrations: `alembic upgrade head`

**Apify API errors**
- Verify APIFY_API_TOKEN is set correctly
- Check Apify quota usage in dashboard
- Review Apify logs for specific errors

**LLM scoring fails**
- Ensure API key is configured in settings
- Verify model name is available for selected provider
- Check rate limits and quota

**Scheduler not running**
- Verify scheduler service started: `docker-compose ps`
- Check logs: `docker-compose logs scheduler`
- Ensure DATABASE_URL is set correctly

## Contributing

See main [README.md](../README.md) and [CLAUDE.md](../CLAUDE.md) for guidelines.

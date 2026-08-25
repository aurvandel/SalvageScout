# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SalvageScout** is an automated pipeline that scrapes Facebook Marketplace for vehicle listings, evaluates them against custom criteria using an LLM to generate an AI match score, and sends alerts for high-scoring deals. The project has a working backend (FastAPI), frontend (React), database (PostgreSQL), and scheduler.

## Current Architecture

### Backend
- **Framework**: FastAPI with SQLAlchemy ORM and Alembic migrations
- **Database**: PostgreSQL (runs in Docker)
- **Core Components**:
  - **Scraper**: Apify API integration to fetch listings from Facebook Marketplace
  - **Parser**: Normalizes and validates listing data
  - **Scorer**: Multiple LLM implementations (Anthropic Claude, OpenAI, Google Gemini)
  - **Notifier**: Sends alerts via Discord/Telegram
  - **Scheduler**: APScheduler for periodic scraping jobs
  - **API**: RESTful endpoints for listings, search filters, criteria profiles, admin settings, pipeline control

### Frontend
- **Framework**: React + TypeScript + Vite
- **Pages**:
  - **ListingFeed**: Displays all scraped listings with scores
  - **ListingDetail**: Shows detailed vehicle information with scoring breakdown
  - **AdminPanel**: Manage criteria profiles, search filters, app settings, LLM config, notifications
- **Data**: Fetches from backend API

### Deployment
- **Docker Compose**: Orchestrates PostgreSQL, backend API, frontend, and scheduler services
- **Local Dev Access**: http://192.168.86.35:3000 or http://localhost:3000

## Development Setup

### Prerequisites
- Python 3.10+ (backend)
- Node.js 18+ (frontend)
- PostgreSQL 16 (runs in Docker)
- API Keys: Apify, Anthropic (or OpenAI/Google if using those scorers)

### Running the Stack
```bash
docker-compose up
```
This starts:
- PostgreSQL on port 5432
- FastAPI backend on port 8000
- React frontend on port 3000
- Scheduler service (runs background jobs)

### Backend Development
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt
pytest                          # Run tests
python -m uvicorn app.main:app  # Run API locally
alembic revision --autogenerate -m "message"  # Create migration
alembic upgrade head             # Apply migrations
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev          # Start dev server with HMR
npm run build        # Build for production
npm run lint         # Run linter
```

### Key Environment Variables
- `APIFY_API_TOKEN`: Apify account API token
- `CLAUDE_API_KEY`: Anthropic API key for scoring
- `OPENAI_API_KEY`: OpenAI key (if using GPT scorer)
- `GOOGLE_API_KEY`: Google key (if using Gemini scorer)
- `DATABASE_URL`: PostgreSQL connection string
- `DISCORD_WEBHOOK_URL` / `TELEGRAM_BOT_TOKEN`: For notifications

## Architecture Decisions

- **Cost Optimization**: Uses Apify for robust scraping (handles anti-bot) with incremental daily runs instead of bulk scraping
- **Multiple Scorers**: Pluggable scorer architecture allows swapping between Claude, GPT, or Gemini
- **Scalability**: Scheduler runs as separate service; can be distributed
- **Admin UI**: No need to redeploy to change scoring criteria, filters, or notification settings

## Testing

- Unit tests for scorer logic, parser, normalizer, URL builder
- Integration tests for full pipeline
- Tests for API endpoints and services
- Run with: `pytest` (from backend directory)

## Known Constraints

- Apify costs ~$10-20/month for production volume
- Remote development workflow (accessed via iPad/Coder)
- AI evaluation must be fast and consistent for real-time scoring

## Development Workflow

Leverage the feature branch skill for all changes. A new branch should be created for each chat.

**Standard workflow:**
1. Create a feature branch at the start
2. Make changes and commit (with clear commit messages)
3. When ready to publish, use the `publish-pr` skill to create and open a PR

```
/publish-pr
```

PRs are created on-demand once you're satisfied with the work. The skill handles pushing, PR creation, and returns the PR URL.
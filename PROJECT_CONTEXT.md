# SalvageScout: Facebook Marketplace Car Matcher

## Project Overview
We are building an automated pipeline named **SalvageScout** that scrapes Facebook Marketplace for vehicle listings, evaluates them against specific custom criteria using an LLM to generate an AI match score, and sends alerts for high-scoring deals.

## Technical Architecture & Decisions Made

### Data Collection
- **Tool:** Apify API (`parseforge/facebook-marketplace-scraper`) to bypass Facebook's anti-bot protections
- **Cost Optimization Strategy:** 
  - Initial bulk pull of ~200 listings
  - Incremental daily runs of ~15 new listings
  - Basic listing enrichment rather than expensive deep vehicle specs
  - Target monthly platform costs: ~$10–$20

### Development Environment
- **Setup:** Remote development server accessed via iPad
- **Tools:** Coder / remote VS Code / containerized setup
- **AI Integration:** Claude Code subscription tied to remote terminal/development environment, allowing AI coding agent to assist with Python scripts, database layer, front-end and API integrations

### Core Pipeline Components

1. **Python Scraper Script**
   - Fetches new listings from Apify API
   - Handles deduplication and data validation

2. **Database Layer**
   - Local database (PostgreSQL/Supabase)
   - Deduplication logic
   - Structured data storage for listings and scores

3. **LLM Evaluation Engine**
   - Evaluates listings against custom criteria
   - Outputs structured JSON response containing:
     - `match_score`: Numerical score
     - `summary`: Human-readable evaluation
     - `pros`: List of positive attributes
     - `cons`: List of negative attributes
     - `dealbreaker_flags`: Critical issues that disqualify listings

4. **Notification System**
   - Webhook integration (Discord/Telegram)
   - Alerts triggered for cars scoring above designated threshold
   - Real-time notifications to user

5. **Web Application**
   - Display all search results and scoring results
   - Show vehicle pictures without increasing API scraping costs if possible
   - Admin section to:
     - Update evaluation prompts
     - Manage search filters
     - Adjust scoring weights
     - Manage notifications

## Key Technical Constraints
- Cost efficiency is critical (under $20/month for platform costs)
- Anti-bot protection requires robust scraping approach
- Remote development workflow requires careful context management
- AI evaluation must be fast and consistent

## Next Steps
- Implement core scraper and deduplication logic
- Set up local database schema
- Create LLM evaluation prompt and JSON output structure
- Build notification webhook integration
- Develop web UI for results display and admin panel

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SalvageScout** is a tool to scrape, score, and source the best budget beaters on Facebook Marketplace using AI. The project is in early stages with skeleton files (README, LICENSE) and no implementation yet.

## Architecture (To Be Developed)

The system should comprise these main components:

- **Scraper**: Fetch listings from Facebook Marketplace (respecting robots.txt and API terms)
- **Processor**: Extract and normalize listing data (title, price, images, descriptions)
- **Scorer**: Use AI (Claude API or similar) to evaluate deals and assign quality/value scores
- **Storage**: Persist listings and scores (database TBD)
- **API/Interface**: Expose results via API or web UI

Key decisions to make early:
- Data storage: database choice (PostgreSQL, MongoDB, etc.)
- Scraping approach: official API vs. web scraping (check Facebook's terms)
- AI integration: which Claude model and prompting strategy for scoring
- Deployment: cloud platform, scheduling for periodic scrapes

## Development Setup (To Be Added)

As the project develops, document:
- How to install dependencies
- Environment variables needed (API keys, database config)
- Commands to run: `npm test`, `npm run build`, `npm start`, etc.
- How to run individual tests or lint checks
- Database migrations (if applicable)
- How to test the scraper/scorer locally

## Key Notes for Future Implementation

- **Ethical scraping**: Ensure compliance with Facebook's terms of service and robots.txt
- **Rate limiting**: Implement delays between requests to avoid blocking
- **Error handling**: Gracefully handle missing data, network failures, API rate limits
- **Testing strategy**: Unit tests for scorer logic, integration tests for scraper reliability
- **Deployment**: Set up CI/CD pipeline; schedule scraper jobs (cron or cloud scheduler)


The site can be reached locally at 192.168.86.35:3000
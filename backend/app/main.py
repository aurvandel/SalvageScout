from fastapi import FastAPI

from app.api import criteria_profiles, listings, pipeline, search_filters

app = FastAPI(title="SalvageScout")

app.include_router(listings.router, prefix="/api/listings", tags=["listings"])
app.include_router(search_filters.router, prefix="/api/search-filters", tags=["search-filters"])
app.include_router(criteria_profiles.router, prefix="/api/criteria-profiles", tags=["criteria-profiles"])
app.include_router(pipeline.router, prefix="/api/pipeline", tags=["pipeline"])


@app.get("/health")
def health():
    return {"status": "ok"}

import logging

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api import admin, criteria_profiles, listings, pipeline, search_filters
from app.config import settings

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="SalvageScout")

app.mount(
    "/media",
    StaticFiles(directory=settings.image_storage_dir, check_dir=False),
    name="media",
)

app.include_router(listings.router, prefix="/api/listings", tags=["listings"])
app.include_router(search_filters.router, prefix="/api/search-filters", tags=["search-filters"])
app.include_router(criteria_profiles.router, prefix="/api/criteria-profiles", tags=["criteria-profiles"])
app.include_router(pipeline.router, prefix="/api/pipeline", tags=["pipeline"])
app.include_router(admin.router, prefix="/api", tags=["admin"])


@app.get("/health")
def health():
    return {"status": "ok"}

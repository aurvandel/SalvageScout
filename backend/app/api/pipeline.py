import dataclasses

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import SearchFilter
from app.pipeline import run_pipeline_for_filter
from app.schemas.pipeline import PipelineRunOut

router = APIRouter()


@router.post("/run/{search_filter_id}", response_model=PipelineRunOut)
def run_pipeline(search_filter_id: int, results_limit: int = 20, db: Session = Depends(get_db)):
    search_filter = db.get(SearchFilter, search_filter_id)
    if search_filter is None:
        raise HTTPException(status_code=404, detail="Search filter not found")

    try:
        result = run_pipeline_for_filter(db, search_filter, results_limit=results_limit)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return dataclasses.asdict(result)

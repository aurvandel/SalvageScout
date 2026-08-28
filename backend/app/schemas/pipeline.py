from pydantic import BaseModel


class PipelineRunOut(BaseModel):
    listings_processed: int
    scores_created: int
    notifications_sent: int
    new_listings: int = 0

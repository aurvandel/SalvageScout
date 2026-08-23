from pydantic import BaseModel, ConfigDict


class SearchFilterIn(BaseModel):
    name: str
    search_url: str
    is_active: bool = True


class SearchFilterOut(SearchFilterIn):
    model_config = ConfigDict(from_attributes=True)

    id: int

from pydantic import BaseModel

class TagIn(BaseModel):
    name: str
    color: str = "#84cc16"

class TagOut(BaseModel):
    id: str
    name: str
    color: str
    household_id: str

    model_config = {"from_attributes": True}

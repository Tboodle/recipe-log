from pydantic import BaseModel

class TagIn(BaseModel):
    name: str
    category: str = "custom"

class TagOut(BaseModel):
    id: str
    name: str
    category: str
    color: str
    household_id: str

    model_config = {"from_attributes": True}

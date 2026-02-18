import uuid
from datetime import datetime, UTC
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class Household(Base):
    __tablename__ = "households"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    users: Mapped[list["User"]] = relationship(back_populates="household")
    recipes: Mapped[list["Recipe"]] = relationship(back_populates="household")
    tags: Mapped[list["Tag"]] = relationship(back_populates="household")
    shopping_lists: Mapped[list["ShoppingList"]] = relationship(back_populates="household")

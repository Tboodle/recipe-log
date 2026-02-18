import uuid
from datetime import datetime, UTC
from sqlalchemy import String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class ShoppingList(Base):
    __tablename__ = "shopping_lists"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(String, ForeignKey("households.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    household: Mapped["Household"] = relationship(back_populates="shopping_lists")
    items: Mapped[list["ShoppingItem"]] = relationship(back_populates="list", cascade="all, delete-orphan")

class ShoppingItem(Base):
    __tablename__ = "shopping_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    list_id: Mapped[str] = mapped_column(String, ForeignKey("shopping_lists.id"), nullable=False)
    recipe_id: Mapped[str | None] = mapped_column(String, ForeignKey("recipes.id"), nullable=True)
    ingredient_name: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[str | None] = mapped_column(String(100), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(100), nullable=True)
    checked: Mapped[bool] = mapped_column(Boolean, default=False)

    list: Mapped["ShoppingList"] = relationship(back_populates="items")

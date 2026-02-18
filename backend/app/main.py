from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, recipes, tags, import_

app = FastAPI(title="Recipe Log", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(recipes.router)
app.include_router(tags.router)
app.include_router(import_.router)

@app.get("/api/health")
async def health():
    return {"status": "ok"}

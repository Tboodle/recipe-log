# Recipe Log

A self-hosted recipe manager with AI-powered import (photos, URLs, text), shopping list generation with unit-aware combining, and cook mode.

**Stack:** FastAPI + PostgreSQL backend · React + Vite frontend · Nginx reverse proxy · Docker

---

## Table of Contents

- [Local Development](#local-development)
- [Docker (Production)](#docker-production)
- [Deploying to AWS ECS](#deploying-to-aws-ecs)
- [Environment Variables](#environment-variables)

---

## Local Development

### Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL 14+ running locally

### Quick start (recommended)

```bash
git clone <repo-url>
cd recipe-log
./dev.sh
```

`dev.sh` handles everything automatically:
1. Creates a Python virtualenv and installs backend dependencies
2. Creates `backend/.env` with sensible local defaults if one doesn't exist
3. Runs Alembic database migrations
4. Installs frontend Node dependencies
5. Starts the FastAPI server (port 8000) and Vite dev server (port 5173) concurrently

Once running:
- **Frontend:** http://localhost:5173
- **API docs:** http://localhost:8000/docs

### Manual setup

If you prefer to run services individually:

**Backend:**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .

cp .env.example .env
# Edit .env — set DATABASE_URL and JWT_SECRET at minimum

alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

### Running tests

```bash
# Backend unit + integration tests
cd backend
source .venv/bin/activate
pytest tests/ -v

# Frontend type-check
cd frontend
npx tsc --noEmit

# End-to-end (requires both servers running)
cd e2e
npx playwright test
```

---

## Docker (Production)

The project ships with a `docker-compose.yml` that runs three containers:

| Container | Image | Purpose |
|-----------|-------|---------|
| `db` | postgres:16-alpine | PostgreSQL database |
| `api` | built from `./backend/Dockerfile` | FastAPI app |
| `web` | built from `./frontend/Dockerfile` | React app + Nginx reverse proxy |

### Start with Docker Compose

```bash
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD, JWT_SECRET, and any optional keys

docker compose up --build
```

The app will be available at http://localhost (port 80 by default; set `PORT` in `.env` to change).

Migrations run automatically on container startup via the `api` service entrypoint.

### Build images individually

```bash
# Backend
docker build -t recipe-log-api ./backend

# Frontend + Nginx
docker build -t recipe-log-web -f frontend/Dockerfile .
```

---

## Deploying to AWS ECS

This guide uses **Amazon ECR** (Elastic Container Registry) to store images and **ECS Fargate** to run them. You'll need the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) installed and configured.

### 1. Create ECR repositories

```bash
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws ecr create-repository --repository-name recipe-log/api --region $AWS_REGION
aws ecr create-repository --repository-name recipe-log/web --region $AWS_REGION
```

### 2. Authenticate Docker to ECR

```bash
aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin \
    $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
```

### 3. Build and push images

```bash
API_IMAGE=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/recipe-log/api:latest
WEB_IMAGE=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/recipe-log/web:latest

# Build (add --platform linux/amd64 if building on Apple Silicon)
docker build --platform linux/amd64 -t $API_IMAGE ./backend
docker build --platform linux/amd64 -t $WEB_IMAGE -f frontend/Dockerfile .

# Push
docker push $API_IMAGE
docker push $WEB_IMAGE
```

### 4. Store secrets in AWS SSM Parameter Store

Avoid hardcoding secrets in task definitions:

```bash
aws ssm put-parameter \
  --name "/recipe-log/JWT_SECRET" \
  --value "your-long-random-secret" \
  --type SecureString \
  --region $AWS_REGION

aws ssm put-parameter \
  --name "/recipe-log/DATABASE_URL" \
  --value "postgresql+asyncpg://user:pass@your-rds-host:5432/recipedb" \
  --type SecureString \
  --region $AWS_REGION

# Optional — only needed if using AI import
aws ssm put-parameter \
  --name "/recipe-log/OPENAI_API_KEY" \
  --value "sk-..." \
  --type SecureString \
  --region $AWS_REGION
```

### 5. Create an ECS task definition

Create `task-definition.json`:

```json
{
  "family": "recipe-log",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/recipe-log/api:latest",
      "essential": true,
      "portMappings": [{ "containerPort": 8000 }],
      "command": [
        "sh", "-c",
        "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"
      ],
      "secrets": [
        { "name": "DATABASE_URL", "valueFrom": "/recipe-log/DATABASE_URL" },
        { "name": "JWT_SECRET",   "valueFrom": "/recipe-log/JWT_SECRET" }
      ],
      "environment": [
        { "name": "PARSER_BACKEND", "value": "ai" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/recipe-log",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "api"
        }
      }
    },
    {
      "name": "web",
      "image": "ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/recipe-log/web:latest",
      "essential": true,
      "portMappings": [{ "containerPort": 80 }],
      "dependsOn": [{ "containerName": "api", "condition": "START" }],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/recipe-log",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "web"
        }
      }
    }
  ]
}
```

Replace `ACCOUNT_ID` and `REGION` with your values, then register it:

```bash
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json \
  --region $AWS_REGION
```

### 6. Create a CloudWatch log group

```bash
aws logs create-log-group --log-group-name /ecs/recipe-log --region $AWS_REGION
```

### 7. Create an ECS cluster and service

```bash
# Create cluster (Fargate, no EC2 instances to manage)
aws ecs create-cluster --cluster-name recipe-log --region $AWS_REGION

# Create service
aws ecs create-service \
  --cluster recipe-log \
  --service-name recipe-log-svc \
  --task-definition recipe-log \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[subnet-xxxxxxxx],
    securityGroups=[sg-xxxxxxxx],
    assignPublicIp=ENABLED
  }" \
  --region $AWS_REGION
```

Substitute your VPC subnet and security group IDs. The security group needs inbound port 80 open.

### 8. (Optional) Add a load balancer and custom domain

For production use, put an **Application Load Balancer** in front of ECS:

1. Create an ALB targeting port 80 on the ECS service
2. Add an HTTPS listener using an ACM certificate
3. Point your domain's DNS to the ALB

### Updating after a code change

```bash
# Rebuild and push
docker build --platform linux/amd64 -t $API_IMAGE ./backend && docker push $API_IMAGE
docker build --platform linux/amd64 -t $WEB_IMAGE -f frontend/Dockerfile . && docker push $WEB_IMAGE

# Force ECS to pull the new images
aws ecs update-service \
  --cluster recipe-log \
  --service recipe-log-svc \
  --force-new-deployment \
  --region $AWS_REGION
```

---

## Environment Variables

### Root `.env` (Docker Compose)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_USER` | Yes | `recipe` | PostgreSQL username |
| `POSTGRES_PASSWORD` | Yes | — | PostgreSQL password |
| `POSTGRES_DB` | Yes | `recipedb` | PostgreSQL database name |
| `JWT_SECRET` | Yes | — | Secret key for signing JWT tokens (use a long random string) |
| `PARSER_BACKEND` | No | `local` | `local` (Tesseract OCR) or `ai` (OpenAI gpt-4o-mini) |
| `OPENAI_API_KEY` | No | — | Required if `PARSER_BACKEND=ai` |
| `GOOGLE_CLIENT_ID` | No | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | — | Google OAuth client secret |
| `PORT` | No | `80` | Host port for the web container |

### Backend `.env` (local dev only)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | Async PostgreSQL URL: `postgresql+asyncpg://user:pass@host:5432/db` |
| `JWT_SECRET` | Yes | — | Same as above |
| `PARSER_BACKEND` | No | `local` | Parser backend selection |
| `OPENAI_API_KEY` | No | — | OpenAI key for AI import |
| `GOOGLE_CLIENT_ID` | No | — | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | No | — | Google OAuth |

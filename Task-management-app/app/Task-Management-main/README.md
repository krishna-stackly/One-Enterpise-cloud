# Stackly — Project & Task Management

Enterprise project and task management built around a strict work hierarchy:

**PROJECT → SCRUM MASTER → TEAM → MENTOR → POC**

Delegation flows down. Progress and reporting flow up.

Never display "Project Lead", "Team Lead", or "Employee" in the UI. Use **Scrum Master**, **Mentor**, and **POC**. POCs own subtasks and record who did the work with a free-text **Done by** name.

## Architecture

Monorepo:

- `frontend/` — React 19, Vite, TypeScript, Tailwind CSS, shadcn/ui
- `backend/` — Java 21, Spring Boot 3.4, Spring Security, JWT, MySQL, Flyway
- `docker-compose.yml` — frontend, backend, MySQL

Layered backend: `controller` → `service` → `repository` / `entity` / `dto` / `mapper` / `security` / `exception` / `config`.

JPA entities are never returned from APIs. Responses use:

```json
{ "success": true, "message": "Task created successfully", "data": {} }
```

```json
{ "success": false, "message": "You do not have permission to assign this task", "errors": [] }
```

## Technology stack

### Frontend
React, Vite, TypeScript, Tailwind CSS, shadcn/ui, React Router, TanStack Query, Zustand, Axios, React Hook Form, Zod, Recharts, Lucide React, dnd-kit

### Backend
Java 21, Spring Boot 3, Spring Web, Spring Data JPA, Hibernate, Spring Security, JWT, Bean Validation, Lombok, Maven, OpenAPI, JUnit, Mockito

### Database
MySQL 8, Flyway

## Folder structure

```
.
├── frontend/src/{api,components,layouts,routes,features,hooks,stores,types,utils,pages}
├── backend/src/main/java/com/stackly/pms/{controller,service,repository,entity,dto,mapper,security,exception,config}
├── backend/src/main/resources/db/migration
├── docker-compose.yml
└── .env.example
```

## Environment setup

```bash
cp .env.example .env
```

Never commit secrets. Generate a long `JWT_SECRET` for any non-local environment.

## Database setup

MySQL 8 with database `stackly_pms`. Flyway runs on backend startup from `backend/src/main/resources/db/migration`.

### Migration commands

```bash
cd backend
mvn flyway:migrate   # optional; Spring Boot also migrates on startup
```

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Default: `VITE_USE_MOCK=false` so the UI talks to the Spring Boot API and MySQL.

Demo account (password `Password@123`) — created by the one-time seed `POST /api/seed/first-run`:

| Email | Role |
|---|---|
| aerrapothuapurwa@thestackly.com | Scrum Master |

The seed also creates one starter project (`OneEnterprise Cloud Platform (Java Enterprise Suite)` / `OECP`)
and assigns the Scrum Master to it as `SCRUM_MASTER`. That assignment is required — login and every
project-scoped API call go through `hierarchyService.requireAssignment`, so a user with no project
cannot sign in or create anything.

Set `VITE_USE_MOCK=true` only if you want the offline in-browser seed without MySQL.

## Backend setup

Requires Java 21, Maven, and MySQL.

```bash
cd backend
mvn test
mvn spring-boot:run
```

OpenAPI UI: http://localhost:8080/swagger-ui.html

## Docker setup

```bash
docker compose up --build
```

Frontend: http://localhost:5173  
Backend: http://localhost:8080  
MySQL: localhost:3306

## Running locally

1. Start MySQL 8 with database `stackly_pms` and user/password from `.env.example` (`stackly` / `change_me`)
2. Start backend: `cd backend && mvn -DskipTests package && java -jar target/pms-0.1.0.jar`
3. Start frontend: `cd frontend && npm install && npm run dev`
4. Open http://localhost:5173 — the UI uses `VITE_USE_MOCK=false` and calls `http://localhost:8080/api`
5. Bootstrap the first Scrum Master + starter project (safe to run repeatedly):
   `curl -X POST http://localhost:8080/api/seed/first-run`

The backend runs Flyway migrations on startup and creates **no** seed data on its own. The seed
endpoint above creates exactly: the Scrum Master user, one project
(`OneEnterprise Cloud Platform (Java Enterprise Suite)` / `OECP`), and that user's `SCRUM_MASTER`
assignment on it — nothing else. Teams, people, sprints, and tasks are all created from the UI.
Creating a *new* project from the UI auto-assigns its creator as Scrum Master.

## API documentation

Auth: `POST /api/auth/login|refresh|logout|forgot-password|reset-password|change-password`  
Seed: `POST /api/seed/first-run` (idempotent Scrum Master + starter project bootstrap)
Projects/teams/hierarchy: `/api/projects`, `/api/teams/{id}`, `/api/teams/{teamId}/mentors|pocs`  
Tasks: `/api/tasks`, `/api/tasks/{id}/subtasks|status|submit-review|approve|reject|comments|work-log`  
Dashboards: `/api/dashboard/{scrum-master|mentor|poc}`  
Reports: `/api/reports/{project|team|mentor|poc}`

## Authentication

JWT access + refresh tokens. Passwords are BCrypt hashed. The backend authorizes **project-specific assignments**, not a single global role.

## Roles / permissions

| Assignment | Can |
|---|---|
| Scrum Master | Project overview, teams, structure |
| Mentor | Assign parent work **only to POCs on their team** |
| POC | Own parent and subtask work; record **Done by** name; submit for review; approve/reject |

A user may be Scrum Master on project A and POC on project D.

## Task workflow

`BACKLOG → ASSIGNED → IN_PROGRESS → IN_REVIEW → COMPLETED`

- `IN_PROGRESS → BLOCKED`
- Reject: `IN_REVIEW → REOPENED → IN_PROGRESS`
- Parent progress is computed from child subtasks

## File storage

Attachments store metadata/URLs only. `FileStorage` abstracts local disk (default) and can be replaced with S3-compatible storage.

## Deployment

1. Set production env vars (`JWT_SECRET`, DB credentials, `SPRING_PROFILES_ACTIVE=prod`)
2. `docker compose -f docker-compose.yml up --build -d`
3. Put TLS in front of the frontend/nginx or an ingress
4. Rotate JWT secrets and DB passwords per environment

## License

Proprietary — internal Stackly project.

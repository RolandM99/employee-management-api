# Employee Management API

A NestJS v11 monorepo for employee management and attendance tracking, with JWT auth, queue-based emails, reporting exports, and CI automation.

## Overview

This project provides:

- JWT authentication (`register`, `login`, `logout`, `refresh`)
- Forgot/reset password flow with queued email delivery
- Employee CRUD
- Attendance check-in/check-out with transaction + locking safety
- Daily attendance report exports (PDF + Excel)
- Swagger API docs
- TypeORM + MySQL migrations
- Redis-backed queues via Bull
- Unit, e2e, and integration test suites
- GitHub Actions CI for PRs

## Tech Stack

- **Backend:** NestJS v11, TypeScript (strict)
- **DB:** MySQL 8, TypeORM
- **Queue/Cache:** Redis 7, `@nestjs/bull` + `bull`
- **Auth:** Passport JWT
- **Validation/Docs:** class-validator, Swagger
- **Reports:** jsPDF, exceljs
- **Testing:** Jest + Supertest
- **Runtime/Package manager:** Node.js `>=22.0.0`, Yarn

## Monorepo Layout

- `apps/api` - API app bootstrap
- `libs/auth` - authentication domain
- `libs/employees` - employee CRUD domain
- `libs/attendance` - attendance domain
- `libs/mail` - mail queue + processors + delivery
- `libs/reports` - report generation and endpoints
- `libs/health` - health checks (DB + Redis)
- `libs/database` - TypeORM config + migrations
- `libs/common` - shared decorators/guards/filters/interceptors

## Prerequisites

- Node.js `>=22.0.0` (see `.nvmrc`)
- Yarn
- Docker + Docker Compose

## Local Setup

1. Install dependencies:

```bash
yarn install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Start infrastructure (MySQL + Redis):

```bash
docker-compose up -d
```

4. Run migrations:

```bash
yarn typeorm:migration:run
```

## Run Dev Server

```bash
yarn start:dev
```

Key URLs:

- API base: http://localhost:3000/api/v1
- Swagger UI: http://localhost:3000/docs
- Health (no auth): http://localhost:3000/health

## Testing

- Unit tests:

```bash
yarn test
```

- API e2e/integration tests:

```bash
yarn test:e2e
```

- Mail queue integration tests (requires Redis):

```bash
yarn test:mail:integration
```

- Coverage:

```bash
yarn test:cov
```

## Inspect MySQL Database

This project runs MySQL in Docker as `employee_mysql` (from `docker-compose.yml`).

Connect to MySQL inside the container:

```bash
docker exec -it employee_mysql mysql -u employee_user -p employee_management
```

Password:

```text
employee_pass
```

Useful SQL commands:

```sql
SHOW TABLES;
DESCRIBE users;
DESCRIBE employees;
DESCRIBE attendances;
SELECT * FROM users LIMIT 10;
SELECT * FROM employees LIMIT 10;
SELECT * FROM attendances LIMIT 10;
```

Optional local client connection (if `mysql` is installed on your machine):

```bash
mysql -h 127.0.0.1 -P 3306 -u employee_user -p employee_management
```

## Example cURL Flows

Set base URL:

```bash
API="http://localhost:3000/api/v1"
```

Register:

```bash
curl -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"StrongP@ss1"}'
```

Login and capture token (`jq` required):

```bash
ACCESS_TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"StrongP@ss1"}' | jq -r '.data.accessToken')
```

Create employee:

```bash
curl -X POST "$API/employees" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "names":"John Doe",
    "email":"john.doe@company.com",
    "employeeIdentifier":"EMP-001",
    "phoneNumber":"+250788123456"
  }'
```

Check-in:

```bash
curl -X POST "$API/attendance/check-in" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"<EMPLOYEE_UUID>","occurredAt":"2026-02-07T09:00:00"}'
```

Check-out:

```bash
curl -X POST "$API/attendance/check-out" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"<EMPLOYEE_UUID>","occurredAt":"2026-02-07T17:00:00"}'
```

Download daily PDF report:

```bash
curl -L "$API/reports/attendance/daily.pdf?date=2026-02-07" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -o attendance-2026-02-07.pdf
```

Download daily Excel report:

```bash
curl -L "$API/reports/attendance/daily.xlsx?date=2026-02-07" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -o attendance-2026-02-07.xlsx
```

## Testing Report Downloads in Postman

When calling report endpoints, do not rely on the response preview pane for file viewing.

- Set `Authorization` header: `Bearer <ACCESS_TOKEN>`
- Call:
  - `GET /reports/attendance/daily.pdf?date=YYYY-MM-DD`
  - `GET /reports/attendance/daily.xlsx?date=YYYY-MM-DD`
- In Postman, click the arrow next to **Send** and choose **Send and Download**
- Save with proper extension: `.pdf` or `.xlsx`
- Open files locally:
  - `.pdf` with a PDF reader
  - `.xlsx` with Excel / LibreOffice / Google Sheets

Note: seeing XML/text in Postman preview for `.xlsx` is normal preview behavior for a binary Excel package.

## Email Notes (Dev Mode)

- Email sending is queue-based through Bull (`mail` queue) and Redis.
- Controllers/services enqueue jobs; processors perform delivery.
- `MAIL_TRANSPORT=console` logs email payload to app logs (fastest local mode).
- `MAIL_TRANSPORT=ethereal` sends via Ethereal and logs preview URLs.

## CI Workflow

Workflow file: `.github/workflows/ci.yml`

On every pull request to `master` or `develop`:

- **Job 1: `lint-and-unit`**
  - Setup Node 22
  - Install dependencies (with Yarn cache)
  - Run lint
  - Run unit tests with coverage
  - Upload coverage artifact

- **Job 2: `integration`**
  - Start MySQL + Redis service containers
  - Prepare `.env`
  - Run DB migrations before tests
  - Run e2e tests
  - Run mail integration tests

Both jobs run with concurrency control to cancel stale runs on new commits.

👤 **Author**

- GitHub: [RolandM99](https://github.com/RolandM99)
- LinkedIn: [Roland N. Mweze](https://www.linkedin.com/in/roland-mweze/)
- Twitter: [ManfulMwez](https://twitter.com/ManfulMwez)

## ⭐️ Show your support <a name="support"></a>
> Write a message to encourage readers to support your project

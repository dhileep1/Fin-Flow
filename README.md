# Lend Easy — Vehicle-Collateral Lending Management SaaS

A multi-tenant SaaS platform for originating, servicing, collecting, and reporting on fixed-tenure vehicle-collateral loans.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| ORM | Prisma |
| Database | PostgreSQL |
| Queue | BullMQ + Redis |
| Auth | JWT + bcrypt |
| PDF | PDFKit |
| Frontend | React + Vite |
| Styling | Vanilla CSS (dark mode) |

## Features

- **Loan Origination** — Schedule generation with rounding remainder in final installment
- **Payment Processing** — Partial payments with penalty→interest→principal allocation
- **Penalty Accrual** — Daily idempotent 0.002% penalty computation
- **Call Follow-up** — Priority queue by next_call_date, auto +7 day follow-up
- **WhatsApp Notifications** — Provider adapter pattern with delivery tracking
- **PDF Receipts** — Auto-generated on payment with breakdown
- **Unified Search** — Search customers, vehicles, and loans
- **RBAC** — Admin, Accountant, Staff, Viewer roles
- **Multi-tenant** — Full org_id scoping on all queries

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis (optional, for BullMQ workers)

### Setup

```bash
# Backend
cd backend
npm install
cp .env.example .env   # Edit DATABASE_URL
npx prisma migrate dev  # or: npx prisma db push
node prisma/seed.js     # Seed demo data

# Frontend
cd ../frontend
npm install
```

### Run

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

### Login (after seeding)

The seed script will print the Org ID. Use these credentials:

- **Admin:** admin@quickloans.com / admin123
- **Staff:** ramesh@quickloans.com / staff123

## Project Structure

```
backend/
├── prisma/schema.prisma    # 14-table data model
├── src/
│   ├── index.js            # Express entry point
│   ├── config/             # DB client, env config
│   ├── middleware/          # Auth, RBAC, tenant scope
│   ├── routes/             # 10 route modules
│   ├── controllers/        # Request handlers
│   ├── services/           # Business logic
│   ├── jobs/               # Background workers
│   └── utils/              # Rounding, dates

frontend/
├── src/
│   ├── App.jsx             # Router + auth
│   ├── pages/              # 8 page components
│   ├── components/         # Shared UI components
│   ├── api/client.js       # API client
│   ├── context/            # Auth context
│   └── styles/             # CSS modules
```

## API Endpoints

All endpoints: `POST /api/v1/{orgId}/...`

- `POST /auth/login` — JWT authentication
- `GET/POST /customers` — Customer CRUD
- `GET/POST /vehicles` — Vehicle CRUD
- `POST /loans` — Create loan + schedule
- `POST /payments` — Record payment
- `GET /call-tasks` — Call priority queue
- `POST /call-tasks/logs` — Log a call
- `POST /notifications/send` — Send WhatsApp
- `GET /reports/dashboard` — KPI stats
- `GET /search?q=` — Unified search

## Business Rules

- **Document Fee:** 5% of principal, withheld at disbursement
- **Interest:** Fixed monthly on gross principal
- **Rounding:** Half-up to 2 decimals; final installment corrects remainder
- **Penalty:** 0.002%/day of pending due (non-compounding default)
- **Payment Order:** Penalty → Interest → Principal (oldest due first)
- **Follow-up:** Default next_call_date = call_date + 7 days

# Online Restaurant Management System

A full-stack restaurant ordering and operations app (Node.js + Express + MySQL, plain HTML/CSS/JS frontend).
Customers browse the menu, manage a cart, place and track orders. Admins manage orders, menu and accounts;
staff process orders; delivery accounts handle delivery progress and cash collection.

## Features

- Public homepage with live menu preview and a customer feedback form (saved in the database, optionally emailed).
- Customer registration, sign-in, cart, checkout (cash on delivery or UPI) and order history with printable receipts.
- Admin: order review and status updates, menu management, staff/delivery account management, registered-account directory with activate/deactivate.
- Delivery role: can only move orders `READY → OUT_FOR_DELIVERY → DELIVERED` and confirm cash after delivery.
- Orders are saved in a single database transaction; unavailable items cannot be ordered.
- Order history is preserved even if a menu item is later deleted.

## Requirements

- Node.js 20 or newer
- MySQL 8+ (MariaDB 10.5+ also works)

## Quick start

```bash
# 1. install dependencies
cd backend
npm install

# 2. configure
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
#    edit .env: set DB_USER / DB_PASSWORD and a long random JWT_SECRET
#    generate a secret with:
#    node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. create the database, tables and starter menu (safe to re-run; also upgrades older databases)
npm run db:setup

# 4. create your first admin account
npm run create-admin -- "Your Name" you@example.com "a-strong-password"

# 5. start
npm start
```

Open <http://localhost:5000>. Customers register on the site; staff and admins sign in via **Admin Portal**.

> The database script is also available at `database/restaurant.sql` if you prefer running it in MySQL Workbench.

## Scripts (run inside `backend/`, or from the repo root without `--prefix`)

| Command | What it does |
| --- | --- |
| `npm start` | Start the server |
| `npm run dev` | Start with auto-reload (nodemon) |
| `npm run db:setup` | Create/upgrade the database and load the starter menu |
| `npm run create-admin -- "Name" email "password"` | Create an admin, or promote/reset an existing account |
| `npm test` | Run the API test suite (uses a temporary `restaurant_db_test` database; the MySQL user needs permission to create/drop databases) |

## Configuration (`backend/.env`)

See `backend/.env.example`. Never commit `.env`.

- `DB_*` – MySQL connection. `PORT` – web port (default 5000).
- `JWT_SECRET` – **required**; the server refuses to start without a strong value.
- `UPI_VPA`, `UPI_PAYEE_NAME` – shown on checkout for UPI payments (UPI confirmation is manual; there is no payment gateway).
- `SMTP_*`, `MAIL_FROM`, `ORDER_ALERT_EMAIL`, `FEEDBACK_EMAIL` – optional email alerts. Gmail needs an App Password.

## Roles

| Role | Can do |
| --- | --- |
| `CUSTOMER` | Browse, cart, checkout, own orders |
| `STAFF` | View all orders, update status, confirm payments |
| `DELIVERY` | Delivery progress and cash confirmation after delivery |
| `ADMIN` | Everything, plus menu, staff and account management |

## Project layout

```text
backend/    Express API, auth, MySQL access, scripts and tests
database/   MySQL schema + upgrade script + starter menu
frontend/   HTML pages, CSS and browser JavaScript (served by the backend)
```

## Troubleshooting

- **"Database problem: Access denied"** – check `DB_USER` / `DB_PASSWORD` in `backend/.env`.
- **"Database schema not found"** – run `npm run db:setup`.
- **"JWT_SECRET is missing or too weak"** – set a random 16+ character `JWT_SECRET`.
- **Port busy** – change `PORT` in `backend/.env`.
- **Cannot sign in to Admin Portal** – the account must be `ADMIN`, `STAFF` or `DELIVERY` and active; use `npm run create-admin` to fix an admin account.
- **Emails not sent** – check the `SMTP_*` values; orders and feedback still work without email.

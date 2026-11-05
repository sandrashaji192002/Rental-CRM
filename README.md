# Rental CRM: Equipment & Tool Rental Management

A Rental CRM and Inventory Management System for an equipment/tool rental business. It tracks the catalogue and individual serial-numbered assets, customers, the full rental lifecycle (reservation, dispatch, return, damage inspection), payments and deposits, maintenance, suppliers, and revenue/utilization reports.

There are three ways to use it:

| Portal | URL path | Who |
|---|---|---|
| Admin Portal | `/admin` | Admin |
| Operations / Front Desk Portal | `/ops` | Staff and Admin |
| Mobile Admin UI (full Admin Portal in a phone layout) | `/m` | Admin |

## Live demo

- **App:** https://rental-crm.onrender.com
- **Mobile Admin UI:** https://rental-crm.onrender.com/m
- **Source code:** https://github.com/sandrashaji192002/Rental-CRM

> The app is on free hosting. If it has been idle, the first request can take up to about a minute while the server wakes up.

## Test credentials

| Role | Email | Password | Lands on |
|---|---|---|---|
| Admin | `admin@demo.com` | `Admin@123` | `/admin` (or `/m` from the mobile login) |
| Staff | `staff@demo.com` | `Staff@123` | `/ops` |

Demo data includes 3 categories, 5 products, 15 serial-numbered assets and 2 customers.

## Features

**Admin Portal**
- **Products and assets:** categories, products with daily rate, weekly rate and security deposit; individual assets with unique serial number, status (available, rented, maintenance, retired), condition and purchase cost.
- **Customers:** profiles, ID proof, full rental history and pending dues.
- **Rentals:** reservations, dispatch, returns, damage inspection, cancellation.
- **Staff management and access control:** create users, assign role (admin/staff), disable accounts, reset passwords.
- **Suppliers and maintenance:** supplier directory; maintenance tickets (open, in progress, done) with cost, linked to a supplier; completing a ticket returns the asset to service or retires it.
- **Ledger and reports:** revenue summary, daily revenue trend, product/asset utilization, payment ledger with CSV export, overdue alerts on the dashboard.

**Operations / Front Desk Portal**
- Search or register customers.
- Check real-time item availability for a date range.
- Create rental agreements with several items.
- Take deposits and payments (cash, card, UPI).
- Dispatch, return with inspection, automatic late fee, deposit settlement.
- Print the rental agreement.

**Mobile Admin UI**
- Every Admin Portal page, with the same functionality, in a phone-style layout with a top bar and a scrolling bottom tab bar. It has its own mobile login.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router 6, Axios |
| Backend | Node.js, Express |
| Database | MySQL with Sequelize ORM |
| Auth | JWT (jsonwebtoken), bcryptjs password hashing |
| Hosting | Render (app), Aiven (MySQL) |

## Business rules

- **Rent:** every started 24 hours is one day (minimum 1 day). A weekly rate applies per full week; leftover days are charged daily but never more than one week's price.
- **Deposit:** the full security deposit must be collected before dispatch. It is a refundable liability, not revenue.
- **Late fee:** after a 60-minute grace period, each started late day is charged at 1.5 x the combined daily rate of the items.
- **Return:** each item is inspected (good, fair, damaged). Damaged items automatically go to maintenance with an open ticket and a damage charge.
- **Settlement:** the held deposit is applied to what is owed (rent, then late fee, then damage) and any remainder is refunded. The rental is closed when nothing is owed.
- **Availability:** an asset is blocked if another reserved or dispatched rental overlaps the dates. An overdue rental keeps blocking the asset until it is returned.
- **No double booking:** bookings run in a database transaction with row locks on the chosen assets.
- **Price changes** never affect existing rentals, because rates are snapshotted on each rental line.

## Roles and access control

- JWT authentication. On every request the user is reloaded from the database, so disabling an account takes effect immediately.
- **Admin:** everything, including products, assets, staff, suppliers, maintenance and reports.
- **Staff:** customers, availability, rentals, payments, dispatch and returns only. Admin APIs return 403 for staff, and admin pages redirect away.
- An admin cannot disable or demote their own account. Only an admin can enter a custom return time.

## Project structure

```
Rental CRM/
  00-backend/
    src/
      config/db.js          Sequelize connection
      middleware/auth.js    authenticate + authorize(role)
      models/index.js       tables and associations
      routes/               auth, users, catalog, customers, rentals,
                            suppliers, maintenance, reports
      services/rental.js    pricing, late fee, availability, payment allocation
      seed.js               demo data
      app.js, server.js
  00-frontend/
    src/
      pages/                one file per screen
      layouts.jsx           Admin, Ops and Mobile shells
      App.jsx               routes and role guards
      api.js, auth.jsx, ui.jsx
  package.json              root scripts (build, start, seed)
```

The same page components are mounted under `/admin`, `/m` and `/ops`, so the mobile admin always has the same functionality as the desktop admin.

## Run locally

Requirements: Node.js 18+ and MySQL.

```bash
# 1. Install everything
npm run install:all

# 2. Create the database in MySQL
#    CREATE DATABASE rental_crm;

# 3. Configure the backend
cp 00-backend/.env.example 00-backend/.env
#    then edit 00-backend/.env (DB_USER, DB_PASSWORD, JWT_SECRET ...)

# 4. Create tables and load demo data
npm run seed

# 5. Start the API (http://localhost:5000)
cd 00-backend && npm run dev

# 6. In a second terminal, start the frontend (http://localhost:5173)
cd 00-frontend && npm run dev
```

In development, Vite proxies `/api` to `http://localhost:5000`.

> `npm run seed` **drops and recreates all tables**. Do not run it against data you want to keep.

### Environment variables (`00-backend/.env`)

| Variable | Purpose |
|---|---|
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | MySQL connection |
| `DB_SSL` | `true` for cloud MySQL that requires TLS |
| `DIALECT` | `mysql` |
| `APP_PORT` | Local API port (leave unset on a hosting platform) |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Token signing and lifetime |
| `AUTO_SEED` | `true` loads demo data on first start when there are no users |

## Deployment

One server hosts both the API and the built React app.

1. Provision a MySQL database and set the `DB_*` variables.
2. Build command: `npm run build`. Start command: `npm start`.
3. Set `JWT_SECRET` to a long random value, and `AUTO_SEED=true` for the first start only.

Express serves the built frontend and falls back to `index.html`, so routes like `/admin`, `/ops` and `/m` work on refresh.

## Assumptions

- Currency is Indian rupees and customer phone numbers are validated as Indian 10-digit mobile numbers.
- Late fee is 1.5x the daily rate per started late day after a 60-minute grace period.
- Rent can be paid after dispatch; the security deposit must be paid before dispatch.
- The ledger is derived from the payments table rather than a separate accounting table.
- Two roles (admin and staff) are enough for this release.

## Limitations and future work

- Tables are created with `sequelize.sync()`; database migrations are not set up.
- No automated tests yet. The pricing and late-fee functions in `services/rental.js` are written as pure functions so they are easy to unit test.
- Rental and dashboard lists are not paginated.
- Security hardening such as rate limiting, helmet and httpOnly cookies is not included.
- Not built yet: rental extension, ID document upload, email/SMS overdue reminders, per-user permissions, audit log, online payments.
- Report dates use the server's time zone.

# HR App

A Node.js and Express HR operations platform for managing recruitment, employees, departments, organisation structure, workload visibility, and HR insights.

This project is an early-stage HR application designed to evolve from an internal workflow tool into a broader platform for workforce planning, overload monitoring, and early burnout-risk indicators.

## Current scope

The app currently focuses on core HR workflows such as:

- applicant tracking
- employee records
- department and organisation views
- HR insights and reporting
- workload-related pages
- admin CSV upload and data import
- PostgreSQL-backed data storage

## Product direction

The long-term goal is to build an HR platform that helps teams:

- manage hiring and employee lifecycle workflows
- monitor workload and staffing pressure
- improve reporting across departments
- detect early warning signs linked to overload, absenteeism, and burnout risk

At the current stage, the application should be understood as an **HR workflow and insights platform**, not yet a finished burnout-prediction system.

## Tech stack

- **Backend:** Node.js, Express
- **Views:** EJS
- **Database:** PostgreSQL
- **Authentication/session support:** express-session
- **File upload/parsing:** Multer, CSV parsing utilities
- **Frontend:** server-rendered HTML, CSS, JavaScript

## Main features

Depending on the current route implementations in `branch1`, the app includes pages and modules for:

- dashboard / landing
- applicants
- employees
- departments
- organisation
- insights
- workload
- admin upload

## Repository structure

```text
hr_app/
├── archive_flask/         # older Flask prototype kept for reference
├── middleware/
├── public/                # static assets
├── routes/                # Express route modules
├── services/              # business/data services
├── views/                 # EJS templates
├── app.js                 # main Express app entry point
├── db.js                  # PostgreSQL connection/config
├── schema.sql             # database schema
├── init_db.js             # database initialisation
├── seed_db.js             # optional seed data
├── database_updates.sql   # schema/data update scripts
├── package.json
└── README.md

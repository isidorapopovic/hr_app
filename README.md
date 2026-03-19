
# HR Tracker App

A simple Flask + SQLite HR and Talent Acquisition web app based on your schema.

## What this app does

It tracks:

- departments
- positions
- applicants
- hired employees
- recruitment and employee actions

It is designed around the schema from your notebook:

- `departments`
- `positions`
- `applicants`
- `employees`
- `actions`

## Main features

- dashboard with HR KPIs
- add departments
- add positions
- add applicants
- move applicants through hiring stages
- hire an applicant into the employees table
- track employee lifecycle changes
- view recent actions and individual timelines

## Important schema fix

Your original notebook schema had one SQL syntax problem in the `actions` table:
there was a missing comma before the `FOREIGN KEY (old_department_id)` line.

That is already fixed in `schema.sql` here.

## Project structure

```text
hr_tracker_app/
├── app.py
├── schema.sql
├── requirements.txt
├── hr_system.db           # created automatically on first run
├── static/
│   └── style.css
└── templates/
    ├── layout.html
    ├── dashboard.html
    ├── departments.html
    ├── positions.html
    ├── applicants.html
    ├── applicant_form.html
    ├── applicant_detail.html
    ├── employees.html
    └── employee_detail.html
```

## Step-by-step integration

### 1. Create a project folder
Put all files into one folder named `hr_tracker_app`.

### 2. Open terminal in that folder
Example:
```bash
cd hr_tracker_app
```

### 3. Create a virtual environment
Windows:
```bash
python -m venv venv
venv\Scripts\activate
```

macOS/Linux:
```bash
python3 -m venv venv
source venv/bin/activate
```

### 4. Install dependencies
```bash
pip install -r requirements.txt
```

### 5. Start the application
```bash
python app.py
```

### 6. Open the browser
Visit:
```text
http://127.0.0.1:5000
```

### 7. First run behaviour
On first run the app will:

- create `hr_system.db`
- build all tables from `schema.sql`
- insert seed data for departments, positions, applicants, employees, and actions

## How to connect it to your own database

If you already have your own SQLite database and want to keep its data:

1. replace the generated `hr_system.db` with your own file
2. make sure your schema matches `schema.sql`
3. comment out the `DROP TABLE` lines in `schema.sql` if you do not want destructive resets
4. keep `PRAGMA foreign_keys = ON`

## Suggested next upgrades

- authentication for HR admin users
- edit/delete pages
- file upload for CVs
- analytics charts
- leave management
- payroll integration
- employee document storage
- role-based access

## Notes

This version is intentionally plain and simple on the frontend, as requested.

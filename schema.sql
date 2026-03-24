
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS actions;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS applicants;
DROP TABLE IF EXISTS positions;
DROP TABLE IF EXISTS departments;

PRAGMA foreign_keys = ON;

CREATE TABLE departments (
    department_id INTEGER PRIMARY KEY AUTOINCREMENT,
    department_name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE positions (
    position_id INTEGER PRIMARY KEY AUTOINCREMENT,
    position_title TEXT NOT NULL,
    department_id INTEGER NOT NULL,
    position_level TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

CREATE TABLE applicants (
    applicant_id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    years_experience REAL NOT NULL DEFAULT 0 CHECK (years_experience >= 0),
    current_or_last_position TEXT,
    position_id INTEGER,
    application_status TEXT NOT NULL DEFAULT 'applied'
        CHECK (application_status IN (
            'applied',
            'in_review',
            'interview',
            'offered',
            'rejected',
            'withdrawn',
            'hired'
        )),
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (position_id) REFERENCES positions(position_id)
);

CREATE TABLE employees (
    employee_id INTEGER PRIMARY KEY AUTOINCREMENT,
    applicant_id INTEGER UNIQUE,
    full_name TEXT NOT NULL,
    position_id INTEGER NOT NULL,
    hire_date TEXT NOT NULL,
    employment_status TEXT NOT NULL DEFAULT 'active'
        CHECK (employment_status IN (
            'active',
            'on_leave',
            'transferred',
            'resigned',
            'terminated'
        )),
    end_date TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (applicant_id) REFERENCES applicants(applicant_id),
    FOREIGN KEY (position_id) REFERENCES positions(position_id)
);

CREATE TABLE actions (
    action_id INTEGER PRIMARY KEY AUTOINCREMENT,
    applicant_id INTEGER,
    employee_id INTEGER,
    action_type TEXT NOT NULL
        CHECK (action_type IN (
            'applicant_arrived',
            'status_changed',
            'interview_scheduled',
            'interview_completed',
            'offer_made',
            'rejected',
            'hired',
            'position_changed',
            'department_changed',
            'promoted',
            'transferred',
            'resigned',
            'terminated'
        )),
    old_status TEXT,
    new_status TEXT,
    old_position_id INTEGER,
    new_position_id INTEGER,
    old_department_id INTEGER,
    new_department_id INTEGER,
    action_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    performed_by TEXT,
    notes TEXT,
    FOREIGN KEY (applicant_id) REFERENCES applicants(applicant_id),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    FOREIGN KEY (old_position_id) REFERENCES positions(position_id),
    FOREIGN KEY (new_position_id) REFERENCES positions(position_id),
    FOREIGN KEY (old_department_id) REFERENCES departments(department_id),
    FOREIGN KEY (new_department_id) REFERENCES departments(department_id),
    CHECK (applicant_id IS NOT NULL OR employee_id IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT,
    department_id INTEGER,
    workload_percent INTEGER DEFAULT 0,
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    department_id INTEGER NOT NULL,
    deadline TEXT,
    status TEXT DEFAULT 'Active',
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS employee_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

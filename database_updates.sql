-- departments
CREATE TABLE IF NOT EXISTS departments (
    department_id INTEGER PRIMARY KEY,
    department_name TEXT NOT NULL
);

-- employees
CREATE TABLE IF NOT EXISTS employees (
    employee_id INTEGER PRIMARY KEY,
    full_name TEXT NOT NULL,
    job_title TEXT,
    department_id INTEGER,
    manager_id INTEGER,
    workload_score INTEGER DEFAULT 0,
    overtime_hours REAL DEFAULT 0,
    absence_days INTEGER DEFAULT 0,
    active_projects INTEGER DEFAULT 0,
    overdue_tasks INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Active',
    FOREIGN KEY (department_id) REFERENCES departments(department_id),
    FOREIGN KEY (manager_id) REFERENCES employees(employee_id)
);

-- projects
CREATE TABLE IF NOT EXISTS projects (
    project_id INTEGER PRIMARY KEY,
    project_name TEXT NOT NULL,
    department_id INTEGER,
    manager_id INTEGER,
    status TEXT DEFAULT 'On Track',
    progress_percent REAL DEFAULT 0,
    planned_end_date TEXT,
    actual_end_date TEXT,
    workload_pressure INTEGER DEFAULT 0,
    FOREIGN KEY (department_id) REFERENCES departments(department_id),
    FOREIGN KEY (manager_id) REFERENCES employees(employee_id)
);

-- optional demo data
INSERT OR IGNORE INTO departments (department_id, department_name) VALUES
(1, 'Executive'),
(2, 'Engineering'),
(3, 'HR'),
(4, 'Sales');

INSERT OR IGNORE INTO employees (
    employee_id, full_name, job_title, department_id, manager_id,
    workload_score, overtime_hours, absence_days, active_projects, overdue_tasks, status
) VALUES
(1, 'Reese Miller', 'Director', 1, NULL, 55, 4, 0, 1, 0, 'Active'),
(2, 'Aaron Loeb', 'Engineering Manager', 2, 1, 78, 12, 1, 3, 4, 'Active'),
(3, 'Avery Davis', 'HR Manager', 3, 1, 66, 8, 0, 2, 2, 'Active'),
(4, 'Chiaki Sato', 'Sales Manager', 4, 1, 84, 16, 1, 4, 6, 'Active'),
(5, 'Harper Russo', 'Software Engineer', 2, 2, 82, 18, 2, 3, 5, 'Active'),
(6, 'Juliana Silva', 'QA Engineer', 2, 2, 73, 10, 0, 2, 2, 'Active'),
(7, 'Howard Ong', 'HR Specialist', 3, 3, 61, 7, 0, 2, 1, 'Active'),
(8, 'Drew Feig', 'Recruiter', 3, 3, 80, 14, 1, 3, 3, 'Active'),
(9, 'Yanis Petros', 'People Operations', 3, 3, 69, 6, 0, 2, 1, 'Active'),
(10, 'Yael Amari', 'Sales Executive', 4, 4, 76, 11, 0, 3, 3, 'Active'),
(11, 'Murad Naser', 'Account Executive', 4, 4, 91, 22, 2, 5, 7, 'Active');

INSERT OR IGNORE INTO projects (
    project_id, project_name, department_id, manager_id, status,
    progress_percent, planned_end_date, actual_end_date, workload_pressure
) VALUES
(1, 'HR Automation Rollout', 3, 3, 'In Progress', 62, '2026-03-15', NULL, 78),
(2, 'New CRM Migration', 4, 4, 'In Progress', 54, '2026-03-10', NULL, 85),
(3, 'Internal Reporting Upgrade', 2, 2, 'In Progress', 81, '2026-04-10', NULL, 58),
(4, 'Recruitment Pipeline Refresh', 3, 3, 'In Progress', 43, '2026-03-05', NULL, 82);
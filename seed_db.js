const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'hr_system.db');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

db.exec(`
INSERT INTO departments (department_name) VALUES
('Engineering'),
('Human Resources'),
('Marketing');

INSERT INTO employees (full_name, email, department_id, hire_date, workload_percent)
VALUES
('Ana Markovic', 'ana@company.com', 1, '2026-01-10', 80),
('Luka Petrovic', 'luka@company.com', 1, '2026-02-01', 90),
('Mila Jovanovic', 'mila@company.com', 2, '2026-01-20', 70),
('Nikola Ilic', 'nikola@company.com', 3, '2026-02-15', 60);

INSERT INTO projects (project_name, department_id, start_date, end_date, deadline, status)
VALUES
('HR Analytics Dashboard', 2, '2026-02-01', NULL, '2026-05-15', 'Active'),
('Recruitment Portal Redesign', 2, '2026-01-15', NULL, '2026-04-20', 'Active'),
('Internal Mobile App', 1, '2026-01-05', NULL, '2026-06-30', 'Active'),
('Employer Branding Campaign', 3, '2026-02-10', '2026-03-20', '2026-03-20', 'Completed');

INSERT INTO employee_projects (employee_id, project_id) VALUES
(3, 1),
(3, 2),
(1, 3),
(2, 3),
(4, 4);

INSERT INTO departments (department_name) VALUES
('Engineering'),
('Human Resources'),
('Marketing');

INSERT INTO positions (position_title, department_id, position_level, is_active) VALUES
('Backend Developer', 1, 'Mid', 1),
('Frontend Developer', 1, 'Senior', 1),
('HR Specialist', 2, 'Mid', 1),
('Recruiter', 2, 'Junior', 0),
('Marketing Manager', 3, 'Senior', 1);

INSERT INTO employees (full_name, email, department_id, hire_date, employment_status, workload_percent) VALUES
('Ana Markovic', 'ana@company.com', 1, '2026-01-10', 'active', 80),
('Luka Petrovic', 'luka@company.com', 1, '2026-01-15', 'active', 90),
('Mila Jovanovic', 'mila@company.com', 2, '2026-01-20', 'active', 70),
('Nikola Ilic', 'nikola@company.com', 2, '2026-01-25', 'active', 78),
('Sara Kovac', 'sara@company.com', 3, '2026-02-01', 'active', 74);

INSERT INTO projects (project_name, department_id, start_date, end_date, deadline, status) VALUES
('Recruitment Drive', 1, '2026-03-01', NULL, '2026-04-05', 'Active'),
('Policy Update', 1, '2026-03-05', NULL, '2026-04-20', 'Planning'),
('Internal Portal', 2, '2026-02-15', NULL, '2026-03-30', 'Active'),
('Network Upgrade', 2, '2026-03-10', NULL, '2026-04-14', 'Active'),
('Quarterly Reporting', 3, '2026-03-01', NULL, '2026-04-12', 'Active');

INSERT INTO employee_projects (employee_id, project_id) VALUES
(1, 1),
(2, 1),
(1, 2),
(3, 3),
(4, 3),
(3, 4),
(4, 4),
(5, 5);

`);



console.log('Seed data inserted successfully.');
db.close();
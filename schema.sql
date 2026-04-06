DROP TABLE IF EXISTS actions CASCADE;
DROP TABLE IF EXISTS employee_projects CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS applicants CASCADE;
DROP TABLE IF EXISTS positions CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

CREATE TABLE departments (
  department_id SERIAL PRIMARY KEY,
  department_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE positions (
  position_id SERIAL PRIMARY KEY,
  position_title TEXT NOT NULL,
  department_id INTEGER NOT NULL REFERENCES departments(department_id),
  position_level TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (position_title, department_id)
);

CREATE TABLE applicants (
  applicant_id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  years_experience NUMERIC NOT NULL DEFAULT 0 CHECK (years_experience >= 0),
  current_or_last_position TEXT,
  position_id INTEGER REFERENCES positions(position_id),
  hiring_manager_id INTEGER REFERENCES employees(employee_id),
  application_status TEXT NOT NULL DEFAULT 'applied' CHECK (
    application_status IN (
      'applied',
      'in_review',
      'interview',
      'offered',
      'rejected',
      'withdrawn',
      'hired'
    )
  ),
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

CREATE TABLE employees (
  employee_id SERIAL PRIMARY KEY,
  applicant_id INTEGER UNIQUE REFERENCES applicants(applicant_id),
  full_name TEXT NOT NULL,
  email TEXT,
  department_id INTEGER REFERENCES departments(department_id),
  position_id INTEGER REFERENCES positions(position_id),
  reporting_manager_id INTEGER REFERENCES employees(employee_id),
  hire_date DATE NOT NULL,
  employment_status TEXT NOT NULL DEFAULT 'active' CHECK (
    employment_status IN (
      'active',
      'on_leave',
      'transferred',
      'resigned',
      'terminated'
    )
  ),
  end_date DATE,
  workload_percent INTEGER NOT NULL DEFAULT 0 CHECK (
    workload_percent >= 0 AND workload_percent <= 100
  ),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
  project_id SERIAL PRIMARY KEY,
  project_name TEXT NOT NULL,
  department_id INTEGER NOT NULL REFERENCES departments(department_id),
  start_date DATE,
  end_date DATE,
  deadline DATE,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE employee_projects (
  employee_project_id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
  project_id INTEGER NOT NULL REFERENCES projects(project_id),
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, project_id)
);

CREATE TABLE actions (
  action_id SERIAL PRIMARY KEY,
  applicant_id INTEGER REFERENCES applicants(applicant_id),
  employee_id INTEGER REFERENCES employees(employee_id),
  action_type TEXT NOT NULL CHECK (
    action_type IN (
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
    )
  ),
  old_status TEXT,
  new_status TEXT,
  old_position_id INTEGER REFERENCES positions(position_id),
  new_position_id INTEGER REFERENCES positions(position_id),
  old_department_id INTEGER REFERENCES departments(department_id),
  new_department_id INTEGER REFERENCES departments(department_id),
  action_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  performed_by TEXT,
  notes TEXT,
  CHECK (applicant_id IS NOT NULL OR employee_id IS NOT NULL)
);
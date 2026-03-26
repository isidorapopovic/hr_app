const express = require('express');
const router = express.Router();
const db = require('../db');
const requireLogin = require('../middleware/auth');

/*
  OVERVIEW PAGE
  /departments/overview
*/
router.get('/overview', requireLogin, (req, res) => {
    try {
        const departments = db.prepare(`
            SELECT
                d.department_id,
                d.department_name,

                COUNT(DISTINCT CASE WHEN p.is_active = 1 THEN p.position_id END) AS open_positions,
                COUNT(DISTINCT pr.project_id) AS projects_count,
                COUNT(DISTINCT ep.employee_id) AS people_assigned,
                ROUND(COALESCE(AVG(e.workload_percent), 0), 0) AS avg_workload,

                MIN(
                    CASE
                        WHEN pr.deadline IS NOT NULL AND pr.status != 'Completed' THEN pr.deadline
                        ELSE NULL
                    END
                ) AS nearest_deadline
            FROM departments d
            LEFT JOIN positions p
                ON p.department_id = d.department_id
            LEFT JOIN projects pr
                ON pr.department_id = d.department_id
            LEFT JOIN employee_projects ep
                ON ep.project_id = pr.project_id
            LEFT JOIN employees e
                ON e.employee_id = ep.employee_id
            GROUP BY d.department_id, d.department_name
            ORDER BY d.department_name
        `).all();

        const projects = db.prepare(`
            SELECT
                pr.project_id,
                pr.project_name,
                pr.department_id,
                pr.status,
                pr.deadline,
                COUNT(DISTINCT ep.employee_id) AS assigned_people
            FROM projects pr
            LEFT JOIN employee_projects ep
                ON ep.project_id = pr.project_id
            GROUP BY
                pr.project_id,
                pr.project_name,
                pr.department_id,
                pr.status,
                pr.deadline
            ORDER BY pr.deadline IS NULL, pr.deadline, pr.project_name
        `).all();

        const projectsByDepartment = {};
        for (const project of projects) {
            if (!projectsByDepartment[project.department_id]) {
                projectsByDepartment[project.department_id] = [];
            }
            projectsByDepartment[project.department_id].push(project);
        }

        const enrichedDepartments = departments.map((department) => ({
            ...department,
            projects: projectsByDepartment[department.department_id] || []
        }));

        res.render('departments_overview', {
            title: 'Departments Overview',
            activePage: 'departments-overview',
            departments: enrichedDepartments
        });
    } catch (error) {
        console.error('Error loading departments overview:', error);
        res.status(500).send('Failed to load departments overview.');
    }
});

/*
  /departments
*/
router.get('/', requireLogin, (req, res) => {
    res.redirect('/departments/overview');
});

/*
  SINGLE DEPARTMENT PAGE
  /departments/:department_id
*/
router.get('/:department_id', requireLogin, (req, res) => {
    try {
        const { department_id } = req.params;

        const department = db.prepare(`
            SELECT
                d.department_id,
                d.department_name,
                COUNT(DISTINCT CASE WHEN p.is_active = 1 THEN p.position_id END) AS open_positions,
                COUNT(DISTINCT pr.project_id) AS projects_count,
                COUNT(DISTINCT ep.employee_id) AS people_assigned,
                ROUND(COALESCE(AVG(e.workload_percent), 0), 0) AS avg_workload
            FROM departments d
            LEFT JOIN positions p
                ON p.department_id = d.department_id
            LEFT JOIN projects pr
                ON pr.department_id = d.department_id
            LEFT JOIN employee_projects ep
                ON ep.project_id = pr.project_id
            LEFT JOIN employees e
                ON e.employee_id = ep.employee_id
            WHERE d.department_id = ?
            GROUP BY d.department_id, d.department_name
        `).get(department_id);

        if (!department) {
            return res.status(404).send('Department not found.');
        }

        const projects = db.prepare(`
            SELECT
                pr.project_id,
                pr.project_name,
                pr.start_date,
                pr.end_date,
                pr.deadline,
                pr.status,
                COUNT(DISTINCT ep.employee_id) AS assigned_people
            FROM projects pr
            LEFT JOIN employee_projects ep
                ON ep.project_id = pr.project_id
            WHERE pr.department_id = ?
            GROUP BY
                pr.project_id,
                pr.project_name,
                pr.start_date,
                pr.end_date,
                pr.deadline,
                pr.status
            ORDER BY pr.deadline IS NULL, pr.deadline, pr.project_name
        `).all(department_id);

        const employees = db.prepare(`
            SELECT DISTINCT
                e.employee_id,
                e.full_name,
                e.email,
                e.workload_percent,
                e.employment_status
            FROM employees e
            WHERE e.department_id = ?
            ORDER BY e.full_name
        `).all(department_id);

        res.render('department_detail', {
            title: department.department_name,
            activePage: 'departments',
            department,
            projects,
            employees
        });
    } catch (error) {
        console.error('Error loading department detail:', error);
        res.status(500).send('Failed to load department.');
    }
});

module.exports = router;
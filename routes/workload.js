const express = require('express');
const router = express.Router();
const db = require('../db');
const requireLogin = require('../middleware/auth');

router.get('/', requireLogin, (req, res) => {
    let projectAssignments = [];
    let employeesWithoutProjects = [];

    try {
        projectAssignments = db.prepare(`
      SELECT
        p.id AS project_id,
        p.name AS project_name,
        p.deadline,
        p.status,
        d.name AS department_name,
        COUNT(ep.employee_id) AS assigned_people,
        GROUP_CONCAT(e.full_name, ', ') AS assigned_names
      FROM projects p
      LEFT JOIN departments d
        ON p.department_id = d.id
      LEFT JOIN employee_projects ep
        ON p.id = ep.project_id
      LEFT JOIN employees e
        ON ep.employee_id = e.id
      GROUP BY p.id, p.name, p.deadline, p.status, d.name
      ORDER BY p.status, p.name
    `).all();

        employeesWithoutProjects = db.prepare(`
      SELECT
        e.id,
        e.full_name,
        e.email,
        e.workload_percent,
        d.name AS department_name
      FROM employees e
      LEFT JOIN departments d
        ON e.department_id = d.id
      LEFT JOIN employee_projects ep
        ON e.id = ep.employee_id
      WHERE ep.id IS NULL
      ORDER BY e.full_name
    `).all();
    } catch (err) {
        console.error('Workload page error:', err.message);
    }

    res.render('workload', { projectAssignments, employeesWithoutProjects });
});

module.exports = router;
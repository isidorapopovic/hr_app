const express = require('express');
const router = express.Router();
const db = require('../db');
const requireLogin = require('../middleware/auth');

router.get('/', requireLogin, async (req, res) => {
    try {
        const projectAssignments = await db.all(`
      SELECT
        p.project_id,
        p.project_name,
        p.deadline,
        p.status,
        d.department_name,
        COUNT(ep.employee_id)::int AS assigned_people,
        STRING_AGG(e.full_name, ', ' ORDER BY e.full_name) AS assigned_names
      FROM projects p
      LEFT JOIN departments d ON p.department_id = d.department_id
      LEFT JOIN employee_projects ep ON p.project_id = ep.project_id
      LEFT JOIN employees e ON ep.employee_id = e.employee_id
      GROUP BY p.project_id, p.project_name, p.deadline, p.status, d.department_name
      ORDER BY p.status, p.project_name
    `);

        const employeesWithoutProjects = await db.all(`
      SELECT
        e.employee_id,
        e.full_name,
        e.email,
        e.workload_percent,
        d.department_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.department_id
      LEFT JOIN employee_projects ep ON e.employee_id = ep.employee_id
      WHERE ep.employee_id IS NULL
      ORDER BY e.full_name
    `);

        const totalProjects = projectAssignments.length;
        const overloadedProjects = projectAssignments.filter(
            (project) => Number(project.assigned_people || 0) >= 5
        ).length;

        res.render('workload', {
            title: 'Workload',
            activePage: 'workload',
            isLoggedIn: true,
            projectAssignments,
            employeesWithoutProjects,
            totalProjects,
            overloadedProjects
        });
    } catch (err) {
        console.error('Workload page error:', err.message);
        res.status(500).send(`Failed to load workload page: ${err.message}`);
    }
});

module.exports = router;
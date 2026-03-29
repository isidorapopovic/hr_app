const express = require('express');
const router = express.Router();
const db = require('../db');
const requireLogin = require('../middleware/auth');
const { buildOrgTree } = require('../services/orgService');

router.get('/', requireLogin, async (req, res) => {
    try {
        const employees = await db.all(`
      SELECT
        e.employee_id,
        e.full_name,
        p.position_title AS job_title,
        COALESCE(e.department_id, p.department_id) AS department_id,
        NULL AS manager_id,
        d.department_name
      FROM employees e
      LEFT JOIN positions p
        ON e.position_id = p.position_id
      LEFT JOIN departments d
        ON COALESCE(e.department_id, p.department_id) = d.department_id
      WHERE e.employment_status = 'active'
      ORDER BY d.department_name, e.full_name
    `);

        const hasManagerData = false;
        const tree = buildOrgTree(employees, null);

        const departmentGroups = employees.reduce((acc, employee) => {
            const key = employee.department_name || 'Unassigned';
            if (!acc[key]) acc[key] = [];
            acc[key].push(employee);
            return acc;
        }, {});

        res.render('organisation', {
            title: 'Organisation',
            activePage: 'organisation',
            hasManagerData,
            tree,
            departmentGroups,
            totalEmployees: employees.length
        });
    } catch (error) {
        console.error('Organisation route error:', error);
        res.status(500).send(`Failed to load organisation chart: ${error.message}`);
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const db = require('../db');
const requireLogin = require('../middleware/auth');
const { buildOrgTree } = require('../services/orgService');

router.get('/', requireLogin, (req, res) => {
    try {
        let employees = [];

        try {
            employees = db.prepare(`
                SELECT
                    e.employee_id,
                    e.full_name,
                    e.job_title,
                    e.department_id,
                    e.manager_id,
                    d.department_name
                FROM employees e
                LEFT JOIN departments d
                    ON e.department_id = d.department_id
                WHERE e.employment_status = 'active'
                ORDER BY e.full_name
            `).all();
        } catch (error) {
            employees = db.prepare(`
                SELECT
                    e.employee_id,
                    e.full_name,
                    e.job_title,
                    e.department_id,
                    NULL AS manager_id,
                    d.department_name
                FROM employees e
                LEFT JOIN departments d
                    ON e.department_id = d.department_id
                WHERE e.employment_status = 'active'
                ORDER BY e.full_name
            `).all();
        }

        const hasManagerData = employees.some(
            (employee) => employee.manager_id !== null && employee.manager_id !== undefined
        );

        let tree;
        if (hasManagerData) {
            tree = buildOrgTree(employees, null);
        } else {
            tree = employees.map((employee) => ({
                ...employee,
                children: []
            }));
        }

        res.render('organisation', {
            title: 'Organisation Chart',
            activePage: 'organisation',
            tree
        });
    } catch (error) {
        console.error('Organisation route error:', error);
        res.status(500).send('Failed to load organisation chart.');
    }
});

module.exports = router;
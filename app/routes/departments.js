const express = require('express');
const router = express.Router();
const db = require('../db');
const requireLogin = require('../middleware/auth');

router.get('/', requireLogin, (req, res) => {
    let departments = [];

    try {
        departments = db.prepare(`
      SELECT
        d.department_id,
        d.department_name,
        d.created_at,
        COUNT(p.position_id) AS positions_count
      FROM departments d
      LEFT JOIN positions p
        ON d.department_id = p.department_id
      GROUP BY d.department_id, d.department_name, d.created_at
      ORDER BY d.department_name
    `).all();
    } catch (err) {
        console.error('Departments query error:', err.message);
        return res.status(500).send(`Departments page error: ${err.message}`);
    }

    res.render('departments', { departments });
});

router.get('/overview', requireLogin, (req, res) => {
    let overview = [];

    try {
        overview = db.prepare(`
      SELECT
        d.department_id,
        d.department_name,
        COUNT(DISTINCT p.position_id) AS positions_count,
        COUNT(DISTINCT a.applicant_id) AS applicants_count,
        COUNT(DISTINCT CASE WHEN a.application_status IN ('applied', 'in_review', 'interview', 'offered') THEN a.applicant_id END) AS in_process_count,
        COUNT(DISTINCT CASE WHEN a.application_status = 'hired' THEN a.applicant_id END) AS hires_count,
        COUNT(DISTINCT CASE WHEN e.employment_status = 'active' THEN e.employee_id END) AS active_employee_count
      FROM departments d
      LEFT JOIN positions p
        ON d.department_id = p.department_id
      LEFT JOIN applicants a
        ON p.position_id = a.position_id
      LEFT JOIN employees e
        ON p.position_id = e.position_id
      GROUP BY d.department_id, d.department_name
      ORDER BY d.department_name
    `).all();
    } catch (err) {
        console.error('Department overview query error:', err.message);
        return res.status(500).send(`Department overview error: ${err.message}`);
    }

    res.render('department_overview', { overview });
});

module.exports = router;
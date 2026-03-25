const express = require('express');
const router = express.Router();
const db = require('../db');
const requireLogin = require('../middleware/auth');

router.get('/', requireLogin, (req, res) => {
    const stats = {
        total_applicants: 0,
        in_process: 0,
        hired_count: 0,
        active_employees: 0,
        avg_days_to_hire: 0,
        offer_acceptance_rate: 0
    };

    let statusCounts = [];
    let departmentSummary = [];
    let recentActions = [];

    try {
        stats.total_applicants = db.prepare(`
      SELECT COUNT(*) AS count
      FROM applicants
    `).get().count;

        stats.in_process = db.prepare(`
      SELECT COUNT(*) AS count
      FROM applicants
      WHERE application_status IN ('applied', 'in_review', 'interview', 'offered')
    `).get().count;

        stats.hired_count = db.prepare(`
      SELECT COUNT(*) AS count
      FROM applicants
      WHERE application_status = 'hired'
    `).get().count;

        stats.active_employees = db.prepare(`
      SELECT COUNT(*) AS count
      FROM employees
      WHERE employment_status = 'active'
    `).get().count;

        const avgDaysRow = db.prepare(`
      SELECT AVG(julianday(e.hire_date) - julianday(a.applied_at)) AS avg_days
      FROM employees e
      JOIN applicants a
        ON e.applicant_id = a.applicant_id
      WHERE e.hire_date IS NOT NULL
        AND a.applied_at IS NOT NULL
    `).get();

        stats.avg_days_to_hire = avgDaysRow && avgDaysRow.avg_days
            ? Number(avgDaysRow.avg_days).toFixed(1)
            : 0;

        const offersRow = db.prepare(`
      SELECT
        SUM(CASE WHEN application_status IN ('offered', 'hired') THEN 1 ELSE 0 END) AS offers_total,
        SUM(CASE WHEN application_status = 'hired' THEN 1 ELSE 0 END) AS hires_total
      FROM applicants
    `).get();

        const offersTotal = offersRow?.offers_total || 0;
        const hiresTotal = offersRow?.hires_total || 0;

        stats.offer_acceptance_rate = offersTotal > 0
            ? ((hiresTotal / offersTotal) * 100).toFixed(1)
            : 0;

        statusCounts = db.prepare(`
      SELECT application_status, COUNT(*) AS total
      FROM applicants
      GROUP BY application_status
      ORDER BY total DESC, application_status
    `).all();

        departmentSummary = db.prepare(`
      SELECT
        d.department_name,
        COUNT(a.applicant_id) AS applicants,
        SUM(CASE WHEN a.application_status = 'hired' THEN 1 ELSE 0 END) AS hires
      FROM departments d
      LEFT JOIN positions p
        ON d.department_id = p.department_id
      LEFT JOIN applicants a
        ON p.position_id = a.position_id
      GROUP BY d.department_id, d.department_name
      ORDER BY d.department_name
    `).all();

        recentActions = db.prepare(`
      SELECT
        ac.action_date,
        ac.action_type,
        ac.notes,
        ac.performed_by,
        COALESCE(ap.full_name, e.full_name) AS person_name
      FROM actions ac
      LEFT JOIN applicants ap
        ON ac.applicant_id = ap.applicant_id
      LEFT JOIN employees e
        ON ac.employee_id = e.employee_id
      ORDER BY ac.action_date DESC
      LIMIT 10
    `).all();
    } catch (err) {
        console.error('Dashboard query error:', err.message);
    }

    res.render('dashboard', {
        stats,
        statusCounts,
        departmentSummary,
        recentActions
    });
});

module.exports = router;
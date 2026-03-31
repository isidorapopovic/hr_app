const express = require('express');
const router = express.Router();
const db = require('../db');
const requireLogin = require('../middleware/auth');

router.get('/', requireLogin, async (req, res) => {
    const stats = {
        totalApplicants: 0,
        inProcess: 0,
        hired: 0,
        activeEmployees: 0,
        avgDaysToHire: 0,
        offerAcceptanceRate: 0,
        departmentsCount: 0,
        openJobs: 0
    };

    let statusCounts = [];
    let departmentSummary = [];
    let recentActions = [];

    try {
        const totalApplicantsRow = await db.get(
            `SELECT COUNT(*)::int AS count FROM applicants`
        );
        stats.totalApplicants = totalApplicantsRow?.count || 0;

        const inProcessRow = await db.get(
            `SELECT COUNT(*)::int AS count
       FROM applicants
       WHERE application_status IN ('applied', 'in_review', 'interview', 'offered')`
        );
        stats.inProcess = inProcessRow?.count || 0;

        const hiredRow = await db.get(
            `SELECT COUNT(*)::int AS count
       FROM applicants
       WHERE application_status = 'hired'`
        );
        stats.hired = hiredRow?.count || 0;

        const activeEmployeesRow = await db.get(
            `SELECT COUNT(*)::int AS count
       FROM employees
       WHERE employment_status = 'active'`
        );
        stats.activeEmployees = activeEmployeesRow?.count || 0;

        const avgDaysRow = await db.get(
            `SELECT AVG((e.hire_date::date - a.applied_at::date)) AS avg_days
       FROM employees e
       JOIN applicants a ON e.applicant_id = a.applicant_id
       WHERE e.hire_date IS NOT NULL
         AND a.applied_at IS NOT NULL`
        );
        stats.avgDaysToHire =
            avgDaysRow?.avg_days !== null && avgDaysRow?.avg_days !== undefined
                ? Number(avgDaysRow.avg_days).toFixed(1)
                : 0;

        const offersRow = await db.get(
            `SELECT
         SUM(CASE WHEN application_status IN ('offered', 'hired') THEN 1 ELSE 0 END)::int AS offers_total,
         SUM(CASE WHEN application_status = 'hired' THEN 1 ELSE 0 END)::int AS hires_total
       FROM applicants`
        );
        const offersTotal = offersRow?.offers_total || 0;
        const hiresTotal = offersRow?.hires_total || 0;
        stats.offerAcceptanceRate =
            offersTotal > 0 ? ((hiresTotal / offersTotal) * 100).toFixed(1) : 0;

        const departmentsCountRow = await db.get(
            `SELECT COUNT(*)::int AS count FROM departments`
        );
        stats.departmentsCount = departmentsCountRow?.count || 0;

        const openJobsRow = await db.get(
            `SELECT COUNT(*)::int AS count
       FROM positions
       WHERE LOWER(COALESCE(status, 'open')) = 'open'`
        );
        stats.openJobs = openJobsRow?.count || 0;

        statusCounts = await db.all(
            `SELECT application_status, COUNT(*)::int AS total
       FROM applicants
       GROUP BY application_status
       ORDER BY total DESC, application_status`
        );

        departmentSummary = await db.all(
            `SELECT
         d.department_name,
         COUNT(a.applicant_id)::int AS applicants,
         SUM(CASE WHEN a.application_status = 'hired' THEN 1 ELSE 0 END)::int AS hires
       FROM departments d
       LEFT JOIN positions p ON d.department_id = p.department_id
       LEFT JOIN applicants a ON p.position_id = a.position_id
       GROUP BY d.department_id, d.department_name
       ORDER BY d.department_name`
        );

        recentActions = await db.all(
            `SELECT
         ac.action_date,
         ac.action_type,
         ac.notes,
         ac.performed_by,
         COALESCE(ap.full_name, e.full_name) AS person_name
       FROM actions ac
       LEFT JOIN applicants ap ON ac.applicant_id = ap.applicant_id
       LEFT JOIN employees e ON ac.employee_id = e.employee_id
       ORDER BY ac.action_date DESC
       LIMIT 10`
        );
    } catch (err) {
        console.error('Dashboard query error:', err.message);
    }

    res.render('dashboard', {
        title: 'Dashboard',
        activePage: 'dashboard',
        stats,
        statusCounts,
        departmentSummary,
        recentActions
    });
});

module.exports = router;
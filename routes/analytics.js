const express = require('express');
const router = express.Router();
const db = require('../db');
const requireLogin = require('../middleware/auth');

router.get('/workload', requireLogin, async (req, res) => {
    try {
        const employees = await db.all(`
      SELECT
        e.employee_id,
        e.full_name,
        e.email,
        d.department_name,
        p.position_title
      FROM employees e
      LEFT JOIN positions p ON e.position_id = p.position_id
      LEFT JOIN departments d ON e.department_id = d.department_id
      WHERE e.employment_status = 'active'
      ORDER BY e.full_name
    `);

        res.render('analytics_workload', {
            activePage: 'analytics',
            isLoggedIn: true,
            employees
        });
    } catch (err) {
        console.error('Analytics page error:', err.message);
        res.status(500).send(`Analytics page error: ${err.message}`);
    }
});

router.get('/api/workload', requireLogin, async (req, res) => {
    try {
        const employeeId = req.query.employee_id ? Number(req.query.employee_id) : null;
        const startDate = req.query.start_date || null;
        const endDate = req.query.end_date || null;

        const params = [];
        const where = [];

        if (employeeId) {
            params.push(employeeId);
            where.push(`es.employee_id = $${params.length}`);
        }

        if (startDate) {
            params.push(startDate);
            where.push(`es.signal_date >= $${params.length}`);
        }

        if (endDate) {
            params.push(endDate);
            where.push(`es.signal_date <= $${params.length}`);
        }

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const rows = await db.all(
            `
        SELECT
          es.employee_id,
          e.full_name,
          e.email,
          es.signal_date,
          es.absent_days,
          es.sick_leave_days,
          es.overtime_hours,
          es.meeting_hours,
          es.pto_days_used,
          es.survey_sentiment,
          es.manager_feedback_score,
          es.project_intensity
        FROM employee_signals es
        LEFT JOIN employees e ON es.employee_id = e.employee_id
        ${whereClause}
        ORDER BY es.signal_date ASC, e.full_name ASC
      `,
            params
        );

        const summary = await db.get(
            `
        SELECT
          COUNT(*) AS total_rows,
          COUNT(DISTINCT es.employee_id) AS employees_count,
          ROUND(AVG(es.overtime_hours)::numeric, 2) AS avg_overtime,
          ROUND(AVG(es.meeting_hours)::numeric, 2) AS avg_meeting_hours,
          ROUND(AVG(es.absent_days)::numeric, 2) AS avg_absent_days,
          ROUND(AVG(es.sick_leave_days)::numeric, 2) AS avg_sick_leave_days,
          ROUND(AVG(es.pto_days_used)::numeric, 2) AS avg_pto_days,
          ROUND(AVG(es.survey_sentiment)::numeric, 2) AS avg_sentiment,
          ROUND(AVG(es.manager_feedback_score)::numeric, 2) AS avg_manager_feedback,
          ROUND(AVG(es.project_intensity)::numeric, 2) AS avg_project_intensity
        FROM employee_signals es
        ${whereClause}
      `,
            params
        );

        res.json({
            filters: {
                employee_id: employeeId,
                start_date: startDate,
                end_date: endDate
            },
            summary,
            rows
        });
    } catch (err) {
        console.error('Analytics API error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
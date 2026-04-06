const express = require('express');
const router = express.Router();
const db = require('../db');
const requireLogin = require('../middleware/auth');
const {
    enrichBurnoutEmployees,
    buildBurnoutSummary,
    buildTeamFlags
} = require('../services/burnoutPredictionService');

router.get('/', requireLogin, async (req, res) => {
    try {
        const employeesRaw = await db.all(`
      WITH direct_reports AS (
        SELECT
          reporting_manager_id AS manager_id,
          COUNT(*)::int AS manager_span
        FROM employees
        WHERE reporting_manager_id IS NOT NULL
          AND employment_status = 'active'
        GROUP BY reporting_manager_id
      ),
      employee_project_stats AS (
        SELECT
          e.employee_id,
          COUNT(DISTINCT ep.project_id)::int AS project_count,
          COUNT(
            DISTINCT CASE
              WHEN p.deadline IS NOT NULL
               AND p.status <> 'Completed'
               AND p.deadline >= CURRENT_DATE
               AND p.deadline <= CURRENT_DATE + INTERVAL '7 days'
              THEN p.project_id
            END
          )::int AS urgent_projects,
          COUNT(
            DISTINCT CASE
              WHEN p.deadline IS NOT NULL
               AND p.status <> 'Completed'
               AND p.deadline < CURRENT_DATE
              THEN p.project_id
            END
          )::int AS delayed_projects
        FROM employees e
        LEFT JOIN employee_projects ep ON e.employee_id = ep.employee_id
        LEFT JOIN projects p ON ep.project_id = p.project_id
        GROUP BY e.employee_id
      ),
      recent_changes AS (
        SELECT
          a.employee_id,
          MAX(
            CASE
              WHEN a.action_type IN ('position_changed', 'promoted', 'transferred')
               AND a.action_date >= CURRENT_DATE - INTERVAL '90 days'
              THEN 1
              ELSE 0
            END
          )::int AS recent_role_change
        FROM actions a
        WHERE a.employee_id IS NOT NULL
        GROUP BY a.employee_id
      )
      SELECT
        e.employee_id,
        e.full_name,
        e.hire_date,
        e.workload_percent,
        e.reporting_manager_id,
        p.position_title AS job_title,
        d.department_name,
        COALESCE(eps.project_count, 0) AS project_count,
        COALESCE(eps.urgent_projects, 0) AS urgent_projects,
        COALESCE(eps.delayed_projects, 0) AS delayed_projects,
        COALESCE(dr.manager_span, 0) AS manager_span,
        COALESCE(rc.recent_role_change, 0) AS recent_role_change,
        CASE
          WHEN e.hire_date IS NOT NULL THEN (CURRENT_DATE - e.hire_date)
          ELSE NULL
        END AS tenure_days
      FROM employees e
      LEFT JOIN positions p ON e.position_id = p.position_id
      LEFT JOIN departments d ON COALESCE(e.department_id, p.department_id) = d.department_id
      LEFT JOIN employee_project_stats eps ON e.employee_id = eps.employee_id
      LEFT JOIN direct_reports dr ON e.reporting_manager_id = dr.manager_id
      LEFT JOIN recent_changes rc ON e.employee_id = rc.employee_id
      WHERE e.employment_status = 'active'
      ORDER BY e.full_name
    `);

        const employees = enrichBurnoutEmployees(employeesRaw).sort(
            (a, b) => b.burnout_score - a.burnout_score
        );

        const summary = buildBurnoutSummary(employees);
        const teams = buildTeamFlags(employees);

        const recommendations = [];
        employees.slice(0, 5).forEach((employee) => {
            if (employee.burnout_risk !== 'Low') {
                recommendations.push({
                    severity: employee.burnout_risk,
                    title: `${employee.full_name} needs a workload check`,
                    message: `${employee.full_name} scored ${employee.burnout_score}/100. Main signals: ${employee.top_reasons.join(', ')}.`
                });
            }
        });

        res.render('burnout_prediction', {
            title: 'Burnout Prediction',
            activePage: 'burnout-prediction',
            isLoggedIn: true,
            summary,
            employees,
            teams,
            recommendations
        });
    } catch (error) {
        console.error('Burnout prediction route error:', error);
        res.status(500).send(`Failed to load burnout prediction page: ${error.message}`);
    }
});

module.exports = router;
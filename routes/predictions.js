const express = require('express');
const router = express.Router();
const db = require('../db');
const requireLogin = require('../middleware/auth');

const {
    decorateProjects,
    buildEmployeeRiskCards,
    buildTeamHeatmap,
    buildCapacityDemand,
    buildManagerScorecard,
    buildPredictionCalendar
} = require('../services/predictionService');

router.get('/', requireLogin, async (req, res) => {
    try {
        const departments = await db.all(`
      SELECT
        department_id,
        department_name
      FROM departments
      ORDER BY department_name
    `);

        const employeesRaw = await db.all(`
      SELECT
        e.employee_id,
        e.full_name,
        e.email,
        e.department_id,
        e.position_id,
        e.workload_percent,
        e.employment_status,
        p.position_title AS job_title,
        d.department_name,
        COUNT(DISTINCT ep.project_id) AS active_projects,
        COUNT(DISTINCT CASE
          WHEN pr.deadline < CURRENT_DATE
           AND COALESCE(LOWER(pr.status), '') <> 'completed'
          THEN pr.project_id
        END) AS overdue_projects,
        COUNT(DISTINCT CASE
          WHEN pr.deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
           AND COALESCE(LOWER(pr.status), '') <> 'completed'
          THEN pr.project_id
        END) AS urgent_projects
      FROM employees e
      LEFT JOIN positions p
        ON e.position_id = p.position_id
      LEFT JOIN departments d
        ON e.department_id = d.department_id
      LEFT JOIN employee_projects ep
        ON e.employee_id = ep.employee_id
      LEFT JOIN projects pr
        ON ep.project_id = pr.project_id
      WHERE e.employment_status = 'active'
      GROUP BY
        e.employee_id,
        e.full_name,
        e.email,
        e.department_id,
        e.position_id,
        e.workload_percent,
        e.employment_status,
        p.position_title,
        d.department_name
      ORDER BY e.full_name
    `);

        const projectsRaw = await db.all(`
      SELECT
        p.project_id,
        p.project_name,
        p.department_id,
        p.deadline,
        p.status,
        d.department_name,
        COUNT(DISTINCT ep.employee_id) AS assigned_people
      FROM projects p
      LEFT JOIN departments d
        ON p.department_id = d.department_id
      LEFT JOIN employee_projects ep
        ON p.project_id = ep.project_id
      GROUP BY
        p.project_id,
        p.project_name,
        p.department_id,
        p.deadline,
        p.status,
        d.department_name
      ORDER BY p.deadline NULLS LAST, p.project_name
    `);

        const managers = await db.all(`
      SELECT
        e.employee_id,
        e.full_name,
        e.department_id,
        d.department_name,
        p.position_title
      FROM employees e
      LEFT JOIN positions p
        ON e.position_id = p.position_id
      LEFT JOIN departments d
        ON e.department_id = d.department_id
      WHERE e.employment_status = 'active'
        AND p.position_title ILIKE '%manager%'
      ORDER BY d.department_name, e.full_name
    `);

        const projects = decorateProjects(projectsRaw);
        const employeeRiskCards = buildEmployeeRiskCards(employeesRaw);
        const teamHeatmap = buildTeamHeatmap(departments, employeeRiskCards);
        const capacityDemand = buildCapacityDemand(departments, employeeRiskCards, projects);
        const managerScorecard = buildManagerScorecard(managers, employeeRiskCards, capacityDemand);
        const calendar = buildPredictionCalendar(projects, employeeRiskCards);

        const summary = {
            totalEmployees: employeeRiskCards.length,
            highRiskEmployees: employeeRiskCards.filter((e) => e.predicted_risk === 'High').length,
            tightDepartments: capacityDemand.filter((d) => d.status !== 'Healthy').length,
            overdueProjects: projects.filter((p) => p.project_status_group === 'Overdue').length
        };

        res.render('predictions', {
            title: 'Predictions',
            activePage: 'predictions',
            summary,
            calendar,
            employeeRiskCards,
            teamHeatmap,
            capacityDemand,
            managerScorecard
        });
    } catch (error) {
        console.error('Predictions route error:', error);
        res.status(500).send(`Failed to load predictions page: ${error.message}`);
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const db = require('../db');
const requireLogin = require('../middleware/auth');
const {
    enrichEmployees,
    enrichProjects,
    buildDepartmentInsights,
    generateRecommendations
} = require('../services/insightsService');

router.get('/', requireLogin, async (req, res) => {
    try {
        const departments = await db.all(`
      SELECT department_id, department_name
      FROM departments
      ORDER BY department_name
    `);

        const employeesRaw = await db.all(`
      SELECT
        e.employee_id,
        e.full_name,
        p.position_title AS job_title,
        COALESCE(e.department_id, p.department_id) AS department_id,
        e.workload_percent,
        e.employment_status,
        d.department_name
      FROM employees e
      LEFT JOIN positions p
        ON e.position_id = p.position_id
      LEFT JOIN departments d
        ON COALESCE(e.department_id, p.department_id) = d.department_id
      WHERE e.employment_status = 'active'
      ORDER BY e.full_name
    `);

        const projectsRaw = await db.all(`
      SELECT
        p.project_id,
        p.project_name,
        p.department_id,
        p.status,
        p.deadline,
        d.department_name
      FROM projects p
      LEFT JOIN departments d
        ON p.department_id = d.department_id
      ORDER BY p.deadline NULLS LAST, p.project_name
    `);

        const employees = enrichEmployees(employeesRaw);
        const projects = enrichProjects(projectsRaw);
        const departmentInsights = buildDepartmentInsights(departments, employees, projects);
        const recommendations = generateRecommendations(employees, departmentInsights, projects);

        const summary = {
            totalEmployees: employees.length,
            highRiskEmployees: employees.filter((e) => e.burnout_risk === 'High').length,
            overloadedDepartments: departmentInsights.filter((d) => d.status === 'Overloaded').length,
            delayedProjects: projects.filter(
                (p) => p.delay_status === 'Delayed' || p.delay_status === 'At Risk'
            ).length
        };

        res.render('insights', {
            title: 'Workload Insights',
            activePage: 'insights',
            summary,
            employees,
            departments: departmentInsights,
            projects,
            recommendations
        });
    } catch (error) {
        console.error('Insights route error:', error);
        res.status(500).send(`Failed to load insights page: ${error.message}`);
    }
});

module.exports = router;
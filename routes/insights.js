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

router.get('/', requireLogin, (req, res) => {
    try {
        const departments = db.prepare(`
            SELECT
                department_id,
                department_name
            FROM departments
            ORDER BY department_name
        `).all();

        const employeesRaw = db.prepare(`
            SELECT
                e.employee_id,
                e.full_name,
                e.job_title,
                e.department_id,
                e.workload_percent,
                e.employment_status,
                d.department_name
            FROM employees e
            LEFT JOIN departments d
                ON e.department_id = d.department_id
            WHERE e.employment_status = 'active'
            ORDER BY e.full_name
        `).all();

        const projectsRaw = db.prepare(`
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
            ORDER BY p.deadline IS NULL, p.deadline, p.project_name
        `).all();

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
        res.status(500).send('Failed to load insights page.');
    }
});

module.exports = router;
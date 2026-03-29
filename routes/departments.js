const express = require('express');
const router = express.Router();
const db = require('../db');

/*
  OVERVIEW PAGE
  /departments/overview
*/
router.get('/overview', async (req, res) => {
    try {
        const departments = await db.all(`
      SELECT
        d.department_id,
        d.department_name,
        COUNT(DISTINCT CASE WHEN p.is_active = 1 THEN p.position_id END) AS open_positions,
        COUNT(DISTINCT pr.project_id) AS projects_count,
        COUNT(DISTINCT ep.employee_id) AS people_assigned,
        ROUND(COALESCE(AVG(e.workload_percent), 0), 0) AS avg_workload,
        MIN(
          CASE
            WHEN pr.deadline IS NOT NULL AND pr.status <> 'Completed' THEN pr.deadline
            ELSE NULL
          END
        ) AS nearest_deadline
      FROM departments d
      LEFT JOIN positions p
        ON p.department_id = d.department_id
      LEFT JOIN projects pr
        ON pr.department_id = d.department_id
      LEFT JOIN employees e
        ON e.department_id = d.department_id
      LEFT JOIN employee_projects ep
        ON ep.employee_id = e.employee_id
      GROUP BY d.department_id, d.department_name
      ORDER BY d.department_name
    `);

        res.render('departments_overview', {
            activePage: 'departments',
            isLoggedIn: true,
            departments
        });
    } catch (err) {
        console.error('Departments overview error:', err);
        res.status(500).send('Failed to load departments overview.');
    }
});

/*
  DEPARTMENT DETAIL PAGE
  /departments/:departmentId
*/
router.get('/:departmentId', async (req, res) => {
    try {
        const { departmentId } = req.params;

        const department = await db.get(
            `
      SELECT
        department_id,
        department_name,
        created_at
      FROM departments
      WHERE department_id = $1
      `,
            [departmentId]
        );

        if (!department) {
            return res.status(404).send('Department not found');
        }

        const positions = await db.all(
            `
      SELECT
        position_id,
        position_title,
        position_level,
        is_active,
        created_at
      FROM positions
      WHERE department_id = $1
      ORDER BY position_title
      `,
            [departmentId]
        );

        const employees = await db.all(
            `
      SELECT
        e.employee_id,
        e.full_name,
        e.email,
        e.hire_date,
        e.employment_status,
        e.workload_percent,
        p.position_title,
        p.position_level
      FROM employees e
      LEFT JOIN positions p
        ON p.position_id = e.position_id
      WHERE e.department_id = $1
      ORDER BY e.full_name
      `,
            [departmentId]
        );

        const projects = await db.all(
            `
      SELECT
        project_id,
        project_name,
        start_date,
        end_date,
        deadline,
        status
      FROM projects
      WHERE department_id = $1
      ORDER BY project_name
      `,
            [departmentId]
        );

        res.render('department_detail', {
            activePage: 'departments',
            isLoggedIn: true,
            department,
            positions,
            employees,
            projects
        });
    } catch (err) {
        console.error('Department detail error:', err);
        res.status(500).send('Failed to load department detail.');
    }
});

module.exports = router;
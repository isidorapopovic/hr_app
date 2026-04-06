const express = require('express');
const router = express.Router();
const db = require('../db');
const requireLogin = require('../middleware/auth');

const EMPLOYEE_STATUSES = [
    'active',
    'on_leave',
    'transferred',
    'resigned',
    'terminated'
];

router.get('/', requireLogin, async (req, res) => {
    const selectedStatus = req.query.status || '';
    let employees = [];

    try {
        if (selectedStatus && EMPLOYEE_STATUSES.includes(selectedStatus)) {
            employees = await db.all(
                `
        SELECT
          e.employee_id,
          e.full_name,
          e.hire_date,
          e.employment_status,
          p.position_title,
          d.department_name,
          rm.full_name AS reporting_manager_name
        FROM employees e
        LEFT JOIN positions p ON e.position_id = p.position_id
        LEFT JOIN departments d ON p.department_id = d.department_id
        LEFT JOIN employees rm ON e.reporting_manager_id = rm.employee_id
        WHERE e.employment_status = $1
        ORDER BY e.hire_date DESC, e.full_name
        `,
                [selectedStatus]
            );
        } else {
            employees = await db.all(`
        SELECT
          e.employee_id,
          e.full_name,
          e.hire_date,
          e.employment_status,
          p.position_title,
          d.department_name,
          rm.full_name AS reporting_manager_name
        FROM employees e
        LEFT JOIN positions p ON e.position_id = p.position_id
        LEFT JOIN departments d ON p.department_id = d.department_id
        LEFT JOIN employees rm ON e.reporting_manager_id = rm.employee_id
        ORDER BY e.hire_date DESC, e.full_name
      `);
        }
    } catch (err) {
        console.error('Employees query error:', err.message);
        return res.status(500).send(`Employees page error: ${err.message}`);
    }

    res.render('employees', {
        activePage: 'employees',
        isLoggedIn: true,
        employees,
        statuses: EMPLOYEE_STATUSES,
        selectedStatus
    });
});

router.get('/:id', requireLogin, async (req, res) => {
    const { id } = req.params;

    try {
        const employee = await db.get(
            `
      SELECT
        e.*,
        p.position_title,
        p.position_id,
        d.department_name,
        rm.full_name AS reporting_manager_name
      FROM employees e
      LEFT JOIN positions p ON e.position_id = p.position_id
      LEFT JOIN departments d ON p.department_id = d.department_id
      LEFT JOIN employees rm ON e.reporting_manager_id = rm.employee_id
      WHERE e.employee_id = $1
      `,
            [id]
        );

        if (!employee) {
            return res.status(404).send('Employee not found');
        }

        const actions = await db.all(
            `
      SELECT action_date, action_type, old_status, new_status, performed_by, notes
      FROM actions
      WHERE employee_id = $1
      ORDER BY action_date DESC, action_id DESC
      `,
            [id]
        );

        const positions = await db.all(`
      SELECT p.position_id, p.position_title, d.department_name
      FROM positions p
      LEFT JOIN departments d ON p.department_id = d.department_id
      WHERE p.is_active = 1
      ORDER BY p.position_title
      `);

        const managers = await db.all(
            `
      SELECT e.employee_id, e.full_name, p.position_title
      FROM employees e
      LEFT JOIN positions p ON e.position_id = p.position_id
      WHERE e.employment_status = 'active'
        AND e.employee_id <> $1
      ORDER BY e.full_name
      `,
            [id]
        );

        res.render('employee_detail', {
            activePage: 'employees',
            isLoggedIn: true,
            employee,
            actions,
            positions,
            managers,
            statuses: EMPLOYEE_STATUSES
        });
    } catch (err) {
        console.error('Employee detail error:', err.message);
        res.status(500).send(`Employee detail error: ${err.message}`);
    }
});

router.post('/:id/status', requireLogin, async (req, res) => {
    const { id } = req.params;
    const { employment_status, notes } = req.body;

    try {
        const employee = await db.get(
            `SELECT employment_status FROM employees WHERE employee_id = $1`,
            [id]
        );

        if (!employee) {
            return res.status(404).send('Employee not found');
        }

        if (!EMPLOYEE_STATUSES.includes(employment_status)) {
            return res.status(400).send('Invalid status');
        }

        await db.run(
            `
      UPDATE employees
      SET employment_status = $1,
          end_date = CASE
            WHEN $2 IN ('resigned', 'terminated') THEN CURRENT_TIMESTAMP
            ELSE end_date
          END
      WHERE employee_id = $3
      `,
            [employment_status, employment_status, id]
        );

        let actionType = 'status_changed';
        if (employment_status === 'resigned') actionType = 'resigned';
        if (employment_status === 'terminated') actionType = 'terminated';
        if (employment_status === 'transferred') actionType = 'transferred';

        await db.run(
            `
      INSERT INTO actions (
        employee_id,
        action_type,
        old_status,
        new_status,
        performed_by,
        notes
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
            [id, actionType, employee.employment_status, employment_status, 'HR Admin', notes || null]
        );

        res.redirect(`/employees/${id}`);
    } catch (err) {
        console.error('Employee status update error:', err.message);
        res.status(500).send(`Employee status update error: ${err.message}`);
    }
});

router.post('/:id/position', requireLogin, async (req, res) => {
    const { id } = req.params;
    const { new_position_id, notes } = req.body;

    try {
        const employee = await db.get(
            `
      SELECT e.position_id, e.department_id
      FROM employees e
      WHERE e.employee_id = $1
      `,
            [id]
        );

        const newPosition = await db.get(
            `
      SELECT position_id, department_id
      FROM positions
      WHERE position_id = $1
      `,
            [new_position_id]
        );

        if (!employee || !newPosition) {
            return res.status(404).send('Employee or new position not found');
        }

        await db.run(
            `
      UPDATE employees
      SET position_id = $1, department_id = $2
      WHERE employee_id = $3
      `,
            [new_position_id, newPosition.department_id, id]
        );

        await db.run(
            `
      INSERT INTO actions (
        employee_id,
        action_type,
        old_position_id,
        new_position_id,
        old_department_id,
        new_department_id,
        performed_by,
        notes
      )
      VALUES ($1, 'position_changed', $2, $3, $4, $5, $6, $7)
      `,
            [
                id,
                employee.position_id,
                new_position_id,
                employee.department_id,
                newPosition.department_id,
                'HR Admin',
                notes || null
            ]
        );

        res.redirect(`/employees/${id}`);
    } catch (err) {
        console.error('Employee position change error:', err.message);
        res.status(500).send(`Employee position change error: ${err.message}`);
    }
});

router.post('/:id/manager', requireLogin, async (req, res) => {
    const { id } = req.params;
    const { reporting_manager_id } = req.body;

    try {
        const employee = await db.get(
            `
      SELECT employee_id
      FROM employees
      WHERE employee_id = $1
      `,
            [id]
        );

        if (!employee) {
            return res.status(404).send('Employee not found');
        }

        if (reporting_manager_id && Number(reporting_manager_id) === Number(id)) {
            return res.status(400).send('An employee cannot report to themselves.');
        }

        if (reporting_manager_id) {
            const manager = await db.get(
                `
        SELECT employee_id
        FROM employees
        WHERE employee_id = $1
          AND employment_status = 'active'
        `,
                [reporting_manager_id]
            );

            if (!manager) {
                return res.status(400).send('Selected reporting manager is invalid.');
            }
        }

        await db.run(
            `
      UPDATE employees
      SET reporting_manager_id = $1
      WHERE employee_id = $2
      `,
            [reporting_manager_id ? Number(reporting_manager_id) : null, id]
        );

        res.redirect(`/employees/${id}`);
    } catch (err) {
        console.error('Employee manager update error:', err.message);
        res.status(500).send(`Employee manager update error: ${err.message}`);
    }
});

module.exports = router;
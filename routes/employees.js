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

router.get('/', requireLogin, (req, res) => {
    const selectedStatus = req.query.status || '';
    let employees = [];

    try {
        if (selectedStatus && EMPLOYEE_STATUSES.includes(selectedStatus)) {
            employees = db.prepare(`
        SELECT
          e.employee_id,
          e.full_name,
          e.hire_date,
          e.employment_status,
          p.position_title,
          d.department_name
        FROM employees e
        LEFT JOIN positions p
          ON e.position_id = p.position_id
        LEFT JOIN departments d
          ON p.department_id = d.department_id
        WHERE e.employment_status = ?
        ORDER BY e.hire_date DESC, e.full_name
      `).all(selectedStatus);
        } else {
            employees = db.prepare(`
        SELECT
          e.employee_id,
          e.full_name,
          e.hire_date,
          e.employment_status,
          p.position_title,
          d.department_name
        FROM employees e
        LEFT JOIN positions p
          ON e.position_id = p.position_id
        LEFT JOIN departments d
          ON p.department_id = d.department_id
        ORDER BY e.hire_date DESC, e.full_name
      `).all();
        }
    } catch (err) {
        console.error('Employees query error:', err.message);
        return res.status(500).send(`Employees page error: ${err.message}`);
    }

    res.render('employees', {
        employees,
        statuses: EMPLOYEE_STATUSES,
        selectedStatus
    });
});

router.get('/:id', requireLogin, (req, res) => {
    const { id } = req.params;

    try {
        const employee = db.prepare(`
      SELECT
        e.*,
        p.position_title,
        p.position_id,
        d.department_name
      FROM employees e
      LEFT JOIN positions p
        ON e.position_id = p.position_id
      LEFT JOIN departments d
        ON p.department_id = d.department_id
      WHERE e.employee_id = ?
    `).get(id);

        if (!employee) {
            return res.status(404).send('Employee not found');
        }

        const actions = db.prepare(`
      SELECT
        action_date,
        action_type,
        old_status,
        new_status,
        performed_by,
        notes
      FROM actions
      WHERE employee_id = ?
      ORDER BY action_date DESC, action_id DESC
    `).all(id);

        const positions = db.prepare(`
      SELECT
        p.position_id,
        p.position_title,
        d.department_name
      FROM positions p
      LEFT JOIN departments d
        ON p.department_id = d.department_id
      WHERE p.is_active = 1
      ORDER BY p.position_title
    `).all();

        res.render('employee_detail', {
            employee,
            actions,
            positions,
            statuses: EMPLOYEE_STATUSES
        });
    } catch (err) {
        console.error('Employee detail error:', err.message);
        res.status(500).send(`Employee detail error: ${err.message}`);
    }
});

router.post('/:id/status', requireLogin, (req, res) => {
    const { id } = req.params;
    const { employment_status, notes } = req.body;

    try {
        const employee = db.prepare(`
      SELECT employment_status
      FROM employees
      WHERE employee_id = ?
    `).get(id);

        if (!employee) {
            return res.status(404).send('Employee not found');
        }

        if (!EMPLOYEE_STATUSES.includes(employment_status)) {
            return res.status(400).send('Invalid status');
        }

        db.prepare(`
      UPDATE employees
      SET employment_status = ?,
          end_date = CASE
            WHEN ? IN ('resigned', 'terminated') THEN CURRENT_TIMESTAMP
            ELSE end_date
          END
      WHERE employee_id = ?
    `).run(employment_status, employment_status, id);

        let actionType = 'status_changed';
        if (employment_status === 'resigned') actionType = 'resigned';
        if (employment_status === 'terminated') actionType = 'terminated';
        if (employment_status === 'transferred') actionType = 'transferred';

        db.prepare(`
      INSERT INTO actions (
        employee_id,
        action_type,
        old_status,
        new_status,
        performed_by,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, actionType, employee.employment_status, employment_status, 'HR Admin', notes || null);

        res.redirect(`/employees/${id}`);
    } catch (err) {
        console.error('Employee status update error:', err.message);
        res.status(500).send(`Employee status update error: ${err.message}`);
    }
});

router.post('/:id/position', requireLogin, (req, res) => {
    const { id } = req.params;
    const { new_position_id, notes } = req.body;

    try {
        const employee = db.prepare(`
      SELECT
        e.position_id,
        p.department_id
      FROM employees e
      LEFT JOIN positions p
        ON e.position_id = p.position_id
      WHERE e.employee_id = ?
    `).get(id);

        const newPosition = db.prepare(`
      SELECT position_id, department_id
      FROM positions
      WHERE position_id = ?
    `).get(new_position_id);

        if (!employee || !newPosition) {
            return res.status(404).send('Employee or new position not found');
        }

        db.prepare(`
      UPDATE employees
      SET position_id = ?
      WHERE employee_id = ?
    `).run(new_position_id, id);

        db.prepare(`
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
      VALUES (?, 'position_changed', ?, ?, ?, ?, ?, ?)
    `).run(
            id,
            employee.position_id,
            new_position_id,
            employee.department_id,
            newPosition.department_id,
            'HR Admin',
            notes || null
        );

        res.redirect(`/employees/${id}`);
    } catch (err) {
        console.error('Employee position change error:', err.message);
        res.status(500).send(`Employee position change error: ${err.message}`);
    }
});

module.exports = router;
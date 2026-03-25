const express = require('express');
const router = express.Router();
const db = require('../db');
const requireLogin = require('../middleware/auth');

const APPLICANT_STATUSES = [
    'applied',
    'in_review',
    'interview',
    'offered',
    'rejected',
    'withdrawn',
    'hired'
];

router.get('/', requireLogin, (req, res) => {
    const selectedStatus = req.query.status || '';
    let applicants = [];

    try {
        if (selectedStatus && APPLICANT_STATUSES.includes(selectedStatus)) {
            applicants = db.prepare(`
        SELECT
          a.applicant_id,
          a.full_name,
          a.application_status,
          a.applied_at,
          p.position_title,
          d.department_name
        FROM applicants a
        LEFT JOIN positions p
          ON a.position_id = p.position_id
        LEFT JOIN departments d
          ON p.department_id = d.department_id
        WHERE a.application_status = ?
        ORDER BY a.applied_at DESC, a.full_name
      `).all(selectedStatus);
        } else {
            applicants = db.prepare(`
        SELECT
          a.applicant_id,
          a.full_name,
          a.application_status,
          a.applied_at,
          p.position_title,
          d.department_name
        FROM applicants a
        LEFT JOIN positions p
          ON a.position_id = p.position_id
        LEFT JOIN departments d
          ON p.department_id = d.department_id
        ORDER BY a.applied_at DESC, a.full_name
      `).all();
        }
    } catch (err) {
        console.error('Applicants query error:', err.message);
        return res.status(500).send(`Applicants page error: ${err.message}`);
    }

    res.render('applicants', {
        applicants,
        statuses: APPLICANT_STATUSES,
        selectedStatus
    });
});

router.get('/new', requireLogin, (req, res) => {
    let positions = [];

    try {
        positions = db.prepare(`
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
    } catch (err) {
        console.error('Applicant form positions error:', err.message);
        return res.status(500).send(`Applicant form error: ${err.message}`);
    }

    res.render('applicant_form', {
        positions,
        error: null,
        formData: {},
        statuses: APPLICANT_STATUSES
    });
});

router.post('/new', requireLogin, (req, res) => {
    const {
        full_name,
        years_experience,
        current_or_last_position,
        position_id,
        application_status,
        notes
    } = req.body;

    let positions = [];

    try {
        positions = db.prepare(`
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

        if (!full_name) {
            return res.render('applicant_form', {
                positions,
                error: 'Full name is required.',
                formData: req.body,
                statuses: APPLICANT_STATUSES
            });
        }

        const result = db.prepare(`
      INSERT INTO applicants (
        full_name,
        years_experience,
        current_or_last_position,
        position_id,
        application_status,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
            full_name,
            Number(years_experience || 0),
            current_or_last_position || null,
            position_id ? Number(position_id) : null,
            APPLICANT_STATUSES.includes(application_status) ? application_status : 'applied',
            notes || null
        );

        db.prepare(`
      INSERT INTO actions (
        applicant_id,
        action_type,
        new_status,
        performed_by,
        notes
      )
      VALUES (?, 'applicant_arrived', ?, ?, ?)
    `).run(
            result.lastInsertRowid,
            APPLICANT_STATUSES.includes(application_status) ? application_status : 'applied',
            'HR Admin',
            'Applicant created'
        );

        res.redirect('/applicants');
    } catch (err) {
        console.error('Create applicant error:', err.message);
        res.status(500).send(`Create applicant error: ${err.message}`);
    }
});

router.get('/:id', requireLogin, (req, res) => {
    const { id } = req.params;

    try {
        const applicant = db.prepare(`
      SELECT
        a.*,
        p.position_title,
        d.department_name
      FROM applicants a
      LEFT JOIN positions p
        ON a.position_id = p.position_id
      LEFT JOIN departments d
        ON p.department_id = d.department_id
      WHERE a.applicant_id = ?
    `).get(id);

        if (!applicant) {
            return res.status(404).send('Applicant not found');
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
      WHERE applicant_id = ?
      ORDER BY action_date DESC, action_id DESC
    `).all(id);

        res.render('applicant_detail', { applicant, actions, statuses: APPLICANT_STATUSES });
    } catch (err) {
        console.error('Applicant detail error:', err.message);
        res.status(500).send(`Applicant detail error: ${err.message}`);
    }
});

router.post('/:id/status', requireLogin, (req, res) => {
    const { id } = req.params;
    const { new_status, notes } = req.body;

    try {
        const applicant = db.prepare(`
      SELECT applicant_id, application_status
      FROM applicants
      WHERE applicant_id = ?
    `).get(id);

        if (!applicant) {
            return res.status(404).send('Applicant not found');
        }

        if (!APPLICANT_STATUSES.includes(new_status)) {
            return res.status(400).send('Invalid status');
        }

        db.prepare(`
      UPDATE applicants
      SET application_status = ?
      WHERE applicant_id = ?
    `).run(new_status, id);

        db.prepare(`
      INSERT INTO actions (
        applicant_id,
        action_type,
        old_status,
        new_status,
        performed_by,
        notes
      )
      VALUES (?, 'status_changed', ?, ?, ?, ?)
    `).run(id, applicant.application_status, new_status, 'HR Admin', notes || null);

        res.redirect(`/applicants/${id}`);
    } catch (err) {
        console.error('Applicant status update error:', err.message);
        res.status(500).send(`Applicant status update error: ${err.message}`);
    }
});

router.post('/:id/hire', requireLogin, (req, res) => {
    const { id } = req.params;

    try {
        const applicant = db.prepare(`
      SELECT applicant_id, full_name, position_id, application_status
      FROM applicants
      WHERE applicant_id = ?
    `).get(id);

        if (!applicant) {
            return res.status(404).send('Applicant not found');
        }

        if (!applicant.position_id) {
            return res.status(400).send('Applicant must have a position before hiring.');
        }

        const existingEmployee = db.prepare(`
      SELECT employee_id
      FROM employees
      WHERE applicant_id = ?
    `).get(id);

        if (existingEmployee) {
            return res.redirect(`/employees/${existingEmployee.employee_id}`);
        }

        db.prepare(`
      UPDATE applicants
      SET application_status = 'hired'
      WHERE applicant_id = ?
    `).run(id);

        const employeeResult = db.prepare(`
      INSERT INTO employees (
        applicant_id,
        full_name,
        position_id,
        hire_date,
        employment_status
      )
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'active')
    `).run(applicant.applicant_id, applicant.full_name, applicant.position_id);

        db.prepare(`
      INSERT INTO actions (
        applicant_id,
        employee_id,
        action_type,
        old_status,
        new_status,
        performed_by,
        notes
      )
      VALUES (?, ?, 'hired', ?, 'hired', ?, ?)
    `).run(
            applicant.applicant_id,
            employeeResult.lastInsertRowid,
            applicant.application_status,
            'HR Admin',
            'Applicant hired into employees table'
        );

        res.redirect(`/employees/${employeeResult.lastInsertRowid}`);
    } catch (err) {
        console.error('Hire applicant error:', err.message);
        res.status(500).send(`Hire applicant error: ${err.message}`);
    }
});

module.exports = router;
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

router.get('/', requireLogin, async (req, res) => {
    const selectedStatus = req.query.status || '';
    let applicants = [];

    try {
        if (selectedStatus && APPLICANT_STATUSES.includes(selectedStatus)) {
            applicants = await db.all(`
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
                WHERE a.application_status = $1
                ORDER BY a.applied_at DESC, a.full_name
            `, [selectedStatus]);
        } else {
            applicants = await db.all(`
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
            `);
        }
    } catch (err) {
        console.error('Applicants query error:', err.message);
        return res.status(500).send(`Applicants page error: ${err.message}`);
    }

    res.render('applicants', {
        activePage: 'applicants',
        isLoggedIn: true,
        applicants,
        statuses: APPLICANT_STATUSES,
        selectedStatus
    });
});

router.get('/new', requireLogin, async (req, res) => {
    let positions = [];

    try {
        positions = await db.all(`
            SELECT
              p.position_id,
              p.position_title,
              d.department_name
            FROM positions p
            LEFT JOIN departments d
              ON p.department_id = d.department_id
            WHERE p.is_active = 1
            ORDER BY p.position_title
        `);
    } catch (err) {
        console.error('Applicant form positions error:', err.message);
        return res.status(500).send(`Applicant form error: ${err.message}`);
    }

    res.render('applicant_form', {
        activePage: 'applicants',
        isLoggedIn: true,
        positions,
        error: null,
        formData: {},
        statuses: APPLICANT_STATUSES
    });
});

router.post('/new', requireLogin, async (req, res) => {
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
        positions = await db.all(`
            SELECT
              p.position_id,
              p.position_title,
              d.department_name
            FROM positions p
            LEFT JOIN departments d
              ON p.department_id = d.department_id
            WHERE p.is_active = 1
            ORDER BY p.position_title
        `);

        if (!full_name) {
            return res.render('applicant_form', {
                activePage: 'applicants',
                isLoggedIn: true,
                positions,
                error: 'Full name is required.',
                formData: req.body,
                statuses: APPLICANT_STATUSES
            });
        }

        const safeStatus = APPLICANT_STATUSES.includes(application_status)
            ? application_status
            : 'applied';

        const insertApplicantResult = await db.run(`
            INSERT INTO applicants (
              full_name,
              years_experience,
              current_or_last_position,
              position_id,
              application_status,
              notes
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING applicant_id
        `, [
            full_name,
            Number(years_experience || 0),
            current_or_last_position || null,
            position_id ? Number(position_id) : null,
            safeStatus,
            notes || null
        ]);

        const newApplicantId = insertApplicantResult.rows[0].applicant_id;

        await db.run(`
            INSERT INTO actions (
              applicant_id,
              action_type,
              new_status,
              performed_by,
              notes
            )
            VALUES ($1, 'applicant_arrived', $2, $3, $4)
        `, [
            newApplicantId,
            safeStatus,
            'HR Admin',
            'Applicant created'
        ]);

        res.redirect('/applicants');
    } catch (err) {
        console.error('Create applicant error:', err.message);
        res.status(500).send(`Create applicant error: ${err.message}`);
    }
});

router.get('/:id', requireLogin, async (req, res) => {
    const { id } = req.params;

    try {
        const applicant = await db.get(`
            SELECT
              a.*,
              p.position_title,
              d.department_name
            FROM applicants a
            LEFT JOIN positions p
              ON a.position_id = p.position_id
            LEFT JOIN departments d
              ON p.department_id = d.department_id
            WHERE a.applicant_id = $1
        `, [id]);

        if (!applicant) {
            return res.status(404).send('Applicant not found');
        }

        const actions = await db.all(`
            SELECT
              action_date,
              action_type,
              old_status,
              new_status,
              performed_by,
              notes
            FROM actions
            WHERE applicant_id = $1
            ORDER BY action_date DESC, action_id DESC
        `, [id]);

        res.render('applicant_detail', {
            activePage: 'applicants',
            isLoggedIn: true,
            applicant,
            actions,
            statuses: APPLICANT_STATUSES
        });
    } catch (err) {
        console.error('Applicant detail error:', err.message);
        res.status(500).send(`Applicant detail error: ${err.message}`);
    }
});

router.post('/:id/status', requireLogin, async (req, res) => {
    const { id } = req.params;
    const { new_status, notes } = req.body;

    try {
        const applicant = await db.get(`
            SELECT applicant_id, application_status
            FROM applicants
            WHERE applicant_id = $1
        `, [id]);

        if (!applicant) {
            return res.status(404).send('Applicant not found');
        }

        if (!APPLICANT_STATUSES.includes(new_status)) {
            return res.status(400).send('Invalid status');
        }

        await db.run(`
            UPDATE applicants
            SET application_status = $1
            WHERE applicant_id = $2
        `, [new_status, id]);

        await db.run(`
            INSERT INTO actions (
              applicant_id,
              action_type,
              old_status,
              new_status,
              performed_by,
              notes
            )
            VALUES ($1, 'status_changed', $2, $3, $4, $5)
        `, [
            id,
            applicant.application_status,
            new_status,
            'HR Admin',
            notes || null
        ]);

        res.redirect(`/applicants/${id}`);
    } catch (err) {
        console.error('Applicant status update error:', err.message);
        res.status(500).send(`Applicant status update error: ${err.message}`);
    }
});

router.post('/:id/hire', requireLogin, async (req, res) => {
    const { id } = req.params;

    try {
        const applicant = await db.get(`
            SELECT applicant_id, full_name, position_id, application_status
            FROM applicants
            WHERE applicant_id = $1
        `, [id]);

        if (!applicant) {
            return res.status(404).send('Applicant not found');
        }

        if (!applicant.position_id) {
            return res.status(400).send('Applicant must have a position before hiring.');
        }

        const existingEmployee = await db.get(`
            SELECT employee_id
            FROM employees
            WHERE applicant_id = $1
        `, [id]);

        if (existingEmployee) {
            return res.redirect(`/employees/${existingEmployee.employee_id}`);
        }

        await db.run(`
            UPDATE applicants
            SET application_status = 'hired'
            WHERE applicant_id = $1
        `, [id]);

        const position = await db.get(`
            SELECT position_id, department_id
            FROM positions
            WHERE position_id = $1
        `, [applicant.position_id]);

        if (!position) {
            return res.status(400).send('Applicant position not found.');
        }

        const employeeInsertResult = await db.run(`
            INSERT INTO employees (
              applicant_id,
              full_name,
              department_id,
              position_id,
              hire_date,
              employment_status
            )
            VALUES ($1, $2, $3, $4, CURRENT_DATE, 'active')
            RETURNING employee_id
        `, [
            applicant.applicant_id,
            applicant.full_name,
            position.department_id,
            applicant.position_id
        ]);

        const newEmployeeId = employeeInsertResult.rows[0].employee_id;

        await db.run(`
            INSERT INTO actions (
              applicant_id,
              employee_id,
              action_type,
              old_status,
              new_status,
              performed_by,
              notes
            )
            VALUES ($1, $2, 'hired', $3, 'hired', $4, $5)
        `, [
            applicant.applicant_id,
            newEmployeeId,
            applicant.application_status,
            'HR Admin',
            'Applicant hired into employees table'
        ]);

        res.redirect(`/employees/${newEmployeeId}`);
    } catch (err) {
        console.error('Hire applicant error:', err.message);
        res.status(500).send(`Hire applicant error: ${err.message}`);
    }
});

module.exports = router;
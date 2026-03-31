const express = require('express');
const router = express.Router();
const db = require('../db');
const requireLogin = require('../middleware/auth');

router.get('/', async (req, res) => {
    let jobs = [];

    try {
        jobs = await db.all(`
      SELECT
        p.position_id,
        p.position_title,
        p.position_level,
        p.is_active,
        p.created_at,
        d.department_name
      FROM positions p
      LEFT JOIN departments d ON p.department_id = d.department_id
      ORDER BY p.created_at DESC, p.position_title
    `);
    } catch (err) {
        console.error('Jobs query error:', err.message);
    }

    res.render('jobs', { jobs });
});

router.get('/new', requireLogin, async (req, res) => {
    let departments = [];

    try {
        departments = await db.all(`
      SELECT department_id, department_name
      FROM departments
      ORDER BY department_name
    `);
    } catch (err) {
        console.error('Departments for job form error:', err.message);
    }

    res.render('job_form', { departments, error: null, formData: {} });
});

router.post('/new', requireLogin, async (req, res) => {
    const { position_title, department_id, position_level, is_active } = req.body;
    let departments = [];

    try {
        departments = await db.all(`
      SELECT department_id, department_name
      FROM departments
      ORDER BY department_name
    `);

        if (!position_title || !department_id) {
            return res.render('job_form', {
                departments,
                error: 'Position title and department are required.',
                formData: req.body
            });
        }

        await db.run(
            `
      INSERT INTO positions (position_title, department_id, position_level, is_active)
      VALUES ($1, $2, $3, $4)
      `,
            [
                position_title,
                Number(department_id),
                position_level || null,
                Number(is_active || 1)
            ]
        );

        return res.redirect('/jobs');
    } catch (err) {
        console.error('Create job error:', err.message);
        return res.render('job_form', {
            departments,
            error: 'Could not create the job posting.',
            formData: req.body
        });
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const db = require('../db');
const requireLogin = require('../middleware/auth');

router.get('/', requireLogin, (req, res) => {
    let jobs = [];

    try {
        jobs = db.prepare('SELECT * FROM jobs ORDER BY id DESC').all();
    } catch (err) {
        console.error('Jobs table error:', err.message);
    }

    res.render('jobs', { jobs });
});

router.get('/apply/:id', (req, res) => {
    const { id } = req.params;
    let job = null;

    try {
        job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
    } catch (err) {
        console.error(err);
    }

    res.render('apply', { job });
});

router.post('/apply/:id', (req, res) => {
    const { id } = req.params;
    const { full_name, email, phone, cv_link } = req.body;

    try {
        db.prepare(`
      INSERT INTO applicants (job_id, full_name, email, phone, cv_link)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, full_name, email, phone, cv_link);
    } catch (err) {
        console.error('Applicant insert error:', err.message);
    }

    res.render('app_submitted');
});

module.exports = router;
const express = require('express');
const router = express.Router();
const db = require('../db');
const requireLogin = require('../middleware/auth');

router.get('/', requireLogin, (req, res) => {
    let applicants = [];

    try {
        applicants = db.prepare(`
      SELECT applicants.*, jobs.title AS job_title
      FROM applicants
      LEFT JOIN jobs ON applicants.job_id = jobs.id
      ORDER BY applicants.id DESC
    `).all();
    } catch (err) {
        console.error(err.message);
    }

    res.render('applicants', { applicants });
});

router.get('/:id', requireLogin, (req, res) => {
    const { id } = req.params;
    let applicant = null;

    try {
        applicant = db.prepare(`
      SELECT applicants.*, jobs.title AS job_title
      FROM applicants
      LEFT JOIN jobs ON applicants.job_id = jobs.id
      WHERE applicants.id = ?
    `).get(id);
    } catch (err) {
        console.error(err.message);
    }

    res.render('applicant_info', { applicant });
});

module.exports = router;
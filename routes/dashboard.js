const express = require('express');
const router = express.Router();
const db = require('../db');
const requireLogin = require('../middleware/auth');

router.get('/dashboard', requireLogin, (req, res) => {
    let stats = {
        employees: 0,
        departments: 0,
        jobs: 0,
        applicants: 0
    };

    try {
        const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table'
    `).all().map(t => t.name);

        if (tables.includes('employees')) {
            stats.employees = db.prepare('SELECT COUNT(*) AS count FROM employees').get().count;
        }

        if (tables.includes('departments')) {
            stats.departments = db.prepare('SELECT COUNT(*) AS count FROM departments').get().count;
        }

        if (tables.includes('jobs')) {
            stats.jobs = db.prepare('SELECT COUNT(*) AS count FROM jobs').get().count;
        }

        if (tables.includes('applicants')) {
            stats.applicants = db.prepare('SELECT COUNT(*) AS count FROM applicants').get().count;
        }
    } catch (err) {
        console.error(err);
    }

    res.render('dashboard', { stats });
});

module.exports = router;
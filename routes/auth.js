const express = require('express');
const router = express.Router();
const db = require('../db');

const HR_USERNAME = 'admin';
const HR_PASSWORD = 'admin123';

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
      WHERE p.is_active = 1
      ORDER BY d.department_name, p.position_title
    `);
    } catch (err) {
        console.error('Landing query error:', err.message);
    }

    res.render('landing', { jobs });
});

router.get('/login', (req, res) => {
    res.render('login', { error: null });
});

router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === HR_USERNAME && password === HR_PASSWORD) {
        req.session.user = { username };
        return res.redirect('/dashboard');
    }

    res.render('login', { error: 'Invalid username or password' });
});

router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

module.exports = router;
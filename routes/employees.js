const express = require('express');
const router = express.Router();
const db = require('../db');
const requireLogin = require('../middleware/auth');

router.get('/', requireLogin, (req, res) => {
    let employees = [];

    try {
        employees = db.prepare(`
      SELECT e.*, d.name AS department_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      ORDER BY e.id DESC
    `).all();
    } catch (err) {
        console.error(err.message);
    }

    res.render('employees', { employees });
});

module.exports = router;
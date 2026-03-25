const express = require('express');
const router = express.Router();
const requireLogin = require('../middleware/auth');

router.get('/', requireLogin, (req, res) => {
    res.render('departments', { departments: [] });
});

module.exports = router;
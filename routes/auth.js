const express = require('express');
const router = express.Router();

const HR_USERNAME = 'admin';
const HR_PASSWORD = 'admin123';

router.get('/', (req, res) => {
    res.render('landing');
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
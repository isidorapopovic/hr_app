require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const db = require('./db');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const departmentsRoutes = require('./routes/departments');
const jobsRoutes = require('./routes/jobs');
const applicantsRoutes = require('./routes/applicants');
const employeesRoutes = require('./routes/employees');
const workloadRoutes = require('./routes/workload');
const organisationRoutes = require('./routes/organisation');
const insightsRoutes = require('./routes/insights');
const adminRoutes = require('./routes/admin');
const burnoutPredictionRoutes = require('./routes/burnoutPrediction');

const app = express();
const PORT = process.env.PORT || 10000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


app.use(
    session({
        secret: process.env.SESSION_SECRET || 'change_this_secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false,
            httpOnly: true
        }
    })
);

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.currentUser = req.session.user || null;
    res.locals.isLoggedIn = !!req.session.user;
    next();
});

// first screen
app.get('/', (req, res) => {
    res.render('welcome');
});

// actual home page
app.get('/home', async (req, res) => {
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
        console.error('Home query error:', err.message);
    }

    res.render('index', {
        title: 'Home',
        activePage: 'home',
        isLoggedIn: !!req.session.user,
        jobs
    });
});

// routes
app.use('/', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/departments', departmentsRoutes);
app.use('/jobs', jobsRoutes);
app.use('/applicants', applicantsRoutes);
app.use('/employees', employeesRoutes);
app.use('/workload', workloadRoutes);
app.use('/organisation', organisationRoutes);
app.use('/insights', insightsRoutes);
app.use('/admin', adminRoutes);
app.use('/burnout-prediction', burnoutPredictionRoutes);

// 404 page
app.use((req, res) => {
    res.status(404).render('404', { title: 'Page not found' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
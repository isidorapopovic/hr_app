require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

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

const { pool } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
    session({
        store: new pgSession({
            pool,
            tableName: 'user_sessions',
            createTableIfMissing: true
        }),
        secret: process.env.SESSION_SECRET || 'change_this_secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false,
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 1000 * 60 * 60 * 24 * 7
        }
    })
);

// make login/user data available in all EJS views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.currentUser = req.session.user || null;
    res.locals.isLoggedIn = !!req.session.user;
    next();
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

// 404 page
app.use((req, res) => {
    res.status(404).render('404', { title: 'Page not found' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
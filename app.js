const express = require('express');
const path = require('path');
const session = require('express-session');
const methodOverride = require('method-override');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const jobsRoutes = require('./routes/jobs');
const applicantsRoutes = require('./routes/applicants');
const employeesRoutes = require('./routes/employees');
const departmentsRoutes = require('./routes/departments');
const app = express();
const PORT = 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
    session({
        secret: 'change_this_to_a_secure_secret_key',
        resave: false,
        saveUninitialized: false
    })
);

// Expose session user to all views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// Routes
app.use('/', authRoutes);
app.use('/', dashboardRoutes);
app.use('/jobs', jobsRoutes);
app.use('/applicants', applicantsRoutes);
app.use('/employees', employeesRoutes);
app.use('/departments', departmentsRoutes);

// 404
app.use((req, res) => {
    res.status(404).send('Page not found');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
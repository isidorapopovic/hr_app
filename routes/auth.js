// NEW - PostgreSQL async syntax using your db.js helpers
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
            LEFT JOIN departments d
                ON p.department_id = d.department_id
            WHERE p.is_active = true
            ORDER BY d.department_name, p.position_title
        `);
    } catch (err) {
        console.error('Landing query error:', err.message);
    }

    res.render('landing', { jobs });
});
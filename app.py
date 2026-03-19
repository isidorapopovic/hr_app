
import os
import sqlite3
from datetime import datetime
from flask import Flask, g, render_template, request, redirect, url_for, flash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "hr_system.db")

app = Flask(__name__)
app.config["SECRET_KEY"] = "change-me-in-production"


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON;")
    return g.db


@app.teardown_appcontext
def close_db(error=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def now_ts():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def init_db():
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON;")
    with open(os.path.join(BASE_DIR, "schema.sql"), "r", encoding="utf-8") as f:
        db.executescript(f.read())
    db.commit()

    department_count = db.execute("SELECT COUNT(*) AS c FROM departments").fetchone()["c"]
    if department_count == 0:
        seed_data(db)
    db.commit()
    db.close()


def seed_data(db):
    departments = ["Engineering", "Sales", "HR", "Finance"]
    for name in departments:
        db.execute(
            "INSERT INTO departments (department_name, created_at) VALUES (?, ?)",
            (name, now_ts()),
        )

    positions = [
        ("Software Engineer", 1, "Mid", 1),
        ("Senior Software Engineer", 1, "Senior", 1),
        ("Sales Executive", 2, "Junior", 1),
        ("Account Manager", 2, "Mid", 1),
        ("HR Specialist", 3, "Mid", 1),
        ("Recruiter", 3, "Junior", 1),
        ("Financial Analyst", 4, "Mid", 1),
        ("Accountant", 4, "Junior", 1),
    ]
    for title, department_id, level, is_active in positions:
        db.execute(
            """
            INSERT INTO positions (position_title, department_id, position_level, is_active, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (title, department_id, level, is_active, now_ts()),
        )

    applicants = [
        ("John Smith", 3.5, "Developer", 1, "applied", "2026-01-05 09:00:00", "Strong CV"),
        ("Emma Johnson", 6.2, "Senior Developer", 2, "in_review", "2026-01-09 10:00:00", "Good communication"),
        ("Michael Brown", 2.0, "Sales Associate", 3, "interview", "2026-01-15 11:30:00", "Interview booked"),
        ("Olivia Taylor", 5.0, "Recruitment Coordinator", 6, "offered", "2026-01-20 13:00:00", "Awaiting response"),
        ("Daniel Anderson", 4.2, "Analyst", 7, "rejected", "2026-02-01 09:45:00", "Not enough experience"),
        ("Sophia Thomas", 7.0, "HR Assistant", 5, "hired", "2026-02-04 08:30:00", "Excellent fit"),
        ("James Jackson", 1.4, "Junior Developer", 1, "withdrawn", "2026-02-10 15:00:00", "Candidate withdrew"),
        ("Isabella White", 8.1, "Account Manager", 4, "hired", "2026-02-12 14:10:00", "Hired for sales team"),
    ]

    hired_map = {}
    for full_name, years_exp, last_pos, position_id, status, applied_at, notes in applicants:
        cur = db.execute(
            """
            INSERT INTO applicants (
                full_name, years_experience, current_or_last_position,
                position_id, application_status, applied_at, notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (full_name, years_exp, last_pos, position_id, status, applied_at, notes),
        )
        applicant_id = cur.lastrowid
        create_action(
            db=db,
            applicant_id=applicant_id,
            employee_id=None,
            action_type="applicant_arrived",
            action_date=applied_at,
            new_status="applied",
            new_position_id=position_id,
            new_department_id=get_department_id_for_position(db, position_id),
            performed_by="System",
            notes="Application received",
        )

        if status != "applied":
            create_action(
                db=db,
                applicant_id=applicant_id,
                employee_id=None,
                action_type="status_changed",
                action_date=applied_at,
                old_status="applied",
                new_status=status if status not in ["interview", "offered", "hired", "rejected"] else "in_review",
                performed_by="System",
                notes="Initial seeded pipeline movement",
            )

        if status in ["interview", "offered", "hired", "rejected"]:
            create_action(
                db=db,
                applicant_id=applicant_id,
                employee_id=None,
                action_type="interview_scheduled",
                action_date=applied_at,
                old_status="in_review",
                new_status="interview",
                performed_by="System",
                notes="Interview scheduled",
            )

        if status in ["offered", "hired"]:
            create_action(
                db=db,
                applicant_id=applicant_id,
                employee_id=None,
                action_type="offer_made",
                action_date=applied_at,
                old_status="interview",
                new_status="offered",
                performed_by="System",
                notes="Offer sent",
            )

        if status == "rejected":
            create_action(
                db=db,
                applicant_id=applicant_id,
                employee_id=None,
                action_type="rejected",
                action_date=applied_at,
                old_status="interview",
                new_status="rejected",
                performed_by="System",
                notes="Candidate rejected",
            )

        if status == "hired":
            hire_date = "2026-03-01 09:00:00" if full_name == "Sophia Thomas" else "2026-03-03 09:00:00"
            emp_cur = db.execute(
                """
                INSERT INTO employees (
                    applicant_id, full_name, position_id, hire_date,
                    employment_status, end_date, created_at
                )
                VALUES (?, ?, ?, ?, 'active', NULL, ?)
                """,
                (applicant_id, full_name, position_id, hire_date, hire_date),
            )
            employee_id = emp_cur.lastrowid
            hired_map[applicant_id] = employee_id
            create_action(
                db=db,
                applicant_id=applicant_id,
                employee_id=employee_id,
                action_type="hired",
                action_date=hire_date,
                old_status="offered",
                new_status="hired",
                new_position_id=position_id,
                new_department_id=get_department_id_for_position(db, position_id),
                performed_by="System",
                notes="Candidate hired",
            )

    # extra employee lifecycle examples
    for applicant_id, employee_id in hired_map.items():
        employee = db.execute("SELECT * FROM employees WHERE employee_id = ?", (employee_id,)).fetchone()
        if employee["full_name"] == "Isabella White":
            create_action(
                db=db,
                applicant_id=applicant_id,
                employee_id=employee_id,
                action_type="promoted",
                action_date="2026-03-10 10:00:00",
                old_position_id=employee["position_id"],
                new_position_id=4,
                old_department_id=get_department_id_for_position(db, employee["position_id"]),
                new_department_id=get_department_id_for_position(db, 4),
                performed_by="HR Admin",
                notes="Promoted after successful onboarding review",
            )


def get_department_id_for_position(db, position_id):
    row = db.execute("SELECT department_id FROM positions WHERE position_id = ?", (position_id,)).fetchone()
    return row["department_id"] if row else None


def create_action(
    db,
    applicant_id,
    employee_id,
    action_type,
    action_date=None,
    old_status=None,
    new_status=None,
    old_position_id=None,
    new_position_id=None,
    old_department_id=None,
    new_department_id=None,
    performed_by=None,
    notes=None,
):
    if action_date is None:
        action_date = now_ts()

    db.execute(
        """
        INSERT INTO actions (
            applicant_id, employee_id, action_type, old_status, new_status,
            old_position_id, new_position_id, old_department_id, new_department_id,
            action_date, performed_by, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            applicant_id,
            employee_id,
            action_type,
            old_status,
            new_status,
            old_position_id,
            new_position_id,
            old_department_id,
            new_department_id,
            action_date,
            performed_by,
            notes,
        ),
    )


@app.route("/")
def dashboard():
    db = get_db()

    stats = {
        "total_applicants": db.execute("SELECT COUNT(*) AS c FROM applicants").fetchone()["c"],
        "in_process": db.execute(
            """
            SELECT COUNT(*) AS c
            FROM applicants
            WHERE application_status IN ('applied', 'in_review', 'interview', 'offered')
            """
        ).fetchone()["c"],
        "hired_count": db.execute(
            "SELECT COUNT(*) AS c FROM applicants WHERE application_status = 'hired'"
        ).fetchone()["c"],
        "active_employees": db.execute(
            "SELECT COUNT(*) AS c FROM employees WHERE employment_status = 'active'"
        ).fetchone()["c"],
        "rejected_count": db.execute(
            "SELECT COUNT(*) AS c FROM applicants WHERE application_status = 'rejected'"
        ).fetchone()["c"],
        "withdrawn_count": db.execute(
            "SELECT COUNT(*) AS c FROM applicants WHERE application_status = 'withdrawn'"
        ).fetchone()["c"],
    }

    avg_time_row = db.execute(
        """
        SELECT ROUND(AVG(julianday(e.hire_date) - julianday(a.applied_at)), 1) AS avg_days
        FROM employees e
        JOIN applicants a ON a.applicant_id = e.applicant_id
        """
    ).fetchone()
    stats["avg_days_to_hire"] = avg_time_row["avg_days"] if avg_time_row["avg_days"] is not None else "-"

    offer_row = db.execute(
        """
        SELECT
            SUM(CASE WHEN application_status = 'hired' THEN 1 ELSE 0 END) AS hired_total,
            SUM(CASE WHEN application_status IN ('offered', 'hired') THEN 1 ELSE 0 END) AS offered_total
        FROM applicants
        """
    ).fetchone()
    offered_total = offer_row["offered_total"] or 0
    stats["offer_acceptance_rate"] = round((offer_row["hired_total"] / offered_total) * 100, 1) if offered_total else 0

    status_counts = db.execute(
        """
        SELECT application_status, COUNT(*) AS total
        FROM applicants
        GROUP BY application_status
        ORDER BY total DESC, application_status
        """
    ).fetchall()

    department_summary = db.execute(
        """
        SELECT
            d.department_name,
            COUNT(DISTINCT a.applicant_id) AS applicants,
            COUNT(DISTINCT CASE WHEN a.application_status = 'hired' THEN a.applicant_id END) AS hires
        FROM departments d
        LEFT JOIN positions p ON p.department_id = d.department_id
        LEFT JOIN applicants a ON a.position_id = p.position_id
        GROUP BY d.department_id, d.department_name
        ORDER BY hires DESC, applicants DESC, d.department_name
        """
    ).fetchall()

    recent_actions = db.execute(
        """
        SELECT
            ac.*,
            COALESCE(ap.full_name, e.full_name) AS person_name
        FROM actions ac
        LEFT JOIN applicants ap ON ap.applicant_id = ac.applicant_id
        LEFT JOIN employees e ON e.employee_id = ac.employee_id
        ORDER BY ac.action_date DESC, ac.action_id DESC
        LIMIT 10
        """
    ).fetchall()

    return render_template(
        "dashboard.html",
        stats=stats,
        status_counts=status_counts,
        department_summary=department_summary,
        recent_actions=recent_actions,
    )


@app.route("/departments", methods=["GET", "POST"])
def departments():
    db = get_db()

    if request.method == "POST":
        department_name = request.form.get("department_name", "").strip()
        if not department_name:
            flash("Department name is required.", "error")
            return redirect(url_for("departments"))
        try:
            db.execute(
                "INSERT INTO departments (department_name, created_at) VALUES (?, ?)",
                (department_name, now_ts()),
            )
            db.commit()
            flash("Department created successfully.", "success")
        except sqlite3.IntegrityError:
            flash("Department already exists.", "error")
        return redirect(url_for("departments"))

    rows = db.execute(
        """
        SELECT
            d.*,
            COUNT(DISTINCT p.position_id) AS positions_count
        FROM departments d
        LEFT JOIN positions p ON p.department_id = d.department_id
        GROUP BY d.department_id
        ORDER BY d.department_name
        """
    ).fetchall()
    return render_template("departments.html", departments=rows)


@app.route("/positions", methods=["GET", "POST"])
def positions():
    db = get_db()

    if request.method == "POST":
        position_title = request.form.get("position_title", "").strip()
        department_id = request.form.get("department_id")
        position_level = request.form.get("position_level", "").strip() or None
        is_active = 1 if request.form.get("is_active") == "1" else 0

        if not position_title or not department_id:
            flash("Position title and department are required.", "error")
            return redirect(url_for("positions"))

        db.execute(
            """
            INSERT INTO positions (position_title, department_id, position_level, is_active, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (position_title, department_id, position_level, is_active, now_ts()),
        )
        db.commit()
        flash("Position created successfully.", "success")
        return redirect(url_for("positions"))

    departments = db.execute(
        "SELECT department_id, department_name FROM departments ORDER BY department_name"
    ).fetchall()
    rows = db.execute(
        """
        SELECT
            p.*,
            d.department_name
        FROM positions p
        JOIN departments d ON d.department_id = p.department_id
        ORDER BY d.department_name, p.position_title
        """
    ).fetchall()
    return render_template("positions.html", positions=rows, departments=departments)


@app.route("/applicants")
def applicants():
    db = get_db()
    status_filter = request.args.get("status", "").strip()

    query = """
        SELECT
            a.*,
            p.position_title,
            d.department_name
        FROM applicants a
        LEFT JOIN positions p ON p.position_id = a.position_id
        LEFT JOIN departments d ON d.department_id = p.department_id
    """
    params = []
    if status_filter:
        query += " WHERE a.application_status = ? "
        params.append(status_filter)
    query += " ORDER BY a.applied_at DESC, a.applicant_id DESC "

    rows = db.execute(query, params).fetchall()
    statuses = ["applied", "in_review", "interview", "offered", "rejected", "withdrawn", "hired"]
    return render_template("applicants.html", applicants=rows, statuses=statuses, selected_status=status_filter)


@app.route("/applicants/new", methods=["GET", "POST"])
def applicant_new():
    db = get_db()

    if request.method == "POST":
        full_name = request.form.get("full_name", "").strip()
        years_experience = request.form.get("years_experience", "0").strip()
        current_or_last_position = request.form.get("current_or_last_position", "").strip() or None
        position_id = request.form.get("position_id") or None
        notes = request.form.get("notes", "").strip() or None
        performed_by = request.form.get("performed_by", "").strip() or "HR Admin"

        if not full_name:
            flash("Full name is required.", "error")
            return redirect(url_for("applicant_new"))

        cur = db.execute(
            """
            INSERT INTO applicants (
                full_name, years_experience, current_or_last_position,
                position_id, application_status, applied_at, notes
            )
            VALUES (?, ?, ?, ?, 'applied', ?, ?)
            """,
            (full_name, years_experience, current_or_last_position, position_id, now_ts(), notes),
        )
        applicant_id = cur.lastrowid

        create_action(
            db=db,
            applicant_id=applicant_id,
            employee_id=None,
            action_type="applicant_arrived",
            old_status=None,
            new_status="applied",
            new_position_id=position_id,
            new_department_id=get_department_id_for_position(db, position_id) if position_id else None,
            performed_by=performed_by,
            notes="Application received through web form",
        )

        db.commit()
        flash("Applicant created successfully.", "success")
        return redirect(url_for("applicant_detail", applicant_id=applicant_id))

    positions = db.execute(
        """
        SELECT p.position_id, p.position_title, d.department_name
        FROM positions p
        JOIN departments d ON d.department_id = p.department_id
        WHERE p.is_active = 1
        ORDER BY d.department_name, p.position_title
        """
    ).fetchall()
    return render_template("applicant_form.html", positions=positions)


@app.route("/applicants/<int:applicant_id>")
def applicant_detail(applicant_id):
    db = get_db()
    applicant = db.execute(
        """
        SELECT
            a.*,
            p.position_title,
            p.position_id,
            d.department_name
        FROM applicants a
        LEFT JOIN positions p ON p.position_id = a.position_id
        LEFT JOIN departments d ON d.department_id = p.department_id
        WHERE a.applicant_id = ?
        """,
        (applicant_id,),
    ).fetchone()
    if applicant is None:
        flash("Applicant not found.", "error")
        return redirect(url_for("applicants"))

    employee = db.execute(
        "SELECT * FROM employees WHERE applicant_id = ?",
        (applicant_id,),
    ).fetchone()

    actions = db.execute(
        """
        SELECT *
        FROM actions
        WHERE applicant_id = ?
        ORDER BY action_date DESC, action_id DESC
        """,
        (applicant_id,),
    ).fetchall()

    positions = db.execute(
        """
        SELECT p.position_id, p.position_title, d.department_name
        FROM positions p
        JOIN departments d ON d.department_id = p.department_id
        ORDER BY d.department_name, p.position_title
        """
    ).fetchall()

    statuses = ["applied", "in_review", "interview", "offered", "rejected", "withdrawn", "hired"]
    return render_template(
        "applicant_detail.html",
        applicant=applicant,
        employee=employee,
        actions=actions,
        positions=positions,
        statuses=statuses,
    )


@app.route("/applicants/<int:applicant_id>/status", methods=["POST"])
def applicant_update_status(applicant_id):
    db = get_db()
    applicant = db.execute("SELECT * FROM applicants WHERE applicant_id = ?", (applicant_id,)).fetchone()
    if applicant is None:
        flash("Applicant not found.", "error")
        return redirect(url_for("applicants"))

    new_status = request.form.get("new_status", "").strip()
    performed_by = request.form.get("performed_by", "").strip() or "HR Admin"
    notes = request.form.get("notes", "").strip() or None
    new_position_id = request.form.get("position_id") or applicant["position_id"]
    if new_position_id == "":
        new_position_id = applicant["position_id"]

    valid_statuses = {"applied", "in_review", "interview", "offered", "rejected", "withdrawn", "hired"}
    if new_status not in valid_statuses:
        flash("Invalid status selected.", "error")
        return redirect(url_for("applicant_detail", applicant_id=applicant_id))

    old_status = applicant["application_status"]
    old_position_id = applicant["position_id"]

    db.execute(
        """
        UPDATE applicants
        SET application_status = ?, position_id = ?, notes = COALESCE(?, notes)
        WHERE applicant_id = ?
        """,
        (new_status, new_position_id, notes, applicant_id),
    )

    action_type = "status_changed"
    if new_status == "rejected":
        action_type = "rejected"
    elif new_status == "hired":
        action_type = "hired"
    elif new_status == "offered":
        action_type = "offer_made"
    elif new_status == "interview":
        action_type = "interview_scheduled"

    employee = db.execute("SELECT * FROM employees WHERE applicant_id = ?", (applicant_id,)).fetchone()
    employee_id = employee["employee_id"] if employee else None

    if new_status == "hired" and employee is None:
        hire_date = now_ts()
        emp_cur = db.execute(
            """
            INSERT INTO employees (
                applicant_id, full_name, position_id, hire_date,
                employment_status, end_date, created_at
            )
            VALUES (?, ?, ?, ?, 'active', NULL, ?)
            """,
            (
                applicant_id,
                applicant["full_name"],
                new_position_id,
                hire_date,
                hire_date,
            ),
        )
        employee_id = emp_cur.lastrowid

    create_action(
        db=db,
        applicant_id=applicant_id,
        employee_id=employee_id,
        action_type=action_type,
        old_status=old_status,
        new_status=new_status,
        old_position_id=old_position_id,
        new_position_id=new_position_id,
        old_department_id=get_department_id_for_position(db, old_position_id) if old_position_id else None,
        new_department_id=get_department_id_for_position(db, new_position_id) if new_position_id else None,
        performed_by=performed_by,
        notes=notes or f"Applicant moved from {old_status} to {new_status}",
    )

    db.commit()
    flash("Applicant updated successfully.", "success")
    return redirect(url_for("applicant_detail", applicant_id=applicant_id))


@app.route("/employees")
def employees():
    db = get_db()
    status_filter = request.args.get("status", "").strip()

    query = """
        SELECT
            e.*,
            p.position_title,
            d.department_name
        FROM employees e
        LEFT JOIN positions p ON p.position_id = e.position_id
        LEFT JOIN departments d ON d.department_id = p.department_id
    """
    params = []
    if status_filter:
        query += " WHERE e.employment_status = ? "
        params.append(status_filter)
    query += " ORDER BY e.hire_date DESC, e.employee_id DESC "

    rows = db.execute(query, params).fetchall()
    statuses = ["active", "on_leave", "transferred", "resigned", "terminated"]
    return render_template("employees.html", employees=rows, statuses=statuses, selected_status=status_filter)


@app.route("/employees/<int:employee_id>")
def employee_detail(employee_id):
    db = get_db()
    employee = db.execute(
        """
        SELECT
            e.*,
            p.position_title,
            p.position_id,
            d.department_name
        FROM employees e
        LEFT JOIN positions p ON p.position_id = e.position_id
        LEFT JOIN departments d ON d.department_id = p.department_id
        WHERE e.employee_id = ?
        """,
        (employee_id,),
    ).fetchone()

    if employee is None:
        flash("Employee not found.", "error")
        return redirect(url_for("employees"))

    actions = db.execute(
        """
        SELECT *
        FROM actions
        WHERE employee_id = ?
        ORDER BY action_date DESC, action_id DESC
        """,
        (employee_id,),
    ).fetchall()

    positions = db.execute(
        """
        SELECT p.position_id, p.position_title, d.department_name
        FROM positions p
        JOIN departments d ON d.department_id = p.department_id
        ORDER BY d.department_name, p.position_title
        """
    ).fetchall()

    statuses = ["active", "on_leave", "transferred", "resigned", "terminated"]
    return render_template(
        "employee_detail.html",
        employee=employee,
        actions=actions,
        positions=positions,
        statuses=statuses,
    )


@app.route("/employees/<int:employee_id>/status", methods=["POST"])
def employee_update_status(employee_id):
    db = get_db()
    employee = db.execute("SELECT * FROM employees WHERE employee_id = ?", (employee_id,)).fetchone()
    if employee is None:
        flash("Employee not found.", "error")
        return redirect(url_for("employees"))

    new_status = request.form.get("new_status", "").strip()
    new_position_id = request.form.get("position_id") or employee["position_id"]
    performed_by = request.form.get("performed_by", "").strip() or "HR Admin"
    notes = request.form.get("notes", "").strip() or None

    valid_statuses = {"active", "on_leave", "transferred", "resigned", "terminated"}
    if new_status not in valid_statuses:
        flash("Invalid employee status selected.", "error")
        return redirect(url_for("employee_detail", employee_id=employee_id))

    old_status = employee["employment_status"]
    old_position_id = employee["position_id"]

    end_date = employee["end_date"]
    if new_status in {"resigned", "terminated"}:
        end_date = now_ts()
    elif new_status in {"active", "on_leave", "transferred"}:
        end_date = None

    db.execute(
        """
        UPDATE employees
        SET employment_status = ?, position_id = ?, end_date = ?
        WHERE employee_id = ?
        """,
        (new_status, new_position_id, end_date, employee_id),
    )

    action_type = "status_changed"
    if new_status == "transferred":
        action_type = "transferred"
    elif new_status == "resigned":
        action_type = "resigned"
    elif new_status == "terminated":
        action_type = "terminated"

    create_action(
        db=db,
        applicant_id=employee["applicant_id"],
        employee_id=employee_id,
        action_type=action_type,
        old_status=old_status,
        new_status=new_status,
        old_position_id=old_position_id,
        new_position_id=new_position_id,
        old_department_id=get_department_id_for_position(db, old_position_id) if old_position_id else None,
        new_department_id=get_department_id_for_position(db, new_position_id) if new_position_id else None,
        performed_by=performed_by,
        notes=notes or f"Employee moved from {old_status} to {new_status}",
    )

    db.commit()
    flash("Employee updated successfully.", "success")
    return redirect(url_for("employee_detail", employee_id=employee_id))


@app.template_filter("status_label")
def status_label(value):
    if not value:
        return "-"
    return str(value).replace("_", " ").title()


@app.template_filter("short_date")
def short_date(value):
    if not value:
        return "-"
    try:
        dt = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
        return dt.strftime("%d %b %Y")
    except Exception:
        return value


if __name__ == "__main__":
    init_db()
    app.run(debug=True)

from flask import Blueprint, render_template
from app.db import get_db

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/")
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
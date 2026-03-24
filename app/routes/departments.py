import sqlite3
from flask import Blueprint, render_template, request, redirect, url_for, flash
from app.db import get_db
from app.utils import now_ts
from app.auth import login_required


departments_bp = Blueprint("departments", __name__, url_prefix="/departments")




@departments_bp.route("/", methods=["GET", "POST"])
@login_required

def departments():
    db = get_db()

    if request.method == "POST":
        department_name = request.form.get("department_name", "").strip()
        if not department_name:
            flash("Department name is required.", "error")
            return redirect(url_for("departments.departments"))

        try:
            db.execute(
                "INSERT INTO departments (department_name, created_at) VALUES (?, ?)",
                (department_name, now_ts()),
            )
            db.commit()
            flash("Department created successfully.", "success")
        except sqlite3.IntegrityError:
            flash("Department already exists.", "error")

        return redirect(url_for("departments.departments"))

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

from flask import Blueprint, render_template
from app.db import get_db

bp = Blueprint('departments', __name__, url_prefix='/departments')



@departments_bp.route("/overview")
@login_required
def overview():
    db = get_db()

    rows = db.execute(
        """
        SELECT
            d.department_id,
            d.department_name,
            COUNT(DISTINCT p.position_id) AS positions_count
        FROM departments d
        LEFT JOIN positions p ON p.department_id = d.department_id
        GROUP BY d.department_id, d.department_name
        ORDER BY d.department_name
        """
    ).fetchall()

    departments = []
    for row in rows:
        departments.append({
            "department_id": row["department_id"],
            "department_name": row["department_name"],
            "positions_count": row["positions_count"],
            "projects_count": 2,
            "people_assigned": 5,
            "workload": "74%",
            "next_deadline": "2026-04-10",
        })

    if not departments:
        departments = [
            {
                "department_id": 1,
                "department_name": "Human Resources",
                "positions_count": 4,
                "projects_count": 2,
                "people_assigned": 6,
                "workload": "72%",
                "next_deadline": "2026-04-05",
            },
            {
                "department_id": 2,
                "department_name": "IT",
                "positions_count": 7,
                "projects_count": 3,
                "people_assigned": 12,
                "workload": "81%",
                "next_deadline": "2026-03-30",
            },
            {
                "department_id": 3,
                "department_name": "Finance",
                "positions_count": 3,
                "projects_count": 1,
                "people_assigned": 4,
                "workload": "65%",
                "next_deadline": "2026-04-12",
            },
            {
                "department_id": 4,
                "department_name": "Marketing",
                "positions_count": 5,
                "projects_count": 2,
                "people_assigned": 8,
                "workload": "76%",
                "next_deadline": "2026-04-18",
            },
        ]

    grouped_projects = {
        1: [
            {"name": "Recruitment Drive", "status": "Active", "assigned_people": 3, "deadline": "2026-04-05"},
            {"name": "Policy Update", "status": "Planning", "assigned_people": 2, "deadline": "2026-04-20"},
        ],
        2: [
            {"name": "Internal Portal", "status": "Active", "assigned_people": 5, "deadline": "2026-03-30"},
            {"name": "Network Upgrade", "status": "Active", "assigned_people": 4, "deadline": "2026-04-14"},
        ],
        3: [
            {"name": "Quarterly Reporting", "status": "Active", "assigned_people": 2, "deadline": "2026-04-12"},
        ],
        4: [
            {"name": "Spring Campaign", "status": "Active", "assigned_people": 4, "deadline": "2026-04-18"},
            {"name": "Social Media Plan", "status": "Review", "assigned_people": 2, "deadline": "2026-04-22"},
        ],
    }

    return render_template(
        "departments_overview.html",
        departments=departments,
        grouped_projects=grouped_projects
    )    
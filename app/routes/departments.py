import sqlite3
from flask import Blueprint, render_template, request, redirect, url_for, flash
from app.db import get_db
from app.utils import now_ts

departments_bp = Blueprint("departments", __name__)


@departments_bp.route("/departments", methods=["GET", "POST"])
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
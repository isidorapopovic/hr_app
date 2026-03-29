from flask import Blueprint, render_template, request, redirect, url_for, flash
from app.db import get_db
from app.utils import now_ts

positions_bp = Blueprint("positions", __name__)


@positions_bp.route("/positions", methods=["GET", "POST"])
def positions():
    db = get_db()

    if request.method == "POST":
        position_title = request.form.get("position_title", "").strip()
        department_id = request.form.get("department_id")
        position_level = request.form.get("position_level", "").strip() or None
        is_active = 1 if request.form.get("is_active") == "1" else 0

        if not position_title or not department_id:
            flash("Position title and department are required.", "error")
            return redirect(url_for("positions.positions"))

        db.execute(
            """
            INSERT INTO positions (position_title, department_id, position_level, is_active, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (position_title, department_id, position_level, is_active, now_ts()),
        )
        db.commit()
        flash("Position created successfully.", "success")
        return redirect(url_for("positions.positions"))

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
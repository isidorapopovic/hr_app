from flask import Blueprint, render_template, request, redirect, url_for, flash
from app.db import get_db
from app.utils import now_ts
from app.services.hr_service import create_action, get_department_id_for_position
from app.auth import login_required

applicants_bp = Blueprint("applicants", __name__)


@applicants_bp.route("/applicants")
@login_required
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


@applicants_bp.route("/applicants/new", methods=["GET", "POST"])
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
            return redirect(url_for("applicants.applicant_new"))

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
        return redirect(url_for("applicants.applicant_detail", applicant_id=applicant_id))

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


@applicants_bp.route("/applicants/<int:applicant_id>")
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
        return redirect(url_for("applicants.applicants"))

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


@applicants_bp.route("/applicants/<int:applicant_id>/status", methods=["POST"])
def applicant_update_status(applicant_id):
    db = get_db()

    applicant = db.execute(
        "SELECT * FROM applicants WHERE applicant_id = ?",
        (applicant_id,),
    ).fetchone()

    if applicant is None:
        flash("Applicant not found.", "error")
        return redirect(url_for("applicants.applicants"))

    new_status = request.form.get("new_status", "").strip()
    performed_by = request.form.get("performed_by", "").strip() or "HR Admin"
    notes = request.form.get("notes", "").strip() or None
    new_position_id = request.form.get("position_id") or applicant["position_id"]

    if new_position_id == "":
        new_position_id = applicant["position_id"]

    valid_statuses = {"applied", "in_review", "interview", "offered", "rejected", "withdrawn", "hired"}
    if new_status not in valid_statuses:
        flash("Invalid status selected.", "error")
        return redirect(url_for("applicants.applicant_detail", applicant_id=applicant_id))

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

    employee = db.execute(
        "SELECT * FROM employees WHERE applicant_id = ?",
        (applicant_id,),
    ).fetchone()
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
    return redirect(url_for("applicants.applicant_detail", applicant_id=applicant_id))
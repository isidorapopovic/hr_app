from flask import Blueprint, flash, redirect, render_template, request, url_for

from app.db import get_db
from app.utils import now_ts
from app.services.hr_service import create_action, get_department_id_for_position
from app.auth import login_required

employees_bp = Blueprint("employees", __name__)



@employees_bp.route("/employees")
@login_required
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

    return render_template(
        "employees.html",
        employees=rows,
        statuses=statuses,
        selected_status=status_filter,
    )


@employees_bp.route("/employees/<int:employee_id>")
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
        return redirect(url_for("employees.employees"))

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


@employees_bp.route("/employees/<int:employee_id>/status", methods=["POST"])
def employee_update_status(employee_id):
    db = get_db()

    employee = db.execute(
        "SELECT * FROM employees WHERE employee_id = ?",
        (employee_id,),
    ).fetchone()

    if employee is None:
        flash("Employee not found.", "error")
        return redirect(url_for("employees.employees"))

    new_status = request.form.get("new_status", "").strip()
    new_position_id = request.form.get("position_id") or employee["position_id"]
    performed_by = request.form.get("performed_by", "").strip() or "HR Admin"
    notes = request.form.get("notes", "").strip() or None

    valid_statuses = {"active", "on_leave", "transferred", "resigned", "terminated"}
    if new_status not in valid_statuses:
        flash("Invalid employee status selected.", "error")
        return redirect(url_for("employees.employee_detail", employee_id=employee_id))

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
    return redirect(url_for("employees.employee_detail", employee_id=employee_id))
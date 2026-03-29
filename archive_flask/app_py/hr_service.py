import os
import sqlite3
from flask import current_app
from app.utils import now_ts


def get_department_id_for_position(db, position_id):
    row = db.execute(
        "SELECT department_id FROM positions WHERE position_id = ?",
        (position_id,),
    ).fetchone()
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

    for applicant_id, employee_id in hired_map.items():
        employee = db.execute(
            "SELECT * FROM employees WHERE employee_id = ?",
            (employee_id,),
        ).fetchone()

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


def init_db():
    db_path = current_app.config["DATABASE"]
    print("Initialising database at:", db_path)

    db = sqlite3.connect(db_path)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON;")

    base_dir = os.path.dirname(os.path.dirname(current_app.root_path))
    schema_path = os.path.join(base_dir, "schema.sql")

    with open(schema_path, "r", encoding="utf-8") as f:
        db.executescript(f.read())

    db.commit()

    department_count = db.execute("SELECT COUNT(*) AS c FROM departments").fetchone()["c"]
    if department_count == 0:
        seed_data(db)

    db.commit()
    db.close()
    print("Database created or updated successfully.")
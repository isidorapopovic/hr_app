from flask import Blueprint, render_template, request, redirect, url_for, flash, session

auth_bp = Blueprint("auth", __name__)

# simple demo credentials
VALID_USERNAME = "admin"
VALID_PASSWORD = "admin123"


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "").strip()

        if username == VALID_USERNAME and password == VALID_PASSWORD:
            session["user"] = username
            flash("Logged in successfully.", "success")
            return redirect(url_for("dashboard.dashboard"))

        flash("Invalid username or password.", "error")
        return redirect(url_for("auth.login"))

    return render_template("login.html")


@auth_bp.route("/logout")
def logout():
    session.clear()
    flash("You have been logged out.", "success")
    return redirect(url_for("auth.login"))
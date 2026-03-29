import os
from flask import Flask

from config import Config
from app.db import close_db
from app.filters import register_filters

from app.routes.auth import auth_bp
from app.routes.dashboard import dashboard_bp
from app.routes.departments import departments_bp
from app.routes.positions import positions_bp
from app.routes.applicants import applicants_bp
from app.routes.employees import employees_bp


def create_app():
    app = Flask(__name__, template_folder="../templates", static_folder="../static")
    app.config.from_object(Config)

    db_dir = os.path.dirname(app.config["DATABASE"])
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

    if not os.path.exists(app.config["DATABASE"]):
        open(app.config["DATABASE"], "a").close()

    app.teardown_appcontext(close_db)
    register_filters(app)

    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(departments_bp)
    app.register_blueprint(positions_bp)
    app.register_blueprint(applicants_bp)
    app.register_blueprint(employees_bp)

    return app
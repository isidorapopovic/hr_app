
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "hr_system.db")


class Config:
    SECRET_KEY = "change-me-in-production"
    DATABASE = DATABASE
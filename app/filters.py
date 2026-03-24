from datetime import datetime


def status_label(value):
    if not value:
        return "-"
    return str(value).replace("_", " ").title()


def short_date(value):
    if not value:
        return "-"
    try:
        dt = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
        return dt.strftime("%d %b %Y")
    except Exception:
        return value


def register_filters(app):
    app.template_filter("status_label")(status_label)
    app.template_filter("short_date")(short_date)
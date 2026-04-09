function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function daysUntil(dateValue) {
    if (!dateValue) return null;

    const today = new Date();
    const target = new Date(dateValue);

    if (Number.isNaN(target.getTime())) return null;

    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);

    return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function getRiskLevel(score) {
    if (score >= 75) return 'High';
    if (score >= 45) return 'Medium';
    return 'Low';
}

function buildEmployeeRiskCards(employees) {
    return employees
        .map((emp) => {
            const workload = toNumber(emp.workload_percent);
            const activeProjects = toNumber(emp.active_projects);
            const overdueProjects = toNumber(emp.overdue_projects);
            const urgentProjects = toNumber(emp.urgent_projects);

            let score = 0;
            score += Math.min(workload, 100) * 0.6;
            score += Math.min(activeProjects * 8, 20);
            score += overdueProjects * 12;
            score += urgentProjects * 6;

            const risk = getRiskLevel(score);

            let reason = 'Stable workload pattern.';
            if (risk === 'High') {
                reason = 'High workload combined with active delivery pressure.';
            } else if (risk === 'Medium') {
                reason = 'Capacity pressure should be monitored.';
            }

            return {
                ...emp,
                risk_score: Math.round(score),
                predicted_risk: risk,
                reason
            };
        })
        .sort((a, b) => b.risk_score - a.risk_score);
}

function buildTeamHeatmap(departments, employeeRiskCards) {
    return departments.map((dept) => {
        const deptEmployees = employeeRiskCards.filter(
            (e) => String(e.department_id) === String(dept.department_id)
        );

        const high = deptEmployees.filter((e) => e.predicted_risk === 'High').length;
        const medium = deptEmployees.filter((e) => e.predicted_risk === 'Medium').length;
        const low = deptEmployees.filter((e) => e.predicted_risk === 'Low').length;
        const avgRiskScore = deptEmployees.length
            ? Math.round(
                deptEmployees.reduce((sum, e) => sum + toNumber(e.risk_score), 0) / deptEmployees.length
            )
            : 0;

        return {
            department_id: dept.department_id,
            department_name: dept.department_name,
            total: deptEmployees.length,
            high,
            medium,
            low,
            avgRiskScore
        };
    });
}

function buildCapacityDemand(departments, employeeRiskCards, projects) {
    return departments.map((dept) => {
        const deptEmployees = employeeRiskCards.filter(
            (e) => String(e.department_id) === String(dept.department_id)
        );
        const deptProjects = projects.filter(
            (p) => String(p.department_id) === String(dept.department_id)
        );

        const headcount = deptEmployees.length;
        const capacityUnits = headcount * 100;
        const demandUnits = deptEmployees.reduce(
            (sum, e) => sum + toNumber(e.workload_percent),
            0
        );

        const overdueProjects = deptProjects.filter((p) => p.project_status_group === 'Overdue').length;
        const urgentProjects = deptProjects.filter((p) => p.project_status_group === 'Urgent').length;

        const pressureAdj = overdueProjects * 20 + urgentProjects * 10;
        const adjustedDemand = demandUnits + pressureAdj;

        const utilisationPct = capacityUnits ? Math.round((adjustedDemand / capacityUnits) * 100) : 0;
        const gap = capacityUnits - adjustedDemand;

        return {
            department_id: dept.department_id,
            department_name: dept.department_name,
            headcount,
            capacityUnits,
            demandUnits: adjustedDemand,
            utilisationPct,
            gap,
            status:
                utilisationPct >= 95 ? 'Over capacity'
                    : utilisationPct >= 80 ? 'Tight'
                        : 'Healthy'
        };
    });
}

function buildManagerScorecard(managers, employeeRiskCards, capacityDemand) {
    return managers.map((mgr) => {
        const dept = capacityDemand.find(
            (d) => String(d.department_id) === String(mgr.department_id)
        );

        const deptEmployees = employeeRiskCards.filter(
            (e) => String(e.department_id) === String(mgr.department_id)
        );

        const highRiskEmployees = deptEmployees.filter((e) => e.predicted_risk === 'High').length;
        const mediumRiskEmployees = deptEmployees.filter((e) => e.predicted_risk === 'Medium').length;

        let score = 100;
        score -= highRiskEmployees * 15;
        score -= mediumRiskEmployees * 6;
        score -= dept && dept.utilisationPct > 100 ? 20 : 0;
        score -= dept && dept.utilisationPct >= 90 && dept.utilisationPct <= 100 ? 10 : 0;
        score = Math.max(0, Math.min(100, score));

        return {
            ...mgr,
            employee_count: deptEmployees.length,
            high_risk_employees: highRiskEmployees,
            medium_risk_employees: mediumRiskEmployees,
            utilisation_pct: dept ? dept.utilisationPct : 0,
            manager_health_score: score,
            guidance:
                score < 50
                    ? 'Immediate staffing or reprioritisation review recommended.'
                    : score < 75
                        ? 'Monitor team pressure and rebalance work.'
                        : 'Team pressure looks manageable.'
        };
    });
}

function buildCalendarMonth(events, baseDate = new Date()) {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startWeekday = firstDay.getDay(); // 0=Sun
    const totalDays = lastDay.getDate();

    const days = [];
    const eventMap = new Map();

    events.forEach((evt) => {
        if (!evt.date) return;
        const key = new Date(evt.date).toISOString().slice(0, 10);
        if (!eventMap.has(key)) eventMap.set(key, []);
        eventMap.get(key).push(evt);
    });

    for (let i = 0; i < startWeekday; i += 1) {
        days.push({ empty: true });
    }

    for (let day = 1; day <= totalDays; day += 1) {
        const dateObj = new Date(year, month, day);
        const key = dateObj.toISOString().slice(0, 10);

        days.push({
            empty: false,
            day,
            date: key,
            events: eventMap.get(key) || []
        });
    }

    while (days.length % 7 !== 0) {
        days.push({ empty: true });
    }

    return {
        monthLabel: baseDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' }),
        weeks: Array.from({ length: days.length / 7 }, (_, index) =>
            days.slice(index * 7, index * 7 + 7)
        )
    };
}

function buildPredictionCalendar(projects, employeeRiskCards) {
    const events = [];

    projects.forEach((project) => {
        if (!project.deadline) return;

        const delta = daysUntil(project.deadline);
        let type = 'deadline';

        if (delta !== null && delta < 0) type = 'overdue';
        else if (delta !== null && delta <= 7) type = 'urgent';

        events.push({
            date: project.deadline,
            type,
            label: project.project_name,
            meta: project.department_name || 'No department'
        });
    });

    employeeRiskCards
        .filter((emp) => emp.predicted_risk === 'High')
        .slice(0, 12)
        .forEach((emp) => {
            events.push({
                date: new Date().toISOString().slice(0, 10),
                type: 'risk',
                label: `${emp.full_name} high risk`,
                meta: emp.department_name || 'No department'
            });
        });

    return buildCalendarMonth(events);
}

function decorateProjects(projects) {
    return projects.map((project) => {
        const delta = daysUntil(project.deadline);

        let project_status_group = 'Normal';
        if (delta !== null && delta < 0 && String(project.status || '').toLowerCase() !== 'completed') {
            project_status_group = 'Overdue';
        } else if (
            delta !== null &&
            delta >= 0 &&
            delta <= 7 &&
            String(project.status || '').toLowerCase() !== 'completed'
        ) {
            project_status_group = 'Urgent';
        }

        return {
            ...project,
            project_status_group
        };
    });
}

module.exports = {
    decorateProjects,
    buildEmployeeRiskCards,
    buildTeamHeatmap,
    buildCapacityDemand,
    buildManagerScorecard,
    buildPredictionCalendar
};
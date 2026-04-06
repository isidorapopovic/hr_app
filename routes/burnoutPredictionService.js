function toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function daysBetween(dateA, dateB) {
    const ms = dateB.getTime() - dateA.getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function getDeadlinePressure(projects) {
    const today = new Date();

    let urgentCount = 0;
    let delayedCount = 0;

    for (const project of projects) {
        const status = String(project.status || '').toLowerCase();
        if (!project.deadline || status === 'completed') continue;

        const deadline = new Date(project.deadline);
        const diffDays = daysBetween(today, deadline);

        if (diffDays < 0) {
            delayedCount += 1;
        } else if (diffDays <= 7) {
            urgentCount += 1;
        }
    }

    return { urgentCount, delayedCount };
}

function calculateRiskScore(employee) {
    let score = 0;
    const reasons = [];

    const workload = toNumber(employee.workload_percent);
    const projectCount = toNumber(employee.project_count);
    const urgentProjects = toNumber(employee.urgent_projects);
    const delayedProjects = toNumber(employee.delayed_projects);
    const managerSpan = toNumber(employee.manager_span);
    const tenureDays = toNumber(employee.tenure_days);

    if (workload >= 90) {
        score += 35;
        reasons.push('Very high workload');
    } else if (workload >= 80) {
        score += 25;
        reasons.push('High workload');
    } else if (workload >= 70) {
        score += 15;
        reasons.push('Elevated workload');
    }

    if (projectCount >= 4) {
        score += 15;
        reasons.push('High project concurrency');
    } else if (projectCount >= 2) {
        score += 8;
        reasons.push('Multiple parallel projects');
    }

    if (urgentProjects >= 2) {
        score += 12;
        reasons.push('Several near-term deadlines');
    } else if (urgentProjects === 1) {
        score += 6;
        reasons.push('One urgent deadline');
    }

    if (delayedProjects >= 2) {
        score += 16;
        reasons.push('Working on delayed projects');
    } else if (delayedProjects === 1) {
        score += 8;
        reasons.push('Assigned to a delayed project');
    }

    if (managerSpan >= 8) {
        score += 8;
        reasons.push('Manager has a wide span');
    } else if (managerSpan >= 5) {
        score += 4;
        reasons.push('Manager span may limit support');
    }

    if (tenureDays > 0 && tenureDays <= 90) {
        score += 6;
        reasons.push('Recently joined');
    }

    if (employee.recent_role_change) {
        score += 6;
        reasons.push('Recent role change');
    }

    const cappedScore = Math.min(score, 100);

    let riskLevel = 'Low';
    if (cappedScore >= 65) riskLevel = 'High';
    else if (cappedScore >= 40) riskLevel = 'Medium';

    return {
        burnout_score: cappedScore,
        burnout_risk: riskLevel,
        top_reasons: reasons.slice(0, 3)
    };
}

function enrichBurnoutEmployees(rows) {
    return rows.map((row) => {
        const score = calculateRiskScore(row);
        return {
            ...row,
            ...score
        };
    });
}

function buildBurnoutSummary(employees) {
    return {
        totalEmployees: employees.length,
        highRiskEmployees: employees.filter((e) => e.burnout_risk === 'High').length,
        mediumRiskEmployees: employees.filter((e) => e.burnout_risk === 'Medium').length,
        avgScore: employees.length
            ? Math.round(
                employees.reduce((sum, e) => sum + toNumber(e.burnout_score), 0) / employees.length
            )
            : 0
    };
}

function buildTeamFlags(employees) {
    const grouped = new Map();

    for (const employee of employees) {
        const key = employee.department_name || 'Unassigned';
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(employee);
    }

    return Array.from(grouped.entries())
        .map(([department_name, members]) => {
            const highRiskCount = members.filter((m) => m.burnout_risk === 'High').length;
            const avgScore = members.length
                ? Math.round(
                    members.reduce((sum, m) => sum + toNumber(m.burnout_score), 0) / members.length
                )
                : 0;

            let status = 'Stable';
            if (avgScore >= 60 || highRiskCount >= 2) status = 'Critical';
            else if (avgScore >= 40 || highRiskCount >= 1) status = 'Watch';

            return {
                department_name,
                employee_count: members.length,
                high_risk_count: highRiskCount,
                avg_score: avgScore,
                status
            };
        })
        .sort((a, b) => b.avg_score - a.avg_score);
}

module.exports = {
    getDeadlinePressure,
    enrichBurnoutEmployees,
    buildBurnoutSummary,
    buildTeamFlags
};
function calculateBurnoutRisk(employee) {
    const workload = Number(employee.workload_percent || 0);

    if (workload >= 85) return 'High';
    if (workload >= 70) return 'Medium';
    return 'Low';
}

function calculateDepartmentStatus(department) {
    let score = 0;

    if ((department.avg_workload || 0) > 80) score += 3;
    else if ((department.avg_workload || 0) > 70) score += 2;

    if ((department.high_risk_ratio || 0) > 0.3) score += 3;
    if ((department.delayed_projects || 0) > 1) score += 2;

    if (score >= 7) return 'Overloaded';
    if (score >= 4) return 'At Risk';
    return 'Stable';
}

function getProjectDelayStatus(project) {
    const today = new Date();
    const deadline = project.deadline ? new Date(project.deadline) : null;
    const status = String(project.status || '').toLowerCase();

    if (status === 'completed') return 'On Track';

    if (deadline && today > deadline && status !== 'completed') {
        return 'Delayed';
    }

    if (deadline) {
        const diffDays = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 7 && status !== 'completed') {
            return 'At Risk';
        }
    }

    return 'On Track';
}

function enrichEmployees(employees) {
    return employees.map((employee) => ({
        ...employee,
        burnout_risk: calculateBurnoutRisk(employee)
    }));
}

function enrichProjects(projects) {
    return projects.map((project) => ({
        ...project,
        delay_status: getProjectDelayStatus(project)
    }));
}

function buildDepartmentInsights(departments, employees, projects) {
    return departments.map((department) => {
        const deptEmployees = employees.filter((e) => e.department_id === department.department_id);
        const deptProjects = projects.filter((p) => p.department_id === department.department_id);

        const employeeCount = deptEmployees.length;
        const highRiskCount = deptEmployees.filter((e) => e.burnout_risk === 'High').length;

        const avgWorkload = employeeCount
            ? deptEmployees.reduce((sum, e) => sum + Number(e.workload_percent || 0), 0) / employeeCount
            : 0;

        const delayedProjects = deptProjects.filter(
            (p) => p.delay_status === 'Delayed' || p.delay_status === 'At Risk'
        ).length;

        const result = {
            ...department,
            employee_count: employeeCount,
            high_risk_count: highRiskCount,
            high_risk_ratio: employeeCount ? highRiskCount / employeeCount : 0,
            avg_workload: Number(avgWorkload.toFixed(0)),
            avg_overtime: 0,
            delayed_projects: delayedProjects
        };

        result.status = calculateDepartmentStatus(result);
        return result;
    });
}

function generateRecommendations(employees, departments, projects) {
    const recommendations = [];

    employees.forEach((employee) => {
        if (employee.burnout_risk === 'High') {
            recommendations.push({
                type: 'employee',
                severity: 'High',
                title: `${employee.full_name} may be overloaded`,
                message: `${employee.full_name} has a high workload percentage and may need workload review.`
            });
        } else if (employee.burnout_risk === 'Medium') {
            recommendations.push({
                type: 'employee',
                severity: 'Medium',
                title: `${employee.full_name} is under pressure`,
                message: `Monitor workload and prioritisation for ${employee.full_name}.`
            });
        }
    });

    departments.forEach((department) => {
        if (department.status === 'Overloaded') {
            recommendations.push({
                type: 'department',
                severity: 'High',
                title: `${department.department_name} is overloaded`,
                message: `This department has high workload pressure and delayed or at-risk projects.`
            });
        } else if (department.status === 'At Risk') {
            recommendations.push({
                type: 'department',
                severity: 'Medium',
                title: `${department.department_name} is at risk`,
                message: `This department should be reviewed for staffing and delivery pressure.`
            });
        }
    });

    projects.forEach((project) => {
        if (project.delay_status === 'Delayed') {
            recommendations.push({
                type: 'project',
                severity: 'High',
                title: `${project.project_name} is delayed`,
                message: `The project deadline has passed and the project is not marked completed.`
            });
        } else if (project.delay_status === 'At Risk') {
            recommendations.push({
                type: 'project',
                severity: 'Medium',
                title: `${project.project_name} is at risk`,
                message: `The project deadline is close and should be monitored.`
            });
        }
    });

    const rank = { High: 1, Medium: 2, Low: 3 };
    recommendations.sort((a, b) => rank[a.severity] - rank[b.severity]);

    return recommendations;
}

module.exports = {
    enrichEmployees,
    enrichProjects,
    buildDepartmentInsights,
    generateRecommendations
};
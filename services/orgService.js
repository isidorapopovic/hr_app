function buildOrgTree(employees, managerId = null) {
    return employees
        .filter((employee) => {
            if (managerId === null) {
                return employee.manager_id === null || employee.manager_id === undefined;
            }
            return employee.manager_id === managerId;
        })
        .map((employee) => ({
            ...employee,
            children: buildOrgTree(employees, employee.employee_id)
        }));
}

module.exports = {
    buildOrgTree
};
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const db = require('../db');

const router = express.Router();

const upload = multer({
    dest: path.join(__dirname, '../uploads'),
    fileFilter: (req, file, cb) => {
        if (!file.originalname.toLowerCase().endsWith('.csv')) {
            return cb(new Error('Only CSV files are allowed.'));
        }
        cb(null, true);
    }
});

const expectedHeaders = {
    departments: ['department_name'],
    positions: ['position_title', 'department_name', 'position_level', 'is_active'],
    applicants: [
        'full_name',
        'years_experience',
        'current_or_last_position',
        'position_title',
        'application_status',
        'applied_at',
        'notes'
    ],
    employees: [
        'applicant_full_name',
        'full_name',
        'position_title',
        'hire_date',
        'employment_status',
        'end_date'
    ],
    projects: [
        'project_name',
        'department_name',
        'start_date',
        'end_date',
        'deadline',
        'status'
    ],
    actions: [
        'applicant_full_name',
        'employee_full_name',
        'action_type',
        'old_status',
        'new_status',
        'old_position_title',
        'new_position_title',
        'old_department_name',
        'new_department_name',
        'action_date',
        'performed_by',
        'notes'
    ]
};

const validApplicantStatuses = [
    'applied',
    'in_review',
    'interview',
    'offered',
    'rejected',
    'withdrawn',
    'hired'
];

const validEmploymentStatuses = [
    'active',
    'on_leave',
    'transferred',
    'resigned',
    'terminated'
];

const validActionTypes = [
    'applicant_arrived',
    'status_changed',
    'interview_scheduled',
    'interview_completed',
    'offer_made',
    'rejected',
    'hired',
    'position_changed',
    'department_changed',
    'promoted',
    'transferred',
    'resigned',
    'terminated'
];

function safeValue(value) {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    return trimmed === '' ? null : trimmed;
}

function renderPage(res, {
    message = null,
    error = null,
    previewRows = [],
    detectedHeaders = [],
    importSummary = null,
    rowErrors = []
} = {}) {
    return res.render('admin_upload_csv', {
        activePage: 'admin-upload',
        isLoggedIn: true,
        message,
        error,
        previewRows,
        detectedHeaders,
        importSummary,
        rowErrors
    });
}

function validateHeaders(uploadType, records) {
    if (!records.length) {
        return {
            ok: false,
            error: 'The CSV file is empty.',
            detectedHeaders: []
        };
    }

    const detectedHeaders = Object.keys(records[0]);
    const requiredHeaders = expectedHeaders[uploadType] || [];

    const missingHeaders = requiredHeaders.filter(
        (header) => !detectedHeaders.includes(header)
    );

    if (missingHeaders.length > 0) {
        return {
            ok: false,
            error: `Missing required columns: ${missingHeaders.join(', ')}`,
            detectedHeaders
        };
    }

    return {
        ok: true,
        detectedHeaders
    };
}

function importDepartments(records) {
    const insertStmt = db.prepare(`
    INSERT INTO departments (department_name)
    VALUES (?)
  `);

    const results = {
        successCount: 0,
        failureCount: 0,
        rowErrors: []
    };

    for (let i = 0; i < records.length; i++) {
        const rowNumber = i + 2;
        const row = records[i];

        try {
            const departmentName = safeValue(row.department_name);

            if (!departmentName) {
                throw new Error('department_name is required.');
            }

            insertStmt.run(departmentName);
            results.successCount++;
        } catch (err) {
            results.failureCount++;
            results.rowErrors.push({
                rowNumber,
                error: err.message
            });
        }
    }

    return results;
}

function importPositions(records) {
    const findDepartmentStmt = db.prepare(`
    SELECT department_id
    FROM departments
    WHERE department_name = ?
  `);

    const insertStmt = db.prepare(`
    INSERT INTO positions (position_title, department_id, position_level, is_active)
    VALUES (?, ?, ?, ?)
  `);

    const results = {
        successCount: 0,
        failureCount: 0,
        rowErrors: []
    };

    for (let i = 0; i < records.length; i++) {
        const rowNumber = i + 2;
        const row = records[i];

        try {
            const positionTitle = safeValue(row.position_title);
            const departmentName = safeValue(row.department_name);
            const positionLevel = safeValue(row.position_level);
            const isActiveRaw = safeValue(row.is_active);

            if (!positionTitle) throw new Error('position_title is required.');
            if (!departmentName) throw new Error('department_name is required.');
            if (isActiveRaw === null) throw new Error('is_active is required.');
            if (!['0', '1'].includes(isActiveRaw)) {
                throw new Error('is_active must be 0 or 1.');
            }

            const department = findDepartmentStmt.get(departmentName);
            if (!department) {
                throw new Error(`Department not found: ${departmentName}`);
            }

            insertStmt.run(
                positionTitle,
                department.department_id,
                positionLevel,
                Number(isActiveRaw)
            );

            results.successCount++;
        } catch (err) {
            results.failureCount++;
            results.rowErrors.push({
                rowNumber,
                error: err.message
            });
        }
    }

    return results;
}

function importApplicants(records) {
    const findPositionStmt = db.prepare(`
    SELECT position_id
    FROM positions
    WHERE position_title = ?
  `);

    const insertStmt = db.prepare(`
    INSERT INTO applicants (
      full_name,
      years_experience,
      current_or_last_position,
      position_id,
      application_status,
      applied_at,
      notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

    const results = {
        successCount: 0,
        failureCount: 0,
        rowErrors: []
    };

    for (let i = 0; i < records.length; i++) {
        const rowNumber = i + 2;
        const row = records[i];

        try {
            const fullName = safeValue(row.full_name);
            const yearsExperienceRaw = safeValue(row.years_experience);
            const currentOrLastPosition = safeValue(row.current_or_last_position);
            const positionTitle = safeValue(row.position_title);
            const applicationStatus = safeValue(row.application_status) || 'applied';
            const appliedAt = safeValue(row.applied_at);
            const notes = safeValue(row.notes);

            if (!fullName) throw new Error('full_name is required.');
            if (yearsExperienceRaw === null) throw new Error('years_experience is required.');

            const yearsExperience = Number(yearsExperienceRaw);
            if (Number.isNaN(yearsExperience) || yearsExperience < 0) {
                throw new Error('years_experience must be a number >= 0.');
            }

            if (!validApplicantStatuses.includes(applicationStatus)) {
                throw new Error(`Invalid application_status: ${applicationStatus}`);
            }

            let positionId = null;
            if (positionTitle) {
                const position = findPositionStmt.get(positionTitle);
                if (!position) {
                    throw new Error(`Position not found: ${positionTitle}`);
                }
                positionId = position.position_id;
            }

            insertStmt.run(
                fullName,
                yearsExperience,
                currentOrLastPosition,
                positionId,
                applicationStatus,
                appliedAt || new Date().toISOString().slice(0, 19).replace('T', ' '),
                notes
            );

            results.successCount++;
        } catch (err) {
            results.failureCount++;
            results.rowErrors.push({
                rowNumber,
                error: err.message
            });
        }
    }

    return results;
}

function importEmployees(records) {
    const findApplicantStmt = db.prepare(`
    SELECT applicant_id
    FROM applicants
    WHERE full_name = ?
  `);

    const findPositionStmt = db.prepare(`
    SELECT position_id, department_id
    FROM positions
    WHERE position_title = ?
  `);

    const insertStmt = db.prepare(`
    INSERT INTO employees (
      applicant_id,
      full_name,
      department_id,
      position_id,
      hire_date,
      employment_status,
      end_date
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

    const results = {
        successCount: 0,
        failureCount: 0,
        rowErrors: []
    };

    for (let i = 0; i < records.length; i++) {
        const rowNumber = i + 2;
        const row = records[i];

        try {
            const applicantFullName = safeValue(row.applicant_full_name);
            const fullName = safeValue(row.full_name);
            const positionTitle = safeValue(row.position_title);
            const hireDate = safeValue(row.hire_date);
            const employmentStatus = safeValue(row.employment_status) || 'active';
            const endDate = safeValue(row.end_date);

            if (!fullName) throw new Error('full_name is required.');
            if (!positionTitle) throw new Error('position_title is required.');
            if (!hireDate) throw new Error('hire_date is required.');

            if (!validEmploymentStatuses.includes(employmentStatus)) {
                throw new Error(`Invalid employment_status: ${employmentStatus}`);
            }

            const position = findPositionStmt.get(positionTitle);
            if (!position) {
                throw new Error(`Position not found: ${positionTitle}`);
            }

            let applicantId = null;
            if (applicantFullName) {
                const applicant = findApplicantStmt.get(applicantFullName);
                if (!applicant) {
                    throw new Error(`Applicant not found: ${applicantFullName}`);
                }
                applicantId = applicant.applicant_id;
            }

            insertStmt.run(
                applicantId,
                fullName,
                position.department_id,
                position.position_id,
                hireDate,
                employmentStatus,
                endDate
            );

            results.successCount++;
        } catch (err) {
            results.failureCount++;
            results.rowErrors.push({
                rowNumber,
                error: err.message
            });
        }
    }

    return results;
}

function importProjects(records) {
    const findDepartmentStmt = db.prepare(`
    SELECT department_id
    FROM departments
    WHERE department_name = ?
  `);

    const insertStmt = db.prepare(`
    INSERT INTO projects (
      project_name,
      department_id,
      start_date,
      end_date,
      deadline,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `);

    const results = {
        successCount: 0,
        failureCount: 0,
        rowErrors: []
    };

    for (let i = 0; i < records.length; i++) {
        const rowNumber = i + 2;
        const row = records[i];

        try {
            const projectName = safeValue(row.project_name);
            const departmentName = safeValue(row.department_name);
            const startDate = safeValue(row.start_date);
            const endDate = safeValue(row.end_date);
            const deadline = safeValue(row.deadline);
            const status = safeValue(row.status) || 'Active';

            if (!projectName) throw new Error('project_name is required.');
            if (!departmentName) throw new Error('department_name is required.');

            const department = findDepartmentStmt.get(departmentName);
            if (!department) {
                throw new Error(`Department not found: ${departmentName}`);
            }

            insertStmt.run(
                projectName,
                department.department_id,
                startDate,
                endDate,
                deadline,
                status
            );

            results.successCount++;
        } catch (err) {
            results.failureCount++;
            results.rowErrors.push({
                rowNumber,
                error: err.message
            });
        }
    }

    return results;
}

function importActions(records) {
    const findApplicantStmt = db.prepare(`
    SELECT applicant_id
    FROM applicants
    WHERE full_name = ?
  `);

    const findEmployeeStmt = db.prepare(`
    SELECT employee_id
    FROM employees
    WHERE full_name = ?
  `);

    const findPositionStmt = db.prepare(`
    SELECT position_id
    FROM positions
    WHERE position_title = ?
  `);

    const findDepartmentStmt = db.prepare(`
    SELECT department_id
    FROM departments
    WHERE department_name = ?
  `);

    const insertStmt = db.prepare(`
    INSERT INTO actions (
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
      notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

    const results = {
        successCount: 0,
        failureCount: 0,
        rowErrors: []
    };

    for (let i = 0; i < records.length; i++) {
        const rowNumber = i + 2;
        const row = records[i];

        try {
            const applicantFullName = safeValue(row.applicant_full_name);
            const employeeFullName = safeValue(row.employee_full_name);
            const actionType = safeValue(row.action_type);
            const oldStatus = safeValue(row.old_status);
            const newStatus = safeValue(row.new_status);
            const oldPositionTitle = safeValue(row.old_position_title);
            const newPositionTitle = safeValue(row.new_position_title);
            const oldDepartmentName = safeValue(row.old_department_name);
            const newDepartmentName = safeValue(row.new_department_name);
            const actionDate = safeValue(row.action_date) || new Date().toISOString().slice(0, 19).replace('T', ' ');
            const performedBy = safeValue(row.performed_by);
            const notes = safeValue(row.notes);

            if (!actionType) throw new Error('action_type is required.');
            if (!validActionTypes.includes(actionType)) {
                throw new Error(`Invalid action_type: ${actionType}`);
            }

            let applicantId = null;
            let employeeId = null;
            let oldPositionId = null;
            let newPositionId = null;
            let oldDepartmentId = null;
            let newDepartmentId = null;

            if (applicantFullName) {
                const applicant = findApplicantStmt.get(applicantFullName);
                if (!applicant) throw new Error(`Applicant not found: ${applicantFullName}`);
                applicantId = applicant.applicant_id;
            }

            if (employeeFullName) {
                const employee = findEmployeeStmt.get(employeeFullName);
                if (!employee) throw new Error(`Employee not found: ${employeeFullName}`);
                employeeId = employee.employee_id;
            }

            if (!applicantId && !employeeId) {
                throw new Error('At least one of applicant_full_name or employee_full_name must exist.');
            }

            if (oldPositionTitle) {
                const position = findPositionStmt.get(oldPositionTitle);
                if (!position) throw new Error(`Old position not found: ${oldPositionTitle}`);
                oldPositionId = position.position_id;
            }

            if (newPositionTitle) {
                const position = findPositionStmt.get(newPositionTitle);
                if (!position) throw new Error(`New position not found: ${newPositionTitle}`);
                newPositionId = position.position_id;
            }

            if (oldDepartmentName) {
                const department = findDepartmentStmt.get(oldDepartmentName);
                if (!department) throw new Error(`Old department not found: ${oldDepartmentName}`);
                oldDepartmentId = department.department_id;
            }

            if (newDepartmentName) {
                const department = findDepartmentStmt.get(newDepartmentName);
                if (!department) throw new Error(`New department not found: ${newDepartmentName}`);
                newDepartmentId = department.department_id;
            }

            insertStmt.run(
                applicantId,
                employeeId,
                actionType,
                oldStatus,
                newStatus,
                oldPositionId,
                newPositionId,
                oldDepartmentId,
                newDepartmentId,
                actionDate,
                performedBy,
                notes
            );

            results.successCount++;
        } catch (err) {
            results.failureCount++;
            results.rowErrors.push({
                rowNumber,
                error: err.message
            });
        }
    }

    return results;
}

function runImport(uploadType, records) {
    switch (uploadType) {
        case 'departments':
            return importDepartments(records);
        case 'positions':
            return importPositions(records);
        case 'applicants':
            return importApplicants(records);
        case 'employees':
            return importEmployees(records);
        case 'projects':
            return importProjects(records);
        case 'actions':
            return importActions(records);
        default:
            throw new Error('Unsupported upload type.');
    }
}

router.get('/upload-csv', (req, res) => {
    return renderPage(res);
});

router.post('/upload-csv', upload.single('csvFile'), (req, res) => {
    try {
        const uploadType = req.body.uploadType;

        if (!uploadType || !expectedHeaders[uploadType]) {
            return renderPage(res, {
                error: 'Please select a valid upload type.'
            });
        }

        if (!req.file) {
            return renderPage(res, {
                error: 'Please choose a CSV file.'
            });
        }

        const filePath = req.file.path;
        const fileContent = fs.readFileSync(filePath, 'utf8');

        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        fs.unlinkSync(filePath);

        const headerCheck = validateHeaders(uploadType, records);

        if (!headerCheck.ok) {
            return renderPage(res, {
                error: headerCheck.error,
                detectedHeaders: headerCheck.detectedHeaders
            });
        }

        const importResult = runImport(uploadType, records);

        return renderPage(res, {
            message: `Import finished for ${uploadType}.`,
            detectedHeaders: headerCheck.detectedHeaders,
            previewRows: records.slice(0, 5),
            importSummary: {
                uploadType,
                totalRows: records.length,
                successCount: importResult.successCount,
                failureCount: importResult.failureCount
            },
            rowErrors: importResult.rowErrors
        });
    } catch (error) {
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        return renderPage(res, {
            error: error.message || 'Failed to process CSV file.'
        });
    }
});

module.exports = router;
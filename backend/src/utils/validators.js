/**
 * Simple validation helpers. Returns { valid, errors }.
 */
function validateRequired(obj, fields) {
    const errors = [];
    for (const field of fields) {
        if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
            errors.push(`${field} is required`);
        }
    }
    return { valid: errors.length === 0, errors };
}

function validateNumericPositive(obj, fields) {
    const errors = [];
    for (const field of fields) {
        const val = Number(obj[field]);
        if (isNaN(val) || val <= 0) {
            errors.push(`${field} must be a positive number`);
        }
    }
    return { valid: errors.length === 0, errors };
}

function validateEnum(value, allowed, fieldName) {
    if (!allowed.includes(value)) {
        return { valid: false, errors: [`${fieldName} must be one of: ${allowed.join(', ')}`] };
    }
    return { valid: true, errors: [] };
}

module.exports = { validateRequired, validateNumericPositive, validateEnum };

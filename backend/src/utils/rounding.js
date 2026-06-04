/**
 * Round half-up to specified decimals (default 2).
 * This is the standard rounding used throughout the system for monetary values.
 */
function roundHalfUp(value, decimals = 2) {
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    if (isNaN(num)) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor + Number.EPSILON) / factor;
}

module.exports = { roundHalfUp };

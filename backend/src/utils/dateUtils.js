/**
 * Add N months to a date, handling month-end edge cases.
 * E.g., Jan 31 + 1 month = Feb 28 (or 29 in leap year).
 */
function addMonths(date, months) {
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    // If the day changed (e.g., 31 → 3 because Feb doesn't have 31), set to last day of expected month
    if (d.getDate() !== day) {
        d.setDate(0); // sets to last day of previous month
    }
    return d;
}

/**
 * Format date as YYYY-MM-DD string.
 */
function formatDate(date) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Get the number of days between two dates.
 */
function daysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    const diff = d2.getTime() - d1.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Add N days to a date.
 */
function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

module.exports = { addMonths, formatDate, daysBetween, addDays };

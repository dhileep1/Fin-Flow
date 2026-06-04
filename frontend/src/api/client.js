const API_BASE = '/api/v1';

class ApiClient {
    constructor() {
        this.token = localStorage.getItem('lendEasyToken');
        this.orgId = localStorage.getItem('lendEasyOrgId');
    }

    setAuth(token, orgId) {
        this.token = token;
        this.orgId = orgId;
        localStorage.setItem('lendEasyToken', token);
        localStorage.setItem('lendEasyOrgId', orgId);
    }

    clearAuth() {
        this.token = null;
        this.orgId = null;
        localStorage.removeItem('lendEasyToken');
        localStorage.removeItem('lendEasyOrgId');
        localStorage.removeItem('lendEasyUser');
    }

    get baseUrl() {
        return `${API_BASE}/${this.orgId}`;
    }

    async request(path, options = {}) {
        const isAbsoluteHttp = path.startsWith('http');
        const isAbsoluteApi = path.startsWith('/api/');

        if (!isAbsoluteHttp && !isAbsoluteApi && !this.orgId) {
            throw new Error('Organization ID not set. Please log in again.');
        }

        const url = isAbsoluteHttp
            ? path
            : isAbsoluteApi
                ? path
                : `${this.baseUrl}${path}`;
        const headers = {
            'Content-Type': 'application/json',
            ...(this.token && { Authorization: `Bearer ${this.token}` }),
            ...options.headers,
        };

        const res = await fetch(url, { ...options, headers });

        if (res.status === 401) {
            this.clearAuth();
            window.location.href = '/login';
            throw new Error('Session expired');
        }

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Request failed: ${res.status}`);
        }

        // Handle PDF/binary responses
        if (res.headers.get('Content-Type')?.includes('application/pdf')) {
            return res.blob();
        }

        return res.json();
    }

    get(path) { return this.request(path); }

    post(path, data) {
        return this.request(path, { method: 'POST', body: JSON.stringify(data) });
    }

    put(path, data) {
        return this.request(path, { method: 'PUT', body: JSON.stringify(data) });
    }

    delete(path) {
        return this.request(path, { method: 'DELETE' });
    }

    // --- Auth ---
    login(orgId, credentials) {
        return this.request(`/api/v1/${orgId}/auth/login`, {
            method: 'POST',
            body: JSON.stringify(credentials),
        });
    }

    // --- Dashboard ---
    getDashboardStats(timeframe = 'daily') { return this.get(`/reports/dashboard?timeframe=${timeframe}`); }

    // --- Customers ---
    getCustomers(params = '') { return this.get(`/customers?${params}`); }
    getCustomer(id) { return this.get(`/customers/${id}`); }
    createCustomer(data) { return this.post('/customers', data); }
    updateCustomer(id, data) { return this.put(`/customers/${id}`, data); }

    // --- Vehicles ---
    getVehicles(params = '') { return this.get(`/vehicles?${params}`); }
    createVehicle(data) { return this.post('/vehicles', data); }

    // --- Loans ---
    getLoans(params = '') { return this.get(`/loans?${params}`); }
    getLoan(id) { return this.get(`/loans/${id}`); }
    createLoan(data) { return this.post('/loans', data); }
    getDues(params = '') { return this.get(`/loans/dues?${params}`); }

    // --- Payments ---
    createPayment(data) { return this.post('/payments', data); }
    getPayments(loanId) { return this.get(`/payments?loanId=${loanId}`); }
    getReceipt(paymentId) { return this.get(`/payments/${paymentId}/receipt`); }

    // --- Call Tasks ---
    getCallTasks(params = '') { return this.get(`/call-tasks?${params}`); }
    createCallLog(data) { return this.post('/call-tasks/logs', data); }

    // --- Notifications ---
    sendNotification(data) { return this.post('/notifications/send', data); }

    // --- Search ---
    search(query, type) { 
        return this.get(`/search?q=${encodeURIComponent(query)}${type ? `&type=${type}` : ''}`); 
    }

    // --- Reports ---
    getCollectionsReport(from, to) { return this.get(`/reports/collections?from=${from}&to=${to}`); }

    // --- Admin ---
    getOrgSettings() { return this.get('/admin/settings'); }
    updateOrgSettings(data) { return this.put('/admin/settings', data); }
    getUsers() { return this.get('/admin/users'); }
    createUser(data) { return this.post('/admin/users', data); }
    updateUser(id, data) { return this.put(`/admin/users/${id}`, data); }
}

const api = new ApiClient();
export default api;

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/client';
import { Search as SearchIcon, Pencil, ChevronLeft, ChevronRight, User, Phone, PlusCircle } from 'lucide-react';

const formatCurrency = (amount) =>
    `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const AVATAR_COLORS = ['avatar-neutral'];

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function getAvatarColor(name) {
    if (!name) return AVATAR_COLORS[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatAadhaar(value) {
    const digits = value.replace(/\D/g, '').slice(0, 12);
    const parts = [];
    for (let i = 0; i < digits.length; i += 4) {
        parts.push(digits.slice(i, i + 4));
    }
    return parts.join(' ');
}

const getOverallStanding = (customer) => {
    if (!customer.loans || customer.loans.length === 0) return { label: 'No History', color: 'badge-neutral' };
    
    // Defaulter check: If ANY loan is marked as defaulter
    const hasDefaulter = customer.loans.some(l => l.status === 'defaulter');
    if (hasDefaulter) return { label: 'Defaulter', color: 'badge-defaulter' };

    // Warning check: If ANY active loan has overdue dues
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const hasOverdue = customer.loans.some(l => 
        l.status === 'active' && l.nextDueDate && new Date(l.nextDueDate) < now
    );
    if (hasOverdue) return { label: 'Warning', color: 'badge-overdue' };

    // Good Standing: If they have active loans and none are overdue
    const hasActive = customer.loans.some(l => l.status === 'active');
    if (hasActive) return { label: 'Good', color: 'badge-success' };

    // If they have only closed loans and no defaulters
    return { label: 'Closed', color: 'badge-neutral' };
};

const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const PAGE_SIZE = 10;

export default function Customers() {
    const [customers, setCustomers] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('name');
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', phone: '', address: '', aadharNumber: '' });
    const [submitting, setSubmitting] = useState(false);
    const [page, setPage] = useState(1);
    const navigate = useNavigate();

    const location = useLocation();

    useEffect(() => {
        if (location.state?.q) {
            setSearch(location.state.q);
            setFilterType(location.state.type || 'name');
        }
    }, [location.state]);

    useEffect(() => {
        setPage(1);
    }, [search, filterType]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            loadCustomers(`q=${search}&type=${filterType}`);
        }, 300);
        return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, search, filterType]);

    const loadCustomers = async (q = '') => {
        try {
            setLoading(true);
            const data = await api.getCustomers(q);
            setCustomers(data.customers || []);
            setTotalCount(data.total || data.customers?.length || 0);
        } catch (err) {
            console.error('Failed to load customers:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchAction = () => {
        setPage(1);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.createCustomer({
                ...formData,
                aadharNumber: formData.aadharNumber.replace(/\s/g, ''),
            });
            setShowForm(false);
            setFormData({ name: '', phone: '', address: '', aadharNumber: '' });
            loadCustomers();
        } catch (err) {
            alert(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const pagedCustomers = customers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));
    const startIdx = (page - 1) * PAGE_SIZE + 1;
    const endIdx = Math.min(page * PAGE_SIZE, customers.length);

    return (
        <div className="animate-fade-in" style={{ maxWidth: 1200 }}>
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Customers</h1>
                    <p className="page-subtitle">Manage borrowers and their vehicles</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                    {showForm ? 'Cancel' : '+ Add Customer'}
                </button>
            </div>

            {showForm && (
                <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                    <h3 style={{ marginBottom: 'var(--space-4)', fontWeight: 600 }}>New Customer</h3>
                    <form onSubmit={handleCreate}>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Name *</label>
                                <input className="form-input" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone *</label>
                                <input className="form-input" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Aadhaar</label>
                                <input
                                    className="form-input"
                                    value={formData.aadharNumber}
                                    onChange={(e) => setFormData({ ...formData, aadharNumber: formatAadhaar(e.target.value) })}
                                    placeholder="XXXX XXXX XXXX"
                                    maxLength={14}
                                />
                            </div>
                        </div>
                        <div className="form-group mt-4">
                            <label className="form-label">Address</label>
                            <textarea className="form-textarea" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows={2} />
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button type="submit" className="btn btn-primary" disabled={submitting}>
                                {submitting ? <span className="loading-spinner" /> : 'Create Customer'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Table Controls (Local Filter) */}
            <div className="flex items-center justify-between mb-4">
                <div className="search-bar">
                    <input
                        type="text"
                        placeholder="Filter by name, phone, or vehicle..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <SearchIcon size={16} className="search-icon" />
                </div>
                
                {/* Status Dropdown */}
                <div className="ml-4 flex-shrink-0">
                    <select 
                        className="form-select"
                        style={{ minWidth: '140px', paddingRight: '2rem' }}
                    >
                        <option value="">All Customers</option>
                        <option value="active">Active Loans</option>
                        <option value="closed">No Active Loans</option>
                    </select>
                </div>
            </div>

            <div className="table-container">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <th className="px-6 py-4 text-left">Customer</th>
                            <th className="px-6 py-4 text-left">Phone</th>
                            <th className="px-6 py-4 text-center">Active</th>
                            <th className="px-6 py-4 text-center">Closed</th>
                            <th className="px-6 py-4 text-right">Outstanding</th>
                            <th className="px-6 py-4 text-left">Guarantor For</th>
                            <th className="px-6 py-4 text-center">Standing</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <tr key={i}>
                                    {[...Array(8)].map((_, j) => (
                                        <td key={j}><div className="loading-skeleton" style={{ height: 16, width: '80%' }} /></td>
                                    ))}
                                </tr>
                            ))
                        ) : customers.length === 0 ? (
                            <tr>
                                <td colSpan={8}>
                                    <div className="empty-state-inline">
                                        <div className="empty-icon"><User size={24} /></div>
                                        <div className="empty-title">
                                            {search ? 'No customers match your search' : 'No customers yet'}
                                        </div>
                                        <div className="empty-desc">
                                            {search ? 'Try a different search term' : 'Add your first customer above to get started.'}
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            pagedCustomers.map((c) => {
                                const standing = getOverallStanding(c);
                                const activeLoans = (c.loans || []).filter(l => l.status === 'active' || l.status === 'defaulter');
                                const closedLoans = (c.loans || []).filter(l => l.status === 'closed' || l.status === 'completed' || l.status === 'settled');
                                const totalOutstanding = activeLoans.reduce((sum, l) => sum + Number(l.outstandingPrincipal || 0), 0);
                                const sortedGuarantors = [...(c.guarantorInstances || [])].sort(
                                    (a, b) => new Date(a.loan.startDate || a.loan.createdAt) - new Date(b.loan.startDate || b.loan.createdAt)
                                );

                                return (
                                    <tr 
                                        key={c.id} 
                                        className="cursor-pointer hover-table-row"
                                        onClick={() => {
                                            console.log(`Navigating to /customers/${c.id}/loans`);
                                            navigate(`/customers/${c.id}/loans`);
                                        }}
                                    >
                                        <td className="px-6 py-4 text-left">
                                            <div className="text-slate-900" style={{ fontWeight: 600 }}>{c.name}</div>
                                        </td>
                                        <td className="px-6 py-4 text-left text-slate-600 text-sm">
                                            {c.phone}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {activeLoans.length > 0 ? (
                                                <span className="font-semibold text-slate-900">{activeLoans.length}</span>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {closedLoans.length > 0 ? (
                                                <span className="text-slate-600">{closedLoans.length}</span>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-slate-900">
                                            {totalOutstanding > 0 ? formatCurrency(totalOutstanding) : '₹0'}
                                        </td>
                                        <td className="px-6 py-4 text-left text-sm text-slate-600">
                                            {sortedGuarantors.length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    {sortedGuarantors.map((g, idx) => (
                                                        <div key={idx} style={{ display: 'flex', gap: '4px', color: 'var(--slate-900)' }}>
                                                            <span style={{ color: 'var(--slate-400)' }}>{idx + 1}.</span>
                                                            <span style={{ fontWeight: 500 }}>
                                                                {g.loan.customer.name}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`badge badge-standing ${standing.color}`}>{standing.label}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    className="btn btn-sm btn-action-outline"
                                                    title="New Loan"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/loans/new?customer=${c.id}`);
                                                    }}
                                                >
                                                    <PlusCircle size={14} /> New Loan
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
                {!loading && customers.length > 0 && (
                    <div className="table-pagination">
                        <div className="pagination-info">
                            Showing {startIdx} to {endIdx} of {customers.length} entries
                        </div>
                        <div className="pagination-btns">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                            >
                                <ChevronLeft size={14} /> Prev
                            </button>
                            {[...Array(totalPages)].map((_, i) => (
                                <button
                                    key={i + 1}
                                    className={page === i + 1 ? 'active' : ''}
                                    onClick={() => setPage(i + 1)}
                                >
                                    {i + 1}
                                </button>
                            )).slice(0, 5)}
                            <button
                                disabled={page >= totalPages}
                                onClick={() => setPage(page + 1)}
                            >
                                Next <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

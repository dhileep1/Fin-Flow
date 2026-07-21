import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/client';
import { Search, Phone, Car, Bike, ChevronLeft, ChevronRight, FileText, Check, X, IndianRupee } from 'lucide-react';
import PaymentModal from '../components/PaymentModal';
import '../styles/callPanel.css';

const PAGE_SIZE = 6;

export default function Loans() {
    const navigate = useNavigate();
    const [loans, setLoans] = useState([]);
    const [selectedLoanForPayment, setSelectedLoanForPayment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({
        status: '',
    });
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('name');

    const pagedLoans = loans; // It already comes paginated from backend

    const loadLoans = async () => {
        setLoading(true);
        try {
            const data = await api.getLoans(`page=${page}&limit=${PAGE_SIZE}&status=${filters.status}&q=${search}&type=${filterType}`);
            setLoans(data.loans || []);
            setTotal(data.total || 0);
        } catch (e) {
            console.error('Failed to load loans', e);
        } finally {
            setLoading(true);
            setTimeout(() => setLoading(false), 300);
        }
    };

    const location = useLocation();

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.style.overflow = 'hidden';
            mainContent.style.maxHeight = 'calc(100vh - var(--header-height))';
            mainContent.style.padding = '1rem 1.5rem';
        }
        return () => {
            document.body.style.overflow = '';
            if (mainContent) {
                mainContent.style.overflow = '';
                mainContent.style.maxHeight = '';
                mainContent.style.padding = '';
            }
        };
    }, []);

    useEffect(() => {
        if (location.state?.q) {
            setSearch(location.state.q);
            setFilterType(location.state.type || 'name');
        }
    }, [location.state]);

    useEffect(() => {
        setPage(1);
    }, [search, filterType, filters.status]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            loadLoans();
        }, 300);
        return () => clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, search, filterType, filters.status]);

    const handleSearchAction = () => {
        setPage(1);
    };

    const formatCurrency = (amount) =>
        `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

    const getStatus = (loan) => {
        const count = loan.overdueCount || 0;
        if (count === 0) return { label: 'No Overdue', color: 'badge-success' };
        if (count === 1) return { label: '1 Overdue', color: 'badge-overdue' };
        return { label: `${count} Overdue`, color: 'badge-defaulter' };
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const startIdx = (page - 1) * PAGE_SIZE + 1;
    const endIdx = Math.min(page * PAGE_SIZE, total);

    return (
        <div className="call-panel animate-fade-in">
            {/* Page Header */}
            <div className="page-header" style={{ marginBottom: 'var(--space-3)' }}>
                <div>
                    <h1 className="page-title">Loans</h1>
                </div>
            </div>

            {/* Unified Search & Filter Controls Group */}
            <div 
                className="unified-filter-group" 
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--color-bg-input)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '1.5rem',
                    padding: '0 0.5rem',
                    gap: '0.25rem',
                    width: '100%',
                    maxWidth: '720px',
                    height: '42px',
                    transition: 'all var(--transition-fast)',
                    marginBottom: 'var(--space-4)'
                }}
                onFocusCapture={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
                }}
                onBlurCapture={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.boxShadow = 'none';
                }}
            >
                {/* Search Icon */}
                <Search className="text-muted" size={16} style={{ marginLeft: '0.5rem', flexShrink: 0, color: 'var(--color-text-muted)' }} />

                {/* Search Input Box */}
                <input
                    type="text"
                    placeholder={`Search loans by ${filterType}...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        flex: 1,
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        padding: '0.5rem',
                        color: 'var(--color-text-primary)',
                        fontSize: 'var(--font-size-base)',
                        width: '100%'
                    }}
                />

                {/* Divider */}
                <div style={{ width: '1px', height: '20px', background: 'var(--color-border)', flexShrink: 0 }} />

                {/* Search Type Dropdown */}
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    style={{
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        padding: '0.5rem 1.5rem 0.5rem 0.5rem',
                        color: 'var(--color-text-secondary)',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 500,
                        cursor: 'pointer',
                        flexShrink: 0,
                        minWidth: '95px',
                        textTransform: 'capitalize'
                    }}
                >
                    <option value="name">Name</option>
                    <option value="phone">Phone</option>
                    <option value="vehicle">Vehicle</option>
                </select>

                {/* Divider */}
                <div style={{ width: '1px', height: '20px', background: 'var(--color-border)', flexShrink: 0 }} />

                {/* Status Dropdown */}
                <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    style={{
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        padding: '0.5rem 1.5rem 0.5rem 0.5rem',
                        color: 'var(--color-text-secondary)',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 500,
                        cursor: 'pointer',
                        flexShrink: 0,
                        minWidth: '120px'
                    }}
                >
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="closed">Closed</option>
                    <option value="overdue">Overdue</option>
                    <option value="written_off">Written Off / Resold</option>
                    <option value="seized">Seized</option>
                </select>
            </div>

            <div className="call-panel-main-container" style={{ position: 'relative' }}>
                {loading && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        background: 'var(--color-accent)',
                        zIndex: 10,
                        animation: 'loadingProgress 1s infinite ease-in-out'
                    }} />
                )}
                <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s ease-in-out' }}>
                    {pagedLoans.length > 0 ? (
                        <table className="call-panel-unified-table">
                            <thead>
                                <tr className="column-headers">
                                    <th style={{ width: '12%' }} className="text-left">Customer</th>
                                    <th style={{ width: '10%' }} className="text-left">Phone</th>
                                    <th style={{ width: '10%' }} className="text-left">Vehicle</th>
                                    <th style={{ width: '10%' }} className="text-right">Principal</th>
                                    <th style={{ width: '10%' }} className="text-right">EMI</th>
                                    <th style={{ width: '12%' }} className="text-right section-divider">Overdue</th>
                                    <th style={{ width: '6%', padding: '0 2px' }} className="text-center">Paid</th>
                                    <th style={{ width: '6%', padding: '0 2px' }} className="text-center">Pending</th>
                                    <th style={{ width: '6%', padding: '0 2px' }} className="text-center section-divider">Total</th>
                                    <th style={{ width: '10%' }} className="text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pagedLoans.map((loan) => {
                                    return (
                                        <tr
                                            key={loan.id}
                                            onClick={() => navigate(`/loans/${loan.id}`)}
                                        >
                                            <td className="font-bold text-slate-900">{loan.customer?.name}</td>
                                            <td className="text-slate-500 font-medium font-mono">{loan.customer?.phone}</td>
                                            <td className="font-semibold text-slate-900">{loan.vehicle?.model || '—'}</td>
                                            <td className="text-right text-slate-900 font-semibold">{formatCurrency(loan.principalAmount)}</td>
                                            <td className="text-right text-slate-900 font-bold">{formatCurrency(loan.monthlyDueAmount)}</td>
                                            <td className="text-right font-bold text-slate-900 section-divider">
                                                {formatCurrency(loan.totalOverdue || 0)}
                                            </td>
                                            <td className="text-center font-bold text-slate-900">{loan.paidDues || 0}</td>
                                            <td className="text-center">
                                                {(loan.overdueCount || 0) > 0 ? (
                                                    <span className="badge badge-defaulter">{loan.overdueCount}</span>
                                                ) : (
                                                    <span className="text-slate-900 font-bold">{loan.overdueCount || 0}</span>
                                                )}
                                            </td>
                                            <td className="text-center font-bold text-slate-900 section-divider">{loan.totalDues || 0}</td>
                                            <td className="text-center">
                                                <div className="flex gap-2 justify-center">
                                                    <button className="btn btn-sm btn-premium-action" onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedLoanForPayment(loan);
                                                    }}>
                                                        <IndianRupee size={13} opacity={0.2} />
                                                        <span>Pay</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="empty-state-inline">
                            <div className="empty-icon"><FileText size={24} /></div>
                            <div className="empty-title">No loans found</div>
                            <div className="empty-desc">No loans match your current filters. Try adjusting the search or status filter.</div>
                        </div>
                    )}
                    {/* Always show pagination when there's data */}
                    {total > 0 && (
                        <div className="table-pagination">
                            <div className="pagination-info">
                                Showing {startIdx} to {endIdx} of {total} loans
                            </div>
                            <div className="pagination-btns">
                                <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                                    <ChevronLeft size={14} /> Prev
                                </button>
                                {[...Array(Math.min(totalPages, 5))].map((_, i) => (
                                    <button
                                        key={i + 1}
                                        className={page === i + 1 ? 'active' : ''}
                                        onClick={() => setPage(i + 1)}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                                    Next <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                    {selectedLoanForPayment && (
                        <PaymentModal
                            loanId={selectedLoanForPayment.id}
                            customerName={selectedLoanForPayment.customer?.name}
                            outstanding={selectedLoanForPayment.outstandingPrincipal}
                            onClose={() => setSelectedLoanForPayment(null)}
                            onSuccess={() => {
                                setSelectedLoanForPayment(null);
                                loadLoans();
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/client';
import { Search, Phone, Car, Bike, ChevronLeft, ChevronRight, FileText, Check, X } from 'lucide-react';
import '../styles/callPanel.css';

const PAGE_SIZE = 25;

export default function Loans() {
    const navigate = useNavigate();
    const [loans, setLoans] = useState([]);
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
            const data = await api.getLoans(`page=${page}&status=${filters.status}&q=${search}&type=${filterType}`);
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
        <div className="animate-fade-in">
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Loans</h1>
                    <p className="page-subtitle">Manage and track all active and closed loans</p>
                </div>
            </div>

            {loading ? (
                <div style={{ padding: 'var(--space-10)', textAlign: 'center' }}>
                    <span className="loading-spinner" />
                    <p className="text-muted mt-2">Loading loans...</p>
                </div>
            ) : (
                <>
                    {/* Table Controls (Local Filter & Status) */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="search-bar">
                            <input
                                type="text"
                                placeholder="Filter by name, phone, or vehicle..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <Search className="search-icon" size={16} />
                        </div>

                        <div className="ml-4 flex-shrink-0">
                            <select
                                className="form-select"
                                style={{ minWidth: '140px', paddingRight: '2rem' }}
                                value={filters.status}
                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            >
                                <option value="">All Statuses</option>
                                <option value="active">Active</option>
                                <option value="closed">Closed</option>
                                <option value="overdue">Overdue</option>
                            </select>
                        </div>
                    </div>

                    <div className="table-container">
                        {pagedLoans.length > 0 ? (
                            <table className="call-panel-unified-table">
                                <thead>
                                    <tr className="column-headers">
                                        <th style={{ width: '15%' }} className="text-left">Customer</th>
                                        <th style={{ width: '12%' }} className="text-left">Vehicle</th>
                                        <th style={{ width: '10%' }} className="text-right">Principal</th>
                                        <th style={{ width: '10%' }} className="text-right">EMI</th>
                                        <th style={{ width: '12%' }} className="text-right section-divider">Overdue</th>
                                        <th style={{ width: '6%', padding: '0 2px' }} className="text-center">Paid</th>
                                        <th style={{ width: '6%', padding: '0 2px' }} className="text-center">Pending</th>
                                        <th style={{ width: '6%', padding: '0 2px' }} className="text-center section-divider">Total</th>
                                        <th style={{ width: '10%' }} className="text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {pagedLoans.map((loan) => {
                                        return (
                                            <tr
                                                key={loan.id}
                                                className="cursor-pointer hover-table-row"
                                                onClick={() => navigate(`/loans/${loan.id}`)}
                                            >
                                                <td className="px-6 py-4 text-left">
                                                    <div className="text-slate-900 font-bold">{loan.customer?.name}</div>
                                                    <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono mt-0.5">
                                                        <Phone size={10} /> {loan.customer?.phone}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-left">
                                                    <div className="text-slate-900 font-semibold flex items-center gap-1.5">
                                                        {loan.vehicle?.type === 'bike' || /bike|scooter|motorcycle/i.test(loan.vehicle?.model || '') ? <Bike size={14} className="text-slate-500" /> : <Car size={14} className="text-slate-500" />} 
                                                        {loan.vehicle?.model}
                                                    </div>
                                                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">{loan.vehicle?.vehicleNumber}</div>
                                                </td>
                                                <td className="text-right text-slate-900 font-semibold">{formatCurrency(loan.principalAmount)}</td>
                                                <td className="text-right text-slate-900 font-bold">{formatCurrency(loan.monthlyDueAmount)}</td>
                                                <td className="text-right font-bold text-slate-900 section-divider">
                                                    {formatCurrency(loan.totalOverdue || 0)}
                                                </td>
                                                <td className="text-center font-bold text-slate-900" style={{ padding: '0 2px' }}>{loan.paidDues || 0}</td>
                                                <td className="text-center" style={{ padding: '0 2px' }}>
                                                    {(loan.overdueCount || 0) > 0 ? (
                                                        <span className="badge badge-defaulter" style={{ padding: '4px 8px', minWidth: '24px' }}>{loan.overdueCount}</span>
                                                    ) : (
                                                        <span className="text-slate-900 font-bold">{loan.overdueCount || 0}</span>
                                                    )}
                                                </td>
                                                <td className="text-center font-bold text-slate-900 section-divider" style={{ padding: '0 2px' }}>{loan.totalDues || 0}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex gap-2 justify-end">
                                                        <button className="btn btn-sm btn-action-outline" onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/loans/${loan.loanId || loan.id}`);
                                                        }}>
                                                            Pay
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
                    </div>
                </>
            )}
        </div>
    );
}

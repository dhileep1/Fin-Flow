import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import CallLogModal from '../components/CallLogModal';
import { RotateCw, Phone, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../styles/callPanel.css';

const PAGE_SIZE = 10;

export default function CallPanel() {
    const { user } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [selectedTask, setSelectedTask] = useState(null);
    const [dimmedRows, setDimmedRows] = useState(new Set());
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('name');
    const [statusFilter, setStatusFilter] = useState('');

    const [page, setPage] = useState(1);
    const navigate = useNavigate();

    useEffect(() => { loadTasks(); }, []);

    const loadTasks = async () => {
        try {
            setLoading(true);
            const data = await api.getCallTasks(`limit=50`);
            setTasks(data.tasks || []);
        } catch (err) {
            console.error('Failed to load call tasks:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatShortDate = (d) => {
        if (!d) return '—';
        const date = new Date(d);
        const day = date.getDate().toString().padStart(2, '0');
        const month = date.toLocaleString('en-IN', { month: 'short' });
        const year = date.getFullYear().toString().slice(-2);
        return `${day} ${month} ${year}`;
    };
    const formatCurrency = (a) => `₹${Math.round(Number(a || 0)).toLocaleString('en-IN')}`;

    const isContactedToday = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        const today = new Date();
        return d.toDateString() === today.toDateString();
    };

    const sortedTasks = [...tasks].sort((a, b) => {
        const aContacted = isContactedToday(a.lastCallDate) || dimmedRows.has(a.id);
        const bContacted = isContactedToday(b.lastCallDate) || dimmedRows.has(b.id);
        if (aContacted !== bContacted) return aContacted ? 1 : -1;
        return 0;
    });

    const isTodayOrOverdue = (d) => {
        if (!d) return false;
        const date = new Date(d);
        date.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date <= today;
    };



    const filteredTasks = sortedTasks.filter(task => {
        // 1. Assignment Filter
        if (filter === 'mine') {
            if (task.loan?.assignedStaffId !== user?.id && task.assignedStaffId !== user?.id) return false;
        } else if (filter === 'unassigned') {
            if (task.loan?.assignedStaffId || task.assignedStaffId) return false;
        }

        // 2. Search Query Filter
        if (search.trim()) {
            const query = search.toLowerCase().trim();
            if (filterType === 'name') {
                const name = task.loan?.customer?.name || '';
                if (!name.toLowerCase().includes(query)) return false;
            } else if (filterType === 'phone') {
                const phone = task.loan?.customer?.phone || '';
                if (!phone.includes(query)) return false;
            } else if (filterType === 'vehicle') {
                const model = task.loan?.vehicle?.model || '';
                const number = task.loan?.vehicle?.vehicleNumber || '';
                if (!model.toLowerCase().includes(query) && !number.toLowerCase().includes(query)) return false;
            }
        }

        // 3. Status Filter (Promised, No Answer, Not Called, Connected)
        if (statusFilter) {
            const outcome = task.callLogs?.[0]?.outcome;
            const hasCalled = !!task.lastCallDate;
            if (statusFilter === 'promise' && outcome !== 'promise') return false;
            if (statusFilter === 'no_answer' && outcome !== 'no_answer') return false;
            if (statusFilter === 'not_called' && hasCalled) return false;
            if (statusFilter === 'connected' && (!hasCalled || outcome === 'promise' || outcome === 'no_answer')) return false;
        }

        return true;
    });

    const pagedTasks = filteredTasks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const startIdx = (page - 1) * PAGE_SIZE + 1;
    const endIdx = Math.min(page * PAGE_SIZE, filteredTasks.length);
    const totalPages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));

    const renderStatusPill = (task) => {
        if (!task.lastCallDate) return <span className="badge badge-status badge-notcalled">N/A</span>;
        const outcome = task.callLogs?.[0]?.outcome;
        switch (outcome) {
            case 'promise': return <span className="badge badge-status badge-promise">Promised</span>;
            case 'no_answer': return <span className="badge badge-status badge-noanswer">No Answer</span>;
            default: return <span className="badge badge-status badge-neutral">{outcome?.replace(/_/g, ' ') || 'Connected'}</span>;
        }
    };

    const handleOpenModal = (e, task) => {
        e.stopPropagation();
        setSelectedTask(task);
    };

    return (
        <div className="call-panel animate-fade-in">
            <div className="page-header" style={{ marginBottom: 'var(--space-3)' }}>
                <div>
                    <h1 className="page-title">Call Queue</h1>
                </div>
            </div>

            {/* Unified Search & Filter Controls Group */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: 'var(--space-4)' }}>
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
                        flex: 1
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
                        placeholder={`Search calls by ${filterType}...`}
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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
                        onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
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
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
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
                            minWidth: '130px'
                        }}
                    >
                        <option value="">All Statuses</option>
                        <option value="promise">Promised</option>
                        <option value="no_answer">No Answer</option>
                        <option value="not_called">Not Called</option>
                        <option value="connected">Connected</option>
                    </select>
                </div>

                <div className="flex gap-3" style={{ flexShrink: 0 }}>
                    <select 
                        className="form-select" 
                        value={filter} 
                        onChange={(e) => { setFilter(e.target.value); setPage(1); }}
                        style={{
                            height: '42px',
                            borderRadius: '1.5rem',
                            padding: '0 1.5rem 0 1rem',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg-input)',
                            color: 'var(--color-text-secondary)',
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 500,
                            cursor: 'pointer'
                        }}
                    >
                        <option value="all">All Tasks</option>
                        <option value="mine">Assigned to Me</option>
                        <option value="unassigned">Unassigned</option>
                    </select>
                    <button 
                        className="btn btn-secondary" 
                        onClick={loadTasks}
                        style={{
                            height: '42px',
                            borderRadius: '1.5rem',
                            padding: '0 1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 600
                        }}
                    >
                        <RotateCw size={14} /> Refresh
                    </button>
                </div>
            </div>

            <div className="call-panel-main-container">
                <table className="call-panel-unified-table">
                    <thead>
                        <tr className="column-headers">
                            <th style={{ width: '13%' }}>Customer</th>
                            <th style={{ width: '10%' }}>Phone</th>
                            <th style={{ width: '10%' }}>Vehicle</th>
                            <th style={{ width: '8%' }} className="text-right">Principal</th>
                            <th style={{ width: '8%' }} className="text-right section-divider">EMI</th>

                            <th style={{ width: '6%' }} className="text-center">Paid</th>
                            <th style={{ width: '6%' }} className="text-center">Pending</th>
                            <th style={{ width: '6%' }} className="text-center section-divider">Total</th>

                            <th style={{ width: '10%' }} className="text-center">Status</th>
                            <th style={{ width: '8%' }} className="text-left">Follow up</th>
                            <th style={{ width: '8%' }} className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <tr key={i}>
                                    <td colSpan={11} className="px-6 py-4">
                                        <div className="loading-skeleton" style={{ height: 24, width: '100%' }} />
                                    </td>
                                </tr>
                            ))
                        ) : pagedTasks.length === 0 ? (
                            <tr>
                                <td colSpan={11}>
                                    <div className="empty-state-inline">
                                        <div className="empty-icon"><Phone size={24} /></div>
                                        <div className="empty-title">No tasks</div>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            pagedTasks.map((task) => (
                                <tr
                                    key={task.id}
                                    className={isContactedToday(task.lastCallDate) || dimmedRows.has(task.id) ? 'row-contacted-today' : ''}
                                    onClick={() => navigate(`/loans/${task.loanId}`)}
                                >
                                    {/* Main Info */}
                                    <td className="font-bold text-slate-900">{task.loan?.customer?.name || '—'}</td>
                                    <td className="text-slate-500 font-medium font-mono">{task.loan?.customer?.phone || '—'}</td>
                                    <td className="font-semibold text-slate-900">{task.loan?.vehicle?.model || '—'}</td>
                                    <td className="text-right text-slate-900 font-semibold">{formatCurrency(task.loan?.principalAmount)}</td>
                                    <td className="text-right text-slate-900 font-bold section-divider">{formatCurrency(task.loan?.monthlyDueAmount)}</td>

                                    {/* Dues */}
                                    <td className="text-center font-bold text-slate-900">{task.paidDues || 0}</td>
                                    <td className="text-center">
                                        {(task.overdueCount || 0) > 0 ? (
                                            <span className="badge badge-defaulter">{task.overdueCount || 0}</span>
                                        ) : (
                                            <span className="text-slate-900 font-bold">{task.overdueCount || 0}</span>
                                        )}
                                    </td>
                                    <td className="text-center font-bold text-slate-900 section-divider">{task.totalDues || 0}</td>

                                    {/* Actions */}
                                    <td className="text-center">{renderStatusPill(task)}</td>
                                    <td className="text-left">
                                        <span className={`text-sm font-medium ${isTodayOrOverdue(task.nextCallDate) ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                                            {formatShortDate(task.nextCallDate)}
                                        </span>
                                    </td>
                                    <td className="text-right">
                                        <button
                                            className="btn btn-sm btn-premium-action"
                                            onClick={(e) => handleOpenModal(e, task)}
                                        >
                                            <Phone size={13} fill="currentColor" opacity={0.2} />
                                            <span>Log</span>
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {!loading && tasks.length > 0 && (
                    <div className="table-pagination">
                        <div className="pagination-info">
                            Showing {startIdx} to {endIdx} of {tasks.length} tasks
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

            {selectedTask && (
                <CallLogModal
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    onSuccess={(taskId) => {
                        setDimmedRows(prev => new Set(prev).add(taskId));
                        setSelectedTask(null);
                    }}
                />
            )}
        </div>
    );
}

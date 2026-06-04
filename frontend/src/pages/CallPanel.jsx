import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import CallLogModal from '../components/CallLogModal';
import { RotateCw, Phone, ChevronLeft, ChevronRight } from 'lucide-react';
import '../styles/callPanel.css';

const PAGE_SIZE = 10;

export default function CallPanel() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [selectedTask, setSelectedTask] = useState(null);
    const [dimmedRows, setDimmedRows] = useState(new Set());

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



    const pagedTasks = sortedTasks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const startIdx = (page - 1) * PAGE_SIZE + 1;
    const endIdx = Math.min(page * PAGE_SIZE, tasks.length);
    const totalPages = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));

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
            <div className="page-header">
                <div>
                    <h1 className="page-title">Call Queue</h1>
                    <p className="page-subtitle">Prioritized follow-up tasks for collections</p>
                </div>
                <div className="flex gap-3">
                    <select className="form-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                        <option value="all">All Tasks</option>
                        <option value="mine">Assigned to Me</option>
                        <option value="unassigned">Unassigned</option>
                    </select>
                    <button className="btn btn-secondary" onClick={loadTasks}>
                        <RotateCw size={16} /> Refresh
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

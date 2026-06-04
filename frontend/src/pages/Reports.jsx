import React, { useState, useMemo } from 'react';
import api from '../api/client';
import { Download, FileText, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const PAGE_SIZE = 10;

export default function Reports() {
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);

    const loadReport = async () => {
        if (!from || !to) return;
        setLoading(true);
        setPage(1);
        try {
            const data = await api.getCollectionsReport(from, to);
            setReport(data);
        } catch (err) {
            console.error('Failed to load report:', err);
        } finally {
            setLoading(false);
        }
    };

    const setQuickRange = (key) => {
        const today = new Date();
        let fromDate, toDate;
        toDate = today.toISOString().slice(0, 10);
        
        switch (key) {
            case 'today':
                fromDate = toDate;
                break;
            case 'yesterday': {
                const y = new Date(today);
                y.setDate(y.getDate() - 1);
                fromDate = y.toISOString().slice(0, 10);
                toDate = fromDate;
                break;
            }
            case 'week': {
                const w = new Date(today);
                w.setDate(w.getDate() - 7);
                fromDate = w.toISOString().slice(0, 10);
                break;
            }
            case 'month': {
                fromDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
                break;
            }
            case 'last_month': {
                const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                fromDate = lm.toISOString().slice(0, 10);
                toDate = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().slice(0, 10);
                break;
            }
            default:
                return;
        }
        setFrom(fromDate);
        setTo(toDate);
    };

    const formatCurrency = (a) => `₹${Number(a || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '—';

    // Prepare chart data by grouping payments per day
    const chartData = useMemo(() => {
        if (!report?.payments?.length) return [];
        const grouped = {};
        report.payments.forEach(p => {
            const day = new Date(p.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            grouped[day] = (grouped[day] || 0) + Number(p.amount || 0);
        });
        return Object.entries(grouped).map(([date, total]) => ({ date, total: Math.round(total) }));
    }, [report]);

    // Export CSV
    const exportCSV = () => {
        if (!report?.payments?.length) return;
        const header = 'Date,Customer,Amount,Method,Recorded By\n';
        const rows = report.payments.map(p =>
            `"${formatDate(p.paymentDate)}","${p.loan?.customer?.name || ''}","${p.amount}","${p.paymentMethod || ''}","${p.creator?.name || ''}"`
        ).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `collections_${from}_to_${to}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const payments = report?.payments || [];
    const pagedPayments = payments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(payments.length / PAGE_SIZE));
    const startIdx = (page - 1) * PAGE_SIZE + 1;
    const endIdx = Math.min(page * PAGE_SIZE, payments.length);

    const quickBtns = [
        { key: 'today', label: 'Today' },
        { key: 'yesterday', label: 'Yesterday' },
        { key: 'week', label: 'Last 7 Days' },
        { key: 'month', label: 'This Month' },
        { key: 'last_month', label: 'Last Month' },
    ];

    return (
        <div className="animate-fade-in" style={{ maxWidth: 1200 }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Reports</h1>
                    <p className="page-subtitle">Collection reports and analytics</p>
                </div>
                {report && payments.length > 0 && (
                    <div className="flex gap-2">
                        <button className="btn btn-secondary" onClick={() => window.print()}>
                            <FileText size={16} /> Export PDF
                        </button>
                        <button className="btn btn-secondary" onClick={exportCSV}>
                            <Download size={16} /> Download CSV
                        </button>
                    </div>
                )}
            </div>

            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <h3 style={{ fontWeight: 600, marginBottom: 'var(--space-4)' }}>Collections Report</h3>
                
                {/* Quick Date Selectors */}
                <div style={{ marginBottom: 'var(--space-4)' }}>
                    <label className="form-label" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>Quick Select</label>
                    <div className="quick-date-btns">
                        {quickBtns.map(b => (
                            <button
                                key={b.key}
                                className="quick-date-btn"
                                onClick={() => setQuickRange(b.key)}
                            >
                                {b.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">From Date</label>
                        <input className="form-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">To Date</label>
                        <input className="form-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button className="btn btn-secondary" onClick={loadReport} disabled={loading || !from || !to}>
                            {loading ? <span className="loading-spinner" /> : 'Generate Report'}
                        </button>
                    </div>
                </div>
            </div>

            {report && (
                <div className="animate-slide-up">
                    {/* Stats Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                        <div className="stat-card">
                            <div className="stat-label">Total Collected</div>
                            <div className="stat-value" style={{ color: 'var(--color-success)' }}>{formatCurrency(report.totalCollected)}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Payment Count</div>
                            <div className="stat-value">{report.paymentCount}</div>
                        </div>
                        {Object.entries(report.byMethod || {}).map(([method, total]) => (
                            <div className="stat-card" key={method}>
                                <div className="stat-label">{method.toUpperCase()}</div>
                                <div className="stat-value">{formatCurrency(total)}</div>
                            </div>
                        ))}
                    </div>

                    {/* Chart */}
                    {chartData.length > 0 && (
                        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                            <h3 className="flex items-center gap-2 mb-4" style={{ fontWeight: 600 }}>
                                <BarChart3 size={18} style={{ color: 'var(--color-accent)' }} /> Collection Trends
                            </h3>
                            <div style={{ width: '100%', height: 280 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                        <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} />
                                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                                        <Tooltip
                                            formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Collected']}
                                            contentStyle={{
                                                borderRadius: '8px',
                                                border: '1px solid #e2e8f0',
                                                boxShadow: '0 4px 6px -1px rgba(15,23,42,0.08)',
                                                fontSize: '13px',
                                            }}
                                        />
                                        <Bar dataKey="total" fill="#10b981" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Table */}
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Customer</th>
                                    <th className="text-right">Amount</th>
                                    <th>Method</th>
                                    <th>Recorded By</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.length === 0 ? (
                                    <tr>
                                        <td colSpan={5}>
                                            <div className="empty-state-inline">
                                                <div className="empty-icon">
                                                    <FileText size={24} />
                                                </div>
                                                <div className="empty-title">No collections found</div>
                                                <div className="empty-desc">
                                                    No collections were recorded for the selected date range. Try adjusting the dates.
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    pagedPayments.map((p) => (
                                        <tr key={p.id}>
                                            <td>{formatDate(p.paymentDate)}</td>
                                            <td>{p.loan?.customer?.name || '—'}</td>
                                            <td className="text-right font-mono" style={{ fontWeight: 600 }}>{formatCurrency(p.amount)}</td>
                                            <td><span className="badge badge-accent">{p.paymentMethod || '—'}</span></td>
                                            <td className="text-sm">{p.creator?.name || '—'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        {payments.length > 0 && (
                            <div className="table-pagination">
                                <div className="pagination-info">
                                    Showing {startIdx} to {endIdx} of {payments.length} entries
                                </div>
                                <div className="pagination-btns">
                                    <button disabled={page === 1} onClick={() => setPage(page - 1)}>
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
                                    <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                                        Next <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

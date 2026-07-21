import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import PaymentModal from '../components/PaymentModal';
import CallLogModal from '../components/CallLogModal';
import SeizureModal from '../components/SeizureModal';
import ForeclosureModal from '../components/ForeclosureModal';
import {
    Phone,
    Calendar,
    Clock,
    BarChart3,
    FileText,
    CreditCard,
    Eye,
    Download,
    AlertTriangle,
    ShieldCheck,
    UserCircle,
    RefreshCcw,
    ArrowDownCircle,
    ArrowUpRight,
    CalendarCheck,
    CheckCircle
} from 'lucide-react';
import '../styles/loanDetail.css';

export default function LoanDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loan, setLoan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showPayment, setShowPayment] = useState(false);
    const [showCallLog, setShowCallLog] = useState(false);
    const [showSeize, setShowSeize] = useState(false);
    const [showForeclosure, setShowForeclosure] = useState(false);
    const [showReclaim, setShowReclaim] = useState(false);
    const [reclaimAmount, setReclaimAmount] = useState('');
    const [reclaimMethod, setReclaimMethod] = useState('cash');
    const [submittingReclaim, setSubmittingReclaim] = useState(false);
    const [reclaimError, setReclaimError] = useState('');
    const [activeTab, setActiveTab] = useState('schedule');
    const [expandFuture, setExpandFuture] = useState(false);

    // For scrolling to rows
    const scheduleRowsRef = useRef({});

    useEffect(() => { loadLoan(); }, [id]);

    const loadLoan = async () => {
        try {
            const data = await api.getLoan(id);
            setLoan(data);
            
            // Calculate overdue dues to default the reclaim amount
            const sorted = [...(data.loanDues || [])].sort((a, b) => a.dueSequence - b.dueSequence);
            const overdue = sorted.reduce((sum, d) => {
                const dueDate = new Date(d.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isMissed = d.status === 'overdue' || (d.status === 'pending' && dueDate < today);
                return isMissed ? sum + (Number(d.totalDue) - Number(d.amountPaid || 0)) : sum;
            }, 0);
            setReclaimAmount(overdue.toString());
        } catch (err) {
            console.error('Failed to load loan:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleReclaimSubmit = async (e) => {
        if (e) e.preventDefault();
        const activeSeizure = loan.vehicle?.seizures?.find(s => s.status === 'in_yard') || loan.vehicle?.seizures?.[0];
        if (!activeSeizure) {
            setReclaimError('No active seizure record found for this vehicle.');
            return;
        }

        setSubmittingReclaim(true);
        setReclaimError('');
        try {
            await api.settleSeizure(activeSeizure.id, {
                settlementType: 'reclaim',
                settlementAmount: Number(reclaimAmount || 0),
                paymentMethod: reclaimMethod
            });
            setShowReclaim(false);
            await loadLoan();
        } catch (err) {
            setReclaimError(err.message || 'Failed to submit reclaim');
        } finally {
            setSubmittingReclaim(false);
        }
    };

    const handleCloseLoan = async () => {
        if (!window.confirm('Are you sure you want to close this loan? This will mark the loan status as closed.')) {
            return;
        }
        try {
            await api.closeLoan(id);
            await loadLoan();
        } catch (err) {
            alert(err.message || 'Failed to close loan');
        }
    };

    const formatCurrency = (a) => `₹${Number(a || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    // Strictly enforce terminology
    const normalizeStatus = (s) => (s?.toLowerCase() === 'pending' ? 'overdue' : s?.toLowerCase() || 'upcoming');

    const statusBadge = (status) => {
        const norm = normalizeStatus(status);
        const map = { paid: 'badge-success', overdue: 'badge-defaulter', upcoming: 'badge-info', active: 'badge-success' };
        return <span className={`badge ${map[norm] || 'badge-info'}`} style={{ textTransform: 'capitalize' }}>{norm}</span>;
    };

    if (loading) return <div className="empty-state"><div className="loading-spinner" /></div>;
    if (!loan) return <div className="empty-state"><p>Loan not found</p></div>;

    const callTask = loan.callTasks?.[0];
    const dues = loan.loanDues || [];
    const payments = loan.payments || [];

    // --- DERIVED METRICS ---
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalPaid = 0;
    let totalOverdue = 0;
    let nextDueAmount = 0;
    let dpd = 0;
    let penaltyAccumulated = 0;
    let lastPaymentDate = null;
    let currentDueId = null;

    payments.forEach(p => { totalPaid += Number(p.amount); });

    let nextDueRecord = null;
    let oldestMissedDue = null;

    // Ordered dues
    const sortedDues = [...dues].sort((a, b) => a.dueSequence - b.dueSequence);

    sortedDues.forEach(d => {
        penaltyAccumulated += Number(d.penaltyDue || 0);
        const dueDate = new Date(d.dueDate);
        dueDate.setHours(0, 0, 0, 0);

        const isMissed = d.status === 'overdue' || (d.status === 'pending' && dueDate < today);

        if (isMissed) {
            totalOverdue += (Number(d.totalDue) - Number(d.amountPaid || 0));
            if (!oldestMissedDue || dueDate < new Date(oldestMissedDue.dueDate)) {
                oldestMissedDue = d;
            }
        }

        if (!isMissed && d.status !== 'paid' && (!nextDueRecord || dueDate < new Date(nextDueRecord.dueDate))) {
            nextDueRecord = d;
        }
    });

    if (oldestMissedDue) {
        const diffTime = Math.abs(today - new Date(oldestMissedDue.dueDate));
        dpd = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    if (nextDueRecord) {
        nextDueAmount = Number(nextDueRecord.totalDue) - Number(nextDueRecord.amountPaid || 0);
        currentDueId = nextDueRecord.id;
    }

    const sortedPayments = [...payments].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
    if (sortedPayments.length > 0) {
        lastPaymentDate = sortedPayments[0].paymentDate;
    }

    // Schedule split logic
    const visibleDues = expandFuture ? sortedDues : sortedDues.slice(0, 5);

    // Scroll handler for timeline click
    const scrollToRow = (seqId) => {
        if (activeTab !== 'schedule') setActiveTab('schedule');
        setTimeout(() => {
            scheduleRowsRef.current[seqId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    };

    return (
        <div className="loan-detail-page animate-fade-in">
            {/* 1. STICKY HEADER */}
            <div className="terminal-header" style={{ padding: '4px 0 var(--space-4) 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

                    {/* Left: Identity & Asset */}
                    <div className="flex items-center gap-2 mb-1">
                        <Link to={`/customers/${loan.customerId}`} className="header-name hover:underline pointer-events-auto" style={{ margin: 0 }}>
                            {loan.customer?.name}
                        </Link>
                        <span className="text-slate-300 font-light">|</span>
                        <span className="header-phone-top ml-1 text-slate-500">{loan.customer?.phone}</span>
                        <div className="ml-2">{statusBadge(loan.status)}</div>
                    </div>

                    {/* Right: Vehicle Details & Operations Buttons (Right-most) */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="header-name" style={{ fontSize: '1.5rem', margin: 0 }}>{loan.vehicle?.model}</span>
                            <span className="text-slate-300 font-light">|</span>
                            <span className="header-phone-top ml-1 text-slate-500">{loan.vehicle?.vehicleNumber}</span>
                        </div>
                        {(loan.status.toLowerCase() === 'active' || loan.status.toLowerCase() === 'overdue' || loan.status.toLowerCase() === 'pending') && (
                            <div className="flex items-center gap-2 ml-2">
                                {loan.loanDues && loan.loanDues.length > 0 && loan.loanDues.every(d => d.status === 'paid') ? (
                                    <button
                                        className="btn-action-foreclose"
                                        style={{ backgroundColor: '#166534', borderColor: '#166534', color: '#ffffff' }}
                                        onClick={handleCloseLoan}
                                    >
                                        <CheckCircle size={12} /> Close Loan
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            className="btn-action-seize"
                                            onClick={() => setShowSeize(true)}
                                        >
                                            <AlertTriangle size={12} /> Seize Vehicle
                                        </button>
                                        <button
                                            className="btn-action-foreclose"
                                            onClick={() => setShowForeclosure(true)}
                                        >
                                            <ShieldCheck size={12} /> Foreclose Loan
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                        {loan.status.toLowerCase() === 'seized' && (
                            <div className="flex items-center gap-2 ml-2">
                                <button
                                    className="btn-action-reclaim"
                                    onClick={() => setShowReclaim(true)}
                                >
                                    <RefreshCcw size={12} /> Reclaim Vehicle
                                </button>
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* 2. KPI CARDS (Strictly 4) */}
            <div className="kpi-strip">
                <div className="kpi-card">
                    <span className="kpi-card-label">Principal Outstanding</span>
                    <span className="kpi-card-value text-slate-900">{formatCurrency(loan.outstandingPrincipal)}</span>
                </div>
                <div className="kpi-card highlight-danger">
                    <span className="kpi-card-label" style={{ color: 'var(--color-danger)' }}>Total Overdue</span>
                    <span className="kpi-card-value danger">{formatCurrency(totalOverdue)}</span>
                </div>
                <div className="kpi-card">
                    <span className="kpi-card-label">EMI</span>
                    <span className="kpi-card-value text-slate-900">
                        {formatCurrency(loan.monthlyDueAmount)}
                    </span>
                </div>
                <div className="kpi-card">
                    <span className="kpi-card-label">DPD</span>
                    <span className={`kpi-card-value ${dpd > 0 ? 'danger' : ''}`}>{dpd} <span style={{ fontSize: '11px', color: 'var(--slate-400)', fontWeight: 600 }}>Days</span></span>
                </div>
            </div>

            {/* 3. HEALTH TIMELINE */}
            <div className="health-timeline-container">
                <div className="timeline-header mb-1">
                    <span className="timeline-title">Timeline</span>
                </div>
                <div className="health-strip">
                    {sortedDues.map((d) => {
                        const dDate = new Date(d.dueDate);
                        dDate.setHours(0, 0, 0, 0);
                        const isPastDue = dDate < today;
                        const isFullyPaid = d.status === 'paid';
                        const isPartiallyPaid = Number(d.amountPaid) > 0 && !isFullyPaid;
                        const hasPenalty = Number(d.penaltyDue) > 0;

                        // PREPAID Logic: If any amount is paid and it's not past due
                        const isPrepaid = (isFullyPaid || isPartiallyPaid) && !isPastDue;

                        let blockClass = 'upcoming';
                        let explicitStatus = 'Upcoming';

                        if (isPrepaid) {
                            blockClass = isFullyPaid ? 'prepaid-full' : 'prepaid-partial';
                            explicitStatus = isFullyPaid ? 'Prepaid (Full)' : 'Prepaid (Partial)';
                        } else if (isFullyPaid) {
                            if (hasPenalty) { blockClass = 'paid-late'; explicitStatus = 'Paid Late'; }
                            else { blockClass = 'paid-on-time'; explicitStatus = 'Paid on Time'; }
                        } else if (isPartiallyPaid) {
                            blockClass = 'partial'; explicitStatus = 'Partial Payment';
                        } else if (d.status === 'overdue' || (d.status === 'pending' && isPastDue)) {
                            blockClass = 'overdue'; explicitStatus = 'Overdue';
                        }

                        // Roughly calculate delay
                        const delayStr = (!isFullyPaid && isPastDue) ? `${Math.ceil((today - dDate) / (1000 * 60 * 60 * 24))} Days` : (hasPenalty ? "Late" : "None");

                        return (
                            <div
                                key={d.id}
                                className={`health-block ${blockClass}`}
                                onClick={() => scrollToRow(d.id)}
                            >
                                <div className="timeline-tooltip">
                                    <div style={{ fontWeight: 'bold', borderBottom: '1px solid #475569', paddingBottom: '2px', marginBottom: '2px', fontSize: '10px' }}>{explicitStatus}</div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-slate-400">Month:</span>
                                        <span className="font-semibold">{new Date(d.dueDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-slate-400">Amount:</span>
                                        <span className="font-semibold text-right">{formatCurrency(d.totalDue)}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-slate-400">Paid:</span>
                                        <span className="font-semibold text-right text-emerald-400">{Number(d.amountPaid) > 0 ? formatCurrency(d.amountPaid) : '—'}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* TABS */}
            <div className="terminal-tabs">
                <button className={`terminal-tab ${activeTab === 'schedule' ? 'active' : ''}`} onClick={() => setActiveTab('schedule')}>Due Schedule</button>
                <button className={`terminal-tab ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>Payments Ledger</button>
                <button className={`terminal-tab ${activeTab === 'guarantor' ? 'active' : ''}`} onClick={() => setActiveTab('guarantor')}>Guarantor</button>
                <button className={`terminal-tab ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')}>Documents</button>
                <button className={`terminal-tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>Call Logs</button>
            </div>

            {/* 4. MAIN SPLIT LAYOUT */}
            <div className="terminal-layout">

                {/* 70% LEFT -> Dynamic Tab Content */}
                <div className="terminal-left">

                    {/* A. DUE SCHEDULE */}
                    {activeTab === 'schedule' && (
                        <div className="terminal-panel shadow-sm">
                            <div className="terminal-table-wrapper max-h-[400px] overflow-y-auto">
                                <table className="terminal-table w-full">
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left' }}>#</th>
                                            <th style={{ textAlign: 'left' }}>Due Date</th>
                                            <th className="num-col text-right">Principal</th>
                                            <th className="num-col text-right">Interest</th>
                                            <th className="num-col text-right">Penalty</th>
                                            <th className="num-col text-right">Total Due</th>
                                            <th className="num-col text-right">Paid</th>
                                            <th style={{ textAlign: 'center' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleDues.map((due) => {
                                            const dueD = new Date(due.dueDate);
                                            dueD.setHours(0, 0, 0, 0);
                                            const isPastDue = dueD < today;
                                            const isFullyPaid = due.status === 'paid';
                                            const isPartiallyPaid = Number(due.amountPaid) > 0 && !isFullyPaid;
                                            const isPastSection = isFullyPaid || dueD <= today || due.id === currentDueId || Number(due.amountPaid) > 0;
                                            const isMissed = normalizeStatus(due.status) === 'overdue' || (due.status === 'pending' && isPastDue);
                                            const isCurrent = due.id === currentDueId;

                                            if (isPastSection) {
                                                return (
                                                    <tr key={due.id} ref={el => scheduleRowsRef.current[due.id] = el}>
                                                        <td className="text-slate-500 font-mono">{due.dueSequence}</td>
                                                        <td className="font-medium text-slate-800">{formatDate(due.dueDate)} {isCurrent && <span className="text-brand-primary font-bold text-xs ml-1">(Current)</span>}</td>
                                                        <td className="num-col text-right">{formatCurrency(due.principalDue)}</td>
                                                        <td className="num-col text-right">{formatCurrency(due.interestDue)}</td>
                                                        <td className="num-col text-right text-danger">{Number(due.penaltyDue) > 0 ? formatCurrency(due.penaltyDue) : '—'}</td>
                                                        <td className="num-col text-right font-bold text-slate-900">{formatCurrency(due.totalDue)}</td>
                                                        <td className="num-col text-right font-semibold text-emerald-600">{Number(due.amountPaid) > 0 ? formatCurrency(due.amountPaid) : '—'}</td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <span className={`badge pill-fixed rounded-full px-2.5 py-1 text-xs font-bold leading-none border uppercase ${(isFullyPaid && !isPastDue) ? 'p-prepaid' :
                                                                (isPartiallyPaid && !isPastDue) ? 'p-prepaid-partial' :
                                                                    isPartiallyPaid ? 'p-partial' :
                                                                        isMissed ? 'p-overdue' :
                                                                            isFullyPaid ? 'p-paid' :
                                                                                'p-upcoming'
                                                                }`}>
                                                                {(isPartiallyPaid && !isPastDue) ? 'prepaid' :
                                                                    (isFullyPaid && !isPastDue) ? 'prepaid' :
                                                                        isPartiallyPaid ? 'partial' :
                                                                            isMissed ? 'overdue' :
                                                                                due.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            } else {
                                                return (
                                                    <tr key={due.id} ref={el => scheduleRowsRef.current[due.id] = el} style={{ opacity: 0.7 }}>
                                                        <td className="text-slate-400 font-mono">{due.dueSequence}</td>
                                                        <td className="text-slate-500">{formatDate(due.dueDate)}</td>
                                                        <td className="num-col text-right">{formatCurrency(due.principalDue)}</td>
                                                        <td className="num-col text-right">{formatCurrency(due.interestDue)}</td>
                                                        <td className="num-col text-right">—</td>
                                                        <td className="num-col text-right font-bold">{formatCurrency(due.totalDue)}</td>
                                                        <td className="num-col text-right">—</td>
                                                        <td style={{ textAlign: 'center' }}><span className="badge pill-fixed rounded-full px-2.5 py-1 text-xs font-bold leading-none border uppercase p-upcoming">Upcoming</span></td>
                                                    </tr>
                                                );
                                            }
                                        })}

                                        {sortedDues.length > 5 && (
                                            <tr>
                                                <td colSpan={8} style={{ textAlign: 'center', padding: 0, height: '48px' }}>
                                                    <button
                                                        className="btn btn-ghost btn-sm w-full h-full"
                                                        style={{ borderRadius: 0, fontSize: '11px', fontWeight: 600, color: 'var(--slate-500)' }}
                                                        onClick={() => setExpandFuture(!expandFuture)}
                                                    >
                                                        {expandFuture ? 'SHOW LESS' : `SHOW ${sortedDues.length - 5} MORE DUES`}
                                                    </button>
                                                </td>
                                            </tr>
                                        )}

                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* B. PAYMENTS LEDGER */}
                    {activeTab === 'payments' && (
                        <div className="terminal-panel">
                            <div className="terminal-panel-header">Payment Ledger</div>
                            <div className="terminal-table-wrapper">
                                <table className="terminal-table">
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left' }}>Date</th>
                                            <th className="num-col">Amount</th>
                                            <th style={{ textAlign: 'left' }}>Type</th>
                                            <th style={{ textAlign: 'left' }}>Mode</th>
                                            <th style={{ textAlign: 'left' }}>Notes / Ref</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedPayments.length ? sortedPayments.map((p) => (
                                            <tr key={p.id}>
                                                <td className="font-medium text-slate-800">{formatDate(p.paymentDate)}</td>
                                                <td className="num-col font-bold text-success">{formatCurrency(p.amount)}</td>
                                                <td><span className="badge badge-success text-[10px]">EMI / Principal</span></td>
                                                <td className="font-mono text-slate-600 text-[11px] uppercase">{p.paymentMethod || '—'}</td>
                                                <td className="text-slate-500 text-xs">{p.referenceNumber || '—'}</td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--slate-400)', padding: '30px' }}>No payments recorded yet.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* C. DOCUMENTS */}
                    {activeTab === 'documents' && (
                        <div className="terminal-panel">
                            <div className="terminal-panel-header">Loan Documentation</div>
                            <div className="terminal-panel-body doc-list">
                                <div className="doc-item">
                                    <div>
                                        <div className="font-medium text-slate-700">Loan Agreement</div>
                                        <div className="text-[10px] text-slate-400">PDF • Generated {formatDate(loan.createdAt)}</div>
                                    </div>
                                    <div className="flex gap-2 text-brand-primary">
                                        <button className="btn btn-ghost btn-sm px-2"><Eye size={14} className="mr-1" /> View</button>
                                    </div>
                                </div>
                                <div className="doc-item">
                                    <div>
                                        <div className="font-medium text-slate-700">Borrower ID Proof</div>
                                        <div className="text-[10px] text-slate-400">JPEG/PNG</div>
                                    </div>
                                    <div className="flex gap-2 text-brand-primary">
                                        <button className="btn btn-ghost btn-sm px-2"><Eye size={14} className="mr-1" /> View</button>
                                    </div>
                                </div>
                                {loan.vehicle?.rcImageUrl && (
                                    <div className="doc-item">
                                        <div>
                                            <div className="font-medium text-slate-700">Vehicle RC</div>
                                            <div className="text-[10px] text-slate-400">Found on record</div>
                                        </div>
                                        <div className="flex gap-2 text-brand-primary">
                                            <button className="btn btn-ghost btn-sm px-2" onClick={() => window.open(loan.vehicle.rcImageUrl, '_blank')}><Eye size={14} className="mr-1" /> View</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* E. GUARANTOR */}
                    {activeTab === 'guarantor' && (
                        <div className="terminal-panel">
                            <div className="terminal-panel-header">Guarantor Details</div>
                            <div className="terminal-table-wrapper">
                                <table className="terminal-table">
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left' }}>Guarantor Name</th>
                                            <th style={{ textAlign: 'left' }}>Relationship</th>
                                            <th style={{ textAlign: 'left' }}>Phone Number</th>
                                            <th style={{ textAlign: 'left' }}>Address</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loan.guarantors && loan.guarantors.length > 0 ? loan.guarantors.map(g => (
                                            <tr key={g.id}>
                                                <td className="font-medium text-slate-800">{g.name}</td>
                                                <td className="text-slate-500">{g.relationship || '—'}</td>
                                                <td className="font-mono text-slate-600">{g.phone || '—'}</td>
                                                <td className="text-slate-500 text-xs">{g.address || '—'}</td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--slate-400)', padding: '30px' }}>No guarantors on record.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* D. CALL LOGS */}
                    {activeTab === 'logs' && (
                        <div className="terminal-panel">
                            <div className="terminal-panel-header">Communication History</div>
                            <div className="terminal-table-wrapper">
                                <table className="terminal-table">
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left' }}>Date</th>
                                            <th style={{ textAlign: 'left' }}>Outcome</th>
                                            <th style={{ textAlign: 'left' }}>Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {callTask && callTask.callLogs?.length > 0 ? callTask.callLogs.map((log, i) => (
                                            <tr key={i}>
                                                <td className="font-medium text-slate-800">{formatDate(log.callDate)}</td>
                                                <td><span className={`badge ${log.outcome === 'promise' ? 'badge-success' : 'badge-info'}`}>{log.outcome}</span></td>
                                                <td className="text-slate-600 text-sm w-full">{log.notes || '—'}</td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--slate-400)', padding: '30px' }}>No interaction history on record.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* 30% RIGHT -> UNIFIED PANEL */}
                <div className="terminal-right">
                    <div className="terminal-panel shadow-sm bg-white">
                        <div className="terminal-panel-header">Loan Info</div>
                        <div className="terminal-side-list">
                            <div className="terminal-side-row">
                                <span className="label"><CreditCard size={12} /> Principal</span>
                                <span className="value text-emerald-600">{formatCurrency(loan.principalAmount)}</span>
                            </div>
                            <div className="terminal-side-row">
                                <span className="label"><Clock size={12} /> Tenure</span>
                                <span className="value">{loan.tenureMonths} Months</span>
                            </div>
                            <div className="terminal-side-row">
                                <span className="label"><BarChart3 size={12} /> Interest Rate</span>
                                <span className="value">{(Number(loan.monthlyInterestRate) * 100).toFixed(2)}%/mo</span>
                            </div>
                            <div className="terminal-side-row">
                                <span className="label"><Calendar size={12} /> Start Date</span>
                                <span className="value">{formatDate(loan.startDate)}</span>
                            </div>
                            <div className="terminal-side-row">
                                <span className="label"><CalendarCheck size={12} /> End Date</span>
                                <span className="value">{formatDate(sortedDues[sortedDues.length - 1]?.dueDate)}</span>
                            </div>
                            <div className="terminal-side-row">
                                <span className="label"><RefreshCcw size={12} /> EMI</span>
                                <span className="value">{formatCurrency(loan.monthlyDueAmount)}</span>
                            </div>
                            <div className="terminal-side-row">
                                <span className="label"><ArrowDownCircle size={12} /> Monthly Principal</span>
                                <span className="value">{formatCurrency(sortedDues[0]?.principalDue)}</span>
                            </div>
                            <div className="terminal-side-row">
                                <span className="label"><ArrowUpRight size={12} /> Monthly Interest</span>
                                <span className="value">{formatCurrency(sortedDues[0]?.interestDue)}</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Modals */}
            {showPayment && (
                <PaymentModal
                    loanId={loan.id}
                    customerName={loan.customer?.name}
                    outstanding={Number(loan.outstandingPrincipal)}
                    onClose={() => setShowPayment(false)}
                    onSuccess={() => { setShowPayment(false); loadLoan(); }}
                />
            )}

            {showCallLog && callTask && (
                <CallLogModal
                    task={{ ...callTask, loan, outstandingPrincipal: Number(loan.outstandingPrincipal) }}
                    onClose={() => setShowCallLog(false)}
                    onSuccess={() => { setShowCallLog(false); loadLoan(); }}
                />
            )}

            {showSeize && (
                <SeizureModal
                    loanId={loan.id}
                    vehicleId={loan.vehicle?.id}
                    customerName={loan.customer?.name}
                    vehicleNumber={loan.vehicle?.vehicleNumber}
                    onClose={() => setShowSeize(false)}
                    onSuccess={() => {
                        setShowSeize(false);
                        loadLoan();
                    }}
                />
            )}

            {showForeclosure && (
                <ForeclosureModal
                    loanId={loan.id}
                    customerName={loan.customer?.name}
                    vehicleNumber={loan.vehicle?.vehicleNumber}
                    onClose={() => setShowForeclosure(false)}
                    onSuccess={() => {
                        setShowForeclosure(false);
                        loadLoan();
                    }}
                />
            )}

            {showReclaim && (
                <div className="modal-overlay" onClick={() => setShowReclaim(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
                        <div className="modal-header">
                            <h2><RefreshCcw size={18} /> Reclaim Vehicle</h2>
                            <button className="btn btn-ghost" onClick={() => setShowReclaim(false)}>✕</button>
                        </div>
                        <form onSubmit={handleReclaimSubmit}>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                {reclaimError && <div className="login-error">{reclaimError}</div>}

                                <div className="card-glass" style={{ padding: 'var(--space-4)', borderLeft: '4px solid var(--color-warning)', background: 'linear-gradient(to right, var(--slate-50), #ffffff)' }}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Overdue Dues</div>
                                            <div style={{ fontWeight: 700, color: 'var(--color-danger)', fontSize: '18px' }}>
                                                ₹{Number(totalOverdue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Total Outstanding</div>
                                            <div style={{ fontWeight: 800, color: 'var(--color-warning)', fontSize: '18px' }}>
                                                ₹{Number(sortedDues.reduce((sum, d) => d.status === 'paid' ? sum : sum + (Number(d.totalDue) - Number(d.amountPaid || 0)), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Payment Amount (₹) *</label>
                                    <div className="input-with-icon">
                                        <div className="input-icon"><CreditCard size={16} /></div>
                                        <input
                                            type="number"
                                            className="form-input"
                                            placeholder="Enter Payment Amount"
                                            value={reclaimAmount}
                                            onChange={(e) => setReclaimAmount(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                                        Partial payments are supported.
                                    </span>
                                </div>

                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Payment Method</label>
                                    <select
                                        className="form-input"
                                        value={reclaimMethod}
                                        onChange={(e) => setReclaimMethod(e.target.value)}
                                        style={{ height: '42px' }}
                                    >
                                        <option value="cash">Cash</option>
                                        <option value="upi">UPI</option>
                                        <option value="bank">Bank Transfer</option>
                                        <option value="cheque">Cheque</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer" style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowReclaim(false)} style={{ flex: 1 }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={submittingReclaim} style={{ flex: 1, backgroundColor: '#2563eb', borderColor: '#2563eb' }}>
                                    {submittingReclaim ? 'Saving...' : 'Confirm Reclaim'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

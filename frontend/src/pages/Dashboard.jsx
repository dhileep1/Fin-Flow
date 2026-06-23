import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import PaymentModal from '../components/PaymentModal';
import '../styles/dashboard.css';

import {
    TrendingUp,
    Target,
    Landmark,
    Activity,
    ListChecks,
    IndianRupee,
    Phone,
    Calendar,
    Users,
    Trophy,
    Zap,
    ArrowUpRight,
    Clock,
    AlertCircle,
    CheckCircle2,
    ChevronRight,
    Wallet,
    Car,
    User,
    AlertTriangle,
    Hash,
    ChevronsUpDown,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */
const fmt = (n) =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(n || 0);

const fmtShort = (n) => {
    if (!n) return '₹0';
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return `₹${n.toLocaleString('en-IN')}`;
};

const pct = (actual, target) => (target ? Math.round((actual / target) * 100) : 0);

const progressColor = (percent) => {
    if (percent >= 100) return 'emerald';
    if (percent >= 50) return 'blue';
    return 'amber';
};

const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const getUserColorIndex = (name) => {
    if (!name) return 0;
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 5;
};

/* ─────────────────────────────────────────────
   ProgressCard — semantic-colored target widget
   colorScheme: 'emerald' | 'blue' | 'amber' | 'slate'
   ───────────────────────────────────────────── */
function ProgressCard({ title, icon, actual, target, subtitle, variant, colorScheme = 'emerald' }) {
    const percent = variant === 'count' ? null : pct(actual, target);
    const color = variant === 'count' ? 'slate' : colorScheme;

    return (
        <div className="progress-card" id={`progress-${title.replace(/\s+/g, '-').toLowerCase()}`}>
            <div className={`progress-card__icon-circle progress-card__icon-circle--${color}`}>
                {icon}
            </div>
            <div className="progress-card__body">
                <div className="progress-card__top-row">
                    <div>
                        <span className="progress-card__title">{title}</span>
                        <div className="progress-card__values">
                            <span className="progress-card__actual">{fmtShort(actual)}</span>
                            {target != null && (
                                <>
                                    <span className="progress-card__separator">/</span>
                                    <span className="progress-card__target">{fmtShort(target)}</span>
                                </>
                            )}
                        </div>
                    </div>
                    {variant !== 'count' && percent != null && (
                        <span className={`progress-card__pct progress-card__pct--${color}`}>
                            {percent}%
                        </span>
                    )}
                    {variant === 'count' && subtitle && (
                        <span className="progress-card__count-sub">{subtitle}</span>
                    )}
                </div>
                {variant !== 'count' && (
                    <div className="progress-bar-track progress-bar-track--card">
                        <div
                            className={`progress-bar-fill progress-bar-fill--${color}`}
                            style={{ width: `${Math.min(percent, 100)}%`, minWidth: percent > 0 ? '8px' : '0' }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────
   MiniStat — small stat above tables
   ───────────────────────────────────────────── */
function MiniStat({ label, value, icon, trend }) {
    return (
        <div className="mini-stat">
            <div className="mini-stat__icon">{icon}</div>
            <div className="mini-stat__body">
                <span className="mini-stat__label">{label}</span>
                <span className="mini-stat__value">{value}</span>
            </div>
            {trend && (
                <span className={`mini-stat__trend mini-stat__trend--${trend > 0 ? 'up' : 'down'}`}>
                    <ArrowUpRight size={12} />
                    {Math.abs(trend)}%
                </span>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────
   LeaderboardRow — single context-aware bar
   ───────────────────────────────────────────── */
function LeaderboardRow({ name, collectPct, disbursePct, collectAmt, disburseAmt, rank, mode }) {
    const initials = name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    const isCollectors = mode === 'collectors';
    const activePct = isCollectors ? collectPct : disbursePct;
    const activeAmt = isCollectors ? collectAmt : disburseAmt;
    const targetAmt = activePct > 0 ? Math.round(activeAmt / (activePct / 100)) : 1000000;
    
    const barColor = isCollectors ? 'progress-bar-fill--emerald' : 'progress-bar-fill--blue';
    const pctClass = isCollectors ? 'board-pct--emerald' : 'board-pct--blue';

    return (
        <div className="board-row">
            <div className="leaderboard-avatar" style={{ background: 'var(--slate-100)', color: 'var(--slate-700)' }}>{initials}</div>
            
            <div className="board-content">
                <div className="board-top">
                    <div className="board-title-group">
                        <span className="board-name">{name}</span>
                        <div className="board-amounts">
                            <span className="board-actual">{fmtShort(activeAmt)}</span>
                            <span className="board-separator">/</span>
                            <span className="board-target">{fmtShort(targetAmt)}</span>
                        </div>
                    </div>
                    <span className={`board-pct ${pctClass}`}>
                        {activePct}%
                    </span>
                </div>
                
                <div className="progress-bar-track progress-bar-track--card board-bar-container">
                    <div
                        className={`progress-bar-fill ${barColor}`}
                        style={{ width: `${Math.min(activePct, 100)}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────
   PriorityAction — staff side panel
   ───────────────────────────────────────────── */
function PriorityAction({ task, onPay, onCall }) {
    const getStatus = (days) => {
        if (!days || days <= 0) return { label: 'Good', color: 'badge-success' };
        if (days >= 7) return { label: 'Critical', color: 'badge-defaulter' };
        return { label: 'Warning', color: 'badge-overdue' };
    };
    const status = getStatus(task.daysOverdue);

    return (
        <div className="priority-action" id={`action-${task.id}`}>
            <div className="priority-action__body">
                <div className="flex items-center justify-between mb-1">
                    <span className="priority-action__name">{task.customerName}</span>
                    <span className={`badge ${status.color}`} style={{ fontSize: '9px', padding: '2px 6px' }}>{status.label}</span>
                </div>
                <span className="priority-action__amount">{fmt(task.amount)} due {task.dueLabel}</span>
            </div>
            <div className="priority-action__btns">
                <button className="btn btn-sm btn-action-outline" onClick={() => onPay(task)} title="Record payment">
                    <IndianRupee size={13} />
                </button>
                <button className="btn btn-sm btn-action-pill" onClick={() => onCall(task)} title="Call">
                    <Phone size={13} />
                </button>
            </div>
        </div>
    );
}

/* ═════════════════════════════════════════════
   DASHBOARD  (Performance Command Center)
   ═════════════════════════════════════════════ */
export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const userRole = user?.role || 'admin'; // fallback

    /* --- state --- */
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('collections');    // 'collections' | 'loans'
    const [timeFrame, setTimeFrame] = useState('daily');          // 'daily' | 'weekly' | 'monthly'
    const [leaderboardMode, setLeaderboardMode] = useState('collectors'); // 'collectors' | 'closers'

    // modals
    const [paymentTarget, setPaymentTarget] = useState(null);

    /* --- data fetch --- */
    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const data = await api.getDashboardStats(timeFrame);
                setStats(data);
            } catch (err) {
                console.error('Stats load failed', err);
            } finally {
                setLoading(false);
            }
        })();
    }, [timeFrame]);

    /* ── Timeframe multipliers (simulate period scaling) ── */
    const timeMultiplier = useMemo(() => {
        switch (timeFrame) {
            case 'weekly': return 7;
            case 'monthly': return 30;
            default: return 1;
        }
    }, [timeFrame]);

    /* ── Derived targets (recalculate based on timeFrame) ── */
    const targets = useMemo(() => {
        if (!stats) return null;

        const collectionsToday = stats.todayCollections || 0;
        const totalGiven = stats.totalOutstanding || 0;
        const activeLoans = stats.activeLoans || 0;
        const criticalDues = stats.criticalDues || 0;

        // Base daily targets — multiplied by timeframe
        const baseDailyCollTarget = 500000;
        const baseDailyDisbTarget = 2000000;
        const baseDailyPersonalCollTarget = 100000;
        const baseDailyPersonalDisbTarget = 400000;

        const collectionTarget = baseDailyCollTarget * timeMultiplier;
        const disbursementTarget = baseDailyDisbTarget * timeMultiplier;
        const personalCollTarget = baseDailyPersonalCollTarget * timeMultiplier;
        const personalDisbTarget = baseDailyPersonalDisbTarget * timeMultiplier;

        // Actuals from backend are already period-aware
        const periodCollections = collectionsToday;
        const periodDisbursements = stats.totalGiven || 0;

        // Overdue dues amount
        const overdueDuesAmount = criticalDues * 12500;

        return {
            org: {
                collections: { actual: Math.round(periodCollections), target: collectionTarget },
                disbursements: { actual: Math.round(periodDisbursements), target: disbursementTarget },
                overdueDues: overdueDuesAmount,
                activeLoans,
                criticalDues,
            },
            personal: {
                collections: { actual: periodCollections, target: personalCollTarget },
                disbursements: { actual: periodDisbursements, target: personalDisbTarget },
                pendingTasks: criticalDues || 0,
            },
        };
    }, [stats, timeMultiplier, timeFrame]);

    /* ── Real data from stats ── */
    const tableData = useMemo(() => {
        return { 
            collections: stats?.recentCollections || [], 
            loans: stats?.recentLoans || [] 
        };
    }, [stats]);

    const leaderboard = useMemo(() => stats?.team || [], [stats]);

    // Sort leaderboard by current mode
    const sortedLeaderboard = useMemo(() => {
        return [...leaderboard].sort((a, b) => {
            if (leaderboardMode === 'collectors') return b.collectPct - a.collectPct;
            return b.disbursePct - a.disbursePct;
        });
    }, [leaderboard, leaderboardMode]);

    const priorityActions = useMemo(() => stats?.priorityActions || [], [stats]);

    const currentRows = activeTab === 'collections' ? tableData.collections : tableData.loans;
    const periodTotal = activeTab === 'collections'
        ? currentRows.reduce((s, r) => s + r.amount, 0)
        : currentRows.reduce((s, r) => s + r.principal, 0);

    /* ── Loading skeleton ── */
    if (loading) {
        return (
            <div className="dashboard animate-fade-in">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Dashboard</h1>
                        <p className="page-subtitle">Loading performance data…</p>
                    </div>
                </div>
                <div className="cmd-progress-grid">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="progress-card progress-card--loading">
                            <div className="loading-skeleton" style={{ height: 16, width: 120, marginBottom: 12 }} />
                            <div className="loading-skeleton" style={{ height: 24, width: 180, marginBottom: 12 }} />
                            <div className="loading-skeleton" style={{ height: 8, width: '100%', borderRadius: 4 }} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }



    return (
        <div className="dashboard animate-fade-in" id="dashboard-command-center">
            {/* ─── 1. HEADER (with global timeframe filter) ─── */}
            <div className="page-header" style={{ marginBottom: 'var(--space-6)' }}>
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-subtitle">Overview and performance targets</p>
                </div>
                <div className="cmd-header-meta">
                    <span className="cmd-date-badge text-slate-500">
                        <Calendar size={14} className="text-slate-500" />
                        <span className="text-slate-600 font-medium">
                            {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                    </span>
                    {/* Global Timeframe Toggle — moved here */}
                    <div className="cmd-timeframe-group" role="radiogroup" aria-label="Time frame" id="global-timeframe-filter">
                        {['daily', 'weekly', 'monthly'].map((tf) => (
                            <button
                                key={tf}
                                role="radio"
                                aria-checked={timeFrame === tf}
                                className={`cmd-timeframe-btn ${timeFrame === tf ? 'cmd-timeframe-btn--active' : ''}`}
                                onClick={() => setTimeFrame(tf)}
                                id={`timeframe-${tf}`}
                            >
                                {tf.charAt(0).toUpperCase() + tf.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ─── 2. TARGET PROGRESS WIDGETS (unified 3-col grid) ─── */}
            <div className="cmd-grid-3" id="target-cards">
                {userRole === 'admin' ? (
                    <>
                        <ProgressCard
                            title="Collections Target"
                            icon={<TrendingUp size={24} />}
                            actual={targets.org.collections.actual}
                            target={targets.org.collections.target}
                            colorScheme="emerald"
                        />
                        <ProgressCard
                            title="Disbursements Target"
                            icon={<Landmark size={24} />}
                            actual={targets.org.disbursements.actual}
                            target={targets.org.disbursements.target}
                            colorScheme="blue"
                        />
                        {/* Overdue Card */}
                        <div className="progress-card overdue-card" id="progress-overdue-dues" onClick={() => navigate('/calls')}>
                            <div className="progress-card__icon-circle progress-card__icon-circle--danger overdue-icon">
                                <AlertTriangle size={24} />
                            </div>
                            <div className="progress-card__body overdue-body">
                                <div className="progress-card__top-row overdue-header">
                                    <div className="overdue-content">
                                        <span className="progress-card__title">Overdue Dues</span>
                                        <div className="overdue-stats">
                                            <span className="overdue-actual">{fmtShort(targets.org.overdueDues)}</span>
                                            <span className="overdue-badge">
                                                {targets.org.criticalDues} at risk
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronRight size={18} className="overdue-chevron" />
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <ProgressCard
                            title="My Collection Target"
                            icon={<Target size={24} />}
                            actual={targets.personal.collections.actual}
                            target={targets.personal.collections.target}
                            colorScheme="emerald"
                        />
                        <ProgressCard
                            title="My Disbursement Target"
                            icon={<Landmark size={24} />}
                            actual={targets.personal.disbursements.actual}
                            target={targets.personal.disbursements.target}
                            colorScheme="blue"
                        />
                        <ProgressCard
                            title="My Daily Tasks"
                            icon={<ListChecks size={24} />}
                            actual={targets.personal.pendingTasks}
                            variant="count"
                            subtitle="pending calls"
                        />
                    </>
                )}
            </div>



            {/* ─── 4. MAIN CONTENT: TABLE + SIDEBAR (same 3-col grid) ─── */}
            <div className="cmd-grid-3">
                {/* ── Left: Summary Table ── */}
                <div className="cmd-table-panel card cmd-col-span-2" id="summary-table-panel">
                    {/* Table Header Wrapper (Tabs + Stats) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
                        {/* Table Tabs */}
                        <div className="cmd-table-tabs" style={{ marginBottom: 0 }} id="dashboard-controls">
                            <div className="cmd-tab-group" role="tablist">
                                {[
                                    { key: 'collections', label: 'Collections', icon: <Wallet size={15} /> },
                                    { key: 'loans', label: 'Loans Given', icon: <Landmark size={15} /> },
                                ].map((t) => (
                                    <button
                                        key={t.key}
                                        role="tab"
                                        aria-selected={activeTab === t.key}
                                        className={`cmd-tab ${activeTab === t.key ? 'cmd-tab--active' : ''}`}
                                        onClick={() => setActiveTab(t.key)}
                                        id={`tab-${t.key}`}
                                    >
                                        {t.icon}
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Top-Right Mini stats */}
                        <div className="cmd-mini-stats" style={{ marginBottom: 0, minWidth: '320px' }}>
                            <MiniStat
                                label="Transactions"
                                value={currentRows.length}
                                icon={<Hash size={14} />}
                            />
                            <MiniStat
                                label={activeTab === 'collections' ? 'Avg Collected' : 'Avg Ticket'}
                                value={fmtShort(Math.round(periodTotal / (currentRows.length || 1)))}
                                icon={activeTab === 'collections' ? <Wallet size={14} /> : <TrendingUp size={14} />}
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="table-container p-0 border-0 shadow-none">
                        <table className="w-full text-sm">
                            <thead>
                                {activeTab === 'collections' ? (
                                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        <th className="px-6 py-4 text-left">Customer</th>
                                        <th className="px-6 py-4 text-center">Amount Paid</th>
                                        <th className="px-6 py-4 text-center">Date</th>
                                        <th className="px-6 py-4 text-center">Collected By</th>
                                    </tr>
                                ) : (
                                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        <th className="px-6 py-4 text-left">Customer</th>
                                        <th className="px-6 py-4 text-center">Principal</th>
                                        <th className="px-6 py-4 text-center">Vehicle</th>
                                        <th className="px-6 py-4 text-center">Disbursed By</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {currentRows.map((row) => (
                                    <tr key={row.id} className="cursor-pointer hover-table-row">
                                        {activeTab === 'collections' ? (
                                            <>
                                                <td className="px-6 py-4 text-left">
                                                    <span className="text-slate-900 font-semibold">{row.customer}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-slate-900 font-bold">{fmtShort(row.amount)}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center text-slate-500 font-medium">{formatDate(row.date)}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
                                                        {row.collectedBy}
                                                    </span>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-6 py-4 text-left">
                                                    <span className="text-slate-900 font-semibold">{row.customer}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-slate-900 font-bold">{fmtShort(row.principal)}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="px-2 py-1 rounded bg-slate-50 border border-slate-200 text-slate-500 text-xs font-mono">
                                                        {row.vehicle}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
                                                        {row.disbursedBy}
                                                    </span>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ── Right: Contextual Panel ── */}
                <div className="cmd-side-panel cmd-col-span-1" id="contextual-panel">
                    {userRole === 'admin' ? (
                        <div className="cmd-leaderboard card">
                            <div className="cmd-panel-header">
                                <div className="cmd-panel-icon cmd-panel-icon--gold">
                                    <Trophy size={20} />
                                </div>
                                <div>
                                    <h3 className="cmd-panel-title">Team Leaderboard</h3>
                                </div>
                            </div>

                            {/* Leaderboard Mode Toggle */}
                            <div className="cmd-leaderboard-toggle" role="radiogroup" aria-label="Leaderboard view">
                                <button
                                    role="radio"
                                    aria-checked={leaderboardMode === 'collectors'}
                                    className={`cmd-lb-toggle-btn ${leaderboardMode === 'collectors' ? 'cmd-lb-toggle-btn--active' : ''}`}
                                    onClick={() => setLeaderboardMode('collectors')}
                                    id="lb-toggle-collectors"
                                >
                                    <TrendingUp size={13} /> Top Collectors
                                </button>
                                <button
                                    role="radio"
                                    aria-checked={leaderboardMode === 'closers'}
                                    className={`cmd-lb-toggle-btn ${leaderboardMode === 'closers' ? 'cmd-lb-toggle-btn--active' : ''}`}
                                    onClick={() => setLeaderboardMode('closers')}
                                    id="lb-toggle-closers"
                                >
                                    <Landmark size={13} /> Top Closers
                                </button>
                            </div>

                            <div className="leaderboard-list">
                                {sortedLeaderboard.map((member, idx) => (
                                    <LeaderboardRow
                                        key={member.name}
                                        name={member.name}
                                        collectPct={member.collectPct}
                                        disbursePct={member.disbursePct}
                                        collectAmt={member.collectAmt}
                                        disburseAmt={member.disburseAmt}
                                        rank={idx + 1}
                                        mode={leaderboardMode}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="cmd-priority card">
                            <div className="cmd-panel-header">
                                <div className="cmd-panel-icon cmd-panel-icon--action">
                                    <Zap size={16} />
                                </div>
                                <div>
                                    <h3 className="cmd-panel-title">Priority Actions</h3>
                                    <p className="cmd-panel-subtitle">Tasks to hit your target</p>
                                </div>
                            </div>
                            <div className="priority-list">
                                {priorityActions.map((task) => (
                                    <PriorityAction
                                        key={task.id}
                                        task={task}
                                        onPay={(t) => setPaymentTarget(t)}
                                        onCall={() => {}}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Payment Modal ── */}
            {paymentTarget && (
                <PaymentModal
                    loanId={paymentTarget.loanId || ''}
                    customerName={paymentTarget.customerName}
                    outstanding={paymentTarget.amount}
                    onClose={() => setPaymentTarget(null)}
                    onSuccess={() => setPaymentTarget(null)}
                />
            )}
        </div>
    );
}

import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/client';
import { Wallet, Calendar, User, Search, ChevronLeft, ChevronRight, Hash, TrendingUp, Landmark, Receipt, ArrowDownCircle, PlusCircle, X } from 'lucide-react';

const PAGE_SIZE = 10;

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

const formatDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function Collections() {
    const [payments, setPayments] = useState([]);
    const [loans, setLoans] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Tab and filter states
    const [activeTab, setActiveTab] = useState('payments'); // 'payments' | 'docCharges' | 'expenses'
    const [dateFilter, setDateFilter] = useState('month'); // 'all' | 'today' | 'week' | 'month' | 'custom'
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Pagination states
    const [paymentPage, setPaymentPage] = useState(1);
    const [loanPage, setLoanPage] = useState(1);
    const [expensePage, setExpensePage] = useState(1);

    // Modal state for adding expense
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseCategory, setExpenseCategory] = useState('rent');
    const [expenseDesc, setExpenseDesc] = useState('');
    const [expenseDate, setExpenseDate] = useState('');
    const [submittingExpense, setSubmittingExpense] = useState(false);
    const [modalError, setModalError] = useState('');

    const fetchAllData = async () => {
        try {
            const [paymentsData, loansData, expensesData] = await Promise.all([
                api.getPayments(),
                api.getLoans('limit=1000'),
                api.getExpenses()
            ]);
            setPayments(paymentsData || []);
            setLoans(loansData?.loans || []);
            setExpenses(expensesData || []);
        } catch (err) {
            console.error('Failed to load collections/expenses data:', err);
        }
    };

    useEffect(() => {
        (async () => {
            setLoading(true);
            await fetchAllData();
            setLoading(false);
        })();
    }, []);

    // Handle submitting new expense
    const handleAddExpenseSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!expenseAmount || Number(expenseAmount) <= 0) {
            setModalError('Please enter a valid amount');
            return;
        }
        setSubmittingExpense(true);
        setModalError('');
        try {
            await api.createExpense({
                amount: Number(expenseAmount),
                category: expenseCategory,
                description: expenseDesc,
                expenseDate: expenseDate || undefined
            });
            
            // Reload list
            await fetchAllData();
            
            // Reset states and close modal
            setShowExpenseModal(false);
            setExpenseAmount('');
            setExpenseCategory('rent');
            setExpenseDesc('');
            setExpenseDate('');
        } catch (err) {
            setModalError(err.message || 'Failed to add expense');
        } finally {
            setSubmittingExpense(false);
        }
    };

    // Filter payments based on date selection
    const dateFilteredPayments = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return payments.filter(p => {
            if (!p.paymentDate) return false;
            const pDate = new Date(p.paymentDate);
            if (isNaN(pDate.getTime())) return false;

            if (dateFilter === 'today') {
                const start = new Date(today);
                const end = new Date(today);
                end.setHours(23, 59, 59, 999);
                return pDate >= start && pDate <= end;
            }
            if (dateFilter === 'week') {
                const start = new Date(today);
                start.setDate(today.getDate() - 7);
                const end = new Date(today);
                end.setHours(23, 59, 59, 999);
                return pDate >= start && pDate <= end;
            }
            if (dateFilter === 'month') {
                const start = new Date(today.getFullYear(), today.getMonth(), 1);
                const end = new Date(today);
                end.setHours(23, 59, 59, 999);
                return pDate >= start && pDate <= end;
            }
            if (dateFilter === 'custom') {
                if (!customFrom || !customTo) return true;
                const start = new Date(customFrom);
                start.setHours(0, 0, 0, 0);
                const end = new Date(customTo);
                end.setHours(23, 59, 59, 999);
                return pDate >= start && pDate <= end;
            }
            return true;
        });
    }, [payments, dateFilter, customFrom, customTo]);

    // Filter loans (for document charges) based on date selection
    const dateFilteredLoans = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return loans.filter(l => {
            if (!l.startDate) return false;
            const lDate = new Date(l.startDate);
            if (isNaN(lDate.getTime())) return false;

            if (dateFilter === 'today') {
                const start = new Date(today);
                const end = new Date(today);
                end.setHours(23, 59, 59, 999);
                return lDate >= start && lDate <= end;
            }
            if (dateFilter === 'week') {
                const start = new Date(today);
                start.setDate(today.getDate() - 7);
                const end = new Date(today);
                end.setHours(23, 59, 59, 999);
                return lDate >= start && lDate <= end;
            }
            if (dateFilter === 'month') {
                const start = new Date(today.getFullYear(), today.getMonth(), 1);
                const end = new Date(today);
                end.setHours(23, 59, 59, 999);
                return lDate >= start && lDate <= end;
            }
            if (dateFilter === 'custom') {
                if (!customFrom || !customTo) return true;
                const start = new Date(customFrom);
                start.setHours(0, 0, 0, 0);
                const end = new Date(customTo);
                end.setHours(23, 59, 59, 999);
                return lDate >= start && lDate <= end;
            }
            return true;
        });
    }, [loans, dateFilter, customFrom, customTo]);

    // Filter expenses based on date selection
    const dateFilteredExpenses = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return expenses.filter(e => {
            if (!e.expenseDate) return false;
            const eDate = new Date(e.expenseDate);
            if (isNaN(eDate.getTime())) return false;

            if (dateFilter === 'today') {
                const start = new Date(today);
                const end = new Date(today);
                end.setHours(23, 59, 59, 999);
                return eDate >= start && eDate <= end;
            }
            if (dateFilter === 'week') {
                const start = new Date(today);
                start.setDate(today.getDate() - 7);
                const end = new Date(today);
                end.setHours(23, 59, 59, 999);
                return eDate >= start && eDate <= end;
            }
            if (dateFilter === 'month') {
                const start = new Date(today.getFullYear(), today.getMonth(), 1);
                const end = new Date(today);
                end.setHours(23, 59, 59, 999);
                return eDate >= start && eDate <= end;
            }
            if (dateFilter === 'custom') {
                if (!customFrom || !customTo) return true;
                const start = new Date(customFrom);
                start.setHours(0, 0, 0, 0);
                const end = new Date(customTo);
                end.setHours(23, 59, 59, 999);
                return eDate >= start && eDate <= end;
            }
            return true;
        });
    }, [expenses, dateFilter, customFrom, customTo]);

    // Filter payments by search query
    const filteredPayments = useMemo(() => {
        if (!searchQuery.trim()) return dateFilteredPayments;
        const q = searchQuery.toLowerCase();
        return dateFilteredPayments.filter(p => {
            const customerName = p.loan?.customer?.name?.toLowerCase() || '';
            const loanNo = p.loanId?.slice(0, 8).toLowerCase() || '';
            const creatorName = p.creator?.name?.toLowerCase() || '';
            const billNo = p.receipts?.[0]?.receiptNumber?.toLowerCase() || '';
            return customerName.includes(q) || loanNo.includes(q) || creatorName.includes(q) || billNo.includes(q);
        });
    }, [dateFilteredPayments, searchQuery]);

    // Filter loans by search query
    const filteredLoans = useMemo(() => {
        if (!searchQuery.trim()) return dateFilteredLoans;
        const q = searchQuery.toLowerCase();
        return dateFilteredLoans.filter(l => {
            const customerName = l.customer?.name?.toLowerCase() || '';
            const loanNo = l.id?.slice(0, 8).toLowerCase() || '';
            return customerName.includes(q) || loanNo.includes(q);
        });
    }, [dateFilteredLoans, searchQuery]);

    // Filter expenses by search query
    const filteredExpenses = useMemo(() => {
        if (!searchQuery.trim()) return dateFilteredExpenses;
        const q = searchQuery.toLowerCase();
        return dateFilteredExpenses.filter(e => {
            const category = e.category?.toLowerCase() || '';
            const desc = e.description?.toLowerCase() || '';
            const creatorName = e.creator?.name?.toLowerCase() || '';
            const matchesTag = e.tags?.some(t => t.toLowerCase().includes(q)) || false;
            return category.includes(q) || desc.includes(q) || creatorName.includes(q) || matchesTag;
        });
    }, [dateFilteredExpenses, searchQuery]);

    // Paginate filtered payments
    const pagedPayments = useMemo(() => {
        const start = (paymentPage - 1) * PAGE_SIZE;
        return filteredPayments.slice(start, start + PAGE_SIZE);
    }, [filteredPayments, paymentPage]);

    // Paginate filtered loans
    const pagedLoans = useMemo(() => {
        const start = (loanPage - 1) * PAGE_SIZE;
        return filteredLoans.slice(start, start + PAGE_SIZE);
    }, [filteredLoans, loanPage]);

    // Paginate filtered expenses
    const pagedExpenses = useMemo(() => {
        const start = (expensePage - 1) * PAGE_SIZE;
        return filteredExpenses.slice(start, start + PAGE_SIZE);
    }, [filteredExpenses, expensePage]);

    const totalPaymentPages = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE));
    const totalLoanPages = Math.max(1, Math.ceil(filteredLoans.length / PAGE_SIZE));
    const totalExpensePages = Math.max(1, Math.ceil(filteredExpenses.length / PAGE_SIZE));

    const startIdx = (paymentPage - 1) * PAGE_SIZE + 1;
    const endIdx = Math.min(paymentPage * PAGE_SIZE, filteredPayments.length);

    // Calculate sum of principal and interest from allocationDetails
    const getBreakdown = (payment) => {
        let principalPaid = 0;
        let interestPaid = 0;

        if (payment.allocationDetails && Array.isArray(payment.allocationDetails)) {
            payment.allocationDetails.forEach(alloc => {
                principalPaid += Number(alloc.principal || 0);
                interestPaid += Number(alloc.interest || 0);
            });
        } else {
            principalPaid = Number(payment.amount || 0);
        }

        return { principalPaid, interestPaid };
    };

    // Calculate totals based on active tab
    const totals = useMemo(() => {
        let totalPrincipal = 0;
        let totalInterest = 0;
        let totalAmount = 0;

        filteredPayments.forEach(p => {
            const { principalPaid, interestPaid } = getBreakdown(p);
            totalPrincipal += principalPaid;
            totalInterest += interestPaid;
            totalAmount += Number(p.amount || 0);
        });

        let totalDocCharges = 0;
        let totalLoanAmount = 0;
        filteredLoans.forEach(l => {
            totalDocCharges += Number(l.documentFee || 0);
            totalLoanAmount += Number(l.principalAmount || 0);
        });

        let totalExpenseAmt = 0;
        let totalRentAmt = 0;
        let totalSalaryAmt = 0;
        filteredExpenses.forEach(e => {
            const amt = Number(e.amount || 0);
            totalExpenseAmt += amt;
            if (e.category === 'rent') totalRentAmt += amt;
            if (e.category === 'salary') totalSalaryAmt += amt;
        });

        return { totalPrincipal, totalInterest, totalAmount, totalDocCharges, totalLoanAmount, totalExpenseAmt, totalRentAmt, totalSalaryAmt };
    }, [filteredPayments, filteredLoans, filteredExpenses]);

    if (loading) {
        return (
            <div className="animate-fade-in">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Transactions</h1>
                        <p className="page-subtitle">Loading transactions data…</p>
                    </div>
                </div>
                <div className="card">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="loading-skeleton" style={{ height: 40, width: '100%', marginBottom: 12, borderRadius: 4 }} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in" style={{ maxWidth: 1200 }}>
            {/* Header */}
            <div className="page-header" style={{ marginBottom: 'var(--space-6)' }}>
                <div>
                    <h1 className="page-title">Transactions</h1>
                </div>
                <div className="cmd-header-meta">
                    <span className="cmd-date-badge text-slate-500">
                        <Calendar size={14} className="text-slate-500" />
                        <span className="text-slate-600 font-medium">
                            {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                    </span>
                </div>
            </div>

            {/* Tab Toggles */}
            <div className="cmd-table-tabs" style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="cmd-tab-group" role="tablist">
                    <button
                        role="tab"
                        aria-selected={activeTab === 'payments'}
                        className={`cmd-tab ${activeTab === 'payments' ? 'cmd-tab--active' : ''}`}
                        onClick={() => setActiveTab('payments')}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Wallet size={16} />
                        Payments Received
                    </button>
                    <button
                        role="tab"
                        aria-selected={activeTab === 'docCharges'}
                        className={`cmd-tab ${activeTab === 'docCharges' ? 'cmd-tab--active' : ''}`}
                        onClick={() => setActiveTab('docCharges')}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Receipt size={16} />
                        Document Charges
                    </button>
                    <button
                        role="tab"
                        aria-selected={activeTab === 'expenses'}
                        className={`cmd-tab ${activeTab === 'expenses' ? 'cmd-tab--active' : ''}`}
                        onClick={() => setActiveTab('expenses')}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <ArrowDownCircle size={16} />
                        Expenses
                    </button>
                </div>

                {activeTab === 'expenses' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ 
                            background: '#fef2f2', 
                            border: '1px solid #fee2e2', 
                            padding: '6px 14px', 
                            borderRadius: '10px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'rgb(239, 68, 68)'
                        }}>
                            <span style={{ color: '#ef4444', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>Total Expenses:</span>
                            <span>{fmt(totals.totalExpenseAmt)}</span>
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={() => setShowExpenseModal(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '10px', padding: '8px 16px', fontSize: '13px' }}
                        >
                            <PlusCircle size={16} />
                            Add Expense
                        </button>
                    </div>
                )}
            </div>

            {/* Filter and Search Panel (Premium Controls) */}
            <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4) var(--space-5)', background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(226, 232, 240, 0.8)', borderRadius: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    
                    {/* Search bar on left, filters on right */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                        
                        {/* Search field - Interactive Premium Border */}
                        <div 
                            style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                minWidth: '360px', 
                                height: '38px',
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: '12px',
                                paddingLeft: '16px',
                                paddingRight: '16px',
                                boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.04)',
                                transition: 'all 0.2s ease-in-out',
                                cursor: 'text'
                            }}
                            onFocusCapture={(e) => {
                                e.currentTarget.style.border = '1px solid var(--color-accent, #10b981)';
                                e.currentTarget.style.background = '#ffffff';
                                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.15)';
                            }}
                            onBlurCapture={(e) => {
                                e.currentTarget.style.border = '1px solid #cbd5e1';
                                e.currentTarget.style.background = '#f1f5f9';
                                e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(15, 23, 42, 0.04)';
                            }}
                        >
                            <Search size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
                            <input
                                type="text"
                                placeholder={
                                    activeTab === 'payments' 
                                        ? "Search bill no, loan no, customer..." 
                                        : activeTab === 'docCharges' 
                                            ? "Search loan no, customer..."
                                            : "Search category, tags, desc..."
                                }
                                style={{ 
                                    width: '100%',
                                    border: 'none',
                                    outline: 'none',
                                    background: 'transparent',
                                    fontSize: '14px',
                                    color: '#1e293b',
                                    padding: '0'
                                }}
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setPaymentPage(1);
                                    setLoanPage(1);
                                    setExpensePage(1);
                                }}
                            />
                        </div>

                        {/* Quick Select Buttons - Smaller & aligned to right */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {[
                                { key: 'all', label: 'All Time' },
                                { key: 'today', label: 'Today' },
                                { key: 'week', label: 'This Week' },
                                { key: 'month', label: 'This Month' },
                                { key: 'custom', label: 'Custom Range' }
                            ].map(b => (
                                <button
                                    key={b.key}
                                    className={`quick-date-btn ${dateFilter === b.key ? 'active' : ''}`}
                                    onClick={() => {
                                        setDateFilter(b.key);
                                        setPaymentPage(1);
                                        setLoanPage(1);
                                        setExpensePage(1);
                                    }}
                                    style={{
                                        padding: '6px 12px',
                                        fontSize: '12px',
                                        borderRadius: '10px',
                                        transition: 'all 0.2s ease',
                                        fontWeight: 500
                                    }}
                                >
                                    {b.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom Date Inputs (only when Custom is selected) */}
                    {dateFilter === 'custom' && (
                        <div className="form-row animate-fade-in" style={{ marginTop: '0', gap: '16px', justifyContent: 'flex-end' }}>
                            <div className="form-group" style={{ maxWidth: 180 }}>
                                <label className="form-label text-xs font-semibold text-slate-500">From Date</label>
                                <input
                                    className="form-input"
                                    type="date"
                                    value={customFrom}
                                    onChange={(e) => {
                                        setCustomFrom(e.target.value);
                                        setPaymentPage(1);
                                        setLoanPage(1);
                                        setExpensePage(1);
                                    }}
                                    style={{ borderRadius: '10px', border: '1px solid var(--slate-200)', height: '34px', fontSize: '13px' }}
                                />
                            </div>
                            <div className="form-group" style={{ maxWidth: 180 }}>
                                <label className="form-label text-xs font-semibold text-slate-500">To Date</label>
                                <input
                                    className="form-input"
                                    type="date"
                                    value={customTo}
                                    onChange={(e) => {
                                        setCustomTo(e.target.value);
                                        setPaymentPage(1);
                                        setLoanPage(1);
                                        setExpensePage(1);
                                    }}
                                    style={{ borderRadius: '10px', border: '1px solid var(--slate-200)', height: '34px', fontSize: '13px' }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            {activeTab !== 'expenses' && (
                <div className="cmd-grid-3" style={{ marginBottom: 'var(--space-6)' }}>
                    {activeTab === 'payments' ? (
                        <>
                            <div className="progress-card">
                                <div className="progress-card__icon-circle progress-card__icon-circle--emerald">
                                    <Wallet size={24} />
                                </div>
                                <div className="progress-card__body">
                                    <span className="progress-card__title">Total Collected</span>
                                    <div className="progress-card__values">
                                        <span className="progress-card__actual" style={{ color: 'var(--color-success)' }}>
                                            {fmt(totals.totalAmount)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="progress-card">
                                <div className="progress-card__icon-circle progress-card__icon-circle--blue">
                                    <TrendingUp size={24} />
                                </div>
                                <div className="progress-card__body">
                                    <span className="progress-card__title">Principal Portion</span>
                                    <div className="progress-card__values">
                                        <span className="progress-card__actual" style={{ color: 'var(--slate-900)' }}>
                                            {fmt(totals.totalPrincipal)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="progress-card">
                                <div className="progress-card__icon-circle progress-card__icon-circle--amber">
                                    <TrendingUp size={24} />
                                </div>
                                <div className="progress-card__body">
                                    <span className="progress-card__title">Interest Portion</span>
                                    <div className="progress-card__values">
                                        <span className="progress-card__actual" style={{ color: 'var(--color-warning)' }}>
                                            {fmt(totals.totalInterest)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="progress-card">
                                <div className="progress-card__icon-circle progress-card__icon-circle--emerald">
                                    <Receipt size={24} />
                                </div>
                                <div className="progress-card__body">
                                    <span className="progress-card__title">Document Charges Collected</span>
                                    <div className="progress-card__values">
                                        <span className="progress-card__actual" style={{ color: 'var(--color-success)' }}>
                                            {fmt(totals.totalDocCharges)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="progress-card">
                                <div className="progress-card__icon-circle progress-card__icon-circle--blue">
                                    <Landmark size={24} />
                                </div>
                                <div className="progress-card__body">
                                    <span className="progress-card__title">Total Loans Issued</span>
                                    <div className="progress-card__values">
                                        <span className="progress-card__actual" style={{ color: 'var(--slate-900)' }}>
                                            {fmt(totals.totalLoanAmount)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="progress-card">
                                <div className="progress-card__icon-circle progress-card__icon-circle--slate">
                                    <Hash size={24} />
                                </div>
                                <div className="progress-card__body">
                                    <span className="progress-card__title">Total Loans Count</span>
                                    <div className="progress-card__values">
                                        <span className="progress-card__actual" style={{ color: 'var(--slate-700)' }}>
                                            {filteredLoans.length} Loans
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Content Tables */}
            {activeTab === 'payments' ? (
                <div className="card p-0" style={{ overflow: 'hidden', border: '1px solid var(--slate-200)' }}>
                    <div className="table-container p-0 border-0 shadow-none">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    <th className="px-6 py-4 text-left">Date</th>
                                    <th className="px-6 py-4 text-left">Bill No</th>
                                    <th className="px-6 py-4 text-left">Loan No</th>
                                    <th className="px-6 py-4 text-left">Customer</th>
                                    <th className="px-6 py-4 text-center">Principal Paid</th>
                                    <th className="px-6 py-4 text-center">Interest Paid</th>
                                    <th className="px-6 py-4 text-center">Total Paid</th>
                                    <th className="px-6 py-4 text-center">Collected By</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pagedPayments.length === 0 ? (
                                    <tr>
                                        <td colSpan={8}>
                                            <div className="empty-state-inline" style={{ padding: 'var(--space-8) 0' }}>
                                                <div className="empty-icon" style={{ display: 'inline-flex', padding: '12px', background: 'var(--slate-100)', borderRadius: '50%', color: 'var(--slate-400)', marginBottom: '12px' }}>
                                                    <Wallet size={24} />
                                                </div>
                                                <div className="empty-title" style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: '15px' }}>No payments found</div>
                                                <div className="empty-desc" style={{ color: 'var(--slate-500)', fontSize: '13px' }}>
                                                    No payments received for this selected criteria.
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    pagedPayments.map((p) => {
                                        const { principalPaid, interestPaid } = getBreakdown(p);
                                        const billNo = p.receipts?.[0]?.receiptNumber || '—';
                                        return (
                                            <tr key={p.id} className="hover-table-row">
                                                <td className="px-6 py-4 text-left text-slate-500 font-medium">{formatDate(p.paymentDate)}</td>
                                                <td className="px-6 py-4 text-left">
                                                    <span className="text-slate-700 font-mono text-xs">{billNo}</span>
                                                </td>
                                                <td className="px-6 py-4 text-left">
                                                    <span className="text-slate-900 font-semibold">{p.loanId?.slice(0, 8).toUpperCase()}</span>
                                                </td>
                                                <td className="px-6 py-4 text-left">
                                                    <span className="text-slate-900 font-semibold">{p.loan?.customer?.name || '—'}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-slate-900 font-bold">{fmtShort(principalPaid)}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-emerald-600 font-bold">{fmtShort(interestPaid)}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-slate-900 font-extrabold">{fmtShort(p.amount)}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
                                                        {p.creator?.name || 'System'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {filteredPayments.length > 0 && (
                        <div className="table-pagination" style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--slate-100)' }}>
                            <div className="pagination-info text-sm text-slate-500 font-medium">
                                Showing {startIdx} to {endIdx} of {filteredPayments.length} entries
                            </div>
                            <div className="pagination-btns flex gap-1">
                                <button
                                    disabled={paymentPage === 1}
                                    onClick={() => setPaymentPage(paymentPage - 1)}
                                    className="btn btn-sm btn-secondary"
                                    style={{ padding: '4px 10px' }}
                                >
                                    <ChevronLeft size={14} /> Prev
                                </button>
                                {[...Array(totalPaymentPages)].map((_, i) => (
                                    <button
                                        key={i + 1}
                                        className={`btn btn-sm ${paymentPage === i + 1 ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setPaymentPage(i + 1)}
                                        style={{ minWidth: '32px', padding: '4px' }}
                                    >
                                        {i + 1}
                                    </button>
                                )).slice(0, 5)}
                                <button
                                    disabled={paymentPage >= totalPaymentPages}
                                    onClick={() => setPaymentPage(paymentPage + 1)}
                                    className="btn btn-sm btn-secondary"
                                    style={{ padding: '4px 10px' }}
                                >
                                    Next <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : activeTab === 'docCharges' ? (
                <div className="card p-0" style={{ overflow: 'hidden', border: '1px solid var(--slate-200)' }}>
                    <div className="table-container p-0 border-0 shadow-none">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    <th className="px-6 py-4 text-left">Date Disbursed</th>
                                    <th className="px-6 py-4 text-left">Loan No</th>
                                    <th className="px-6 py-4 text-left">Customer</th>
                                    <th className="px-6 py-4 text-center">Principal Amount</th>
                                    <th className="px-6 py-4 text-center">Document Charges (5%)</th>
                                    <th className="px-6 py-4 text-center">Disbursed By</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pagedLoans.length === 0 ? (
                                    <tr>
                                        <td colSpan={6}>
                                            <div className="empty-state-inline" style={{ padding: 'var(--space-8) 0' }}>
                                                <div className="empty-icon" style={{ display: 'inline-flex', padding: '12px', background: 'var(--slate-100)', borderRadius: '50%', color: 'var(--slate-400)', marginBottom: '12px' }}>
                                                    <Receipt size={24} />
                                                </div>
                                                <div className="empty-title" style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: '15px' }}>No document fees found</div>
                                                <div className="empty-desc" style={{ color: 'var(--slate-500)', fontSize: '13px' }}>
                                                    No loans disbursed for this selected criteria.
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    pagedLoans.map((l) => (
                                        <tr key={l.id} className="hover-table-row">
                                            <td className="px-6 py-4 text-left text-slate-500 font-medium">{formatDate(l.startDate)}</td>
                                            <td className="px-6 py-4 text-left">
                                                <span className="text-slate-900 font-semibold">{l.id?.slice(0, 8).toUpperCase()}</span>
                                            </td>
                                            <td className="px-6 py-4 text-left">
                                                <span className="text-slate-900 font-semibold">{l.customer?.name || '—'}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-slate-900 font-bold">{fmtShort(Number(l.principalAmount))}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-emerald-600 font-extrabold">{fmtShort(Number(l.documentFee))}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
                                                    {l.assignedStaff?.name || 'Admin'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {filteredLoans.length > 0 && (
                        <div className="table-pagination" style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--slate-100)' }}>
                            <div className="pagination-info text-sm text-slate-500 font-medium">
                                Showing {(loanPage - 1) * PAGE_SIZE + 1} to {Math.min(loanPage * PAGE_SIZE, filteredLoans.length)} of {filteredLoans.length} entries
                            </div>
                            <div className="pagination-btns flex gap-1">
                                <button
                                    disabled={loanPage === 1}
                                    onClick={() => setLoanPage(loanPage - 1)}
                                    className="btn btn-sm btn-secondary"
                                    style={{ padding: '4px 10px' }}
                                >
                                    <ChevronLeft size={14} /> Prev
                                </button>
                                {[...Array(totalLoanPages)].map((_, i) => (
                                    <button
                                        key={i + 1}
                                        className={`btn btn-sm ${loanPage === i + 1 ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setLoanPage(i + 1)}
                                        style={{ minWidth: '32px', padding: '4px' }}
                                    >
                                        {i + 1}
                                    </button>
                                )).slice(0, 5)}
                                <button
                                    disabled={loanPage >= totalLoanPages}
                                    onClick={() => setLoanPage(loanPage + 1)}
                                    className="btn btn-sm btn-secondary"
                                    style={{ padding: '4px 10px' }}
                                >
                                    Next <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="card p-0" style={{ overflow: 'hidden', border: '1px solid var(--slate-200)' }}>
                    <div className="table-container p-0 border-0 shadow-none">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    <th className="px-6 py-4 text-left">Date</th>
                                    <th className="px-6 py-4 text-left">Category</th>
                                    <th className="px-6 py-4 text-left">Description</th>
                                    <th className="px-6 py-4 text-center">Amount</th>
                                    <th className="px-6 py-4 text-center">Recorded By</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pagedExpenses.length === 0 ? (
                                    <tr>
                                        <td colSpan={5}>
                                            <div className="empty-state-inline" style={{ padding: 'var(--space-8) 0' }}>
                                                <div className="empty-icon" style={{ display: 'inline-flex', padding: '12px', background: 'var(--slate-100)', borderRadius: '50%', color: 'var(--slate-400)', marginBottom: '12px' }}>
                                                    <ArrowDownCircle size={24} />
                                                </div>
                                                <div className="empty-title" style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: '15px' }}>No expenses found</div>
                                                <div className="empty-desc" style={{ color: 'var(--slate-500)', fontSize: '13px' }}>
                                                    No expenses recorded for this selected criteria.
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    pagedExpenses.map((e) => (
                                        <tr key={e.id} className="hover-table-row">
                                            <td className="px-6 py-4 text-left text-slate-500 font-medium">{formatDate(e.expenseDate)}</td>
                                            <td className="px-6 py-4 text-left">
                                                <span className="text-slate-900 font-semibold" style={{ textTransform: 'capitalize' }}>{e.category}</span>
                                            </td>
                                            <td className="px-6 py-4 text-left text-slate-600">{e.description || '—'}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-slate-900 font-extrabold" style={{ color: 'rgb(239, 68, 68)' }}>{fmtShort(Number(e.amount))}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
                                                    {e.creator?.name || 'System'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {filteredExpenses.length > 0 && (
                        <div className="table-pagination" style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--slate-100)' }}>
                            <div className="pagination-info text-sm text-slate-500 font-medium">
                                Showing {(expensePage - 1) * PAGE_SIZE + 1} to {Math.min(expensePage * PAGE_SIZE, filteredExpenses.length)} of {filteredExpenses.length} entries
                            </div>
                            <div className="pagination-btns flex gap-1">
                                <button
                                    disabled={expensePage === 1}
                                    onClick={() => setExpensePage(expensePage - 1)}
                                    className="btn btn-sm btn-secondary"
                                    style={{ padding: '4px 10px' }}
                                >
                                    <ChevronLeft size={14} /> Prev
                                </button>
                                {[...Array(totalExpensePages)].map((_, i) => (
                                    <button
                                        key={i + 1}
                                        className={`btn btn-sm ${expensePage === i + 1 ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setExpensePage(i + 1)}
                                        style={{ minWidth: '32px', padding: '4px' }}
                                    >
                                        {i + 1}
                                    </button>
                                )).slice(0, 5)}
                                <button
                                    disabled={expensePage >= totalExpensePages}
                                    onClick={() => setExpensePage(expensePage + 1)}
                                    className="btn btn-sm btn-secondary"
                                    style={{ padding: '4px 10px' }}
                                >
                                    Next <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Add Expense Modal */}
            {showExpenseModal && (
                <div 
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.6)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 999,
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                >
                    <div 
                        style={{
                            background: '#ffffff',
                            width: '100%',
                            maxWidth: '480px',
                            borderRadius: '16px',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            padding: 'var(--space-6)',
                            position: 'relative'
                        }}
                    >
                        {/* Close button */}
                        <button 
                            onClick={() => setShowExpenseModal(false)}
                            style={{
                                position: 'absolute',
                                top: '16px',
                                right: '16px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#94a3b8'
                            }}
                        >
                            <X size={20} />
                        </button>

                        <h3 style={{ fontWeight: 600, fontSize: '18px', color: '#1e293b', marginBottom: '4px' }}>Add Expense</h3>
                        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: 'var(--space-5)' }}>Record a new business expense</p>

                        {modalError && (
                            <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', color: 'rgb(239, 68, 68)', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', fontWeight: 500 }}>
                                {modalError}
                            </div>
                        )}

                        <form onSubmit={handleAddExpenseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Amount */}
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>Amount (₹)</label>
                                <input 
                                    type="number" 
                                    className="form-input"
                                    placeholder="Enter amount"
                                    value={expenseAmount}
                                    onChange={(e) => setExpenseAmount(e.target.value)}
                                    required
                                    style={{ borderRadius: '8px' }}
                                />
                            </div>

                            {/* Category Dropdown */}
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>Category</label>
                                <select 
                                    className="form-input"
                                    value={expenseCategory}
                                    onChange={(e) => setExpenseCategory(e.target.value)}
                                    style={{ borderRadius: '8px', background: '#fff', textTransform: 'capitalize' }}
                                >
                                    <option value="rent">Rent</option>
                                    <option value="salary">Salary</option>
                                    <option value="utilities">Utilities (Bills)</option>
                                    <option value="office">Office Supplies</option>
                                    <option value="marketing">Marketing</option>
                                    <option value="others">Others</option>
                                </select>
                            </div>



                            {/* Date */}
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>Expense Date</label>
                                <input 
                                    type="date" 
                                    className="form-input"
                                    value={expenseDate}
                                    onChange={(e) => setExpenseDate(e.target.value)}
                                    style={{ borderRadius: '8px' }}
                                />
                            </div>

                            {/* Description */}
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>Description</label>
                                <input 
                                    type="text" 
                                    className="form-input"
                                    placeholder="Rent for MG Road office..."
                                    value={expenseDesc}
                                    onChange={(e) => setExpenseDesc(e.target.value)}
                                    style={{ borderRadius: '8px' }}
                                />
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '12px', marginTop: 'var(--space-4)' }}>
                                <button 
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowExpenseModal(false)}
                                    style={{ flex: 1, borderRadius: '10px' }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={submittingExpense}
                                    style={{ flex: 1, borderRadius: '10px' }}
                                >
                                    {submittingExpense ? 'Adding...' : 'Add Expense'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

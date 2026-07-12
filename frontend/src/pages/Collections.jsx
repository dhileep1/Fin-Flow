import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/client';
import { Wallet, Calendar, User, Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Settings, Hash, TrendingUp, Landmark, Receipt, ArrowDownCircle, PlusCircle, X, Coins } from 'lucide-react';

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
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'payments' | 'docCharges' | 'loans' | 'expenses'
    const [dateFilter, setDateFilter] = useState('month'); // 'today' | 'week' | 'month' | 'year' | 'custom'
    const [aggregationLevel, setAggregationLevel] = useState('day'); // 'day' | 'week' | 'month' | 'year'
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedDates, setExpandedDates] = useState({}); // Stores expanded keys: e.g. "year-2026", "month-2026-07"
    const [openingCashInHand, setOpeningCashInHand] = useState(1000000);

    const [showLedgerSettings, setShowLedgerSettings] = useState(false);
    
    // Pagination states
    const [allPage, setAllPage] = useState(1);
    const [paymentPage, setPaymentPage] = useState(1);
    const [loanPage, setLoanPage] = useState(1);
    const [loansGivenPage, setLoansGivenPage] = useState(1);
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
            const [paymentsData, loansData, expensesData, orgData] = await Promise.all([
                api.getPayments(),
                api.getLoans('limit=1000'),
                api.getExpenses(),
                api.getOrgSettings()
            ]);
            setPayments(paymentsData || []);
            setLoans(loansData?.loans || []);
            setExpenses(expensesData || []);
            if (orgData?.settings?.startingCash !== undefined) {
                setOpeningCashInHand(Number(orgData.settings.startingCash));
            }
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

    // Helper to filter items based on dateFilter selection
    const getFilteredTransactions = (items, dateKeyExtractor) => {
        const today = new Date();
        return items.filter(item => {
            const dateVal = dateKeyExtractor(item);
            if (!dateVal) return false;
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return false;

            if (dateFilter === 'today') {
                const start = new Date(today);
                start.setHours(0, 0, 0, 0);
                const end = new Date(today);
                end.setHours(23, 59, 59, 999);
                return d >= start && d <= end;
            }
            if (dateFilter === 'week') {
                const start = new Date(today);
                start.setDate(today.getDate() - 7);
                start.setHours(0, 0, 0, 0);
                const end = new Date(today);
                end.setHours(23, 59, 59, 999);
                return d >= start && d <= end;
            }
            if (dateFilter === 'month') {
                return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
            }
            if (dateFilter === 'year') {
                return d.getFullYear() === today.getFullYear();
            }
            if (dateFilter === 'custom') {
                if (!customFrom || !customTo) return true;
                const start = new Date(customFrom);
                start.setHours(0, 0, 0, 0);
                const end = new Date(customTo);
                end.setHours(23, 59, 59, 999);
                return d >= start && d <= end;
            }
            return true;
        });
    };

    // Filter payments based on date selection
    const dateFilteredPayments = useMemo(() => {
        return getFilteredTransactions(payments, p => p.paymentDate);
    }, [payments, dateFilter, customFrom, customTo]);

    // Filter loans (for document charges) based on date selection
    const dateFilteredLoans = useMemo(() => {
        return getFilteredTransactions(loans, l => l.startDate);
    }, [loans, dateFilter, customFrom, customTo]);

    // Filter expenses based on date selection
    const dateFilteredExpenses = useMemo(() => {
        return getFilteredTransactions(expenses, e => e.expenseDate);
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

    // Helpers to parse date values locally
    const getLocalDateString = (dateVal) => {
        if (!dateVal) return '';
        try {
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return '';
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch {
            return '';
        }
    };

    const getLocalMonthString = (dateVal) => {
        if (!dateVal) return '';
        try {
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return '';
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            return `${year}-${month}`;
        } catch {
            return '';
        }
    };

    const getLocalYearString = (dateVal) => {
        if (!dateVal) return '';
        try {
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return '';
            return String(d.getFullYear());
        } catch {
            return '';
        }
    };

    const getLocalWeekString = (dateVal) => {
        if (!dateVal) return '';
        try {
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return '';
            const target = new Date(d.valueOf());
            const dayNr = (d.getDay() + 6) % 7;
            target.setDate(target.getDate() - dayNr + 3);
            const firstThursday = target.valueOf();
            target.setMonth(0, 1);
            if (target.getDay() !== 4) {
                target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
            }
            const weekNum = 1 + Math.ceil((firstThursday - target) / 604800000);
            return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
        } catch {
            return '';
        }
    };

    // Helper to get formatted date aggregation key
    const getGroupKey = (dateVal, level) => {
        if (level === 'year') return getLocalYearString(dateVal);
        if (level === 'month') return getLocalMonthString(dateVal);
        if (level === 'week') return getLocalWeekString(dateVal);
        return getLocalDateString(dateVal);
    };

    // Build hierarchical trees dynamically and calculate correct opening/closing balance
    const buildGroupNode = (key, rawPayments, rawLoans, rawExpenses) => {
        const node = {
            date: key,
            payments: rawPayments,
            loans: rawLoans,
            expenses: rawExpenses,
            collection: 0,
            docCharges: 0,
            expensesAmt: 0,
            given: 0,
            inflow: 0,
            outflow: 0,
            tally: 0
        };
        rawPayments.forEach(p => { node.collection += Number(p.amount || 0); });
        rawLoans.forEach(l => {
            node.docCharges += Number(l.documentFee || 0);
            node.given += Number(l.principalAmount || 0);
        });
        rawExpenses.forEach(e => { node.expensesAmt += Number(e.amount || 0); });
        node.inflow = node.collection + node.docCharges;
        node.outflow = node.expensesAmt + node.given;
        node.tally = node.inflow - node.outflow;
        return node;
    };

    // Group all filtered transactions at selected top aggregation level
    const allDateGroups = useMemo(() => {
        const groups = {};

        filteredPayments.forEach(p => {
            const key = getGroupKey(p.paymentDate, aggregationLevel);
            if (!key) return;
            if (!groups[key]) groups[key] = { payments: [], loans: [], expenses: [] };
            groups[key].payments.push(p);
        });

        filteredLoans.forEach(l => {
            const key = getGroupKey(l.startDate, aggregationLevel);
            if (!key) return;
            if (!groups[key]) groups[key] = { payments: [], loans: [], expenses: [] };
            groups[key].loans.push(l);
        });

        filteredExpenses.forEach(e => {
            const key = getGroupKey(e.expenseDate, aggregationLevel);
            if (!key) return;
            if (!groups[key]) groups[key] = { payments: [], loans: [], expenses: [] };
            groups[key].expenses.push(e);
        });

        const list = Object.keys(groups).map(key => {
            return buildGroupNode(key, groups[key].payments, groups[key].loans, groups[key].expenses);
        });

        // Sort ascending chronologically to compute running balance
        const sorted = list.sort((a, b) => {
            if (aggregationLevel === 'week') {
                return a.date.localeCompare(b.date);
            }
            return new Date(a.date) - new Date(b.date);
        });

        let running = Number(openingCashInHand || 0);
        sorted.forEach(g => {
            g.openingBalance = running;
            g.closingBalance = running + g.tally;
            running = g.closingBalance;
        });

        return sorted.reverse();
    }, [filteredPayments, filteredLoans, filteredExpenses, aggregationLevel, openingCashInHand]);

    // Apply date range filters to date groups for display
    const filteredDateGroups = useMemo(() => {
        return allDateGroups;
    }, [allDateGroups]);

    const getDetailedTxListForDate = (group) => {
        const list = [];
        group.payments.forEach(p => {
            list.push({
                id: `p-${p.id}`,
                time: p.paymentDate ? new Date(p.paymentDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—',
                type: 'Payment Received',
                typeClass: 'border-emerald-500 text-emerald-700 bg-emerald-50',
                title: 'EMI Payment',
                details: `Bill #${p.receipts?.[0]?.receiptNumber || '—'} (Loan #${p.loanId?.slice(0, 8).toUpperCase()})`,
                customer: p.loan?.customer?.name || '—',
                inflow: Number(p.amount),
                outflow: 0,
                creator: p.creator?.name || 'System'
            });
        });
        group.loans.forEach(l => {
            list.push({
                id: `l-doc-${l.id}`,
                time: l.startDate ? new Date(l.startDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—',
                type: 'Doc Charge',
                typeClass: 'border-blue-500 text-blue-700 bg-blue-50',
                title: 'Document Fee',
                details: `Doc Fee (Loan #${l.id?.slice(0, 8).toUpperCase()})`,
                customer: l.customer?.name || '—',
                inflow: Number(l.documentFee),
                outflow: 0,
                creator: l.assignedStaff?.name || 'Admin'
            });
            list.push({
                id: `l-principal-${l.id}`,
                time: l.startDate ? new Date(l.startDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—',
                type: 'Loan Disbursed',
                typeClass: 'border-amber-500 text-amber-700 bg-amber-50',
                title: 'Loan Disbursed',
                details: `Principal Disbursed (Loan #${l.id?.slice(0, 8).toUpperCase()})`,
                customer: l.customer?.name || '—',
                inflow: 0,
                outflow: Number(l.principalAmount),
                creator: l.assignedStaff?.name || 'Admin'
            });
        });
        group.expenses.forEach(e => {
            list.push({
                id: `e-${e.id}`,
                time: e.expenseDate ? new Date(e.expenseDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—',
                type: 'Expense',
                typeClass: 'border-red-500 text-red-700 bg-red-50',
                title: `Expense: ${e.category}`,
                details: e.description || '—',
                customer: '—',
                inflow: 0,
                outflow: Number(e.amount),
                creator: e.creator?.name || 'System'
            });
        });
        return list.sort((a, b) => b.inflow - a.inflow || b.outflow - a.outflow);
    };

    // Paginate filtered all transactions (date groups)
    const pagedDateGroups = useMemo(() => {
        const start = (allPage - 1) * PAGE_SIZE;
        return filteredDateGroups.slice(start, start + PAGE_SIZE);
    }, [filteredDateGroups, allPage]);

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

    // Paginate filtered loans given
    const pagedLoansGiven = useMemo(() => {
        const start = (loansGivenPage - 1) * PAGE_SIZE;
        return filteredLoans.slice(start, start + PAGE_SIZE);
    }, [filteredLoans, loansGivenPage]);

    // Paginate filtered expenses
    const pagedExpenses = useMemo(() => {
        const start = (expensePage - 1) * PAGE_SIZE;
        return filteredExpenses.slice(start, start + PAGE_SIZE);
    }, [filteredExpenses, expensePage]);

    const totalAllPages = Math.max(1, Math.ceil(filteredDateGroups.length / PAGE_SIZE));
    const totalPaymentPages = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE));
    const totalLoanPages = Math.max(1, Math.ceil(filteredLoans.length / PAGE_SIZE));
    const totalLoansGivenPages = Math.max(1, Math.ceil(filteredLoans.length / PAGE_SIZE));
    const totalExpensePages = Math.max(1, Math.ceil(filteredExpenses.length / PAGE_SIZE));

    // Filter date groups so we only display periods with relevant data for specific tabs
    const tabGroups = useMemo(() => {
        return allDateGroups.filter(g => {
            if (activeTab === 'all') return true;
            if (activeTab === 'payments') return g.payments.length > 0;
            if (activeTab === 'docCharges') return g.loans.some(l => Number(l.documentFee) > 0);
            if (activeTab === 'loans') return g.loans.length > 0;
            if (activeTab === 'expenses') return g.expenses.length > 0;
            return false;
        });
    }, [allDateGroups, activeTab]);

    // Paginate tab-specific groups
    const pagedTabGroups = useMemo(() => {
        let page = 1;
        if (activeTab === 'all') page = allPage;
        else if (activeTab === 'payments') page = paymentPage;
        else if (activeTab === 'docCharges') page = loanPage;
        else if (activeTab === 'loans') page = loansGivenPage;
        else if (activeTab === 'expenses') page = expensePage;

        const start = (page - 1) * PAGE_SIZE;
        return tabGroups.slice(start, start + PAGE_SIZE);
    }, [tabGroups, activeTab, allPage, paymentPage, loanPage, loansGivenPage, expensePage]);

    const totalTabGroupPages = Math.max(1, Math.ceil(tabGroups.length / PAGE_SIZE));

    const startIdx = useMemo(() => {
        let page = 1;
        if (activeTab === 'all') page = allPage;
        else if (activeTab === 'payments') page = paymentPage;
        else if (activeTab === 'docCharges') page = loanPage;
        else if (activeTab === 'loans') page = loansGivenPage;
        else if (activeTab === 'expenses') page = expensePage;
        return (page - 1) * PAGE_SIZE + 1;
    }, [activeTab, allPage, paymentPage, loanPage, loansGivenPage, expensePage]);

    const endIdx = useMemo(() => {
        let page = 1;
        let totalCount = 0;
        if (activeTab === 'all') { page = allPage; totalCount = filteredDateGroups.length; }
        else if (activeTab === 'payments') { page = paymentPage; totalCount = tabGroups.length; }
        else if (activeTab === 'docCharges') { page = loanPage; totalCount = tabGroups.length; }
        else if (activeTab === 'loans') { page = loansGivenPage; totalCount = tabGroups.length; }
        else if (activeTab === 'expenses') { page = expensePage; totalCount = tabGroups.length; }
        return Math.min(page * PAGE_SIZE, totalCount);
    }, [activeTab, allPage, paymentPage, loanPage, loansGivenPage, expensePage, filteredDateGroups, tabGroups]);

    // Sub-table and formatting helpers for grouped expansion views
    const renderGroupLabel = (key) => {
        if (aggregationLevel === 'year') {
            return key;
        }
        if (aggregationLevel === 'month') {
            const [year, monthStr] = key.split('-');
            const date = new Date(Number(year), Number(monthStr) - 1, 1);
            return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        }
        if (aggregationLevel === 'week') {
            return `Week ${key.split('-W')[1]} (${key.split('-W')[0]})`;
        }
        return formatDate(key);
    };

    const renderPaymentsSubTable = (list) => (
        <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-sm" style={{ margin: '4px 0 12px 0' }}>
            <table className="w-full text-xs">
                <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                        <th className="px-4 py-2.5 text-left">Date</th>
                        <th className="px-4 py-2.5 text-left">Bill No</th>
                        <th className="px-4 py-2.5 text-left">Loan No</th>
                        <th className="px-4 py-2.5 text-left">Customer</th>
                        <th className="px-4 py-2.5 text-center">Principal Paid</th>
                        <th className="px-4 py-2.5 text-center">Interest Paid</th>
                        <th className="px-4 py-2.5 text-center">Total Paid</th>
                        <th className="px-4 py-2.5 text-center">Collected By</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {list.map(p => {
                        const { principalPaid, interestPaid } = getBreakdown(p);
                        const billNo = p.receipts?.[0]?.receiptNumber || '—';
                        return (
                            <tr key={p.id} className="hover:bg-slate-50/50">
                                <td className="px-4 py-3 text-slate-500 font-medium">{formatDate(p.paymentDate)}</td>
                                <td className="px-4 py-3"><span className="text-slate-700 font-mono text-[10px]">{billNo}</span></td>
                                <td className="px-4 py-3"><span className="text-slate-900 font-semibold">{p.loanId?.slice(0, 8).toUpperCase()}</span></td>
                                <td className="px-4 py-3 text-slate-900 font-semibold">{p.loan?.customer?.name || '—'}</td>
                                <td className="px-4 py-3 text-center text-slate-900 font-bold">{fmtShort(principalPaid)}</td>
                                <td className="px-4 py-3 text-center text-emerald-600 font-bold">{fmtShort(interestPaid)}</td>
                                <td className="px-4 py-3 text-center text-slate-900 font-extrabold">{fmtShort(p.amount)}</td>
                                <td className="px-4 py-3 text-center">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                                        {p.creator?.name || 'System'}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    const renderDocChargesSubTable = (list) => (
        <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-sm" style={{ margin: '4px 0 12px 0' }}>
            <table className="w-full text-xs">
                <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                        <th className="px-4 py-2.5 text-left">Date Disbursed</th>
                        <th className="px-4 py-2.5 text-left">Loan No</th>
                        <th className="px-4 py-2.5 text-left">Customer</th>
                        <th className="px-4 py-2.5 text-center">Principal Amount</th>
                        <th className="px-4 py-2.5 text-center">Document Charges (5%)</th>
                        <th className="px-4 py-2.5 text-center">Disbursed By</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {list.map(l => (
                        <tr key={l.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-slate-500 font-medium">{formatDate(l.startDate)}</td>
                            <td className="px-4 py-3"><span className="text-slate-900 font-semibold">{l.id?.slice(0, 8).toUpperCase()}</span></td>
                            <td className="px-4 py-3 text-slate-900 font-semibold">{l.customer?.name || '—'}</td>
                            <td className="px-4 py-3 text-center text-slate-900 font-bold">{fmtShort(Number(l.principalAmount))}</td>
                            <td className="px-4 py-3 text-center text-emerald-600 font-extrabold">{fmtShort(Number(l.documentFee))}</td>
                            <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                                    {l.assignedStaff?.name || 'Admin'}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderLoansGivenSubTable = (list) => (
        <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-sm" style={{ margin: '4px 0 12px 0' }}>
            <table className="w-full text-xs">
                <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                        <th className="px-4 py-2.5 text-left">Date Disbursed</th>
                        <th className="px-4 py-2.5 text-left">Loan No</th>
                        <th className="px-4 py-2.5 text-left">Customer</th>
                        <th className="px-4 py-2.5 text-center">Principal Amount</th>
                        <th className="px-4 py-2.5 text-center">Disbursed By</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {list.map(l => (
                        <tr key={l.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-slate-500 font-medium">{formatDate(l.startDate)}</td>
                            <td className="px-4 py-3"><span className="text-slate-900 font-semibold">{l.id?.slice(0, 8).toUpperCase()}</span></td>
                            <td className="px-4 py-3 text-slate-900 font-semibold">{l.customer?.name || '—'}</td>
                            <td className="px-4 py-3 text-center text-slate-900 font-bold">{fmtShort(Number(l.principalAmount))}</td>
                            <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                                    {l.assignedStaff?.name || 'Admin'}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderExpensesSubTable = (list) => (
        <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-sm" style={{ margin: '4px 0 12px 0' }}>
            <table className="w-full text-xs">
                <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                        <th className="px-4 py-2.5 text-left">Date</th>
                        <th className="px-4 py-2.5 text-left">Category</th>
                        <th className="px-4 py-2.5 text-left">Description</th>
                        <th className="px-4 py-2.5 text-center">Amount</th>
                        <th className="px-4 py-2.5 text-center">Recorded By</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {list.map(e => (
                        <tr key={e.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-slate-500 font-medium">{formatDate(e.expenseDate)}</td>
                            <td className="px-4 py-3"><span className="text-slate-900 font-semibold" style={{ textTransform: 'capitalize' }}>{e.category}</span></td>
                            <td className="px-4 py-3 text-slate-700 font-medium">{e.description || '—'}</td>
                            <td className="px-4 py-3 text-center text-red-500 font-bold">{fmtShort(Number(e.amount))}</td>
                            <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                                    {e.creator?.name || 'System'}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

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
                        aria-selected={activeTab === 'all'}
                        className={`cmd-tab ${activeTab === 'all' ? 'cmd-tab--active' : ''}`}
                        onClick={() => setActiveTab('all')}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Landmark size={16} />
                        All Transactions
                    </button>
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
                        aria-selected={activeTab === 'loans'}
                        className={`cmd-tab ${activeTab === 'loans' ? 'cmd-tab--active' : ''}`}
                        onClick={() => setActiveTab('loans')}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Coins size={16} />
                        Loans Given
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

                {activeTab === 'loans' && (
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
                            <span style={{ color: '#ef4444', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>Total Loans Given:</span>
                            <span>{fmt(totals.totalLoanAmount)}</span>
                        </div>
                    </div>
                )}

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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                        
                        {/* Search field - Interactive Premium Border */}
                        <div 
                            style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                minWidth: '320px', 
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
                                    setAllPage(1);
                                    setPaymentPage(1);
                                    setLoanPage(1);
                                }}
                            />
                        </div>

                        {/* Filter Period - Aligned rightmost with evolving Custom Range input */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '12px' }}>Filter:</span>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
                                {[
                                    { key: 'all', label: 'All' },
                                    { key: 'today', label: 'Today' },
                                    { key: 'week', label: 'This Week' },
                                    { key: 'month', label: 'This Month' },
                                    { key: 'year', label: 'This Year' }
                                ].map(b => (
                                    <button
                                        key={b.key}
                                        className={`quick-date-btn`}
                                        onClick={() => {
                                            setDateFilter(b.key);
                                            if (b.key === 'today' || b.key === 'week') {
                                                setAggregationLevel('day');
                                            } else if (b.key === 'month' && aggregationLevel === 'year') {
                                                setAggregationLevel('month');
                                            }
                                            setExpandedDates({});
                                            setAllPage(1);
                                            setPaymentPage(1);
                                            setLoanPage(1);
                                            setExpensePage(1);
                                        }}
                                        style={{
                                            padding: '0 10px',
                                            fontSize: '11px',
                                            borderRadius: '8px',
                                            transition: 'all 0.2s ease',
                                            fontWeight: 600,
                                            backgroundColor: dateFilter === b.key ? 'var(--slate-900)' : '#ffffff',
                                            borderColor: dateFilter === b.key ? 'var(--slate-900)' : 'var(--color-border)',
                                            color: dateFilter === b.key ? '#ffffff' : 'var(--color-text-secondary)',
                                            marginTop: '7px',
                                            height: '24px'
                                        }}
                                    >
                                        {b.label}
                                    </button>
                                ))}

                                {/* Separation Divider / Spacer */}
                                <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--slate-200)', margin: '12px 8px 0 8px' }} />

                                {/* Custom range button that expands / evolves smoothly */}
                                <div 
                                    onClick={dateFilter !== 'custom' ? () => {
                                        setDateFilter('custom');
                                        setExpandedDates({});
                                        setAllPage(1);
                                        setPaymentPage(1);
                                        setLoanPage(1);
                                        setExpensePage(1);
                                    } : undefined}
                                    style={{
                                        position: 'relative',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0 8px',
                                        fontSize: '11px',
                                        borderRadius: '8px',
                                        border: dateFilter === 'custom' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--color-border)',
                                        backgroundColor: dateFilter === 'custom' ? 'var(--slate-900)' : '#ffffff',
                                        color: dateFilter === 'custom' ? '#ffffff' : 'var(--color-text-secondary)',
                                        fontWeight: 600,
                                        cursor: dateFilter === 'custom' ? 'default' : 'pointer',
                                        transition: 'max-width 0.4s cubic-bezier(0.25, 1, 0.5, 1), height 0.4s cubic-bezier(0.25, 1, 0.5, 1), background-color 0.3s ease, border-color 0.3s ease',
                                        maxWidth: dateFilter === 'custom' ? '180px' : '110px',
                                        height: dateFilter === 'custom' ? '54px' : '24px',
                                        overflow: 'hidden',
                                        boxSizing: 'border-box',
                                        whiteSpace: 'nowrap',
                                        margin: '7px 0 0 0'
                                    }}
                                    className={dateFilter !== 'custom' ? 'quick-date-btn' : ''}
                                >
                                    {/* Text State: Fades and slides out to the left */}
                                    <span style={{
                                        display: 'block',
                                        opacity: dateFilter === 'custom' ? 0 : 1,
                                        transform: dateFilter === 'custom' ? 'translateX(-20px)' : 'translateX(0)',
                                        transition: 'opacity 0.25s ease, transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
                                        pointerEvents: dateFilter === 'custom' ? 'none' : 'auto',
                                        position: dateFilter === 'custom' ? 'absolute' : 'static',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        Custom Range
                                    </span>

                                    {/* Inputs State: Fades and slides in from the right - stacked vertically */}
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '6px',
                                        opacity: dateFilter === 'custom' ? 1 : 0,
                                        transform: dateFilter === 'custom' ? 'translateX(0)' : 'translateX(20px)',
                                        transition: 'opacity 0.25s ease 0.1s, transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)',
                                        pointerEvents: dateFilter === 'custom' ? 'auto' : 'none',
                                        position: dateFilter === 'custom' ? 'static' : 'absolute'
                                    }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', fontWeight: 700, minWidth: '32px' }}>From</span>
                                                <input
                                                    type="date"
                                                    value={customFrom}
                                                    onChange={(e) => {
                                                        setCustomFrom(e.target.value);
                                                        setAllPage(1);
                                                        setPaymentPage(1);
                                                        setLoanPage(1);
                                                        setExpensePage(1);
                                                    }}
                                                    onClick={(e) => {
                                                        try { e.target.showPicker(); } catch (err) {}
                                                    }}
                                                    style={{
                                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                                        outline: 'none',
                                                        backgroundColor: 'rgba(255, 255, 255, 0.15)', // slightly lighter translucent background
                                                        borderRadius: '6px',
                                                        fontSize: '11px',
                                                        padding: '0 6px',
                                                        color: '#ffffff',
                                                        colorScheme: 'dark',
                                                        width: '108px',
                                                        height: '18px',
                                                        cursor: 'pointer'
                                                    }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', fontWeight: 700, minWidth: '32px' }}>To</span>
                                                <input
                                                    type="date"
                                                    value={customTo}
                                                    onChange={(e) => {
                                                        setCustomTo(e.target.value);
                                                        setAllPage(1);
                                                        setPaymentPage(1);
                                                        setLoanPage(1);
                                                        setExpensePage(1);
                                                    }}
                                                    onClick={(e) => {
                                                        try { e.target.showPicker(); } catch (err) {}
                                                    }}
                                                    style={{
                                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                                        outline: 'none',
                                                        backgroundColor: 'rgba(255, 255, 255, 0.15)', // slightly lighter translucent background
                                                        borderRadius: '6px',
                                                        fontSize: '11px',
                                                        padding: '0 6px',
                                                        color: '#ffffff',
                                                        colorScheme: 'dark',
                                                        width: '108px',
                                                        height: '18px',
                                                        cursor: 'pointer'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDateFilter('month'); // reset to Month
                                                setExpandedDates({});
                                                setAllPage(1);
                                                setPaymentPage(1);
                                                setLoanPage(1);
                                                setExpensePage(1);
                                            }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'rgba(255, 255, 255, 0.6)',
                                                cursor: 'pointer',
                                                padding: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                marginLeft: '2px',
                                                transition: 'color 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                                            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'}
                                            title="Clear custom range"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '12px' }}>
                {activeTab === 'all' ? (
                    <>
                        {/* Collections & Doc Charges (Green Group) */}
                        <div style={{
                            display: 'flex',
                            gap: '16px',
                            padding: '12px 16px',
                            backgroundColor: '#f0fdf4',
                            border: '2px solid #bbf7d0',
                            borderRadius: '12px',
                            gridColumn: 'span 2',
                            minWidth: '0'
                        }}>
                            <div className="progress-card" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0, flex: 1, minWidth: '0' }}>
                                <div className="progress-card__icon-circle progress-card__icon-circle--emerald" style={{ background: '#ffffff' }}>
                                    <Wallet size={20} />
                                </div>
                                <div className="progress-card__body">
                                    <span className="progress-card__title" style={{ color: '#166534' }}>Collections (EMI)</span>
                                    <div className="progress-card__values">
                                        <span className="progress-card__actual" style={{ color: '#15803d', fontSize: '18px' }}>
                                            {fmt(totals.totalAmount)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ width: '1px', alignSelf: 'stretch', backgroundColor: '#bbf7d0' }} />

                            <div className="progress-card" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0, flex: 1, minWidth: '0' }}>
                                <div className="progress-card__icon-circle progress-card__icon-circle--emerald" style={{ background: '#ffffff' }}>
                                    <Receipt size={20} />
                                </div>
                                <div className="progress-card__body">
                                    <span className="progress-card__title" style={{ color: '#166534' }}>Doc Charges</span>
                                    <div className="progress-card__values">
                                        <span className="progress-card__actual" style={{ color: '#15803d', fontSize: '18px' }}>
                                            {fmt(totals.totalDocCharges)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Outflows / Expenses & Principal Disbursed (Red/Rose Group) */}
                        <div style={{
                            display: 'flex',
                            gap: '16px',
                            padding: '12px 16px',
                            backgroundColor: '#fef2f2',
                            border: '2px solid #fecaca',
                            borderRadius: '12px',
                            gridColumn: 'span 2',
                            minWidth: '0'
                        }}>
                            <div className="progress-card" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0, flex: 1, minWidth: '0' }}>
                                <div className="progress-card__icon-circle progress-card__icon-circle--rose" style={{ background: '#ffffff', color: '#ef4444' }}>
                                    <ArrowDownCircle size={20} />
                                </div>
                                <div className="progress-card__body">
                                    <span className="progress-card__title" style={{ color: '#991b1b' }}>Expenses</span>
                                    <div className="progress-card__values">
                                        <span className="progress-card__actual" style={{ color: '#b91c1c', fontSize: '18px' }}>
                                            {fmt(totals.totalExpenseAmt)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ width: '1px', alignSelf: 'stretch', backgroundColor: '#fecaca' }} />

                            <div className="progress-card" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0, flex: 1, minWidth: '0' }}>
                                <div className="progress-card__icon-circle progress-card__icon-circle--rose" style={{ background: '#ffffff', color: '#ef4444' }}>
                                    <Landmark size={20} />
                                </div>
                                <div className="progress-card__body">
                                    <span className="progress-card__title" style={{ color: '#991b1b' }}>Principal Disbursed</span>
                                    <div className="progress-card__values">
                                        <span className="progress-card__actual" style={{ color: '#b91c1c', fontSize: '18px' }}>
                                            {fmt(totals.totalLoanAmount)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Net Cash Flow (Neutral Slate Group) */}
                        <div style={{
                            display: 'flex',
                            padding: '12px 16px',
                            backgroundColor: '#f8fafc',
                            border: '2px solid #cbd5e1',
                            borderRadius: '12px',
                            gridColumn: 'span 1',
                            minWidth: '0'
                        }}>
                            {(() => {
                                const netFlow = (totals.totalAmount + totals.totalDocCharges) - (totals.totalExpenseAmt + totals.totalLoanAmount);
                                const isPositive = netFlow >= 0;
                                return (
                                    <div className="progress-card" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0, flex: 1, minWidth: '0' }}>
                                        <div className="progress-card__icon-circle" style={{ background: '#ffffff', color: isPositive ? '#10b981' : '#ef4444' }}>
                                            <TrendingUp size={20} />
                                        </div>
                                        <div className="progress-card__body">
                                            <span className="progress-card__title" style={{ color: '#475569' }}>Net Cash Flow</span>
                                            <div className="progress-card__values">
                                                <span className="progress-card__actual" style={{ color: isPositive ? '#10b981' : '#ef4444', fontSize: '18px' }}>
                                                    {fmt(netFlow)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </>
                ) : activeTab === 'payments' ? (
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
                ) : activeTab === 'docCharges' ? (
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
                ) : (
                    <>
                        <div className="progress-card">
                            <div className="progress-card__icon-circle progress-card__icon-circle--rose" style={{ background: '#fef2f2', color: '#ef4444' }}>
                                <ArrowDownCircle size={24} />
                            </div>
                            <div className="progress-card__body">
                                <span className="progress-card__title">Total Expenses</span>
                                <div className="progress-card__values">
                                    <span className="progress-card__actual" style={{ color: '#ef4444' }}>
                                        {fmt(totals.totalExpenseAmt)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="progress-card">
                            <div className="progress-card__icon-circle progress-card__icon-circle--blue">
                                <Landmark size={24} />
                            </div>
                            <div className="progress-card__body">
                                <span className="progress-card__title">Rent Expenses</span>
                                <div className="progress-card__values">
                                    <span className="progress-card__actual" style={{ color: 'var(--slate-900)' }}>
                                        {fmt(totals.totalRentAmt)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="progress-card">
                            <div className="progress-card__icon-circle progress-card__icon-circle--amber">
                                <User size={24} />
                            </div>
                            <div className="progress-card__body">
                                <span className="progress-card__title">Salary Paid</span>
                                <div className="progress-card__values">
                                    <span className="progress-card__actual" style={{ color: 'var(--slate-900)' }}>
                                        {fmt(totals.totalSalaryAmt)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Content Tables */}
            <div className="card p-0" style={{ paddingTop: '10px', overflow: 'hidden', border: '1px solid var(--slate-200)' }}>
                {/* Group selector inside table card header - aligned rightmost */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '10px 20px', background: 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Group:</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {[
                                { key: 'day', label: 'Day', allowedFor: ['all', 'today', 'week', 'month', 'year', 'custom'] },
                                { key: 'week', label: 'Week', allowedFor: ['all', 'week', 'month', 'year', 'custom'] },
                                { key: 'month', label: 'Month', allowedFor: ['all', 'month', 'year', 'custom'] },
                                { key: 'year', label: 'Year', allowedFor: ['all', 'year', 'custom'] }
                            ].map(b => {
                                const isAllowed = b.allowedFor.includes(dateFilter);
                                return (
                                    <button
                                        key={b.key}
                                        disabled={!isAllowed}
                                        className={`quick-date-btn`}
                                        onClick={() => {
                                            setAggregationLevel(b.key);
                                            setExpandedDates({});
                                            setAllPage(1);
                                            setPaymentPage(1);
                                            setLoanPage(1);
                                            setLoansGivenPage(1);
                                            setExpensePage(1);
                                        }}
                                        style={{
                                            padding: '4px 10px',
                                            fontSize: '11px',
                                            borderRadius: '6px',
                                            transition: 'all 0.2s ease',
                                            fontWeight: 600,
                                            opacity: isAllowed ? 1 : 0.4,
                                            cursor: isAllowed ? 'pointer' : 'not-allowed',
                                            backgroundColor: aggregationLevel === b.key ? 'var(--slate-900)' : '#ffffff',
                                            borderColor: aggregationLevel === b.key ? 'var(--slate-900)' : 'var(--color-border)',
                                            color: aggregationLevel === b.key ? '#ffffff' : 'var(--color-text-secondary)'
                                        }}
                                        title={!isAllowed ? `Cannot aggregate by ${b.key} with ${dateFilter} filter active` : undefined}
                                    >
                                        {b.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {activeTab === 'all' ? (
                    <div className="table-container p-0 border-0 shadow-none">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    <th className="px-4 py-4 text-center" style={{ width: '60px' }}></th>
                                    <th className="px-6 py-4 text-left text-slate-500 font-medium normal-case">
                                        {dateFilter === 'month' ? 'Month' : dateFilter === 'year' ? 'Year' : 'Date'}
                                    </th>
                                    <th className="px-6 py-4 text-right text-slate-500 font-medium normal-case">Opening Cash</th>
                                    <th className="px-6 py-4 text-right text-slate-500 font-medium normal-case">Total Inflow (+)</th>
                                    <th className="px-6 py-4 text-right text-slate-500 font-medium normal-case">Total Outflow (-)</th>
                                    <th className="px-6 py-4 text-right text-slate-500 font-medium normal-case">Closing Cash</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pagedDateGroups.length === 0 ? (
                                    <tr>
                                        <td colSpan={6}>
                                            <div className="empty-state-inline" style={{ padding: 'var(--space-8) 0' }}>
                                                <div className="empty-icon" style={{ display: 'inline-flex', padding: '12px', background: 'var(--slate-100)', borderRadius: '50%', color: 'var(--slate-400)', marginBottom: '12px' }}>
                                                    <Landmark size={24} />
                                                </div>
                                                <div className="empty-title" style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: '15px' }}>No transactions found</div>
                                                <div className="empty-desc" style={{ color: 'var(--slate-500)', fontSize: '13px' }}>
                                                    No transactions recorded for this selected criteria.
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    pagedDateGroups.map((g) => {
                                        const isExpanded = !!expandedDates[g.date];
                                        
                                        const renderGroupLabel = (key) => {
                                            if (aggregationLevel === 'year') {
                                                return key;
                                            }
                                            if (aggregationLevel === 'month') {
                                                const [year, monthStr] = key.split('-');
                                                const date = new Date(Number(year), Number(monthStr) - 1, 1);
                                                return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
                                            }
                                            if (aggregationLevel === 'week') {
                                                return `Week ${key.split('-W')[1]} (${key.split('-W')[0]})`;
                                            }
                                            return formatDate(key);
                                        };

                                        // Drill-down renderer for sub-aggregations (e.g. Year aggregates drill down to Months, Month drills down to Days/Weeks)
                                        const renderDrillDownContent = (group) => {
                                            if (aggregationLevel === 'year') {
                                                // Group transactions inside this year by month
                                                const subGroups = {};
                                                group.payments.forEach(p => {
                                                    const k = getLocalDateString(p.paymentDate).substring(0, 7); // YYYY-MM
                                                    if (!subGroups[k]) subGroups[k] = { payments: [], loans: [], expenses: [] };
                                                    subGroups[k].payments.push(p);
                                                });
                                                group.loans.forEach(l => {
                                                    const k = getLocalDateString(l.startDate).substring(0, 7);
                                                    if (!subGroups[k]) subGroups[k] = { payments: [], loans: [], expenses: [] };
                                                    subGroups[k].loans.push(l);
                                                });
                                                group.expenses.forEach(e => {
                                                    const k = getLocalDateString(e.expenseDate).substring(0, 7);
                                                    if (!subGroups[k]) subGroups[k] = { payments: [], loans: [], expenses: [] };
                                                    subGroups[k].expenses.push(e);
                                                });

                                                const subList = Object.keys(subGroups).map(k => buildGroupNode(k, subGroups[k].payments, subGroups[k].loans, subGroups[k].expenses)).sort((a,b) => b.date.localeCompare(a.date));

                                                return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Months in {group.date}</span>
                                                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
                                                            {subList.map(sg => {
                                                                const isSubExpanded = !!expandedDates[`${group.date}-${sg.date}`];
                                                                const monthName = new Date(Number(sg.date.split('-')[0]), Number(sg.date.split('-')[1]) - 1, 1).toLocaleDateString('en-GB', { month: 'long' });
                                                                return (
                                                                    <div key={sg.date} style={{ padding: '10px 16px' }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                            <button 
                                                                                onClick={() => setExpandedDates(prev => ({ ...prev, [`${group.date}-${sg.date}`]: !isSubExpanded }))}
                                                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#1e293b', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                                                                            >
                                                                                {isSubExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                                                {monthName}
                                                                            </button>
                                                                            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', fontWeight: 500 }}>
                                                                                <span style={{ color: '#10b981' }}>Inflow: {fmt(sg.inflow)}</span>
                                                                                <span style={{ color: '#ef4444' }}>Outflow: {fmt(sg.outflow)}</span>
                                                                            </div>
                                                                        </div>
                                                                        {isSubExpanded && (
                                                                            <div style={{ marginTop: '10px', paddingLeft: '24px' }}>
                                                                                {renderDaysList(sg)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            if (aggregationLevel === 'month') {
                                                return renderDaysList(group);
                                            }

                                            // Default: Day/Week aggregations just display the transactions directly
                                            return renderTransactionsTable(group);
                                        };

                                        const renderDaysList = (group) => {
                                            const subGroups = {};
                                            group.payments.forEach(p => {
                                                const k = getLocalDateString(p.paymentDate);
                                                if (!subGroups[k]) subGroups[k] = { payments: [], loans: [], expenses: [] };
                                                subGroups[k].payments.push(p);
                                            });
                                            group.loans.forEach(l => {
                                                const k = getLocalDateString(l.startDate);
                                                if (!subGroups[k]) subGroups[k] = { payments: [], loans: [], expenses: [] };
                                                subGroups[k].loans.push(l);
                                            });
                                            group.expenses.forEach(e => {
                                                const k = getLocalDateString(e.expenseDate);
                                                if (!subGroups[k]) subGroups[k] = { payments: [], loans: [], expenses: [] };
                                                subGroups[k].expenses.push(e);
                                            });

                                            const subList = Object.keys(subGroups).map(k => buildGroupNode(k, subGroups[k].payments, subGroups[k].loans, subGroups[k].expenses)).sort((a,b) => b.date.localeCompare(a.date));

                                            return (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Daily Breakdown</span>
                                                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
                                                        {subList.map(sg => {
                                                            const isSubExpanded = !!expandedDates[sg.date];
                                                            return (
                                                                <div key={sg.date} style={{ padding: '10px 16px' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <button 
                                                                            onClick={() => setExpandedDates(prev => ({ ...prev, [sg.date]: !isSubExpanded }))}
                                                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#1e293b', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                                                                        >
                                                                            {isSubExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                                            {formatDate(sg.date)}
                                                                        </button>
                                                                        <div style={{ display: 'flex', gap: '16px', fontSize: '11px', fontWeight: 500 }}>
                                                                            <span style={{ color: '#10b981' }}>+ {fmt(sg.inflow)}</span>
                                                                            <span style={{ color: '#ef4444' }}>- {fmt(sg.outflow)}</span>
                                                                        </div>
                                                                    </div>
                                                                    {isSubExpanded && (
                                                                        <div style={{ marginTop: '10px' }}>
                                                                            {renderTransactionsTable(sg)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        };

                                        const renderTransactionsTable = (group) => {
                                            const txs = getDetailedTxListForDate(group);
                                            return (
                                                <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-sm" style={{ margin: '4px 0 12px 0' }}>
                                                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Transaction Details for {renderGroupLabel(group.date)}</span>
                                                        <span className="text-[11px] font-semibold text-slate-500">Total Entries: {txs.length}</span>
                                                    </div>
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                                                                <th className="px-4 py-2.5 text-left">Time</th>
                                                                <th className="px-4 py-2.5 text-left">Type</th>
                                                                <th className="px-4 py-2.5 text-left">Particulars / Details</th>
                                                                <th className="px-4 py-2.5 text-left">Customer</th>
                                                                <th className="px-4 py-2.5 text-right">Inflow (+)</th>
                                                                <th className="px-4 py-2.5 text-right">Outflow (-)</th>
                                                                <th className="px-4 py-2.5 text-center">Recorded By</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {txs.map(dtx => (
                                                                <tr key={dtx.id} className="hover:bg-slate-50/50">
                                                                    <td className="px-4 py-3 text-slate-500 font-medium">{dtx.time}</td>
                                                                    <td className="px-4 py-3">
                                                                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border ${dtx.typeClass}`}>
                                                                            {dtx.type}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-slate-700">
                                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                            <span style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{dtx.title}</span>
                                                                            <span className="text-[11px] text-slate-400 font-medium">{dtx.details}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-slate-900 font-semibold">{dtx.customer}</td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        {dtx.inflow > 0 ? (
                                                                            <span className="text-emerald-500 font-extrabold">{fmt(dtx.inflow)}</span>
                                                                        ) : (
                                                                            <span className="text-slate-300 font-mono">—</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        {dtx.outflow > 0 ? (
                                                                            <span className="text-red-400 font-extrabold">{fmt(dtx.outflow)}</span>
                                                                        ) : (
                                                                            <span className="text-slate-300 font-mono">—</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                                                                            {dtx.creator}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            );
                                        };

                                        return (
                                            <React.Fragment key={g.date}>
                                                <tr className="hover-table-row font-medium">
                                                    <td className="px-4 py-4 text-center">
                                                        <button 
                                                            onClick={() => setExpandedDates(prev => ({ ...prev, [g.date]: !isExpanded }))}
                                                            style={{
                                                                background: '#f1f5f9',
                                                                border: 'none',
                                                                padding: '6px',
                                                                borderRadius: '8px',
                                                                cursor: 'pointer',
                                                                color: '#475569',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            className="hover:bg-slate-200"
                                                        >
                                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-4 text-left text-slate-900 font-semibold">{renderGroupLabel(g.date)}</td>
                                                    <td className="px-6 py-4 text-right text-slate-500 font-medium">{fmt(g.openingBalance)}</td>
                                                    <td className="px-6 py-4 text-right text-emerald-500 font-extrabold" style={{ color: '#10b981' }}>{g.inflow > 0 ? fmt(g.inflow) : '—'}</td>
                                                    <td className="px-6 py-4 text-right text-red-500 font-extrabold" style={{ color: '#ef4444' }}>{g.outflow > 0 ? fmt(g.outflow) : '—'}</td>
                                                    <td className="px-6 py-4 text-right text-slate-900 font-bold">{fmt(g.closingBalance)}</td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="bg-slate-50/30">
                                                        <td colSpan={6} className="px-6 py-4">
                                                            {/* Granular Math Summary Grid */}
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
                                                                <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}>
                                                                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Collections</span>
                                                                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#10b981' }}>{fmt(g.collection)}</span>
                                                                </div>
                                                                <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}>
                                                                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Doc Charges</span>
                                                                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#10b981' }}>{fmt(g.docCharges)}</span>
                                                                </div>
                                                                <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}>
                                                                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Expenses</span>
                                                                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#ef4444' }}>{fmt(g.expensesAmt)}</span>
                                                                </div>
                                                                <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}>
                                                                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Total Given</span>
                                                                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#ef4444' }}>{fmt(g.given)}</span>
                                                                </div>
                                                            </div>
                                                            
                                                            <div style={{ marginTop: '12px' }}>
                                                                {renderDrillDownContent(g)}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="table-container p-0 border-0 shadow-none">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    <th className="px-4 py-4 text-center" style={{ width: '60px' }}></th>
                                    <th className="px-6 py-4 text-left text-slate-500 font-medium normal-case">Period</th>
                                    <th className="px-6 py-4 text-center text-slate-500 font-medium normal-case">Count</th>
                                    <th className="px-6 py-4 text-right text-slate-500 font-medium normal-case">Total Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pagedTabGroups.length === 0 ? (
                                    <tr>
                                        <td colSpan={4}>
                                            <div className="empty-state-inline" style={{ padding: 'var(--space-8) 0' }}>
                                                <div className="empty-icon" style={{ display: 'inline-flex', padding: '12px', background: 'var(--slate-100)', borderRadius: '50%', color: 'var(--slate-400)', marginBottom: '12px' }}>
                                                    <Hash size={24} />
                                                </div>
                                                <div className="empty-title" style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: '15px' }}>No transactions found</div>
                                                <div className="empty-desc" style={{ color: 'var(--slate-500)', fontSize: '13px' }}>
                                                    No transactions recorded for the selected criteria.
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    pagedTabGroups.map((g) => {
                                        const isExpanded = !!expandedDates[g.date];
                                        let count = 0;
                                        let total = 0;
                                        if (activeTab === 'payments') {
                                            count = g.payments.length;
                                            total = g.collection;
                                        } else if (activeTab === 'docCharges') {
                                            const docChargeLoans = g.loans.filter(l => Number(l.documentFee) > 0);
                                            count = docChargeLoans.length;
                                            total = g.docCharges;
                                        } else if (activeTab === 'loans') {
                                            count = g.loans.length;
                                            total = g.given;
                                        } else if (activeTab === 'expenses') {
                                            count = g.expenses.length;
                                            total = g.expensesAmt;
                                        }

                                        return (
                                            <React.Fragment key={g.date}>
                                                <tr className="hover-table-row font-medium">
                                                    <td className="px-4 py-4 text-center">
                                                        <button 
                                                            onClick={() => setExpandedDates(prev => ({ ...prev, [g.date]: !isExpanded }))}
                                                            style={{
                                                                background: '#f1f5f9',
                                                                border: 'none',
                                                                padding: '6px',
                                                                borderRadius: '8px',
                                                                cursor: 'pointer',
                                                                color: '#475569',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            className="hover:bg-slate-200"
                                                        >
                                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-4 text-left text-slate-900 font-semibold">{renderGroupLabel(g.date)}</td>
                                                    <td className="px-6 py-4 text-center text-slate-500 font-medium">{count} {count === 1 ? 'entry' : 'entries'}</td>
                                                    <td className="px-6 py-4 text-right text-slate-900 font-bold" style={{ color: (activeTab === 'payments' || activeTab === 'docCharges') ? 'var(--color-success)' : '#ef4444' }}>
                                                        {fmt(total)}
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="bg-slate-50/30">
                                                        <td colSpan={4} className="px-6 py-4">
                                                            {activeTab === 'payments' && renderPaymentsSubTable(g.payments)}
                                                            {activeTab === 'docCharges' && renderDocChargesSubTable(g.loans.filter(l => Number(l.documentFee) > 0))}
                                                            {activeTab === 'loans' && renderLoansGivenSubTable(g.loans)}
                                                            {activeTab === 'expenses' && renderExpensesSubTable(g.expenses)}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {(() => {
                    let page = 1;
                    let setPage = () => {};
                    let totalPages = 1;
                    if (activeTab === 'all') { page = allPage; setPage = setAllPage; totalPages = totalAllPages; }
                    else if (activeTab === 'payments') { page = paymentPage; setPage = setPaymentPage; totalPages = totalTabGroupPages; }
                    else if (activeTab === 'docCharges') { page = loanPage; setPage = setLoanPage; totalPages = totalTabGroupPages; }
                    else if (activeTab === 'loans') { page = loansGivenPage; setPage = setLoansGivenPage; totalPages = totalTabGroupPages; }
                    else if (activeTab === 'expenses') { page = expensePage; setPage = setExpensePage; totalPages = totalTabGroupPages; }

                    const currentGroupsLength = activeTab === 'all' ? filteredDateGroups.length : tabGroups.length;

                    return currentGroupsLength > 0 && (
                        <div className="table-pagination" style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--slate-100)' }}>
                            <div className="pagination-info text-sm text-slate-500 font-medium">
                                Showing {startIdx} to {endIdx} of {currentGroupsLength} entries
                            </div>
                            <div className="pagination-btns flex gap-1">
                                <button
                                    disabled={page === 1}
                                    onClick={() => setPage(page - 1)}
                                    className="btn btn-sm btn-secondary"
                                    style={{ padding: '4px 10px' }}
                                >
                                    <ChevronLeft size={14} /> Prev
                                </button>
                                {[...Array(totalPages)].map((_, i) => (
                                    <button
                                        key={i + 1}
                                        className={`btn btn-sm ${page === i + 1 ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setPage(i + 1)}
                                        style={{ minWidth: '32px', padding: '4px' }}
                                    >
                                        {i + 1}
                                    </button>
                                )).slice(0, 5)}
                                <button
                                    disabled={page >= totalPages}
                                    onClick={() => setPage(page + 1)}
                                    className="btn btn-sm btn-secondary"
                                    style={{ padding: '4px 10px' }}
                                >
                                    Next <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    );
                })()}
            </div>

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

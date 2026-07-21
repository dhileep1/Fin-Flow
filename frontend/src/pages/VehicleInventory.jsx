import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Search, Bike, MapPin, ChevronLeft, ChevronRight, Activity, Warehouse, CheckCircle, ShieldAlert, BadgeAlert, ArrowUpRight, User, Phone, DollarSign, Calendar, X, AlertTriangle, Check, RotateCcw, ShoppingBag, Landmark } from 'lucide-react';
import SeizureModal from '../components/SeizureModal';

const formatCurrency = (amount) =>
    `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const PAGE_SIZE = 10;

export default function VehicleInventory() {
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [showSeizureModal, setShowSeizureModal] = useState(false);
    const navigate = useNavigate();

    // Detailed action card and settlement modal states
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [showActionModal, setShowActionModal] = useState(false);
    const [showResaleModal, setShowResaleModal] = useState(false);
    const [settlementType, setSettlementType] = useState('reclaim'); // 'reclaim', 'sell', 'sell_with_finance'
    const [buyerName, setBuyerName] = useState('');
    const [buyerPhone, setBuyerPhone] = useState('');
    const [buyerAddress, setBuyerAddress] = useState('');
    const [settlementAmount, setSettlementAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [loanDetails, setLoanDetails] = useState(null);
    const [outstandingBalance, setOutstandingBalance] = useState(0);
    const [overdueBalance, setOverdueBalance] = useState(0);
    const [submittingSettlement, setSubmittingSettlement] = useState(false);
    const [settlementError, setSettlementError] = useState('');
    const [totalPaymentsCollected, setTotalPaymentsCollected] = useState(0);
    const [principalDisbursed, setPrincipalDisbursed] = useState(0);

    // Customer search / create states (for Sell with Finance)
    const [customerQuery, setCustomerQuery] = useState('');
    const [customerResults, setCustomerResults] = useState([]);
    const [customersLoading, setCustomersLoading] = useState(false);
    const [selectedCustomerForFinance, setSelectedCustomerForFinance] = useState(null);
    const [isCreatingNewCustomer, setIsCreatingNewCustomer] = useState(false);
    const [newCustomerDetails, setNewCustomerDetails] = useState({
        name: '',
        phone: '',
        address: '',
        aadharNumber: '',
    });

    // Loan details (for Sell with Finance)
    const [resalePrice, setResalePrice] = useState('');
    const [loanTenure, setLoanTenure] = useState('12');
    const [loanInterestRate, setLoanInterestRate] = useState('2');
    const [loanStartDate, setLoanStartDate] = useState(() => new Date().toISOString().slice(0, 10));

    // Guarantor (Jamin) details (for Sell with Finance)
    const [guarantorName, setGuarantorName] = useState('');
    const [guarantorPhone, setGuarantorPhone] = useState('');
    const [guarantorAadhar, setGuarantorAadhar] = useState('');
    const [guarantorAddress, setGuarantorAddress] = useState('');

    useEffect(() => {
        loadVehicles();
    }, []);

    const loadVehicles = async () => {
        try {
            setLoading(true);
            const data = await api.getVehicles('limit=500');
            setVehicles(data.vehicles || []);
        } catch (err) {
            console.error('Failed to load vehicles:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchLoanDetails = async (loanId, currentSettlementType) => {
        try {
            setOutstandingBalance(0);
            setOverdueBalance(0);
            setSettlementAmount('');
            const data = await api.getLoan(loanId);
            setLoanDetails(data);
            const unpaid = data.loanDues?.filter(d => d.status !== 'paid') || [];
            const total = unpaid.reduce((sum, d) => sum + Number(d.totalDue) - Number(d.amountPaid), 0);
            setOutstandingBalance(total);

            // Calculate overdue dues
            let overdue = 0;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            data.loanDues?.forEach(d => {
                const dueDate = new Date(d.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                const isMissed = d.status === 'overdue' || (d.status === 'pending' && dueDate < today);
                if (isMissed && d.status !== 'paid') {
                    overdue += (Number(d.totalDue) - Number(d.amountPaid || 0));
                }
            });
            setOverdueBalance(overdue);

            if (currentSettlementType === 'reclaim') {
                setSettlementAmount(overdue.toString());
            } else {
                setSettlementAmount('');
            }
            
            const collected = data.payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
            setTotalPaymentsCollected(collected);
            setPrincipalDisbursed(Number(data.disbursedAmount || data.principalAmount || 0));
        } catch (err) {
            console.error('Failed to load loan details for settlement', err);
        }
    };

    const loadCustomers = async (q) => {
        if (!q || q.length < 2) {
            setCustomerResults([]);
            return;
        }
        setCustomersLoading(true);
        try {
            const data = await api.getCustomers(`q=${encodeURIComponent(q)}`);
            setCustomerResults(data.customers || []);
        } catch (e) {
            console.error('Failed to search customers', e);
        } finally {
            setCustomersLoading(false);
        }
    };

    const handleCustomerSearchChange = (value) => {
        setCustomerQuery(value);
        if (value.length >= 2 || value.length === 0) {
            loadCustomers(value);
        }
    };

    // Calculate metrics based on total list before filtering
    const totalVehicles = vehicles.length;
    const seizedCount = vehicles.filter(v => v.status === 'seized').length;
    const soldCount = vehicles.filter(v => v.status === 'sold').length;

    // Filter logic
    const filteredVehicles = vehicles.filter(v => {
        const latestSeizure = v.seizures?.[0] || {};
        
        let matchesStatus = true;
        if (statusFilter === 'seized') {
            matchesStatus = v.status === 'seized';
        } else if (statusFilter === 'sold') {
            matchesStatus = v.status === 'sold';
        }
        
        const matchesSearch = 
            v.vehicleNumber.toLowerCase().includes(search.toLowerCase()) ||
            (v.model || '').toLowerCase().includes(search.toLowerCase()) ||
            (v.customer?.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (latestSeizure.yardLocation || '').toLowerCase().includes(search.toLowerCase());

        return matchesStatus && matchesSearch;
    });

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / PAGE_SIZE));
    const pagedVehicles = filteredVehicles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const startIdx = (page - 1) * PAGE_SIZE + 1;
    const endIdx = Math.min(page * PAGE_SIZE, filteredVehicles.length);

    const getStatusBadge = (status) => {
        if (status === 'active') {
            return (
                <span className="badge px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #10b981', color: '#047857', background: '#ecfdf5' }}>
                    Active
                </span>
            );
        }
        if (status === 'seized') {
            return (
                <span className="badge px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #f97316', color: '#c2410c', background: '#fff7ed' }}>
                    Seized
                </span>
            );
        }
        if (status === 'sold') {
            return (
                <span className="badge px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #64748b', color: '#475569', background: '#f8fafc' }}>
                    Sold
                </span>
            );
        }
        return <span className="badge badge-neutral text-[10px]">{status || 'Unknown'}</span>;
    };

    return (
        <div className="animate-fade-in" style={{ maxWidth: 1200, padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <style>{`
                .vehicles-kpi-card {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 14px;
                    border-radius: 10px;
                    border: 1px solid var(--slate-200) !important;
                    background: #ffffff;
                    box-shadow: var(--shadow-xs);
                    transition: all 0.2s ease;
                }
                .vehicles-kpi-card:hover {
                    transform: translateY(-1px);
                    box-shadow: var(--shadow-sm);
                    border-color: var(--slate-300) !important;
                }
                .kpi-icon-wrapper {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    flex-shrink: 0;
                }
                .sleek-pill-btn {
                    padding: 6px 14px;
                    font-size: 12px;
                    font-weight: 600;
                    border: none;
                    background: transparent;
                    color: var(--slate-500);
                    border-radius: 16px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .sleek-pill-btn:hover {
                    color: var(--slate-800);
                }
                .sleek-pill-btn.active {
                    background: #ffffff;
                    color: var(--brand-accent);
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
                }
                .vehicle-table th {
                    padding: 12px 16px !important;
                    font-size: 11px !important;
                }
                .vehicle-table td {
                    padding: 12px 16px !important;
                }
            `}</style>

            {/* Page Header (Breathable, no subtitle or extra icon block) */}
            <div className="page-header" style={{ margin: 0 }}>
                <div>
                    <h1 className="page-title" style={{ fontSize: '24px', fontWeight: 800, color: 'var(--slate-900)', letterSpacing: '-0.03em', margin: 0 }}>Vehicles</h1>
                </div>
            </div>

            {/* Compact Horizontal KPI Summary Cards */}
            <div className="kpi-strip" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div className="kpi-card vehicles-kpi-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="kpi-icon-wrapper" style={{ background: '#f1f5f9', color: '#475569' }}>
                            <Bike size={14} />
                        </div>
                        <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--slate-900)' }}>{totalVehicles}</span>
                    </div>
                    <span style={{ color: 'var(--slate-400)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Fleet</span>
                </div>
                <div className="kpi-card vehicles-kpi-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="kpi-icon-wrapper" style={{ background: '#fff7ed', color: '#ea580c' }}>
                            <Warehouse size={14} />
                        </div>
                        <span style={{ fontSize: '16px', fontWeight: 800, color: '#ea580c' }}>{seizedCount}</span>
                    </div>
                    <span style={{ color: 'var(--slate-400)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Seized</span>
                </div>
                <div className="kpi-card vehicles-kpi-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="kpi-icon-wrapper" style={{ background: '#ecfdf5', color: '#10b981' }}>
                            <CheckCircle size={14} />
                        </div>
                        <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--slate-900)' }}>{soldCount}</span>
                    </div>
                    <span style={{ color: 'var(--slate-400)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sold</span>
                </div>
            </div>

            {/* Segmented Filter Control & Search Bar */}
            <div className="flex items-center justify-between gap-4" style={{ background: '#fff', padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-xs)' }}>
                <div className="search-bar" style={{ width: '100%', maxWidth: '240px', margin: 0 }}>
                    <input
                        type="text"
                        placeholder="Search model, plate..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        style={{ paddingLeft: '2.2rem', borderRadius: '20px', fontSize: '12.5px', height: '36px' }}
                    />
                    <Search size={13} className="search-icon" style={{ left: '0.8rem' }} />
                </div>

                <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                    <button 
                        className={`sleek-pill-btn ${statusFilter === '' ? 'active' : ''}`}
                        onClick={() => { setStatusFilter(''); setPage(1); }}
                    >
                        All
                    </button>
                    <button 
                        className={`sleek-pill-btn ${statusFilter === 'seized' ? 'active' : ''}`}
                        onClick={() => { setStatusFilter('seized'); setPage(1); }}
                    >
                        Seized
                    </button>
                    <button 
                        className={`sleek-pill-btn ${statusFilter === 'sold' ? 'active' : ''}`}
                        onClick={() => { setStatusFilter('sold'); setPage(1); }}
                    >
                        Sold
                    </button>
                </div>
            </div>

            {/* Table Container */}
            <div className="table-container" style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-xs)' }}>
                <table className="w-full text-sm vehicle-table">
                    <thead>
                        <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider" style={{ background: '#f8fafc' }}>
                            <th className="text-left" style={{ width: '25%' }}>Vehicle</th>
                            <th className="text-left" style={{ width: '25%' }}>Customer</th>
                            <th className="text-left" style={{ width: '30%' }}>Loan / Seizure Details</th>
                            <th className="text-center" style={{ width: '20%' }}>Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <tr key={i}>
                                    {[...Array(4)].map((_, j) => (
                                        <td key={j}><div className="loading-skeleton" style={{ height: 14, width: '80%' }} /></td>
                                    ))}
                                </tr>
                            ))
                        ) : filteredVehicles.length === 0 ? (
                            <tr>
                                <td colSpan={4}>
                                    <div className="empty-state-inline" style={{ padding: '40px 0' }}>
                                        <div className="empty-icon" style={{ background: '#f8fafc', color: '#94a3b8', padding: '10px', borderRadius: '50%', marginBottom: '8px' }}><ShieldAlert size={22} /></div>
                                        <div className="empty-title" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--slate-800)' }}>No vehicles found</div>
                                        <div className="empty-desc" style={{ fontSize: '12px', color: 'var(--slate-500)' }}>Try a different filter or search term.</div>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            pagedVehicles.map((v) => {
                                const latestSeizure = v.seizures?.[0] || {};
                                const latestLoan = v.loans?.[0] || {};
                                const hasActiveLoan = v.status === 'active' && latestLoan.id;

                                return (
                                    <tr 
                                        key={v.id} 
                                        className="cursor-pointer hover-table-row"
                                        onClick={() => {
                                            setSelectedVehicle(v);
                                            setShowActionModal(true);
                                        }}
                                        style={{ transition: 'background-color 0.15s ease' }}
                                    >
                                        {/* 1. VEHICLE DETAILS */}
                                        <td className="text-left">
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                                <span className="font-mono text-slate-900" style={{ fontWeight: 700, letterSpacing: '0.02em', fontSize: '13.5px' }}>
                                                    {v.vehicleNumber}
                                                </span>
                                                <span className="text-xs text-slate-400" style={{ fontWeight: 500 }}>
                                                    {v.model || '—'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* 2. CUSTOMER DETAILS */}
                                        <td className="text-left">
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                                <div className="text-slate-800" style={{ fontWeight: 600, fontSize: '13px' }}>{v.customer?.name || '—'}</div>
                                                <div className="text-[11px] text-slate-400 font-mono">{v.customer?.phone || '—'}</div>
                                            </div>
                                        </td>

                                        {/* 3. LOAN / SEIZURE DETAILS */}
                                        <td className="text-left">
                                            {hasActiveLoan ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--brand-accent)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                        Active Loan <ArrowUpRight size={10} />
                                                    </span>
                                                    <span style={{ fontSize: '11px', color: 'var(--slate-500)' }}>
                                                        Principal: {formatCurrency(latestLoan.principalAmount)} | Due: {formatDate(latestLoan.nextDueDate)}
                                                    </span>
                                                </div>
                                            ) : (v.status === 'seized' || v.status === 'sold') ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--slate-800)' }}>
                                                        Seized: {formatDate(latestSeizure.seizureDate)}
                                                    </span>
                                                    <span style={{ fontSize: '11px', color: 'var(--slate-400)' }}>
                                                        By: {latestSeizure.user?.name || 'Staff Operator'}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 text-xs">—</span>
                                            )}
                                        </td>

                                        {/* 4. STATUS */}
                                        <td className="text-center">
                                            {getStatusBadge(v.status)}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>

                {/* Pagination Controls */}
                {!loading && filteredVehicles.length > 0 && (
                    <div className="table-pagination" style={{ borderTop: '1px solid var(--slate-200)', background: '#f8fafc', padding: '10px 16px' }}>
                        <div className="pagination-info" style={{ color: 'var(--slate-400)', fontSize: '11.5px' }}>
                            Showing {startIdx} to {endIdx} of {filteredVehicles.length} entries
                        </div>
                        <div className="pagination-btns">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                            >
                                <ChevronLeft size={13} /> Prev
                            </button>
                            {[...Array(totalPages)].map((_, i) => (
                                <button
                                    key={i + 1}
                                    className={page === i + 1 ? 'active' : ''}
                                    onClick={() => setPage(i + 1)}
                                    style={{ fontSize: '12px', padding: '3px 8px' }}
                                >
                                    {i + 1}
                                </button>
                            )).slice(0, 5)}
                            <button
                                disabled={page >= totalPages}
                                onClick={() => setPage(page + 1)}
                            >
                                Next <ChevronRight size={13} />
                            </button>
                        </div>
                    </div>
                )}
            </div>


            {/* Vehicle Action Card Modal */}
            {showActionModal && selectedVehicle && (
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
                    onClick={() => setShowActionModal(false)}
                >
                    <div 
                        style={{
                            background: '#ffffff',
                            width: '100%',
                            maxWidth: '480px',
                            borderRadius: '16px',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            padding: '24px',
                            position: 'relative'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={() => setShowActionModal(false)}
                            style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
                        >
                            <X size={20} />
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ background: '#f1f5f9', color: '#475569', padding: '10px', borderRadius: '10px' }}>
                                <Bike size={24} />
                            </div>
                            <div>
                                <h3 style={{ fontWeight: 800, fontSize: '18px', color: '#1e293b', margin: 0 }}>{selectedVehicle.vehicleNumber}</h3>
                                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>{selectedVehicle.model || 'Unknown Model'}</p>
                            </div>
                            <div style={{ marginLeft: 'auto', marginRight: '24px' }}>
                                {getStatusBadge(selectedVehicle.status)}
                            </div>
                        </div>

                        <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '16px' }}>
                            <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Owner Details</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                                    <User size={14} className="text-slate-400" />
                                    <span style={{ fontWeight: 600 }}>{selectedVehicle.customer?.name || '—'}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
                                    <Phone size={14} className="text-slate-400" />
                                    <span>{selectedVehicle.customer?.phone || '—'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Seizure details */}
                        {(selectedVehicle.status === 'seized' || selectedVehicle.status === 'sold') && (
                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                                <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Seizure Log Details</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12.5px' }}>
                                    <div>
                                        <span style={{ display: 'block', color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>Seized Date</span>
                                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{formatDate(selectedVehicle.seizures?.[0]?.seizureDate)}</span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>Yard Location</span>
                                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{selectedVehicle.seizures?.[0]?.yardLocation || 'Not Specified'}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {selectedVehicle.status === 'seized' && (
                                <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', width: '100%' }}>
                                    <button 
                                        type="button"
                                        className="btn btn-subtle-reclaim"
                                        style={{ flex: 1, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 4px', fontSize: '11px', fontWeight: 700 }}
                                        onClick={() => {
                                            const loanId = selectedVehicle.seizures?.[0]?.loanId || selectedVehicle.loans?.[0]?.id;
                                            if (loanId) {
                                                fetchLoanDetails(loanId, 'reclaim');
                                            }
                                            setShowActionModal(false);
                                            setSettlementType('reclaim');
                                            setSettlementError('');
                                            setShowResaleModal(true);
                                        }}
                                    >
                                        <RotateCcw size={12} />
                                        Reclaim
                                    </button>

                                    <button 
                                        type="button"
                                        className="btn btn-subtle-sell"
                                        style={{ flex: 1, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 4px', fontSize: '11px', fontWeight: 700 }}
                                        onClick={() => {
                                            const loanId = selectedVehicle.seizures?.[0]?.loanId || selectedVehicle.loans?.[0]?.id;
                                            if (loanId) {
                                                fetchLoanDetails(loanId, 'sell');
                                            }
                                            setShowActionModal(false);
                                            setBuyerName('');
                                            setBuyerPhone('');
                                            setBuyerAddress('');
                                            setSettlementType('sell');
                                            setSettlementAmount('');
                                            setSettlementError('');
                                            setShowResaleModal(true);
                                        }}
                                    >
                                        <ShoppingBag size={12} />
                                        Sell
                                    </button>

                                    <button 
                                        type="button"
                                        className="btn btn-subtle-sell-finance"
                                        style={{ flex: 1, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 4px', fontSize: '11px', fontWeight: 700 }}
                                        onClick={() => {
                                            const loanId = selectedVehicle.seizures?.[0]?.loanId || selectedVehicle.loans?.[0]?.id;
                                            if (loanId) {
                                                fetchLoanDetails(loanId, 'sell_with_finance');
                                            }
                                            setShowActionModal(false);
                                            setBuyerName('');
                                            setBuyerPhone('');
                                            setBuyerAddress('');
                                            setSettlementType('sell_with_finance');
                                            setSettlementAmount('');
                                            setSettlementError('');
                                            setSelectedCustomerForFinance(null);
                                            setCustomerQuery('');
                                            setIsCreatingNewCustomer(false);
                                            setNewCustomerDetails({ name: '', phone: '', address: '', aadharNumber: '' });
                                            setResalePrice('');
                                            setLoanTenure('12');
                                            setLoanInterestRate('2');
                                            setGuarantorName('');
                                            setGuarantorPhone('');
                                            setGuarantorAadhar('');
                                            setGuarantorAddress('');
                                            setShowResaleModal(true);
                                        }}
                                    >
                                        <Landmark size={12} />
                                        Sell with Fin
                                    </button>
                                </div>
                            )}

                            {selectedVehicle.status === 'active' && (selectedVehicle.loans?.[0]?.id || selectedVehicle.seizures?.[0]?.loanId) && (
                                <button 
                                    type="button"
                                    className="btn btn-primary"
                                    style={{ width: '100%', borderRadius: '10px', backgroundColor: '#ef4444', borderColor: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                    onClick={() => {
                                        setShowActionModal(false);
                                        setShowSeizureModal(true);
                                    }}
                                >
                                    <AlertTriangle size={16} />
                                    Seize Vehicle
                                </button>
                            )}

                            {selectedVehicle.status !== 'seized' && (selectedVehicle.seizures?.[0]?.loanId || selectedVehicle.loans?.[0]?.id) && (
                                <button 
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ width: '100%', borderRadius: '10px' }}
                                    onClick={() => {
                                        const loanId = selectedVehicle.seizures?.[0]?.loanId || selectedVehicle.loans?.[0]?.id;
                                        navigate(`/loans/${loanId}`);
                                    }}
                                >
                                    Open Loan Details
                                </button>
                            )}

                            <button 
                                type="button"
                                className="btn btn-secondary"
                                style={{ width: '100%', borderRadius: '10px', marginTop: '4px', background: '#f8fafc', borderColor: '#cbd5e1', color: '#334155' }}
                                onClick={() => {
                                    setShowActionModal(false);
                                    navigate(`/vehicles/${selectedVehicle.id}`);
                                }}
                            >
                                View History & Expenses
                            </button>


                        </div>
                    </div>
                </div>
            )}

            {/* Settlement & Resell Wizard Modal */}
            {showResaleModal && selectedVehicle && (
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
                    onClick={() => {
                        if (!submittingSettlement) {
                            setShowResaleModal(false);
                        }
                    }}
                >
                    <div 
                        style={{
                            background: '#ffffff',
                            width: '95%',
                            maxWidth: settlementType === 'sell_with_finance' ? '920px' : (settlementType === 'sell' ? '760px' : '440px'),
                            maxHeight: '90vh',
                            borderRadius: '16px',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            position: 'relative',
                            display: 'flex',
                            transition: 'all 0.2s ease-out',
                            overflow: 'hidden'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* LEFT COLUMN: Light Slate Info Panel */}
                        <div 
                            style={{
                                background: '#f8fafc',
                                color: '#1e293b',
                                width: '38%',
                                minWidth: '280px',
                                padding: '24px 20px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                borderRight: '1px solid #cbd5e1',
                                overflowY: 'auto',
                                maxHeight: '90vh'
                            }}
                        >
                            <div>
                                <h3 style={{ fontWeight: 800, fontSize: '18px', color: '#1e293b', marginBottom: '4px', marginTop: 0 }}>
                                    {settlementType === 'reclaim' && 'Asset Reclaim'}
                                    {settlementType === 'sell' && 'Outright Resale'}
                                    {settlementType === 'sell_with_finance' && 'Financed Resale'}
                                </h3>
                                <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.4 }}>
                                    Configure resolution for vehicle: <strong style={{ color: '#1e293b' }}>{selectedVehicle.vehicleNumber}</strong>
                                </p>

                                {/* Original Customer Summary */}
                                <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12.5px' }}>
                                    <h4 style={{ fontSize: '9.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px 0' }}>
                                        Original Loan Context
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#64748b' }}>Customer:</span>
                                            <span style={{ fontWeight: 600, color: '#334155' }}>{selectedVehicle.customer?.name}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#64748b' }}>Outstanding Dues:</span>
                                            <span style={{ fontWeight: 700, color: '#e11d48' }}>{formatCurrency(outstandingBalance)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#64748b' }}>Overdue Dues:</span>
                                            <span style={{ fontWeight: 600, color: '#475569' }}>{formatCurrency(overdueBalance)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '6px', marginTop: '2px' }}>
                                            <span style={{ color: '#64748b' }}>Disbursed:</span>
                                            <span style={{ fontWeight: 600, color: '#334155' }}>{formatCurrency(principalDisbursed)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#64748b' }}>Collected:</span>
                                            <span style={{ fontWeight: 600, color: '#166534' }}>{formatCurrency(totalPaymentsCollected)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Dynamic Pricing Outputs at Bottom Left */}
                            <div style={{ marginTop: '16px' }}>
                                {settlementType === 'sell' && (
                                    <div style={{ background: '#fff1f2', padding: '12px', borderRadius: '10px', border: '1px solid #fecaca', fontSize: '12.5px' }}>
                                        <h4 style={{ fontSize: '9.5px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px 0' }}>
                                            Outright Resale Summary
                                        </h4>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ color: '#475569' }}>Sale Price:</span>
                                            <span style={{ fontWeight: 700, color: '#1e293b' }}>{formatCurrency(settlementAmount)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #fecaca', paddingTop: '6px', fontWeight: 700 }}>
                                            <span style={{ color: '#991b1b' }}>Write-off Loss:</span>
                                            <span style={{ color: '#991b1b', fontSize: '13.5px' }}>
                                                {formatCurrency(Math.max(0, principalDisbursed - totalPaymentsCollected - Number(settlementAmount || 0)))}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {settlementType === 'sell_with_finance' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {/* Calculated Loan Principal */}
                                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '10px', fontSize: '12.5px' }}>
                                            <h4 style={{ fontSize: '9.5px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px 0' }}>
                                                New Finance Summary
                                            </h4>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ color: '#475569' }}>Resale Value:</span>
                                                <span style={{ fontWeight: 600, color: '#1e293b' }}>{formatCurrency(resalePrice)}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ color: '#475569' }}>Down Payment:</span>
                                                <span style={{ fontWeight: 600, color: '#1e293b' }}>{formatCurrency(settlementAmount)}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #bbf7d0', paddingTop: '6px', fontWeight: 800 }}>
                                                <span style={{ color: '#166534' }}>New Loan Principal:</span>
                                                <span style={{ color: '#166534', fontSize: '14px' }}>
                                                    {formatCurrency(Math.max(0, Number(resalePrice || 0) - Number(settlementAmount || 0)))}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Old Loan Write-off */}
                                        <div style={{ background: '#fff1f2', border: '1px solid #fecaca', padding: '12px', borderRadius: '10px', fontSize: '12.5px' }}>
                                            <h4 style={{ fontSize: '9.5px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px 0' }}>
                                                Old Loan Resolution
                                            </h4>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ color: '#475569' }}>Original Principal:</span>
                                                <span style={{ fontWeight: 600, color: '#1e293b' }}>{formatCurrency(principalDisbursed)}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ color: '#475569' }}>Down Payment:</span>
                                                <span style={{ fontWeight: 600, color: '#1e293b' }}>{formatCurrency(settlementAmount)}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #fecaca', paddingTop: '6px', fontWeight: 700 }}>
                                                <span style={{ color: '#991b1b' }}>Write-off Loss:</span>
                                                <span style={{ color: '#991b1b', fontSize: '13.5px' }}>
                                                    {formatCurrency(Math.max(0, principalDisbursed - totalPaymentsCollected - Number(settlementAmount || 0)))}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: White Inputs & Actions Panel */}
                        <div 
                            style={{
                                flex: 1,
                                padding: '24px 20px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                overflowY: 'auto',
                                maxHeight: '90vh'
                            }}
                        >
                            {/* Absolute close button on the right header */}
                            <button 
                                onClick={() => setShowResaleModal(false)}
                                style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
                                disabled={submittingSettlement}
                            >
                                <X size={20} />
                            </button>

                            {/* Main Body Inputs */}
                            <div style={{ flex: 1 }}>
                                {/* Error Alert */}
                                {settlementError && (
                                    <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', color: 'rgb(239, 68, 68)', borderRadius: '8px', fontSize: '12.5px', marginBottom: '16px', fontWeight: 500 }}>
                                        {settlementError}
                                    </div>
                                )}

                                {settlementType === 'reclaim' && (
                                    <div style={{ marginTop: '8px' }}>
                                        <div className="form-group">
                                            <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                                                Payment Amount (₹) *
                                            </label>
                                            <input 
                                                type="number" 
                                                className="form-input"
                                                placeholder="Enter payment amount"
                                                value={settlementAmount}
                                                onChange={(e) => setSettlementAmount(e.target.value)}
                                                style={{ borderRadius: '8px', width: '100%', padding: '8px 12px' }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {settlementType === 'sell' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#334155', margin: '0 0 2px 0' }}>1. Buyer Details</h4>
                                            <div className="form-group">
                                                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Buyer Name *</label>
                                                <input 
                                                    type="text" 
                                                    className="form-input"
                                                    placeholder="Enter buyer's name"
                                                    value={buyerName}
                                                    onChange={(e) => setBuyerName(e.target.value)}
                                                    style={{ borderRadius: '6px', width: '100%', padding: '6px 10px', fontSize: '12.5px' }}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Buyer Phone</label>
                                                <input 
                                                    type="text" 
                                                    className="form-input"
                                                    placeholder="Enter buyer's phone"
                                                    value={buyerPhone}
                                                    onChange={(e) => setBuyerPhone(e.target.value)}
                                                    style={{ borderRadius: '6px', width: '100%', padding: '6px 10px', fontSize: '12.5px' }}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Buyer Address</label>
                                                <input 
                                                    type="text" 
                                                    className="form-input"
                                                    placeholder="Enter buyer's address (optional)"
                                                    value={buyerAddress}
                                                    onChange={(e) => setBuyerAddress(e.target.value)}
                                                    style={{ borderRadius: '6px', width: '100%', padding: '6px 10px', fontSize: '12.5px' }}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#334155', margin: '0 0 4px 0' }}>2. Pricing Details</h4>
                                            <div className="form-group" style={{ marginBottom: '8px' }}>
                                                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                                                    Sale Price (₹) *
                                                </label>
                                                <input 
                                                    type="number" 
                                                    className="form-input"
                                                    placeholder="Enter sale price"
                                                    value={settlementAmount}
                                                    onChange={(e) => setSettlementAmount(e.target.value)}
                                                    style={{ borderRadius: '6px', width: '100%', padding: '8px 12px' }}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Payment Method</label>
                                                <select
                                                    className="form-select text-slate-800"
                                                    value={paymentMethod}
                                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                                    style={{ borderRadius: '6px', width: '100%', padding: '6px 10px', border: '1px solid var(--color-border)', outline: 'none', fontSize: '12.5px' }}
                                                >
                                                    <option value="cash">Cash</option>
                                                    <option value="upi">UPI / Online</option>
                                                    <option value="bank">Bank Transfer</option>
                                                    <option value="cheque">Cheque</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {settlementType === 'sell_with_finance' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        {/* Buyer Customer */}
                                        <div style={{ borderBottom: '1px dashed #cbd5e1', paddingBottom: '12px' }}>
                                            <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#334155', margin: '0 0 8px 0' }}>1. Buyer Customer</h4>
                                            
                                            {/* Toggle existing vs new customer */}
                                            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsCreatingNewCustomer(false);
                                                        setSelectedCustomerForFinance(null);
                                                    }}
                                                    style={{
                                                        flex: 1,
                                                        padding: '4px 8px',
                                                        fontSize: '11px',
                                                        fontWeight: 600,
                                                        borderRadius: '6px',
                                                        border: '1px solid #e2e8f0',
                                                        background: !isCreatingNewCustomer ? '#f1f5f9' : '#ffffff',
                                                        color: !isCreatingNewCustomer ? 'var(--brand-accent)' : '#475569',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Search Existing
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsCreatingNewCustomer(true);
                                                        setSelectedCustomerForFinance(null);
                                                    }}
                                                    style={{
                                                        flex: 1,
                                                        padding: '4px 8px',
                                                        fontSize: '11px',
                                                        fontWeight: 600,
                                                        borderRadius: '6px',
                                                        border: '1px solid #e2e8f0',
                                                        background: isCreatingNewCustomer ? '#f1f5f9' : '#ffffff',
                                                        color: isCreatingNewCustomer ? 'var(--brand-accent)' : '#475569',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Add New Customer
                                                </button>
                                            </div>

                                            {!isCreatingNewCustomer ? (
                                                selectedCustomerForFinance ? (
                                                    <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <div style={{ fontWeight: 700, fontSize: '12px', color: '#1e293b' }}>{selectedCustomerForFinance.name}</div>
                                                            <div style={{ fontSize: '11px', color: '#64748b' }}>{selectedCustomerForFinance.phone} | {selectedCustomerForFinance.address || 'No Address'}</div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedCustomerForFinance(null)}
                                                            style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                                                        >
                                                            Change
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div style={{ position: 'relative' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '5px 10px' }}>
                                                            <Search size={14} color="#64748b" />
                                                            <input
                                                                type="text"
                                                                placeholder="Type customer name or phone..."
                                                                value={customerQuery}
                                                                onChange={(e) => handleCustomerSearchChange(e.target.value)}
                                                                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '12px' }}
                                                            />
                                                        </div>
                                                        {customersLoading && <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Searching...</div>}
                                                        {customerResults.length > 0 && (
                                                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', zIndex: 10, maxHeight: '140px', overflowY: 'auto', marginTop: '4px' }}>
                                                                {customerResults.map(c => (
                                                                    <div
                                                                        key={c.id}
                                                                        onClick={() => {
                                                                            setSelectedCustomerForFinance(c);
                                                                            setCustomerResults([]);
                                                                            setCustomerQuery('');
                                                                        }}
                                                                        style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '11.5px', textAlign: 'left' }}
                                                                    >
                                                                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{c.name}</span>
                                                                        <span style={{ color: '#64748b', marginLeft: '6px' }}>({c.phone})</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            ) : (
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', textAlign: 'left' }}>
                                                    <div className="form-group">
                                                        <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Name *</label>
                                                        <input
                                                            type="text"
                                                            className="form-input"
                                                            placeholder="Enter name"
                                                            value={newCustomerDetails.name}
                                                            onChange={(e) => setNewCustomerDetails({ ...newCustomerDetails, name: e.target.value })}
                                                            style={{ padding: '4px 8px', fontSize: '11.5px', borderRadius: '6px', width: '100%' }}
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Phone *</label>
                                                        <input
                                                            type="text"
                                                            className="form-input"
                                                            placeholder="Enter phone"
                                                            value={newCustomerDetails.phone}
                                                            onChange={(e) => setNewCustomerDetails({ ...newCustomerDetails, phone: e.target.value })}
                                                            style={{ padding: '4px 8px', fontSize: '11.5px', borderRadius: '6px', width: '100%' }}
                                                        />
                                                    </div>
                                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                                        <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Address</label>
                                                        <input
                                                            type="text"
                                                            className="form-input"
                                                            placeholder="Enter address"
                                                            value={newCustomerDetails.address}
                                                            onChange={(e) => setNewCustomerDetails({ ...newCustomerDetails, address: e.target.value })}
                                                            style={{ padding: '4px 8px', fontSize: '11.5px', borderRadius: '6px', width: '100%' }}
                                                        />
                                                    </div>
                                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                                        <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Aadhaar Number</label>
                                                        <input
                                                            type="text"
                                                            className="form-input"
                                                            placeholder="Enter 12 digit Aadhaar"
                                                            value={newCustomerDetails.aadharNumber}
                                                            onChange={(e) => setNewCustomerDetails({ ...newCustomerDetails, aadharNumber: e.target.value })}
                                                            style={{ padding: '4px 8px', fontSize: '11.5px', borderRadius: '6px', width: '100%' }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Pricing & Downpayment */}
                                        <div style={{ borderBottom: '1px dashed #cbd5e1', paddingBottom: '12px' }}>
                                            <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#334155', margin: '0 0 8px 0' }}>2. Pricing & Down Payment</h4>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', textAlign: 'left' }}>
                                                <div className="form-group">
                                                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Resale Price (₹) *</label>
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        placeholder="Resale Price"
                                                        value={resalePrice}
                                                        onChange={(e) => setResalePrice(e.target.value)}
                                                        style={{ padding: '4px 8px', fontSize: '11.5px', borderRadius: '6px', width: '100%' }}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Down Payment (₹) *</label>
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        placeholder="Down Payment"
                                                        value={settlementAmount}
                                                        onChange={(e) => setSettlementAmount(e.target.value)}
                                                        style={{ padding: '4px 8px', fontSize: '11.5px', borderRadius: '6px', width: '100%' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* New Loan Terms */}
                                        <div style={{ borderBottom: '1px dashed #cbd5e1', paddingBottom: '12px' }}>
                                            <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#334155', margin: '0 0 8px 0' }}>3. New Loan Terms</h4>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'left' }}>
                                                <div className="form-group">
                                                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Tenure (Months) *</label>
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        placeholder="Months"
                                                        value={loanTenure}
                                                        onChange={(e) => setLoanTenure(e.target.value)}
                                                        style={{ padding: '4px 8px', fontSize: '11.5px', borderRadius: '6px', width: '100%' }}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Monthly Rate (%) *</label>
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        placeholder="Rate"
                                                        value={loanInterestRate}
                                                        onChange={(e) => setLoanInterestRate(e.target.value)}
                                                        style={{ padding: '4px 8px', fontSize: '11.5px', borderRadius: '6px', width: '100%' }}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Start Date *</label>
                                                    <input
                                                        type="date"
                                                        className="form-input"
                                                        value={loanStartDate}
                                                        onChange={(e) => setLoanStartDate(e.target.value)}
                                                        style={{ padding: '3px 6px', fontSize: '11px', borderRadius: '6px', width: '100%' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Guarantor Details */}
                                        <div>
                                            <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#334155', margin: '0 0 8px 0' }}>4. Guarantor (Jamin) Details</h4>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', textAlign: 'left' }}>
                                                <div className="form-group">
                                                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Guarantor Name *</label>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        placeholder="Guarantor Name"
                                                        value={guarantorName}
                                                        onChange={(e) => setGuarantorName(e.target.value)}
                                                        style={{ padding: '4px 8px', fontSize: '11.5px', borderRadius: '6px', width: '100%' }}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Guarantor Phone *</label>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        placeholder="Guarantor Phone"
                                                        value={guarantorPhone}
                                                        onChange={(e) => setGuarantorPhone(e.target.value)}
                                                        style={{ padding: '4px 8px', fontSize: '11.5px', borderRadius: '6px', width: '100%' }}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Guarantor Aadhaar</label>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        placeholder="Guarantor Aadhaar"
                                                        value={guarantorAadhar}
                                                        onChange={(e) => setGuarantorAadhar(e.target.value)}
                                                        style={{ padding: '4px 8px', fontSize: '11.5px', borderRadius: '6px', width: '100%' }}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Guarantor Address</label>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        placeholder="Guarantor Address"
                                                        value={guarantorAddress}
                                                        onChange={(e) => setGuarantorAddress(e.target.value)}
                                                        style={{ padding: '4px 8px', fontSize: '11.5px', borderRadius: '6px', width: '100%' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer Actions (Inside the right column at the bottom) */}
                            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                                <button 
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowResaleModal(false)}
                                    disabled={submittingSettlement}
                                    style={{ flex: 1, borderRadius: '8px', padding: '8px 12px', fontSize: '12.5px' }}
                                >
                                    Cancel
                                </button>

                                {settlementType === 'reclaim' && (
                                    <button 
                                        type="button"
                                        className="btn btn-primary"
                                        disabled={submittingSettlement}
                                        onClick={async () => {
                                            setSubmittingSettlement(true);
                                            setSettlementError('');
                                            try {
                                                await api.settleSeizure(selectedVehicle.seizures[0].id, {
                                                    settlementType: 'reclaim',
                                                    settlementAmount: Number(settlementAmount),
                                                    paymentMethod: 'cash'
                                                });
                                                setShowResaleModal(false);
                                                loadVehicles(); // Refresh
                                            } catch (err) {
                                                setSettlementError(err.message || 'Failed to submit reclaim');
                                            } finally {
                                                setSubmittingSettlement(false);
                                            }
                                        }}
                                        style={{ flex: 2, borderRadius: '8px', padding: '8px 12px', fontSize: '12.5px' }}
                                    >
                                        {submittingSettlement ? 'Saving...' : 'Confirm Reclaim'}
                                    </button>
                                )}

                                {settlementType === 'sell' && (
                                    <button 
                                        type="button"
                                        className="btn btn-primary"
                                        disabled={submittingSettlement || !buyerName}
                                        onClick={async () => {
                                            setSubmittingSettlement(true);
                                            setSettlementError('');
                                            try {
                                                await api.settleSeizure(selectedVehicle.seizures[0].id, {
                                                    settlementType: 'sell',
                                                    settlementAmount: Number(settlementAmount),
                                                    buyerName,
                                                    buyerPhone,
                                                    buyerAddress,
                                                    paymentMethod
                                                });
                                                setShowResaleModal(false);
                                                loadVehicles(); // Refresh
                                            } catch (err) {
                                                setSettlementError(err.message || 'Failed to submit sale');
                                            } finally {
                                                setSubmittingSettlement(false);
                                            }
                                        }}
                                        style={{ flex: 2, borderRadius: '8px', padding: '8px 12px', fontSize: '12.5px' }}
                                    >
                                        {submittingSettlement ? 'Saving...' : 'Confirm Sale'}
                                    </button>
                                )}

                                {settlementType === 'sell_with_finance' && (
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        disabled={
                                            submittingSettlement || 
                                            (!selectedCustomerForFinance && (!newCustomerDetails.name || !newCustomerDetails.phone)) ||
                                            !resalePrice || 
                                            !settlementAmount || 
                                            !loanTenure || 
                                            !loanInterestRate ||
                                            !guarantorName ||
                                            !guarantorPhone
                                        }
                                        style={{ flex: 2, borderRadius: '8px', background: 'var(--brand-accent)', border: 'none', color: '#ffffff', padding: '8px 12px', fontSize: '12.5px' }}
                                        onClick={async () => {
                                            setSubmittingSettlement(true);
                                            setSettlementError('');
                                            try {
                                                // 1. Resolve / Create the customer
                                                let targetCustomer = selectedCustomerForFinance;
                                                if (isCreatingNewCustomer) {
                                                    targetCustomer = await api.createCustomer({
                                                        ...newCustomerDetails,
                                                        aadharNumber: newCustomerDetails.aadharNumber.replace(/\s/g, '')
                                                    });
                                                }

                                                if (!targetCustomer?.id) {
                                                    throw new Error('Failed to resolve target customer');
                                                }

                                                // 2. Settle the Seizure
                                                await api.settleSeizure(selectedVehicle.seizures[0].id, {
                                                    settlementType: 'sell_with_finance',
                                                    downPayment: Number(settlementAmount),
                                                    buyerName: targetCustomer.name,
                                                    buyerPhone: targetCustomer.phone,
                                                    buyerAddress: targetCustomer.address
                                                });

                                                // 3. Create the Loan
                                                const principalVal = Number(resalePrice) - Number(settlementAmount);
                                                const createdLoan = await api.createLoan({
                                                    customerId: targetCustomer.id,
                                                    vehicleId: selectedVehicle.id,
                                                    principalAmount: principalVal,
                                                    tenureMonths: Number(loanTenure),
                                                    monthlyInterestRate: Number(loanInterestRate) / 100,
                                                    startDate: loanStartDate,
                                                    guarantors: [{
                                                        name: guarantorName,
                                                        phone: guarantorPhone,
                                                        aadharNumber: guarantorAadhar ? guarantorAadhar.replace(/\s/g, '') : '',
                                                        address: guarantorAddress
                                                    }]
                                                });

                                                setShowResaleModal(false);
                                                navigate(`/loans/${createdLoan.id}`);
                                            } catch (err) {
                                                setSettlementError(err.message || 'Failed to complete financed sale');
                                                setSubmittingSettlement(false);
                                            }
                                        }}
                                    >
                                        {submittingSettlement ? 'Processing...' : 'Confirm & Create Loan'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}{showSeizureModal && selectedVehicle && (
                <SeizureModal 
                    loanId={selectedVehicle.loans?.[0]?.id || selectedVehicle.seizures?.[0]?.loanId}
                    vehicleId={selectedVehicle.id}
                    customerName={selectedVehicle.customer?.name}
                    vehicleNumber={selectedVehicle.vehicleNumber}
                    onClose={() => setShowSeizureModal(false)}
                    onSuccess={() => {
                        setShowSeizureModal(false);
                        loadVehicles();
                    }}
                />
            )}
        </div>
    );
}

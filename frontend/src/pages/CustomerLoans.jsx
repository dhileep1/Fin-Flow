import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { 
    ChevronLeft, 
    Calendar, 
    Clock, 
    CheckCircle2, 
    AlertCircle, 
    User, 
    Phone, 
    MapPin, 
    Car, 
    Bike,
    FileText,
    ArrowRight,
    Pencil,
    PlusCircle,
    CreditCard,
    DollarSign,
    Layers,
    ExternalLink
} from 'lucide-react';

const formatCurrency = (amount) =>
    `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
    });
};

function formatAadhaar(value) {
    const digits = value.replace(/\D/g, '').slice(0, 12);
    const parts = [];
    for (let i = 0; i < digits.length; i += 4) {
        parts.push(digits.slice(i, i + 4));
    }
    return parts.join(' ');
}

const getStatusBadge = (status) => {
    if (!status) return 'badge-neutral';
    switch (status.toLowerCase()) {
        case 'active': return 'badge-success';
        case 'closed': 
        case 'completed': 
        case 'settled': return 'badge-neutral';
        case 'defaulter': return 'badge-defaulter';
        default: return 'badge-neutral';
    }
};

const getOverallStanding = (loansList) => {
    if (!loansList || loansList.length === 0) return { label: 'No History', color: 'badge-neutral' };
    
    const hasDefaulter = loansList.some(l => l.status === 'defaulter');
    if (hasDefaulter) return { label: 'Defaulter', color: 'badge-defaulter' };

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const hasOverdue = loansList.some(l => 
        l.status === 'active' && l.nextDueDate && new Date(l.nextDueDate) < now
    );
    if (hasOverdue) return { label: 'Warning', color: 'badge-overdue' };

    const hasActive = loansList.some(l => l.status === 'active');
    if (hasActive) return { label: 'Good Standing', color: 'badge-success' };

    return { label: 'Closed', color: 'badge-neutral' };
};

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export default function CustomerLoans() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [customer, setCustomer] = useState(null);
    const [loans, setLoans] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingPayments, setLoadingPayments] = useState(false);
    const [activeTab, setActiveTab] = useState('loans');

    // Edit Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editFormData, setEditFormData] = useState({
        name: '',
        phone: '',
        aadharNumber: '',
        address: '',
        optOutWhatsapp: false,
    });
    const [updatingCustomer, setUpdatingCustomer] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            const [custData, loansData] = await Promise.all([
                api.getCustomer(id),
                api.getLoans(`customerId=${id}`)
            ]);
            setCustomer(custData);
            const loansList = loansData.loans || [];
            setLoans(loansList);

            // Fetch payments across all customer loans
            setLoadingPayments(true);
            const paymentsPromises = loansList.map(loan => 
                api.getPayments(loan.id)
                    .then(res => (res || []).map(p => ({ 
                        ...p, 
                        loanId: loan.id, 
                        loanCode: loan.loanId || loan.id.slice(0, 8),
                        vehicleModel: loan.vehicle?.model
                    })))
                    .catch(err => {
                        console.error(`Failed to load payments for loan ${loan.id}:`, err);
                        return [];
                    })
            );
            const allPaymentsList = await Promise.all(paymentsPromises);
            const flattenedPayments = allPaymentsList.flat().sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
            setPayments(flattenedPayments);
        } catch (err) {
            console.error('Failed to load customer details:', err);
        } finally {
            setLoading(false);
            setLoadingPayments(false);
        }
    };

    useEffect(() => {
        console.log('CustomerLoans mounting for ID:', id);
        loadData();
    }, [id]);

    const openEditModal = () => {
        setEditFormData({
            name: customer.name || '',
            phone: customer.phone || '',
            aadharNumber: customer.aadharNumber ? formatAadhaar(customer.aadharNumber) : '',
            address: customer.address || '',
            optOutWhatsapp: customer.optOutWhatsapp || false,
        });
        setShowEditModal(true);
    };

    const handleUpdateCustomerSubmit = async (e) => {
        e.preventDefault();
        try {
            setUpdatingCustomer(true);
            const updated = await api.updateCustomer(id, {
                ...editFormData,
                aadharNumber: editFormData.aadharNumber.replace(/\s/g, ''),
            });
            setCustomer(prev => ({ ...prev, ...updated }));
            setShowEditModal(false);
        } catch (err) {
            alert(err.message || 'Failed to update customer details');
        } finally {
            setUpdatingCustomer(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <span className="loading-spinner" />
                <p className="text-slate-500 mt-4">Loading customer dashboard...</p>
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="card text-center py-12" style={{ maxWidth: 600, margin: '40px auto' }}>
                <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
                <h2 className="text-xl font-bold text-slate-800">Customer not found</h2>
                <button className="btn btn-primary mt-6" onClick={() => navigate('/customers')}>
                    Back to Customers
                </button>
            </div>
        );
    }

    // Calculations for KPIs
    const totalPrincipalBorrowed = loans.reduce((sum, loan) => sum + Number(loan.principalAmount || 0), 0);
    const totalOutstanding = loans.reduce((sum, loan) => sum + Number(loan.totalOutstanding || 0), 0);
    const totalRepaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const activeLoans = loans.filter(l => l.status === 'active' || l.status === 'defaulter');
    const closedLoansCount = loans.filter(l => ['closed', 'completed', 'settled'].includes(l.status?.toLowerCase())).length;

    const standing = getOverallStanding(loans);

    // Dynamic WhatsApp url
    const formattedPhone = customer.phone.replace(/\D/g, '');
    const waUrl = `https://wa.me/91${formattedPhone}`;

    return (
        <div className="animate-fade-in" style={{ maxWidth: 1200, margin: '0 auto', overflow: 'hidden' }}>
            <style>{`
                .profile-grid {
                    display: grid;
                    grid-template-columns: 320px 1fr;
                    gap: var(--space-6);
                    height: calc(100vh - var(--header-height) - 150px);
                    max-height: 680px;
                    min-height: 520px;
                    overflow: hidden;
                    margin-bottom: 0;
                }
                @media (max-width: 900px) {
                    .profile-grid {
                        grid-template-columns: 1fr;
                        height: auto;
                        max-height: none;
                        overflow: visible;
                    }
                }
                .profile-card {
                    background: var(--color-bg-card);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-lg);
                    padding: var(--space-6);
                    box-shadow: var(--shadow-sm);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    height: 100%;
                    overflow-y: auto;
                }
                @media (max-width: 900px) {
                    .profile-card {
                        height: auto;
                    }
                }
                .profile-avatar-wrapper {
                    position: relative;
                    margin-bottom: var(--space-4);
                }
                .profile-avatar {
                    width: 84px;
                    height: 84px;
                    border-radius: 50%;
                    background: #f1f5f9;
                    color: #1e293b;
                    font-size: 30px;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 3px solid var(--color-border);
                }
                .profile-info-list {
                    width: 100%;
                    margin-top: var(--space-4);
                    text-align: left;
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3);
                    border-top: 1px solid var(--color-border);
                    padding-top: var(--space-4);
                }
                .profile-info-item {
                    display: flex;
                    align-items: flex-start;
                    gap: var(--space-3);
                    font-size: var(--font-size-sm);
                    color: var(--color-text-secondary);
                }
                .profile-info-icon {
                    color: var(--slate-400);
                    margin-top: 2px;
                    flex-shrink: 0;
                }
                .profile-actions-three-row {
                    width: 100%;
                    margin-top: var(--space-5);
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                }
                
                .right-column {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-5);
                    height: 100%;
                    overflow: hidden;
                }
                @media (max-width: 900px) {
                    .right-column {
                        height: auto;
                        overflow: visible;
                    }
                }

                .kpi-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: var(--space-4);
                    flex-shrink: 0;
                }
                @media (max-width: 1100px) {
                    .kpi-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
                @media (max-width: 600px) {
                    .kpi-grid {
                        grid-template-columns: 1fr;
                    }
                }
                .kpi-card-v2 {
                    background: var(--color-bg-card);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-lg);
                    padding: var(--space-4) var(--space-5);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    box-shadow: var(--shadow-sm);
                    height: 84px;
                    transition: transform var(--transition-base), border-color var(--transition-base), box-shadow var(--transition-base);
                }
                .kpi-card-v2:hover {
                    transform: translateY(-2px);
                    border-color: var(--slate-300);
                    box-shadow: var(--shadow-md);
                }
                .kpi-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    color: var(--color-text-muted);
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 4px;
                }
                .kpi-card-icon {
                    padding: 5px;
                    border-radius: var(--radius-sm);
                    background: var(--slate-100);
                    color: var(--slate-600);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .kpi-card-value {
                    font-size: 18px;
                    font-weight: 700;
                    color: var(--color-text-primary);
                }

                .custom-tabs {
                    display: inline-flex;
                    background: var(--slate-150);
                    padding: 4px;
                    border-radius: var(--radius-md);
                    gap: 6px;
                    flex-shrink: 0;
                    margin-bottom: var(--space-1);
                    align-self: flex-start;
                    border: 1px solid var(--color-border);
                }
                .custom-tab-btn {
                    padding: 6px 14px;
                    border-radius: 6px;
                    border: none;
                    background: none;
                    font-family: var(--font-family);
                    font-size: var(--font-size-sm);
                    font-weight: 600;
                    color: var(--slate-500);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    transition: all var(--transition-fast);
                }
                .custom-tab-btn:hover {
                    color: var(--slate-800);
                }
                .custom-tab-btn.active {
                    background: #ffffff;
                    color: var(--slate-900);
                    box-shadow: var(--shadow-sm);
                }
                .tab-count {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 18px;
                    height: 18px;
                    padding: 0 5px;
                    font-size: 10px;
                    font-weight: 700;
                    border-radius: var(--radius-full);
                    background: var(--slate-200);
                    color: var(--slate-700);
                    margin-left: 8px;
                    transition: all var(--transition-fast);
                }
                .custom-tab-btn.active .tab-count {
                    background: var(--slate-900);
                    color: #ffffff;
                }

                .tab-content-wrapper {
                    flex: 1;
                    overflow-y: auto;
                    padding-right: 8px;
                }
                @media (max-width: 900px) {
                    .tab-content-wrapper {
                        overflow-y: visible;
                    }
                }

                .loan-card {
                    background: var(--color-bg-card);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-lg);
                    padding: var(--space-5);
                    margin-bottom: var(--space-4);
                    box-shadow: var(--shadow-sm);
                    transition: transform var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
                }
                .loan-card:hover {
                    border-color: var(--slate-300);
                    box-shadow: var(--shadow-md);
                    transform: translateY(-1px);
                }
                .loan-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    border-bottom: 1px solid var(--color-border);
                    padding-bottom: var(--space-3);
                    margin-bottom: var(--space-4);
                }
                .loan-card-title {
                    font-size: var(--font-size-base);
                    font-weight: 700;
                    color: var(--slate-900);
                }
                .loan-card-subtitle {
                    font-size: var(--font-size-xs);
                    color: var(--slate-500);
                    margin-top: 2px;
                }
                .loan-card-body {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: var(--space-4);
                    margin-bottom: var(--space-4);
                }
                .loan-card-stat {
                    display: flex;
                    flex-direction: column;
                }
                .loan-card-stat-label {
                    font-size: 10px;
                    color: var(--color-text-muted);
                    text-transform: uppercase;
                    font-weight: 500;
                }
                .loan-card-stat-value {
                    font-size: var(--font-size-sm);
                    font-weight: 600;
                    color: var(--slate-800);
                    margin-top: 2px;
                }
                .loan-progress-section {
                    margin-bottom: var(--space-4);
                }
                .loan-progress-header {
                    display: flex;
                    justify-content: space-between;
                    font-size: 11px;
                    color: var(--color-text-secondary);
                    font-weight: 500;
                    margin-bottom: 4px;
                }
                .loan-progress-bar-bg {
                    height: 6px;
                    background: var(--slate-100);
                    border-radius: var(--radius-full);
                    overflow: hidden;
                }
                .loan-progress-bar-fill {
                    height: 100%;
                    background: var(--brand-accent);
                    border-radius: var(--radius-full);
                }
                .loan-card-vehicle {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: var(--space-3) var(--space-4);
                    background: var(--slate-50);
                    border-radius: var(--radius-md);
                    font-size: var(--font-size-sm);
                }
                .loan-card-vehicle-left {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    font-weight: 600;
                    color: var(--slate-800);
                }
                .loan-card-vehicle-plate {
                    font-family: 'SF Mono', 'Fira Code', monospace;
                    font-size: var(--font-size-xs);
                    color: var(--slate-500);
                }

                .vehicle-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: var(--space-4);
                }
                .vehicle-card {
                    background: var(--color-bg-card);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-lg);
                    padding: var(--space-5);
                    box-shadow: var(--shadow-sm);
                }
                .vehicle-card-header {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3);
                    margin-bottom: var(--space-4);
                    border-bottom: 1px solid var(--color-border);
                    padding-bottom: var(--space-3);
                }
                .vehicle-card-title {
                    font-size: var(--font-size-base);
                    font-weight: 700;
                    color: var(--slate-900);
                }
                .vehicle-details {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .vehicle-detail-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: var(--font-size-sm);
                }
                .vehicle-detail-label {
                    color: var(--color-text-muted);
                }
                .vehicle-detail-value {
                    font-weight: 500;
                    color: var(--color-text-primary);
                    font-family: 'SF Mono', monospace;
                }
            `}</style>

            {/* Header / Breadcrumb */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
                <button 
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors btn btn-ghost btn-sm"
                    onClick={() => navigate('/customers')}
                    style={{ paddingLeft: 0, paddingRight: 0 }}
                >
                    <ChevronLeft size={16} /> Back to Customers
                </button>
            </div>

            {/* Layout Grid Container */}
            <div className="profile-grid">
                
                {/* Left Column: Profile Card */}
                <div className="profile-card">
                    <div className="profile-avatar-wrapper">
                        <div className="profile-avatar">
                            {getInitials(customer.name)}
                        </div>
                    </div>
                    
                    <h2 className="text-slate-900 font-bold" style={{ fontSize: '1.25rem', marginTop: 'var(--space-1)', marginBottom: '4px' }}>{customer.name}</h2>
                    
                    <span className={`badge ${standing.color}`} style={{ marginBottom: 'var(--space-2)' }}>
                        {standing.label}
                    </span>

                    <p className="text-xs text-slate-500 mt-0.5">Borrower Profile</p>
                    
                    <div className="profile-info-list">
                        <div className="profile-info-item">
                            <Phone size={16} className="profile-info-icon" />
                            <div>
                                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Phone Number</div>
                                <div className="font-semibold text-slate-850 text-sm">{customer.phone}</div>
                            </div>
                        </div>

                        {customer.altPhone && customer.altPhone.length > 0 && (
                            <div className="profile-info-item">
                                <Phone size={16} className="profile-info-icon" />
                                <div>
                                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Alternate Phone</div>
                                    <div className="font-semibold text-slate-850 text-sm">{customer.altPhone.join(', ')}</div>
                                </div>
                            </div>
                        )}

                        <div className="profile-info-item">
                            <CreditCard size={16} className="profile-info-icon" />
                            <div>
                                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Aadhaar Number</div>
                                <div className="font-mono font-semibold text-slate-850 text-sm">
                                    {customer.aadharNumber ? formatAadhaar(customer.aadharNumber) : '—'}
                                </div>
                            </div>
                        </div>

                        <div className="profile-info-item">
                            <MapPin size={16} className="profile-info-icon" />
                            <div>
                                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Address</div>
                                <div className="text-slate-850 text-sm" style={{ lineHeight: 1.4 }}>{customer.address || '—'}</div>
                            </div>
                        </div>

                        <div className="profile-info-item">
                            <Calendar size={16} className="profile-info-icon" />
                            <div>
                                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Registration Date</div>
                                <div className="text-slate-850 font-semibold text-sm">{formatDate(customer.createdAt)}</div>
                            </div>
                        </div>
                    </div>

                    <div className="profile-actions-three-row">
                        <button 
                            className="btn btn-secondary btn-sm" 
                            onClick={openEditModal} 
                            style={{ height: '36px', fontSize: '11px', padding: '0 4px', width: '100%' }}
                            title="Edit Borrower Profile"
                        >
                            <Pencil size={12} /> Edit
                        </button>
                        <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => navigate(`/loans/new?customer=${customer.id}`)}
                            style={{ height: '36px', fontSize: '11px', padding: '0 4px', width: '100%' }}
                            title="Disburse New Loan"
                        >
                            <PlusCircle size={12} /> + Loan
                        </button>
                        <button 
                            className="btn btn-action-outline btn-sm"
                            onClick={() => window.open(waUrl, '_blank')}
                            style={{ height: '36px', fontSize: '11px', padding: '0 4px', width: '100%' }}
                            title="Contact WhatsApp"
                        >
                            WhatsApp
                        </button>
                    </div>
                </div>

                {/* Right Column: KPIs + Tab Panel */}
                <div className="right-column">
                    
                    {/* Financial KPIs Row */}
                    <div className="kpi-grid">
                        <div className="kpi-card-v2">
                            <div className="kpi-card-header">
                                <span>Outstanding</span>
                                <div className="kpi-card-icon" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
                                    <AlertCircle size={12} />
                                </div>
                            </div>
                            <div className="kpi-card-value" style={{ color: totalOutstanding > 0 ? 'var(--color-danger)' : 'inherit' }}>
                                {formatCurrency(totalOutstanding)}
                            </div>
                        </div>

                        <div className="kpi-card-v2">
                            <div className="kpi-card-header">
                                <span>Total Borrowed</span>
                                <div className="kpi-card-icon" style={{ background: 'var(--slate-100)', color: 'var(--slate-600)' }}>
                                    <DollarSign size={12} />
                                </div>
                            </div>
                            <div className="kpi-card-value">
                                {formatCurrency(totalPrincipalBorrowed)}
                            </div>
                        </div>

                        <div className="kpi-card-v2">
                            <div className="kpi-card-header">
                                <span>Total Repaid</span>
                                <div className="kpi-card-icon" style={{ background: 'var(--brand-accent-bg)', color: 'var(--brand-accent)' }}>
                                    <CheckCircle2 size={12} />
                                </div>
                            </div>
                            <div className="kpi-card-value" style={{ color: totalRepaid > 0 ? 'var(--brand-accent)' : 'inherit' }}>
                                {formatCurrency(totalRepaid)}
                            </div>
                        </div>

                        <div className="kpi-card-v2">
                            <div className="kpi-card-header">
                                <span>Accounts Ratio</span>
                                <div className="kpi-card-icon" style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
                                    <Layers size={12} />
                                </div>
                            </div>
                            <div className="kpi-card-value">
                                {activeLoans.length}A <span style={{ color: 'var(--slate-200)' }}>/</span> {closedLoansCount}C
                            </div>
                        </div>
                    </div>

                    {/* Tab Navigation Panel */}
                    <div className="custom-tabs">
                        <button 
                            className={`custom-tab-btn ${activeTab === 'loans' ? 'active' : ''}`}
                            onClick={() => setActiveTab('loans')}
                        >
                            Loans <span className="tab-count">{loans.length}</span>
                        </button>
                        <button 
                            className={`custom-tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
                            onClick={() => setActiveTab('payments')}
                        >
                            Payments Ledger <span className="tab-count">{payments.length}</span>
                        </button>
                        <button 
                            className={`custom-tab-btn ${activeTab === 'vehicles' ? 'active' : ''}`}
                            onClick={() => setActiveTab('vehicles')}
                        >
                            Collateral Vehicles <span className="tab-count">{(customer.vehicles || []).length}</span>
                        </button>
                    </div>

                    {/* Tab Content Area (Scrolls Internally) */}
                    <div className="tab-content-wrapper">
                        
                        {/* A. LOANS TAB */}
                        {activeTab === 'loans' && (
                            <div>
                                {loans.length === 0 ? (
                                    <div className="card text-center py-10" style={{ background: 'var(--color-bg-card)' }}>
                                        <FileText size={42} className="mx-auto text-slate-300 mb-3 opacity-50" />
                                        <h3 className="text-slate-800 font-semibold mb-1 text-sm">No active loans found</h3>
                                        <p className="text-slate-500 text-xs mb-4">This borrower does not have any loans registered.</p>
                                        <button 
                                            className="btn btn-primary btn-sm"
                                            onClick={() => navigate(`/loans/new?customer=${customer.id}`)}
                                        >
                                            + Disburse New Loan
                                        </button>
                                    </div>
                                ) : (
                                    loans.map((loan) => {
                                        const progressPercent = loan.totalDues > 0 
                                            ? Math.round((loan.paidDues / loan.totalDues) * 100)
                                            : 0;

                                        return (
                                            <div 
                                                key={loan.id} 
                                                className="loan-card"
                                                onClick={() => navigate(`/loans/${loan.id}`)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <div className="loan-card-header">
                                                    <div>
                                                        <div className="loan-card-title flex items-center gap-2">
                                                            <span>#{loan.loanId || loan.id.slice(0, 8)}</span>
                                                            <span className={`badge ${getStatusBadge(loan.status)}`} style={{ padding: '3px 8px', fontSize: '9px' }}>
                                                                {loan.status}
                                                            </span>
                                                        </div>
                                                        <div className="loan-card-subtitle">
                                                            Disbursed {formatDate(loan.startDate)}
                                                        </div>
                                                    </div>
                                                    <button 
                                                        className="btn btn-sm btn-action-outline"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/loans/${loan.id}`);
                                                        }}
                                                        style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
                                                    >
                                                        Manage <ExternalLink size={11} className="ml-1" />
                                                    </button>
                                                </div>

                                                <div className="loan-card-body">
                                                    <div className="loan-card-stat">
                                                        <span className="loan-card-stat-label">Principal</span>
                                                        <span className="loan-card-stat-value text-slate-900">{formatCurrency(loan.principalAmount)}</span>
                                                    </div>
                                                    <div className="loan-card-stat">
                                                        <span className="loan-card-stat-label">Monthly EMI</span>
                                                        <span className="loan-card-stat-value text-slate-950 font-bold">{formatCurrency(loan.monthlyDueAmount)}</span>
                                                    </div>
                                                    <div className="loan-card-stat">
                                                        <span className="loan-card-stat-label">Outstanding</span>
                                                        <span className="loan-card-stat-value text-slate-900" style={{ color: Number(loan.totalOutstanding) > 0 ? 'var(--color-danger)' : 'inherit' }}>
                                                            {formatCurrency(loan.totalOutstanding || 0)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="loan-progress-section">
                                                    <div className="loan-progress-header">
                                                        <span>EMI Installments Progress</span>
                                                        <span className="font-semibold">{loan.paidDues || 0} / {loan.totalDues || 0} Paid ({progressPercent}%)</span>
                                                    </div>
                                                    <div className="loan-progress-bar-bg">
                                                        <div className="loan-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
                                                    </div>
                                                </div>

                                                {loan.vehicle && (
                                                    <div className="loan-card-vehicle">
                                                        <div className="loan-card-vehicle-left">
                                                            {loan.vehicle.type === 'bike' ? <Bike size={14} /> : <Car size={14} />}
                                                            <span>{loan.vehicle.model}</span>
                                                        </div>
                                                        <span className="loan-card-vehicle-plate">{loan.vehicle.vehicleNumber}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* B. PAYMENTS LEDGER TAB */}
                        {activeTab === 'payments' && (
                            <div className="table-container shadow-sm border border-slate-200">
                                {loadingPayments ? (
                                    <div className="flex flex-col items-center justify-center py-8">
                                        <span className="loading-spinner" />
                                        <p className="text-slate-500 text-xs mt-2">Aggregating payments...</p>
                                    </div>
                                ) : payments.length === 0 ? (
                                    <div className="empty-state-inline py-10">
                                        <div className="empty-icon" style={{ width: '48px', height: '48px' }}><FileText size={20} /></div>
                                        <div className="empty-title text-sm">No Payments Recorded</div>
                                        <div className="empty-desc text-xs">This customer has not made any payments yet.</div>
                                    </div>
                                ) : (
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                <th className="px-5 py-3 text-left">Date</th>
                                                <th className="px-5 py-3 text-left">Loan</th>
                                                <th className="px-5 py-3 text-left">Vehicle</th>
                                                <th className="px-5 py-3 text-right">Amount</th>
                                                <th className="px-5 py-3 text-center">Method</th>
                                                <th className="px-5 py-3 text-right">Reference</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {payments.map((p) => (
                                                <tr key={p.id} className="hover:bg-slate-50 transition-colors" style={{ height: '40px' }}>
                                                    <td className="px-5 py-3 text-left font-semibold text-slate-900">
                                                        {formatDate(p.paymentDate)}
                                                    </td>
                                                    <td className="px-5 py-3 text-left">
                                                        <button 
                                                            className="text-slate-700 font-bold hover:underline"
                                                            onClick={() => navigate(`/loans/${p.loanId}`)}
                                                            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: '12px' }}
                                                        >
                                                            #{p.loanCode}
                                                        </button>
                                                    </td>
                                                    <td className="px-5 py-3 text-left text-slate-600">
                                                        {p.vehicleModel || '—'}
                                                    </td>
                                                    <td className="px-5 py-3 text-right font-bold text-emerald-600">
                                                        {formatCurrency(p.amount)}
                                                    </td>
                                                    <td className="px-5 py-3 text-center">
                                                        <span className="badge badge-success text-[10px] uppercase" style={{ padding: '2px 8px' }}>
                                                            {p.paymentMethod || 'cash'}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 text-right font-mono text-xs text-slate-500">
                                                        {p.referenceNumber || '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}

                        {/* C. VEHICLES TAB */}
                        {activeTab === 'vehicles' && (
                            <div className="vehicle-grid">
                                {(!customer.vehicles || customer.vehicles.length === 0) ? (
                                    <div className="card text-center py-10 w-full" style={{ gridColumn: '1 / -1' }}>
                                        <Car size={42} className="mx-auto text-slate-300 mb-3 opacity-50" />
                                        <h3 className="text-slate-800 font-semibold mb-1 text-sm">No Collateral Vehicles</h3>
                                        <p className="text-slate-500 text-xs">There are no vehicles linked to this customer.</p>
                                    </div>
                                ) : (
                                    customer.vehicles.map((v) => (
                                        <div key={v.id} className="vehicle-card">
                                            <div className="vehicle-card-header">
                                                <div className="kpi-card-icon" style={{ background: 'var(--slate-100)', padding: '5px' }}>
                                                    <Car size={16} />
                                                </div>
                                                <div className="vehicle-card-title">{v.model || 'Unknown Collateral'}</div>
                                            </div>
                                            <div className="vehicle-details">
                                                <div className="vehicle-detail-row">
                                                    <span className="vehicle-detail-label">License Plate</span>
                                                    <span className="vehicle-detail-value text-slate-900" style={{ fontWeight: 'bold' }}>{v.vehicleNumber}</span>
                                                </div>
                                                <div className="vehicle-detail-row">
                                                    <span className="vehicle-detail-label">Engine No</span>
                                                    <span className="vehicle-detail-value">{v.engineNumber || '—'}</span>
                                                </div>
                                                <div className="vehicle-detail-row">
                                                    <span className="vehicle-detail-label">Chassis No</span>
                                                    <span className="vehicle-detail-value">{v.chassisNumber || '—'}</span>
                                                </div>
                                                <div className="vehicle-detail-row">
                                                    <span className="vehicle-detail-label">Insurance Valid</span>
                                                    <span className="vehicle-detail-value text-slate-800" style={{ fontFamily: 'inherit' }}>
                                                        {v.insuranceValidTill ? formatDate(v.insuranceValidTill) : '—'}
                                                    </span>
                                                </div>
                                                {v.rcImageUrl && (
                                                    <div className="vehicle-detail-row" style={{ marginTop: '6px' }}>
                                                        <span className="vehicle-detail-label">RC PDF/Image</span>
                                                        <button 
                                                            className="btn btn-ghost btn-sm" 
                                                            style={{ height: 'auto', padding: '3px 8px', fontSize: '11px' }}
                                                            onClick={() => window.open(v.rcImageUrl, '_blank')}
                                                        >
                                                            View File
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* EDIT CUSTOMER MODAL */}
            {showEditModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h2 className="text-slate-900 font-bold">Edit Customer Profile</h2>
                            <button 
                                className="btn-icon" 
                                onClick={() => setShowEditModal(false)}
                                style={{ fontSize: '20px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                            >
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleUpdateCustomerSubmit}>
                            <div className="modal-body flex flex-col gap-4">
                                <div className="form-group">
                                    <label className="form-label">Full Name *</label>
                                    <input 
                                        className="form-input" 
                                        type="text" 
                                        required 
                                        value={editFormData.name} 
                                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phone Number *</label>
                                    <input 
                                        className="form-input" 
                                        type="text" 
                                        required 
                                        value={editFormData.phone} 
                                        onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Aadhaar Card Number</label>
                                    <input 
                                        className="form-input" 
                                        type="text" 
                                        value={editFormData.aadharNumber} 
                                        onChange={(e) => setEditFormData({ ...editFormData, aadharNumber: formatAadhaar(e.target.value) })} 
                                        placeholder="XXXX XXXX XXXX"
                                        maxLength={14}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Address Description</label>
                                    <textarea 
                                        className="form-textarea" 
                                        value={editFormData.address} 
                                        onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })} 
                                        rows={3} 
                                    />
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <input 
                                        type="checkbox" 
                                        id="optOutWhatsapp"
                                        checked={editFormData.optOutWhatsapp} 
                                        onChange={(e) => setEditFormData({ ...editFormData, optOutWhatsapp: e.target.checked })} 
                                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                    />
                                    <label htmlFor="optOutWhatsapp" className="form-label" style={{ cursor: 'pointer', userSelect: 'none' }}>
                                        Opt out of automated WhatsApp messages
                                    </label>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button 
                                    type="button" 
                                    className="btn btn-secondary btn-sm" 
                                    onClick={() => setShowEditModal(false)}
                                    disabled={updatingCustomer}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn btn-primary btn-sm" 
                                    disabled={updatingCustomer}
                                >
                                    {updatingCustomer ? <span className="loading-spinner" /> : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

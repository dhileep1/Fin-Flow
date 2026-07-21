import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { 
    ChevronLeft, Bike, Wrench, ShieldAlert, BadgeAlert, CheckCircle, 
    Calendar, User, FileText, IndianRupee, Tag, Plus, X, Trash2, Clock 
} from 'lucide-react';

const formatCurrency = (amount) =>
    `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function VehicleDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    
    const [vehicle, setVehicle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Add Expense State
    const [showAddExpense, setShowAddExpense] = useState(false);
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseCategory, setExpenseCategory] = useState('reconditioning');
    const [expenseDescription, setExpenseDescription] = useState('');
    const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [savingExpense, setSavingExpense] = useState(false);
    const [expenseError, setExpenseError] = useState('');

    useEffect(() => {
        loadVehicleDetails();
    }, [id]);

    const loadVehicleDetails = async () => {
        try {
            setLoading(true);
            const data = await api.getVehicle(id);
            setVehicle(data);
        } catch (err) {
            setError(err.message || 'Failed to load vehicle details');
        } finally {
            setLoading(false);
        }
    };

    const handleAddExpense = async (e) => {
        e.preventDefault();
        if (!expenseAmount || Number(expenseAmount) <= 0) {
            setExpenseError('Please enter a valid expense amount');
            return;
        }
        setSavingExpense(true);
        setExpenseError('');
        try {
            await api.createExpense({
                amount: Number(expenseAmount),
                category: expenseCategory,
                description: expenseDescription || `Spent on vehicle ${vehicle.vehicleNumber}`,
                expenseDate,
                vehicleId: id,
                tags: ['vehicle', vehicle.vehicleNumber]
            });
            setShowAddExpense(false);
            setExpenseAmount('');
            setExpenseDescription('');
            // Refresh details
            await loadVehicleDetails();
        } catch (err) {
            setExpenseError(err.message || 'Failed to record expense');
        } finally {
            setSavingExpense(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', color: '#64748b' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '40px', height: '40px', border: '3px solid #cbd5e1', borderTopColor: 'var(--brand-accent)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px auto' }} />
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>Loading vehicle history...</p>
                </div>
            </div>
        );
    }

    if (error || !vehicle) {
        return (
            <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
                <button onClick={() => navigate('/vehicles')} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: 'none', background: 'none', color: '#64748b', fontWeight: 600, cursor: 'pointer', marginBottom: '24px' }}>
                    <ChevronLeft size={20} /> Back to Vehicles
                </button>
                <div style={{ padding: '32px', background: '#fff1f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#991b1b', textAlign: 'center' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 700 }}>Error Loading Vehicle</h3>
                    <p style={{ margin: 0, fontSize: '14px' }}>{error || 'Vehicle not found'}</p>
                </div>
            </div>
        );
    }

    // Calculate total spent on expenses
    const totalExpenses = (vehicle.expenses || []).reduce((sum, e) => sum + Number(e.amount), 0);

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Navigation Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button 
                    onClick={() => navigate('/vehicles')} 
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', border: 'none', background: 'none', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}
                >
                    <ChevronLeft size={20} /> Back to Vehicles
                </button>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={() => setShowAddExpense(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'var(--brand-accent)',
                            color: '#ffffff',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '13.5px'
                        }}
                    >
                        <Plus size={16} /> Log Vehicle Expense
                    </button>
                </div>
            </div>

            {/* Vehicle Master Info Card */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px 24px', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '24px', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', color: 'var(--brand-accent)' }}>
                    <Bike size={36} />
                </div>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                        <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                            {vehicle.vehicleNumber}
                        </h2>
                        <span style={{ 
                            fontSize: '11px', 
                            fontWeight: 700, 
                            textTransform: 'uppercase', 
                            padding: '4px 10px', 
                            borderRadius: '20px',
                            background: vehicle.status === 'seized' ? '#fff1f2' : (vehicle.status === 'sold' ? '#f0fdf4' : '#eff6ff'),
                            color: vehicle.status === 'seized' ? '#e11d48' : (vehicle.status === 'sold' ? '#166534' : '#1d4ed8')
                        }}>
                            {vehicle.status}
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 24px', fontSize: '13px', color: '#64748b' }}>
                        <span>Model: <strong style={{ color: '#334155' }}>{vehicle.model || '—'}</strong></span>
                        <span>Engine: <strong style={{ color: '#334155' }}>{vehicle.engineNumber || '—'}</strong></span>
                        <span>Chassis: <strong style={{ color: '#334155' }}>{vehicle.chassisNumber || '—'}</strong></span>
                        <span>Insurance Valid Till: <strong style={{ color: '#334155' }}>{formatDate(vehicle.insuranceValidTill)}</strong></span>
                    </div>
                </div>
                <div style={{ textAlign: 'right', borderLeft: '1px solid #cbd5e1', paddingLeft: '24px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Total Expenses Added</span>
                    <strong style={{ fontSize: '20px', fontWeight: 800, color: '#e11d48' }}>
                        {formatCurrency(totalExpenses)}
                    </strong>
                </div>
            </div>

            {/* Split layout: History Timeline vs Expenses */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
                
                {/* Left Panel: Ownership and Loan Events */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* Associated Loans & Owner History */}
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', margin: '0 0 16px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                            Ownership & Loans History
                        </h3>
                        
                        {(vehicle.loans || []).length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13.5px' }}>
                                No loans associated with this vehicle.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {vehicle.loans.map((loan, idx) => {
                                    // Calculate total collected on this loan
                                    const collected = (loan.payments || [])
                                        .reduce((sum, p) => sum + Number(p.amount), 0);

                                    return (
                                        <div 
                                            key={loan.id} 
                                            style={{ 
                                                border: '1px solid #e2e8f0', 
                                                borderRadius: '12px', 
                                                padding: '16px',
                                                background: idx === 0 ? '#f8fafc' : '#ffffff',
                                                position: 'relative'
                                            }}
                                        >
                                            {idx === 0 && (
                                                <span style={{ position: 'absolute', top: '12px', right: '12px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: '#1d4ed8', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>
                                                    Current/Latest
                                                </span>
                                            )}

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <Link 
                                                    to={`/loans/${loan.id}`} 
                                                    style={{ textDecoration: 'none', fontSize: '14px', fontWeight: 700, color: 'var(--brand-accent)' }}
                                                >
                                                    Loan Principal: {formatCurrency(loan.principalAmount)}
                                                </Link>
                                                <span style={{ 
                                                    fontSize: '11px', 
                                                    fontWeight: 600, 
                                                    padding: '2px 8px', 
                                                    borderRadius: '4px',
                                                    background: loan.status === 'active' ? '#eff6ff' : (loan.status === 'settled' || loan.status === 'closed' ? '#f0fdf4' : '#f8fafc'),
                                                    color: loan.status === 'active' ? '#1d4ed8' : (loan.status === 'settled' || loan.status === 'closed' ? '#166534' : '#64748b'),
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {loan.status}
                                                </span>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', fontSize: '12.5px', color: '#64748b' }}>
                                                <div>
                                                    Owner Customer:<br />
                                                    <strong style={{ color: '#334155' }}>{loan.customer?.name}</strong> <span style={{ fontSize: '11px' }}>({loan.customer?.phone})</span>
                                                </div>
                                                <div>
                                                    Tenure / Start Date:<br />
                                                    <strong style={{ color: '#334155' }}>{loan.tenureMonths} Months</strong> | {formatDate(loan.createdAt)}
                                                </div>
                                                <div>
                                                    Total Collected on Loan:<br />
                                                    <strong style={{ color: '#166534' }}>{formatCurrency(collected)}</strong>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Seizures & Sales Timeline Events */}
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', margin: '0 0 16px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                            Asset Seizures & Sales Timeline
                        </h3>

                        {((vehicle.seizures || []).length === 0 && (vehicle.vehicleSales || []).length === 0) ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13.5px' }}>
                                No seizure or resale records registered for this vehicle.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '2px solid #e2e8f0', paddingLeft: '16px', marginLeft: '8px' }}>
                                
                                {/* List Seizure logs */}
                                {(vehicle.seizures || []).map((seizure) => (
                                    <div key={seizure.id} style={{ position: 'relative', marginBottom: '4px' }}>
                                        <div style={{ position: 'absolute', top: '4px', left: '-23px', width: '12px', height: '12px', borderRadius: '50%', background: '#e11d48', border: '2px solid #ffffff' }} />
                                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                                            Vehicle Seized
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                                            Date: {formatDate(seizure.seizureDate)} | Status: <strong style={{ textTransform: 'uppercase' }}>{seizure.status}</strong>
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px', fontStyle: 'italic' }}>
                                            Reason: {seizure.reason || 'None specified'} | Handled by: {seizure.user?.name || 'Admin'}
                                        </div>
                                    </div>
                                ))}

                                {/* List Resale logs */}
                                {(vehicle.vehicleSales || []).map((sale) => (
                                    <div key={sale.id} style={{ position: 'relative', marginBottom: '4px' }}>
                                        <div style={{ position: 'absolute', top: '4px', left: '-23px', width: '12px', height: '12px', borderRadius: '50%', background: '#166534', border: '2px solid #ffffff' }} />
                                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                                            Vehicle Sold ({sale.saleType === 'sell_with_finance' ? 'Financed Resale' : 'Outright Sale'})
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                                            Date: {formatDate(sale.saleDate)} | Value: <strong style={{ color: '#166534' }}>{formatCurrency(sale.salePrice)}</strong>
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                                            Buyer: {sale.buyerName} | Phone: {sale.buyerPhone || '—'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>

                {/* Right Panel: Reconditioning and Yard Expenses Log */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                            Vehicle Expenses Log
                        </h3>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                            {vehicle.expenses?.length || 0} Entries
                        </span>
                    </div>

                    {(vehicle.expenses || []).length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13.5px' }}>
                            <Wrench size={32} style={{ margin: '0 auto 8px auto', opacity: 0.5, display: 'block' }} />
                            No expenses logged for this vehicle.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {vehicle.expenses.map((exp) => (
                                <div 
                                    key={exp.id} 
                                    style={{ 
                                        padding: '10px 12px', 
                                        borderRadius: '8px', 
                                        border: '1px solid #e2e8f0',
                                        background: '#f8fafc',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '4px'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ 
                                            fontSize: '10px', 
                                            fontWeight: 700, 
                                            textTransform: 'uppercase', 
                                            background: '#f1f5f9', 
                                            padding: '2px 6px', 
                                            borderRadius: '4px',
                                            color: '#475569'
                                        }}>
                                            {exp.category}
                                        </span>
                                        <strong style={{ fontSize: '13.5px', color: '#e11d48' }}>
                                            {formatCurrency(exp.amount)}
                                        </strong>
                                    </div>
                                    <div style={{ fontSize: '12.5px', color: '#334155', fontWeight: 500 }}>
                                        {exp.description}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                        <span>{formatDate(exp.expenseDate)}</span>
                                        <span>Added by: {exp.creator?.name || 'Staff'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>

            {/* Log Expense Overlay Modal */}
            {showAddExpense && (
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
                    onClick={() => setShowAddExpense(false)}
                >
                    <div 
                        style={{
                            background: '#ffffff',
                            width: '100%',
                            maxWidth: '460px',
                            borderRadius: '16px',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            padding: '24px',
                            position: 'relative'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={() => setShowAddExpense(false)}
                            style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
                            disabled={savingExpense}
                        >
                            <X size={20} />
                        </button>

                        <h3 style={{ fontWeight: 800, fontSize: '18px', color: '#1e293b', marginBottom: '4px', marginTop: 0 }}>
                            Log Vehicle Expense
                        </h3>
                        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0' }}>
                            Add reconditioning, repairs, towing, or yard expenses for vehicle: <strong>{vehicle.vehicleNumber}</strong>
                        </p>

                        {expenseError && (
                            <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', color: 'rgb(239, 68, 68)', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', fontWeight: 500 }}>
                                {expenseError}
                            </div>
                        )}

                        <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Amount (₹) *</label>
                                <input 
                                    type="number" 
                                    className="form-input"
                                    placeholder="Enter amount"
                                    value={expenseAmount}
                                    onChange={(e) => setExpenseAmount(e.target.value)}
                                    style={{ borderRadius: '8px', width: '100%', padding: '8px 12px' }}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Category *</label>
                                <select
                                    className="form-select text-slate-800"
                                    value={expenseCategory}
                                    onChange={(e) => setExpenseCategory(e.target.value)}
                                    style={{ borderRadius: '8px', width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', outline: 'none' }}
                                >
                                    <option value="reconditioning">Reconditioning</option>
                                    <option value="towing">Towing</option>
                                    <option value="yard">Yard Fees</option>
                                    <option value="repairs">Repairs</option>
                                    <option value="other">Other / Miscellaneous</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Expense Date</label>
                                <input 
                                    type="date" 
                                    className="form-input"
                                    value={expenseDate}
                                    onChange={(e) => setExpenseDate(e.target.value)}
                                    style={{ borderRadius: '8px', width: '100%', padding: '8px 12px' }}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Description / Notes</label>
                                <textarea 
                                    className="form-input"
                                    placeholder="Enter detailed notes on this expense"
                                    value={expenseDescription}
                                    onChange={(e) => setExpenseDescription(e.target.value)}
                                    style={{ borderRadius: '8px', width: '100%', padding: '8px 12px', minHeight: '80px', resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '12px', justifyContent: 'flex-end' }}>
                                <button 
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowAddExpense(false)}
                                    disabled={savingExpense}
                                    style={{ minWidth: '100px', borderRadius: '8px' }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={savingExpense}
                                    style={{ minWidth: '140px', borderRadius: '8px' }}
                                >
                                    {savingExpense ? 'Logging...' : 'Log Expense'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

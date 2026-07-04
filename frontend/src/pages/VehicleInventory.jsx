import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Search, Bike, MapPin, ChevronLeft, ChevronRight, Activity, Warehouse, CheckCircle, ShieldAlert, BadgeAlert, ArrowUpRight } from 'lucide-react';

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
    const navigate = useNavigate();

    // Valuation update states
    const [showValuationModal, setShowValuationModal] = useState(false);
    const [selectedSeizure, setSelectedSeizure] = useState(null);
    const [newValuation, setNewValuation] = useState('');
    const [confirmUpdate, setConfirmUpdate] = useState(false);
    const [updatingValuation, setUpdatingValuation] = useState(false);
    const [valuationError, setValuationError] = useState('');

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

    // Calculate metrics based on total list before filtering
    const totalVehicles = vehicles.length;
    const seizedCount = vehicles.filter(v => v.status === 'seized').length;
    const readyForSaleCount = vehicles.filter(v => v.status === 'seized' && v.seizures?.[0]?.valuationAmount && Number(v.seizures[0].valuationAmount) > 0).length;
    const soldCount = vehicles.filter(v => v.status === 'sold').length;

    // Filter logic
    const filteredVehicles = vehicles.filter(v => {
        const latestSeizure = v.seizures?.[0] || {};
        
        let matchesStatus = true;
        if (statusFilter === 'seized') {
            matchesStatus = v.status === 'seized';
        } else if (statusFilter === 'ready_for_sale') {
            matchesStatus = v.status === 'seized' && latestSeizure.valuationAmount && Number(latestSeizure.valuationAmount) > 0;
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
                    color: var(--color-primary);
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
            <div className="kpi-strip" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
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
                        <div className="kpi-icon-wrapper" style={{ background: '#fff1f2', color: '#e11d48' }}>
                            <BadgeAlert size={14} />
                        </div>
                        <span style={{ fontSize: '16px', fontWeight: 800, color: '#e11d48' }}>{readyForSaleCount}</span>
                    </div>
                    <span style={{ color: 'var(--slate-400)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ready For Sale</span>
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
                        className={`sleek-pill-btn ${statusFilter === 'ready_for_sale' ? 'active' : ''}`}
                        onClick={() => { setStatusFilter('ready_for_sale'); setPage(1); }}
                    >
                        Ready for Sale
                    </button>
                    <button 
                        className={`sleek-pill-btn ${statusFilter === 'sold' ? 'active' : ''}`}
                        onClick={() => { setStatusFilter('sold'); setPage(1); }}
                    >
                        Sold
                    </button>
                </div>

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
                                            if (latestSeizure.loanId) {
                                                navigate(`/loans/${latestSeizure.loanId}`);
                                            } else if (latestLoan.id) {
                                                navigate(`/loans/${latestLoan.id}`);
                                            }
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
                                                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
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

                                        {/* 4. STATUS / VALUATION */}
                                        <td className="text-center">
                                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                                {getStatusBadge(v.status)}
                                                
                                                {(v.status === 'seized' || v.status === 'sold') && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '3px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                            <span style={{ fontSize: '10px', color: 'var(--slate-900)', fontWeight: 700 }}>
                                                                {latestSeizure.valuationAmount ? `Value: ${formatCurrency(latestSeizure.valuationAmount)}` : 'No Valuation'}
                                                            </span>
                                                            <button
                                                                title="Update Valuation"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedSeizure(latestSeizure);
                                                                    setNewValuation(latestSeizure.valuationAmount || '');
                                                                    setShowValuationModal(true);
                                                                }}
                                                                style={{
                                                                    background: 'none',
                                                                    border: 'none',
                                                                    cursor: 'pointer',
                                                                    padding: '2px',
                                                                    color: 'var(--slate-400)',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    borderRadius: '4px',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                onMouseOver={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                                                                onMouseOut={(e) => e.currentTarget.style.color = 'var(--slate-400)'}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                            </button>
                                                        </div>
                                                        {/* Yard location display removed */}
                                                    </div>
                                                )}
                                            </div>
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
            {/* Update Valuation Modal */}
            {showValuationModal && selectedSeizure && (
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
                        if (!updatingValuation) {
                            setShowValuationModal(false);
                            setConfirmUpdate(false);
                            setValuationError('');
                        }
                    }}
                >
                    <div 
                        style={{
                            background: '#ffffff',
                            width: '100%',
                            maxWidth: '400px',
                            borderRadius: '16px',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            padding: '24px',
                            position: 'relative'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ fontWeight: 700, fontSize: '18px', color: '#1e293b', marginBottom: '8px' }}>Update Valuation</h3>
                        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                            Update the valuation amount for the seized vehicle.
                        </p>

                        {valuationError && (
                            <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', color: 'rgb(239, 68, 68)', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', fontWeight: 500 }}>
                                {valuationError}
                            </div>
                        )}

                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label className="form-label" style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Valuation Amount (₹)</label>
                            <input 
                                type="number" 
                                className="form-input"
                                placeholder="Enter valuation amount (optional)"
                                value={newValuation}
                                onChange={(e) => setNewValuation(e.target.value)}
                                style={{ borderRadius: '8px', width: '100%' }}
                            />
                        </div>

                        {/* Confirmation Checkbox */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                            <input 
                                type="checkbox" 
                                id="confirmValuationCheck"
                                checked={confirmUpdate}
                                onChange={(e) => setConfirmUpdate(e.target.checked)}
                                style={{ marginTop: '3px', cursor: 'pointer' }}
                            />
                            <label htmlFor="confirmValuationCheck" style={{ fontSize: '12px', color: '#475569', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>
                                I confirm that I want to update the valuation to {newValuation ? `₹${Number(newValuation).toLocaleString('en-IN')}` : 'empty/none'}.
                            </label>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button 
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => {
                                    setShowValuationModal(false);
                                    setConfirmUpdate(false);
                                    setValuationError('');
                                }}
                                disabled={updatingValuation}
                                style={{ flex: 1, borderRadius: '10px' }}
                            >
                                Cancel
                            </button>
                            <button 
                                type="button"
                                className="btn btn-primary"
                                disabled={!confirmUpdate || updatingValuation}
                                onClick={async () => {
                                    setUpdatingValuation(true);
                                    setValuationError('');
                                    try {
                                        await api.updateSeizureValuation(selectedSeizure.id, newValuation ? Number(newValuation) : null);
                                        setShowValuationModal(false);
                                        setConfirmUpdate(false);
                                        loadVehicles(); // Reload the list
                                    } catch (err) {
                                        setValuationError(err.message || 'Failed to update valuation');
                                    } finally {
                                        setUpdatingValuation(false);
                                    }
                                }}
                                style={{ flex: 1, borderRadius: '10px' }}
                            >
                                {updatingValuation ? 'Saving...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

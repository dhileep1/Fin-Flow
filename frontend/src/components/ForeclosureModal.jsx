import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { ShieldCheck, Calendar, DollarSign, Percent } from 'lucide-react';

export default function ForeclosureModal({ loanId, customerName, vehicleNumber, onClose, onSuccess }) {
    const [ratePercentage, setRatePercentage] = useState('3.0');
    const [quote, setQuote] = useState(null);
    const [loadingQuote, setLoadingQuote] = useState(false);
    
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const fetchQuote = async (ratePercentVal) => {
        const rate = Number(ratePercentVal) / 100;
        if (isNaN(rate) || rate < 0) {
            setQuote(null);
            return;
        }
        setLoadingQuote(true);
        setError('');
        try {
            const data = await api.getForeclosureQuote(loanId, rate);
            setQuote(data);
        } catch (err) {
            setError(err.message || 'Failed to calculate quote');
            setQuote(null);
        } finally {
            setLoadingQuote(false);
        }
    };

    useEffect(() => {
        fetchQuote(ratePercentage);
    }, [loanId, ratePercentage]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!quote) return;
        setSubmitting(true);
        setError('');
        try {
            const rate = Number(ratePercentage) / 100;
            await api.forecloseLoan(loanId, {
                foreclosureRate: rate,
                paymentMethod,
                referenceNumber: referenceNumber || undefined,
                paymentDate: paymentDate || undefined,
            });
            onSuccess();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const formatCurrency = (a) => `₹${Number(a || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <ShieldCheck size={18} className="text-emerald-500" /> Foreclose Loan
                    </h2>
                    <button className="btn btn-ghost" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        {error && <div className="login-error">{error}</div>}

                        <div className="card-glass" style={{ padding: 'var(--space-3)', borderLeft: '4px solid var(--color-success)', background: 'linear-gradient(to right, var(--slate-50), #ffffff)' }}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Customer</div>
                                    <div style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '15px' }}>{customerName}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Vehicle</div>
                                    <div style={{ fontWeight: 800, color: 'var(--color-success)', fontSize: '15px', letterSpacing: '-0.02em' }}>
                                        {vehicleNumber}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Percent size={12} /> Foreclosure Interest Rate (% per month)
                            </label>
                            <input
                                className="form-input"
                                type="number"
                                step="0.1"
                                min="0"
                                value={ratePercentage}
                                onChange={(e) => setRatePercentage(e.target.value)}
                                required
                            />
                        </div>

                        {loadingQuote ? (
                            <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--slate-500)' }}>
                                <div className="loading-spinner" style={{ margin: '0 auto var(--space-2)' }} />
                                Calculating Quote...
                            </div>
                        ) : quote ? (
                            <div className="terminal-panel" style={{ padding: 'var(--space-3)', backgroundColor: 'var(--slate-50)' }}>
                                <div className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Foreclosure Statement Quote</div>
                                <div className="flex flex-col gap-1.5 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Loan Principal:</span>
                                        <span className="font-semibold">{formatCurrency(quote.principal)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Elapsed Tenure:</span>
                                        <span className="font-semibold">{quote.elapsedMonths} Months</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">New Interest Rate:</span>
                                        <span className="font-semibold">{Number(ratePercentage).toFixed(2)}%/mo</span>
                                    </div>
                                    <div className="flex justify-between text-emerald-600 font-semibold">
                                        <span className="text-slate-500">Recalculated Interest ({quote.elapsedMonths} mos):</span>
                                        <span>{formatCurrency(quote.newInterestAccrued)}</span>
                                    </div>
                                    {Number(quote.totalPenalties) > 0 && (
                                        <div className="flex justify-between text-red-500">
                                            <span className="text-slate-500">Accrued Penalties:</span>
                                            <span className="font-semibold">{formatCurrency(quote.totalPenalties)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between border-t pt-1 mt-1 text-slate-700">
                                        <span className="text-slate-500">Total Liability:</span>
                                        <span className="font-semibold">{formatCurrency(quote.totalLiability)}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600">
                                        <span className="text-slate-500">Total Paid So Far:</span>
                                        <span className="font-semibold">{formatCurrency(quote.totalPaid)}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-dashed pt-1.5 mt-1.5 text-slate-900" style={{ fontSize: '15px' }}>
                                        <span className="font-bold">Foreclosure Amount Due:</span>
                                        <span className="font-extrabold text-emerald-700">{formatCurrency(quote.foreclosureAmount)}</span>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <DollarSign size={12} /> Payment Method
                            </label>
                            <select
                                className="form-input"
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                            >
                                <option value="cash">Cash</option>
                                <option value="upi">UPI</option>
                                <option value="bank">Bank Transfer</option>
                                <option value="cheque">Cheque</option>
                                <option value="card">Card</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Reference Number (Optional)</label>
                            <input
                                className="form-input"
                                type="text"
                                value={referenceNumber}
                                onChange={(e) => setReferenceNumber(e.target.value)}
                                placeholder="Txn ID, Cheque No, Ref No"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Calendar size={12} /> Payment Date
                            </label>
                            <input
                                className="form-input"
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)', color: '#fff' }} disabled={submitting || !quote}>
                            {submitting ? <span className="loading-spinner" /> : 'Confirm Foreclosure'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

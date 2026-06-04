import React, { useState } from 'react';
import api from '../api/client';
import { IndianRupee, Info } from 'lucide-react';

export default function PaymentModal({ loanId, customerName, outstanding, onClose, onSuccess }) {
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!amount || Number(amount) <= 0) {
            setError('Please enter a valid amount');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            await api.createPayment({
                loanId,
                amount: Number(amount),
                paymentMethod,
                referenceNumber: referenceNumber || undefined,
            });
            onSuccess();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2><IndianRupee size={18} /> Record Payment</h2>
                    <button className="btn btn-ghost" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        {error && <div className="login-error">{error}</div>}

                        <div className="card-glass" style={{ padding: 'var(--space-4)', borderLeft: '4px solid var(--color-warning)', background: 'linear-gradient(to right, var(--slate-50), #ffffff)' }}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Customer</div>
                                    <div style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '18px' }}>{customerName}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Total Outstanding</div>
                                    <div style={{ fontWeight: 800, color: 'var(--color-warning)', fontSize: '20px', letterSpacing: '-0.02em' }}>
                                        ₹{Number(outstanding || 0).toLocaleString('en-IN')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Amount</label>
                            <div className="input-affix-wrapper has-prefix">
                                <span className="input-prefix">₹</span>
                                <input
                                    className="form-input"
                                    type="number"
                                    step="0.01"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="Enter payment amount"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Payment Method</label>
                            <select className="form-select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                                <option value="cash">Cash</option>
                                <option value="upi">UPI</option>
                                <option value="bank">Bank Transfer</option>
                                <option value="cheque">Cheque</option>
                                <option value="card">Card</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Reference Number (optional)</label>
                            <input
                                className="form-input"
                                type="text"
                                value={referenceNumber}
                                onChange={(e) => setReferenceNumber(e.target.value)}
                                placeholder="Transaction ID, Cheque number, etc."
                            />
                        </div>

                        <div className="card-glass" style={{ padding: 'var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                            <Info size={14} /> Payment will be auto-allocated: Penalty → Interest → Principal (oldest due first)
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>
                            {submitting ? <span className="loading-spinner" /> : `Pay ₹${amount || '0'}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

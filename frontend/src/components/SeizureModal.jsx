import React, { useState } from 'react';
import api from '../api/client';
import { AlertTriangle, DollarSign, FileText, Calendar } from 'lucide-react';

export default function SeizureModal({ loanId, vehicleId, customerName, vehicleNumber, onClose, onSuccess }) {
    const [seizureDate, setSeizureDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [valuationAmount, setValuationAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            await api.seizeVehicle({
                loanId,
                vehicleId,
                seizureDate: seizureDate || undefined,
                valuationAmount: valuationAmount ? Number(valuationAmount) : undefined,
                notes: notes || undefined,
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
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <AlertTriangle size={18} className="text-red-500" /> Seize Vehicle
                    </h2>
                    <button className="btn btn-ghost" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        {error && <div className="login-error">{error}</div>}

                        <div className="card-glass" style={{ padding: 'var(--space-4)', borderLeft: '4px solid #ef4444', background: 'linear-gradient(to right, var(--slate-50), #ffffff)' }}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Customer</div>
                                    <div style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '16px' }}>{customerName}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Vehicle Plate</div>
                                    <div style={{ fontWeight: 800, color: '#ef4444', fontSize: '16px', letterSpacing: '-0.02em' }}>
                                        {vehicleNumber}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Calendar size={12} /> Date of Seizure
                            </label>
                            <input
                                className="form-input"
                                type="date"
                                value={seizureDate}
                                onChange={(e) => setSeizureDate(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <DollarSign size={12} /> Valuation Amount (Optional)
                            </label>
                            <div className="input-affix-wrapper has-prefix">
                                <span className="input-prefix">₹</span>
                                <input
                                    className="form-input"
                                    type="number"
                                    step="0.01"
                                    value={valuationAmount}
                                    onChange={(e) => setValuationAmount(e.target.value)}
                                    placeholder="Enter estimated value"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <FileText size={12} /> Notes / Remarks
                            </label>
                            <textarea
                                className="form-input"
                                style={{ minHeight: '80px', fontFamily: 'inherit', resize: 'vertical' }}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Provide description on the condition of the vehicle, keys status, mileage, etc."
                            />
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#ef4444', borderColor: '#ef4444' }} disabled={submitting}>
                            {submitting ? <span className="loading-spinner" /> : 'Confirm Seizure'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

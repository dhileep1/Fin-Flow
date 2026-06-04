import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { X, Phone, Hash, Clock, CalendarCheck, RotateCcw, UserMinus, PhoneOff, CalendarDays, Check, AlertCircle, Car, User } from 'lucide-react';
import '../styles/callLogModal.css';

export default function CallLogModal({ task, onClose, onSuccess }) {
    const [outcome, setOutcome] = useState('promise');
    const [noteText, setNoteText] = useState('');
    const [remindDays, setRemindDays] = useState('3');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Derived info
    const pendingAmount = task.loan?.installments
        ?.filter(i => i.status === 'pending' || i.status === 'overdue')
        ?.reduce((sum, i) => sum + i.amount, 0) || 0;
    
    const pendingCount = task.loan?.installments
        ?.filter(i => i.status === 'pending' || i.status === 'overdue')
        ?.length || 0;

    const formatCurrency = (amount) => 
        Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

    const getFollowupDisplay = () => {
        const date = new Date();
        date.setDate(date.getDate() + Number(remindDays));
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const handleSave = async () => {
        if (!outcome) {
            setError('Please select an outcome');
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            const followupDate = new Date();
            followupDate.setDate(followupDate.getDate() + Number(remindDays));

            const payload = {
                callTaskId: task.id,
                outcome,
                notes: noteText,
                callDate: new Date().toISOString(),
                nextFollowupDate: followupDate.toISOString()
            };

            await api.createCallLog(payload);
            onSuccess(task.id);
        } catch (err) {
            setError(err.message || 'Failed to record interaction');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="clm-overlay" onClick={onClose}>
            <div className="clm-container clm-container-wide" onClick={e => e.stopPropagation()}>
                
                {/* Floating Close Button */}
                <button 
                    className="clm-floating-close-corner" 
                    onClick={onClose}
                    title="Close Dashboard"
                >
                    <X size={18} strokeWidth={3} />
                </button>

                {/* DASHBOARD BODY */}
                <div className="clm-dashboard-grid">
                    
                    {/* LEFT COLUMN: CONTEXT & METRICS (Zone 1 - 4) */}
                    <div className="clm-left-sidebar">
                        
                        {/* Zone 1: Identity */}
                        <div className="clm-zone-identity">
                            <div className="clm-id-row">
                                <div className="clm-id-icon-circle"><User size={16} /></div>
                                <h2 className="clm-id-name">{task.loan?.customer?.name || 'Unknown Customer'}</h2>
                            </div>
                            <div className="clm-id-row">
                                <div className="clm-id-icon-circle phone"><Phone size={14} /></div>
                                <span className="clm-id-phone">{task.loan?.customer?.phone || '—'}</span>
                            </div>
                        </div>

                        {/* Zone 2: The Asset */}
                        <div className="clm-zone-asset">
                            <div className="clm-id-row asset">
                                <div className="clm-id-icon-circle asset"><Car size={14} /></div>
                                <span className="clm-asset-vehicle">{task.loan?.vehicle?.model || '—'}</span>
                            </div>
                        </div>

                        <div className="clm-hard-divider" />

                        {/* Zone 3 (Formerly 5): EMI Status Table (Moved up) */}
                        <div className="clm-zone-status-table">
                            <div className="clm-status-grid">
                                <div className="clm-status-col">
                                    <span className="label">Paid</span>
                                    <span className="value">{task.paidDues || 0}</span>
                                </div>
                                <div className="clm-status-col">
                                    <span className="label">Pending</span>
                                    <span className="value text-red-600">{pendingCount}</span>
                                </div>
                                <div className="clm-status-col">
                                    <span className="label">Total</span>
                                    <span className="value">{task.totalDues || 0}</span>
                                </div>
                            </div>
                        </div>

                        {/* Zone 4 (Formerly 3): The Hero Metric */}
                        <div className="clm-zone-hero">
                            <div className="clm-hero-box">
                                <span className="clm-hero-label">Total Overdue</span>
                                <div className="clm-hero-number">₹ {formatCurrency(pendingAmount + (task.loan?.penaltyAmount || 0))}</div>
                            </div>
                        </div>

                        {/* Zone 5 (Formerly 4): Financial Breakdown */}
                        <div className="clm-zone-breakdown">
                            <div className="clm-breakdown-row">
                                <span className="label">Principal Amount</span>
                                <span className="value">₹ {formatCurrency(task.loan?.principalAmount)}</span>
                            </div>
                            <div className="clm-breakdown-row">
                                <span className="label">Monthly EMI</span>
                                <span className="value">₹ {formatCurrency(task.loan?.monthlyDueAmount)}</span>
                            </div>
                            <div className="clm-breakdown-row">
                                <span className="label">Penalty Accrued</span>
                                <span className="value">₹ {formatCurrency(task.loan?.penaltyAmount)}</span>
                            </div>
                        </div>

                    </div>

                    {/* COLUMN 2: INTERACTION HISTORY */}
                    <div className="clm-col-history clm-col-history-merged">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="clm-label-xs mb-0">Interaction History</h4>
                        </div>

                        <div className="clm-history-scroller custom-scrollbar px-1">
                            {task.callLogs && task.callLogs.length > 0 ? (
                                <div className="clm-vertical-timeline">
                                    {task.callLogs.map((log) => (
                                        <div key={log.id} className="clm-timeline-node">
                                            <div className="clm-node-line" />
                                            <div className="clm-node-dot" />
                                            <div className="clm-log-item">
                                                <div className="flex items-center justify-between mb-4">
                                                    <span className={`clm-status-pill pill--${log.outcome}`}>
                                                        {log.outcome?.replace(/_/g, ' ')}
                                                    </span>
                                                    <span className="clm-log-date">
                                                        {new Date(log.callDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 leading-relaxed font-medium italic">
                                                    "{log.notes}"
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full py-12 text-slate-300">
                                    <Clock size={32} strokeWidth={1} className="mb-2 opacity-50" />
                                    <p className="text-xs font-bold uppercase tracking-widest">No History</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* COLUMN 3: ACTION FORM */}
                    <div className="clm-col-form">
                        <div className="flex flex-col h-full gap-10">
                            <div className="clm-form-section">
                                <label className="clm-label-xs mb-4 block">Record Outcome</label>
                                <div className="clm-outcome-grid clm-outcome-grid-4">
                                    <button 
                                        type="button"
                                        className={`clm-outcome-card promise ${outcome === 'promise' ? 'active' : ''}`}
                                        onClick={() => setOutcome('promise')}
                                    >
                                        <div className="outcome-icon"><CalendarCheck size={18} /></div>
                                        <div className="outcome-info"><span className="outcome-title">Promise</span></div>
                                    </button>
                                    <button 
                                        type="button"
                                        className={`clm-outcome-card callback ${outcome === 'call_back' ? 'active' : ''}`}
                                        onClick={() => setOutcome('call_back')}
                                    >
                                        <div className="outcome-icon"><RotateCcw size={18} /></div>
                                        <div className="outcome-info"><span className="outcome-title">Call Back</span></div>
                                    </button>
                                    <button 
                                        type="button"
                                        className={`clm-outcome-card refused ${outcome === 'refused' ? 'active' : ''}`}
                                        onClick={() => setOutcome('refused')}
                                    >
                                        <div className="outcome-icon"><UserMinus size={18} /></div>
                                        <div className="outcome-info"><span className="outcome-title">Refused</span></div>
                                    </button>
                                    <button 
                                        type="button"
                                        className={`clm-outcome-card noanswer ${outcome === 'no_answer' ? 'active' : ''}`}
                                        onClick={() => setOutcome('no_answer')}
                                    >
                                        <div className="outcome-icon"><PhoneOff size={18} /></div>
                                        <div className="outcome-info"><span className="outcome-title">No Answer</span></div>
                                    </button>
                                </div>
                            </div>

                            <div className="clm-form-section">
                                <div className="clm-scheduling-card">
                                    <div className="clm-sched-row-header">
                                        <div className="flex items-center gap-2">
                                            <CalendarDays size={14} className="text-slate-400" />
                                            <label className="clm-label-xs clm-label-inline mb-0">Follow-up</label>
                                        </div>
                                        <div className="clm-scheduled-date">
                                            <Check size={12} />
                                            {getFollowupDisplay()}
                                        </div>
                                    </div>
                                    <div className="clm-sched-row-controls">
                                        <div className="flex items-center gap-3">
                                            <input type="number" className="clm-days-input" value={remindDays} onChange={e => setRemindDays(e.target.value)} min="0" />
                                            <span className="text-sm font-medium text-slate-500">Days later</span>
                                        </div>
                                        <div className="flex gap-2">
                                            {['3', '7', '15'].map(d => (
                                                <button key={d} type="button" className={`clm-quick-pill ${remindDays === d ? 'active' : ''}`} onClick={() => setRemindDays(d)}>+{d}d</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="clm-form-section flex-1 flex flex-col">
                                <div className="clm-notes-card flex-1 flex flex-col">
                                    <label className="clm-label-xs mb-3 block">Interaction Notes</label>
                                    <textarea 
                                        className="clm-rich-textarea-fixed flex-1"
                                        placeholder="Summarize the conversation here..."
                                        value={noteText}
                                        onChange={e => setNoteText(e.target.value)}
                                    />
                                </div>
                            </div>

                            {error && <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-bold flex items-center gap-2"><AlertCircle size={14} />{error}</div>}

                            <div className="clm-form-section">
                                <button type="button" className="btn-save-interaction" onClick={handleSave} disabled={submitting}>
                                    {submitting ? 'Saving...' : 'Save Interaction'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

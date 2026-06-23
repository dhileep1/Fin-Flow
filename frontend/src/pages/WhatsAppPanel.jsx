import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../api/client';
import { 
    MessageSquare, 
    Send, 
    Filter, 
    CheckCircle2, 
    AlertCircle, 
    Users, 
    Search, 
    X, 
    Check, 
    CheckCheck, 
    Sparkles, 
    Bell, 
    AlertTriangle 
} from 'lucide-react';
import '../styles/whatsappPanel.css';

const MESSAGE_TEMPLATES = [
    { key: 'reminder', label: 'Payment Reminder', body: 'Dear {{name}}, this is a friendly reminder that your EMI payment is due. Please arrange the payment at your earliest convenience. Thank you. — FinFlow' },
    { key: 'overdue', label: 'Overdue Alert', body: 'Dear {{name}}, your EMI payment is overdue. Please clear the outstanding amount to avoid late fees. Contact us for any queries. — FinFlow' },
    { key: 'thanks', label: 'Payment Thank You', body: 'Dear {{name}}, we have received your payment. Thank you for being prompt! If you have any questions, feel free to reach out. — FinFlow' },
    { key: 'custom', label: 'Custom Message', body: '' },
];

const getTemplateIcon = (key) => {
    switch (key) {
        case 'reminder':
            return Bell;
        case 'overdue':
            return AlertTriangle;
        case 'thanks':
            return CheckCircle2;
        default:
            return MessageSquare;
    }
};

export default function WhatsAppPanel() {
    const [targets, setTargets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [message, setMessage] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState('custom');
    const [status, setStatus] = useState({ success: 0, failed: 0, total: 0 });
    const [checkedIds, setCheckedIds] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    
    // Threshold inputs kept in separate states to avoid DB refetches on keystroke
    const [minOverdueAmount, setMinOverdueAmount] = useState('');
    const [minOverdueDays, setMinOverdueDays] = useState('');

    const [filters, setFilters] = useState({
        loanStatus: '',
        overdueOnly: false,
    });

    const textareaRef = useRef(null);

    const fetchTargets = async () => {
        setLoading(true);
        try {
            const data = await api.get('/notifications/targets', `loanStatus=${filters.loanStatus}&overdue=${filters.overdueOnly}`);
            setTargets(data.targets || []);
            // Select all by default
            setCheckedIds(new Set((data.targets || []).map(t => t.id)));
        } catch (e) {
            console.error('Failed to fetch targets', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTargets();
    }, [filters.loanStatus, filters.overdueOnly]);

    const handleTemplateChange = (key) => {
        setSelectedTemplate(key);
        const tmpl = MESSAGE_TEMPLATES.find(t => t.key === key);
        if (tmpl && tmpl.body) setMessage(tmpl.body);
        else if (key === 'custom') setMessage('');
    };

    const toggleCheck = (id) => {
        setCheckedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Calculate dynamic overdue metrics for all fetched targets
    const targetsWithMetrics = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return targets.map(t => {
            let totalOverdue = 0;
            let daysOverdue = 0;

            const activeLoans = t.loans || [];
            activeLoans.forEach(loan => {
                const unpaidDues = loan.loanDues || [];
                unpaidDues.forEach(due => {
                    const dueDate = new Date(due.dueDate);
                    dueDate.setHours(0, 0, 0, 0);
                    if (dueDate < today) {
                        const dueAmount = Number(due.totalDue) - Number(due.amountPaid);
                        totalOverdue += dueAmount;
                        
                        const diffTime = today - dueDate;
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                        if (diffDays > daysOverdue) {
                            daysOverdue = diffDays;
                        }
                    }
                });
            });

            return {
                ...t,
                computedOverdueAmt: totalOverdue,
                computedOverdueDays: daysOverdue,
            };
        });
    }, [targets]);

    // Apply filters and client-side threshold search
    const filteredTargets = useMemo(() => {
        let result = targetsWithMetrics;

        // Apply overdue thresholds
        if (filters.overdueOnly) {
            result = result.filter(t => t.computedOverdueAmt > 0 || t.computedOverdueDays > 0);
        }

        if (minOverdueAmount.trim()) {
            const minAmt = Number(minOverdueAmount);
            if (!isNaN(minAmt)) {
                result = result.filter(t => t.computedOverdueAmt >= minAmt);
            }
        }

        if (minOverdueDays.trim()) {
            const minDays = Number(minOverdueDays);
            if (!isNaN(minDays)) {
                result = result.filter(t => t.computedOverdueDays >= minDays);
            }
        }

        // Apply text search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter(t => 
                t.name.toLowerCase().includes(q) || 
                t.phone.includes(q)
            );
        }

        return result;
    }, [targetsWithMetrics, filters.overdueOnly, minOverdueAmount, minOverdueDays, searchQuery]);

    const toggleAll = () => {
        const allFilteredChecked = filteredTargets.length > 0 && filteredTargets.every(t => checkedIds.has(t.id));
        setCheckedIds(prev => {
            const next = new Set(prev);
            if (allFilteredChecked) {
                filteredTargets.forEach(t => next.delete(t.id));
            } else {
                filteredTargets.forEach(t => next.add(t.id));
            }
            return next;
        });
    };

    const selectedTargets = useMemo(() => {
        return targetsWithMetrics.filter(t => checkedIds.has(t.id));
    }, [targetsWithMetrics, checkedIds]);

    const handleSend = async () => {
        if (!message.trim() || selectedTargets.length === 0) return;
        setSending(true);
        setStatus({ success: 0, failed: 0, total: selectedTargets.length });
        
        try {
            const result = await api.post('/notifications/bulk-send', {
                targetIds: selectedTargets.map(t => t.id),
                messageBody: message,
            });
            setStatus({ 
                success: result.successCount, 
                failed: result.failedCount, 
                total: selectedTargets.length 
            });
            alert(`Sent ${result.successCount} messages successfully.`);
        } catch (e) {
            console.error('Bulk send failed', e);
            alert('Failed to send messages.');
        } finally {
            setSending(false);
        }
    };

    const injectVariable = (variable) => {
        const textarea = textareaRef.current;
        if (!textarea) {
            setMessage(prev => prev + variable);
            return;
        }
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const before = text.substring(0, start);
        const after = text.substring(end, text.length);
        setMessage(before + variable + after);
        
        setTimeout(() => {
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = start + variable.length;
        }, 0);
    };

    const previewCustomerName = useMemo(() => {
        if (selectedTargets.length > 0) {
            return selectedTargets[0].name;
        }
        return 'Venkatesh Reddy';
    }, [selectedTargets]);

    const previewMessage = useMemo(() => {
        if (!message) return '';
        return message.replace(/\{\{name\}\}/gi, previewCustomerName);
    }, [message, previewCustomerName]);

    return (
        <div className="wa-panel-container animate-fade-in">
            <div className="wa-header-row">
                <div>
                    <h1 className="page-title" style={{ marginBottom: 0 }}>WhatsApp Messaging</h1>
                </div>
                
                {/* Flat stats text row */}
                <div className="wa-header-stats-text">
                    <span>Targeted: <strong>{loading ? '...' : targets.length}</strong></span>
                    <span>|</span>
                    <span>Selected: <strong>{checkedIds.size}</strong></span>
                    {status.total > 0 && (
                        <>
                            <span>|</span>
                            <span style={{ color: 'var(--color-success)' }}>Success: <strong>{status.success}</strong></span>
                            <span>|</span>
                            <span style={{ color: 'var(--color-danger)' }}>Failed: <strong>{status.failed}</strong></span>
                        </>
                    )}
                </div>
            </div>

            <div className="wa-workspace">
                {/* Left Column: Combined Filters + Recipients */}
                <div className="wa-card" style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <div className="wa-card-header">
                        <span className="wa-card-title">
                            <Users size={14} /> Recipients Directory
                            <span className="badge badge-secondary" style={{ fontSize: 10, padding: '1px 6px', marginLeft: 8 }}>
                                {filteredTargets.length} shown
                            </span>
                        </span>
                        
                        {/* Live Filter Search */}
                        <div className="search-input-wrapper">
                            <Search size={11} />
                            <input 
                                type="text"
                                placeholder="Search name or phone..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button 
                                    className="btn btn-ghost"
                                    style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', padding: 2, height: 'auto' }}
                                    onClick={() => setSearchQuery('')}
                                >
                                    <X size={10} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Integrated Filter Bar */}
                    <div className="wa-filter-bar">
                        {/* Row 1: Status & Overdue Toggle */}
                        <div className="filter-row">
                            <div className="filter-group">
                                <span className="filter-label">Loan Status</span>
                                <div className="segmented-control">
                                    <button 
                                        className={`segmented-btn ${filters.loanStatus === '' ? 'active' : ''}`}
                                        onClick={() => setFilters({ ...filters, loanStatus: '' })}
                                    >
                                        All
                                    </button>
                                    <button 
                                        className={`segmented-btn ${filters.loanStatus === 'active' ? 'active' : ''}`}
                                        onClick={() => setFilters({ ...filters, loanStatus: 'active' })}
                                    >
                                        Active
                                    </button>
                                    <button 
                                        className={`segmented-btn ${filters.loanStatus === 'closed' ? 'active' : ''}`}
                                        onClick={() => setFilters({ ...filters, loanStatus: 'closed' })}
                                    >
                                        Closed
                                    </button>
                                </div>
                            </div>

                            <div className="filter-group" style={{ marginLeft: 'auto' }}>
                                <span className="filter-label">Overdue Only</span>
                                <label className="switch">
                                    <input 
                                        type="checkbox"
                                        checked={filters.overdueOnly}
                                        onChange={(e) => setFilters({ ...filters, overdueOnly: e.target.checked })}
                                    />
                                    <span className="slider"></span>
                                </label>
                            </div>
                        </div>

                        {/* Row 2: Overdue Thresholds (only if overdue switch is on) */}
                        {filters.overdueOnly && (
                            <div className="filter-row animate-slide-up">
                                <div className="filter-group">
                                    <span className="filter-label">Min Overdue (₹)</span>
                                    <input 
                                        type="number"
                                        className="filter-num-input"
                                        placeholder="Min Amount"
                                        value={minOverdueAmount}
                                        onChange={(e) => setMinOverdueAmount(e.target.value)}
                                        style={{ width: '110px' }}
                                    />
                                </div>

                                <div className="filter-group" style={{ marginLeft: 'auto' }}>
                                    <span className="filter-label">Min Days</span>
                                    <input 
                                        type="number"
                                        className="filter-num-input"
                                        placeholder="Min Days"
                                        value={minOverdueDays}
                                        onChange={(e) => setMinOverdueDays(e.target.value)}
                                        style={{ width: '90px' }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Table Viewport */}
                    <div className="table-viewport wa-scrollbar" style={{ flex: 1 }}>
                        <table>
                            <thead>
                                <tr className="sticky-table-header">
                                    <th style={{ width: 44, textAlign: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={filteredTargets.length > 0 && filteredTargets.every(t => checkedIds.has(t.id))}
                                            onChange={toggleAll}
                                            style={{ width: 14, height: 14, accentColor: 'var(--color-accent)', cursor: 'pointer' }}
                                        />
                                    </th>
                                    <th>Name</th>
                                    <th>Phone</th>
                                    <th>Overdue Amt</th>
                                    <th>Overdue Period</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTargets.map(t => {
                                    const initials = t.name.split(' ').map(n => n[0]).join('').slice(0, 2);
                                    const overdueAmt = t.computedOverdueAmt;
                                    const overdueDays = t.computedOverdueDays;

                                    return (
                                        <tr key={t.id}>
                                            <td style={{ textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={checkedIds.has(t.id)}
                                                    onChange={() => toggleCheck(t.id)}
                                                    style={{ width: 13, height: 13, accentColor: 'var(--color-accent)', cursor: 'pointer' }}
                                                />
                                            </td>
                                            <td>
                                                <div className="table-user-row">
                                                    <div className="table-user-avatar">{initials}</div>
                                                    <span style={{ color: 'var(--slate-800)', fontWeight: 500 }}>{t.name}</span>
                                                </div>
                                            </td>
                                            <td className="font-mono text-muted" style={{ fontSize: '11px' }}>{t.phone}</td>
                                            <td style={{ fontWeight: 600, color: 'var(--slate-800)' }}>
                                                {overdueAmt > 0 ? `₹${overdueAmt.toLocaleString('en-IN')}` : '—'}
                                            </td>
                                            <td style={{ fontWeight: 500, color: 'var(--slate-600)' }}>
                                                {overdueDays > 0 ? `${overdueDays} days` : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredTargets.length === 0 && (
                                    <tr>
                                        <td colSpan="5">
                                            <div className="empty-state-inline" style={{ padding: 'var(--space-6)' }}>
                                                <div className="empty-icon"><MessageSquare size={20} /></div>
                                                <div className="empty-title">No Recipients Found</div>
                                                <div className="empty-desc">No customers match your search filters or overdue thresholds.</div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Center Column: Combined Message Workspace (Presets + Textarea) */}
                <div className="wa-card message-creation-card" style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <div className="wa-card-header">
                        <span className="wa-card-title">
                            <MessageSquare size={14} /> Message Workspace
                        </span>
                        <div className="var-badges-row">
                            <span className="text-muted" style={{ fontSize: 10 }}>Placeholders:</span>
                            <button 
                                className="var-badge" 
                                title="Click to insert name template"
                                onClick={() => injectVariable('{{name}}')}
                            >
                                {"{{name}}"}
                            </button>
                        </div>
                    </div>

                    {/* Horizontal preset buttons combined inside the editor */}
                    <div className="presets-row">
                        <span className="presets-label">Presets:</span>
                        {MESSAGE_TEMPLATES.map(t => {
                            const IconComponent = getTemplateIcon(t.key);
                            return (
                                <button
                                    key={t.key}
                                    className={`preset-pill ${selectedTemplate === t.key ? 'active' : ''}`}
                                    onClick={() => handleTemplateChange(t.key)}
                                    type="button"
                                >
                                    <IconComponent size={10} />
                                    <span>{t.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column', margin: 0 }}>
                        <textarea 
                            ref={textareaRef}
                            className="form-textarea"
                            placeholder="Type your broadcast message... Use {{name}} for dynamic placeholder."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            style={{ flex: 1, resize: 'none', fontSize: '13px', lineHeight: '1.4', padding: '10px', minHeight: 0 }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexShrink: 0 }}>
                        <span className="text-muted" style={{ fontSize: 10 }}>
                            Characters: {message.length}
                        </span>
                        <button 
                            className="btn btn-primary btn-send-glow flex items-center gap-2"
                            onClick={handleSend}
                            disabled={sending || selectedTargets.length === 0 || !message.trim()}
                            style={{ height: '32px', padding: '0 16px', fontSize: '12px' }}
                        >
                            {sending ? (
                                <span className="loading-spinner" style={{ width: 14, height: 14 }} />
                            ) : (
                                <>
                                    <Send size={12} /> Send to {selectedTargets.length}
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Right Column: Mobile Device Simulator */}
                <div className="wa-pane-right">
                    <div className="wa-phone-container">
                        <div className="wa-phone-bezel">
                            <div className="wa-phone-notch" />
                            <div className="wa-phone-screen">
                                {/* Header */}
                                <div className="wa-phone-header">
                                    <div className="wa-phone-avatar">
                                        {previewCustomerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="wa-phone-contact-info">
                                        <span className="wa-phone-contact-name">{previewCustomerName}</span>
                                        <span className="wa-phone-contact-status">online</span>
                                    </div>
                                </div>

                                {/* Message Log */}
                                <div className="wa-phone-body wa-scrollbar">
                                    {message.trim() ? (
                                        <div className="wa-phone-bubble">
                                            {/* WhatsApp Speech Tail bubble */}
                                            <svg className="wa-phone-bubble-tail" viewBox="0 0 8 8" style={{ position: 'absolute', right: '-5px', top: '0', width: '6px', height: '8px' }}>
                                                <path d="M 0 0 L 6 0 L 6 6 Z" fill="currentColor"/>
                                            </svg>
                                            {previewMessage}
                                            <div className="wa-phone-time-ticks">
                                                <span>
                                                    {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                </span>
                                                <span className="wa-phone-ticks">
                                                    <CheckCheck size={10} />
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="wa-phone-empty">
                                            Select a template preset or type in the workspace to see a live simulation of the WhatsApp message.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

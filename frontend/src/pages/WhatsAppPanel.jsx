import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/client';
import { MessageSquare, Send, Filter, CheckCircle2, AlertCircle, Users, Smartphone } from 'lucide-react';

const MESSAGE_TEMPLATES = [
    { key: 'reminder', label: 'Payment Reminder', body: 'Dear {{name}}, this is a friendly reminder that your EMI payment is due. Please arrange the payment at your earliest convenience. Thank you. — FinFlow' },
    { key: 'overdue', label: 'Overdue Alert', body: 'Dear {{name}}, your EMI payment is overdue. Please clear the outstanding amount to avoid late fees. Contact us for any queries. — FinFlow' },
    { key: 'thanks', label: 'Payment Thank You', body: 'Dear {{name}}, we have received your payment. Thank you for being prompt! If you have any questions, feel free to reach out. — FinFlow' },
    { key: 'custom', label: 'Custom Message', body: '' },
];

export default function WhatsAppPanel() {
    const [targets, setTargets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [message, setMessage] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState('custom');
    const [status, setStatus] = useState({ success: 0, failed: 0, total: 0 });
    const [checkedIds, setCheckedIds] = useState(new Set());
    const [filters, setFilters] = useState({
        loanStatus: '',
        overdueOnly: false,
    });

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
    }, [filters]);

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

    const toggleAll = () => {
        if (checkedIds.size === targets.length) {
            setCheckedIds(new Set());
        } else {
            setCheckedIds(new Set(targets.map(t => t.id)));
        }
    };

    const selectedTargets = targets.filter(t => checkedIds.has(t.id));

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

    // Preview the message with sample data
    const previewMessage = useMemo(() => {
        if (!message) return 'Your message preview will appear here...';
        return message.replace(/\{\{name\}\}/gi, 'Venkatesh Reddy');
    }, [message]);

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">WhatsApp Messaging</h1>
                    <p className="page-subtitle">Send bulk messages to customers with custom filters</p>
                </div>
            </div>

            <div className="grid-3col">
                {/* Left: Filters */}
                <div>
                    <div className="card" style={{ height: 'auto' }}>
                        <h3 className="flex items-center gap-2 mb-3" style={{ fontWeight: 600 }}>
                            <Filter size={18} style={{ color: 'var(--color-accent)' }} /> Filters
                        </h3>
                        
                        <div className="form-group">
                            <label className="form-label">Loan Status</label>
                            <select 
                                className="form-select"
                                value={filters.loanStatus}
                                onChange={(e) => setFilters({ ...filters, loanStatus: e.target.value })}
                            >
                                <option value="">All Customers</option>
                                <option value="active">Active Loans</option>
                                <option value="closed">Closed Loans</option>
                            </select>
                        </div>

                        <div className="form-group mt-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="form-checkbox"
                                    checked={filters.overdueOnly}
                                    onChange={(e) => setFilters({ ...filters, overdueOnly: e.target.checked })}
                                    style={{ width: 16, height: 16, accentColor: 'var(--color-accent)' }}
                                />
                                <span className="text-sm">Overdue Dues Only</span>
                            </label>
                        </div>

                        <div className="mt-4 pt-3 border-t">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted">Targeted Customers</span>
                                <span className="badge badge-accent">{loading ? '...' : targets.length}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm mt-1">
                                <span className="text-muted">Selected</span>
                                <span className="badge badge-secondary">{checkedIds.size}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Center: Message */}
                <div>
                    <div className="card">
                        <h3 className="flex items-center gap-2 mb-4" style={{ fontWeight: 600 }}>
                            <MessageSquare size={18} style={{ color: 'var(--color-accent)' }} /> Message Content
                        </h3>

                        {/* Template Selector */}
                        <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                            <label className="form-label">Template</label>
                            <select
                                className="form-select"
                                value={selectedTemplate}
                                onChange={(e) => handleTemplateChange(e.target.value)}
                            >
                                {MESSAGE_TEMPLATES.map(t => (
                                    <option key={t.key} value={t.key}>{t.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Message</label>
                            <textarea 
                                className="form-textarea"
                                rows={6}
                                placeholder="Type your message here... Use {{name}} for customer name."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                            />
                        </div>

                        <div className="mt-4 flex justify-between items-center">
                            <span className="text-xs text-muted">
                                Variables: {'{{name}}'} — Customer name
                            </span>
                            <button 
                                className="btn btn-primary flex items-center gap-2"
                                onClick={handleSend}
                                disabled={sending || selectedTargets.length === 0 || !message.trim()}
                            >
                                {sending ? (
                                    <span className="loading-spinner" />
                                ) : (
                                    <>
                                        <Send size={16} /> Send to {selectedTargets.length}
                                    </>
                                )}
                            </button>
                        </div>

                        {status.total > 0 && (
                            <div className="card-glass mt-4" style={{ padding: 'var(--space-4)' }}>
                                <h4 className="text-sm font-semibold mb-3">Send Status</h4>
                                <div className="flex gap-4">
                                    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-success)' }}>
                                        <CheckCircle2 size={16} /> {status.success} Success
                                    </div>
                                    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-danger)' }}>
                                        <AlertCircle size={16} /> {status.failed} Failed
                                    </div>
                                    <div className="text-sm text-muted">
                                        Total: {status.total}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Target List with checkboxes */}
                    <div className="card mt-6">
                        <h3 className="flex items-center gap-2 mb-4" style={{ fontWeight: 600 }}>
                            <Users size={18} style={{ color: 'var(--color-accent)' }} /> Target List
                        </h3>
                        <div className="table-container" style={{ maxHeight: 300, overflowY: 'auto' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: 40 }}>
                                            <input
                                                type="checkbox"
                                                checked={checkedIds.size === targets.length && targets.length > 0}
                                                onChange={toggleAll}
                                                style={{ width: 16, height: 16, accentColor: 'var(--color-accent)', cursor: 'pointer' }}
                                            />
                                        </th>
                                        <th>Name</th>
                                        <th>Phone</th>
                                        <th>Loan Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {targets.map(t => (
                                        <tr key={t.id}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={checkedIds.has(t.id)}
                                                    onChange={() => toggleCheck(t.id)}
                                                    style={{ width: 16, height: 16, accentColor: 'var(--color-accent)', cursor: 'pointer' }}
                                                />
                                            </td>
                                            <td>{t.name}</td>
                                            <td className="font-mono">{t.phone}</td>
                                            <td>
                                                <span className="badge badge-info">
                                                    {t.loans?.[0]?.status || 'N/A'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {targets.length === 0 && (
                                        <tr>
                                            <td colSpan="4">
                                                <div className="empty-state-inline" style={{ padding: 'var(--space-6)' }}>
                                                    <div className="empty-icon"><MessageSquare size={24} /></div>
                                                    <div className="empty-desc">No targets found with current filters</div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right: Phone Preview */}
                <div>
                    <div style={{ position: 'sticky', top: 'calc(var(--header-height) + var(--space-6))' }}>
                        <h4 className="flex items-center gap-2 mb-4 text-sm" style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                            <Smartphone size={16} /> Message Preview
                        </h4>
                        <div className="phone-preview">
                            <div className="phone-preview-header">
                                <div className="wa-avatar">FF</div>
                                <span>FinFlow</span>
                            </div>
                            <div className="phone-preview-body">
                                {message.trim() ? (
                                    <div className="phone-preview-bubble">
                                        {previewMessage}
                                        <div className="phone-preview-time">
                                            {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', textAlign: 'center', marginTop: '40%' }}>
                                        Type a message to see preview
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

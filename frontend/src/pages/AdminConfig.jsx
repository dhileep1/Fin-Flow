import React, { useState, useEffect, useRef } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { 
    Lock, Copy, Check, MoreVertical, Shield, KeyRound, UserX, ChevronLeft, 
    ChevronRight, History, RotateCcw, Edit, AlertTriangle, X,
    User, Wallet, IndianRupee, Phone, Building2, Settings, Eye
} from 'lucide-react';

const PAGE_SIZE = 10;

function ActionMenu({ onEditRole, onResetPassword, onDeactivate }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handleClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    return (
        <div className="action-menu-container" ref={ref}>
            <button
                className="action-menu-trigger"
                onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
                title="Actions"
            >
                <MoreVertical size={16} />
            </button>
            {open && (
                <div className="action-menu-dropdown">
                    <button className="action-menu-item" onClick={() => { onEditRole(); setOpen(false); }}>
                        <Shield size={14} /> Edit Role
                    </button>
                    <button className="action-menu-item" onClick={() => { onResetPassword(); setOpen(false); }}>
                        <KeyRound size={14} /> Reset Password
                    </button>
                    <button className="action-menu-item danger" onClick={() => { onDeactivate(); setOpen(false); }}>
                        <UserX size={14} /> Deactivate
                    </button>
                </div>
            )}
        </div>
    );
}

export default function AdminConfig() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('settings');
    const [org, setOrg] = useState(null);
    const [orgForm, setOrgForm] = useState({ name: '', phone: '', address: '' });
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showUserForm, setShowUserForm] = useState(false);
    const [newUser, setNewUser] = useState({ name: '', email: '', phone: '', password: '', role: 'staff' });
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [copied, setCopied] = useState(false);
    const [page, setPage] = useState(1);

    // Audit Log state
    const [auditLogs, setAuditLogs] = useState([]);
    const [auditTotal, setAuditTotal] = useState(0);
    const [auditPage, setAuditPage] = useState(1);
    const [auditPages, setAuditPages] = useState(1);
    const [auditLoading, setAuditLoading] = useState(false);

    // Edit Modal state
    const [editingEntity, setEditingEntity] = useState(null); // { type, id, data }
    const [editForm, setEditForm] = useState({});
    const [updatingEntity, setUpdatingEntity] = useState(false);

    // Revert Modal/Confirmation state
    const [revertingLog, setRevertingLog] = useState(null); // the log object to revert
    const [revertingInProgress, setRevertingInProgress] = useState(false);

    useEffect(() => { loadData(); }, []);

    const loadAuditLogs = async (p = 1) => {
        setAuditLoading(true);
        try {
            const res = await api.getAuditLogs(p, PAGE_SIZE);
            setAuditLogs(res.logs);
            setAuditTotal(res.total);
            setAuditPage(res.page);
            setAuditPages(res.totalPages);
        } catch (err) {
            console.error('Failed to load audit logs:', err);
            showToast(err.message || 'Failed to load history', 'danger');
        } finally {
            setAuditLoading(false);
        }
    };

    const handleTabChange = (key) => {
        setActiveTab(key);
        setPage(1);
        if (key === 'history') {
            loadAuditLogs(1);
        }
    };

    const handleRevertLog = async (log) => {
        setRevertingLog(log);
    };

    const confirmRevertLog = async () => {
        if (!revertingLog) return;
        setRevertingInProgress(true);
        try {
            const res = await api.revertAuditLog(revertingLog.id);
            showToast(res.message || 'Action reverted successfully!');
            setRevertingLog(null);
            loadAuditLogs(auditPage);
        } catch (err) {
            console.error('Failed to revert:', err);
            showToast(err.message || 'Failed to revert action', 'danger');
        } finally {
            setRevertingInProgress(false);
        }
    };

    const handleEditEntity = async (type, id) => {
        try {
            const data = await api.getAuditLogEntity(type, id);
            setEditingEntity({ type, id, data });
            
            if (type === 'customer') {
                setEditForm({
                    name: data.name || '',
                    phone: data.phone || '',
                    altPhone: data.altPhone?.join(', ') || '',
                    address: data.address || '',
                    aadharNumber: data.aadharNumber || '',
                    optOutWhatsapp: data.optOutWhatsapp || false
                });
            } else if (type === 'loan') {
                setEditForm({
                    assignedStaffId: data.assignedStaffId || '',
                    status: data.status || '',
                    nextDueDate: data.nextDueDate ? new Date(data.nextDueDate).toISOString().split('T')[0] : '',
                    principalAmount: data.principalAmount || '',
                    tenureMonths: data.tenureMonths || '',
                    monthlyInterestRate: data.monthlyInterestRate || '',
                    startDate: data.startDate ? new Date(data.startDate).toISOString().split('T')[0] : ''
                });
            } else if (type === 'payment') {
                setEditForm({
                    paymentMethod: data.paymentMethod || '',
                    referenceNumber: data.referenceNumber || '',
                    paymentDate: data.paymentDate ? new Date(data.paymentDate).toISOString().split('T')[0] : '',
                    amount: data.amount
                });
            } else if (type === 'call_log') {
                setEditForm({
                    outcome: data.outcome || 'connected',
                    notes: data.notes || '',
                    promisedPaymentAmount: data.promisedPaymentAmount || '',
                    promisedPaymentDate: data.promisedPaymentDate ? new Date(data.promisedPaymentDate).toISOString().split('T')[0] : '',
                    nextFollowupDate: data.nextFollowupDate ? new Date(data.nextFollowupDate).toISOString().split('T')[0] : ''
                });
            } else if (type === 'organization') {
                setEditForm({
                    name: data.name || '',
                    phone: data.phone || '',
                    address: data.address || ''
                });
            }
        } catch (err) {
            console.error('Failed to load entity details:', err);
            showToast(err.message || 'Failed to fetch details', 'danger');
        }
    };

    const handleSaveEntity = async (e) => {
        e.preventDefault();
        if (!editingEntity) return;
        setUpdatingEntity(true);
        try {
            const payload = { ...editForm };
            if (editingEntity.type === 'customer') {
                payload.altPhone = editForm.altPhone.split(',').map(s => s.trim()).filter(Boolean);
            } else if (editingEntity.type === 'loan') {
                payload.principalAmount = Number(editForm.principalAmount);
                payload.tenureMonths = Number(editForm.tenureMonths);
                payload.monthlyInterestRate = Number(editForm.monthlyInterestRate);
            } else if (editingEntity.type === 'call_log') {
                payload.promisedPaymentAmount = editForm.promisedPaymentAmount ? Number(editForm.promisedPaymentAmount) : null;
            }
            await api.updateAuditLogEntity(editingEntity.type, editingEntity.id, payload);
            showToast('Entity details updated successfully!');
            setEditingEntity(null);
            loadAuditLogs(auditPage);
        } catch (err) {
            console.error('Failed to update:', err);
            showToast(err.message || 'Failed to update details', 'danger');
        } finally {
            setUpdatingEntity(false);
        }
    };

    const getFriendlyActionName = (action) => {
        if (!action) return 'Unknown Action';
        return action
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const getRoleIcon = (role) => {
        switch (role) {
            case 'admin':
                return <Shield size={14} className="text-brand-accent" />;
            case 'accountant':
                return <Wallet size={14} className="text-slate-500" />;
            case 'staff':
                return <User size={14} className="text-slate-500" />;
            case 'viewer':
                return <Eye size={14} className="text-slate-500" />;
            default:
                return <Settings size={14} className="text-slate-400" />;
        }
    };

    const getActionIcon = (action) => {
        if (!action) return null;
        if (action.includes('customer')) return <User size={12} />;
        if (action.includes('loan')) return <Wallet size={12} />;
        if (action.includes('payment')) return <IndianRupee size={12} />;
        if (action.includes('call_log') || action.includes('call_logged')) return <Phone size={12} />;
        if (action.includes('org_settings') || action.includes('organization')) return <Building2 size={12} />;
        return <Settings size={12} />;
    };

    const getActionBadgeClass = (action) => {
        return 'badge-neutral';
    };

    const isEditable = (action) => {
        return [
            'customer_created', 'customer_updated', 
            'loan_created', 'loan_updated', 
            'payment_recorded', 'payment_updated', 
            'call_logged', 'call_log_updated',
            'org_settings_updated'
        ].includes(action);
    };

    const isRevertible = (action) => {
        return [
            'customer_created', 'customer_updated', 
            'loan_created', 'loan_updated', 
            'payment_recorded', 'payment_updated', 
            'call_logged', 'call_log_reverted', 'call_log_updated',
            'org_settings_updated'
        ].includes(action);
    };

    const formatDateShort = (dateStr) => {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const renderDetailsSummary = (log) => {
        if (!log.details) return `ID: ${log.entityId?.slice(0, 8) || '—'}`;
        const d = log.details;
        switch (log.action) {
            case 'customer_created':
                return `New Customer (ID: ${log.entityId?.slice(0, 8)})`;
            case 'customer_updated':
                const oldName = d.previous?.name;
                const newName = d.updated?.name;
                return oldName && newName && oldName !== newName 
                    ? `Name: ${oldName} ➔ ${newName}` 
                    : `Updated customer details (ID: ${log.entityId?.slice(0, 8)})`;
            case 'loan_created':
                return `Loan of ₹${Number(d.principalAmount || 0).toLocaleString()} (Tenure: ${d.tenureMonths || 0}m)`;
            case 'loan_updated':
                return `Updated Loan details (ID: ${log.entityId?.slice(0, 8)})`;
            case 'payment_recorded':
                return `Received ₹${Number(d.amount || 0).toLocaleString()} via ${d.paymentMethod || 'cash'}`;
            case 'payment_updated':
                return `Updated Payment details (ID: ${log.entityId?.slice(0, 8)})`;
            case 'call_logged':
                return `Call Logged: Outcome ${d.outcome || 'connected'}`;
            case 'call_log_updated':
                return `Updated Call Log details`;
            case 'org_settings_updated':
                return `Updated Organization Settings`;
            case 'customer_creation_reverted':
                return `Reverted Customer Creation (Reverted Log: ${d.revertedLogId?.slice(0, 8)})`;
            case 'customer_update_reverted':
                return `Reverted Customer Update (Reverted Log: ${d.revertedLogId?.slice(0, 8)})`;
            case 'loan_creation_reverted':
                return `Reverted Loan Creation (Reverted Log: ${d.revertedLogId?.slice(0, 8)})`;
            case 'loan_update_reverted':
                return `Reverted Loan Update (Reverted Log: ${d.revertedLogId?.slice(0, 8)})`;
            case 'payment_reverted':
                return `Reverted Payment of ₹${Number(d.amount || 0).toLocaleString()} (Reverted Log: ${d.revertedLogId?.slice(0, 8)})`;
            case 'payment_update_reverted':
                return `Reverted Payment Update (Reverted Log: ${d.revertedLogId?.slice(0, 8)})`;
            case 'call_log_reverted':
                return `Reverted Call Log (Reverted Log: ${d.revertedLogId?.slice(0, 8)})`;
            case 'org_settings_reverted':
                return `Reverted Organization Settings (Reverted Log: ${d.revertedLogId?.slice(0, 8)})`;
            default:
                return `Entity: ${log.entityType || '—'} (ID: ${log.entityId?.slice(0, 8) || '—'})`;
        }
    };

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const loadData = async () => {
        try {
            const [orgData, usersData] = await Promise.all([
                api.getOrgSettings(),
                api.getUsers(),
            ]);
            setOrg(orgData);
            setOrgForm({ name: orgData?.name || '', phone: orgData?.phone || '', address: orgData?.address || '' });
            setUsers(usersData);
        } catch (err) {
            console.error('Failed to load admin data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveOrg = async () => {
        setSaving(true);
        try {
            const updated = await api.updateOrgSettings(orgForm);
            setOrg(updated);
            showToast('Changes saved successfully!');
        } catch (err) {
            showToast(err.message || 'Failed to save', 'danger');
        } finally {
            setSaving(false);
        }
    };

    const handleCopyOrgId = async () => {
        if (org?.id) {
            try {
                await navigator.clipboard.writeText(org.id);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch {
                // fallback
                const ta = document.createElement('textarea');
                ta.value = org.id;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            await api.createUser(newUser);
            setShowUserForm(false);
            setNewUser({ name: '', email: '', phone: '', password: '', role: 'staff' });
            loadData();
            showToast('User created successfully!');
        } catch (err) {
            alert(err.message);
        }
    };

    if (user?.role !== 'admin') {
        return (
            <div className="empty-state">
                <div className="empty-icon" style={{ opacity: 0.3 }}><Lock size={48} /></div>
                <p>Admin access required</p>
            </div>
        );
    }

    const tabs = [
        { key: 'settings', label: 'Organization' },
        { key: 'users', label: 'Users' },
        { key: 'history', label: 'History Log' },
    ];

    const pagedUsers = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));

    return (
        <div className="animate-fade-in" style={{ width: '100%', maxWidth: '1200px' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Settings</h1>
                    <p className="page-subtitle">Organization settings, user management, and history audit</p>
                </div>
            </div>

            <div className="tabs">
                {tabs.map((t) => (
                    <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => handleTabChange(t.key)}>
                        {t.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center gap-3"><div className="loading-spinner" /> Loading...</div>
            ) : activeTab === 'settings' ? (
                <div className="card">
                    <h3 style={{ fontWeight: 600, marginBottom: 'var(--space-4)' }}>Organization Details</h3>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Name</label>
                            <input
                                className="form-input"
                                value={orgForm.name}
                                onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Phone</label>
                            <input
                                className="form-input"
                                value={orgForm.phone}
                                onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="form-group mt-4">
                        <label className="form-label">Address</label>
                        <textarea
                            className="form-textarea"
                            value={orgForm.address}
                            onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                            rows={2}
                        />
                    </div>
                    <div className="form-group mt-4">
                        <label className="form-label">Org ID</label>
                        <div className="readonly-field">
                            <span style={{ flex: 1 }}>{org?.id || ''}</span>
                            <button className="copy-btn" onClick={handleCopyOrgId} title="Copy to clipboard">
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-end mt-6">
                        <button className="btn btn-primary" onClick={handleSaveOrg} disabled={saving}>
                            {saving ? <span className="loading-spinner" /> : 'Save Changes'}
                        </button>
                    </div>
                </div>
            ) : activeTab === 'users' ? (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 style={{ fontWeight: 600 }}>Team Members</h3>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowUserForm(!showUserForm)}>
                            {showUserForm ? 'Cancel' : '+ Add User'}
                        </button>
                    </div>

                    {showUserForm && (
                        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                            <form onSubmit={handleCreateUser}>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Name *</label>
                                        <input className="form-input" required value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email</label>
                                        <input className="form-input" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Phone</label>
                                        <input className="form-input" value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-row mt-4">
                                    <div className="form-group">
                                        <label className="form-label">Password *</label>
                                        <input className="form-input" type="password" required value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Role *</label>
                                        <select className="form-select" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                                            <option value="admin">Admin</option>
                                            <option value="accountant">Accountant</option>
                                            <option value="staff">Staff</option>
                                            <option value="viewer">Viewer</option>
                                        </select>
                                    </div>
                                </div>
                                <button type="submit" className="btn btn-primary mt-4">Create User</button>
                            </form>
                        </div>
                    )}

                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Phone</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th style={{ width: 48 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedUsers.map((u) => (
                                    <tr key={u.id}>
                                        <td style={{ fontWeight: 500 }}>{u.name}</td>
                                        <td className="text-sm">{u.email || '—'}</td>
                                        <td className="font-mono text-sm">{u.phone || '—'}</td>
                                        <td>
                                            <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td><span className={`badge ${u.status === 'active' ? 'badge-success' : 'badge-danger'}`}>{u.status}</span></td>
                                        <td>
                                            <ActionMenu
                                                onEditRole={() => showToast('Edit role dialog coming soon')}
                                                onResetPassword={() => showToast('Password reset link sent')}
                                                onDeactivate={() => showToast('User deactivated', 'danger')}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {users.length > PAGE_SIZE && (
                            <div className="table-pagination">
                                <div className="pagination-info">
                                    Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, users.length)} of {users.length} entries
                                </div>
                                <div className="pagination-btns">
                                    <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                                        <ChevronLeft size={14} /> Prev
                                    </button>
                                    <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                                        Next <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 style={{ fontWeight: 600 }}>History Log</h3>
                        <button className="btn btn-secondary btn-sm" onClick={() => loadAuditLogs(auditPage)}>
                            <RotateCcw size={14} /> Refresh
                        </button>
                    </div>

                    {auditLoading ? (
                        <div className="flex items-center gap-3 py-8 justify-center">
                            <div className="loading-spinner" /> Loading history...
                        </div>
                    ) : auditLogs.length === 0 ? (
                        <div className="empty-state py-8">
                            <div className="empty-icon" style={{ opacity: 0.3 }}><History size={48} /></div>
                            <p>No actions recorded in the history log yet.</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Time</th>
                                        <th>Client</th>
                                        <th style={{ textAlign: 'center' }}>Action</th>
                                        <th>User</th>
                                        <th>Details</th>
                                        <th style={{ width: 100, textAlign: 'center' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditLogs.map((log) => (
                                        <tr key={log.id} className="hover-table-row">
                                            <td className="text-sm text-slate-500 font-mono">
                                                {formatDateShort(log.createdAt)}
                                            </td>
                                            <td className="text-sm text-slate-500 font-mono">
                                                {formatTime(log.createdAt)}
                                            </td>
                                            <td className="text-sm font-semibold text-slate-900">
                                                {log.clientName || '—'}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className={`badge ${getActionBadgeClass(log.action)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                                                    {getActionIcon(log.action)}
                                                    {getFriendlyActionName(log.action)}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 500 }}>
                                                    {log.user?.name || 'System'}
                                                </div>
                                                {log.user?.role && (log.user.name || '').toLowerCase() !== log.user.role.toLowerCase() && (
                                                    <div className="text-xs text-slate-500 font-medium" style={{ textTransform: 'capitalize' }}>
                                                        {log.user.role}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="text-sm text-slate-900 font-medium">
                                                {renderDetailsSummary(log)}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <div className="flex justify-center gap-2">
                                                    {isEditable(log.action) && (
                                                        <button 
                                                            className="btn btn-ghost btn-icon btn-sm" 
                                                            onClick={() => handleEditEntity(log.entityType, log.entityId)}
                                                            title="Edit Details"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                    )}
                                                    {isRevertible(log.action) && (
                                                        <button 
                                                            className="btn btn-ghost btn-icon btn-sm" 
                                                            onClick={() => handleRevertLog(log)}
                                                            title="Revert Action"
                                                            style={{ color: '#ef4444' }}
                                                        >
                                                            <RotateCcw size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {auditPages > 1 && (
                                <div className="table-pagination">
                                    <div className="pagination-info">
                                        Showing {(auditPage - 1) * PAGE_SIZE + 1} to {Math.min(auditPage * PAGE_SIZE, auditTotal)} of {auditTotal} entries
                                    </div>
                                    <div className="pagination-btns">
                                        <button disabled={auditPage === 1} onClick={() => loadAuditLogs(auditPage - 1)}>
                                            <ChevronLeft size={14} /> Prev
                                        </button>
                                        <button disabled={auditPage >= auditPages} onClick={() => loadAuditLogs(auditPage + 1)}>
                                            Next <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Edit Entity Modal */}
            {editingEntity && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 500 }}>
                        <div className="modal-header">
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Edit size={18} /> Edit {editingEntity.type.charAt(0).toUpperCase() + editingEntity.type.slice(1)} Details
                            </h2>
                            <button className="btn-icon" onClick={() => setEditingEntity(null)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSaveEntity}>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                
                                {editingEntity.type === 'customer' && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">Name *</label>
                                            <input 
                                                className="form-input" 
                                                required 
                                                value={editForm.name} 
                                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} 
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Phone *</label>
                                            <input 
                                                className="form-input" 
                                                required 
                                                value={editForm.phone} 
                                                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} 
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Alt Phones (comma-separated)</label>
                                            <input 
                                                className="form-input" 
                                                value={editForm.altPhone} 
                                                onChange={(e) => setEditForm({ ...editForm, altPhone: e.target.value })} 
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Address</label>
                                            <textarea 
                                                className="form-textarea" 
                                                value={editForm.address} 
                                                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} 
                                                rows={2}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Aadhar Number</label>
                                            <input 
                                                className="form-input" 
                                                value={editForm.aadharNumber} 
                                                onChange={(e) => setEditForm({ ...editForm, aadharNumber: e.target.value })} 
                                            />
                                        </div>
                                        <label className="flex items-center gap-2 mt-2 text-sm" style={{ cursor: 'pointer' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={editForm.optOutWhatsapp} 
                                                onChange={(e) => setEditForm({ ...editForm, optOutWhatsapp: e.target.checked })} 
                                            />
                                            Opt out of WhatsApp notifications
                                        </label>
                                    </>
                                )}

                                {editingEntity.type === 'loan' && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">Principal Amount (₹)</label>
                                            <input 
                                                className="form-input" 
                                                type="number"
                                                value={editForm.principalAmount} 
                                                onChange={(e) => setEditForm({ ...editForm, principalAmount: e.target.value })} 
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Tenure (Months)</label>
                                            <input 
                                                className="form-input" 
                                                type="number"
                                                value={editForm.tenureMonths} 
                                                onChange={(e) => setEditForm({ ...editForm, tenureMonths: e.target.value })} 
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Monthly Interest Rate (decimal, e.g. 0.02)</label>
                                            <input 
                                                className="form-input" 
                                                type="number"
                                                step="0.0001"
                                                value={editForm.monthlyInterestRate} 
                                                onChange={(e) => setEditForm({ ...editForm, monthlyInterestRate: e.target.value })} 
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Start Date</label>
                                            <input 
                                                className="form-input" 
                                                type="date"
                                                value={editForm.startDate} 
                                                onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} 
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Assigned Staff</label>
                                            <select 
                                                className="form-select" 
                                                value={editForm.assignedStaffId} 
                                                onChange={(e) => setEditForm({ ...editForm, assignedStaffId: e.target.value })}
                                            >
                                                <option value="">Unassigned</option>
                                                {users.map(u => (
                                                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Status</label>
                                            <select 
                                                className="form-select" 
                                                value={editForm.status} 
                                                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                            >
                                                <option value="active">Active</option>
                                                <option value="closed">Closed</option>
                                                <option value="defaulted">Defaulted</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Next Due Date</label>
                                            <input 
                                                className="form-input" 
                                                type="date"
                                                value={editForm.nextDueDate} 
                                                onChange={(e) => setEditForm({ ...editForm, nextDueDate: e.target.value })} 
                                            />
                                        </div>
                                    </>
                                )}

                                {editingEntity.type === 'payment' && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">Amount (Readonly)</label>
                                            <div className="readonly-field" style={{ fontStyle: 'italic' }}>
                                                ₹{Number(editForm.amount || 0).toLocaleString()} (To edit amount, please Revert the payment)
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Payment Method</label>
                                            <select 
                                                className="form-select" 
                                                value={editForm.paymentMethod} 
                                                onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                                            >
                                                <option value="cash">Cash</option>
                                                <option value="upi">UPI</option>
                                                <option value="bank">Bank Transfer</option>
                                                <option value="cheque">Cheque</option>
                                                <option value="card">Card</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Reference Number</label>
                                            <input 
                                                className="form-input" 
                                                value={editForm.referenceNumber} 
                                                onChange={(e) => setEditForm({ ...editForm, referenceNumber: e.target.value })} 
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Payment Date</label>
                                            <input 
                                                className="form-input" 
                                                type="date"
                                                value={editForm.paymentDate} 
                                                onChange={(e) => setEditForm({ ...editForm, paymentDate: e.target.value })} 
                                            />
                                        </div>
                                    </>
                                )}

                                {editingEntity.type === 'call_log' && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">Outcome</label>
                                            <select 
                                                className="form-select" 
                                                value={editForm.outcome} 
                                                onChange={(e) => setEditForm({ ...editForm, outcome: e.target.value })}
                                            >
                                                <option value="connected">Connected</option>
                                                <option value="no_answer">No Answer</option>
                                                <option value="promise">Promise</option>
                                                <option value="rejected">Rejected</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Promised Payment Amount (₹)</label>
                                            <input 
                                                className="form-input" 
                                                type="number"
                                                value={editForm.promisedPaymentAmount} 
                                                onChange={(e) => setEditForm({ ...editForm, promisedPaymentAmount: e.target.value })} 
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Promised Payment Date</label>
                                            <input 
                                                className="form-input" 
                                                type="date"
                                                value={editForm.promisedPaymentDate} 
                                                onChange={(e) => setEditForm({ ...editForm, promisedPaymentDate: e.target.value })} 
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Next Followup Date</label>
                                            <input 
                                                className="form-input" 
                                                type="date"
                                                value={editForm.nextFollowupDate} 
                                                onChange={(e) => setEditForm({ ...editForm, nextFollowupDate: e.target.value })} 
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Notes</label>
                                            <textarea 
                                                className="form-textarea" 
                                                value={editForm.notes} 
                                                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} 
                                                rows={3}
                                            />
                                        </div>
                                    </>
                                )}

                                {editingEntity.type === 'organization' && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">Name *</label>
                                            <input 
                                                className="form-input" 
                                                required 
                                                value={editForm.name} 
                                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} 
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Phone</label>
                                            <input 
                                                className="form-input" 
                                                value={editForm.phone} 
                                                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} 
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Address</label>
                                            <textarea 
                                                className="form-textarea" 
                                                value={editForm.address} 
                                                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} 
                                                rows={2}
                                            />
                                        </div>
                                    </>
                                )}

                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setEditingEntity(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={updatingEntity}>
                                    {updatingEntity ? <span className="loading-spinner" /> : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Revert Confirmation Modal */}
            {revertingLog && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 440 }}>
                        <div className="modal-header">
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
                                <AlertTriangle size={18} /> Confirm Reversion
                            </h2>
                            <button className="btn-icon" onClick={() => setRevertingLog(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <p style={{ fontWeight: 500 }}>
                                Are you sure you want to revert the following action?
                            </p>
                            <div className="card-glass" style={{ background: '#fef2f2', border: '1px solid #fee2e2' }}>
                                <div className="text-sm font-semibold" style={{ color: '#ef4444' }}>
                                    {getFriendlyActionName(revertingLog.action)}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                    {renderDetailsSummary(revertingLog)}
                                </div>
                            </div>
                            <p className="text-xs text-slate-500">
                                This will undo the action and restore relevant balances or remove created items. Dependent entities may block this action.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setRevertingLog(null)}>Cancel</button>
                            <button 
                                type="button" 
                                className="btn btn-danger" 
                                onClick={confirmRevertLog} 
                                disabled={revertingInProgress}
                            >
                                {revertingInProgress ? <span className="loading-spinner" /> : 'Yes, Revert'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast && (
                <div className={`toast toast-${toast.type || 'success'}`}>
                    {toast.type === 'success' ? <Check size={16} /> : null}
                    {toast.message}
                </div>
            )}
        </div>
    );
}

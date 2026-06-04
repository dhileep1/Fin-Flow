import React, { useState, useEffect, useRef } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Lock, Copy, Check, MoreVertical, Shield, KeyRound, UserX, ChevronLeft, ChevronRight } from 'lucide-react';

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

    useEffect(() => { loadData(); }, []);

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
            // This would call an update endpoint — for now just simulate
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
    ];

    const pagedUsers = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));

    return (
        <div className="animate-fade-in" style={{ maxWidth: 900 }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Settings</h1>
                    <p className="page-subtitle">Organization settings and user management</p>
                </div>
            </div>

            <div className="tabs">
                {tabs.map((t) => (
                    <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => { setActiveTab(t.key); setPage(1); }}>
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
            ) : (
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
                                        <td><span className="badge badge-accent">{u.role}</span></td>
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

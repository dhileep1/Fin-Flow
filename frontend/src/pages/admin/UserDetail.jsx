import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/client';
import { 
    ArrowLeft, Shield, User, Wallet, Phone, Check, KeyRound, 
    Save, Target, IndianRupee, FileText, Activity, AlertCircle, Clock,
    Mail, Calendar, Lock, CheckCircle2, ChevronRight, RefreshCw, Layers, Award
} from 'lucide-react';

export default function UserDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

    // Form state
    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        role: 'staff',
        status: 'active',
        password: '',
        dailyCollTarget: 500000,
        dailyDisbTarget: 2000000,
    });

    // Navigation Tab state: 'profile' | 'targets' | 'security' | 'loans' | 'collections'
    const [activeSection, setActiveSection] = useState('profile');

    useEffect(() => {
        loadUser();
    }, [id]);

    const loadUser = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await api.getUser(id);
            setUserData(data);

            const u = data.user;
            const targets = u.targets || {};

            setForm({
                name: u.name || '',
                email: u.email || '',
                phone: u.phone || '',
                role: u.role || 'staff',
                status: u.status || 'active',
                password: '',
                dailyCollTarget: targets.dailyCollTarget !== undefined ? targets.dailyCollTarget : 500000,
                dailyDisbTarget: targets.dailyDisbTarget !== undefined ? targets.dailyDisbTarget : 2000000,
            });
        } catch (err) {
            console.error('Failed to load user details:', err);
            setError(err.message || 'Failed to load user profile');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                email: form.email ? form.email.trim() : null,
                phone: form.phone ? form.phone.trim() : null,
                role: form.role,
                status: form.status,
                targets: {
                    dailyCollTarget: Number(form.dailyCollTarget),
                    dailyDisbTarget: Number(form.dailyDisbTarget),
                },
            };

            if (form.password) {
                if (form.password.length < 8) {
                    throw new Error('Password must be at least 8 characters long');
                }
                payload.password = form.password;
            }

            await api.updateUser(id, payload);
            showToast('User preferences & customizations updated successfully!');
            setForm((prev) => ({ ...prev, password: '' }));
            loadUser();
        } catch (err) {
            showToast(err.message || 'Failed to update user', 'danger');
        } finally {
            setSaving(false);
        }
    };

    const getRoleBadgeStyle = (role) => {
        switch (role) {
            case 'admin':
                return { bg: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.3)' };
            case 'accountant':
                return { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' };
            case 'staff':
                return { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' };
            case 'viewer':
                return { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' };
            default:
                return { bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b', border: '1px solid rgba(100, 116, 139, 0.3)' };
        }
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(val || 0);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
                <div className="loading-spinner" style={{ width: 40, height: 40 }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Loading user customization panel...</p>
            </div>
        );
    }

    if (error || !userData) {
        return (
            <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
                <button onClick={() => navigate('/admin')} className="btn btn-secondary mb-4" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ArrowLeft size={16} /> Back to Team Settings
                </button>
                <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                    <AlertCircle size={48} style={{ color: '#ef4444', margin: '0 auto 1rem' }} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>User Profile Not Found</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error || 'Unable to retrieve user record'}</p>
                    <button onClick={loadUser} className="btn btn-primary">Retry</button>
                </div>
            </div>
        );
    }

    const { user: u, metrics, assignedLoans = [], recentCollections = [] } = userData;
    const roleStyle = getRoleBadgeStyle(u.role);

    return (
        <div className="animate-fade-in" style={{ width: '100%', maxWidth: '1280px', margin: '0 auto', paddingBottom: '4rem' }}>
            {toast && (
                <div className={`toast toast-${toast.type}`} style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}>
                    {toast.message}
                </div>
            )}

            {/* Breadcrumbs Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <button 
                    onClick={() => navigate('/admin')} 
                    style={{ background: 'none', border: 'none', padding: 0, color: 'var(--brand-accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 500 }}
                >
                    <ArrowLeft size={16} /> Team Members
                </button>
                <ChevronRight size={14} style={{ opacity: 0.4 }} />
                <span>Customization</span>
                <ChevronRight size={14} style={{ opacity: 0.4 }} />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</span>
            </div>

            {/* HERO PROFILE CARD */}
            <div 
                className="card" 
                style={{ 
                    padding: '2rem', 
                    marginBottom: '2rem', 
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.04) 0%, rgba(16, 185, 129, 0.04) 100%)',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
                }}
            >
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        {/* Avatar with Status Dot */}
                        <div style={{ position: 'relative' }}>
                            <div 
                                style={{ 
                                    width: 72, 
                                    height: 72, 
                                    borderRadius: '50%', 
                                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 
                                    color: '#ffffff', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    fontSize: '1.75rem', 
                                    fontWeight: 700,
                                    boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.3)'
                                }}
                            >
                                {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <span 
                                style={{ 
                                    position: 'absolute', 
                                    bottom: 2, 
                                    right: 2, 
                                    width: 18, 
                                    height: 18, 
                                    borderRadius: '50%', 
                                    background: u.status === 'active' ? '#10b981' : '#ef4444', 
                                    border: '3px solid var(--card-bg, #ffffff)',
                                }} 
                                title={`Account Status: ${u.status}`}
                            />
                        </div>

                        {/* User Metadata */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{u.name}</h1>
                                
                                <span style={{ padding: '0.2rem 0.65rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', ...roleStyle }}>
                                    {u.role}
                                </span>

                                <span style={{ padding: '0.2rem 0.65rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize', background: u.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: u.status === 'active' ? '#10b981' : '#ef4444' }}>
                                    {u.status}
                                </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginTop: '0.6rem', color: 'var(--text-secondary)', fontSize: '0.875rem', flexWrap: 'wrap' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <Mail size={14} style={{ opacity: 0.7 }} />
                                    {u.email || 'No email associated'}
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <Phone size={14} style={{ opacity: 0.7 }} />
                                    {u.phone || 'No phone set'}
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <Calendar size={14} style={{ opacity: 0.7 }} />
                                    Joined {formatDate(u.createdAt)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Header Action Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button 
                            type="button"
                            onClick={() => loadUser()} 
                            className="btn btn-secondary" 
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem' }}
                            title="Refresh User Profile"
                        >
                            <RefreshCw size={16} /> Refresh
                        </button>

                        <button 
                            type="button" 
                            onClick={handleSubmit} 
                            className="btn btn-primary" 
                            disabled={saving}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)' }}
                        >
                            {saving ? <span className="loading-spinner" /> : <><Save size={16} /> Save Changes</>}
                        </button>
                    </div>
                </div>
            </div>

            {/* METRICS STATS CARDS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                <div className="card" style={{ padding: '1.25rem', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assigned Active Loans</span>
                        <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
                            <FileText size={18} />
                        </div>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{metrics.assignedLoansCount}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                        Outstanding: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(metrics.assignedLoansOutstanding)}</strong>
                    </div>
                </div>

                <div className="card" style={{ padding: '1.25rem', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Disbursed</span>
                        <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                            <Wallet size={18} />
                        </div>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(metrics.totalDisbursed)}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                        Cumulative principal disbursed
                    </div>
                </div>

                <div className="card" style={{ padding: '1.25rem', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Collections Handled</span>
                        <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                            <IndianRupee size={18} />
                        </div>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10b981' }}>{formatCurrency(metrics.totalCollectedAmount)}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                        Across {metrics.collectionsCount} recorded payments
                    </div>
                </div>

                <div className="card" style={{ padding: '1.25rem', borderRadius: '12px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Call Follow-up Tasks</span>
                        <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                            <Phone size={18} />
                        </div>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{metrics.assignedTasksCount}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                        Assigned call task queue
                    </div>
                </div>
            </div>

            {/* NAVIGATION TABS SECTION */}
            <div style={{ borderBottom: '1px solid var(--border-color)', marginBottom: '2rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                    onClick={() => setActiveSection('profile')}
                    style={{
                        padding: '0.85rem 1.25rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: activeSection === 'profile' ? 'var(--brand-accent)' : 'var(--text-secondary)',
                        borderBottom: activeSection === 'profile' ? '2px solid var(--brand-accent)' : '2px solid transparent',
                        background: 'none',
                        borderTop: 'none',
                        borderLeft: 'none',
                        borderRight: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <User size={18} /> Profile & System Role
                </button>

                <button
                    onClick={() => setActiveSection('targets')}
                    style={{
                        padding: '0.85rem 1.25rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: activeSection === 'targets' ? 'var(--brand-accent)' : 'var(--text-secondary)',
                        borderBottom: activeSection === 'targets' ? '2px solid var(--brand-accent)' : '2px solid transparent',
                        background: 'none',
                        borderTop: 'none',
                        borderLeft: 'none',
                        borderRight: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <Target size={18} /> KPI & Performance Targets
                </button>

                <button
                    onClick={() => setActiveSection('security')}
                    style={{
                        padding: '0.85rem 1.25rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: activeSection === 'security' ? 'var(--brand-accent)' : 'var(--text-secondary)',
                        borderBottom: activeSection === 'security' ? '2px solid var(--brand-accent)' : '2px solid transparent',
                        background: 'none',
                        borderTop: 'none',
                        borderLeft: 'none',
                        borderRight: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <KeyRound size={18} /> Security & Reset Password
                </button>

                <button
                    onClick={() => setActiveSection('loans')}
                    style={{
                        padding: '0.85rem 1.25rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: activeSection === 'loans' ? 'var(--brand-accent)' : 'var(--text-secondary)',
                        borderBottom: activeSection === 'loans' ? '2px solid var(--brand-accent)' : '2px solid transparent',
                        background: 'none',
                        borderTop: 'none',
                        borderLeft: 'none',
                        borderRight: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <Layers size={18} /> Assigned Portfolio ({assignedLoans.length})
                </button>

                <button
                    onClick={() => setActiveSection('collections')}
                    style={{
                        padding: '0.85rem 1.25rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: activeSection === 'collections' ? 'var(--brand-accent)' : 'var(--text-secondary)',
                        borderBottom: activeSection === 'collections' ? '2px solid var(--brand-accent)' : '2px solid transparent',
                        background: 'none',
                        borderTop: 'none',
                        borderLeft: 'none',
                        borderRight: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <Activity size={18} /> Collection History ({recentCollections.length})
                </button>
            </div>

            {/* TAB CONTENT SECTIONS */}
            <form onSubmit={handleSubmit}>
                {/* 1. PROFILE & ROLE TAB */}
                {activeSection === 'profile' && (
                    <div className="card" style={{ padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <User size={20} className="text-brand-accent" /> Basic User Profile & Access Control
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                                Manage identity details, system authorization roles, and account state.
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            <div className="form-group">
                                <label className="form-label" style={{ fontWeight: 600 }}>Full Name *</label>
                                <input
                                    className="form-input"
                                    required
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="Enter full name"
                                    style={{ padding: '0.75rem 1rem', fontSize: '0.95rem' }}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" style={{ fontWeight: 600 }}>Email Address</label>
                                <input
                                    className="form-input"
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="user@company.com"
                                    style={{ padding: '0.75rem 1rem', fontSize: '0.95rem' }}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" style={{ fontWeight: 600 }}>Phone Number</label>
                                <input
                                    className="form-input"
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    placeholder="9876543210"
                                    style={{ padding: '0.75rem 1rem', fontSize: '0.95rem' }}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" style={{ fontWeight: 600 }}>System Role *</label>
                                <select
                                    className="form-select"
                                    value={form.role}
                                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                                    style={{ padding: '0.75rem 1rem', fontSize: '0.95rem' }}
                                >
                                    <option value="admin">Admin (Full System Access)</option>
                                    <option value="accountant">Accountant (Loans & Payments)</option>
                                    <option value="staff">Staff (Call Operations & Field)</option>
                                    <option value="viewer">Viewer (Read-Only Access)</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label" style={{ fontWeight: 600 }}>Account Status *</label>
                                <select
                                    className="form-select"
                                    value={form.status}
                                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                                    style={{ padding: '0.75rem 1rem', fontSize: '0.95rem' }}
                                >
                                    <option value="active">Active (Can Sign In)</option>
                                    <option value="inactive">Inactive (Access Suspended)</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem' }}>
                                {saving ? <span className="loading-spinner" /> : <><Save size={18} /> Save Profile Settings</>}
                            </button>
                        </div>
                    </div>
                )}

                {/* 2. KPI TARGETS TAB */}
                {activeSection === 'targets' && (
                    <div className="card" style={{ padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Target size={20} className="text-brand-accent" /> Individual Performance & KPI Targets
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                                Set custom financial collection and disbursal targets used for progress gauges on the dashboard.
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
                            <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-secondary, rgba(0,0,0,0.02))', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                    <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                                        <IndianRupee size={20} />
                                    </div>
                                    <div>
                                        <h4 style={{ margin: 0, fontWeight: 600, fontSize: '1rem' }}>Daily Collection Target</h4>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Target amount to collect daily</p>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 600 }}>Amount (₹)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={form.dailyCollTarget}
                                        onChange={(e) => setForm({ ...form, dailyCollTarget: e.target.value })}
                                        placeholder="500000"
                                        style={{ padding: '0.75rem 1rem', fontSize: '1.1rem', fontWeight: 600 }}
                                    />
                                </div>

                                {/* Quick Target Presets */}
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                                    {[100000, 250000, 500000, 1000000].map((amt) => (
                                        <button
                                            key={amt}
                                            type="button"
                                            onClick={() => setForm({ ...form, dailyCollTarget: amt })}
                                            className="btn btn-secondary btn-sm"
                                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                                        >
                                            ₹{(amt / 100000).toFixed(amt % 100000 === 0 ? 0 : 1)}L
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-secondary, rgba(0,0,0,0.02))', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                    <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                                        <Wallet size={20} />
                                    </div>
                                    <div>
                                        <h4 style={{ margin: 0, fontWeight: 600, fontSize: '1rem' }}>Daily Disbursal Target</h4>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Target principal disbursals per day</p>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 600 }}>Amount (₹)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={form.dailyDisbTarget}
                                        onChange={(e) => setForm({ ...form, dailyDisbTarget: e.target.value })}
                                        placeholder="2000000"
                                        style={{ padding: '0.75rem 1rem', fontSize: '1.1rem', fontWeight: 600 }}
                                    />
                                </div>

                                {/* Quick Target Presets */}
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                                    {[500000, 1000000, 2000000, 5000000].map((amt) => (
                                        <button
                                            key={amt}
                                            type="button"
                                            onClick={() => setForm({ ...form, dailyDisbTarget: amt })}
                                            className="btn btn-secondary btn-sm"
                                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                                        >
                                            ₹{(amt / 100000).toFixed(amt % 100000 === 0 ? 0 : 1)}L
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem' }}>
                                {saving ? <span className="loading-spinner" /> : <><Save size={18} /> Save Target Metrics</>}
                            </button>
                        </div>
                    </div>
                )}

                {/* 3. SECURITY TAB */}
                {activeSection === 'security' && (
                    <div className="card" style={{ padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <KeyRound size={20} className="text-brand-accent" /> Security Credentials & Password Reset
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                                Directly set or override the user's password. Password must be at least 8 characters long.
                            </p>
                        </div>

                        <div style={{ maxWidth: '500px' }}>
                            <div className="form-group mb-4">
                                <label className="form-label" style={{ fontWeight: 600 }}>New Password</label>
                                <input
                                    className="form-input"
                                    type="password"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    placeholder="Enter new password (min 8 chars)"
                                    style={{ padding: '0.75rem 1rem', fontSize: '0.95rem' }}
                                />
                            </div>

                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                                Note: Updating password will take effect immediately. The user will log in with this new password on their next sign-in.
                            </p>

                            <button type="submit" className="btn btn-primary" disabled={saving || !form.password} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem' }}>
                                {saving ? <span className="loading-spinner" /> : <><Lock size={18} /> Update User Password</>}
                            </button>
                        </div>
                    </div>
                )}
            </form>

            {/* 4. ASSIGNED PORTFOLIO TAB */}
            {activeSection === 'loans' && (
                <div className="card" style={{ padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Layers size={20} className="text-brand-accent" /> Assigned Active Loans Portfolio
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                                Active loan accounts assigned to {u.name} for monitoring and field operations.
                            </p>
                        </div>
                    </div>

                    {assignedLoans.length === 0 ? (
                        <div className="empty-state py-12 text-center" style={{ padding: '3rem' }}>
                            <FileText size={48} style={{ opacity: 0.3, margin: '0 auto 1rem' }} />
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>No active loans currently assigned to this team member.</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Customer</th>
                                        <th>Vehicle Number</th>
                                        <th>Principal</th>
                                        <th>Outstanding Balance</th>
                                        <th>Status</th>
                                        <th style={{ width: 100, textAlign: 'center' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {assignedLoans.map((l) => (
                                        <tr key={l.id} className="hover-table-row">
                                            <td>
                                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{l.customer?.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{l.customer?.phone}</div>
                                            </td>
                                            <td style={{ fontSize: '0.875rem' }}>
                                                <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{l.vehicle?.vehicleNumber || '—'}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{l.vehicle?.model || ''}</div>
                                            </td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{formatCurrency(l.principalAmount)}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                {formatCurrency(l.outstandingPrincipal)}
                                            </td>
                                            <td>
                                                <span className={`badge ${l.status === 'active' ? 'badge-success' : 'badge-neutral'}`} style={{ textTransform: 'capitalize' }}>
                                                    {l.status}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <Link to={`/loans/${l.id}`} className="btn btn-ghost btn-sm">
                                                    View Loan
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* 5. COLLECTION HISTORY TAB */}
            {activeSection === 'collections' && (
                <div className="card" style={{ padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Activity size={20} className="text-brand-accent" /> Recent Collection Transactions
                        </h3>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                            Log of payments collected and recorded by {u.name}.
                        </p>
                    </div>

                    {recentCollections.length === 0 ? (
                        <div className="empty-state py-12 text-center" style={{ padding: '3rem' }}>
                            <IndianRupee size={48} style={{ opacity: 0.3, margin: '0 auto 1rem' }} />
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>No payment collections recorded by this user yet.</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date & Time</th>
                                        <th>Customer</th>
                                        <th>Payment Method</th>
                                        <th style={{ textAlign: 'right' }}>Collected Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentCollections.map((p) => (
                                        <tr key={p.id} className="hover-table-row">
                                            <td style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                                {formatDate(p.paymentDate)} • {new Date(p.paymentDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                                {p.loan?.customer?.name || '—'}
                                            </td>
                                            <td>
                                                <span className="badge badge-neutral text-xs" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    {p.paymentMethod || 'cash'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.95rem', fontWeight: 700, color: '#10b981' }}>
                                                {formatCurrency(p.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

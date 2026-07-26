import React, { useState, useEffect, useRef } from 'react';
import {
    Plus,
    MoreVertical,
    Play,
    Pause,
    Eye,
    XCircle,
    RefreshCw,
} from 'lucide-react';
import { superAdminApi } from '../../api/client';
import api from '../../api/client';

/**
 * Tenant Manager — lists all organizations, allows provisioning,
 * status toggling (suspend/activate), and tenant impersonation.
 */
export default function TenantManager() {
    const [orgs, setOrgs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Provision modal state
    const [showProvision, setShowProvision] = useState(false);
    const [provisionForm, setProvisionForm] = useState({
        name: '', phone: '', address: '',
        adminName: '', adminEmail: '', adminPassword: '',
    });
    const [provisionError, setProvisionError] = useState('');
    const [provisioning, setProvisioning] = useState(false);

    // Impersonate modal state
    const [impersonateOrg, setImpersonateOrg] = useState(null);
    const [impersonateReason, setImpersonateReason] = useState('');
    const [impersonateError, setImpersonateError] = useState('');
    const [impersonating, setImpersonating] = useState(false);

    // Actions dropdown
    const [openDropdown, setOpenDropdown] = useState(null);
    const dropdownRef = useRef(null);

    useEffect(() => {
        loadOrgs();
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpenDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const loadOrgs = async () => {
        try {
            setLoading(true);
            const data = await superAdminApi.getOrgs();
            setOrgs(data.orgs || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleProvision = async (e) => {
        e.preventDefault();
        setProvisionError('');
        setProvisioning(true);
        try {
            await superAdminApi.provisionOrg(provisionForm);
            setShowProvision(false);
            setProvisionForm({
                name: '', phone: '', address: '',
                adminName: '', adminEmail: '', adminPassword: '',
            });
            loadOrgs();
        } catch (err) {
            setProvisionError(err.message);
        } finally {
            setProvisioning(false);
        }
    };

    const handleToggleStatus = async (org) => {
        const newStatus = org.status === 'active' ? 'suspended' : 'active';
        const reason = prompt(
            `Reason for ${newStatus === 'suspended' ? 'suspending' : 'activating'} "${org.name}":`
        );
        if (reason === null) return; // Cancelled

        try {
            await superAdminApi.updateOrgStatus(org.id, newStatus, reason);
            loadOrgs();
        } catch (err) {
            alert(err.message);
        }
        setOpenDropdown(null);
    };

    const handleImpersonate = async () => {
        if (!impersonateReason || impersonateReason.trim().length < 3) {
            setImpersonateError('Please provide a reason (at least 3 characters)');
            return;
        }

        setImpersonateError('');
        setImpersonating(true);
        try {
            const data = await superAdminApi.impersonate(impersonateOrg.id, impersonateReason.trim());

            // Backup the current super-admin session
            localStorage.setItem('superAdminBackupToken', localStorage.getItem('superAdminToken'));
            localStorage.setItem('superAdminBackupUser', localStorage.getItem('superAdminUser'));

            // Swap to impersonation token (tenant context)
            api.setAuth(data.token, data.orgId);
            localStorage.setItem('lendEasyUser', JSON.stringify(data.user));

            // Redirect to tenant dashboard
            window.location.href = '/';
        } catch (err) {
            setImpersonateError(err.message);
        } finally {
            setImpersonating(false);
        }
    };

    const formatCurrency = (val) => {
        const num = Number(val) || 0;
        if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
        if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
        return `₹${num.toLocaleString('en-IN')}`;
    };

    if (loading) {
        return (
            <div className="sa-loading">
                <div className="sa-spinner" />
                Loading tenants...
            </div>
        );
    }

    return (
        <div>
            <div className="sa-page-header">
                <h1 className="sa-page-title">Tenant Manager</h1>
                <p className="sa-page-subtitle">Manage organizations on the FinFlow platform</p>
            </div>

            {/* Orgs Table */}
            <div className="sa-table-wrapper">
                <div className="sa-table-header">
                    <span className="sa-table-title">Organizations ({orgs.length})</span>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <button className="sa-btn sa-btn-ghost" onClick={loadOrgs}>
                            <RefreshCw size={16} />
                        </button>
                        <button
                            className="sa-btn sa-btn-primary"
                            onClick={() => setShowProvision(true)}
                        >
                            <Plus size={16} />
                            Provision Tenant
                        </button>
                    </div>
                </div>

                {error && (
                    <div style={{ padding: 'var(--space-4)', color: '#f87171', fontSize: 'var(--font-size-sm)' }}>
                        {error}
                    </div>
                )}

                <table className="sa-table">
                    <thead>
                        <tr>
                            <th>Organization</th>
                            <th>Status</th>
                            <th>Active Loans</th>
                            <th>Outstanding</th>
                            <th>Customers</th>
                            <th>WhatsApp Sent</th>
                            <th>Created</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {orgs.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="sa-empty">No organizations found</td>
                            </tr>
                        ) : (
                            orgs.map((org) => (
                                <tr key={org.id}>
                                    <td>
                                        <div style={{ fontWeight: 600, color: '#ffffff' }}>
                                            {org.name}
                                        </div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--sa-text-muted)', marginTop: '2px' }}>
                                            {org.id.slice(0, 8)}...
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`sa-badge sa-badge-${org.status}`}>
                                            {org.status}
                                        </span>
                                    </td>
                                    <td>{org.metrics?.activeLoans || 0}</td>
                                    <td>{formatCurrency(org.metrics?.totalOutstanding)}</td>
                                    <td>{org.metrics?.totalCustomers || 0}</td>
                                    <td>{org.metrics?.whatsappSent || 0}</td>
                                    <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--sa-text-muted)' }}>
                                        {new Date(org.createdAt).toLocaleDateString()}
                                    </td>
                                    <td>
                                        <div className="sa-actions-wrapper" ref={openDropdown === org.id ? dropdownRef : null}>
                                            <button
                                                className="sa-btn sa-btn-ghost"
                                                onClick={() =>
                                                    setOpenDropdown(openDropdown === org.id ? null : org.id)
                                                }
                                                style={{ padding: 'var(--space-2)' }}
                                            >
                                                <MoreVertical size={16} />
                                            </button>
                                            {openDropdown === org.id && (
                                                <div className="sa-actions-menu">
                                                    <button
                                                        className="sa-actions-item"
                                                        onClick={() => {
                                                            setImpersonateOrg(org);
                                                            setOpenDropdown(null);
                                                        }}
                                                    >
                                                        <Eye size={14} />
                                                        Impersonate
                                                    </button>
                                                    <button
                                                        className="sa-actions-item"
                                                        onClick={() => handleToggleStatus(org)}
                                                    >
                                                        {org.status === 'active' ? (
                                                            <><Pause size={14} /> Suspend</>
                                                        ) : (
                                                            <><Play size={14} /> Activate</>
                                                        )}
                                                    </button>
                                                    {org.status !== 'decommissioned' && (
                                                        <button
                                                            className="sa-actions-item danger"
                                                            onClick={async () => {
                                                                const reason = prompt('Reason for decommissioning:');
                                                                if (reason === null) return;
                                                                try {
                                                                    await superAdminApi.updateOrgStatus(org.id, 'decommissioned', reason);
                                                                    loadOrgs();
                                                                } catch (err) {
                                                                    alert(err.message);
                                                                }
                                                                setOpenDropdown(null);
                                                            }}
                                                        >
                                                            <XCircle size={14} />
                                                            Decommission
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* ═══ Provision Modal ═══ */}
            {showProvision && (
                <div className="sa-modal-overlay" onClick={() => setShowProvision(false)}>
                    <div className="sa-modal" onClick={(e) => e.stopPropagation()}>
                        <h2 className="sa-modal-title">Provision New Tenant</h2>
                        {provisionError && <div className="sa-modal-error">{provisionError}</div>}
                        <form onSubmit={handleProvision}>
                            <div className="sa-form-group">
                                <label className="sa-form-label">Organization Name *</label>
                                <input
                                    className="sa-form-input"
                                    value={provisionForm.name}
                                    onChange={(e) => setProvisionForm({ ...provisionForm, name: e.target.value })}
                                    placeholder="Acme Finance Ltd"
                                    required
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                <div className="sa-form-group">
                                    <label className="sa-form-label">Phone</label>
                                    <input
                                        className="sa-form-input"
                                        value={provisionForm.phone}
                                        onChange={(e) => setProvisionForm({ ...provisionForm, phone: e.target.value })}
                                        placeholder="+91 98765 43210"
                                    />
                                </div>
                                <div className="sa-form-group">
                                    <label className="sa-form-label">Address</label>
                                    <input
                                        className="sa-form-input"
                                        value={provisionForm.address}
                                        onChange={(e) => setProvisionForm({ ...provisionForm, address: e.target.value })}
                                        placeholder="City, State"
                                    />
                                </div>
                            </div>

                            <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--sa-card-border)' }}>
                                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--sa-text-secondary)', marginBottom: 'var(--space-3)' }}>
                                    First Admin User
                                </div>
                                <div className="sa-form-group">
                                    <label className="sa-form-label">Admin Name *</label>
                                    <input
                                        className="sa-form-input"
                                        value={provisionForm.adminName}
                                        onChange={(e) => setProvisionForm({ ...provisionForm, adminName: e.target.value })}
                                        placeholder="John Doe"
                                        required
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="sa-form-group">
                                        <label className="sa-form-label">Admin Email *</label>
                                        <input
                                            className="sa-form-input"
                                            type="email"
                                            value={provisionForm.adminEmail}
                                            onChange={(e) => setProvisionForm({ ...provisionForm, adminEmail: e.target.value })}
                                            placeholder="admin@acme.com"
                                            required
                                        />
                                    </div>
                                    <div className="sa-form-group">
                                        <label className="sa-form-label">Admin Password *</label>
                                        <input
                                            className="sa-form-input"
                                            type="password"
                                            value={provisionForm.adminPassword}
                                            onChange={(e) => setProvisionForm({ ...provisionForm, adminPassword: e.target.value })}
                                            placeholder="••••••••"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="sa-modal-actions">
                                <button
                                    type="button"
                                    className="sa-btn sa-btn-ghost"
                                    onClick={() => setShowProvision(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="sa-btn sa-btn-primary"
                                    disabled={provisioning}
                                >
                                    {provisioning ? 'Provisioning...' : 'Provision Tenant'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══ Impersonate Modal ═══ */}
            {impersonateOrg && (
                <div className="sa-modal-overlay" onClick={() => { setImpersonateOrg(null); setImpersonateReason(''); setImpersonateError(''); }}>
                    <div className="sa-modal" onClick={(e) => e.stopPropagation()}>
                        <h2 className="sa-modal-title">Impersonate Tenant</h2>
                        <p style={{ color: 'var(--sa-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-5)' }}>
                            You are about to view <strong style={{ color: '#ffffff' }}>{impersonateOrg.name}</strong> as a read-only admin.
                            This action will be logged.
                        </p>
                        {impersonateError && <div className="sa-modal-error">{impersonateError}</div>}
                        <div className="sa-form-group">
                            <label className="sa-form-label">Reason for impersonation *</label>
                            <input
                                className="sa-form-input"
                                value={impersonateReason}
                                onChange={(e) => setImpersonateReason(e.target.value)}
                                placeholder="e.g., Investigating support ticket #1234"
                                autoFocus
                            />
                        </div>
                        <div className="sa-modal-actions">
                            <button
                                className="sa-btn sa-btn-ghost"
                                onClick={() => { setImpersonateOrg(null); setImpersonateReason(''); setImpersonateError(''); }}
                            >
                                Cancel
                            </button>
                            <button
                                className="sa-btn sa-btn-warning"
                                onClick={handleImpersonate}
                                disabled={impersonating}
                            >
                                <Eye size={14} />
                                {impersonating ? 'Switching...' : 'Start Impersonation'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

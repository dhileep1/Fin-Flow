import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
    Shield,
    LayoutDashboard,
    Building2,
    HeartPulse,
    ListChecks,
    LogOut,
    User,
    Menu,
    X,
} from 'lucide-react';
import '../../styles/superAdmin.css';

const navItems = [
    { path: '/super-admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { path: '/super-admin/tenants', label: 'Tenants', icon: Building2 },
    { path: '/super-admin/system-health', label: 'System Health', icon: HeartPulse },
    { path: '/super-admin/queue-monitor', label: 'Queue Monitor', icon: ListChecks },
];

/**
 * Super-Admin Layout with dark sidebar and content area.
 * Completely separate from the tenant Layout.
 */
export default function SuperAdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);

    const user = (() => {
        try {
            return JSON.parse(localStorage.getItem('superAdminUser'));
        } catch {
            return null;
        }
    })();

    // Check auth on mount
    useEffect(() => {
        const token = localStorage.getItem('superAdminToken');
        if (!token) {
            navigate('/super-admin/login', { replace: true });
        }
    }, [navigate]);

    // Close mobile menu on route change
    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    const handleLogout = () => {
        localStorage.removeItem('superAdminToken');
        localStorage.removeItem('superAdminUser');
        navigate('/super-admin/login');
    };

    return (
        <div className="sa-page">
            <div className="sa-layout">
                {/* Mobile overlay */}
                {mobileOpen && (
                    <div
                        className="sa-modal-overlay"
                        style={{ zIndex: 99, background: 'rgba(0,0,0,0.5)' }}
                        onClick={() => setMobileOpen(false)}
                    />
                )}

                {/* Sidebar */}
                <aside className={`sa-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
                    <div className="sa-sidebar-brand">
                        <Shield size={22} className="sa-sidebar-brand-icon" />
                        <span className="sa-sidebar-brand-text">FinFlow</span>
                        <span className="sa-sidebar-brand-badge">Admin</span>
                    </div>

                    <nav className="sa-sidebar-nav">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    end={item.end}
                                    className={({ isActive }) =>
                                        `sa-nav-item ${isActive ? 'active' : ''}`
                                    }
                                >
                                    <span className="nav-icon">
                                        <Icon size={20} />
                                    </span>
                                    {item.label}
                                </NavLink>
                            );
                        })}
                    </nav>

                    <div className="sa-sidebar-bottom">
                        <div className="sa-sidebar-user">
                            <div className="sa-sidebar-user-avatar">
                                <User size={16} />
                            </div>
                            <div className="sa-sidebar-user-info">
                                <div className="sa-sidebar-user-name">{user?.name || 'Admin'}</div>
                                <div className="sa-sidebar-user-role">{user?.role?.replace('_', ' ') || 'Super Admin'}</div>
                            </div>
                        </div>
                        <button className="sa-nav-item" onClick={handleLogout} style={{ marginTop: '4px' }}>
                            <span className="nav-icon">
                                <LogOut size={20} />
                            </span>
                            Logout
                        </button>
                    </div>
                </aside>

                {/* Main content */}
                <main className="sa-main">
                    {/* Mobile hamburger */}
                    <button
                        className="sa-btn sa-btn-ghost"
                        onClick={() => setMobileOpen((v) => !v)}
                        style={{
                            display: 'none',
                            marginBottom: 'var(--space-4)',
                            position: 'fixed',
                            top: 'var(--space-3)',
                            left: 'var(--space-3)',
                            zIndex: 101,
                        }}
                        aria-label="Toggle menu"
                    >
                        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>

                    <Outlet />
                </main>
            </div>
        </div>
    );
}

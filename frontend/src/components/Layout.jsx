import React, { useState, useCallback, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import GlobalSearch from './GlobalSearch';
import PaymentModal from './PaymentModal';
import api from '../api/client';
import {
    PlusCircle,
    IndianRupee,
    User,
    Wallet,
    Bell,
    Menu,
    X,
    HelpCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../styles/layout.css';

export default function Layout() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    /* ── Sidebar collapse state ── */
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        try { return localStorage.getItem('sidebar-collapsed') === 'true'; }
        catch { return false; }
    });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const toggleSidebar = useCallback(() => {
        setSidebarCollapsed(prev => {
            const next = !prev;
            try { localStorage.setItem('sidebar-collapsed', String(next)); } catch {}
            return next;
        });
    }, []);

    /* Close mobile menu on route change */
    useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);



    /* ── Quick Payment state ── */
    const [showQuickPayment, setShowQuickPayment] = useState(false);
    const [quickQuery, setQuickQuery] = useState('');
    const [quickLoan, setQuickLoan] = useState(null);
    const [loadingLoan, setLoadingLoan] = useState(false);
    const [quickError, setQuickError] = useState('');
    const [quickResults, setQuickResults] = useState(null);

    const openQuickPayment = () => {
        setQuickQuery('');
        setQuickLoan(null);
        setQuickError('');
        setQuickResults(null);
        setShowQuickPayment(true);
    };

    /* ── Debounced auto-search for quick payment ── */
    useEffect(() => {
        if (!showQuickPayment || !quickQuery || quickQuery.trim().length < 2) {
            setQuickResults(null);
            return;
        }

        const timeoutId = setTimeout(() => {
            runQuickSearch();
        }, 400); // 400ms debounce

        return () => clearTimeout(timeoutId);
    }, [quickQuery, showQuickPayment]);

    const runQuickSearch = async () => {
        if (!quickQuery || quickQuery.trim().length < 2) {
            setQuickError('Type at least 2 characters to search');
            setQuickResults(null);
            return;
        }
        setLoadingLoan(true);
        setQuickError('');
        try {
            const data = await api.search(quickQuery.trim());
            setQuickResults(data);
            if (!data.loans || data.loans.length === 0) {
                setQuickError('No matching loans found. Try a different name, phone, vehicle, or ID.');
            }
        } catch (e) {
            setQuickResults(null);
            setQuickError(e.message || 'Search failed');
        } finally {
            setLoadingLoan(false);
        }
    };

    const chooseQuickLoan = async (loan) => {
        try {
            const full = await api.getLoan(loan.id);
            setQuickLoan(full);
        } catch (e) {
            setQuickError(e.message || 'Could not open loan');
        }
    };

    const sidebarWidth = sidebarCollapsed
        ? 'var(--sidebar-collapsed)'
        : 'var(--sidebar-expanded)';

    return (
        <div className="app-wrapper">
            {/* ═══ TOP BAR ═══ */}
            <header className="top-navbar" role="banner">
                {/* Left: Brand + Mobile hamburger */}
                <div className="navbar-left">
                    {/* Mobile hamburger */}
                    <button
                        className="navbar-hamburger"
                        onClick={() => setMobileMenuOpen(prev => !prev)}
                        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                    >
                        {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                    <div className="navbar-brand" aria-label="FinFlow Home">
                        <Wallet size={22} className="navbar-brand-icon" />
                        <span>FinFlow</span>
                    </div>
                </div>

                {/* Center: Global Search */}
                <GlobalSearch />

                {/* Right: CTAs + icons */}
                <div className="navbar-right">
                    {/* Primary CTA */}
                    <button
                        className="navbar-cta navbar-cta-primary"
                        onClick={() => navigate('/loans/new')}
                        title="New Loan"
                        aria-label="Create new loan"
                    >
                        <PlusCircle size={18} />
                        <span className="navbar-cta-label">New Loan</span>
                    </button>

                    {/* Secondary CTA */}
                    <button
                        className="navbar-cta navbar-cta-secondary"
                        onClick={openQuickPayment}
                        title="Record Payment"
                        aria-label="Record a payment"
                    >
                        <IndianRupee size={18} />
                        <span className="navbar-cta-label">Payment</span>
                    </button>

                    <div className="navbar-divider" aria-hidden="true" />

                    {/* Notification bell */}
                    <button
                        className="navbar-icon-btn"
                        title="Notifications"
                        aria-label="View notifications"
                    >
                        <Bell size={20} />
                    </button>

                    {/* Help */}
                    <button
                        className="navbar-icon-btn"
                        title="Help & Support"
                        aria-label="Help and support"
                    >
                        <HelpCircle size={20} />
                    </button>

                    {/* User avatar */}
                    <div className="navbar-user" title={user?.name || 'User'}>
                        <div className="navbar-user-avatar">
                            <User size={18} />
                        </div>
                        <span className="navbar-user-name">{user?.name || 'User'}</span>
                    </div>
                </div>
            </header>

            {/* ═══ SIDEBAR ═══ */}
            {mobileMenuOpen && (
                <div
                    className="sidebar-mobile-overlay"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-hidden="true"
                />
            )}
            <div className={`app-layout ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
                <div className={mobileMenuOpen ? 'sidebar-mobile-open-wrapper' : ''}>
                    <Sidebar
                        collapsed={sidebarCollapsed}
                        onToggle={toggleSidebar}
                    />
                </div>

                <div
                    className="content-area"
                    style={{ marginLeft: undefined }}
                >
                    <main className="main-content" id="main-content" role="main">
                        <Outlet />
                    </main>
                </div>
            </div>

            {/* ═══ QUICK PAYMENT MODAL ═══ */}
            {showQuickPayment && !quickLoan && (
                <div className="modal-overlay" onClick={() => setShowQuickPayment(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Record Payment</h2>
                            <button
                                className="btn btn-ghost"
                                type="button"
                                onClick={() => setShowQuickPayment(false)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            {quickError && <div className="login-error">{quickError}</div>}
                            <div className="form-group relative">
                                <label className="form-label">Find loan by name, phone, vehicle, or ID</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        className="form-input"
                                        value={quickQuery}
                                        onChange={(e) => setQuickQuery(e.target.value)}
                                        placeholder="Type at least 2 characters to search"
                                        autoFocus
                                    />
                                    {loadingLoan && (
                                        <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                                            <span className="loading-spinner" style={{ width: '16px', height: '16px' }} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {!loadingLoan && quickResults && quickResults.loans && quickResults.loans.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-2)', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                                    {quickResults.loans.slice(0, 5).map((l) => (
                                        <div
                                            key={l.id}
                                            className="card-glass hover:border-slate-300 transition-all cursor-pointer"
                                            style={{ padding: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                            onClick={() => chooseQuickLoan(l)}
                                        >
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <div style={{ fontWeight: 600, color: 'var(--slate-900)', fontSize: '14px' }}>
                                                    {l.customer?.name}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--slate-500)' }}>
                                                    <span className="font-mono">{l.customer?.phone}</span>
                                                    <span style={{ opacity: 0.3 }}>|</span>
                                                    <span>{l.vehicle?.vehicleNumber || 'No Vehicle'}</span>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Outstanding</div>
                                                <div style={{ fontWeight: 700, color: 'var(--color-warning)', fontSize: '15px' }}>
                                                    ₹{Number(l.outstandingPrincipal || 0).toLocaleString('en-IN')}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!loadingLoan && quickResults && quickResults.loans && quickResults.loans.length === 0 && quickQuery.length >= 2 && (
                                <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--slate-400)' }}>
                                    No loans found for "<strong>{quickQuery}</strong>"
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setShowQuickPayment(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showQuickPayment && quickLoan && (
                <PaymentModal
                    loanId={quickLoan.id}
                    customerName={quickLoan.customer?.name}
                    outstanding={Number(quickLoan.outstandingPrincipal)}
                    onClose={() => { setShowQuickPayment(false); setQuickLoan(null); }}
                    onSuccess={() => { setShowQuickPayment(false); setQuickLoan(null); }}
                />
            )}
        </div>
    );
}

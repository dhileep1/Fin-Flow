import React, { useState, useCallback, useEffect, useRef } from 'react';
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



    const getNowString = () => {
        const tzoffset = (new Date()).getTimezoneOffset() * 60000;
        return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
    };

    /* ── Inline Payment state ── */
    const [isInlineOpen, setIsInlineOpen] = useState(false);
    const [inlineStep, setInlineStep] = useState('search'); // 'search' | 'amount'
    const [inlineQuery, setInlineQuery] = useState('');
    const [inlineResults, setInlineResults] = useState(null);
    const [selectedLoan, setSelectedLoan] = useState(null);
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'upi' | 'bank'
    const [paymentDate, setPaymentDate] = useState(getNowString());
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [loadingLoan, setLoadingLoan] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const inlineRef = useRef(null);

    // Debounced search for inline payment
    useEffect(() => {
        if (!isInlineOpen || inlineStep !== 'search' || !inlineQuery || inlineQuery.trim().length < 2) {
            setInlineResults(null);
            return;
        }

        const timeoutId = setTimeout(() => {
            runInlineSearch();
        }, 400);

        return () => clearTimeout(timeoutId);
    }, [inlineQuery, isInlineOpen, inlineStep]);

    // Click outside to close inline payment
    useEffect(() => {
        if (!isInlineOpen) return;
        const handleClickOutside = (e) => {
            if (inlineRef.current && !inlineRef.current.contains(e.target)) {
                setIsInlineOpen(false);
                resetInlineState();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isInlineOpen]);

    const resetInlineState = () => {
        setInlineStep('search');
        setInlineQuery('');
        setInlineResults(null);
        setSelectedLoan(null);
        setAmount('');
        setPaymentMethod('cash');
        setPaymentDate(getNowString());
        setError('');
        setSuccessMsg('');
    };

    const runInlineSearch = async () => {
        if (!inlineQuery || inlineQuery.trim().length < 2) {
            setInlineResults(null);
            return;
        }
        setLoadingLoan(true);
        setError('');
        try {
            const data = await api.search(inlineQuery.trim());
            setInlineResults(data);
        } catch (e) {
            setInlineResults(null);
            setError(e.message || 'Search failed');
        } finally {
            setLoadingLoan(false);
        }
    };

    const handleSelectLoan = (loan) => {
        setSelectedLoan(loan);
        setInlineStep('amount');
    };

    const handleInlineSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!amount || Number(amount) <= 0) {
            setError('Please enter a valid amount');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            await api.createPayment({
                loanId: selectedLoan.id,
                amount: Number(amount),
                paymentMethod,
                paymentDate,
            });
            setSuccessMsg('Payment recorded!');
            setTimeout(() => {
                setIsInlineOpen(false);
                resetInlineState();
                window.location.reload();
            }, 1000);
        } catch (err) {
            setError(err.message || 'Payment failed');
        } finally {
            setSubmitting(false);
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

                    {/* Inline Payment Widget */}
                    <div className={`inline-pay-wrapper ${isInlineOpen ? 'is-open' : ''}`} ref={inlineRef}>
                        <button
                            className="navbar-cta navbar-cta-secondary inline-pay-trigger-btn"
                            onClick={() => {
                                setIsInlineOpen(true);
                                setInlineStep('search');
                            }}
                            title="Record Payment"
                            aria-label="Record a payment"
                            style={{
                                opacity: isInlineOpen ? 0 : 1,
                                pointerEvents: isInlineOpen ? 'none' : 'auto',
                                position: isInlineOpen ? 'absolute' : 'relative',
                                width: '100%'
                            }}
                        >
                            <IndianRupee size={18} />
                            <span className="navbar-cta-label">Payment</span>
                        </button>

                        {isInlineOpen && (
                            <div className="inline-pay-panel">
                                {inlineStep === 'search' ? (
                                    <>
                                        <div className="inline-pay-input-row">
                                            <IndianRupee size={16} className="inline-pay-search-icon" />
                                            <input
                                                type="text"
                                                className="inline-pay-panel-input"
                                                placeholder="Search loan..."
                                                value={inlineQuery}
                                                onChange={(e) => setInlineQuery(e.target.value)}
                                                autoFocus
                                            />
                                            {loadingLoan && <span className="inline-pay-spinner" />}
                                            <button 
                                                type="button" 
                                                className="inline-pay-panel-close" 
                                                onClick={() => { setIsInlineOpen(false); resetInlineState(); }}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        {/* Suggestions list */}
                                        {inlineQuery.trim().length >= 2 && (
                                            <div className="inline-pay-suggestions">
                                                {loadingLoan ? (
                                                    <div className="inline-pay-dropdown-loading">Searching...</div>
                                                ) : inlineResults && inlineResults.loans && inlineResults.loans.length > 0 ? (
                                                    inlineResults.loans.slice(0, 5).map((l) => (
                                                        <div
                                                            key={l.id}
                                                            className="inline-pay-row"
                                                            onClick={() => handleSelectLoan(l)}
                                                        >
                                                            <div className="inline-pay-row-left">
                                                                <div className="inline-pay-customer-name">{l.customer?.name}</div>
                                                                <div className="inline-pay-subtext">
                                                                    {l.vehicle?.vehicleNumber || 'No Vehicle'} · {l.customer?.phone}
                                                                </div>
                                                            </div>
                                                            <div className="inline-pay-row-right">
                                                                <div className="inline-pay-subtext-right">O/S</div>
                                                                <div className="inline-pay-amount-label">₹{Number(l.outstandingPrincipal || 0).toLocaleString('en-IN')}</div>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : inlineResults ? (
                                                    <div className="inline-pay-dropdown-empty">No loans found</div>
                                                ) : null}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div className="inline-pay-input-row inline-pay-pill-row">
                                            <IndianRupee size={16} className="inline-pay-pill-icon" />
                                            <span className="inline-pay-pill-text">Paying {selectedLoan?.customer?.name}</span>
                                            <button 
                                                type="button" 
                                                className="inline-pay-panel-close" 
                                                onClick={() => { setIsInlineOpen(false); resetInlineState(); }}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        <div className="inline-pay-details-content">
                                            <div className="inline-pay-info-box">
                                                <div className="inline-pay-info-name">{selectedLoan?.customer?.name}</div>
                                                <div className="inline-pay-info-os">O/S: ₹{Number(selectedLoan?.outstandingPrincipal || 0).toLocaleString('en-IN')}</div>
                                            </div>
                                            
                                            {error && <div className="inline-pay-error">{error}</div>}
                                            {successMsg && <div className="inline-pay-success">{successMsg}</div>}

                                            {!successMsg && (
                                                <>
                                                    <div className="inline-pay-form-group">
                                                        <label className="inline-pay-field-label">Amount</label>
                                                        <div className="inline-pay-input-wrapper">
                                                            <span className="inline-pay-field-currency">₹</span>
                                                            <input
                                                                type="number"
                                                                className="inline-pay-field-input"
                                                                placeholder="Enter amount"
                                                                value={amount}
                                                                onChange={(e) => setAmount(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') handleInlineSubmit();
                                                                }}
                                                                autoFocus
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="inline-pay-form-group">
                                                        <label className="inline-pay-field-label">Payment Type</label>
                                                        <div className="inline-pay-methods-row">
                                                            <button
                                                                type="button"
                                                                className={`inline-pay-method-btn ${paymentMethod === 'cash' ? 'active' : ''}`}
                                                                onClick={() => setPaymentMethod('cash')}
                                                            >
                                                                Cash
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={`inline-pay-method-btn ${paymentMethod === 'upi' ? 'active' : ''}`}
                                                                onClick={() => setPaymentMethod('upi')}
                                                            >
                                                                UPI
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={`inline-pay-method-btn ${paymentMethod === 'bank' ? 'active' : ''}`}
                                                                onClick={() => setPaymentMethod('bank')}
                                                            >
                                                                Bank
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="inline-pay-form-group">
                                                        <label className="inline-pay-field-label">Payment Date & Time</label>
                                                        <input
                                                            type="datetime-local"
                                                            className="inline-pay-datetime-input"
                                                            value={paymentDate}
                                                            onChange={(e) => setPaymentDate(e.target.value)}
                                                        />
                                                    </div>

                                                    <button
                                                        type="button"
                                                        className="inline-pay-submit-btn"
                                                        onClick={handleInlineSubmit}
                                                        disabled={submitting}
                                                        style={{ marginTop: 'var(--space-2)' }}
                                                    >
                                                        {submitting ? 'Recording...' : `Record Payment`}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

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
            <div className={`app-layout ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''} ${location.pathname === '/whatsapp' ? 'layout-no-scroll' : ''}`}>
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


        </div>
    );
}

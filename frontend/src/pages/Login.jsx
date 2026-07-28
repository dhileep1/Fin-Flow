import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { Wallet, KeyRound, Mail, ShieldCheck, ArrowLeft } from 'lucide-react';
import '../styles/login.css';

export default function Login() {
    const { login, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    // Mode: 'login' | 'forgot_options' | 'otp_request' | 'otp_verify' | 'superadmin_request'
    const [mode, setMode] = useState('login');

    // Form inputs
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [reason, setReason] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            await login({ email: email.trim(), password });
            navigate('/');
        } catch (err) {
            setError(err.message || 'Login failed');
        }
    };

    const handleRequestOtp = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setSubmitting(true);
        try {
            const res = await api.requestPasswordOtp({ email: email.trim() });
            setMessage(res.message + (res.devOtp ? ` (Dev OTP: ${res.devOtp})` : ''));
            setMode('otp_verify');
        } catch (err) {
            setError(err.message || 'Failed to request OTP');
        } finally {
            setSubmitting(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setSubmitting(true);
        try {
            const res = await api.verifyOtpAndReset({
                email: email.trim(),
                otp: otp.trim(),
                newPassword,
            });
            setMessage(res.message);
            setMode('login');
            setPassword('');
            setOtp('');
            setNewPassword('');
        } catch (err) {
            setError(err.message || 'Failed to verify OTP');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSuperAdminRequest = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setSubmitting(true);
        try {
            const res = await api.requestSuperAdminReset({
                email: email.trim(),
                reason,
            });
            setMessage(res.message);
            setMode('login');
        } catch (err) {
            setError(err.message || 'Failed to submit request');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-bg-pattern" />
            <div className="login-card">
                <div className="login-header">
                    <div className="login-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Wallet size={48} style={{ color: 'var(--brand-accent)' }} />
                    </div>
                    <h1 className="login-title">FinFlow</h1>
                    <p className="login-subtitle">Lending Management Platform</p>
                </div>

                {message && <div className="login-success" style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--accent-emerald)', color: '#10b981', fontSize: '0.875rem', marginBottom: '1rem', textAlign: 'center' }}>{message}</div>}
                {error && <div className="login-error">{error}</div>}

                {/* LOGIN FORM */}
                {mode === 'login' && (
                    <form onSubmit={handleLoginSubmit} className="login-form">
                        <div className="form-group">
                            <label className="form-label" htmlFor="email">Email or Phone</label>
                            <input
                                id="email"
                                className="form-input"
                                type="text"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="user@company.com or phone"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="password">Password</label>
                            <input
                                id="password"
                                className="form-input"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                                <button
                                    type="button"
                                    onClick={() => { setError(''); setMessage(''); setMode('forgot_options'); }}
                                    style={{ background: 'none', border: 'none', color: 'var(--brand-accent, #6366f1)', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
                                >
                                    Forgot Password?
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={authLoading}>
                            {authLoading ? <span className="loading-spinner" /> : 'Sign In'}
                        </button>
                    </form>
                )}

                {/* FORGOT PASSWORD OPTIONS */}
                {mode === 'forgot_options' && (
                    <div className="login-form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, textAlign: 'center' }}>Password Recovery</h2>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>Choose how you would like to reset your password:</p>

                        <button
                            type="button"
                            className="btn btn-secondary w-full"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem' }}
                            onClick={() => { setError(''); setMode('otp_request'); }}
                        >
                            <Mail size={18} />
                            Reset via Email / Phone OTP
                        </button>

                        <button
                            type="button"
                            className="btn btn-secondary w-full"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem' }}
                            onClick={() => { setError(''); setMode('superadmin_request'); }}
                        >
                            <ShieldCheck size={18} />
                            Request SuperAdmin Approval
                        </button>

                        <button
                            type="button"
                            onClick={() => { setError(''); setMode('login'); }}
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                        >
                            <ArrowLeft size={16} /> Back to Sign In
                        </button>
                    </div>
                )}

                {/* OTP REQUEST */}
                {mode === 'otp_request' && (
                    <form onSubmit={handleRequestOtp} className="login-form">
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, textAlign: 'center' }}>Send OTP</h2>
                        <div className="form-group">
                            <label className="form-label" htmlFor="reset-email">Email or Phone</label>
                            <input
                                id="reset-email"
                                className="form-input"
                                type="text"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter registered email or phone"
                                required
                            />
                        </div>
                        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={submitting}>
                            {submitting ? <span className="loading-spinner" /> : 'Send OTP Code'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('forgot_options')}
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                        >
                            <ArrowLeft size={16} /> Back
                        </button>
                    </form>
                )}

                {/* OTP VERIFY & RESET */}
                {mode === 'otp_verify' && (
                    <form onSubmit={handleVerifyOtp} className="login-form">
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, textAlign: 'center' }}>Enter OTP & Set Password</h2>
                        <div className="form-group">
                            <label className="form-label" htmlFor="otp-input">6-Digit OTP</label>
                            <input
                                id="otp-input"
                                className="form-input"
                                type="text"
                                maxLength={6}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                placeholder="123456"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="new-password">New Password</label>
                            <input
                                id="new-password"
                                className="form-input"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Minimum 8 characters"
                                required
                            />
                        </div>
                        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={submitting}>
                            {submitting ? <span className="loading-spinner" /> : 'Reset Password'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('otp_request')}
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                        >
                            <ArrowLeft size={16} /> Request New OTP
                        </button>
                    </form>
                )}

                {/* SUPERADMIN REQUEST */}
                {mode === 'superadmin_request' && (
                    <form onSubmit={handleSuperAdminRequest} className="login-form">
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, textAlign: 'center' }}>SuperAdmin Reset Request</h2>
                        <div className="form-group">
                            <label className="form-label" htmlFor="sa-email">Email or Phone</label>
                            <input
                                id="sa-email"
                                className="form-input"
                                type="text"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter registered email or phone"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="sa-reason">Reason / Notes</label>
                            <textarea
                                id="sa-reason"
                                className="form-input"
                                rows={2}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Optional details for SuperAdmin..."
                            />
                        </div>
                        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={submitting}>
                            {submitting ? <span className="loading-spinner" /> : 'Submit Reset Request'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('forgot_options')}
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                        >
                            <ArrowLeft size={16} /> Back
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

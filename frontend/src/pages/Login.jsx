import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Wallet } from 'lucide-react';
import '../styles/login.css';

export default function Login() {
    const { login, loading } = useAuth();
    const navigate = useNavigate();
    const [orgId, setOrgId] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await login(orgId, { email, password });
            navigate('/');
        } catch (err) {
            setError(err.message || 'Login failed');
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

                <form onSubmit={handleSubmit} className="login-form">
                    {error && <div className="login-error">{error}</div>}

                    <div className="form-group">
                        <label className="form-label" htmlFor="orgId">Organization ID</label>
                        <input
                            id="orgId"
                            className="form-input"
                            type="text"
                            value={orgId}
                            onChange={(e) => setOrgId(e.target.value)}
                            placeholder="Enter organization ID"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="email">Email</label>
                        <input
                            id="email"
                            className="form-input"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@company.com"
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
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
                        {loading ? <span className="loading-spinner" /> : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}

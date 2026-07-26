import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { superAdminApi } from '../../api/client';
import '../../styles/superAdmin.css';

/**
 * Super-Admin Login Page.
 * Separate from the tenant login — uses SuperAdminApiClient and stores
 * credentials under distinct localStorage keys.
 */
export default function SuperAdminLogin() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await superAdminApi.login(email, password);
            superAdminApi.setAuth(data.token);
            localStorage.setItem('superAdminUser', JSON.stringify(data.user));
            navigate('/super-admin');
        } catch (err) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="sa-login-page">
            <div className="sa-login-bg" />
            <div className="sa-login-card">
                <div className="sa-login-header">
                    <div className="sa-login-icon">
                        <Shield size={48} />
                    </div>
                    <h1 className="sa-login-title">FinFlow</h1>
                    <p className="sa-login-subtitle">Control Plane • Super-Admin</p>
                </div>

                <form onSubmit={handleSubmit} className="sa-login-form">
                    {error && <div className="sa-login-error">{error}</div>}

                    <div className="form-group">
                        <label className="form-label" htmlFor="sa-email">Email</label>
                        <input
                            id="sa-email"
                            className="form-input"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="superadmin@finflow.io"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="sa-password">Password</label>
                        <input
                            id="sa-password"
                            className="form-input"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button type="submit" className="sa-login-btn" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In to Control Plane'}
                    </button>
                </form>
            </div>
        </div>
    );
}

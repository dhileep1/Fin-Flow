import React, { useState, useEffect } from 'react';
import { Database, Radio, RefreshCw } from 'lucide-react';
import { superAdminApi } from '../../api/client';

/**
 * System Health page.
 * Displays real-time DB and Redis connection status.
 * Auto-refreshes every 30 seconds.
 */
export default function SystemHealth() {
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastRefresh, setLastRefresh] = useState(null);

    useEffect(() => {
        loadHealth();
        const interval = setInterval(loadHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadHealth = async () => {
        try {
            setLoading(true);
            const data = await superAdminApi.getSystemHealth();
            setHealth(data);
            setLastRefresh(new Date());
            setError('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const isHealthy = (status) => status === 'healthy';

    return (
        <div>
            <div className="sa-page-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h1 className="sa-page-title">System Health</h1>
                        <p className="sa-page-subtitle">
                            Infrastructure status monitoring
                            {lastRefresh && (
                                <span style={{ marginLeft: 'var(--space-3)' }}>
                                    · Last check: {lastRefresh.toLocaleTimeString()}
                                </span>
                            )}
                        </p>
                    </div>
                    <button className="sa-btn sa-btn-ghost" onClick={loadHealth} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'sa-spinner' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Overall status */}
            {health && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    marginBottom: 'var(--space-6)',
                    padding: 'var(--space-4) var(--space-5)',
                    background: 'var(--sa-card-bg)',
                    border: '1px solid var(--sa-card-border)',
                    borderRadius: 'var(--radius-lg)',
                }}>
                    <div
                        className={`sa-health-indicator ${health.status === 'healthy' ? 'healthy' : 'unhealthy'}`}
                    />
                    <span style={{ fontWeight: 600, color: '#ffffff', fontSize: 'var(--font-size-md)' }}>
                        Overall Status:
                    </span>
                    <span className={`sa-badge sa-badge-${health.status === 'healthy' ? 'healthy' : 'degraded'}`}>
                        {health.status}
                    </span>
                </div>
            )}

            {error && (
                <div style={{
                    padding: 'var(--space-4)',
                    color: '#f87171',
                    fontSize: 'var(--font-size-sm)',
                    marginBottom: 'var(--space-4)',
                }}>
                    {error}
                </div>
            )}

            {/* Service cards */}
            <div className="sa-health-grid">
                {/* Database */}
                <div className="sa-health-card">
                    <div className="sa-health-card-header">
                        <div className="sa-health-card-title">
                            <Database size={18} />
                            PostgreSQL Database
                        </div>
                        {health && (
                            <div className={`sa-health-indicator ${isHealthy(health.services?.database) ? 'healthy' : 'unhealthy'}`} />
                        )}
                    </div>
                    <div className="sa-health-detail">
                        {loading ? 'Checking...' : (
                            health ? (
                                <span className={`sa-badge sa-badge-${isHealthy(health.services?.database) ? 'healthy' : 'unhealthy'}`}>
                                    {health.services?.database}
                                </span>
                            ) : 'Unknown'
                        )}
                    </div>
                </div>

                {/* Redis */}
                <div className="sa-health-card">
                    <div className="sa-health-card-header">
                        <div className="sa-health-card-title">
                            <Radio size={18} />
                            Redis / BullMQ
                        </div>
                        {health && (
                            <div className={`sa-health-indicator ${isHealthy(health.services?.redis) ? 'healthy' : 'unhealthy'}`} />
                        )}
                    </div>
                    <div className="sa-health-detail">
                        {loading ? 'Checking...' : (
                            health ? (
                                <span className={`sa-badge sa-badge-${isHealthy(health.services?.redis) ? 'healthy' : 'unhealthy'}`}>
                                    {health.services?.redis}
                                </span>
                            ) : 'Unknown'
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

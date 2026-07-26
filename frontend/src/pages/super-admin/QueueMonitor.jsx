import React, { useState, useEffect } from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { superAdminApi } from '../../api/client';

/**
 * Queue Monitor page.
 * Displays BullMQ job counts and allows retrying failed jobs.
 * Auto-refreshes every 15 seconds.
 */
export default function QueueMonitor() {
    const [queueData, setQueueData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [retrying, setRetrying] = useState(false);
    const [retryResult, setRetryResult] = useState(null);
    const [error, setError] = useState('');
    const [lastRefresh, setLastRefresh] = useState(null);

    useEffect(() => {
        loadQueueStats();
        const interval = setInterval(loadQueueStats, 15000);
        return () => clearInterval(interval);
    }, []);

    const loadQueueStats = async () => {
        try {
            setLoading(true);
            const data = await superAdminApi.getQueueStats();
            setQueueData(data);
            setLastRefresh(new Date());
            setError('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRetry = async () => {
        setRetrying(true);
        setRetryResult(null);
        try {
            const result = await superAdminApi.retryFailedJobs();
            setRetryResult(result);
            // Refresh stats after retry
            setTimeout(loadQueueStats, 1000);
        } catch (err) {
            setRetryResult({ error: err.message });
        } finally {
            setRetrying(false);
        }
    };

    const statItems = queueData?.counts ? [
        { label: 'Active', value: queueData.counts.active || 0, colorClass: 'active' },
        { label: 'Waiting', value: queueData.counts.waiting || 0, colorClass: 'waiting' },
        { label: 'Completed', value: queueData.counts.completed || 0, colorClass: 'completed' },
        { label: 'Failed', value: queueData.counts.failed || 0, colorClass: 'failed' },
        { label: 'Delayed', value: queueData.counts.delayed || 0, colorClass: '' },
        { label: 'Paused', value: queueData.counts.paused || 0, colorClass: '' },
    ] : [];

    return (
        <div>
            <div className="sa-page-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h1 className="sa-page-title">Queue Monitor</h1>
                        <p className="sa-page-subtitle">
                            BullMQ job queue status for <strong style={{ color: 'var(--sa-accent)' }}>finflow-jobs</strong>
                            {lastRefresh && (
                                <span style={{ marginLeft: 'var(--space-3)' }}>
                                    · Updated: {lastRefresh.toLocaleTimeString()}
                                </span>
                            )}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <button className="sa-btn sa-btn-ghost" onClick={loadQueueStats} disabled={loading}>
                            <RefreshCw size={16} />
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {error && (
                <div style={{
                    padding: 'var(--space-4) var(--space-5)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: 'var(--radius-md)',
                    color: '#fca5a5',
                    fontSize: 'var(--font-size-sm)',
                    marginBottom: 'var(--space-6)',
                }}>
                    {error}
                </div>
            )}

            {queueData?.error && (
                <div style={{
                    padding: 'var(--space-4) var(--space-5)',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    borderRadius: 'var(--radius-md)',
                    color: '#fbbf24',
                    fontSize: 'var(--font-size-sm)',
                    marginBottom: 'var(--space-6)',
                }}>
                    ⚠️ {queueData.error}
                </div>
            )}

            {/* Job count cards */}
            {statItems.length > 0 && (
                <div className="sa-queue-grid">
                    {statItems.map((item) => (
                        <div key={item.label} className="sa-queue-stat">
                            <div className="sa-queue-stat-label">{item.label}</div>
                            <div className={`sa-queue-stat-value ${item.colorClass}`}>
                                {item.value.toLocaleString()}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Retry failed jobs */}
            <div style={{
                background: 'var(--sa-card-bg)',
                border: '1px solid var(--sa-card-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-6)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontWeight: 600, color: '#ffffff', marginBottom: 'var(--space-1)' }}>
                            Failed Job Recovery
                        </div>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--sa-text-muted)' }}>
                            Retry all failed jobs in the queue. Jobs that have reached max retries may not be retryable.
                        </div>
                    </div>
                    <button
                        className="sa-btn sa-btn-danger"
                        onClick={handleRetry}
                        disabled={retrying || (queueData?.counts?.failed || 0) === 0}
                    >
                        <RotateCcw size={14} />
                        {retrying ? 'Retrying...' : `Retry Failed (${queueData?.counts?.failed || 0})`}
                    </button>
                </div>

                {retryResult && (
                    <div style={{
                        marginTop: 'var(--space-4)',
                        padding: 'var(--space-3) var(--space-4)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-sm)',
                        background: retryResult.error
                            ? 'rgba(239, 68, 68, 0.1)'
                            : 'rgba(16, 185, 129, 0.1)',
                        color: retryResult.error ? '#fca5a5' : '#34d399',
                        border: retryResult.error
                            ? '1px solid rgba(239, 68, 68, 0.2)'
                            : '1px solid rgba(16, 185, 129, 0.2)',
                    }}>
                        {retryResult.error || retryResult.message}
                    </div>
                )}
            </div>
        </div>
    );
}

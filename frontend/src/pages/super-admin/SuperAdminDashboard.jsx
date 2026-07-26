import React, { useState, useEffect } from 'react';
import { Building2, FileText, IndianRupee, MessageCircle } from 'lucide-react';
import { superAdminApi } from '../../api/client';

/**
 * Super-Admin Dashboard.
 * Displays global platform KPIs: Total Orgs, Active Loans,
 * Outstanding Balance, WhatsApp Messages Sent.
 */
export default function SuperAdminDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            setLoading(true);
            const data = await superAdminApi.getDashboardStats();
            setStats(data);
        } catch (err) {
            setError(err.message || 'Failed to load stats');
        } finally {
            setLoading(false);
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
                Loading dashboard...
            </div>
        );
    }

    if (error) {
        return (
            <div className="sa-loading" style={{ color: '#f87171' }}>
                {error}
            </div>
        );
    }

    const kpis = [
        {
            label: 'Total Organizations',
            value: stats?.totalOrgs || 0,
            icon: Building2,
            color: 'indigo',
        },
        {
            label: 'Active Loans (Platform)',
            value: stats?.totalActiveLoans || 0,
            icon: FileText,
            color: 'green',
        },
        {
            label: 'Outstanding Balance',
            value: formatCurrency(stats?.totalOutstanding),
            icon: IndianRupee,
            color: 'amber',
        },
        {
            label: 'WhatsApp Messages Sent',
            value: stats?.totalWhatsappSent || 0,
            icon: MessageCircle,
            color: 'cyan',
        },
    ];

    return (
        <div>
            <div className="sa-page-header">
                <h1 className="sa-page-title">Platform Dashboard</h1>
                <p className="sa-page-subtitle">Global overview of the FinFlow platform</p>
            </div>

            <div className="sa-kpi-grid">
                {kpis.map((kpi, i) => {
                    const Icon = kpi.icon;
                    return (
                        <div key={i} className="sa-kpi-card">
                            <div className={`sa-kpi-icon ${kpi.color}`}>
                                <Icon size={20} />
                            </div>
                            <div className="sa-kpi-label">{kpi.label}</div>
                            <div className="sa-kpi-value">{kpi.value}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

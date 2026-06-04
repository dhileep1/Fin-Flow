import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { 
    ChevronLeft, 
    Calendar, 
    Clock, 
    CheckCircle2, 
    AlertCircle, 
    User, 
    Phone, 
    MapPin, 
    Car, 
    Bike,
    FileText,
    ArrowRight
} from 'lucide-react';

const formatCurrency = (amount) =>
    `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
    });
};

const getStatusBadge = (status) => {
    if (!status) return 'badge-neutral';
    switch (status.toLowerCase()) {
        case 'active': return 'badge-success';
        case 'closed': 
        case 'completed': 
        case 'settled': return 'badge-neutral';
        case 'defaulter': return 'badge-defaulter';
        default: return 'badge-neutral';
    }
};

export default function CustomerLoans() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [customer, setCustomer] = useState(null);
    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        console.log('CustomerLoans mounting for ID:', id);
        const loadData = async () => {
            try {
                setLoading(true);
                const [custData, loansData] = await Promise.all([
                    api.getCustomer(id),
                    api.getLoans(`customerId=${id}`)
                ]);
                setCustomer(custData);
                setLoans(loansData.loans || []);
            } catch (err) {
                console.error('Failed to load customer loans:', err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [id]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <span className="loading-spinner" />
                <p className="text-slate-500 mt-4">Loading loan history...</p>
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="card text-center py-12">
                <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
                <h2 className="text-xl font-bold text-slate-800">Customer not found</h2>
                <button className="btn btn-primary mt-6" onClick={() => navigate('/customers')}>
                    Back to Customers
                </button>
            </div>
        );
    }

    return (
        <div className="animate-fade-in" style={{ maxWidth: 1200 }}>
            {/* Header / Breadcrumb */}
            <div className="mb-6">
                <button 
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-4"
                    onClick={() => navigate('/customers')}
                >
                    <ChevronLeft size={16} /> Back to Customers
                </button>
                
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="page-title mb-1">Loan History</h1>
                        <div className="flex items-center gap-4 text-slate-600">
                            <span className="flex items-center gap-1.5 font-semibold text-slate-900">
                                <User size={16} className="text-slate-400" /> {customer.name}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Phone size={14} className="text-slate-400" /> {customer.phone}
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex gap-3">
                        <div className="badge badge-neutral px-4 py-2 text-xs">
                            Total Loans: {loans.length}
                        </div>
                        <div className="badge badge-success px-4 py-2 text-xs">
                            Active: {loans.filter(l => l.status === 'active').length}
                        </div>
                    </div>
                </div>
            </div>

            {/* Loans Table */}
            <div className="table-container shadow-sm border border-slate-200">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-4 text-left">Loan Details</th>
                            <th className="px-6 py-4 text-left">Vehicle</th>
                            <th className="px-6 py-4 text-right">Principal</th>
                            <th className="px-6 py-4 text-center">Dates</th>
                            <th className="px-6 py-4 text-center">Status</th>
                            <th className="px-6 py-4 text-right">Outstanding</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loans.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                    <FileText size={32} className="mx-auto mb-3 opacity-20" />
                                    No loans found for this customer.
                                </td>
                            </tr>
                        ) : (
                            loans.map((loan) => {
                                const startDate = new Date(loan.startDate);
                                const endDate = new Date(startDate);
                                endDate.setMonth(endDate.getMonth() + loan.tenureMonths);
                                
                                const isClosed = ['closed', 'completed', 'settled'].includes((loan.status || '').toLowerCase());
                                // We'll use updatedAt as a proxy for closed date if status is closed
                                const closedDate = isClosed ? (loan.updatedAt || loan.createdAt) : null;

                                return (
                                    <tr 
                                        key={loan.id} 
                                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                                        onClick={() => navigate(`/loans/${loan.id}`)}
                                    >
                                        <td className="px-6 py-4 text-left">
                                            <div className="font-bold text-slate-900">#{loan.loanId || loan.id.slice(0, 8)}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">
                                                {loan.tenureMonths || 0} Months • {formatCurrency(loan.monthlyDueAmount)} EMI
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-1 flex gap-2">
                                                <span>Int: {Number((loan.monthlyInterestRate || 0) * 100).toFixed(1)}%</span>
                                                <span>Fee: {formatCurrency(loan.documentFee)}</span>
                                                <span>Disbursed: {formatCurrency(loan.disbursedAmount)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-left">
                                            <div className="flex items-center gap-2 font-semibold text-slate-900">
                                                {loan.vehicle?.type === 'bike' ? <Bike size={14} className="text-slate-400" /> : <Car size={14} className="text-slate-400" />}
                                                {loan.vehicle?.model}
                                            </div>
                                            <div className="text-[11px] font-mono text-slate-500 mt-0.5">{loan.vehicle?.vehicleNumber}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-semibold text-slate-900">
                                            {formatCurrency(loan.principalAmount)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                                    <Calendar size={12} className="text-slate-400" />
                                                    <span>{formatDate(loan.startDate)}</span>
                                                    <ArrowRight size={10} className="text-slate-300" />
                                                    <span>{formatDate(endDate)}</span>
                                                </div>
                                                {isClosed && (
                                                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full mt-1">
                                                        <CheckCircle2 size={10} />
                                                        Closed on {formatDate(closedDate)}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`badge ${getStatusBadge(loan.status)}`}>
                                                {loan.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="font-bold text-slate-900">{formatCurrency(loan.totalOutstanding || 0)}</div>
                                            <div className="text-[10px] text-slate-500 mt-0.5">
                                                {loan.paidDues} / {loan.totalDues} Paid
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="btn btn-sm btn-action-outline">
                                                View Details
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Quick Summary Cards */}
            {loans.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                    <div className="card bg-white p-5 border-l-4 border-emerald-500 shadow-sm">
                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Total Principal Borrowed</div>
                        <div className="text-2xl font-bold text-slate-900">
                            {formatCurrency(loans.reduce((sum, l) => sum + Number(l.principalAmount), 0))}
                        </div>
                    </div>
                    <div className="card bg-white p-5 border-l-4 border-amber-500 shadow-sm">
                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Active Outstanding</div>
                        <div className="text-2xl font-bold text-slate-900 text-amber-600">
                            {formatCurrency(loans.reduce((sum, l) => sum + Number(l.totalOutstanding || 0), 0))}
                        </div>
                    </div>
                    <div className="card bg-white p-5 border-l-4 border-slate-800 shadow-sm">
                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Customer Since</div>
                        <div className="text-2xl font-bold text-slate-900">
                            {formatDate(customer.createdAt)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CallPanel from './pages/CallPanel';
import LoanDetail from './pages/LoanDetail';
import NewLoan from './pages/NewLoan';
import Loans from './pages/Loans';
import WhatsAppPanel from './pages/WhatsAppPanel';
import Customers from './pages/Customers';
import Reports from './pages/Reports';
import AdminConfig from './pages/AdminConfig';
import CustomerLoans from './pages/CustomerLoans';
import Collections from './pages/Collections';
import VehicleInventory from './pages/VehicleInventory';
import VehicleDetail from './pages/VehicleDetail';

// Super-Admin imports
import SuperAdminLogin from './pages/super-admin/SuperAdminLogin';
import SuperAdminLayout from './components/super-admin/SuperAdminLayout';
import SuperAdminDashboard from './pages/super-admin/SuperAdminDashboard';
import TenantManager from './pages/super-admin/TenantManager';
import SystemHealth from './pages/super-admin/SystemHealth';
import QueueMonitor from './pages/super-admin/QueueMonitor';

function ProtectedRoute({ children }) {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return children;
}

function RoleProtectedRoute({ children, allowedRoles }) {
    const { user, isAuthenticated } = useAuth();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (allowedRoles && !allowedRoles.includes(user?.role)) {
        return <Navigate to="/" replace />;
    }
    return children;
}

function AppRoutes() {
    return (
        <Routes>
            {/* ═══ Tenant Routes ═══ */}
            <Route path="/login" element={<Login />} />
            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<Dashboard />} />
                <Route path="transactions" element={<Collections />} />
                <Route path="customers/:id/loans" element={<CustomerLoans />} />
                <Route path="calls" element={<CallPanel />} />
                <Route path="loans" element={<Loans />} />
                <Route 
                    path="loans/new" 
                    element={
                        <RoleProtectedRoute allowedRoles={['admin', 'accountant']}>
                            <NewLoan />
                        </RoleProtectedRoute>
                    } 
                />
                <Route path="loans/:id" element={<LoanDetail />} />
                <Route path="whatsapp" element={<WhatsAppPanel />} />
                <Route path="vehicles" element={<VehicleInventory />} />
                <Route path="vehicles/:id" element={<VehicleDetail />} />
                <Route path="customers" element={<Customers />} />
                <Route path="reports" element={<Reports />} />
                <Route 
                    path="admin" 
                    element={
                        <RoleProtectedRoute allowedRoles={['admin']}>
                            <AdminConfig />
                        </RoleProtectedRoute>
                    } 
                />
            </Route>

            {/* ═══ Super-Admin Routes ═══ */}
            <Route path="/super-admin/login" element={<SuperAdminLogin />} />
            <Route path="/super-admin" element={<SuperAdminLayout />}>
                <Route index element={<SuperAdminDashboard />} />
                <Route path="tenants" element={<TenantManager />} />
                <Route path="system-health" element={<SystemHealth />} />
                <Route path="queue-monitor" element={<QueueMonitor />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </AuthProvider>
    );
}

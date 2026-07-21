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

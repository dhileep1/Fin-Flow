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

function ProtectedRoute({ children }) {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
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
                <Route path="customers/:id/loans" element={<CustomerLoans />} />
                <Route path="calls" element={<CallPanel />} />
                <Route path="loans" element={<Loans />} />
                <Route path="loans/new" element={<NewLoan />} />
                <Route path="loans/:id" element={<LoanDetail />} />
                <Route path="whatsapp" element={<WhatsAppPanel />} />
                <Route path="customers" element={<Customers />} />
                <Route path="reports" element={<Reports />} />
                <Route path="admin" element={<AdminConfig />} />
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

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const stored = localStorage.getItem('lendEasyUser');
        return stored ? JSON.parse(stored) : null;
    });
    const [loading, setLoading] = useState(false);

    const login = async (orgId, credentials) => {
        setLoading(true);
        try {
            const data = await api.login(orgId, credentials);
            api.setAuth(data.token, data.user.orgId);
            localStorage.setItem('lendEasyUser', JSON.stringify(data.user));
            setUser(data.user);
            return data;
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        api.clearAuth();
        setUser(null);
    };

    const isAuthenticated = !!user && !!api.token;

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, isAuthenticated }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

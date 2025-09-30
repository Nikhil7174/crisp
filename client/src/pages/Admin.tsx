import React, { useState, useEffect } from 'react';
import { AdminLogin } from '../components/admin/AdminLogin';
import { AdminDashboard } from '../components/admin/AdminDashboard';

export const Admin: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const API_BASE_URL = 'http://localhost:3001/api';

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (token) {
            // Verify token is still valid
            fetch(`${API_BASE_URL}/admin/dashboard`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            })
                .then(response => {
                    if (response.ok) {
                        setIsAuthenticated(true);
                    } else {
                        localStorage.removeItem('adminToken');
                    }
                })
                .catch(() => {
                    localStorage.removeItem('adminToken');
                })
                .finally(() => {
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, []);

    const handleLogin = (_token: string) => {
        setIsAuthenticated(true);
    };

    if (loading) {
        return <div>Loading...</div>;
    }

    return isAuthenticated ? (
        <AdminDashboard />
    ) : (
        <AdminLogin onLogin={handleLogin} />
    );
};

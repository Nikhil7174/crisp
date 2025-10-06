import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Spin } from 'antd';
import { AdminLogin } from '../components/admin/AdminLogin';
import { AdminLayout } from '../components/admin/AdminLayout';
import { InterviewLinks } from './admin/InterviewLinks';
import { InterviewResults } from './admin/InterviewResults';
import { LinkCandidates } from './admin/LinkCandidates';
import { InterviewDetails } from './InterviewDetails';
import { API_BASE_URL } from '../constants/api';

export const Admin: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (token) {
            // Verify token is still valid and get user info
            fetch(`${API_BASE_URL}/admin/dashboard`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            })
                .then(response => {
                    if (response.ok) {
                        setIsAuthenticated(true);
                        // Try to get user info from token
                        const storedUser = localStorage.getItem('adminUser');
                        if (storedUser) {
                            setUser(JSON.parse(storedUser));
                        }
                    } else {
                        localStorage.removeItem('adminToken');
                        localStorage.removeItem('adminUser');
                    }
                })
                .catch(() => {
                    localStorage.removeItem('adminToken');
                    localStorage.removeItem('adminUser');
                })
                .finally(() => {
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, []);

    const handleLogin = (token: string, userData?: any) => {
        setIsAuthenticated(true);
        if (userData) {
            setUser(userData);
            localStorage.setItem('adminUser', JSON.stringify(userData));
        }
        // Navigate to links page by default
        navigate('/admin/links');
    };

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        setIsAuthenticated(false);
        setUser(null);
        // Redirect to home page after logout
        window.location.href = '/';
    };

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh'
            }}>
                <Spin size="large" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <AdminLogin onLogin={handleLogin} />;
    }

    return (
        <AdminLayout user={user} onLogout={handleLogout}>
            <Routes>
                <Route path="/" element={<Navigate to="/admin/links" replace />} />
                <Route path="/links" element={<InterviewLinks />} />
                <Route path="/dashboard" element={<InterviewResults />} />
                <Route path="/link-results/:linkId" element={<LinkCandidates />} />
                <Route path="/interview/:id" element={<InterviewDetails />} />
            </Routes>
        </AdminLayout>
    );
};

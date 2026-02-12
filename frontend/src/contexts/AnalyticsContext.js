import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const AnalyticsContext = createContext();

export const useAnalytics = () => {
    const context = useContext(AnalyticsContext);
    if (!context) {
        throw new Error('useAnalytics must be used within AnalyticsProvider');
    }
    return context;
};

// Available chart types that can be dynamically added
const CHART_TEMPLATES = {
    'revenue-trend': {
        id: 'revenue-trend',
        type: 'line',
        title: 'Revenue Trend',
        dataKey: 'revenue',
        color: '#8b5cf6'
    },
    'bookings-trend': {
        id: 'bookings-trend',
        type: 'line',
        title: 'Bookings Trend',
        dataKey: 'bookings',
        color: '#ec4899'
    },
    'outlet-performance': {
        id: 'outlet-performance',
        type: 'bar',
        title: 'Outlet Performance',
        dataKey: 'outlet',
        color: '#3b82f6'
    },
    'service-breakdown': {
        id: 'service-breakdown',
        type: 'radar',
        title: 'Service Breakdown',
        dataKey: 'services',
        color: '#10b981'
    }
};

export const AnalyticsProvider = ({ children }) => {
    // Dynamic widgets added from chat
    const [dynamicWidgets, setDynamicWidgets] = useState([]);

    // Real data from API
    const [analyticsData, setAnalyticsData] = useState({
        reports: null,
        bookings: [],
        transactions: [],
        outlets: [],
        services: [],
        loading: true
    });

    // Fetch real data on mount
    const fetchAnalyticsData = useCallback(async () => {
        try {
            const [reportsRes, bookingsRes, transactionsRes, outletsRes, servicesRes] = await Promise.all([
                api.getReports().catch(() => ({ data: null })),
                api.getBookings().catch(() => ({ data: [] })),
                api.getTransactions().catch(() => ({ data: [] })),
                api.getOutlets().catch(() => ({ data: [] })),
                api.getServices().catch(() => ({ data: [] }))
            ]);

            setAnalyticsData({
                reports: reportsRes.data,
                bookings: bookingsRes.data || [],
                transactions: transactionsRes.data || [],
                outlets: outletsRes.data || [],
                services: servicesRes.data || [],
                loading: false
            });
        } catch (error) {
            console.error('Failed to fetch analytics data:', error);
            setAnalyticsData(prev => ({ ...prev, loading: false }));
        }
    }, []);

    useEffect(() => {
        fetchAnalyticsData();
    }, [fetchAnalyticsData]);

    // Add a dynamic widget from chat suggestion
    const addWidget = useCallback((chartType, customTitle) => {
        const template = CHART_TEMPLATES[chartType];
        if (!template) {
            console.warn(`Unknown chart type: ${chartType}`);
            return false;
        }

        const newWidget = {
            ...template,
            id: `${template.id}-${Date.now()}`,
            title: customTitle || template.title,
            addedAt: new Date().toISOString()
        };

        setDynamicWidgets(prev => [...prev, newWidget]);
        return true;
    }, []);

    // Remove a dynamic widget
    const removeWidget = useCallback((widgetId) => {
        setDynamicWidgets(prev => prev.filter(w => w.id !== widgetId));
    }, []);

    // Update a widget's chart type
    const updateWidgetType = useCallback((widgetId, newType) => {
        setDynamicWidgets(prev => prev.map(w =>
            w.id === widgetId ? { ...w, chartType: newType, type: newType } : w
        ));
    }, []);

    // Process bookings into monthly trend data
    const getMonthlyTrends = useCallback(() => {
        const monthlyData = {};
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Initialize months
        months.forEach((month, idx) => {
            monthlyData[idx] = { name: month, revenue: 0, bookings: 0 };
        });

        // Aggregate bookings
        analyticsData.bookings.forEach(booking => {
            const date = new Date(booking.date || booking.created_at);
            const month = date.getMonth();
            monthlyData[month].bookings += 1;
            monthlyData[month].revenue += parseFloat(booking.total_price || booking.amount || 0);
        });

        // Aggregate transactions
        analyticsData.transactions.forEach(tx => {
            const date = new Date(tx.date || tx.created_at);
            const month = date.getMonth();
            monthlyData[month].revenue += parseFloat(tx.amount || 0);
        });

        return Object.values(monthlyData);
    }, [analyticsData.bookings, analyticsData.transactions]);

    // Get outlet performance data
    const getOutletPerformance = useCallback(() => {
        return analyticsData.outlets.map(outlet => ({
            name: outlet.name?.substring(0, 15) || 'Outlet',
            value: analyticsData.bookings.filter(b => b.outlet_id === outlet.id).length
        }));
    }, [analyticsData.outlets, analyticsData.bookings]);

    // Get service breakdown data
    const getServiceBreakdown = useCallback(() => {
        return analyticsData.services.map(service => ({
            subject: service.name?.substring(0, 12) || 'Service',
            A: analyticsData.bookings.filter(b => b.service_id === service.id).length,
            B: Math.floor(Math.random() * 50) + 10, // Comparison data
            fullMark: 100
        }));
    }, [analyticsData.services, analyticsData.bookings]);

    const value = {
        dynamicWidgets,
        addWidget,
        removeWidget,
        updateWidgetType,
        analyticsData,
        getMonthlyTrends,
        getOutletPerformance,
        getServiceBreakdown,
        chartTemplates: CHART_TEMPLATES,
        refreshData: fetchAnalyticsData
    };

    return (
        <AnalyticsContext.Provider value={value}>
            {children}
        </AnalyticsContext.Provider>
    );
};

export default AnalyticsContext;

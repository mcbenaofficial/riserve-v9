
import React from 'react';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area, BarChart, Bar
} from 'recharts';
import { motion } from 'framer-motion';

// --- Customized Dot for Neon Effect ---
const CustomizedDot = (props) => {
    const { cx, cy, stroke } = props;
    return (
        <svg x={cx - 6} y={cy - 6} width={12} height={12}>
            <circle cx="6" cy="6" r="4" fill="#12161C" stroke={stroke} strokeWidth={2} />
            <circle cx="6" cy="6" r="2" fill={stroke} />
        </svg>
    );
};

// --- Default Mock Data (fallback) ---
const defaultRadarData = [
    { subject: 'Gen Z', A: 120, B: 110, fullMark: 150 },
    { subject: 'Millennials', A: 98, B: 130, fullMark: 150 },
    { subject: 'Gen X', A: 86, B: 130, fullMark: 150 },
    { subject: 'Boomers', A: 99, B: 100, fullMark: 150 },
    { subject: 'Alpha', A: 85, B: 90, fullMark: 150 },
    { subject: 'Late Gen Z', A: 65, B: 85, fullMark: 150 },
];

const defaultLineData = [
    { name: 'Jan', revenue: 4000, bookings: 2400 },
    { name: 'Feb', revenue: 3000, bookings: 1398 },
    { name: 'Mar', revenue: 2000, bookings: 9800 },
    { name: 'Apr', revenue: 2780, bookings: 3908 },
    { name: 'May', revenue: 1890, bookings: 4800 },
    { name: 'Jun', revenue: 2390, bookings: 3800 },
    { name: 'Jul', revenue: 3490, bookings: 4300 },
];

const defaultHeatmapData = [
    { name: 'California', value: 400 },
    { name: 'New York', value: 300 },
    { name: 'Texas', value: 300 },
    { name: 'Florida', value: 200 },
    { name: 'Illinois', value: 150 },
];

// --- Components ---

export const DemographicsRadar = ({ data }) => {
    const chartData = data && data.length > 0 ? data : defaultRadarData;

    return (
        <div className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart outerRadius="70%" data={chartData}>
                    <PolarGrid stroke="#374151" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                    <Radar
                        name="Platform A"
                        dataKey="A"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        fill="#8b5cf6"
                        fillOpacity={0.3}
                    />
                    <Radar
                        name="Platform B"
                        dataKey="B"
                        stroke="#ec4899"
                        strokeWidth={2}
                        fill="#ec4899"
                        fillOpacity={0.3}
                    />
                    <Legend wrapperStyle={{ color: '#E5E7EB' }} />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '0.5rem', color: '#F3F4F6' }}
                        itemStyle={{ color: '#E5E7EB' }}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
};

export const TrendLineChart = ({ data }) => {
    const chartData = data && data.length > 0 ? data : defaultLineData;

    return (
        <div className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '0.5rem', color: '#F3F4F6' }}
                    />
                    <Legend iconType="circle" />
                    <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" dot={<CustomizedDot stroke="#8b5cf6" />} />
                    <Area type="monotone" dataKey="bookings" stroke="#ec4899" strokeWidth={3} fillOpacity={1} fill="url(#colorBookings)" dot={<CustomizedDot stroke="#ec4899" />} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export const AudienceHeatmap = ({ data }) => {
    const chartData = data && data.length > 0 ? data : defaultHeatmapData;

    return (
        <div className="h-full w-full flex items-center justify-center text-gray-400">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 40, bottom: 0 }}
                >
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" stroke="#9CA3AF" width={80} />
                    <Tooltip
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '0.5rem', color: '#F3F4F6' }}
                    />
                    <Area dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

// Dynamic Chart Component for AI-added widgets
export const DynamicChart = ({ type, dataKey, color, data }) => {
    const chartColor = color || '#8b5cf6';

    if (type === 'line') {
        return (
            <div className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id={`color-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                        <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '0.5rem', color: '#F3F4F6' }} />
                        <Area type="monotone" dataKey={dataKey} stroke={chartColor} strokeWidth={3} fillOpacity={1} fill={`url(#color-${dataKey})`} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        );
    }

    if (type === 'bar') {
        return (
            <div className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 60, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                        <XAxis type="number" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis dataKey="name" type="category" stroke="#9CA3AF" fontSize={12} width={80} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '0.5rem', color: '#F3F4F6' }} />
                        <Bar dataKey="value" fill={chartColor} radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    }

    if (type === 'radar') {
        return (
            <div className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart outerRadius="70%" data={data}>
                        <PolarGrid stroke="#374151" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar name="Value" dataKey="A" stroke={chartColor} strokeWidth={2} fill={chartColor} fillOpacity={0.3} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '0.5rem', color: '#F3F4F6' }} />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
        );
    }

    // Default: Area chart
    return <TrendLineChart data={data} />;
};

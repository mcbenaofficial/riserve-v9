import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Clock, Calendar, MoreVertical, X, Check, Pencil, Trash2, ShoppingCart, FileText, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

const SlotTimelineView = ({
    config,
    outlet,
    onViewBooking,
    onEditBooking,
    onDeleteBooking,
    onAddBooking,
    onRescheduleBooking,
    onInventoryClick,
    onInvoiceClick,
    bookings: externalBookings = null,
    selectedDate: externalDate = null,
    onDateChange = null,
    hideHeader = false
}) => {
    const [internalDate, setInternalDate] = useState(new Date());
    const [internalBookings, setInternalBookings] = useState([]);
    const [loading, setLoading] = useState(!externalBookings);
    const containerRef = useRef(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [viewMode, setViewMode] = useState('day'); // 'day', 'week', 'month'

    // Drag & Drop State
    const [draggedBooking, setDraggedBooking] = useState(null);
    const [dragOverInfo, setDragOverInfo] = useState(null);

    const date = externalDate || internalDate;
    const bookings = externalBookings || internalBookings;

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!externalBookings) {
            fetchBookings();
        }
    }, [date, outlet.id, externalBookings, viewMode]);

    const getViewRange = () => {
        const start = new Date(date);
        const end = new Date(date);
        if (viewMode === 'week') {
            const day = start.getDay();
            start.setDate(start.getDate() - day);
            end.setDate(start.getDate() + 6);
        } else if (viewMode === 'month') {
            start.setDate(1);
            end.setMonth(end.getMonth() + 1);
            end.setDate(0);
        }
        return { start, end };
    };

    const fetchBookings = async () => {
        setLoading(true);
        try {
            if (viewMode === 'day') {
                const dateStr = date.toISOString().split('T')[0];
                const res = await api.getResourceBookings(outlet.id, dateStr);
                setInternalBookings(res.data || []);
            } else {
                const { start, end } = getViewRange();
                const res = await api.getResourceBookings(outlet.id, null,
                    start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
                setInternalBookings(res.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch bookings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDateChange = (newDate) => {
        if (onDateChange) onDateChange(newDate);
        else setInternalDate(newDate);
    };

    // --- Columns ---
    const generateColumns = () => {
        if (viewMode === 'day') {
            const [startHour] = config.operating_hours_start.split(':').map(Number);
            const [endHour] = config.operating_hours_end.split(':').map(Number);
            const cols = [];
            for (let i = startHour; i <= endHour; i++) {
                cols.push({ id: i, label: i === 12 ? '12 PM' : i > 12 ? `${i - 12} PM` : `${i} AM`, type: 'hour' });
            }
            return cols;
        }
        const { start, end } = getViewRange();
        const cols = [];
        const current = new Date(start);
        while (current <= end) {
            cols.push({
                id: current.toISOString().split('T')[0],
                label: current.toLocaleDateString('en-US', {
                    weekday: viewMode === 'week' ? 'short' : undefined,
                    day: 'numeric',
                    month: viewMode === 'month' ? 'short' : undefined
                }),
                date: new Date(current),
                type: 'day'
            });
            current.setDate(current.getDate() + 1);
        }
        return cols;
    };

    const columns = generateColumns();
    const columnWidth = viewMode === 'day' ? 140 : viewMode === 'week' ? 200 : 100;
    const totalWidth = columns.length * columnWidth;
    const startHour = viewMode === 'day' ? columns[0]?.id || 8 : 0;
    const endHour = viewMode === 'day' ? columns[columns.length - 1]?.id || 20 : 0;

    // --- Resources ---
    const resources = outlet.resources?.filter(r => r.active !== false) ||
        Array.from({ length: outlet.capacity || 2 }, (_, i) => ({
            id: `resource-${i + 1}`,
            name: `${outlet.resource_label || 'Resource'} ${i + 1}`
        }));

    const resourceIds = new Set(resources.map(r => r.id));

    // Separate bookings: assigned to a known resource vs unassigned
    const assignedBookings = bookings.filter(b => b.resource_id && resourceIds.has(b.resource_id));
    const unassignedBookings = bookings.filter(b => !b.resource_id || !resourceIds.has(b.resource_id));

    // --- Booking style ---
    const getBookingStyle = (booking) => {
        if (viewMode === 'day') {
            if (!booking.time) return { display: 'none' };
            const [h, m] = booking.time.split(':').map(Number);
            const bookingStartMinutes = (h - startHour) * 60 + m;

            let duration = booking.duration || booking.duration_minutes;
            if (!duration) {
                if (booking.service_id && outlet.services) {
                    const service = outlet.services.find(s => s.id === booking.service_id);
                    if (service) duration = service.duration_min;
                }
                if (!duration) duration = 60;
            }
            const pixelsPerMinute = columnWidth / 60;
            const left = bookingStartMinutes * pixelsPerMinute;
            const width = duration * pixelsPerMinute;
            return { left: `${left}px`, width: `${Math.max(width, 80)}px` };
        } else {
            const bookingDate = booking.date?.split('T')[0];
            const colIndex = columns.findIndex(c => c.id === bookingDate);
            if (colIndex === -1) return { display: 'none' };
            return { left: `${colIndex * columnWidth + 4}px`, width: `${columnWidth - 8}px` };
        }
    };

    // --- Current time indicator ---
    const getCurrentTimePosition = () => {
        if (viewMode !== 'day') return null;
        const now = currentTime;
        if (now.toDateString() !== date.toDateString()) return null;
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();
        if (currentHour < startHour || currentHour > endHour) return null;
        const minutesSinceStart = (currentHour - startHour) * 60 + currentMin;
        const pixelsPerMinute = columnWidth / 60;
        return minutesSinceStart * pixelsPerMinute;
    };
    const timeIndicatorPos = getCurrentTimePosition();

    // --- Colors ---
    const getBookingColor = (status) => {
        switch (status) {
            case 'Completed': return 'bg-emerald-500/80 border-emerald-400';
            case 'In Progress': return 'bg-amber-500/80 border-amber-400';
            case 'Confirmed': return 'bg-blue-500/80 border-blue-400';
            case 'Pending': return 'bg-purple-500/80 border-purple-400';
            case 'Cancelled': return 'bg-red-500/80 border-red-400';
            default: return 'bg-gray-500/80 border-gray-400';
        }
    };

    // --- Drag/Drop ---
    const minutesToTime = (minutes) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const calculateTimeFromEvent = (e, rect) => {
        if (viewMode !== 'day') return { time: '00:00', left: 0 };
        const x = e.clientX - rect.left;
        const minutesToAdd = (x / columnWidth) * 60;
        const totalMinutes = startHour * 60 + minutesToAdd;
        const rounded = Math.round(totalMinutes / 15) * 15;
        const clamped = Math.max(startHour * 60, Math.min(endHour * 60 + 59, rounded));
        const snapLeft = ((clamped - startHour * 60) / 60) * columnWidth;
        return { time: minutesToTime(clamped), left: snapLeft };
    };

    const handleTimelineClick = (e, resource) => {
        if (!onAddBooking) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const { time } = calculateTimeFromEvent(e, rect);
        onAddBooking(resource, time);
    };

    const handleDragStart = (e, booking) => {
        if (!onRescheduleBooking) return;
        e.stopPropagation();
        setDraggedBooking(booking);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, resource) => {
        e.preventDefault();
        if (!draggedBooking) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const { time, left } = calculateTimeFromEvent(e, rect);
        setDragOverInfo({ resourceId: resource.id, time, left });
    };

    const handleDrop = (e, resource) => {
        e.preventDefault();
        if (draggedBooking && dragOverInfo && onRescheduleBooking) {
            onRescheduleBooking(draggedBooking, resource, dragOverInfo.time);
        }
        setDraggedBooking(null);
        setDragOverInfo(null);
    };

    // --- Booking card renderer (shared) ---
    const renderBookingCard = (booking) => {
        const service = outlet.services?.find(s => s.id === booking.service_id);
        const style = getBookingStyle(booking);
        if (style.display === 'none') return null;

        return (
            <div
                key={booking.id}
                draggable={!!onRescheduleBooking}
                onDragStart={(e) => handleDragStart(e, booking)}
                className={`absolute top-2 bottom-2 rounded-xl border shadow-sm overflow-hidden cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all duration-200 z-10 flex flex-col justify-center px-3 group ${getBookingColor(booking.status)} ${draggedBooking?.id === booking.id ? 'opacity-50 scale-95 ring-2 ring-purple-400' : ''}`}
                style={style}
                onClick={(e) => { e.stopPropagation(); (onViewBooking || onEditBooking)(booking); }}
            >
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="text-white text-xs font-bold leading-tight truncate">
                        {booking.customer_name || booking.customer || 'Customer'}
                    </div>
                    <div className="text-white/85 text-[10px] leading-tight truncate mt-0.5">
                        {service?.name || 'Service'}
                    </div>
                    {booking.time && (
                        <div className="text-white/70 text-[10px] leading-tight mt-0.5 flex items-center gap-1">
                            <Clock size={8} />
                            <span>{booking.time}</span>
                        </div>
                    )}
                </div>

                {/* Hover actions */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm rounded-lg p-1 shadow-sm border border-white/10 z-20">
                    {onInventoryClick && (
                        <button onClick={(e) => { e.stopPropagation(); onInventoryClick(booking); }} className="p-1 px-1.5 hover:bg-white/20 rounded-md text-white transition-colors" title="Items">
                            <ShoppingCart size={11} strokeWidth={2.5} />
                        </button>
                    )}
                    {onInvoiceClick && (
                        <button onClick={(e) => { e.stopPropagation(); onInvoiceClick(booking); }} className="p-1 px-1.5 hover:bg-white/20 rounded-md text-white transition-colors" title="Invoice">
                            <FileText size={11} strokeWidth={2.5} />
                        </button>
                    )}
                    {(onInventoryClick || onInvoiceClick) && <div className="w-px h-3 bg-white/20 mx-0.5" />}
                    <button onClick={(e) => { e.stopPropagation(); onEditBooking(booking); }} className="p-1 px-1.5 hover:bg-white/20 rounded-md text-white transition-colors" title="Edit">
                        <Pencil size={11} strokeWidth={2.5} />
                    </button>
                    <div className="w-px h-3 bg-white/20 mx-0.5" />
                    <button onClick={(e) => { e.stopPropagation(); onDeleteBooking && onDeleteBooking(booking); }} className="p-1 px-1.5 hover:bg-red-500/40 text-red-200 hover:text-white rounded-md transition-colors" title="Delete">
                        <Trash2 size={11} strokeWidth={2.5} />
                    </button>
                </div>
            </div>
        );
    };

    // Render a lane row (used for both resource rows and unassigned row)
    const renderLane = (resource, laneBookings, index, isUnassigned = false) => (
        <div
            key={resource.id}
            className={`flex border-b border-gray-100 dark:border-white/5 transition-colors relative group ${isUnassigned ? 'bg-amber-50/30 dark:bg-amber-500/5' : 'hover:bg-gray-50 dark:hover:bg-white/[0.02]'}`}
        >
            {/* Sticky Resource Cell */}
            <div className={`w-56 flex-shrink-0 sticky left-0 z-20 ${isUnassigned ? 'bg-amber-50 dark:bg-[#1A1500]' : 'bg-white dark:bg-[#0B0D10] group-hover:bg-gray-50 dark:group-hover:bg-[#15191F]'} transition-colors border-r border-gray-200 dark:border-white/5 flex items-center px-4 py-4 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] dark:shadow-none`}>
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-md ${isUnassigned
                            ? 'bg-amber-500'
                            : ['bg-purple-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-pink-500'][index % 5]
                        }`}>
                        {isUnassigned ? '?' : resource.name.charAt(0)}
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">{resource.name}</div>
                        <div className="text-[11px] text-gray-500 flex items-center gap-1">
                            {isUnassigned && <AlertCircle size={10} className="text-amber-500" />}
                            {laneBookings.length} booking{laneBookings.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                </div>
            </div>

            {/* Timeline Lane */}
            <div
                className="relative h-32 cursor-pointer"
                style={{ width: totalWidth }}
                onClick={(e) => !isUnassigned && handleTimelineClick(e, resource)}
                onDragOver={(e) => !isUnassigned && handleDragOver(e, resource)}
                onDrop={(e) => !isUnassigned && handleDrop(e, resource)}
            >
                {/* Grid Lines */}
                {columns.map((col, i) => (
                    <div key={i} className="absolute top-0 bottom-0 border-r border-gray-100 dark:border-white/5 pointer-events-none" style={{ left: i * columnWidth, width: columnWidth }} />
                ))}

                {/* Drag indicator */}
                {dragOverInfo?.resourceId === resource.id && (
                    <div className="absolute top-2 bottom-2 w-1 bg-purple-500 z-50 pointer-events-none shadow-[0_0_10px_rgba(168,85,247,0.5)] rounded-full transition-all duration-75" style={{ left: dragOverInfo.left }}>
                        <div className="absolute top-[-20px] left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
                            {dragOverInfo.time}
                        </div>
                    </div>
                )}

                {/* Booking Cards */}
                {laneBookings.map(booking => renderBookingCard(booking))}

                {/* Current Time Line (only in body, no label here — label is in header) */}
                {timeIndicatorPos !== null && (
                    <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/70 z-0 pointer-events-none" style={{ left: timeIndicatorPos }} />
                )}
            </div>
        </div>
    );

    return (
        <div className="glass-panel flex flex-col h-full rounded-3xl overflow-hidden shadow-2xl bg-white dark:bg-[#12161C]/50 transition-colors duration-300">
            {/* Header Controls */}
            {!hideHeader && (
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 backdrop-blur-sm flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white pl-2">Timeline</h3>
                        <div className="flex bg-gray-200 dark:bg-black/20 rounded-lg p-1 border border-gray-200 dark:border-white/5">
                            {['day', 'week', 'month'].map(m => (
                                <button key={m} onClick={() => setViewMode(m)} className={`px-3 py-1 text-xs font-medium rounded-md shadow-sm transition-all capitalize ${viewMode === m ? 'bg-white dark:bg-[#5FA8D3]/20 text-gray-900 dark:text-[#5FA8D3]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
                                    {m.charAt(0).toUpperCase() + m.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-4 bg-gray-100 dark:bg-black/20 rounded-xl p-1 px-2 border border-gray-200 dark:border-white/5">
                        <button onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); handleDateChange(d); }} className="p-1.5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg text-gray-500 dark:text-gray-400 transition-all">
                            <ChevronLeft size={18} />
                        </button>
                        <div className="flex items-center gap-2 px-2">
                            <Calendar size={14} className="text-[#5FA8D3]" />
                            <span className="text-sm font-medium text-gray-900 dark:text-white min-w-[140px] text-center">
                                {date.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}
                            </span>
                        </div>
                        <button onClick={() => { const d = new Date(date); d.setDate(d.getDate() + 1); handleDateChange(d); }} className="p-1.5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg text-gray-500 dark:text-gray-400 transition-all">
                            <ChevronRight size={18} />
                        </button>
                        <button onClick={() => handleDateChange(new Date())} className="text-xs text-[#5FA8D3] hover:underline px-2 border-l border-gray-200 dark:border-white/10">Today</button>
                    </div>
                </div>
            )}

            {/* Timeline Content */}
            <div className="flex-1 overflow-auto relative bg-white dark:bg-transparent" ref={containerRef}>
                <div className="min-w-max">
                    {/* Sticky Header Row */}
                    <div className="flex sticky top-0 z-30 bg-white/95 dark:bg-[#12161C]/95 backdrop-blur-md border-b border-gray-200 dark:border-white/5">
                        {/* Corner */}
                        <div className="w-56 flex-shrink-0 sticky left-0 z-40 bg-white dark:bg-[#12161C] border-r border-gray-200 dark:border-white/5 flex items-center px-6 h-14">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                Resources ({resources.length})
                            </span>
                        </div>

                        {/* Time Scale */}
                        <div className="flex h-14 relative" style={{ width: totalWidth }}>
                            {columns.map((col, i) => (
                                <div key={i} className="flex-shrink-0 flex items-center justify-start pl-2 border-r border-gray-100 dark:border-white/5 text-xs text-gray-500 font-medium" style={{ width: columnWidth }}>
                                    {col.label}
                                </div>
                            ))}

                            {/* Current Time dot + label — only in header, once */}
                            {timeIndicatorPos !== null && (
                                <div className="absolute inset-y-0 pointer-events-none flex items-center z-50" style={{ left: timeIndicatorPos }}>
                                    <div className="relative">
                                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-md shadow-red-500/40 -translate-x-1/2" />
                                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap shadow-sm">
                                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Grid Body */}
                    <div>
                        {loading ? (
                            <div className="p-12 text-center text-gray-500 w-full">Loading schedule data...</div>
                        ) : (
                            <>
                                {/* Unassigned bookings row (shown only if there are unassigned bookings) */}
                                {unassignedBookings.length > 0 && renderLane(
                                    { id: '__unassigned__', name: 'Unassigned' },
                                    unassignedBookings,
                                    -1,
                                    true
                                )}

                                {/* Resource rows */}
                                {resources.map((resource, index) =>
                                    renderLane(
                                        resource,
                                        assignedBookings.filter(b => b.resource_id === resource.id),
                                        index,
                                        false
                                    )
                                )}

                                {resources.length === 0 && (
                                    <div className="p-12 text-center text-gray-500">No resources configured.</div>
                                )}

                                {/* Empty state for a day with no bookings at all */}
                                {!loading && bookings.length === 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="text-center">
                                            <Calendar size={32} className="text-gray-200 dark:text-gray-700 mx-auto mb-2" />
                                            <p className="text-sm text-gray-400 dark:text-gray-600">No bookings for this day</p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SlotTimelineView;

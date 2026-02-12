import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '../services/api';
import {
  ChevronLeft, ChevronRight, Plus, Calendar, Clock, User, X,
  Check, Search, MoreHorizontal, Layers, AlertCircle, Trash2, Pencil
} from 'lucide-react';
import SlotTimelineView from '../components/admin/SlotTimelineView';

const SlotManagement = () => {
  const [outlets, setOutlets] = useState([]);
  const [slotConfigs, setSlotConfigs] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('day');
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedBooking, setDraggedBooking] = useState(null);
  const [dragOverResource, setDragOverResource] = useState(null);
  const [dragOverTime, setDragOverTime] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedOutlet) {
      fetchBookings();
    }
  }, [selectedOutlet, selectedDate, viewMode]);

  const fetchData = async () => {
    try {
      const [outletsRes, configsRes, servicesRes] = await Promise.all([
        api.getOutlets(),
        api.getSlotConfigs(),
        api.getServices()
      ]);
      setOutlets(outletsRes.data);
      setSlotConfigs(configsRes.data);
      setServices(servicesRes.data);

      if (configsRes.data.length > 0) {
        const firstConfig = configsRes.data[0];
        const outlet = outletsRes.data.find(o => o.id === firstConfig.outlet_id);
        if (outlet) setSelectedOutlet(outlet);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    if (!selectedOutlet) return;
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const res = await api.getResourceBookings(selectedOutlet.id, dateStr);
      setBookings(res.data || []);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    }
  };

  const getConfigForOutlet = (outletId) => {
    return slotConfigs.find(c => c.outlet_id === outletId);
  };

  const config = selectedOutlet ? getConfigForOutlet(selectedOutlet.id) : null;
  const resources = config?.resources?.filter(r => r.active !== false) || [];
  const allowMultipleServices = config?.allow_multiple_services || false;

  // Generate time markers (every 60 min for display - 1 hour intervals)
  const timeMarkers = useMemo(() => {
    if (!config) return [];
    const markers = [];
    const [startHour, startMin] = (config.operating_hours_start || '09:00').split(':').map(Number);
    const [endHour, endMin] = (config.operating_hours_end || '18:00').split(':').map(Number);

    let current = startHour * 60 + startMin;
    const end = endHour * 60 + endMin;
    const interval = 60; // Display markers every 60 min (1 hour)

    while (current <= end) {
      const hour = Math.floor(current / 60);
      const min = current % 60;
      const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      const ampm = hour >= 12 ? 'pm' : 'am';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const displayTime = `${displayHour}:${min.toString().padStart(2, '0')} ${ampm}`;

      markers.push({ time: timeStr, display: displayTime, minutes: current });
      current += interval;
    }
    return markers;
  }, [config]);

  // Get operating hours in minutes
  const getOperatingHours = useCallback(() => {
    if (!config) return { start: 540, end: 1080 }; // 9am to 6pm default
    const [startHour, startMin] = (config.operating_hours_start || '09:00').split(':').map(Number);
    const [endHour, endMin] = (config.operating_hours_end || '18:00').split(':').map(Number);
    return {
      start: startHour * 60 + startMin,
      end: endHour * 60 + endMin
    };
  }, [config]);

  // Convert time string to minutes
  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [hour, min] = timeStr.split(':').map(Number);
    return hour * 60 + min;
  };

  // Convert minutes to time string
  const minutesToTime = (minutes) => {
    const hour = Math.floor(minutes / 60);
    const min = minutes % 60;
    return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  };

  // Get booking duration from services
  const getBookingDuration = (booking) => {
    if (booking.service_ids && booking.service_ids.length > 0) {
      return booking.service_ids.reduce((total, sid) => {
        const service = services.find(s => s.id === sid);
        return total + (service?.duration_min || 30);
      }, 0);
    }
    const service = services.find(s => s.id === booking.service_id);
    return service?.duration_min || 30;
  };

  // Get bookings for a specific resource
  const getResourceBookings = (resourceId) => {
    return bookings.filter(b => b.resource_id === resourceId);
  };

  // Calculate booking position and height in the timeline
  const getBookingStyle = (booking) => {
    const hours = getOperatingHours();
    const totalMinutes = hours.end - hours.start;
    const bookingStart = timeToMinutes(booking.time);
    const duration = getBookingDuration(booking);

    const topPercent = ((bookingStart - hours.start) / totalMinutes) * 100;
    const heightPercent = (duration / totalMinutes) * 100;

    return {
      top: `${Math.max(0, topPercent)}%`,
      height: `${Math.min(heightPercent, 100 - topPercent)}%`,
      minHeight: '40px'
    };
  };

  // Handle click on timeline to create booking
  const handleTimelineClick = (resource, event) => {
    if (draggedBooking) return; // Don't create booking while dragging

    const rect = event.currentTarget.getBoundingClientRect();
    const clickY = event.clientY - rect.top;
    const clickPercent = clickY / rect.height;

    const hours = getOperatingHours();
    const totalMinutes = hours.end - hours.start;
    const clickedMinutes = hours.start + (clickPercent * totalMinutes);

    // Round to nearest 15 minutes
    const roundedMinutes = Math.round(clickedMinutes / 15) * 15;
    const hour = Math.floor(roundedMinutes / 60);
    const min = roundedMinutes % 60;
    const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;

    setSelectedSlot({
      resource,
      time: timeStr,
      date: selectedDate,
      allowMultipleServices
    });
    setShowBookingModal(true);
  };

  // Drag handlers for reschedule
  const handleDragStart = (e, booking) => {
    e.stopPropagation();
    setDraggedBooking(booking);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', booking.id);
  };

  const handleDragEnd = () => {
    setDraggedBooking(null);
    setDragOverResource(null);
    setDragOverTime(null);
  };

  const handleDragOver = (e, resource, timelineElement) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    setDragOverResource(resource.id);

    // Calculate time from mouse position
    const rect = timelineElement.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const clickPercent = clickY / rect.height;

    const hours = getOperatingHours();
    const totalMinutes = hours.end - hours.start;
    const clickedMinutes = hours.start + (clickPercent * totalMinutes);

    // Round to nearest 15 minutes
    const roundedMinutes = Math.round(clickedMinutes / 15) * 15;
    setDragOverTime(minutesToTime(roundedMinutes));
  };

  const handleDragLeave = () => {
    setDragOverResource(null);
    setDragOverTime(null);
  };

  const handleDrop = async (e, resource) => {
    e.preventDefault();

    if (!draggedBooking || !dragOverTime) {
      handleDragEnd();
      return;
    }

    try {
      // Reschedule the booking - include resource_id for cross-resource moves
      await api.rescheduleBooking(
        draggedBooking.id,
        dragOverTime,
        selectedDate.toISOString().split('T')[0],
        resource.id
      );

      // Refresh bookings
      await fetchBookings();
    } catch (error) {
      console.error('Failed to reschedule booking:', error);
    }

    handleDragEnd();
  };

  // Status colors
  // Status colors
  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return 'bg-gradient-to-r from-emerald-500/80 to-teal-500/80 backdrop-blur-md border-emerald-400/50 shadow-lg shadow-emerald-500/20';
      case 'In Progress': return 'bg-gradient-to-r from-blue-500/80 to-indigo-500/80 backdrop-blur-md border-blue-400/50 shadow-lg shadow-blue-500/20';
      case 'Pending': return 'bg-gradient-to-r from-purple-500/80 to-pink-500/80 backdrop-blur-md border-purple-400/50 shadow-lg shadow-purple-500/20';
      case 'Cancelled': return 'bg-gradient-to-r from-red-500/80 to-rose-500/80 backdrop-blur-md border-red-400/50 shadow-lg shadow-red-500/20';
      default: return 'bg-white/10 backdrop-blur-md border-white/20';
    }
  };

  // Navigation
  const navigateDate = (direction) => {
    const newDate = new Date(selectedDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + direction);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction * 7));
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Format date based on view mode
  const formatDateHeader = () => {
    if (viewMode === 'day') {
      return selectedDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } else if (viewMode === 'week') {
      const weekStart = new Date(selectedDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
      return selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };

  // Get week days for week view
  const getWeekDays = () => {
    const days = [];
    const weekStart = new Date(selectedDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  };

  // Filter bookings by search
  const filteredBookings = useMemo(() => {
    if (!searchQuery) return bookings;
    const query = searchQuery.toLowerCase();
    return bookings.filter(b =>
      b.customer_name?.toLowerCase().includes(query) ||
      b.customer?.toLowerCase().includes(query) ||
      b.id?.toLowerCase().includes(query)
    );
  }, [bookings, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-[#4B5563] dark:text-[#7D8590]">Loading slot management...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col glass-panel overflow-hidden">
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-md border-b border-[#D9DEE5] dark:border-[#1F2630] px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB] flex items-center gap-2">
              <Calendar className="text-purple-500" size={28} />
              Slot Manager
            </h1>

            {/* Outlet Selector - Only show if multiple outlets */}
            {outlets.filter(o => getConfigForOutlet(o.id)).length > 1 && (
              <select
                value={selectedOutlet?.id || ''}
                onChange={(e) => {
                  const outlet = outlets.find(o => o.id === e.target.value);
                  setSelectedOutlet(outlet);
                }}
                className="px-4 py-2 bg-white/5 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#0E1116] dark:text-[#E6E8EB] text-sm font-medium"
              >
                <option value="">Select Outlet</option>
                {outlets.filter(o => getConfigForOutlet(o.id)).map(outlet => (
                  <option key={outlet.id} value={outlet.id}>{outlet.name}</option>
                ))}
              </select>
            )}

            {/* Multi-service indicator */}
            {allowMultipleServices && (
              <span className="flex items-center gap-1 px-3 py-1 bg-purple-500/10 text-purple-500 text-xs font-semibold rounded-full">
                <Layers size={14} />
                Multi-Service
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
              <input
                type="text"
                placeholder="Search bookings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 w-48 bg-white/5 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-sm text-[#0E1116] dark:text-[#E6E8EB] placeholder:text-[#6B7280]"
              />
            </div>

            {/* Add Work Order Button */}
            <button
              onClick={() => {
                if (resources.length > 0) {
                  setSelectedSlot({
                    resource: resources[0],
                    time: config?.operating_hours_start || '09:00',
                    date: selectedDate,
                    allowMultipleServices
                  });
                  setShowBookingModal(true);
                }
              }}
              className="px-4 py-2 rounded-xl font-semibold text-white transition-all hover:scale-[1.02] flex items-center gap-2 shadow-lg shadow-purple-500/20 bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90"
              data-testid="add-work-order-btn"
            >
              <Plus size={18} />
              Add Booking
            </button>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#D9DEE5] dark:border-[#1F2630]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateDate(-1)}
              className="p-2 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg transition-all"
            >
              <ChevronLeft size={20} className="text-[#4B5563] dark:text-[#A9AFB8]" />
            </button>

            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-[#0E1116] dark:text-[#E6E8EB] min-w-[280px]">
                {formatDateHeader()}
              </span>
              {viewMode === 'day' && selectedDate.toDateString() === new Date().toDateString() && (
                <span className="px-2 py-0.5 bg-purple-600 text-white text-xs font-bold rounded-full">
                  Today
                </span>
              )}
            </div>

            <button
              onClick={() => navigateDate(1)}
              className="p-2 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg transition-all"
            >
              <ChevronRight size={20} className="text-[#4B5563] dark:text-[#A9AFB8]" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/5 text-[#4B5563] dark:text-[#A9AFB8] hover:bg-white/10 transition-all border border-transparent hover:border-[#D9DEE5] dark:hover:border-[#1F2630]"
            >
              Today
            </button>
            {['day', 'week', 'month'].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${viewMode === mode
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                  : 'bg-white/5 text-[#4B5563] dark:text-[#A9AFB8] hover:bg-white/10'
                  }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar Content */}
      {!selectedOutlet || !config ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Calendar size={64} className="text-[#D9DEE5] dark:text-[#1F2630] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-[#4B5563] dark:text-[#7D8590] mb-2">No Outlet Selected</h3>
            <p className="text-[#6B7280] dark:text-[#7D8590]">
              Select an outlet with slot configuration to view the calendar
            </p>
          </div>
        </div>
      ) : resources.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <User size={64} className="text-[#D9DEE5] dark:text-[#1F2630] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-[#4B5563] dark:text-[#7D8590] mb-2">No Resources Configured</h3>
            <p className="text-[#6B7280] dark:text-[#7D8590]">
              Add resources in Admin Console → Slot Booking
            </p>
          </div>
        </div>
      ) : viewMode === 'day' ? (
        // Day View - Timeline
        <SlotTimelineView
          config={config}
          outlet={{ ...selectedOutlet, resources, services }}
          bookings={filteredBookings}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          hideHeader={true}
          onAddBooking={(resource, timeStr) => {
            setSelectedSlot({
              resource,
              time: timeStr,
              date: selectedDate,
              allowMultipleServices: config?.allow_multiple_services || false
            });
            setShowBookingModal(true);
          }}
          onRescheduleBooking={async (booking, resource, timeStr) => {
            try {
              await api.rescheduleBooking(
                booking.id, // booking object
                timeStr,
                selectedDate.toISOString().split('T')[0],
                resource.id
              );
              fetchBookings();
            } catch (e) {
              console.error("Reschedule failed", e);
              alert("Failed to reschedule booking");
            }
          }}
          onEditBooking={(booking) => {
            setSelectedSlot({
              resource: resources.find(r => r.id === booking.resource_id) || { id: booking.resource_id, name: 'Resource' },
              time: booking.time,
              date: new Date(booking.date),
              existingBooking: booking
            });
            setShowBookingModal(true);
          }}
          onDeleteBooking={async (booking) => {
            if (window.confirm('Delete this booking?')) {
              try {
                await api.deleteBooking(booking.id);
                fetchBookings();
              } catch (e) {
                console.error(e);
              }
            }
          }}
        />
      ) : viewMode === 'week' ? (
        // Week View
        <WeekView
          resources={resources}
          bookings={filteredBookings}
          services={services}
          weekDays={getWeekDays()}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          setViewMode={setViewMode}
          getBookingDuration={getBookingDuration}
          getStatusColor={getStatusColor}
        />
      ) : (
        // Month View
        <MonthView
          selectedDate={selectedDate}
          bookings={filteredBookings}
          setSelectedDate={setSelectedDate}
          setViewMode={setViewMode}
        />
      )}

      {/* Booking Modal */}
      {showBookingModal && selectedSlot && (
        <BookingModal
          slot={selectedSlot}
          services={services}
          config={config}
          resources={resources}
          onClose={() => {
            setShowBookingModal(false);
            setSelectedSlot(null);
          }}
          onSuccess={() => {
            fetchBookings();
            setShowBookingModal(false);
            setSelectedSlot(null);
          }}
        />
      )}
    </div>
  );
};

// Day View Component - Timeline based with drag-to-reschedule
const DayView = ({
  resources, bookings, services, timeMarkers, getOperatingHours,
  getBookingStyle, getBookingDuration, getStatusColor, handleTimelineClick, timeToMinutes, minutesToTime,
  draggedBooking, dragOverResource, dragOverTime,
  handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop,
  onEditBooking, onDeleteBooking
}) => {
  const hours = getOperatingHours();
  const totalMinutes = hours.end - hours.start;
  const timelineRefs = useRef({});

  return (
    <div className="flex-1 overflow-auto">
      <div className="flex min-w-max h-full">
        {/* Time Column */}
        <div className="w-20 flex-shrink-0 bg-white/5 border-r border-[#D9DEE5] dark:border-[#1F2630]">
          <div className="h-12 border-b border-[#D9DEE5] dark:border-[#1F2630]"></div>
          <div className="relative" style={{ height: 'calc(100% - 48px)' }}>
            {timeMarkers.map((marker, idx) => (
              <div
                key={marker.time}
                className="absolute w-full text-right pr-3 text-xs font-medium text-[#6B7280] dark:text-[#7D8590]"
                style={{
                  top: `${((marker.minutes - hours.start) / totalMinutes) * 100}%`,
                  transform: 'translateY(-50%)'
                }}
              >
                {marker.display}
              </div>
            ))}
          </div>
        </div>

        {/* Resource Columns */}
        {resources.map((resource) => {
          const resourceBookings = bookings.filter(b => b.resource_id === resource.id);
          const totalBookedMinutes = resourceBookings.reduce((sum, b) => sum + getBookingDuration(b), 0);
          const bookedHours = Math.round(totalBookedMinutes / 60 * 10) / 10;
          const isDragOver = dragOverResource === resource.id;

          return (
            <div key={resource.id} className="flex-1 min-w-[200px] border-r border-[#D9DEE5] dark:border-[#1F2630] last:border-r-0">
              {/* Resource Header */}
              <div className="h-12 px-4 py-2 bg-white/5 backdrop-blur-md border-b border-[#D9DEE5] dark:border-[#1F2630] flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-[#0E1116] dark:text-[#E6E8EB] text-sm">{resource.name}</h3>
                  <p className="text-xs text-[#6B7280] dark:text-[#7D8590]">{bookedHours}h booked</p>
                </div>
                <button className="p-1 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded">
                  <MoreHorizontal size={16} className="text-[#7D8590]" />
                </button>
              </div>

              {/* Timeline */}
              <div
                ref={el => timelineRefs.current[resource.id] = el}
                className={`relative bg-transparent cursor-pointer transition-colors ${isDragOver ? 'bg-purple-500/10' : ''
                  }`}
                style={{ height: 'calc(100vh - 250px)', minHeight: '500px' }}
                onClick={(e) => handleTimelineClick(resource, e)}
                onDragOver={(e) => handleDragOver(e, resource, timelineRefs.current[resource.id])}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, resource)}
              >
                {/* Hour lines */}
                {timeMarkers.map((marker, idx) => (
                  <div
                    key={marker.time}
                    className="absolute w-full border-t border-[#ECEFF3] dark:border-[#1F2630]"
                    style={{ top: `${((marker.minutes - hours.start) / totalMinutes) * 100}%` }}
                  />
                ))}

                {/* Drop indicator */}
                {isDragOver && dragOverTime && (
                  <div
                    className="absolute left-0 right-0 h-1 bg-purple-500 rounded-full z-20 pointer-events-none shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                    style={{
                      top: `${((timeToMinutes(dragOverTime) - hours.start) / totalMinutes) * 100}%`,
                      transform: 'translateY(-50%)'
                    }}
                  >
                    <div className="absolute -left-1 -top-3 px-2 py-0.5 bg-purple-600 text-white text-xs font-semibold rounded shadow-md">
                      {dragOverTime}
                    </div>
                  </div>
                )}

                {/* Bookings */}
                {resourceBookings.map((booking) => {
                  const style = getBookingStyle(booking);
                  const duration = getBookingDuration(booking);
                  const service = services.find(s => s.id === booking.service_id);
                  const isDragging = draggedBooking?.id === booking.id;

                  return (
                    <div
                      key={booking.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, booking)}
                      onDragEnd={handleDragEnd}
                      className={`absolute left-1 right-1 rounded-lg border-l-4 px-2 py-1 overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-lg transition-all group ${getStatusColor(booking.status)} ${isDragging ? 'opacity-50 scale-95' : ''
                        }`}
                      style={style}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-semibold truncate">
                            {booking.customer_name || booking.customer || 'Customer'}
                          </div>
                          <div className="text-white/70 text-xs truncate">
                            {service?.name || 'Service'} • {duration} min
                          </div>
                          <div className="text-white/60 text-xs mt-0.5">
                            {booking.time} • {booking.status}
                          </div>
                        </div>
                        {/* Action Buttons */}
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditBooking && onEditBooking(booking);
                            }}
                            className="p-1 bg-white/20 hover:bg-white/40 rounded text-white"
                            title="Edit"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteBooking && onDeleteBooking(booking);
                            }}
                            className="p-1 bg-red-500/20 hover:bg-red-500/40 rounded text-white"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Week View Component
const WeekView = ({ resources, bookings, services, weekDays, selectedDate, setSelectedDate, setViewMode, getBookingDuration, getStatusColor }) => {
  const getBookingsForDay = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return bookings.filter(b => b.date === dateStr);
  };

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-7 gap-2 min-h-[500px]">
        {weekDays.map((day) => {
          const isToday = day.toDateString() === new Date().toDateString();
          const isSelected = day.toDateString() === selectedDate.toDateString();
          const dayBookings = getBookingsForDay(day);

          return (
            <div
              key={day.toISOString()}
              className={`bg-white/5 backdrop-blur-sm rounded-xl border overflow-hidden cursor-pointer transition-all hover:shadow-md ${isSelected
                ? 'border-purple-500 ring-2 ring-purple-500/20'
                : 'border-[#D9DEE5] dark:border-[#1F2630] hover:border-purple-500/50'
                }`}
              onClick={() => {
                setSelectedDate(day);
                setViewMode('day');
              }}
            >
              {/* Day Header */}
              <div className={`px-3 py-2 border-b border-[#D9DEE5] dark:border-[#1F2630] ${isToday ? 'bg-purple-600 text-white' : 'bg-white/5'
                }`}>
                <div className={`text-xs font-medium ${isToday ? 'text-white/80' : 'text-[#6B7280] dark:text-[#7D8590]'}`}>
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className={`text-lg font-bold ${isToday ? 'text-white' : 'text-[#0E1116] dark:text-[#E6E8EB]'}`}>
                  {day.getDate()}
                </div>
              </div>

              {/* Bookings */}
              <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
                {dayBookings.length > 0 ? (
                  dayBookings.slice(0, 5).map((booking) => {
                    const service = services.find(s => s.id === booking.service_id);
                    return (
                      <div
                        key={booking.id}
                        className={`p-2 rounded-lg text-white text-xs ${getStatusColor(booking.status)}`}
                      >
                        <div className="font-semibold truncate">{booking.customer_name || booking.customer}</div>
                        <div className="opacity-80">{booking.time}</div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-[#6B7280] dark:text-[#7D8590] text-center py-2">
                    No bookings
                  </div>
                )}
                {dayBookings.length > 5 && (
                  <div className="text-xs text-[#5FA8D3] font-semibold text-center">
                    +{dayBookings.length - 5} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Month View Component
const MonthView = ({ selectedDate, bookings, setSelectedDate, setViewMode }) => {
  const getDaysInMonth = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days = [];
    const startPadding = firstDay.getDay();

    // Add padding for days from previous month
    for (let i = startPadding - 1; i >= 0; i--) {
      const day = new Date(year, month, -i);
      days.push({ date: day, isCurrentMonth: false });
    }

    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    // Add padding for days from next month
    const endPadding = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= endPadding; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  };

  const getBookingCountForDay = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return bookings.filter(b => b.date === dateStr).length;
  };

  const days = getDaysInMonth();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="flex-1 overflow-auto p-4">
      {/* Week day headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-center text-sm font-semibold text-[#6B7280] dark:text-[#7D8590] py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map(({ date, isCurrentMonth }, idx) => {
          const isToday = date.toDateString() === new Date().toDateString();
          const bookingCount = getBookingCountForDay(date);

          return (
            <div
              key={idx}
              onClick={() => {
                setSelectedDate(date);
                setViewMode('day');
              }}
              className={`aspect-square p-2 rounded-xl border cursor-pointer transition-all hover:shadow-md ${isCurrentMonth
                ? 'bg-white/10 backdrop-blur-md border-[#D9DEE5] dark:border-[#1F2630] hover:border-purple-500'
                : 'bg-[#F6F7F9]/5 dark:bg-[#0B0D10]/20 border-transparent opacity-50'
                } ${isToday ? 'ring-2 ring-purple-500' : ''}`}
            >
              <div className={`text-sm font-semibold ${isToday
                ? 'text-purple-400'
                : isCurrentMonth
                  ? 'text-[#0E1116] dark:text-[#E6E8EB]'
                  : 'text-[#6B7280] dark:text-[#7D8590]'
                }`}>
                {date.getDate()}
              </div>
              {bookingCount > 0 && isCurrentMonth && (
                <div className="mt-1 px-2 py-0.5 bg-purple-600 text-white text-xs font-semibold rounded-full text-center">
                  {bookingCount}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Booking Modal Component
const BookingModal = ({ slot, services, config, resources, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customers, setCustomers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    customer_id: '',
    service_ids: [],
    notes: '',
    resource_id: slot.resource?.id || (resources && resources[0]?.id) || '',
    time: slot.time || ''
  });

  const availableServices = services.filter(s => s.active !== false);

  // Debounced search for customers
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (formData.customer_name.length >= 2 && !formData.customer_id) {
        setSearching(true);
        try {
          const res = await api.get('/customers', { params: { search: formData.customer_name } });
          setCustomers(res.data);
          setShowDropdown(true);
        } catch (err) {
          console.error('Failed to search customers', err);
        } finally {
          setSearching(false);
        }
      } else {
        setShowDropdown(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [formData.customer_name, formData.customer_id]);

  const selectCustomer = (customer) => {
    setFormData({
      ...formData,
      customer_name: customer.name,
      customer_phone: customer.phone || '',
      customer_email: customer.email || '',
      customer_id: customer.id
    });
    setShowDropdown(false);
  };

  const clearCustomer = () => {
    setFormData({
      ...formData,
      customer_name: '',
      customer_phone: '',
      customer_email: '',
      customer_id: ''
    });
  };

  const getTotalDuration = () => {
    return formData.service_ids.reduce((total, sid) => {
      const service = services.find(s => s.id === sid);
      return total + (service?.duration_min || 0);
    }, 0);
  };

  const getTotalPrice = () => {
    return formData.service_ids.reduce((total, sid) => {
      const service = services.find(s => s.id === sid);
      return total + (service?.price || 0);
    }, 0);
  };

  const toggleService = (serviceId) => {
    if (slot.allowMultipleServices) {
      if (formData.service_ids.includes(serviceId)) {
        setFormData({ ...formData, service_ids: formData.service_ids.filter(id => id !== serviceId) });
      } else {
        setFormData({ ...formData, service_ids: [...formData.service_ids, serviceId] });
      }
    } else {
      setFormData({ ...formData, service_ids: [serviceId] });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.service_ids.length === 0) {
      setError('Please select at least one service');
      return;
    }

    // Validation: Email OR Phone is mandatory
    if (!formData.customer_email && !formData.customer_phone) {
      setError('Either Email or Phone number is required for the customer.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.createBooking({
        customer: formData.customer_name,
        customer_phone: formData.customer_phone,
        customer_email: formData.customer_email,
        customer_id: formData.customer_id || null, // Pass ID if selected
        time: formData.time,
        date: slot.date.toISOString().split('T')[0],
        service_id: formData.service_ids[0],
        service_ids: formData.service_ids,
        outlet_id: config.outlet_id,
        resource_id: formData.resource_id || null,
        amount: getTotalPrice()
      });
      onSuccess();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail[0]?.msg || 'Failed to create booking');
      } else {
        setError(detail || 'Failed to create booking');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#171C22]/90 backdrop-blur-xl rounded-2xl shadow-2xl max-w-md w-full border border-[#1F2630] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#D9DEE5] dark:border-[#1F2630]">
          <div>
            <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">New Booking</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#7D8590]">
              {slot.resource?.name} • {slot.time} • {slot.date.toLocaleDateString()}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg">
            <X size={20} className="text-[#6B7280]" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="relative">
            <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-1">
              Customer Name *
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.customer_name}
                onChange={(e) => {
                  setFormData({ ...formData, customer_name: e.target.value, customer_id: '' }); // Clear ID on name change to force search/new
                }}
                className={`w-full px-3 py-2 border ${formData.customer_id ? 'border-green-500 pl-8' : 'border-[#1F2630]'} rounded-lg bg-[#0B0D10]/50 text-[#E6E8EB] focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all`}
                required
                placeholder="Search or enter new name"
                autoComplete="off"
              />
              {formData.customer_id && (
                <Check size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-green-500" />
              )}
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>

            {/* Autocomplete Dropdown */}
            {showDropdown && customers.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-[#1F2630] border border-[#374151] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {customers.map(c => (
                  <div
                    key={c.id}
                    onClick={() => selectCustomer(c)}
                    className="p-2 hover:bg-[#F3F4F6] dark:hover:bg-[#374151] cursor-pointer"
                  >
                    <div className="font-medium text-sm text-[#0E1116] dark:text-[#E6E8EB]">{c.name}</div>
                    <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                      {c.phone} {c.email ? `• ${c.email}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {formData.customer_id && (
              <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                Linked to existing customer <button type="button" onClick={clearCustomer} className="underline">Change</button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.customer_email}
                onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                className="w-full px-3 py-2 border border-[#1F2630] rounded-lg bg-[#0B0D10]/50 text-[#E6E8EB] focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                placeholder="Required if no phone"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.customer_phone}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                className="w-full px-3 py-2 border border-[#1F2630] rounded-lg bg-[#0B0D10]/50 text-[#E6E8EB] focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                placeholder="Required if no email"
              />
            </div>
          </div>
          <div className="text-xs text-[#6B7280] dark:text-[#7D8590] -mt-2 mb-2">
            * Either Email or Phone is required to create a customer record.
          </div>

          {/* Resource & Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-1">
                Resource
              </label>
              <select
                value={formData.resource_id}
                onChange={(e) => setFormData({ ...formData, resource_id: e.target.value })}
                className="w-full px-3 py-2 border border-[#1F2630] rounded-lg bg-[#0B0D10]/50 text-[#E6E8EB] focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all appearance-none"
              >
                {resources?.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-1">
                Time
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full px-3 py-2 border border-[#1F2630] rounded-lg bg-[#0B0D10]/50 text-[#E6E8EB] focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
              Select Service(s) *
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {availableServices.map((service) => (
                <label
                  key={service.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${formData.service_ids.includes(service.id)
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-[#1F2630] hover:border-purple-500/30'
                    }`}
                >
                  <input
                    type={slot.allowMultipleServices ? 'checkbox' : 'radio'}
                    name="service"
                    checked={formData.service_ids.includes(service.id)}
                    onChange={() => toggleService(service.id)}
                    className="hidden"
                  />
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.service_ids.includes(service.id)
                    ? 'border-purple-500 bg-purple-500'
                    : 'border-[#1F2630]'
                    }`}>
                    {formData.service_ids.includes(service.id) && (
                      <Check size={12} className="text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-[#0E1116] dark:text-[#E6E8EB]">{service.name}</div>
                    <div className="text-xs text-[#6B7280] dark:text-[#7D8590]">{service.duration_min} min</div>
                  </div>
                  <div className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">₹{service.price}</div>
                </label>
              ))}
            </div>
          </div>

          {formData.service_ids.length > 0 && (
            <div className="bg-[#0B0D10]/50 rounded-lg p-3 flex justify-between items-center border border-[#1F2630]">
              <div>
                <div className="text-sm text-[#6B7280] dark:text-[#7D8590]">Total Duration</div>
                <div className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">{getTotalDuration()} min</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-[#6B7280] dark:text-[#7D8590]">Total Amount</div>
                <div className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">₹{getTotalPrice()}</div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-lg text-[#4B5563] dark:text-[#A9AFB8] hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg font-semibold text-white shadow-lg shadow-purple-500/20 bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {loading ? 'Creating...' : 'Create Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SlotManagement;

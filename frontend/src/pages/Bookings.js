import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import {
  Plus, FileText, Download, Printer, Calendar, Clock, X, CheckCircle,
  Wrench, ShoppingCart, List, LayoutGrid, ChevronLeft, ChevronRight, Pencil
} from 'lucide-react';
import BookingItemsModal from '../components/BookingItemsModal';
import BookingDetailModal from '../components/BookingDetailModal';
import SlotTimelineView from '../components/admin/SlotTimelineView';
import SlotBookingModal from '../components/SlotBookingModal';

const Bookings = () => {
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [slotConfigs, setSlotConfigs] = useState([]);

  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'timeline'

  // Filters
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [filterOutletId, setFilterOutletId] = useState('All');
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Pagination (List View)
  const [page, setPage] = useState(1);
  const perPage = 15;

  // Modals
  // showAddModal removed — unified to SlotBookingModal
  const [showSlotModal, setShowSlotModal] = useState(false); // Timeline Add/Edit
  const [slotModalData, setSlotModalData] = useState(null); // Data for Slot Modal

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  const [enabledFeatures, setEnabledFeatures] = useState([]);

  useEffect(() => {
    fetchData();
    fetchFeatures();
  }, []);

  useEffect(() => {
    filterBookings();
  }, [bookings, query, statusFilter, filterOutletId, selectedDate, viewMode]);

  const fetchFeatures = async () => {
    try {
      const res = await api.getCompanyFeatures();
      setEnabledFeatures(res.data.features || []);
    } catch (error) {
      console.error('Failed to fetch features:', error);
    }
  };

  const hasInventory = enabledFeatures.includes('inventory');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bookingsRes, servicesRes, outletsRes, configsRes] = await Promise.all([
        api.getBookings(),
        api.getServices(),
        api.getOutlets(),
        api.getSlotConfigs()
      ]);
      setBookings(bookingsRes.data);
      setServices(servicesRes.data);
      setOutlets(outletsRes.data);
      setSlotConfigs(configsRes.data);

      // Default to first outlet if available
      if (outletsRes.data.length > 0 && filterOutletId === 'All') {
        // Optionally default to first outlet for Timeline view requirements
        // setFilterOutletId(outletsRes.data[0].id); 
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterBookings = () => {
    let filtered = bookings;

    // 1. Text Search
    if (query) {
      filtered = filtered.filter(
        (b) =>
          b.customer?.toLowerCase().includes(query.toLowerCase()) ||
          b.id?.toLowerCase().includes(query.toLowerCase()) ||
          getService(b.service_id)?.name?.toLowerCase().includes(query.toLowerCase())
      );
    }

    // 2. Status Filter
    if (statusFilter !== 'All') {
      filtered = filtered.filter((b) => b.status === statusFilter);
    }

    // 3. Outlet Filter
    if (filterOutletId !== 'All') {
      filtered = filtered.filter(b => b.outlet_id === filterOutletId);
    }

    // 4. Date Filter (Specific to Timeline, optional for List?)
    // In List Mode, usually we show all upcoming? But let's apply date filter ONLY for Timeline for now, 
    // unless user explicitly filters list by date (not implemented in UI yet for list).
    // Actually, for Timeline view, we need bookings for that specific day.
    if (viewMode === 'timeline') {
      const dateStr = selectedDate.toISOString().split('T')[0];
      filtered = filtered.filter(b => b.date === dateStr);
    }

    setFilteredBookings(filtered);
    setPage(1);
  };

  const updateStatus = async (id, newStatus) => {
    try {
      const res = await api.updateBooking(id, newStatus);
      const updated = res.data;

      setBookings(prev => prev.map(b => b.id === id ? updated : b));

      if (selectedBooking && selectedBooking.id === id) {
        setSelectedBooking(updated);
      }
    } catch (error) {
      console.error('Failed to update booking:', error);
    }
  };

  const deleteBooking = async (id) => {
    if (!window.confirm("Are you sure you want to delete this booking?")) return;
    try {
      await api.deleteBooking(id);
      setBookings(prev => prev.filter(b => b.id !== id));
    } catch (error) {
      console.error("Failed to delete booking", error);
    }
  }

  const getService = (serviceId) => services.find(s => s.id === serviceId);
  const getOutlet = (outletId) => outlets.find(o => o.id === outletId);

  // Timeline Helpers
  const getCurrentOutletConfig = () => {
    if (filterOutletId === 'All') return null;
    return slotConfigs.find(c => c.outlet_id === filterOutletId);
  };

  const getCurrentOutletWithResources = () => {
    if (filterOutletId === 'All') return null;
    const outlet = getOutlet(filterOutletId);
    const config = getCurrentOutletConfig();
    if (!outlet || !config) return null;

    return {
      ...outlet,
      resources: config.resources?.filter(r => r.active !== false) || []
    };
  };

  // Handlers
  const handleGenerateInvoice = (booking) => {
    setSelectedBooking(booking);
    setShowInvoiceModal(true);
  };

  const handleAddItems = (booking, e) => {
    if (e) e.stopPropagation();
    setSelectedBooking(booking);
    setShowItemsModal(true);
  };

  const handleRowClick = (booking) => {
    setSelectedBooking(booking);
    setShowDetailModal(true);
  };

  // Timeline Specific Handlers
  const onTimelineAddBooking = (resource, timeStr) => {
    setSlotModalData({
      mode: 'add',
      resource_id: resource.id,
      time: timeStr,
      date: selectedDate,
      outlet_id: filterOutletId
    });
    setShowSlotModal(true);
  };

  // View booking detail (card click in timeline)
  const onTimelineViewBooking = (booking) => {
    setSelectedBooking(booking);
    setShowDetailModal(true);
  };

  // Edit booking (pencil icon in timeline OR list)
  const handleEditBooking = (booking) => {
    const config = getCurrentOutletConfig();
    const resource = config?.resources?.find(r => r.id === booking.resource_id);

    setSlotModalData({
      mode: 'manage',
      existingBooking: booking,
      resource: resource,
      date: new Date(booking.date),
      outlet_id: booking.outlet_id
    });
    setShowSlotModal(true);
  };

  const onTimelineReschedule = async (booking, resource, timeStr) => {
    try {
      await api.rescheduleBooking(
        booking.id,
        timeStr,
        selectedDate.toISOString().split('T')[0],
        resource.id
      );
      // Optimistic update or refetch
      // Refetching is safer
      const bookingsRes = await api.getBookings(); // Ideally just fetch incremental, but full refresh is easier for consistency
      setBookings(bookingsRes.data);
    } catch (e) {
      console.error("Reschedule failed", e);
      alert("Failed to reschedule booking");
    }
  };

  // --- Render Sections ---

  const renderHeader = () => (
    <div className="glass-panel p-6 rounded-3xl mb-6 flex-shrink-0">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB] text-gradient-pro">Bookings</h2>
          <p className="text-sm text-[#4B5563] dark:text-[#9CA3AF] mt-1">
            Manage appointments and schedules
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-center">
          {/* View Toggles */}
          <div className="flex bg-white dark:bg-white/5 rounded-xl p-1 border border-[#D9DEE5] dark:border-[#1F2630]">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10'}`}
              title="List View"
            >
              <List size={20} />
            </button>
            <button
              onClick={() => {
                setViewMode('timeline');
                if (filterOutletId === 'All' && outlets.length > 0) {
                  setFilterOutletId(outlets[0].id); // Select first outlet when switching to timeline if none selected
                }
              }}
              className={`p-2 rounded-lg transition-all ${viewMode === 'timeline' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10'}`}
              title="Timeline View"
            >
              <LayoutGrid size={20} />
            </button>
          </div>

          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 mx-1 hidden sm:block"></div>

          {/* Global Filters */}
          <select
            value={filterOutletId}
            onChange={(e) => setFilterOutletId(e.target.value)}
            className="px-4 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-white/5 text-[#0E1116] dark:text-[#E6E8EB] w-full sm:w-auto focus:ring-2 focus:ring-purple-500/50 outline-none"
          >
            <option value="All">All Outlets</option>
            {outlets.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-white/5 text-[#0E1116] dark:text-[#E6E8EB] w-full sm:w-auto focus:ring-2 focus:ring-purple-500/50 outline-none"
          >
            <option value="All">All Status</option>
            <option>Pending</option>
            <option>In Progress</option>
            <option>Completed</option>
            <option>Cancelled</option>
          </select>

          <button
            onClick={() => {
              setSlotModalData({
                mode: 'add',
                date: selectedDate,
                outlet_id: filterOutletId !== 'All' ? filterOutletId : (outlets.length > 0 ? outlets[0].id : null)
              });
              setShowSlotModal(true);
            }}
            className="px-4 py-2 rounded-xl font-semibold text-white transition-all hover:scale-[1.02] flex items-center gap-2 shadow-lg hover:shadow-purple-500/20 w-full sm:w-auto justify-center"
            style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)' }}
          >
            <Plus size={20} />
            Add Booking
          </button>
        </div>
      </div>
    </div>
  );

  const renderTimeline = () => {
    const outlet = getCurrentOutletWithResources();
    const config = getCurrentOutletConfig();

    if (!outlet || !config) {
      return (
        <div className="glass-panel p-12 flex flex-col items-center justify-center text-center">
          <LayoutGrid size={48} className="text-gray-300 dark:text-gray-700 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Select an Outlet</h3>
          <p className="text-gray-500 dark:text-gray-400">Please select a specific outlet to view the timeline.</p>
        </div>
      );
    }

    // Need to transform internal Booking objects to match what SlotTimelineView expects?
    // SlotTimelineView expects standard bookings.

    return (
      <div className="flex-1 flex flex-col min-h-0">
        <SlotTimelineView
          config={config}
          outlet={{ ...outlet, services }}
          bookings={filteredBookings}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onAddBooking={onTimelineAddBooking}
          onViewBooking={onTimelineViewBooking}
          onEditBooking={handleEditBooking}
          onDeleteBooking={(b) => deleteBooking(b.id)}
          onRescheduleBooking={onTimelineReschedule}
          onInventoryClick={hasInventory ? handleAddItems : null}
          onInvoiceClick={handleGenerateInvoice}
        />
      </div>
    );
  };

  const renderListView = () => {
    const pageCount = Math.ceil(filteredBookings.length / perPage);
    const pageItems = filteredBookings.slice((page - 1) * perPage, page * perPage);

    return (
      <div className="glass-panel overflow-hidden rounded-3xl">
        {/* List Date Filter/Search specific for List? No, using Global now. */}
        {/* We can add a date picker for list view here if needed, but 'All Bookings' usually implies history. 
                 However, if selectedDate is set, do we filter List view by date?
                 Current filter logic DOES NOT filter by date if viewMode is 'list'. 
                 Maybe we should add a 'Date Range' filter in future. For now, following current Bookings.js behavior (show all).
             */}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#ECEFF3] dark:bg-white/5 border-b border-[#D9DEE5] dark:border-[#1F2630]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] uppercase tracking-wider">Service</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] uppercase tracking-wider">Date & Time</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-[#4B5563] dark:text-[#9CA3AF] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-[#1F2630]">
              {pageItems.map((b) => {
                const service = getService(b.service_id);
                return (
                  <tr
                    key={b.id}
                    onClick={() => handleRowClick(b)}
                    className="group hover:bg-gray-50 dark:hover:bg-white/5 transition-all duration-300 cursor-pointer border-l-2 border-transparent hover:border-purple-500"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-semibold text-[#0E1116] dark:text-[#E6E8EB] group-hover:text-purple-400">
                      {b.id?.substring(0, 8).toUpperCase()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-[#0E1116] dark:text-[#E6E8EB]">{b.customer}</div>
                      {b.customer_phone && <div className="text-xs text-gray-500">{b.customer_phone}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <Wrench size={14} className="text-purple-400" />
                        </div>
                        <div>
                          <div className="text-sm text-[#0E1116] dark:text-[#E6E8EB]">{service?.name || 'Service'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-[#0E1116] dark:text-[#E6E8EB]">
                        {b.date ? new Date(b.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock size={12} /> {b.time || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-[#0E1116] dark:text-[#E6E8EB]">
                      ₹{(b.total_amount || b.amount || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        <select
                          value={b.status}
                          onChange={(e) => updateStatus(b.id, e.target.value)}
                          className="text-xs px-2 py-1 border border-[#D9DEE5] dark:border-[#1F2630] rounded-lg bg-white dark:bg-white/5 text-[#0E1116] dark:text-[#E6E8EB]"
                        >
                          <option>Pending</option>
                          <option>In Progress</option>
                          <option>Completed</option>
                          <option>Cancelled</option>
                        </select>
                        {hasInventory && (
                          <button onClick={(e) => handleAddItems(b, e)} className="p-2 hover:bg-purple-500/10 rounded-lg group/btn">
                            <ShoppingCart size={16} className="text-gray-400 group-hover/btn:text-purple-400" />
                          </button>
                        )}
                        <button onClick={() => handleEditBooking(b)} className="p-2 hover:bg-purple-500/10 rounded-lg group/btn" title="Edit Booking">
                          <Pencil size={16} className="text-gray-400 group-hover/btn:text-purple-400" />
                        </button>
                        <button onClick={() => handleGenerateInvoice(b)} className="p-2 hover:bg-purple-500/10 rounded-lg group/btn" title="Invoice">
                          <FileText size={16} className="text-gray-400 group-hover/btn:text-purple-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {pageItems.length === 0 && <div className="p-8 text-center text-gray-500">No bookings found</div>}
        </div>

        {/* Pagination */}
        {pageItems.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 bg-[#ECEFF3] dark:bg-white/5 border-t border-[#D9DEE5] dark:border-[#1F2630]">
            <div className="text-sm text-gray-500">
              Page {page} of {pageCount}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded-lg disabled:opacity-50">Prev</button>
              <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount} className="px-3 py-1 border rounded-lg disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading && bookings.length === 0) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  return (
    <div className={`transition-all duration-300 ${viewMode === 'timeline' ? 'h-[calc(100vh-6rem)] flex flex-col gap-6' : 'space-y-6'}`}>
      {renderHeader()}

      {viewMode === 'timeline' ? renderTimeline() : renderListView()}

      {/* Modals */}
      {/* AddBookingModal removed — unified to SlotBookingModal */}

      {showSlotModal && slotModalData && (
        <SlotBookingModal
          isOpen={showSlotModal}
          onClose={() => setShowSlotModal(false)}
          onSuccess={() => {
            fetchData(); // Reload all. 
            setShowSlotModal(false);
          }}
          slot={slotModalData.time}
          resource={slotModalData.resource || (slotModalData.resource_id ? { id: slotModalData.resource_id } : null)}
          outlet={(() => {
            const outletId = slotModalData.outlet_id || filterOutletId;
            const outlet = getOutlet(outletId);
            const config = slotConfigs.find(c => c.outlet_id === outletId);
            if (!outlet) return null;
            return {
              ...outlet,
              resources: config?.resources?.filter(r => r.active !== false) || []
            };
          })()}
          date={slotModalData.date}
          existingBooking={slotModalData.existingBooking}
          services={services}
          onDelete={slotModalData.existingBooking ? () => deleteBooking(slotModalData.existingBooking.id) : null}
        />
      )}

      {showInvoiceModal && selectedBooking && (
        <InvoiceModal
          booking={selectedBooking}
          service={getService(selectedBooking.service_id)}
          outlet={getOutlet(selectedBooking.outlet_id)}
          onClose={() => {
            setShowInvoiceModal(false);
            setSelectedBooking(null);
          }}
        />
      )}

      {showItemsModal && selectedBooking && (
        <BookingItemsModal
          booking={selectedBooking}
          onClose={() => {
            setShowItemsModal(false);
            setSelectedBooking(null);
          }}
          onSuccess={() => {
            fetchData();
            setShowItemsModal(false);
            setSelectedBooking(null);
          }}
        />
      )}

      <BookingDetailModal
        isOpen={showDetailModal}
        booking={selectedBooking}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedBooking(null);
        }}
        onUpdateStatus={updateStatus}
      />
    </div>
  );
};

const StatusBadge = ({ status, small }) => {
  const colors = {
    Completed: 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20',
    'In Progress': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    Pending: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
    Cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
  };

  return (
    <span className={`px-${small ? '2' : '3'} py-${small ? '0.5' : '1'} rounded-full text-xs font-semibold backdrop-blur-sm ${colors[status] || colors.Pending}`}>
      {status}
    </span>
  );
};

// ... InvoiceModal Code ...
// Repasting InvoiceModal to Ensure it is preserved

const InvoiceModal = ({ booking, service, outlet, onClose }) => {
  const invoiceRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  const invoiceNumber = `INV-${booking.id?.substring(0, 8).toUpperCase()}`;
  const invoiceDate = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const bookingDate = booking.date
    ? new Date(booking.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date(booking.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

  // Calculate totals including inventory items
  const serviceAmount = booking.service_amount || booking.amount || service?.price || 0;
  const items = booking.items || [];
  const itemsTotal = items.reduce((sum, item) => sum + (item.subtotal || item.price * item.quantity), 0);
  const subtotal = serviceAmount + itemsTotal;
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + tax;

  const handlePrint = () => {
    const printContent = invoiceRef.current.innerHTML;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = `
      <html>
        <head>
          <title>Invoice ${invoiceNumber}</title>
          <style>
            body { font-family: 'Inter', system-ui, sans-serif; padding: 40px; }
            .invoice-container { max-width: 800px; margin: 0 auto; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            th { background: #f9fafb; font-weight: 600; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-bold { font-weight: 700; }
          </style>
        </head>
        <body>${printContent}</body>
      </html>
    `;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  const handleDownload = async () => {
    setDownloading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    handlePrint();
    setDownloading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-panel overflow-hidden rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-[#1F2630] bg-white dark:bg-[#12161C]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <FileText size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-[#E6E8EB]">Invoice</h3>
              <p className="text-sm text-gray-500 dark:text-[#9CA3AF]">{invoiceNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-500 dark:to-blue-500 text-white rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50"
            >
              <Download size={16} />
              {downloading ? 'Generating...' : 'Download'}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-[#1F2630] rounded-xl font-semibold text-gray-700 dark:text-[#E6E8EB] hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
            >
              <Printer size={16} />
              Print
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl">
              <X size={20} className="text-gray-500 dark:text-[#9CA3AF]" />
            </button>
          </div>
        </div>

        {/* Invoice Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-[#12161C]">
          <div ref={invoiceRef} className="invoice-container">
            {/* Company Info */}

            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0] flex items-center justify-center mb-2">
                  <span className="text-white font-bold text-lg">Rs</span>
                </div>
                <h2 className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">Ri&apos;Serve</h2>
                <p className="text-[#6B7280] dark:text-[#E6E8EB]/50">Service Operations</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB] mb-2">INVOICE</div>
                <div className="text-sm text-[#6B7280] dark:text-[#E6E8EB]/50">
                  <div>Invoice #: {invoiceNumber}</div>
                  <div>Date: {invoiceDate}</div>
                </div>
              </div>
            </div>

            {/* Customer & Outlet Info */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <div className="text-sm font-semibold text-[#6B7280] dark:text-[#E6E8EB]/50 mb-2">BILL TO</div>
                <div className="text-[#0E1116] dark:text-[#E6E8EB] font-semibold">{booking.customer}</div>
                {booking.customer_phone && <div className="text-[#4B5563] dark:text-[#E6E8EB]/70">{booking.customer_phone}</div>}
                {booking.customer_email && <div className="text-[#4B5563] dark:text-[#E6E8EB]/70">{booking.customer_email}</div>}
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-[#6B7280] dark:text-[#E6E8EB]/50 mb-2">SERVICE AT</div>
                <div className="text-[#0E1116] dark:text-[#E6E8EB] font-semibold">{outlet?.name || 'Location'}</div>
                <div className="text-[#4B5563] dark:text-[#E6E8EB]/70">{outlet?.address}, {outlet?.city}</div>
              </div>
            </div>

            {/* Services & Products Table */}
            <table className="w-full mb-8">
              <thead>
                <tr className="bg-[#F6F7F9] dark:bg-white/5">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[#4B5563] dark:text-[#7D8590]">Description</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-[#4B5563] dark:text-[#7D8590]">Qty</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-[#4B5563] dark:text-[#7D8590]">Price</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-[#4B5563] dark:text-[#7D8590]">Amount</th>
                </tr>
              </thead>
              <tbody>
                {/* Service Row */}
                <tr className="border-b border-[#D9DEE5] dark:border-[#1F2630]">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">{service?.name || 'Service'}</div>
                    <div className="text-sm text-[#6B7280] dark:text-[#E6E8EB]/50">
                      {bookingDate} at {booking.time}
                      {service?.duration_min && ` • ${service.duration_min} min`}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center text-[#4B5563] dark:text-[#E6E8EB]/70">1</td>
                  <td className="px-4 py-4 text-right text-[#4B5563] dark:text-[#E6E8EB]/70">₹{serviceAmount.toLocaleString()}</td>
                  <td className="px-4 py-4 text-right font-semibold text-[#0E1116] dark:text-[#E6E8EB]">₹{serviceAmount.toLocaleString()}</td>
                </tr>

                {/* Product Items Rows */}
                {items.map((item, idx) => (
                  <tr key={idx} className="border-b border-[#D9DEE5] dark:border-[#1F2630]">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">{item.name}</div>
                      <div className="text-sm text-[#6B7280] dark:text-[#E6E8EB]/50">
                        Product {item.sku && `• SKU: ${item.sku}`}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center text-[#4B5563] dark:text-[#E6E8EB]/70">{item.quantity}</td>
                    <td className="px-4 py-4 text-right text-[#4B5563] dark:text-[#E6E8EB]/70">₹{item.price?.toLocaleString()}</td>
                    <td className="px-4 py-4 text-right font-semibold text-[#0E1116] dark:text-[#E6E8EB]">₹{(item.subtotal || item.price * item.quantity).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-8">
              <div className="w-64">
                <div className="flex justify-between py-2 text-[#4B5563] dark:text-[#E6E8EB]/70">
                  <span>Service</span>
                  <span>₹{serviceAmount.toLocaleString()}</span>
                </div>
                {itemsTotal > 0 && (
                  <div className="flex justify-between py-2 text-[#4B5563] dark:text-[#E6E8EB]/70">
                    <span>Products ({items.length})</span>
                    <span>₹{itemsTotal.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 text-[#4B5563] dark:text-[#E6E8EB]/70">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 text-[#4B5563] dark:text-[#E6E8EB]/70 border-b border-[#D9DEE5] dark:border-[#1F2630]">
                  <span>GST (18%)</span>
                  <span>₹{tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-3 font-bold text-lg text-[#0E1116] dark:text-[#E6E8EB]">
                  <span>Total</span>
                  <span>₹{total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="p-4 bg-[#F6F7F9] dark:bg-white/5 rounded-xl border border-[#D9DEE5] dark:border-[#1F2630]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-[#6B7280] dark:text-[#E6E8EB]/50">Payment Status</div>
                  <div className="font-semibold text-[#0E1116] dark:text-[#E6E8EB] flex items-center gap-2">
                    {booking.status === 'Completed' ? (
                      <>
                        <CheckCircle size={16} className="text-green-500" />
                        Paid
                      </>
                    ) : (
                      booking.status
                    )}
                  </div>
                </div>
                <div className="text-sm text-[#6B7280] dark:text-[#E6E8EB]/50">
                  Booking ID: {booking.id?.substring(0, 8).toUpperCase()}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center text-sm text-[#6B7280] dark:text-[#E6E8EB]/50">
              <p>Thank you for your business!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Bookings;

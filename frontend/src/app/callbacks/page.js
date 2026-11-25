'use client';
import { useState, useEffect } from 'react';
import api from '../../lib/api';
import DashboardLayout from '../../components/DashboardLayout';
import { PhoneCall, Search, Filter, CheckCircle2, Clock, XCircle, PhoneForwarded, RefreshCw, Calendar, Tag, Smartphone } from 'lucide-react';

export default function CallbacksPage() {
  const [bots, setBots] = useState([]);
  const [selectedBotId, setSelectedBotId] = useState('');
  const [callbacks, setCallbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [searchMobile, setSearchMobile] = useState('');

  // Fetch Bots
  useEffect(() => {
    const fetchBots = async () => {
      try {
        const res = await api.get('/bots');
        setBots(res.data || []);
        if (res.data && res.data.length > 0) {
          setSelectedBotId(String(res.data[0].id));
        }
      } catch (err) {
        console.error('Failed to fetch bots:', err);
      }
    };
    fetchBots();
  }, []);

  // Fetch Callbacks for selected bot
  const fetchCallbacks = async () => {
    if (!selectedBotId) return;
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (searchMobile.trim()) params.search = searchMobile.trim();

      const res = await api.get(`/admin/bots/${selectedBotId}/callbacks`, { params });
      setCallbacks(res.data || []);
    } catch (err) {
      console.error('Failed to load callback requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBotId) {
      fetchCallbacks();
    }
  }, [selectedBotId, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCallbacks();
  };

  const handleStatusChange = async (callbackId, newStatus) => {
    setUpdatingId(callbackId);
    try {
      await api.put(`/admin/callbacks/${callbackId}/status`, { status: newStatus });
      setCallbacks(prev =>
        prev.map(item => (item.id === callbackId ? { ...item, status: newStatus } : item))
      );
    } catch (err) {
      console.error('Failed to update callback status:', err);
      alert('Failed to update callback status');
    } finally {
      setUpdatingId(null);
    }
  };

  // Stats calculation
  const totalCount = callbacks.length;
  const pendingCount = callbacks.filter(c => c.status === 'pending').length;
  const contactedCount = callbacks.filter(c => c.status === 'contacted').length;
  const completedCount = callbacks.filter(c => c.status === 'completed').length;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Clock size={12} className="mr-1" /> Pending
          </span>
        );
      case 'contacted':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <PhoneForwarded size={12} className="mr-1" /> Contacted
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 size={12} className="mr-1" /> Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
            <XCircle size={12} className="mr-1" /> Cancelled
          </span>
        );
      default:
        return status;
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <PhoneCall className="mr-2 h-7 w-7 text-indigo-600 dark:text-indigo-400" />
              Callback Requests
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Review and manage incoming telephone callback inquiries from your chatbots.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Bot Selector */}
            <select
              value={selectedBotId}
              onChange={(e) => setSelectedBotId(e.target.value)}
              className="px-3.5 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {bots.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} (ID: {b.id})
                </option>
              ))}
            </select>

            <button
              onClick={fetchCallbacks}
              className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-300 hover:text-indigo-600 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xs">
            <span className="text-xs font-semibold text-gray-500 uppercase">Total Requests</span>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalCount}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xs">
            <span className="text-xs font-semibold text-amber-600 uppercase">Pending</span>
            <p className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xs">
            <span className="text-xs font-semibold text-blue-600 uppercase">Contacted</span>
            <p className="text-2xl font-bold text-blue-600 mt-1">{contactedCount}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xs">
            <span className="text-xs font-semibold text-emerald-600 uppercase">Completed</span>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{completedCount}</p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 mr-1 flex items-center">
              <Filter size={14} className="mr-1" /> Status:
            </span>
            {['', 'pending', 'contacted', 'completed', 'cancelled'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {st === '' ? 'All' : st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search phone number..."
                value={searchMobile}
                onChange={(e) => setSearchMobile(e.target.value)}
                className="w-56 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl py-1.5 pl-8 pr-3 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-medium transition-colors"
            >
              Search
            </button>
          </form>
        </div>

        {/* Callbacks Table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="py-20 flex justify-center items-center">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : callbacks.length === 0 ? (
            <div className="py-16 text-center">
              <PhoneCall className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">No callback requests found</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                When visitors click &quot;Request Call Back&quot; in the chatbot, they will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Visitor Mobile</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Brand / Service</th>
                    <th className="py-3.5 px-4">Received On</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Update Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                  {callbacks.map((cb) => (
                    <tr key={cb.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <Smartphone size={15} className="text-gray-400" />
                          <a
                            href={`tel:+91${cb.mobile}`}
                            className="font-bold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          >
                            +91 {cb.mobile}
                          </a>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-700 dark:text-gray-300 font-medium">
                        <div className="flex items-center space-x-1.5">
                          <Tag size={13} className="text-indigo-500 shrink-0" />
                          <span>{cb.ChatbotCategory?.name || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {cb.ChatbotItem?.name || 'N/A'}
                        </span>
                        {cb.ChatbotItem?.type && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 uppercase">
                            {cb.ChatbotItem.type}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-1.5">
                          <Calendar size={13} />
                          <span>{new Date(cb.createdAt).toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(cb.status)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <select
                          value={cb.status}
                          disabled={updatingId === cb.id}
                          onChange={(e) => handleStatusChange(cb.id, e.target.value)}
                          className="px-2.5 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
                        >
                          <option value="pending">Pending</option>
                          <option value="contacted">Contacted</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

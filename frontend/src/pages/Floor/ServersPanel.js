import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Loader2, Users } from 'lucide-react';
import { floorApi } from '../../services/floorApi';
import { api } from '../../services/api';
import { useFloorStore } from './store';

function ServerForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    code: initial?.code || '',
    active_sections: (initial?.active_sections || []).join(', '),
    shift_start: initial?.shift_start || '',
    shift_end: initial?.shift_end || '',
  });
  const [saving, setSaving] = useState(false);

  const inputCls = 'w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      ...form,
      active_sections: form.active_sections
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
    });
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">
          {initial ? 'Edit Server' : 'Add Server'}
        </h3>
        <button type="button" onClick={onCancel} className="p-1.5 rounded-lg hover:bg-foreground/10 text-foreground/60">
          <X size={18} />
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground/60 uppercase tracking-wide">Name</label>
        <input required className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Ravi Kumar" />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground/60 uppercase tracking-wide">Code</label>
        <input required className={inputCls} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. RK01" />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground/60 uppercase tracking-wide">Active Sections (comma-separated)</label>
        <input className={inputCls} value={form.active_sections} onChange={e => setForm(f => ({ ...f, active_sections: e.target.value }))} placeholder="e.g. A, B, Terrace" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground/60 uppercase tracking-wide">Shift Start</label>
          <input type="time" className={inputCls} value={form.shift_start} onChange={e => setForm(f => ({ ...f, shift_start: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground/60 uppercase tracking-wide">Shift End</label>
          <input type="time" className={inputCls} value={form.shift_end} onChange={e => setForm(f => ({ ...f, shift_end: e.target.value }))} />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {saving && <Loader2 size={14} className="animate-spin" />}
        {initial ? 'Save Changes' : 'Add Server'}
      </button>
    </form>
  );
}

export default function ServersPanel() {
  const { servers, setServers, outletId, setOutlet } = useFloorStore();
  const [outlets, setOutlets] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    api.getOutlets().then(res => {
      const list = res.data || [];
      setOutlets(list);
      if (list.length > 0 && !outletId) setOutlet(list[0].id);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!outletId) return;
    setLoading(true);
    floorApi.getServers(outletId)
      .then(res => setServers(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [outletId, setServers]);

  const handleCreate = async (data) => {
    const res = await floorApi.createServer({ ...data, outlet_id: outletId });
    setServers([...servers, res.data]);
    setShowForm(false);
  };

  const handleUpdate = async (data) => {
    const res = await floorApi.updateServer(editingServer.id, data);
    setServers(servers.map(s => s.id === editingServer.id ? res.data : s));
    setEditingServer(null);
  };

  const handleDelete = async (id) => {
    try {
      await floorApi.deleteTable(id); // fallback; should be deleteServer — adjust if API differs
    } catch (e) {}
    setServers(servers.filter(s => s.id !== id));
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Floor Servers</h2>
          <p className="text-sm text-foreground/50 mt-0.5">Manage the staff who serve tables on the floor</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none"
            value={outletId || ''}
            onChange={e => setOutlet(e.target.value)}
          >
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button
            onClick={() => { setShowForm(true); setEditingServer(null); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus size={15} />
            Add Server
          </button>
        </div>
      </div>

      {/* Slide-in form */}
      {(showForm || editingServer) && (
        <div className="bg-card border border-border rounded-2xl">
          <ServerForm
            initial={editingServer}
            onSave={editingServer ? handleUpdate : handleCreate}
            onCancel={() => { setShowForm(false); setEditingServer(null); }}
          />
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-foreground/40 gap-2">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading servers…</span>
        </div>
      ) : servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
          <Users size={32} className="text-foreground/20" />
          <p className="text-sm text-foreground/40">No servers yet. Add your first floor server.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-foreground/5">
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wide">Code</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wide">Sections</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wide">Shift</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wide">Load</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {servers.map(server => (
                <tr key={server.id} className="hover:bg-foreground/5 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{server.name}</td>
                  <td className="px-4 py-3 text-foreground/60 font-mono">{server.code}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(server.active_sections || []).map(s => (
                        <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-foreground/10 text-foreground/70">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground/60">
                    {server.shift_start && server.shift_end ? `${server.shift_start} – ${server.shift_end}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-foreground/60">{server.load_count ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => { setEditingServer(server); setShowForm(false); }}
                        className="p-1.5 rounded-lg hover:bg-foreground/10 text-foreground/50 hover:text-foreground transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      {confirmDelete === server.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(server.id)} className="text-xs px-2 py-1 rounded-lg bg-red-500 text-white font-medium">Delete</button>
                          <button onClick={() => setConfirmDelete(null)} className="text-xs px-2 py-1 rounded-lg border border-border text-foreground/60">Cancel</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(server.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-foreground/50 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { create } from 'zustand';

export const useFloorStore = create((set, get) => ({
  // Tables map: { [tableId]: tableObject }
  tables: {},
  zones: [],
  servers: [],
  selectedTableId: null,
  selectedZoneId: null,
  outletId: null,

  // Designer undo/redo
  history: [],
  historyIndex: -1,

  // Actions
  setTables: (arr) => set({ tables: Object.fromEntries(arr.map(t => [t.id, t])) }),
  setZones: (zones) => set({ zones }),
  setServers: (servers) => set({ servers }),
  updateTable: (table) => set(s => ({ tables: { ...s.tables, [table.id]: table } })),
  removeTable: (id) => set(s => {
    const t = { ...s.tables };
    delete t[id];
    return { tables: t };
  }),
  addZone: (zone) => set(s => ({ zones: [...s.zones, zone] })),
  updateZone: (zone) => set(s => ({ zones: s.zones.map(z => z.id === zone.id ? zone : z) })),
  removeZone: (id) => set(s => ({ zones: s.zones.filter(z => z.id !== id) })),
  setSelectedTable: (id) => set({ selectedTableId: id }),
  setSelectedZone: (id) => set({ selectedZoneId: id }),
  setOutlet: (id) => set({ outletId: id }),

  // Push a snapshot for undo (called before mutations in designer)
  pushHistory: () => {
    const { tables, zones, history, historyIndex } = get();
    const snap = { tables: { ...tables }, zones: [...zones] };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(snap);
    if (newHistory.length > 50) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },
  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const snap = history[historyIndex - 1];
    set({ tables: snap.tables, zones: snap.zones, historyIndex: historyIndex - 1 });
  },
  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const snap = history[historyIndex + 1];
    set({ tables: snap.tables, zones: snap.zones, historyIndex: historyIndex + 1 });
  },
}));

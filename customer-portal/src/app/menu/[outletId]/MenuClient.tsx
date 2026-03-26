'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  available: boolean;
  is_veg: boolean;
}

interface CartItem extends MenuItem {
  quantity: number;
}

// ─── Veg / Non-Veg Badge ─────────────────────────────────────
const VegBadge = ({ isVeg, size = 'md' }: { isVeg: boolean; size?: 'sm' | 'md' }) => {
  const s = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const d = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  return (
    <div className={`${s} border-2 rounded-sm flex items-center justify-center shrink-0 ${isVeg ? 'border-green-600 bg-white' : 'border-red-600 bg-white'}`}>
      <div className={`${d} rounded-full ${isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
    </div>
  );
};

// ─── Add / Quantity Control ──────────────────────────────────
const AddButton = ({ qty, onAdd, onRemove, primaryColor, size = 'md' }: { qty: number; onAdd: () => void; onRemove: () => void; primaryColor: string; size?: 'sm' | 'md' }) => {
  if (qty === 0) {
    return (
      <button
        onClick={onAdd}
        className={`${size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-5 py-2 text-sm'} rounded-xl font-bold border-2 transition-all hover:scale-105 active:scale-95`}
        style={{ borderColor: primaryColor, color: primaryColor, backgroundColor: `${primaryColor}08` }}
      >
        ADD
      </button>
    );
  }
  return (
    <div className="flex items-center gap-0 rounded-xl overflow-hidden shadow-md" style={{ backgroundColor: primaryColor }}>
      <button onClick={onRemove} className={`${size === 'sm' ? 'w-7 h-7 text-base' : 'w-9 h-9 text-xl'} flex items-center justify-center text-white font-bold hover:bg-black/10 transition-colors`}>−</button>
      <span className={`${size === 'sm' ? 'w-6 text-xs' : 'w-8 text-base'} text-center text-white font-black`}>{qty}</span>
      <button onClick={onAdd} className={`${size === 'sm' ? 'w-7 h-7 text-base' : 'w-9 h-9 text-xl'} flex items-center justify-center text-white font-bold hover:bg-black/10 transition-colors`}>+</button>
    </div>
  );
};

// ─── Classic Card ────────────────────────────────────────────
const ClassicCard = ({ item, qty, onAdd, onRemove, primaryColor, BACKEND }: any) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-4 hover:shadow-lg hover:border-gray-200 transition-all group">
    <div className="w-28 h-28 rounded-xl overflow-hidden shrink-0 bg-gray-100 relative">
      {item.image_url ? (
        <img src={item.image_url.startsWith('/') ? `${BACKEND}${item.image_url}` : item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">🍽️</div>
      )}
      <div className="absolute top-1.5 left-1.5"><VegBadge isVeg={item.is_veg} /></div>
    </div>
    <div className="flex-1 flex flex-col justify-between min-w-0">
      <div>
        <h3 className="font-bold text-gray-900 text-base leading-tight truncate">{item.name}</h3>
        {item.description && <p className="text-gray-400 text-xs mt-1 line-clamp-2 leading-relaxed">{item.description}</p>}
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="font-black text-lg" style={{ color: primaryColor }}>₹{item.price}</span>
        <AddButton qty={qty} onAdd={() => onAdd(item)} onRemove={() => onRemove(item.id)} primaryColor={primaryColor} />
      </div>
    </div>
  </div>
);

// ─── Compact Row ─────────────────────────────────────────────
const CompactRow = ({ item, qty, onAdd, onRemove, primaryColor }: any) => (
  <div className="flex items-center justify-between py-3 px-4 bg-white border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <VegBadge isVeg={item.is_veg} size="sm" />
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 text-sm truncate">{item.name}</h3>
        {item.description && <p className="text-gray-400 text-[11px] truncate mt-0.5">{item.description}</p>}
      </div>
    </div>
    <div className="flex items-center gap-4 shrink-0 ml-3">
      <span className="font-black text-sm" style={{ color: primaryColor }}>₹{item.price}</span>
      <AddButton qty={qty} onAdd={() => onAdd(item)} onRemove={() => onRemove(item.id)} primaryColor={primaryColor} size="sm" />
    </div>
  </div>
);

// ─── Grid Tile ───────────────────────────────────────────────
const GridTile = ({ item, qty, onAdd, onRemove, primaryColor, BACKEND }: any) => (
  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:border-gray-200 transition-all group">
    <div className="aspect-square relative overflow-hidden bg-gray-100">
      {item.image_url ? (
        <img src={item.image_url.startsWith('/') ? `${BACKEND}${item.image_url}` : item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-5xl opacity-15 bg-gradient-to-b from-gray-50 to-gray-100">🍽️</div>
      )}
      <div className="absolute top-2 left-2"><VegBadge isVeg={item.is_veg} /></div>
      {/* Quick add overlay */}
      <div className="absolute bottom-2 right-2">
        <AddButton qty={qty} onAdd={() => onAdd(item)} onRemove={() => onRemove(item.id)} primaryColor={primaryColor} size="sm" />
      </div>
    </div>
    <div className="p-3">
      <h3 className="font-bold text-gray-900 text-sm truncate">{item.name}</h3>
      {item.description && <p className="text-gray-400 text-[11px] truncate mt-0.5">{item.description}</p>}
      <p className="font-black text-base mt-1.5" style={{ color: primaryColor }}>₹{item.price}</p>
    </div>
  </div>
);

// ─── Accordion Category ─────────────────────────────────────
const AccordionCategory = ({ cat, items, getCartQuantity, addToCart, removeFromCart, primaryColor, BACKEND, defaultOpen }: any) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-6 rounded-full" style={{ backgroundColor: primaryColor }} />
          <h2 className="font-black text-gray-800 text-base">{cat}</h2>
          <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{items.length}</span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-gray-50">
          {items.map((item: MenuItem) => {
            const qty = getCartQuantity(item.id);
            return (
              <div key={item.id} className="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50/30 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <VegBadge isVeg={item.is_veg} size="sm" />
                  {item.image_url && (
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                      <img src={item.image_url.startsWith('/') ? `${BACKEND}${item.image_url}` : item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{item.name}</h3>
                    {item.description && <p className="text-gray-400 text-[11px] truncate">{item.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 ml-3">
                  <span className="font-black text-sm" style={{ color: primaryColor }}>₹{item.price}</span>
                  <AddButton qty={qty} onAdd={() => addToCart(item)} onRemove={() => removeFromCart(item.id)} primaryColor={primaryColor} size="sm" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ═══════════════════ MAIN COMPONENT ═══════════════════
export default function MenuClient({
  outletId,
  outlet,
  company,
  categories,
  items,
}: {
  outletId: string;
  outlet: any;
  company: any;
  categories: Record<string, MenuItem[]>;
  items: MenuItem[];
}) {
  const [search, setSearch] = useState('');
  const [vegFilter, setVegFilter] = useState<'all' | 'veg' | 'nonveg'>('all');
  const [activeCategory, setActiveCategory] = useState(Object.keys(categories)[0] || '');
  const [cart, setCart] = useState<CartItem[]>([]);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const categoryNavRef = useRef<HTMLDivElement>(null);

  const colors = outlet?.portal_color_scheme || {};
  const primaryColor = colors.primary || '#1A1A1A';
  const accentColor = colors.secondary || '#F59E0B';
  const menuLayout = colors.menuLayout || 'classic';

  // Filter items
  const filteredCategories: Record<string, MenuItem[]> = {};
  for (const [cat, catItems] of Object.entries(categories)) {
    const filtered = (catItems as MenuItem[]).filter((item) => {
      const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
      const matchVeg =
        vegFilter === 'all' ||
        (vegFilter === 'veg' && item.is_veg) ||
        (vegFilter === 'nonveg' && !item.is_veg);
      return matchSearch && matchVeg && item.available;
    });
    if (filtered.length > 0) filteredCategories[cat] = filtered;
  }

  const categoryNames = Object.keys(filteredCategories);

  // Scroll to category
  const scrollToCategory = (cat: string) => {
    setActiveCategory(cat);
    categoryRefs.current[cat]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Cart operations
  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) return prev.map((c) => (c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === itemId);
      if (!existing) return prev;
      if (existing.quantity <= 1) return prev.filter((c) => c.id !== itemId);
      return prev.map((c) => (c.id === itemId ? { ...c, quantity: c.quantity - 1 } : c));
    });
  };

  const getCartQuantity = (itemId: string) => cart.find((c) => c.id === itemId)?.quantity || 0;
  const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);
  const totalPrice = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  // Intersection observer for active category (not used in accordion mode)
  useEffect(() => {
    if (menuLayout === 'accordion') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveCategory(entry.target.getAttribute('data-category') || '');
          }
        }
      },
      { rootMargin: '-120px 0px -60% 0px', threshold: 0.1 }
    );

    for (const ref of Object.values(categoryRefs.current)) {
      if (ref) observer.observe(ref);
    }
    return () => observer.disconnect();
  }, [filteredCategories, menuLayout]);

  // Save cart to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(`cart_${outletId}`, JSON.stringify(cart));
  }, [cart, outletId]);

  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  // Grid classes per layout
  const gridClass = menuLayout === 'grid'
    ? 'grid grid-cols-2 md:grid-cols-3 gap-3'
    : menuLayout === 'compact'
    ? 'divide-y divide-gray-50 bg-white rounded-2xl border border-gray-100 overflow-hidden'
    : 'grid grid-cols-1 md:grid-cols-2 gap-4';

  return (
    <div className="min-h-screen bg-[#FAFAFA]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Hero Header */}
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` }}>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvc3ZnPg==')] opacity-50" />
        <div className="relative container mx-auto px-4 py-8 md:py-12">
          <div className="flex items-center gap-4 mb-4">
            {outlet?.portal_logo_url && (
              <img
                src={outlet.portal_logo_url.startsWith('/') ? `${BACKEND}${outlet.portal_logo_url}` : outlet.portal_logo_url}
                alt="Logo"
                className="w-14 h-14 rounded-2xl bg-white p-1.5 shadow-lg object-contain"
              />
            )}
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">{company?.name || 'Restaurant'}</h1>
              <p className="text-white/60 text-sm font-medium mt-0.5">{outlet?.location || ''}</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mt-6 max-w-xl">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search for dishes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 text-base font-medium transition-all"
            />
          </div>

          {/* Veg/Non-Veg Filter */}
          <div className="flex gap-2 mt-4">
            {[
              { key: 'all' as const, label: 'All' },
              { key: 'veg' as const, label: '🟢 Veg' },
              { key: 'nonveg' as const, label: '🔴 Non-Veg' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setVegFilter(f.key)}
                className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                  vegFilter === f.key
                    ? 'bg-white text-gray-900 shadow-lg scale-105'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky Category Navigation (hidden for accordion) */}
      {menuLayout !== 'accordion' && (
        <div className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
          <div
            ref={categoryNavRef}
            className="container mx-auto px-4 flex gap-1 overflow-x-auto py-3 scrollbar-hide"
            style={{ scrollbarWidth: 'none' }}
          >
            {categoryNames.map((cat) => (
              <button
                key={cat}
                onClick={() => scrollToCategory(cat)}
                className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all shrink-0 ${
                  activeCategory === cat
                    ? 'text-white shadow-md scale-105'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
                style={activeCategory === cat ? { backgroundColor: primaryColor } : {}}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Menu Items */}
      <div className="container mx-auto px-4 py-6 pb-32">
        {categoryNames.length === 0 && (
          <div className="text-center py-20">
            <p className="text-2xl font-bold text-gray-300">No items found</p>
            <p className="text-gray-400 mt-2">Try adjusting your search or filters</p>
          </div>
        )}

        {/* ─── ACCORDION LAYOUT ─── */}
        {menuLayout === 'accordion' ? (
          <div className="space-y-3">
            {categoryNames.map((cat, idx) => (
              <AccordionCategory
                key={cat}
                cat={cat}
                items={filteredCategories[cat]}
                getCartQuantity={getCartQuantity}
                addToCart={addToCart}
                removeFromCart={removeFromCart}
                primaryColor={primaryColor}
                BACKEND={BACKEND}
                defaultOpen={idx === 0}
              />
            ))}
          </div>
        ) : (
          /* ─── CLASSIC / COMPACT / GRID LAYOUTS ─── */
          categoryNames.map((cat) => (
            <div
              key={cat}
              ref={(el) => { categoryRefs.current[cat] = el; }}
              data-category={cat}
              className="mb-8 scroll-mt-20"
            >
              <h2 className="text-xl font-black text-gray-800 mb-4 flex items-center gap-3">
                <span className="w-1.5 h-8 rounded-full" style={{ backgroundColor: primaryColor }} />
                {cat}
                <span className="text-sm font-medium text-gray-400 ml-1">
                  ({filteredCategories[cat].length})
                </span>
              </h2>

              <div className={gridClass}>
                {filteredCategories[cat].map((item) => {
                  const qty = getCartQuantity(item.id);

                  if (menuLayout === 'compact') {
                    return <CompactRow key={item.id} item={item} qty={qty} onAdd={addToCart} onRemove={removeFromCart} primaryColor={primaryColor} />;
                  }
                  if (menuLayout === 'grid') {
                    return <GridTile key={item.id} item={item} qty={qty} onAdd={addToCart} onRemove={removeFromCart} primaryColor={primaryColor} BACKEND={BACKEND} />;
                  }
                  // Classic (default)
                  return <ClassicCard key={item.id} item={item} qty={qty} onAdd={addToCart} onRemove={removeFromCart} primaryColor={primaryColor} BACKEND={BACKEND} />;
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Sticky Cart Bar */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
          <Link href={`/menu/${outletId}/cart`}>
            <div
              className="container mx-auto max-w-2xl flex items-center justify-between px-6 py-4 rounded-2xl text-white shadow-2xl cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform"
              style={{ backgroundColor: primaryColor }}
            >
              <div className="flex items-center gap-3">
                <div className="bg-white/20 px-3 py-1.5 rounded-xl text-sm font-black">{totalItems} item{totalItems > 1 ? 's' : ''}</div>
                <span className="font-bold text-lg">₹{totalPrice.toFixed(0)}</span>
              </div>
              <div className="flex items-center gap-2 font-bold text-lg">
                View Cart
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}

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
  image_urls: string[];
  icon: string | null;
  available: boolean;
  is_veg: boolean;
}

interface CategoryInfo {
  name: string;
  icon: string | null;
  display_order: number;
}

interface CartItem extends MenuItem {
  quantity: number;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

// ─── Resolve display image/icon for a menu item ──────────────────────────────
// Priority: item photo > item icon > category icon
function resolveItemVisual(item: MenuItem, catIcon?: string | null): { type: 'img'; src: string } | { type: 'emoji'; value: string } | null {
  // 1. Item has uploaded photo
  const photo = item.image_urls?.[0] || item.image_url;
  if (photo) {
    const src = photo.startsWith('/') ? `${BACKEND_URL}${photo}` : photo;
    return { type: 'img', src };
  }
  // 2. Item has an icon
  if (item.icon) {
    if (item.icon.startsWith('/') || item.icon.startsWith('http')) {
      const src = item.icon.startsWith('/') ? `${BACKEND_URL}${item.icon}` : item.icon;
      return { type: 'img', src };
    }
    return { type: 'emoji', value: item.icon };
  }
  // 3. Category icon
  if (catIcon) {
    if (catIcon.startsWith('/') || catIcon.startsWith('http')) {
      const src = catIcon.startsWith('/') ? `${BACKEND_URL}${catIcon}` : catIcon;
      return { type: 'img', src };
    }
    return { type: 'emoji', value: catIcon };
  }
  return null;
}

// ─── Category icon display ────────────────────────────────────────────────────
const CatIcon = ({ icon, size = 20 }: { icon: string | null; size?: number }) => {
  if (!icon) return null;
  if (icon.startsWith('/') || icon.startsWith('http')) {
    const src = icon.startsWith('/') ? `${BACKEND_URL}${icon}` : icon;
    return <img src={src} alt="" style={{ width: size, height: size }} className="object-cover rounded-md shrink-0" />;
  }
  return <span style={{ fontSize: size * 0.9, lineHeight: 1 }}>{icon}</span>;
};

// ─── Veg / Non-Veg Badge ─────────────────────────────────────────────────────
const VegBadge = ({ isVeg, size = 'md' }: { isVeg: boolean; size?: 'sm' | 'md' }) => {
  const s = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const d = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  return (
    <div className={`${s} border-2 rounded-sm flex items-center justify-center shrink-0 ${isVeg ? 'border-green-600 bg-white' : 'border-red-600 bg-white'}`}>
      <div className={`${d} rounded-full ${isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
    </div>
  );
};

// ─── Add / Quantity Control ──────────────────────────────────────────────────
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

// ─── Visual slot (shared by all card types) ───────────────────────────────────
const ItemVisual = ({ visual, name, size = 'md' }: { visual: ReturnType<typeof resolveItemVisual>; name: string; size?: 'sm' | 'md' | 'lg' }) => {
  const dim = size === 'lg' ? 'w-28 h-28' : size === 'md' ? 'w-20 h-20' : 'w-10 h-10';
  const emojiSize = size === 'lg' ? 'text-5xl' : size === 'md' ? 'text-4xl' : 'text-2xl';
  return (
    <div className={`${dim} rounded-xl overflow-hidden shrink-0 bg-gray-100 relative`}>
      {visual?.type === 'img' ? (
        <img src={visual.src} alt={name} className="w-full h-full object-cover" />
      ) : visual?.type === 'emoji' ? (
        <div className={`w-full h-full flex items-center justify-center ${emojiSize}`}>{visual.value}</div>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">🍽️</div>
      )}
    </div>
  );
};

// ─── Classic Card ────────────────────────────────────────────────────────────
const ClassicCard = ({ item, qty, onAdd, onRemove, primaryColor, secondaryColor, textColor, catIcon }: any) => {
  const visual = resolveItemVisual(item, catIcon);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-4 hover:shadow-lg hover:border-gray-200 transition-all group">
      <div className="relative shrink-0">
        <ItemVisual visual={visual} name={item.name} size="lg" />
        <div className="absolute top-1.5 left-1.5"><VegBadge isVeg={item.is_veg} /></div>
      </div>
      <div className="flex-1 flex flex-col justify-between min-w-0">
        <div>
          <h3 className="font-bold text-base leading-tight truncate" style={{ color: textColor }}>{item.name}</h3>
          {item.description && <p className="text-xs mt-1 line-clamp-2 leading-relaxed" style={{ color: textColor, opacity: 0.5 }}>{item.description}</p>}
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="font-black text-lg" style={{ color: secondaryColor }}>₹{item.price}</span>
          <AddButton qty={qty} onAdd={() => onAdd(item)} onRemove={() => onRemove(item.id)} primaryColor={primaryColor} />
        </div>
      </div>
    </div>
  );
};

// ─── Compact Row ─────────────────────────────────────────────────────────────
const CompactRow = ({ item, qty, onAdd, onRemove, primaryColor, secondaryColor, textColor, catIcon }: any) => {
  const visual = resolveItemVisual(item, catIcon);
  return (
    <div className="flex items-center justify-between py-3 px-4 bg-white border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <VegBadge isVeg={item.is_veg} size="sm" />
        {visual && <ItemVisual visual={visual} name={item.name} size="sm" />}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate" style={{ color: textColor }}>{item.name}</h3>
          {item.description && <p className="text-[11px] truncate mt-0.5" style={{ color: textColor, opacity: 0.5 }}>{item.description}</p>}
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0 ml-3">
        <span className="font-black text-sm" style={{ color: secondaryColor }}>₹{item.price}</span>
        <AddButton qty={qty} onAdd={() => onAdd(item)} onRemove={() => onRemove(item.id)} primaryColor={primaryColor} size="sm" />
      </div>
    </div>
  );
};

// ─── Grid Tile ───────────────────────────────────────────────────────────────
const GridTile = ({ item, qty, onAdd, onRemove, primaryColor, secondaryColor, textColor, catIcon }: any) => {
  const visual = resolveItemVisual(item, catIcon);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:border-gray-200 transition-all group">
      <div className="aspect-square relative overflow-hidden bg-gray-100">
        {visual?.type === 'img' ? (
          <img src={visual.src} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        ) : visual?.type === 'emoji' ? (
          <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-b from-gray-50 to-gray-100">{visual.value}</div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl opacity-15 bg-gradient-to-b from-gray-50 to-gray-100">🍽️</div>
        )}
        <div className="absolute top-2 left-2"><VegBadge isVeg={item.is_veg} /></div>
        <div className="absolute bottom-2 right-2">
          <AddButton qty={qty} onAdd={() => onAdd(item)} onRemove={() => onRemove(item.id)} primaryColor={primaryColor} size="sm" />
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-bold text-sm truncate" style={{ color: textColor }}>{item.name}</h3>
        {item.description && <p className="text-[11px] truncate mt-0.5" style={{ color: textColor, opacity: 0.5 }}>{item.description}</p>}
        <p className="font-black text-base mt-1.5" style={{ color: secondaryColor }}>₹{item.price}</p>
      </div>
    </div>
  );
};

// ─── Accordion Category ─────────────────────────────────────────────────────
const AccordionCategory = ({ cat, catIcon, items, getCartQuantity, addToCart, removeFromCart, primaryColor, secondaryColor, textColor, defaultOpen }: any) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        border: `1px solid ${open ? primaryColor + '40' : '#F3F4F6'}`,
        boxShadow: open ? `0 4px 20px ${primaryColor}18` : 'none',
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 transition-colors"
        style={{ backgroundColor: open ? `${primaryColor}0D` : '#FFFFFF' }}
      >
        <div className="flex items-center gap-3">
          {catIcon ? (
            <CatIcon icon={catIcon} size={22} />
          ) : (
            <span className="w-1.5 h-6 rounded-full" style={{ backgroundColor: primaryColor }} />
          )}
          <h2 className="font-black text-base" style={{ color: open ? primaryColor : textColor }}>{cat}</h2>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full transition-colors"
            style={{
              backgroundColor: open ? `${primaryColor}18` : '#F3F4F6',
              color: open ? primaryColor : '#9CA3AF',
            }}
          >
            {items.length}
          </span>
        </div>
        <svg
          className={`w-5 h-5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          style={{ color: open ? primaryColor : '#9CA3AF' }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${primaryColor}20` }}>
          {items.map((item: MenuItem) => {
            const qty = getCartQuantity(item.id);
            const visual = resolveItemVisual(item, catIcon);
            return (
              <div
                key={item.id}
                className="flex items-center justify-between px-5 py-3 last:border-b-0 transition-colors"
                style={{ borderBottom: `1px solid ${primaryColor}10`, backgroundColor: '#FFFFFF' }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <VegBadge isVeg={item.is_veg} size="sm" />
                  {visual && <ItemVisual visual={visual} name={item.name} size="sm" />}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate" style={{ color: textColor }}>{item.name}</h3>
                    {item.description && <p className="text-[11px] truncate" style={{ color: textColor, opacity: 0.5 }}>{item.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 ml-3">
                  <span className="font-black text-sm" style={{ color: secondaryColor }}>₹{item.price}</span>
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
  category_info,
  items,
}: {
  outletId: string;
  outlet: any;
  company: any;
  categories: Record<string, MenuItem[]>;
  category_info?: CategoryInfo[];
  items: MenuItem[];
}) {
  const [search, setSearch] = useState('');
  const [vegFilter, setVegFilter] = useState<'all' | 'veg' | 'nonveg'>('all');
  const [activeCategory, setActiveCategory] = useState(Object.keys(categories)[0] || '');
  const [cart, setCart] = useState<CartItem[]>([]);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const categoryNavRef = useRef<HTMLDivElement>(null);

  // Build category icon lookup
  const catIconMap: Record<string, string | null> = {};
  if (category_info) {
    for (const ci of category_info) catIconMap[ci.name] = ci.icon;
  }

  const colors = outlet?.portal_color_scheme || {};
  const primaryColor = colors.primary || '#1A1A1A';
  const secondaryColor = colors.secondary || colors.primary || '#F59E0B';
  const bgColor = colors.bgColor || '#FAFAFA';
  const textColor = colors.textColor || '#1A1A1A';
  const fontFamily = colors.fontFamily || 'Inter';
  const menuLayout = colors.menuLayout || 'classic';
  const heroImageUrl = colors.heroImage
    ? (colors.heroImage.startsWith('/') ? `${BACKEND_URL}${colors.heroImage}` : colors.heroImage)
    : null;

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

  // Intersection observer for active category
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

  const gridClass = menuLayout === 'grid'
    ? 'grid grid-cols-2 md:grid-cols-3 gap-3'
    : menuLayout === 'compact'
    ? 'divide-y divide-gray-50 bg-white rounded-2xl border border-gray-100 overflow-hidden'
    : 'grid grid-cols-1 md:grid-cols-2 gap-4';

  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor, fontFamily: `${fontFamily}, system-ui, sans-serif` }}>
      {/* Font import */}
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@300;400;500;600;700;900&display=swap');` }} />

      {/* Hero Header */}
      <div className="relative overflow-hidden">
        {heroImageUrl ? (
          <>
            <img src={heroImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primaryColor}E6, ${primaryColor}B3)` }} />
          </>
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` }} />
        )}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvc3ZnPg==')] opacity-50" />
        <div className="relative container mx-auto px-4 py-8 md:py-12">
          <div className="flex items-center gap-4 mb-4">
            {outlet?.portal_logo_url && (
              <img
                src={outlet.portal_logo_url.startsWith('/') ? `${BACKEND_URL}${outlet.portal_logo_url}` : outlet.portal_logo_url}
                alt="Logo"
                className="w-14 h-14 rounded-2xl object-cover"
                style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.35))' }}
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
            {categoryNames.map((cat) => {
              const icon = catIconMap[cat];
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => scrollToCategory(cat)}
                  className={`whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all shrink-0 ${
                    isActive ? 'text-white shadow-md scale-105' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                  style={isActive ? { backgroundColor: primaryColor } : {}}
                >
                  {icon && (
                    icon.startsWith('/') || icon.startsWith('http')
                      ? <img src={icon.startsWith('/') ? `${BACKEND_URL}${icon}` : icon} alt="" className="w-4 h-4 rounded object-cover" />
                      : <span className="text-base leading-none">{icon}</span>
                  )}
                  {cat}
                </button>
              );
            })}
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
                catIcon={catIconMap[cat] ?? null}
                items={filteredCategories[cat]}
                getCartQuantity={getCartQuantity}
                addToCart={addToCart}
                removeFromCart={removeFromCart}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                textColor={textColor}
                defaultOpen={idx === 0}
              />
            ))}
          </div>
        ) : (
          /* ─── CLASSIC / COMPACT / GRID LAYOUTS ─── */
          categoryNames.map((cat) => {
            const catIcon = catIconMap[cat] ?? null;
            return (
              <div
                key={cat}
                ref={(el) => { categoryRefs.current[cat] = el; }}
                data-category={cat}
                className="mb-8 scroll-mt-20"
              >
                <h2 className="text-xl font-black mb-4 flex items-center gap-3" style={{ color: textColor }}>
                  {catIcon ? (
                    <CatIcon icon={catIcon} size={24} />
                  ) : (
                    <span className="w-1.5 h-8 rounded-full inline-block" style={{ backgroundColor: primaryColor }} />
                  )}
                  {cat}
                  <span className="text-sm font-medium text-gray-400 ml-1">
                    ({filteredCategories[cat].length})
                  </span>
                </h2>

                <div className={gridClass}>
                  {filteredCategories[cat].map((item) => {
                    const qty = getCartQuantity(item.id);
                    if (menuLayout === 'compact') {
                      return <CompactRow key={item.id} item={item} qty={qty} onAdd={addToCart} onRemove={removeFromCart} primaryColor={primaryColor} secondaryColor={secondaryColor} textColor={textColor} catIcon={catIcon} />;
                    }
                    if (menuLayout === 'grid') {
                      return <GridTile key={item.id} item={item} qty={qty} onAdd={addToCart} onRemove={removeFromCart} primaryColor={primaryColor} secondaryColor={secondaryColor} textColor={textColor} catIcon={catIcon} />;
                    }
                    return <ClassicCard key={item.id} item={item} qty={qty} onAdd={addToCart} onRemove={removeFromCart} primaryColor={primaryColor} secondaryColor={secondaryColor} textColor={textColor} catIcon={catIcon} />;
                  })}
                </div>
              </div>
            );
          })
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

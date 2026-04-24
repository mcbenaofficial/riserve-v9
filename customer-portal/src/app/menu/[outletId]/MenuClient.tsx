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
function resolveItemVisual(item: MenuItem, catIcon?: string | null): { type: 'img'; src: string } | { type: 'emoji'; value: string } | null {
  const photo = item.image_urls?.[0] || item.image_url;
  if (photo) {
    const src = photo.startsWith('/') ? `${BACKEND_URL}${photo}` : photo;
    return { type: 'img', src };
  }
  if (item.icon) {
    if (item.icon.startsWith('/') || item.icon.startsWith('http')) {
      const src = item.icon.startsWith('/') ? `${BACKEND_URL}${item.icon}` : item.icon;
      return { type: 'img', src };
    }
    return { type: 'emoji', value: item.icon };
  }
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
    <div className={`${s} border-2 rounded-sm flex items-center justify-center shrink-0 ${isVeg ? 'border-green-500' : 'border-red-500'}`}
      style={{ background: 'rgba(255,255,255,0.9)' }}>
      <div className={`${d} rounded-full ${isVeg ? 'bg-green-500' : 'bg-red-500'}`} />
    </div>
  );
};

// ─── Add / Quantity Control ──────────────────────────────────────────────────
const AddButton = ({ qty, onAdd, onRemove, primaryColor, size = 'md' }: {
  qty: number; onAdd: () => void; onRemove: () => void; primaryColor: string; size?: 'sm' | 'md';
}) => {
  if (qty === 0) {
    return (
      <button
        onClick={onAdd}
        className={`${size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-5 py-2 text-sm'} rounded-xl font-bold border-2 transition-all hover:scale-105 active:scale-95`}
        style={{
          borderColor: primaryColor,
          color: primaryColor,
          background: `${primaryColor}12`,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        ADD
      </button>
    );
  }
  return (
    <div className="flex items-center rounded-xl overflow-hidden shadow-lg" style={{ backgroundColor: primaryColor }}>
      <button onClick={onRemove} className={`${size === 'sm' ? 'w-7 h-7 text-base' : 'w-9 h-9 text-xl'} flex items-center justify-center text-white font-bold hover:bg-black/15 transition-colors`}>−</button>
      <span className={`${size === 'sm' ? 'w-6 text-xs' : 'w-8 text-base'} text-center text-white font-black`}>{qty}</span>
      <button onClick={onAdd} className={`${size === 'sm' ? 'w-7 h-7 text-base' : 'w-9 h-9 text-xl'} flex items-center justify-center text-white font-bold hover:bg-black/15 transition-colors`}>+</button>
    </div>
  );
};

// ─── Visual slot (shared by all card types) ───────────────────────────────────
const ItemVisual = ({ visual, name, size = 'md' }: {
  visual: ReturnType<typeof resolveItemVisual>; name: string; size?: 'sm' | 'md' | 'lg';
}) => {
  const dim = size === 'lg' ? 'w-28 h-28' : size === 'md' ? 'w-20 h-20' : 'w-10 h-10';
  const emojiSize = size === 'lg' ? 'text-5xl' : size === 'md' ? 'text-4xl' : 'text-2xl';
  return (
    <div className={`${dim} rounded-xl overflow-hidden shrink-0 relative`}
      style={{ background: 'rgba(128,128,128,0.12)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
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

// ─── Glass surface helper ─────────────────────────────────────────────────────
const glass = (surfaceColor: string, opacity = 'CC', blur = '12px') => ({
  backgroundColor: `${surfaceColor}${opacity}`,
  backdropFilter: `blur(${blur})`,
  WebkitBackdropFilter: `blur(${blur})`,
});

// ─── Classic Card ─────────────────────────────────────────────────────────────
const ClassicCard = ({ item, qty, onAdd, onRemove, primaryColor, secondaryColor, textColor, surfaceColor, catIcon }: any) => {
  const visual = resolveItemVisual(item, catIcon);
  return (
    <div
      className="rounded-2xl p-4 flex gap-4 hover:shadow-xl transition-all duration-300 group"
      style={{
        ...glass(surfaceColor, 'D8'),
        border: `1px solid rgba(255,255,255,0.28)`,
        boxShadow: `0 2px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)`,
      }}
    >
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
const CompactRow = ({ item, qty, onAdd, onRemove, primaryColor, secondaryColor, textColor, surfaceColor, catIcon }: any) => {
  const visual = resolveItemVisual(item, catIcon);
  return (
    <div
      className="flex items-center justify-between py-3 px-4 transition-colors group"
      style={{
        borderBottom: `1px solid rgba(255,255,255,0.12)`,
      }}
    >
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

// ─── Grid Tile ────────────────────────────────────────────────────────────────
const GridTile = ({ item, qty, onAdd, onRemove, primaryColor, secondaryColor, textColor, surfaceColor, catIcon }: any) => {
  const visual = resolveItemVisual(item, catIcon);
  return (
    <div
      className="rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300 group hover:-translate-y-0.5"
      style={{
        ...glass(surfaceColor, 'D8'),
        border: `1px solid rgba(255,255,255,0.28)`,
        boxShadow: `0 2px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)`,
      }}
    >
      <div className="aspect-square relative overflow-hidden" style={{ background: 'rgba(128,128,128,0.10)' }}>
        {visual?.type === 'img' ? (
          <img src={visual.src} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        ) : visual?.type === 'emoji' ? (
          <div className="w-full h-full flex items-center justify-center text-6xl">{visual.value}</div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl opacity-15">🍽️</div>
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

// ─── Accordion Category ───────────────────────────────────────────────────────
const AccordionCategory = ({ cat, catIcon, items, getCartQuantity, addToCart, removeFromCart, primaryColor, secondaryColor, textColor, bgColor, surfaceColor, defaultOpen }: any) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        ...(open ? glass(surfaceColor, 'E0', '16px') : glass(bgColor, 'B0', '8px')),
        border: `1px solid ${open ? `rgba(255,255,255,0.30)` : `rgba(255,255,255,0.14)`}`,
        boxShadow: open
          ? `0 8px 32px ${primaryColor}18, inset 0 1px 0 rgba(255,255,255,0.4)`
          : `0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.2)`,
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 transition-all"
        style={{ background: open ? `${primaryColor}0D` : 'transparent' }}
      >
        <div className="flex items-center gap-3">
          {catIcon ? (
            <CatIcon icon={catIcon} size={22} />
          ) : (
            <span className="w-1.5 h-6 rounded-full transition-colors" style={{ backgroundColor: open ? primaryColor : `${textColor}30` }} />
          )}
          <h2 className="font-black text-base transition-colors" style={{ color: open ? primaryColor : textColor }}>{cat}</h2>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full transition-colors"
            style={{
              backgroundColor: open ? `${primaryColor}18` : `rgba(255,255,255,0.15)`,
              color: open ? primaryColor : `${textColor}70`,
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          >
            {items.length}
          </span>
        </div>
        <svg
          className={`w-5 h-5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          style={{ color: open ? primaryColor : `${textColor}50` }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div style={{ borderTop: `1px solid rgba(255,255,255,0.15)` }}>
          {items.map((item: MenuItem) => {
            const qty = getCartQuantity(item.id);
            const visual = resolveItemVisual(item, catIcon);
            return (
              <div
                key={item.id}
                className="flex items-center justify-between px-5 py-3 last:border-b-0 transition-colors"
                style={{ borderBottom: `1px solid rgba(255,255,255,0.08)` }}
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

  const catIconMap: Record<string, string | null> = {};
  if (category_info) {
    for (const ci of category_info) catIconMap[ci.name] = ci.icon;
  }

  const colors = outlet?.portal_color_scheme || {};
  const primaryColor = colors.primary || '#1A1A1A';
  const secondaryColor = colors.secondary || colors.primary || '#F59E0B';
  const bgColor = colors.bgColor || '#FAFAFA';
  const surfaceColor = colors.surfaceColor || '#FFFFFF';
  const textColor = colors.textColor || '#1A1A1A';
  const fontFamily = colors.fontFamily || 'Inter';
  const menuLayout = colors.menuLayout || 'classic';
  const heroImageUrl = colors.heroImage
    ? (colors.heroImage.startsWith('/') ? `${BACKEND_URL}${colors.heroImage}` : colors.heroImage)
    : null;

  // Persist color scheme for cart page
  useEffect(() => {
    sessionStorage.setItem(`colors_${outletId}`, JSON.stringify(colors));
  }, [outletId]);

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

  const scrollToCategory = (cat: string) => {
    setActiveCategory(cat);
    categoryRefs.current[cat]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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

  useEffect(() => {
    if (menuLayout === 'accordion') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveCategory(entry.target.getAttribute('data-category') || '');
        }
      },
      { rootMargin: '-120px 0px -60% 0px', threshold: 0.1 }
    );
    for (const ref of Object.values(categoryRefs.current)) {
      if (ref) observer.observe(ref);
    }
    return () => observer.disconnect();
  }, [filteredCategories, menuLayout]);

  useEffect(() => {
    sessionStorage.setItem(`cart_${outletId}`, JSON.stringify(cart));
  }, [cart, outletId]);

  const gridClass = menuLayout === 'grid'
    ? 'grid grid-cols-2 md:grid-cols-3 gap-3'
    : menuLayout === 'compact'
    ? 'rounded-2xl overflow-hidden'
    : 'grid grid-cols-1 md:grid-cols-2 gap-4';

  return (
    <div className="min-h-screen" style={{ fontFamily: `${fontFamily}, system-ui, sans-serif` }}>
      {/* Font import */}
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@300;400;500;600;700;900&display=swap');` }} />

      {/* ── Fixed glassmorphism background layer ── */}
      <div className="fixed inset-0 -z-10 overflow-hidden" style={{ backgroundColor: bgColor }}>
        {/* Primary blob — top right */}
        <div
          className="absolute -top-[20%] -right-[10%] rounded-full pointer-events-none"
          style={{
            width: '65vw', height: '65vw',
            background: primaryColor,
            opacity: 0.13,
            filter: 'blur(90px)',
          }}
        />
        {/* Secondary blob — middle left */}
        <div
          className="absolute top-[35%] -left-[15%] rounded-full pointer-events-none"
          style={{
            width: '55vw', height: '55vw',
            background: secondaryColor,
            opacity: 0.10,
            filter: 'blur(100px)',
          }}
        />
        {/* Primary blob — bottom center */}
        <div
          className="absolute bottom-[5%] right-[20%] rounded-full pointer-events-none"
          style={{
            width: '45vw', height: '45vw',
            background: primaryColor,
            opacity: 0.08,
            filter: 'blur(80px)',
          }}
        />
      </div>

      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden">
        {heroImageUrl ? (
          <>
            <img src={heroImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primaryColor}EE, ${primaryColor}BB)` }} />
          </>
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}DD)` }} />
        )}
        {/* Subtle dot pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA3KSIvPjwvc3ZnPg==')] opacity-60" />

        <div className="relative container mx-auto px-4 py-8 md:py-14">
          <div className="flex items-center gap-4 mb-5">
            {outlet?.portal_logo_url && (
              <img
                src={outlet.portal_logo_url.startsWith('/') ? `${BACKEND_URL}${outlet.portal_logo_url}` : outlet.portal_logo_url}
                alt="Logo"
                className="w-14 h-14 rounded-2xl object-cover"
                style={{ filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.4))' }}
              />
            )}
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                {company?.name || 'Restaurant'}
              </h1>
              <p className="text-white/60 text-sm font-medium mt-0.5">{outlet?.location || ''}</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mt-2 max-w-xl">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search for dishes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl text-white placeholder-white/45 focus:outline-none text-base font-medium transition-all"
              style={{
                background: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.22)',
                boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.1)',
              }}
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
                  vegFilter === f.key ? 'shadow-lg scale-105' : 'hover:scale-[1.02]'
                }`}
                style={
                  vegFilter === f.key
                    ? { backgroundColor: 'rgba(255,255,255,0.95)', color: textColor, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }
                    : {
                        background: 'rgba(255,255,255,0.12)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.18)',
                        color: 'rgba(255,255,255,0.85)',
                      }
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sticky Category Navigation ── */}
      {menuLayout !== 'accordion' && (
        <div
          className="sticky top-0 z-40"
          style={{
            ...glass(surfaceColor, 'E8', '20px'),
            borderBottom: `1px solid rgba(255,255,255,0.22)`,
            boxShadow: `0 4px 24px rgba(0,0,0,0.06)`,
          }}
        >
          <div
            ref={categoryNavRef}
            className="container mx-auto px-4 flex gap-1.5 overflow-x-auto py-3"
            style={{ scrollbarWidth: 'none' }}
          >
            {categoryNames.map((cat) => {
              const icon = catIconMap[cat];
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => scrollToCategory(cat)}
                  className="whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all shrink-0 hover:scale-[1.03]"
                  style={
                    isActive
                      ? { backgroundColor: primaryColor, color: 'white', boxShadow: `0 4px 16px ${primaryColor}40` }
                      : {
                          background: 'rgba(128,128,128,0.10)',
                          backdropFilter: 'blur(8px)',
                          WebkitBackdropFilter: 'blur(8px)',
                          color: textColor,
                          border: `1px solid rgba(255,255,255,0.2)`,
                        }
                  }
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

      {/* ── Menu Items ── */}
      <div className="container mx-auto px-4 py-6 pb-36">
        {categoryNames.length === 0 && (
          <div className="text-center py-20">
            <p className="text-2xl font-bold" style={{ color: textColor, opacity: 0.3 }}>No items found</p>
            <p className="mt-2" style={{ color: textColor, opacity: 0.25 }}>Try adjusting your search or filters</p>
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
                bgColor={bgColor}
                surfaceColor={surfaceColor}
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
                className="mb-10 scroll-mt-20"
              >
                <h2 className="text-xl font-black mb-4 flex items-center gap-3" style={{ color: textColor }}>
                  {catIcon ? (
                    <CatIcon icon={catIcon} size={24} />
                  ) : (
                    <span className="w-1.5 h-8 rounded-full inline-block" style={{ backgroundColor: primaryColor }} />
                  )}
                  {cat}
                  <span className="text-sm font-medium ml-1" style={{ color: textColor, opacity: 0.35 }}>
                    ({filteredCategories[cat].length})
                  </span>
                </h2>

                <div
                  className={gridClass}
                  style={
                    menuLayout === 'compact'
                      ? {
                          ...glass(surfaceColor, 'D8'),
                          border: `1px solid rgba(255,255,255,0.28)`,
                          boxShadow: `0 4px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)`,
                        }
                      : {}
                  }
                >
                  {filteredCategories[cat].map((item) => {
                    const qty = getCartQuantity(item.id);
                    if (menuLayout === 'compact') {
                      return <CompactRow key={item.id} item={item} qty={qty} onAdd={addToCart} onRemove={removeFromCart} primaryColor={primaryColor} secondaryColor={secondaryColor} textColor={textColor} surfaceColor={surfaceColor} catIcon={catIcon} />;
                    }
                    if (menuLayout === 'grid') {
                      return <GridTile key={item.id} item={item} qty={qty} onAdd={addToCart} onRemove={removeFromCart} primaryColor={primaryColor} secondaryColor={secondaryColor} textColor={textColor} surfaceColor={surfaceColor} catIcon={catIcon} />;
                    }
                    return <ClassicCard key={item.id} item={item} qty={qty} onAdd={addToCart} onRemove={removeFromCart} primaryColor={primaryColor} secondaryColor={secondaryColor} textColor={textColor} surfaceColor={surfaceColor} catIcon={catIcon} />;
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Sticky Cart Bar ── */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
          <Link href={`/menu/${outletId}/cart`}>
            <div
              className="container mx-auto max-w-2xl flex items-center justify-between px-6 py-4 rounded-2xl text-white cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              style={{
                backgroundColor: `${primaryColor}F2`,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.22)',
                boxShadow: `0 -4px 32px ${primaryColor}30, 0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.2)`,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="px-3 py-1.5 rounded-xl text-sm font-black"
                  style={{ background: 'rgba(255,255,255,0.20)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
                >
                  {totalItems} item{totalItems > 1 ? 's' : ''}
                </div>
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

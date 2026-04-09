import React, { useState, useEffect } from 'react';
import { api, getImageUrl } from '../../services/api';
import {
  Plus, Edit, Trash2, Search, Link as LinkIcon,
  Image as ImageIcon, Loader2, AlertCircle, Package, X, UploadCloud,
  ChevronUp, ChevronDown, FolderOpen,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogFooter
} from '../ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';

// ─── Icon Library (Microsoft Fluent Emoji 3D via jsDelivr CDN) ─────────────────
const F = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets';
const ICON_GROUPS = [
  {
    label: 'Beverages',
    icons: [
      { id: 'coffee',    label: 'Coffee',         url: `${F}/Hot%20beverage/3D/hot_beverage_3d.png` },
      { id: 'tea',       label: 'Tea',             url: `${F}/Teacup%20without%20handle/3D/teacup_without_handle_3d.png` },
      { id: 'bubble',    label: 'Bubble Tea',      url: `${F}/Bubble%20tea/3D/bubble_tea_3d.png` },
      { id: 'colddrink', label: 'Cold Drink',      url: `${F}/Cup%20with%20straw/3D/cup_with_straw_3d.png` },
      { id: 'beer',      label: 'Beer',            url: `${F}/Beer%20mug/3D/beer_mug_3d.png` },
      { id: 'wine',      label: 'Wine',            url: `${F}/Wine%20glass/3D/wine_glass_3d.png` },
      { id: 'cocktail',  label: 'Cocktail',        url: `${F}/Cocktail%20glass/3D/cocktail_glass_3d.png` },
      { id: 'tropical',  label: 'Tropical Drink',  url: `${F}/Tropical%20drink/3D/tropical_drink_3d.png` },
      { id: 'juicebox',  label: 'Juice Box',       url: `${F}/Beverage%20box/3D/beverage_box_3d.png` },
      { id: 'milk',      label: 'Milk',            url: `${F}/Glass%20of%20milk/3D/glass_of_milk_3d.png` },
      { id: 'champagne', label: 'Champagne',       url: `${F}/Bottle%20with%20popping%20cork/3D/bottle_with_popping_cork_3d.png` },
      { id: 'cheers',    label: 'Cheers',          url: `${F}/Clinking%20glasses/3D/clinking_glasses_3d.png` },
    ],
  },
  {
    label: 'Fruits',
    icons: [
      { id: 'apple',       label: 'Apple',       url: `${F}/Red%20apple/3D/red_apple_3d.png` },
      { id: 'orange',      label: 'Orange',      url: `${F}/Tangerine/3D/tangerine_3d.png` },
      { id: 'lemon',       label: 'Lemon',       url: `${F}/Lemon/3D/lemon_3d.png` },
      { id: 'grapes',      label: 'Grapes',      url: `${F}/Grapes/3D/grapes_3d.png` },
      { id: 'strawberry',  label: 'Strawberry',  url: `${F}/Strawberry/3D/strawberry_3d.png` },
      { id: 'blueberries', label: 'Blueberries', url: `${F}/Blueberries/3D/blueberries_3d.png` },
      { id: 'cherries',    label: 'Cherries',    url: `${F}/Cherries/3D/cherries_3d.png` },
      { id: 'mango',       label: 'Mango',       url: `${F}/Mango/3D/mango_3d.png` },
      { id: 'pineapple',   label: 'Pineapple',   url: `${F}/Pineapple/3D/pineapple_3d.png` },
      { id: 'kiwi',        label: 'Kiwi',        url: `${F}/Kiwi%20fruit/3D/kiwi_fruit_3d.png` },
      { id: 'banana',      label: 'Banana',      url: `${F}/Banana/3D/banana_3d.png` },
      { id: 'watermelon',  label: 'Watermelon',  url: `${F}/Watermelon/3D/watermelon_3d.png` },
      { id: 'coconut',     label: 'Coconut',     url: `${F}/Coconut/3D/coconut_3d.png` },
      { id: 'peach',       label: 'Peach',       url: `${F}/Peach/3D/peach_3d.png` },
    ],
  },
  {
    label: 'Vegetables',
    icons: [
      { id: 'broccoli',   label: 'Broccoli',  url: `${F}/Broccoli/3D/broccoli_3d.png` },
      { id: 'carrot',     label: 'Carrot',    url: `${F}/Carrot/3D/carrot_3d.png` },
      { id: 'corn',       label: 'Corn',      url: `${F}/Ear%20of%20corn/3D/ear_of_corn_3d.png` },
      { id: 'potato',     label: 'Potato',    url: `${F}/Potato/3D/potato_3d.png` },
      { id: 'cucumber',   label: 'Cucumber',  url: `${F}/Cucumber/3D/cucumber_3d.png` },
      { id: 'chili',      label: 'Chili',     url: `${F}/Hot%20pepper/3D/hot_pepper_3d.png` },
      { id: 'avocado',    label: 'Avocado',   url: `${F}/Avocado/3D/avocado_3d.png` },
      { id: 'onion',      label: 'Onion',     url: `${F}/Onion/3D/onion_3d.png` },
      { id: 'garlic',     label: 'Garlic',    url: `${F}/Garlic/3D/garlic_3d.png` },
      { id: 'salad',      label: 'Salad',     url: `${F}/Green%20salad/3D/green_salad_3d.png` },
      { id: 'mushroom',   label: 'Mushroom',  url: `${F}/Mushroom/3D/mushroom_3d.png` },
      { id: 'tomato',     label: 'Tomato',    url: `${F}/Tomato/3D/tomato_3d.png` },
    ],
  },
  {
    label: 'Mains',
    icons: [
      { id: 'pizza',     label: 'Pizza',      url: `${F}/Pizza/3D/pizza_3d.png` },
      { id: 'burger',    label: 'Burger',     url: `${F}/Hamburger/3D/hamburger_3d.png` },
      { id: 'taco',      label: 'Taco',       url: `${F}/Taco/3D/taco_3d.png` },
      { id: 'burrito',   label: 'Burrito',    url: `${F}/Burrito/3D/burrito_3d.png` },
      { id: 'fried-egg', label: 'Fried Egg',  url: `${F}/Cooking/3D/cooking_3d.png` },
      { id: 'pan',       label: 'Pan Food',   url: `${F}/Shallow%20pan%20of%20food/3D/shallow_pan_of_food_3d.png` },
      { id: 'stew',      label: 'Stew',       url: `${F}/Pot%20of%20food/3D/pot_of_food_3d.png` },
      { id: 'noodles',   label: 'Noodles',    url: `${F}/Steaming%20bowl/3D/steaming_bowl_3d.png` },
      { id: 'pasta',     label: 'Pasta',      url: `${F}/Spaghetti/3D/spaghetti_3d.png` },
      { id: 'curry',     label: 'Curry',      url: `${F}/Curry%20rice/3D/curry_rice_3d.png` },
      { id: 'sushi',     label: 'Sushi',      url: `${F}/Sushi/3D/sushi_3d.png` },
      { id: 'chicken',   label: 'Chicken',    url: `${F}/Poultry%20leg/3D/poultry_leg_3d.png` },
      { id: 'steak',     label: 'Steak',      url: `${F}/Cut%20of%20meat/3D/cut_of_meat_3d.png` },
      { id: 'sandwich',  label: 'Sandwich',   url: `${F}/Sandwich/3D/sandwich_3d.png` },
      { id: 'rice',      label: 'Rice',       url: `${F}/Cooked%20rice/3D/cooked_rice_3d.png` },
    ],
  },
  {
    label: 'Bakery',
    icons: [
      { id: 'bread',    label: 'Bread',     url: `${F}/Bread/3D/bread_3d.png` },
      { id: 'croissant',label: 'Croissant', url: `${F}/Croissant/3D/croissant_3d.png` },
      { id: 'baguette', label: 'Baguette',  url: `${F}/Baguette%20bread/3D/baguette_bread_3d.png` },
      { id: 'bagel',    label: 'Bagel',     url: `${F}/Bagel/3D/bagel_3d.png` },
      { id: 'cupcake',  label: 'Cupcake',   url: `${F}/Cupcake/3D/cupcake_3d.png` },
      { id: 'cake',     label: 'Cake',      url: `${F}/Shortcake/3D/shortcake_3d.png` },
      { id: 'bday-cake',label: 'Bday Cake', url: `${F}/Birthday%20cake/3D/birthday_cake_3d.png` },
      { id: 'doughnut', label: 'Doughnut',  url: `${F}/Doughnut/3D/doughnut_3d.png` },
      { id: 'cookie',   label: 'Cookie',    url: `${F}/Cookie/3D/cookie_3d.png` },
      { id: 'pie',      label: 'Pie',       url: `${F}/Pie/3D/pie_3d.png` },
    ],
  },
  {
    label: 'Desserts',
    icons: [
      { id: 'soft-serve',  label: 'Soft Serve',  url: `${F}/Soft%20ice%20cream/3D/soft_ice_cream_3d.png` },
      { id: 'ice-cream',   label: 'Ice Cream',   url: `${F}/Ice%20cream/3D/ice_cream_3d.png` },
      { id: 'shaved-ice',  label: 'Shaved Ice',  url: `${F}/Shaved%20ice/3D/shaved_ice_3d.png` },
      { id: 'custard',     label: 'Custard',     url: `${F}/Custard/3D/custard_3d.png` },
      { id: 'lollipop',    label: 'Lollipop',    url: `${F}/Lollipop/3D/lollipop_3d.png` },
      { id: 'candy',       label: 'Candy',       url: `${F}/Candy/3D/candy_3d.png` },
      { id: 'chocolate',   label: 'Chocolate',   url: `${F}/Chocolate%20bar/3D/chocolate_bar_3d.png` },
      { id: 'honey',       label: 'Honey',       url: `${F}/Honey%20pot/3D/honey_pot_3d.png` },
    ],
  },
  {
    label: 'Snacks',
    icons: [
      { id: 'peanuts',  label: 'Peanuts',  url: `${F}/Peanuts/3D/peanuts_3d.png` },
      { id: 'popcorn',  label: 'Popcorn',  url: `${F}/Popcorn/3D/popcorn_3d.png` },
      { id: 'waffle',   label: 'Waffle',   url: `${F}/Waffle/3D/waffle_3d.png` },
      { id: 'pancakes', label: 'Pancakes', url: `${F}/Pancakes/3D/pancakes_3d.png` },
      { id: 'egg',      label: 'Egg',      url: `${F}/Egg/3D/egg_3d.png` },
      { id: 'cheese',   label: 'Cheese',   url: `${F}/Cheese%20wedge/3D/cheese_wedge_3d.png` },
      { id: 'pretzel',  label: 'Pretzel',  url: `${F}/Pretzel/3D/pretzel_3d.png` },
      { id: 'fries',    label: 'Fries',    url: `${F}/French%20fries/3D/french_fries_3d.png` },
      { id: 'shrimp',   label: 'Shrimp',   url: `${F}/Shrimp/3D/shrimp_3d.png` },
    ],
  },
  {
    label: 'General',
    icons: [
      { id: 'plate',    label: 'Plate',    url: `${F}/Fork%20and%20knife%20with%20plate/3D/fork_and_knife_with_plate_3d.png` },
      { id: 'utensils', label: 'Utensils', url: `${F}/Fork%20and%20knife/3D/fork_and_knife_3d.png` },
      { id: 'spoon',    label: 'Spoon',    url: `${F}/Spoon/3D/spoon_3d.png` },
      { id: 'star',     label: 'Star',     url: `${F}/Star/3D/star_3d.png` },
      { id: 'trophy',   label: 'Trophy',   url: `${F}/Trophy/3D/trophy_3d.png` },
      { id: 'fire',     label: 'Hot',      url: `${F}/Fire/3D/fire_3d.png` },
      { id: 'heart',    label: 'Favorite', url: `${F}/Red%20heart/3D/red_heart_3d.png` },
      { id: 'sparkles', label: 'Special',  url: `${F}/Sparkles/3D/sparkles_3d.png` },
    ],
  },
];

// ─── Icon Picker Component ─────────────────────────────────────────────────────
const IconPicker = ({ value, onChange, onUpload }) => {
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState(ICON_GROUPS[0].label);

  const currentGroup = ICON_GROUPS.find(g => g.label === activeGroup) || ICON_GROUPS[0];
  const isUrl = value && (value.startsWith('/') || value.startsWith('http'));

  return (
    <div className="space-y-2">
      <Label>Icon</Label>
      <div className="flex items-center gap-3">
        {/* Preview */}
        <div className="w-12 h-12 rounded-xl border-2 border-gray-200 dark:border-[#1F2630] flex items-center justify-center bg-gray-50 dark:bg-[#12161C] shrink-0 overflow-hidden">
          {value && isUrl ? (
            <img src={getImageUrl(value)} alt="icon" className="w-full h-full object-contain p-1" />
          ) : (
            <ImageIcon size={20} className="text-gray-400" />
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            className="text-xs border-dashed"
          >
            <ImageIcon size={13} className="mr-1.5" /> Pick Icon
          </Button>
          <label className="cursor-pointer">
            <Button type="button" variant="outline" size="sm" className="text-xs border-dashed pointer-events-none">
              <UploadCloud size={13} className="mr-1.5" /> Upload Image
            </Button>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onUpload}
            />
          </label>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')} className="text-xs text-red-500 hover:text-red-600">
              <X size={13} className="mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Icon picker dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px] bg-white dark:bg-[#171C22] border-gray-200 dark:border-[#1F2630]">
          <DialogHeader>
            <DialogTitle>Pick an Icon</DialogTitle>
            <DialogDescription>Choose a 3D icon to represent this category or item.</DialogDescription>
          </DialogHeader>
          {/* Group tabs */}
          <div className="flex flex-wrap gap-1 pb-2 border-b border-gray-100 dark:border-[#1F2630]">
            {ICON_GROUPS.map(g => (
              <button
                key={g.label}
                onClick={() => setActiveGroup(g.label)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${activeGroup === g.label ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-[#12161C] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#1F2630]'}`}
              >
                {g.label}
              </button>
            ))}
          </div>
          {/* Icon grid */}
          <div className="grid grid-cols-6 gap-2 py-2 max-h-64 overflow-y-auto pr-1">
            {currentGroup.icons.map(icon => (
              <button
                key={icon.id}
                onClick={() => { onChange(icon.url); setOpen(false); }}
                title={icon.label}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all hover:bg-purple-50 dark:hover:bg-purple-900/20 ${value === icon.url ? 'bg-purple-100 dark:bg-purple-900/40 ring-2 ring-purple-400' : ''}`}
              >
                <img
                  src={icon.url}
                  alt={icon.label}
                  className="w-10 h-10 object-contain"
                  loading="lazy"
                />
                <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full text-center leading-tight">
                  {icon.label}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Icon Display helper (used in lists) ──────────────────────────────────────
const IconDisplay = ({ icon, size = 'md' }) => {
  if (!icon) return null;
  const isUrl = icon.startsWith('/') || icon.startsWith('http');
  const cls = size === 'lg' ? 'w-10 h-10 text-3xl' : 'w-7 h-7 text-xl';
  return (
    <div className={`${cls} flex items-center justify-center shrink-0 rounded-lg overflow-hidden`}>
      {isUrl
        ? <img src={getImageUrl(icon)} alt="" className="w-full h-full object-cover" />
        : <span className={size === 'lg' ? 'text-3xl' : 'text-xl'}>{icon}</span>
      }
    </div>
  );
};

// ═══════════════════ MAIN COMPONENT ════════════════════════════════════════════
const AdminMenuManagement = () => {
  const [activeTab, setActiveTab] = useState('categories');

  // ── Categories state ──
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catForm, setCatForm] = useState({ name: '', icon: '', display_order: 0 });
  const [catSaving, setCatSaving] = useState(false);
  const [catIconFile, setCatIconFile] = useState(null);

  // ── Menu items state ──
  const [menuItems, setMenuItems] = useState([]);
  const [inventoryProducts, setInventoryProducts] = useState([]);
  const [itemLoading, setItemLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [iconFile, setIconFile] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '', description: '', category: '', price: '',
    image_url: '', image_urls: [], icon: '',
    available: true, is_veg: true,
    inventory_linked: false, inventory_product_id: 'auto_create',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setCatLoading(true);
    setItemLoading(true);
    try {
      const [catRes, itemRes, invRes] = await Promise.all([
        api.getMenuCategories().catch(() => ({ data: [] })),
        api.getMenuItems(),
        api.getProducts().catch(() => ({ data: [] })),
      ]);
      setCategories(catRes.data || []);
      setMenuItems(itemRes.data || []);
      setInventoryProducts(invRes.data || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setCatLoading(false);
      setItemLoading(false);
    }
  };

  // ─── Category helpers ────────────────────────────────────────────────────────
  const openCatModal = (cat = null) => {
    setCatIconFile(null);
    if (cat) {
      setEditingCat(cat);
      setCatForm({ name: cat.name, icon: cat.icon || '', display_order: cat.display_order });
    } else {
      setEditingCat(null);
      setCatForm({ name: '', icon: '', display_order: categories.length });
    }
    setCatModalOpen(true);
  };

  const handleCatIconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCatIconFile(file);
    // optimistic preview
    setCatForm(f => ({ ...f, icon: URL.createObjectURL(file) }));
  };

  const saveCat = async () => {
    if (!catForm.name.trim()) return;
    setCatSaving(true);
    try {
      let iconValue = catForm.icon;
      if (catIconFile) {
        const fd = new FormData();
        fd.append('files', catIconFile);
        const uploadRes = await api.uploadFiles(fd);
        iconValue = uploadRes.data?.urls?.[0] || iconValue;
      }
      const payload = { name: catForm.name.trim(), icon: iconValue || null, display_order: catForm.display_order };
      if (editingCat) {
        await api.updateMenuCategory(editingCat.id, payload);
      } else {
        await api.createMenuCategory(payload);
      }
      await fetchAll();
      setCatModalOpen(false);
    } catch (err) {
      console.error('Failed to save category:', err);
      alert('Failed to save category.');
    } finally {
      setCatSaving(false);
    }
  };

  const deleteCat = async (id) => {
    if (!window.confirm('Delete this category? Items in this category will still exist.')) return;
    try {
      await api.deleteMenuCategory(id);
      setCategories(categories.filter(c => c.id !== id));
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  };

  const moveCat = async (idx, dir) => {
    const newCats = [...categories];
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= newCats.length) return;
    [newCats[idx], newCats[targetIdx]] = [newCats[targetIdx], newCats[idx]];
    // Update display_order
    const updates = newCats.map((c, i) => api.updateMenuCategory(c.id, { display_order: i }));
    setCategories(newCats.map((c, i) => ({ ...c, display_order: i })));
    await Promise.all(updates).catch(() => {});
  };

  // ─── Item helpers ────────────────────────────────────────────────────────────
  const categoryNames = categories.map(c => c.name);
  // Derive any category names from items that aren't in the configured list
  const itemCategoryNames = [...new Set(menuItems.map(i => i.category))];
  const allCategoryNames = [...new Set([...categoryNames, ...itemCategoryNames])];

  const handleOpenModal = (item = null) => {
    setSelectedFiles([]);
    setIconFile(null);
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name || '',
        description: item.description || '',
        category: item.category || (categoryNames[0] || ''),
        price: item.price || '',
        image_url: item.image_url || '',
        image_urls: item.image_urls || [],
        icon: item.icon || '',
        available: item.available ?? true,
        is_veg: item.is_veg ?? true,
        inventory_linked: item.inventory_linked ?? false,
        inventory_product_id: item.inventory_product_id || 'auto_create',
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '', description: '',
        category: categoryNames[0] || '',
        price: '', image_url: '', image_urls: [], icon: '',
        available: true, is_veg: true,
        inventory_linked: false, inventory_product_id: 'auto_create',
      });
    }
    setIsModalOpen(true);
  };

  const handleItemIconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIconFile(file);
    setFormData(f => ({ ...f, icon: URL.createObjectURL(file) }));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price || !formData.category) return;
    setSaving(true);
    try {
      let finalImageUrls = [...(formData.image_urls || [])];
      if (selectedFiles.length > 0) {
        const uploadData = new FormData();
        selectedFiles.forEach(file => uploadData.append('files', file));
        const uploadRes = await api.uploadFiles(uploadData);
        if (uploadRes.data?.urls) finalImageUrls = [...finalImageUrls, ...uploadRes.data.urls];
      }

      let iconValue = formData.icon;
      if (iconFile) {
        const fd = new FormData();
        fd.append('files', iconFile);
        const uploadRes = await api.uploadFiles(fd);
        iconValue = uploadRes.data?.urls?.[0] || iconValue;
      }

      const payload = {
        ...formData,
        image_urls: finalImageUrls,
        icon: iconValue || null,
        price: parseFloat(formData.price) || 0,
        inventory_product_id:
          formData.inventory_linked && formData.inventory_product_id !== 'auto_create'
            ? (formData.inventory_product_id || null)
            : null,
      };

      if (editingItem) {
        await api.updateMenuItem(editingItem.id, payload);
      } else {
        await api.createMenuItem(payload);
      }
      await fetchAll();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save menu item:', err);
      alert('Failed to save menu item. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) return;
    try {
      await api.deleteMenuItem(id);
      setMenuItems(menuItems.filter(item => item.id !== id));
    } catch (err) {
      console.error('Failed to delete menu item:', err);
    }
  };

  // Sort items by category order, then by display_order within category
  const catOrderMap = Object.fromEntries(categories.map((c, i) => [c.name, i]));
  const sortedItems = [...menuItems].sort((a, b) => {
    const ao = catOrderMap[a.category] ?? 999;
    const bo = catOrderMap[b.category] ?? 999;
    if (ao !== bo) return ao - bo;
    return (a.display_order || 0) - (b.display_order || 0);
  });

  const filteredItems = sortedItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group filtered items by category (preserving sort)
  const groupedItems = {};
  filteredItems.forEach(item => {
    if (!groupedItems[item.category]) groupedItems[item.category] = [];
    groupedItems[item.category].push(item);
  });

  // Category icon lookup for items fallback
  const catIconMap = Object.fromEntries(categories.map(c => [c.name, c.icon]));

  const isLoading = catLoading || itemLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-[#D9DEE5] dark:border-[#1F2630]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">Menu Management</h2>
            <p className="text-sm text-[#4B5563] dark:text-[#7D8590]">Manage categories and items for your digital menu.</p>
          </div>
          <Button
            onClick={() => activeTab === 'categories' ? openCatModal() : handleOpenModal()}
            className="bg-purple-600 hover:bg-purple-700 text-white border-0 shadow-lg shadow-purple-500/30"
          >
            <Plus size={16} className="mr-2" />
            {activeTab === 'categories' ? 'Add Category' : 'Add Item'}
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-[#12161C] rounded-xl mb-6 w-fit">
          {[
            { key: 'categories', label: 'Categories', icon: FolderOpen },
            { key: 'items', label: 'Menu Items', icon: ImageIcon },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === key
                  ? 'bg-white dark:bg-[#171C22] text-purple-600 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon size={15} />
              {label}
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === key ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' : 'bg-gray-200 dark:bg-[#1F2630] text-gray-500'}`}>
                {key === 'categories' ? categories.length : menuItems.length}
              </span>
            </button>
          ))}
        </div>

        {/* ─── CATEGORIES TAB ─── */}
        {activeTab === 'categories' && (
          <div>
            {categories.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-[#1F2630] rounded-xl">
                <FolderOpen className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-[#E6E8EB]">No categories yet</h3>
                <p className="text-sm text-gray-500 mt-1">Add categories to organise your menu and assign icons.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {categories.map((cat, idx) => (
                  <div key={cat.id} className="flex items-center gap-4 p-4 bg-white dark:bg-[#171C22] rounded-xl border border-gray-100 dark:border-[#1F2630] hover:shadow-md transition-all group">
                    {/* Reorder */}
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveCat(idx, -1)} disabled={idx === 0} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-[#1F2630] disabled:opacity-30 transition-colors">
                        <ChevronUp size={14} className="text-gray-400" />
                      </button>
                      <button onClick={() => moveCat(idx, 1)} disabled={idx === categories.length - 1} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-[#1F2630] disabled:opacity-30 transition-colors">
                        <ChevronDown size={14} className="text-gray-400" />
                      </button>
                    </div>

                    {/* Order badge */}
                    <span className="text-xs font-bold text-gray-400 w-6 text-center">{idx + 1}</span>

                    {/* Icon */}
                    <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-[#12161C] border border-gray-200 dark:border-[#1F2630] flex items-center justify-center overflow-hidden shrink-0">
                      {cat.icon ? (
                        cat.icon.startsWith('/') || cat.icon.startsWith('http')
                          ? <img src={getImageUrl(cat.icon)} alt="" className="w-full h-full object-cover" />
                          : <span className="text-xl">{cat.icon}</span>
                      ) : (
                        <span className="text-gray-300 text-lg">?</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-[#E6E8EB]">{cat.name}</p>
                      <p className="text-xs text-gray-400">
                        {menuItems.filter(i => i.category === cat.name).length} item{menuItems.filter(i => i.category === cat.name).length !== 1 ? 's' : ''}
                      </p>
                    </div>

                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" onClick={() => openCatModal(cat)} className="h-8 text-gray-500 hover:text-purple-600">
                        <Edit size={14} className="mr-1" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteCat(cat.id)} className="h-8 text-gray-500 hover:text-red-600">
                        <Trash2 size={14} className="mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── ITEMS TAB ─── */}
        {activeTab === 'items' && (
          <div>
            <div className="relative mb-6 max-w-md">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-50 dark:bg-[#12161C] border-[#D9DEE5] dark:border-[#1F2630]"
              />
            </div>

            {filteredItems.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-[#1F2630] rounded-xl">
                <ImageIcon className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-[#E6E8EB]">No menu items found</h3>
                <p className="text-sm text-gray-500 mt-1">Get started by creating your first menu item.</p>
              </div>
            ) : (
              Object.entries(groupedItems).map(([catName, items]) => {
                const catIcon = catIconMap[catName];
                return (
                  <div key={catName} className="mb-8">
                    {/* Category header */}
                    <div className="flex items-center gap-3 mb-3">
                      {catIcon ? (
                        catIcon.startsWith('/') || catIcon.startsWith('http')
                          ? <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 bg-gray-100"><img src={getImageUrl(catIcon)} alt="" className="w-full h-full object-cover" /></div>
                          : <span className="text-2xl leading-none">{catIcon}</span>
                      ) : (
                        <span className="w-1.5 h-6 rounded-full bg-purple-500 inline-block" />
                      )}
                      <h3 className="font-black text-gray-800 dark:text-[#E6E8EB] text-base">{catName}</h3>
                      <span className="text-xs font-medium text-gray-400 bg-gray-100 dark:bg-[#12161C] px-2 py-0.5 rounded-full">{items.length}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {items.map(item => {
                        // Resolve display image for admin card: photo > item icon > cat icon
                        const displayImg = item.image_urls?.[0] || item.image_url || null;
                        const displayIcon = !displayImg ? (item.icon || catIcon || null) : null;

                        return (
                          <div key={item.id} className="group p-4 bg-white dark:bg-[#171C22] rounded-xl border border-gray-100 dark:border-[#1F2630] hover:shadow-lg transition-all">
                            <div className="flex gap-3">
                              <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-[#12161C] flex-shrink-0 overflow-hidden border border-gray-200 dark:border-[#1F2630] flex items-center justify-center">
                                {displayImg ? (
                                  <img src={getImageUrl(displayImg)} alt={item.name} className="w-full h-full object-cover" />
                                ) : displayIcon ? (
                                  displayIcon.startsWith('/') || displayIcon.startsWith('http')
                                    ? <img src={getImageUrl(displayIcon)} alt={item.name} className="w-full h-full object-cover" />
                                    : <span className="text-3xl">{displayIcon}</span>
                                ) : (
                                  <ImageIcon size={20} className="text-gray-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                  <h3 className="font-bold text-gray-900 dark:text-[#E6E8EB] truncate pr-2 text-sm">{item.name}</h3>
                                  <span className="font-semibold text-purple-600 dark:text-purple-400 text-sm shrink-0">₹{item.price}</span>
                                </div>
                                <p className="text-xs text-gray-500 mb-2 truncate">{item.description || 'No description'}</p>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Badge variant="outline" className={`text-[10px] font-bold uppercase border-0 ${item.is_veg !== false ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                    {item.is_veg !== false ? 'Veg' : 'Non-Veg'}
                                  </Badge>
                                  {!item.available && <Badge variant="destructive" className="text-[10px]">Sold Out</Badge>}
                                  {item.inventory_linked && (
                                    <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0 flex items-center gap-1 text-[10px]">
                                      <LinkIcon size={10} /> Linked
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#1F2630] flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="sm" onClick={() => handleOpenModal(item)} className="h-7 text-xs text-gray-500 hover:text-purple-600">
                                <Edit size={12} className="mr-1" /> Edit
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} className="h-7 text-xs text-gray-500 hover:text-red-600">
                                <Trash2 size={12} className="mr-1" /> Delete
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ─── CATEGORY MODAL ───────────────────────────────────────────────────── */}
      <Dialog open={catModalOpen} onOpenChange={setCatModalOpen}>
        <DialogContent className="sm:max-w-[420px] bg-white dark:bg-[#171C22] border-gray-200 dark:border-[#1F2630]">
          <DialogHeader>
            <DialogTitle>{editingCat ? 'Edit Category' : 'New Category'}</DialogTitle>
            <DialogDescription>Categories organise your menu and can have icons for the customer portal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Coffee, Mains, Desserts"
                value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                className="bg-gray-50 dark:bg-[#12161C] dark:border-[#1F2630]"
              />
            </div>
            <IconPicker
              value={catForm.icon}
              onChange={(v) => { setCatIconFile(null); setCatForm(f => ({ ...f, icon: v })); }}
              onUpload={handleCatIconUpload}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatModalOpen(false)}>Cancel</Button>
            <Button onClick={saveCat} disabled={catSaving || !catForm.name.trim()} className="bg-purple-600 hover:bg-purple-700 text-white">
              {catSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingCat ? 'Save Changes' : 'Create Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── ITEM MODAL ───────────────────────────────────────────────────────── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[520px] bg-white dark:bg-[#171C22] border-gray-200 dark:border-[#1F2630]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Menu Item' : 'New Menu Item'}</DialogTitle>
            <DialogDescription>Details will be visible on your digital menu.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[65vh] overflow-y-auto px-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Item Name <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="e.g. Avocado Toast"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-gray-50 dark:bg-[#12161C] dark:border-[#1F2630]"
                />
              </div>
              <div className="space-y-2">
                <Label>Price (₹) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="bg-gray-50 dark:bg-[#12161C] dark:border-[#1F2630]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category <span className="text-red-500">*</span></Label>
              {allCategoryNames.length > 0 ? (
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger className="bg-gray-50 dark:bg-[#12161C] dark:border-[#1F2630]">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCategoryNames.map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="e.g. Coffee, Main Course, Dessert"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="bg-gray-50 dark:bg-[#12161C] dark:border-[#1F2630]"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Brief description for the customer"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-gray-50 dark:bg-[#12161C] dark:border-[#1F2630]"
              />
            </div>

            {/* Photo upload */}
            <div className="space-y-2">
              <Label>Photos</Label>
              <div
                className="border-2 border-dashed border-gray-200 dark:border-[#1F2630] rounded-xl p-4 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-[#12161C] transition-colors"
                onClick={() => document.getElementById('file-upload').click()}
              >
                <UploadCloud className="mx-auto h-7 w-7 text-gray-400 mb-1" />
                <p className="text-sm text-gray-500">Click to upload photos</p>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files) setSelectedFiles([...selectedFiles, ...Array.from(e.target.files)]);
                  }}
                />
              </div>
              {(formData.image_urls?.length > 0 || selectedFiles.length > 0) && (
                <div className="flex gap-2 flex-wrap mt-2">
                  {formData.image_urls?.map((url, i) => (
                    <div key={`url-${i}`} className="relative w-14 h-14 rounded overflow-hidden border">
                      <img src={getImageUrl(url)} alt={`img-${i}`} className="w-full h-full object-cover" />
                      <button
                        className="absolute top-0 right-0 bg-red-500 text-white rounded-bl p-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          const newUrls = [...formData.image_urls];
                          newUrls.splice(i, 1);
                          setFormData({ ...formData, image_urls: newUrls });
                        }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                  {selectedFiles.map((file, i) => (
                    <div key={`file-${i}`} className="relative w-14 h-14 rounded overflow-hidden border">
                      <img src={URL.createObjectURL(file)} alt={`new-${i}`} className="w-full h-full object-cover" />
                      <button
                        className="absolute top-0 right-0 bg-red-500 text-white rounded-bl p-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          const newFiles = [...selectedFiles];
                          newFiles.splice(i, 1);
                          setSelectedFiles(newFiles);
                        }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Item icon (fallback when no photo) */}
            <IconPicker
              value={formData.icon}
              onChange={(v) => { setIconFile(null); setFormData(f => ({ ...f, icon: v })); }}
              onUpload={handleItemIconUpload}
            />
            <p className="text-[11px] text-gray-400 -mt-1">
              Icon is used when no photo is uploaded. Falls back to the category icon if also empty.
            </p>

            {/* Toggles */}
            <div className="bg-gray-50 dark:bg-[#12161C] rounded-lg p-4 space-y-4 border border-gray-100 dark:border-[#1F2630]">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold">Available for Sale</Label>
                  <p className="text-xs text-gray-500">Allow customers to order this item.</p>
                </div>
                <Switch checked={formData.available} onCheckedChange={(c) => setFormData({ ...formData, available: c })} />
              </div>

              <div className="border-t border-gray-200 dark:border-[#1F2630] pt-4 flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold">Vegetarian Item</Label>
                  <p className="text-xs text-gray-500">Specify whether this dish is veg or non-veg.</p>
                </div>
                <Switch checked={formData.is_veg} onCheckedChange={(c) => setFormData({ ...formData, is_veg: c })} />
              </div>

              <div className="border-t border-gray-200 dark:border-[#1F2630] pt-4 flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Package size={16} /> Link to Inventory
                  </Label>
                  <p className="text-xs text-gray-500">Auto-trigger sold out when stock drops to 0.</p>
                </div>
                <Switch
                  checked={formData.inventory_linked}
                  onCheckedChange={(c) => setFormData({ ...formData, inventory_linked: c, inventory_product_id: c ? formData.inventory_product_id || 'auto_create' : 'auto_create' })}
                />
              </div>

              {formData.inventory_linked && (
                <div className="pt-2 animate-in slide-in-from-top-2">
                  <Label className="text-xs mb-1.5 block text-gray-500">Select Existing Product (Optional)</Label>
                  <Select
                    value={formData.inventory_product_id || 'auto_create'}
                    onValueChange={(val) => setFormData({ ...formData, inventory_product_id: val })}
                  >
                    <SelectTrigger className="bg-white dark:bg-[#171C22]">
                      <SelectValue placeholder="Auto-create new product" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto_create">Auto-create new product</SelectItem>
                      {inventoryProducts.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.stock_quantity} in stock)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                    <AlertCircle size={10} /> If left blank, a new inventory item will be created upon saving.
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.name || !formData.price || !formData.category}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingItem ? 'Save Changes' : 'Create Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMenuManagement;

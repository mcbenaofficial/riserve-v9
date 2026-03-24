import MenuClient from './MenuClient';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export default async function MenuPage({ params }: { params: Promise<{ outletId: string }> }) {
  const { outletId } = await params;

  let menuData: any = null;
  try {
    const res = await fetch(`${BACKEND_URL}/api/public/menu/${outletId}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      menuData = await res.json();
    }
  } catch (e) {
    console.error('Failed to fetch menu:', e);
  }

  if (!menuData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-gray-800">Menu Not Available</h1>
          <p className="text-gray-500">Unable to load the menu. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <MenuClient 
      outletId={outletId}
      outlet={menuData.outlet}
      company={menuData.company}
      categories={menuData.categories}
      items={menuData.items}
    />
  );
}

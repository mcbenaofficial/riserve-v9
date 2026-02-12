import React from 'react';
import { Package } from 'lucide-react';
import AdminInventory from '../components/admin/AdminInventory';

const Inventory = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-[#D9DEE5] dark:border-[#1F2630]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0] flex items-center justify-center shadow-lg">
            <Package size={24} className="text-[#222]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">Inventory Management</h1>
            <p className="text-sm text-[#4B5563] dark:text-[#7D8590]">
              Manage your products, stock levels, and add-ons
            </p>
          </div>
        </div>
      </div>

      {/* Inventory Component */}
      <AdminInventory />
    </div>
  );
};

export default Inventory;

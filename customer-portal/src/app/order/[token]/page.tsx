const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export default async function OrderTrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let orderData: any = null;
  try {
    const res = await fetch(`${BACKEND_URL}/api/public/order/${token}`, { cache: 'no-store' });
    if (res.ok) {
      orderData = await res.json();
    }
  } catch (e) {
    console.error('Failed to fetch order:', e);
  }

  if (!orderData) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="text-6xl">😕</div>
          <h1 className="text-2xl font-bold text-gray-800">Order Not Found</h1>
          <p className="text-gray-400">This order link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  const order = orderData.order;
  const outletName = orderData.outlet_name || 'Restaurant';
  const items = order.items || [];
  const status = order.status;

  const steps = ['New', 'Preparing', 'ReadyToCollect', 'Completed'];
  const currentStepIndex = steps.indexOf(status);

  const stepLabels: Record<string, string> = {
    New: 'Order Placed',
    Preparing: 'Being Prepared',
    ReadyToCollect: 'Ready to Collect',
    Completed: 'Completed',
  };

  const stepIcons: Record<string, string> = {
    New: '📝',
    Preparing: '👨‍🍳',
    ReadyToCollect: '✅',
    Completed: '🎉',
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <div className="bg-gray-900 text-white py-8 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          <div className="text-5xl mb-4">{stepIcons[status] || '📦'}</div>
          <h1 className="text-3xl font-black tracking-tight mb-2">
            {status === 'Completed' ? 'Order Complete!' : 'Your Order is Live'}
          </h1>
          <p className="text-gray-400 font-medium">{outletName}</p>
          <div className="mt-4 inline-block bg-white/10 px-5 py-2 rounded-xl text-sm font-bold">
            Order #{order.order_number}
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-2xl px-4 py-8 space-y-6">
        {/* Status Stepper */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between relative">
            {/* Progress Line */}
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-100 mx-10" />
            <div
              className="absolute top-5 left-0 h-0.5 bg-green-500 mx-10 transition-all duration-1000"
              style={{ width: `${Math.max(0, (currentStepIndex / (steps.length - 1)) * (100 - 15))}%` }}
            />

            {steps.map((step, i) => {
              const isActive = i <= currentStepIndex;
              const isCurrent = i === currentStepIndex;
              return (
                <div key={step} className="relative flex flex-col items-center z-10" style={{ flex: 1 }}>
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all duration-500 ${
                      isCurrent
                        ? 'bg-green-500 text-white shadow-lg shadow-green-200 scale-110 ring-4 ring-green-100'
                        : isActive
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {isActive ? '✓' : i + 1}
                  </div>
                  <span
                    className={`text-xs font-bold mt-2 text-center ${
                      isCurrent ? 'text-green-600' : isActive ? 'text-gray-700' : 'text-gray-400'
                    }`}
                  >
                    {stepLabels[step]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Details */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider mb-4">Order Details</h3>
          <div className="divide-y divide-gray-50">
            {items.map((item: any, i: number) => (
              <div key={i} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-900 bg-gray-100 w-7 h-7 rounded-lg flex items-center justify-center">
                    {item.quantity}×
                  </span>
                  <span className="text-sm font-medium text-gray-700">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-gray-900">₹{(item.price * item.quantity).toFixed(0)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-dashed border-gray-200 pt-3 mt-3 flex justify-between">
            <span className="font-black text-gray-900">Total</span>
            <span className="font-black text-gray-900">₹{order.total_amount?.toFixed(0)}</span>
          </div>
        </div>

        {/* Customer Info */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400 font-medium">Customer</span>
              <p className="font-bold text-gray-900 mt-0.5">{order.customer_name}</p>
            </div>
            <div>
              <span className="text-gray-400 font-medium">Phone</span>
              <p className="font-bold text-gray-900 mt-0.5">{order.contact_number}</p>
            </div>
            <div>
              <span className="text-gray-400 font-medium">Order Type</span>
              <p className="font-bold text-gray-900 mt-0.5 capitalize">{order.order_type?.replace('_', ' ')}</p>
            </div>
            <div>
              <span className="text-gray-400 font-medium">Payment</span>
              <p className={`font-bold mt-0.5 capitalize ${order.payment_status === 'paid' ? 'text-green-600' : 'text-orange-500'}`}>
                {order.payment_status}
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">
          Powered by <span className="font-bold">Ri'Serve</span> • {new Date(order.created_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

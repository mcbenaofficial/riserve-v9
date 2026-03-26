// Smart Analytics Mock Data – Comprehensive data for all analytics tabs

// ── Demand Heatmap Data (Weekday × Hour) ────────────────────────────
export const demandHeatmapData = {
  salon: [
    { hour: '9 AM',  Mon: 2, Tue: 3, Wed: 2, Thu: 4, Fri: 5, Sat: 8, Sun: 6 },
    { hour: '10 AM', Mon: 5, Tue: 6, Wed: 4, Thu: 7, Fri: 8, Sat: 10, Sun: 8 },
    { hour: '11 AM', Mon: 7, Tue: 8, Wed: 6, Thu: 9, Fri: 10, Sat: 12, Sun: 9 },
    { hour: '12 PM', Mon: 8, Tue: 7, Wed: 5, Thu: 8, Fri: 9, Sat: 11, Sun: 7 },
    { hour: '1 PM',  Mon: 6, Tue: 5, Wed: 4, Thu: 6, Fri: 7, Sat: 9, Sun: 5 },
    { hour: '2 PM',  Mon: 3, Tue: 3, Wed: 2, Thu: 4, Fri: 5, Sat: 7, Sun: 4 },
    { hour: '3 PM',  Mon: 4, Tue: 4, Wed: 3, Thu: 5, Fri: 6, Sat: 8, Sun: 5 },
    { hour: '4 PM',  Mon: 6, Tue: 7, Wed: 5, Thu: 8, Fri: 9, Sat: 10, Sun: 7 },
    { hour: '5 PM',  Mon: 8, Tue: 9, Wed: 7, Thu: 10, Fri: 11, Sat: 12, Sun: 8 },
    { hour: '6 PM',  Mon: 7, Tue: 8, Wed: 6, Thu: 9, Fri: 10, Sat: 11, Sun: 6 },
    { hour: '7 PM',  Mon: 4, Tue: 5, Wed: 3, Thu: 6, Fri: 7, Sat: 8, Sun: 3 },
  ],
  cafe: [
    { hour: '8 AM',  Mon: 8, Tue: 9, Wed: 7, Thu: 10, Fri: 11, Sat: 14, Sun: 12 },
    { hour: '9 AM',  Mon: 12, Tue: 14, Wed: 10, Thu: 15, Fri: 16, Sat: 20, Sun: 18 },
    { hour: '10 AM', Mon: 8, Tue: 9, Wed: 7, Thu: 10, Fri: 11, Sat: 15, Sun: 13 },
    { hour: '11 AM', Mon: 6, Tue: 7, Wed: 5, Thu: 8, Fri: 9, Sat: 12, Sun: 10 },
    { hour: '12 PM', Mon: 18, Tue: 20, Wed: 16, Thu: 22, Fri: 24, Sat: 28, Sun: 22 },
    { hour: '1 PM',  Mon: 22, Tue: 24, Wed: 18, Thu: 25, Fri: 28, Sat: 32, Sun: 26 },
    { hour: '2 PM',  Mon: 14, Tue: 16, Wed: 12, Thu: 18, Fri: 20, Sat: 24, Sun: 18 },
    { hour: '3 PM',  Mon: 8, Tue: 9, Wed: 6, Thu: 10, Fri: 12, Sat: 16, Sun: 12 },
    { hour: '4 PM',  Mon: 10, Tue: 12, Wed: 8, Thu: 14, Fri: 16, Sat: 18, Sun: 14 },
    { hour: '5 PM',  Mon: 6, Tue: 7, Wed: 5, Thu: 8, Fri: 10, Sat: 14, Sun: 10 },
    { hour: '6 PM',  Mon: 4, Tue: 5, Wed: 3, Thu: 6, Fri: 8, Sat: 10, Sun: 6 },
  ],
};

// ── Revenue Forecast Data ───────────────────────────────────────────
export const forecastData = {
  salon: [
    { day: 'Day 1', actual: 24850, forecast: 25000, lower: 22000, upper: 28000 },
    { day: 'Day 2', actual: 22100, forecast: 23500, lower: 20500, upper: 26500 },
    { day: 'Day 3', actual: 26300, forecast: 24800, lower: 21800, upper: 27800 },
    { day: 'Day 4', actual: null, forecast: 26200, lower: 23200, upper: 29200 },
    { day: 'Day 5', actual: null, forecast: 28500, lower: 25000, upper: 32000 },
    { day: 'Day 6', actual: null, forecast: 32000, lower: 28000, upper: 36000 },
    { day: 'Day 7', actual: null, forecast: 27500, lower: 24000, upper: 31000 },
  ],
  cafe: [
    { day: 'Day 1', actual: 38600, forecast: 39000, lower: 35000, upper: 43000 },
    { day: 'Day 2', actual: 35200, forecast: 37500, lower: 33500, upper: 41500 },
    { day: 'Day 3', actual: 41300, forecast: 38800, lower: 34800, upper: 42800 },
    { day: 'Day 4', actual: null, forecast: 42200, lower: 38200, upper: 46200 },
    { day: 'Day 5', actual: null, forecast: 45500, lower: 41000, upper: 50000 },
    { day: 'Day 6', actual: null, forecast: 52000, lower: 47000, upper: 57000 },
    { day: 'Day 7', actual: null, forecast: 44500, lower: 40000, upper: 49000 },
  ],
};

// ── Revenue Comparison Data (This Period vs Previous) ───────────────
export const comparisonData = {
  salon: [
    { day: 'Mon', current: 18500, previous: 15200 },
    { day: 'Tue', current: 21200, previous: 19800 },
    { day: 'Wed', current: 19800, previous: 17500 },
    { day: 'Thu', current: 24100, previous: 22300 },
    { day: 'Fri', current: 28700, previous: 25100 },
    { day: 'Sat', current: 32400, previous: 28900 },
    { day: 'Sun', current: 24850, previous: 22400 },
  ],
  cafe: [
    { day: 'Mon', current: 28500, previous: 24200 },
    { day: 'Tue', current: 31200, previous: 28800 },
    { day: 'Wed', current: 29800, previous: 26500 },
    { day: 'Thu', current: 34100, previous: 31300 },
    { day: 'Fri', current: 42700, previous: 38100 },
    { day: 'Sat', current: 48400, previous: 42900 },
    { day: 'Sun', current: 38600, previous: 34400 },
  ],
};

// ── No-Show Trend Data ──────────────────────────────────────────────
export const noShowTrend = [
  { week: 'W1', rate: 6.2 }, { week: 'W2', rate: 5.8 }, { week: 'W3', rate: 5.1 },
  { week: 'W4', rate: 4.5 }, { week: 'W5', rate: 4.2 }, { week: 'W6', rate: 3.9 },
  { week: 'W7', rate: 4.0 }, { week: 'W8', rate: 3.6 },
];

// ── Customer Segmentation ───────────────────────────────────────────
export const customerSegments = {
  newVsReturning: [
    { name: 'New Customers', value: 38, color: '#14b8a6' },
    { name: 'Returning', value: 62, color: '#0d9488' },
  ],
  spendTiers: [
    { tier: 'VIP (₹5k+)', count: 45, spend: 384000, pct: 12 },
    { tier: 'High (₹2-5k)', count: 128, spend: 412000, pct: 34 },
    { tier: 'Medium (₹500-2k)', count: 210, spend: 268000, pct: 56 },
    { tier: 'Low (<₹500)', count: 89, spend: 32000, pct: 24 },
  ],
  retentionFunnel: [
    { stage: 'First Visit', value: 100 },
    { stage: '2nd Visit (30d)', value: 68 },
    { stage: '3rd Visit (60d)', value: 52 },
    { stage: '5+ Visits (90d)', value: 38 },
    { stage: 'Loyal (6mo+)', value: 24 },
  ],
  ltvDistribution: [
    { range: '₹0-1k', count: 89 }, { range: '₹1-5k', count: 210 },
    { range: '₹5-15k', count: 128 }, { range: '₹15-50k', count: 45 },
    { range: '₹50k+', count: 12 },
  ],
  metrics: {
    avgLTV: 12400, retentionRate: 62, churnRate: 8.5, avgVisitsPerMonth: 2.3,
  },
};

// ── Operations Analytics ────────────────────────────────────────────
export const operationsData = {
  salon: {
    staffUtilization: [
      { name: 'Ananya', utilization: 92, bookings: 48, revenue: 144000 },
      { name: 'Riya', utilization: 85, bookings: 42, revenue: 98000 },
      { name: 'Meera', utilization: 78, bookings: 38, revenue: 156000 },
      { name: 'Divya', utilization: 71, bookings: 34, revenue: 72000 },
      { name: 'Kavya', utilization: 68, bookings: 31, revenue: 65000 },
    ],
    profitability: {
      top: [
        { name: 'Bridal Package', revenue: 153000, cost: 38000, margin: 75, count: 18 },
        { name: 'Keratin Treatment', revenue: 93000, cost: 28000, margin: 70, count: 31 },
        { name: 'Hair Color', revenue: 126000, cost: 42000, margin: 67, count: 42 },
      ],
      bottom: [
        { name: 'Basic Manicure', revenue: 12000, cost: 8000, margin: 33, count: 60 },
        { name: 'Waxing', revenue: 18000, cost: 11000, margin: 39, count: 45 },
        { name: 'Threading', revenue: 8000, cost: 5000, margin: 38, count: 80 },
      ],
    },
    avgTime: { label: 'Avg Treatment Time', value: '47 min', trend: -3.2 },
  },
  cafe: {
    staffUtilization: [
      { name: 'Chef Ravi', utilization: 95, bookings: 320, revenue: 480000 },
      { name: 'Priya S.', utilization: 88, bookings: 280, revenue: 120000 },
      { name: 'Amit K.', utilization: 82, bookings: 245, revenue: 98000 },
      { name: 'Neha G.', utilization: 75, bookings: 210, revenue: 84000 },
      { name: 'Rohan M.', utilization: 70, bookings: 190, revenue: 76000 },
    ],
    profitability: {
      top: [
        { name: 'Cold Brew Coffee', revenue: 31500, cost: 6300, margin: 80, count: 210 },
        { name: 'Butter Chicken', revenue: 55800, cost: 16700, margin: 70, count: 186 },
        { name: 'Margherita Pizza', revenue: 38400, cost: 12500, margin: 67, count: 128 },
      ],
      bottom: [
        { name: 'Plain Water Bottle', revenue: 4500, cost: 3600, margin: 20, count: 450 },
        { name: 'Garden Salad', revenue: 8400, cost: 5800, margin: 31, count: 42 },
        { name: 'Plain Rice', revenue: 6000, cost: 3800, margin: 37, count: 120 },
      ],
    },
    avgTime: { label: 'Avg Table Turn Time', value: '38 min', trend: -5.1 },
  },
};

// ── Inventory Analytics ─────────────────────────────────────────────
export const inventoryAnalyticsData = {
  stockTurnover: [
    { month: 'Sep', turnover: 4.2 }, { month: 'Oct', turnover: 4.5 },
    { month: 'Nov', turnover: 4.8 }, { month: 'Dec', turnover: 5.1 },
    { month: 'Jan', turnover: 4.9 }, { month: 'Feb', turnover: 5.3 },
  ],
  reorderSuggestions: [
    { product: 'Hair Color Tubes', stock: 12, reorderPoint: 15, dailyUsage: 4.2, daysLeft: 2.9, urgency: 'critical' },
    { product: 'Keratin Solution', stock: 8, reorderPoint: 10, dailyUsage: 2.1, daysLeft: 3.8, urgency: 'high' },
    { product: 'Shampoo (500ml)', stock: 18, reorderPoint: 20, dailyUsage: 3.5, daysLeft: 5.1, urgency: 'medium' },
    { product: 'Conditioner (500ml)', stock: 22, reorderPoint: 20, dailyUsage: 2.8, daysLeft: 7.9, urgency: 'low' },
    { product: 'Foil Sheets', stock: 45, reorderPoint: 50, dailyUsage: 8.0, daysLeft: 5.6, urgency: 'medium' },
  ],
  categoryBreakdown: [
    { name: 'Hair Products', value: 42, stock: 285000 },
    { name: 'Skin Care', value: 28, stock: 192000 },
    { name: 'Nail Products', value: 15, stock: 68000 },
    { name: 'Equipment', value: 10, stock: 145000 },
    { name: 'Retail Items', value: 5, stock: 52000 },
  ],
};

// ── AI Insights Hub ─────────────────────────────────────────────────
export const aiInsightsData = {
  pastRecommendations: [
    { id: 1, title: 'Afternoon Happy Hour Promotion', date: '2026-03-10', status: 'implemented', outcome: '+18% bookings during 2-5 PM', impact: 'positive', confidence: 87 },
    { id: 2, title: 'Staff Rebalancing – Saturday', date: '2026-03-08', status: 'implemented', outcome: 'Zero wait times, 12% revenue increase', impact: 'positive', confidence: 92 },
    { id: 3, title: 'Keratin Bundle Offer', date: '2026-03-05', status: 'rejected', outcome: 'N/A – Owner preferred different pricing', impact: 'neutral', confidence: 78 },
    { id: 4, title: 'Reduce No-Show via Deposit', date: '2026-02-28', status: 'implemented', outcome: 'No-shows dropped from 8% to 4.2%', impact: 'positive', confidence: 91 },
    { id: 5, title: 'Evening Slot Extension', date: '2026-02-20', status: 'deferred', outcome: 'Under review for next quarter', impact: 'neutral', confidence: 72 },
  ],
  goals: [
    { name: 'Monthly Revenue Target', current: 485000, target: 600000, unit: '₹' },
    { name: 'Customer Retention', current: 62, target: 70, unit: '%' },
    { name: 'Avg Rating', current: 4.7, target: 4.8, unit: '/5' },
    { name: 'No-Show Rate', current: 4.2, target: 3.0, unit: '%', invert: true },
  ],
};

// ── AI Narrative Summaries ──────────────────────────────────────────
export const aiNarratives = {
  salon: {
    overview: 'Revenue is up 12.5% this week, driven primarily by bridal packages and keratin treatments. Saturday continues to be the peak day with 42 bookings. Your no-show rate has improved to 4.2%, down from 6.2% eight weeks ago.',
    trends: 'Demand peaks between 10 AM–12 PM and 4–6 PM on weekdays. Saturdays are consistently 35% above average. Tuesday-Wednesday afternoons show a clear dip — an opportunity for targeted promotions.',
    customers: 'Your returning customer base is strong at 62%. VIP clients (₹5k+/month) represent only 12% of customers but contribute 38% of revenue. Consider a loyalty program to convert Medium-tier customers.',
    operations: 'Ananya leads staff utilization at 92%. Bridal packages have the highest profit margin (75%). Average treatment time has improved by 3.2% — consider whether quality is maintained.',
    inventory: 'Hair color tubes are critically low — projected to run out in 2.9 days. Stock turnover has improved 26% over 6 months. Three products are below reorder points.',
    ai: '4 out of 5 implemented AI recommendations yielded positive outcomes. The deposit-based no-show prevention was the highest-impact suggestion, reducing no-shows by nearly 50%.',
  },
  cafe: {
    overview: 'Revenue is up 8.3% this week. Cold Brew Coffee and Butter Chicken remain your best sellers. Weekend traffic is 40% above weekdays. Your average check has stabilized at ₹248.',
    trends: 'Peak hours are 12–2 PM (lunch rush) and 8–9 AM (breakfast). Saturday lunch sees the highest demand at 32 covers/hour. Consider extending kitchen hours on Fridays.',
    customers: 'Returning diners make up 45% of traffic. Delivery orders (Swiggy/Zomato) contribute 22% of revenue but at lower margins. Focus on dine-in upselling.',
    operations: 'Chef Ravi is at 95% utilization — consider adding kitchen support. Cold Brew Coffee has the highest margin (80%). Table turn time improved 5.1% to 38 minutes.',
    inventory: 'Coffee beans and butter are your highest-velocity items. Stock turnover is healthy at 5.3x. No critical reorder alerts currently.',
    ai: 'Your implemented AI suggestions have driven a combined 14% revenue increase. The lunch-hour staffing adjustment was the most impactful change this quarter.',
  },
};

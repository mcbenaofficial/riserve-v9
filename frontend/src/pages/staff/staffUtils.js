// ============== HELPER COMPONENTS ==============
export const InputField = ({ label, type = 'text', value, onChange, placeholder, maxLength }) => (
  <div>
    <label className="block text-sm font-medium text-[#0E1116] dark:text-[#E6E8EB] mb-1">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="w-full px-3 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#0B0D10] text-[#0E1116] dark:text-[#E6E8EB] placeholder:text-[#6B7280]"
    />
  </div>
);

export const SelectField = ({ label, value, onChange, options }) => (
  <div>
    <label className="block text-sm font-medium text-[#0E1116] dark:text-[#E6E8EB] mb-1">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#0B0D10] text-[#0E1116] dark:text-[#E6E8EB]"
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

// ============== HELPER FUNCTIONS ==============
export function getWeekDates(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

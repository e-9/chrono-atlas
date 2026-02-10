interface DatePickerProps {
  value: string; // "MM-DD"
  onChange: (date: string) => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function DatePicker({ value, onChange }: DatePickerProps) {
  const [monthStr, dayStr] = value.split('-');
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  const selectStyle: React.CSSProperties = {
    padding: '4px 8px', border: '1px solid #d0ccc3', borderRadius: 4,
    background: '#faf8f4', color: '#3a3226', fontFamily: 'Georgia, serif', fontSize: 14,
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <select
        value={month}
        onChange={(e) => onChange(`${e.target.value.padStart(2, '0')}-${String(day).padStart(2, '0')}`)}
        style={selectStyle}
      >
        {MONTHS.map((name, i) => (
          <option key={i + 1} value={i + 1}>{name}</option>
        ))}
      </select>
      <select
        value={day}
        onChange={(e) => onChange(`${String(month).padStart(2, '0')}-${e.target.value.padStart(2, '0')}`)}
        style={selectStyle}
      >
        {Array.from({ length: 31 }, (_, i) => (
          <option key={i + 1} value={i + 1}>{i + 1}</option>
        ))}
      </select>
    </div>
  );
}

interface DatePickerProps {
  value: string; // "MM-DD"
  onChange: (date: string) => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function shiftDay(value: string, delta: number): string {
  const [m, d] = value.split('-').map(Number);
  // Use a non-leap year for simple day cycling
  const date = new Date(2001, m - 1, d + delta);
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(value: string): string {
  const [m, d] = value.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

export function DatePicker({ value, onChange }: DatePickerProps) {
  const [monthStr, dayStr] = value.split('-');
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  const selectStyle: React.CSSProperties = {
    padding: '4px 8px', border: '1px solid #d0ccc3', borderRadius: 4,
    background: '#faf8f4', color: '#3a3226', fontFamily: 'Georgia, serif', fontSize: 14,
  };

  const arrowStyle: React.CSSProperties = {
    background: 'none', border: '1px solid #d0ccc3', borderRadius: 4,
    color: '#3a3226', fontSize: 16, cursor: 'pointer', padding: '2px 8px',
    lineHeight: 1, fontFamily: 'system-ui, sans-serif',
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button style={arrowStyle} onClick={() => onChange(shiftDay(value, -1))} aria-label="Previous day">←</button>

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

      <button style={arrowStyle} onClick={() => onChange(shiftDay(value, 1))} aria-label="Next day">→</button>

      <span style={{
        color: '#8b7355', fontSize: 13, fontFamily: 'Georgia, serif',
        marginLeft: 4, whiteSpace: 'nowrap',
      }}>
        {formatDate(value)}
      </span>
    </div>
  );
}

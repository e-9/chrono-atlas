import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DatePicker } from './DatePicker';

describe('DatePicker', () => {
  it('displays the formatted date', () => {
    render(<DatePicker value="07-04" onChange={vi.fn()} />);
    expect(screen.getByText('July 4')).toBeInTheDocument();
  });

  it('calls onChange with next day when → clicked', async () => {
    const onChange = vi.fn();
    render(<DatePicker value="07-04" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /next day/i }));
    expect(onChange).toHaveBeenCalledWith('07-05');
  });

  it('calls onChange with previous day when ← clicked', async () => {
    const onChange = vi.fn();
    render(<DatePicker value="07-04" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /previous day/i }));
    expect(onChange).toHaveBeenCalledWith('07-03');
  });
});

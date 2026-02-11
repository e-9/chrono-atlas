import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { EventDetail } from './EventDetail';
import { mockEvent } from '../../test-utils';

describe('EventDetail', () => {
  it('renders nothing when event is null', () => {
    const { container } = render(<EventDetail event={null} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows event title, year, and place name', () => {
    const event = mockEvent({ title: 'Battle of Gettysburg', year: 1863 });
    render(<EventDetail event={event} onClose={vi.fn()} />);

    expect(screen.getByText('Battle of Gettysburg')).toBeInTheDocument();
    expect(screen.getByText('1863')).toBeInTheDocument();
    expect(screen.getByText(/Philadelphia/)).toBeInTheDocument();
  });

  it('shows "Fictional" badge for ai_generated events', () => {
    const event = mockEvent({ source: { type: 'ai_generated' } });
    render(<EventDetail event={event} onClose={vi.fn()} />);

    expect(screen.getByText('Fictional')).toBeInTheDocument();
  });

  it('shows Wikipedia link when sourceUrl exists', () => {
    const event = mockEvent();
    render(<EventDetail event={event} onClose={vi.fn()} />);

    const link = screen.getByText('Wikipedia →');
    expect(link).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Example');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('calls onClose when close button clicked', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<EventDetail event={mockEvent()} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(800); });
    expect(onClose).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('shows category tags', () => {
    const event = mockEvent({ categories: ['science', 'exploration'] });
    render(<EventDetail event={event} onClose={vi.fn()} />);

    expect(screen.getByText('science')).toBeInTheDocument();
    expect(screen.getByText('exploration')).toBeInTheDocument();
  });
});

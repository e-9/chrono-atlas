import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { EventDetail } from './EventDetail';
import { mockEvent } from '../../test-utils';

describe('EventDetail', () => {
  it('renders nothing when event is null', () => {
    const { container } = render(<EventDetail event={null} closing={false} onCloseRequest={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows event title, year, and place name', () => {
    const event = mockEvent({ title: 'Battle of Gettysburg', year: 1863 });
    render(<EventDetail event={event} closing={false} onCloseRequest={vi.fn()} />);

    expect(screen.getByText('Battle of Gettysburg')).toBeInTheDocument();
    expect(screen.getByText('1863')).toBeInTheDocument();
    expect(screen.getByText(/Philadelphia/)).toBeInTheDocument();
  });

  it('shows "Fictional" badge for ai_generated events', () => {
    const event = mockEvent({ source: { type: 'ai_generated' } });
    render(<EventDetail event={event} closing={false} onCloseRequest={vi.fn()} />);

    expect(screen.getByText('Fictional')).toBeInTheDocument();
  });

  it('shows Wikipedia link when sourceUrl exists', () => {
    const event = mockEvent();
    render(<EventDetail event={event} closing={false} onCloseRequest={vi.fn()} />);

    const link = screen.getByText('Wikipedia →');
    expect(link).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Example');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('calls onCloseRequest when close button clicked', () => {
    const onCloseRequest = vi.fn();
    render(<EventDetail event={mockEvent()} closing={false} onCloseRequest={onCloseRequest} />);

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onCloseRequest).toHaveBeenCalledOnce();
  });

  it('shows category tags', () => {
    const event = mockEvent({ categories: ['science', 'exploration'] });
    render(<EventDetail event={event} closing={false} onCloseRequest={vi.fn()} />);

    expect(screen.getByText('science')).toBeInTheDocument();
    expect(screen.getByText('exploration')).toBeInTheDocument();
  });
});

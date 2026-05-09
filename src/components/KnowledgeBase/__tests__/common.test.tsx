import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  StatCard,
  EmptyState,
  ConfirmDialog,
  TableSkeleton,
  InlineError,
  sxLineClamp,
} from '../common';

describe('sxLineClamp', () => {
  test('returns CSS that clamps to N lines', () => {
    const sx = sxLineClamp(3);
    expect(sx).toMatchObject({
      display: '-webkit-box',
      WebkitLineClamp: 3,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
    });
  });
});

describe('StatCard', () => {
  test('renders label, numeric value, and caption', () => {
    render(<StatCard label="Rules" value={42} caption="active" />);
    expect(screen.getByText('Rules')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  test('renders em dash when value is null', () => {
    render(<StatCard label="Empty" value={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  test('shows skeleton instead of value when loading', () => {
    const { container } = render(<StatCard label="Loading" value={1} loading />);
    // value is hidden behind skeleton — text should not appear
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(container.querySelector('.MuiSkeleton-root')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  test('renders title and triggers action when button clicked', () => {
    const onAction = jest.fn();
    render(
      <EmptyState title="No data" actionLabel="Add" onAction={onAction} />,
    );
    expect(screen.getByText('No data')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  test('omits action button when actionLabel or onAction is absent', () => {
    render(<EmptyState title="No data" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  test('Cancel and Confirm callbacks fire on respective clicks', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(
      <ConfirmDialog
        open
        title="Delete"
        description="Cannot be undone"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test('disables both buttons while loading', () => {
    render(
      <ConfirmDialog
        open
        title="Delete"
        description="x"
        loading
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  });
});

describe('TableSkeleton', () => {
  test('renders rows*columns skeleton cells', () => {
    const { container } = render(<TableSkeleton rows={3} columns={4} />);
    expect(container.querySelectorAll('.MuiSkeleton-root')).toHaveLength(12);
  });
});

describe('InlineError', () => {
  test('renders Error.message verbatim', () => {
    render(<InlineError error={new Error('boom')} />);
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  test('renders nothing when error is falsy', () => {
    const { container } = render(<InlineError error={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

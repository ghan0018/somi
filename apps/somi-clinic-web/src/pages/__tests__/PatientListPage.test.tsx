import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
// Disable rc-component/motion animations so AntD modals mount/unmount
// synchronously in jsdom (no CSS-transition teardown delay).
import MotionProvider from '@rc-component/motion/lib/context';

// ---------------------------------------------------------------------------
// Mock the patients API module
// ---------------------------------------------------------------------------

vi.mock('../../api/patients', () => ({
  listPatients: vi.fn(),
  createPatient: vi.fn(),
  reactivatePatient: vi.fn(),
  updatePatient: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock AuthContext (avoids upstream import errors from shared layout code)
// ---------------------------------------------------------------------------

vi.mock('../../contexts/AuthContext', () => {
  const auth = {
    user: { userId: 'u1', email: 'test@test.com', role: 'admin', status: 'active', mfaEnabled: false },
    isAuthenticated: true,
    isLoading: false,
  };
  return { useAuth: () => auth };
});

import { listPatients, createPatient, reactivatePatient, updatePatient } from '../../api/patients';
import PatientListPage from '../PatientListPage';
import type { Patient } from '../../types';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockListPatients = vi.mocked(listPatients);
const mockCreatePatient = vi.mocked(createPatient);
const mockReactivatePatient = vi.mocked(reactivatePatient);
const mockUpdatePatient = vi.mocked(updatePatient);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    patientId: 'pat-1',
    userId: 'usr-1',
    displayName: 'Jane Smith',
    status: 'active',
    clinicId: 'clinic-1',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-06-01T08:00:00Z',
    ...overrides,
  };
}

const DEFAULT_PAGE_RESPONSE = {
  items: [
    makePatient({ patientId: 'pat-1', displayName: 'Jane Smith', status: 'active' }),
    makePatient({ patientId: 'pat-2', displayName: 'Bob Jones', status: 'inactive' }),
  ],
  nextCursor: null,
};

// ---------------------------------------------------------------------------
// Helper: renders the page with animations disabled so modals
// mount/unmount synchronously inside jsdom.
// ---------------------------------------------------------------------------

function renderPage() {
  return render(
    <MotionProvider motion={false}>
      <MemoryRouter initialEntries={['/patients']}>
        <PatientListPage />
      </MemoryRouter>
    </MotionProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PatientListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListPatients.mockResolvedValue(DEFAULT_PAGE_RESPONSE);
    mockReactivatePatient.mockResolvedValue(makePatient());
    mockUpdatePatient.mockResolvedValue(makePatient());
  });

  afterEach(() => {
    // Ensure fake timers are never left running between tests
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  it('renders the page title and search input', async () => {
    // Wrap in act so the async mount effects (listPatients call) are flushed
    // before we assert, avoiding spurious "act" warnings.
    await act(async () => {
      renderPage();
    });

    expect(screen.getByRole('heading', { name: /^patients$/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search patients...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new patient/i })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  it('calls listPatients on mount and displays results in the table', async () => {
    await act(async () => {
      renderPage();
    });

    // The initial call must include no search filter, status 'active', and a limit of 100
    expect(mockListPatients).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active', limit: 100 })
    );
    const firstCall = mockListPatients.mock.calls[0][0];
    expect(firstCall?.search).toBeUndefined();

    // Both patient names should now be visible in the table
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();

    // Status tags are rendered by the column renderer (use getAllByText since
    // "Active"/"Inactive" also appear in the Segmented filter control)
    const activeElements = screen.getAllByText('Active');
    expect(activeElements.length).toBeGreaterThanOrEqual(2); // Segmented + table tag
    const inactiveElements = screen.getAllByText('Inactive');
    expect(inactiveElements.length).toBeGreaterThanOrEqual(2); // Segmented + table tag
  });

  // -------------------------------------------------------------------------
  it('re-fetches with the search value after the debounce delay', async () => {
    // Use fake timers to control the 400 ms debounce
    vi.useFakeTimers();

    // Render and flush the initial synchronous mount effects
    renderPage();

    // Advance past the debounce triggered by the initial empty-search effect
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Flush pending promise microtasks from the resolved listPatients mock
    await act(async () => {
      await Promise.resolve();
    });

    mockListPatients.mockClear();

    // Simulate the user typing in the search input
    fireEvent.change(screen.getByPlaceholderText('Search patients...'), {
      target: { value: 'jane' },
    });

    // Advance past the 400 ms debounce triggered by the search state change
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Flush the resolved listPatients promise
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockListPatients).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'jane', status: 'active', limit: 100 })
    );
  });

  // -------------------------------------------------------------------------
  it('opens the New Patient modal when the New Patient button is clicked', async () => {
    await act(async () => {
      renderPage();
    });

    // Before clicking: no dialog in the DOM
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /new patient/i }));

    // Wait for the modal portal to mount
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // The modal title and form fields should be inside the dialog
    expect(within(dialog).getByText('New Patient')).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText('e.g. Jane Smith')).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText('e.g. jane@example.com')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  it('closes the modal when the Cancel button is clicked', async () => {
    await act(async () => {
      renderPage();
    });

    fireEvent.click(screen.getByRole('button', { name: /new patient/i }));
    await screen.findByRole('dialog');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('calls createPatient and refreshes the list on a successful form submission', async () => {
    const newPatient = makePatient({ patientId: 'pat-3', displayName: 'Alice Brown' });
    mockCreatePatient.mockResolvedValue(newPatient);

    // After creation the list re-fetch returns the updated list
    mockListPatients
      .mockResolvedValueOnce(DEFAULT_PAGE_RESPONSE) // initial fetch on mount
      .mockResolvedValue({
        items: [...DEFAULT_PAGE_RESPONSE.items, newPatient],
        nextCursor: null,
      });

    await act(async () => {
      renderPage();
    });

    // Open the modal
    fireEvent.click(screen.getByRole('button', { name: /new patient/i }));
    const dialog = await screen.findByRole('dialog');

    // Fill the form fields inside the dialog
    fireEvent.change(within(dialog).getByPlaceholderText('e.g. Jane Smith'), {
      target: { value: 'Alice Brown' },
    });
    fireEvent.change(within(dialog).getByPlaceholderText('e.g. jane@example.com'), {
      target: { value: 'alice@example.com' },
    });

    // Submit via the modal OK button (labelled "Create")
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: /create/i }));
    });

    await waitFor(() => {
      expect(mockCreatePatient).toHaveBeenCalledOnce();
    });

    expect(mockCreatePatient).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'Alice Brown',
        email: 'alice@example.com',
      })
    );

    // Modal should close after successful creation
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // The list should have been re-fetched and show the new patient
    await waitFor(() => {
      expect(screen.getByText('Alice Brown')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('renders active/inactive toggle', async () => {
    await act(async () => {
      renderPage();
    });

    // The Segmented control should render both options.
    // Use the ant-segmented container to scope the query.
    const segmented = document.querySelector('.ant-segmented')!;
    expect(segmented).toBeTruthy();
    expect(within(segmented as HTMLElement).getByText('Active')).toBeInTheDocument();
    expect(within(segmented as HTMLElement).getByText('Inactive')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  it('passes status filter to listPatients when inactive is selected', async () => {
    vi.useFakeTimers();

    renderPage();

    // Advance past the initial debounce
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    mockListPatients.mockClear();

    // Click the "Inactive" segment within the Segmented control
    const segmented = document.querySelector('.ant-segmented')!;
    fireEvent.click(within(segmented as HTMLElement).getByText('Inactive'));

    // Advance past the 400ms debounce
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockListPatients).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'inactive', limit: 100 })
    );
  });
});

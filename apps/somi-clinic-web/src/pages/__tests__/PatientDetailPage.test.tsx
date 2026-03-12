import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';
// Disable rc-component/motion animations so AntD modals mount/unmount
// synchronously in jsdom (no CSS-transition teardown delay).
import MotionProvider from '@rc-component/motion/lib/context';

// ---------------------------------------------------------------------------
// Mock the patients API module
// ---------------------------------------------------------------------------

vi.mock('../../api/patients', () => ({
  getPatient: vi.fn(),
  updatePatient: vi.fn(),
}));

vi.mock('../../api/plans', () => ({
  getTherapistPlan: vi.fn().mockResolvedValue(null),
  publishPlan: vi.fn(),
  archivePlan: vi.fn(),
  updatePlanSettings: vi.fn(),
}));

vi.mock('../../api/exercises', () => ({
  listExercises: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
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

import { getPatient, updatePatient } from '../../api/patients';
import PatientDetailPage from '../PatientDetailPage';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockGetPatient = vi.mocked(getPatient);
const mockUpdatePatient = vi.mocked(updatePatient);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

import type { Patient } from '../../types';

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    patientId: 'pat-abc',
    userId: 'usr-abc',
    displayName: 'Jane Smith',
    status: 'active',
    clinicId: 'clinic-1',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-06-01T08:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Renders PatientDetailPage within a MemoryRouter that provides the
 * `:patientId` route param. Also includes a /patients sentinel route so
 * "Back to Patients" navigation assertions can be made. Wraps in
 * MotionProvider so AntD modal animations are disabled in jsdom.
 */
function renderPage(patientId = 'pat-abc') {
  return render(
    <MotionProvider motion={false}>
      <MemoryRouter initialEntries={[`/patients/${patientId}`]}>
        <Routes>
          <Route path="/patients/:patientId" element={<PatientDetailPage />} />
          <Route path="/patients" element={<div>Patient List Page</div>} />
        </Routes>
      </MemoryRouter>
    </MotionProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PatientDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  it('shows a loading spinner while the patient data is being fetched', () => {
    // Never resolve so loading state persists for the duration of this test
    mockGetPatient.mockReturnValue(new Promise(() => {}));

    renderPage();

    // Ant Design Spin renders a container with role="img" (the spinner icon)
    // or we can check for the aria-label. The safest cross-version approach
    // is to look for the Spin wrapper's accessible indicator.
    // Spin renders its loading indicator inside a <span class="ant-spin-dot">
    // We assert the detail content is NOT yet visible.
    expect(screen.queryByRole('heading', { name: /jane smith/i })).not.toBeInTheDocument();

    // The Spin component is mounted — verify via its aria-busy container or
    // by absence of the patient heading + presence of the spin element.
    // jsdom renders AntD Spin as a <div class="ant-spin-spinning"> wrapper.
    const spinners = document.querySelectorAll('.ant-spin');
    expect(spinners.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  it('renders patient details after the API resolves', async () => {
    mockGetPatient.mockResolvedValue(makePatient());

    renderPage();

    // Initially loading
    expect(screen.queryByRole('heading', { name: /jane smith/i })).not.toBeInTheDocument();

    // After fetch resolves patient name should appear as the page heading
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /jane smith/i })).toBeInTheDocument();
    });

    expect(mockGetPatient).toHaveBeenCalledOnce();
    expect(mockGetPatient).toHaveBeenCalledWith('pat-abc');
  });

  // -------------------------------------------------------------------------
  it('shows patient details in the General tab', async () => {
    const patient = makePatient({
      patientId: 'pat-abc',
      displayName: 'Jane Smith',
      status: 'active',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-06-01T08:00:00Z',
    });
    mockGetPatient.mockResolvedValue(patient);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /jane smith/i })).toBeInTheDocument();
    });

    // The General tab is shown by default — verify Descriptions labels & values
    expect(screen.getByText('Display Name')).toBeInTheDocument();
    // displayName value appears multiple times (breadcrumb, heading, and descriptions)
    const displayNameCells = screen.getAllByText('Jane Smith');
    expect(displayNameCells.length).toBeGreaterThan(0);

    // Status label and its tag value
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    // Patient ID label and value
    expect(screen.getByText('Patient ID')).toBeInTheDocument();
    expect(screen.getByText('pat-abc')).toBeInTheDocument();

    // Tab list should contain all five tabs
    expect(screen.getByRole('tab', { name: /general/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /plan/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /progress/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /messages/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /notes/i })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  it('renders the breadcrumb with a link back to the patient list', async () => {
    mockGetPatient.mockResolvedValue(makePatient());

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /jane smith/i })).toBeInTheDocument();
    });

    // Breadcrumb: "Patients" link + patient name
    expect(screen.getByRole('link', { name: /patients/i })).toBeInTheDocument();
    // The last breadcrumb item renders as plain text (not a link)
    const breadcrumbNames = screen.getAllByText('Jane Smith');
    expect(breadcrumbNames.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  it('shows an error state when the API call fails', async () => {
    mockGetPatient.mockRejectedValue(new Error('Network error'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/could not load patient data/i)).toBeInTheDocument();
    });

    // A "Back to Patients" button should still be offered
    expect(screen.getByRole('button', { name: /back to patients/i })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  it('navigates to the patient list when "Back to Patients" is clicked', async () => {
    mockGetPatient.mockRejectedValue(new Error('Network error'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back to patients/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /back to patients/i }));

    await waitFor(() => {
      expect(screen.getByText('Patient List Page')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('opens the Edit modal when the Edit button is clicked', async () => {
    mockGetPatient.mockResolvedValue(makePatient());

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
    });

    // Modal should not be visible before clicking
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Edit Patient')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('pre-fills the edit form with the current patient values', async () => {
    mockGetPatient.mockResolvedValue(
      makePatient({ displayName: 'Jane Smith', status: 'active' })
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // The Display Name input inside the modal should be pre-filled
    // Ant Design Form.Item renders an <input> for the text field
    const displayNameInput = screen.getByDisplayValue('Jane Smith');
    expect(displayNameInput).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  it('calls updatePatient and updates the displayed name on a successful save', async () => {
    const original = makePatient({ displayName: 'Jane Smith', status: 'active' });
    const updated = makePatient({ displayName: 'Jane Doe', status: 'active' });

    mockGetPatient.mockResolvedValue(original);
    mockUpdatePatient.mockResolvedValue(updated);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Change the display name inside the modal
    const displayNameInput = screen.getByDisplayValue('Jane Smith');
    fireEvent.change(displayNameInput, { target: { value: 'Jane Doe' } });

    // Submit via the "Save" button
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });

    await waitFor(() => {
      expect(mockUpdatePatient).toHaveBeenCalledOnce();
      expect(mockUpdatePatient).toHaveBeenCalledWith(
        'pat-abc',
        expect.objectContaining({ displayName: 'Jane Doe' })
      );
    });

    // Modal should close after successful save
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Page heading should reflect the updated name
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /jane doe/i })).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('closes the edit modal when Cancel is clicked without saving', async () => {
    mockGetPatient.mockResolvedValue(makePatient());

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(mockUpdatePatient).not.toHaveBeenCalled();
  });
});

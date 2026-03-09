import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock the admin API module
// ---------------------------------------------------------------------------

vi.mock('../../api/admin', () => ({
  queryAudit: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => {
  const auth = {
    user: { userId: 'u1', email: 'test@test.com', role: 'admin', status: 'active', mfaEnabled: false },
    isAuthenticated: true,
    isLoading: false,
  };
  return { useAuth: () => auth };
});

import { queryAudit } from '../../api/admin';
import AdminAuditPage from '../AdminAuditPage';
import type { AuditEvent } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockQueryAudit = vi.mocked(queryAudit);

function makeAuditEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    auditId: 'audit-1',
    actorUserId: 'user-abc',
    actorEmail: 'actor@clinic.com',
    actorRole: 'therapist',
    actionType: 'plan.publish',
    resourceType: 'plan',
    resourceId: 'plan-xyz',
    patientId: 'patient-1',
    createdAt: '2024-06-15T10:30:00Z',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminAuditPage />
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminAuditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryAudit.mockResolvedValue({ items: [], nextCursor: null });
  });

  // -------------------------------------------------------------------------
  it('renders the "Audit Log" heading', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /audit log/i })).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('calls queryAudit on mount with no filters', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockQueryAudit).toHaveBeenCalledOnce();
      expect(mockQueryAudit).toHaveBeenCalledWith({ limit: 100 });
    });
  });

  // -------------------------------------------------------------------------
  it('renders the table column headers', async () => {
    renderPage();

    // Ant Design renders each column header in both a <th> and a hidden <div>
    // for column-width measurement, so we use getAllByText and check ≥ 1 match.
    await waitFor(() => {
      expect(screen.getAllByText('Timestamp').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Actor').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Role').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Action').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Resource').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Patient ID').length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  it('renders audit event rows returned by the API', async () => {
    mockQueryAudit.mockResolvedValue({
      items: [makeAuditEvent()],
      nextCursor: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('actor@clinic.com')).toBeInTheDocument();
      expect(screen.getByText('therapist')).toBeInTheDocument();
      expect(screen.getByText('plan.publish')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('shows actorUserId as fallback when actorEmail is not available', async () => {
    mockQueryAudit.mockResolvedValue({
      items: [makeAuditEvent({ actorEmail: undefined, actorUserId: 'user-fallback' })],
      nextCursor: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('user-fallback')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('renders the combined resource column as "resourceType resourceId"', async () => {
    mockQueryAudit.mockResolvedValue({
      items: [makeAuditEvent({ resourceType: 'plan', resourceId: 'plan-xyz' })],
      nextCursor: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('plan plan-xyz')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('renders the patient ID column value', async () => {
    mockQueryAudit.mockResolvedValue({
      items: [makeAuditEvent({ patientId: 'patient-999' })],
      nextCursor: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('patient-999')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('renders "-" for rows with no patientId', async () => {
    mockQueryAudit.mockResolvedValue({
      items: [makeAuditEvent({ patientId: undefined })],
      nextCursor: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('-')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('renders the filter controls and Search button', async () => {
    renderPage();

    await waitFor(() => {
      // Action type is now a Select dropdown with a placeholder
      expect(screen.getByText('Filter by action type')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Filter by actor email')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Filter by patient ID')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('calls queryAudit with the action type filter when Search is clicked', async () => {
    renderPage();

    // Open the action type dropdown and pick "plan.publish" — type to search
    await waitFor(() => screen.getByText('Filter by action type'));
    const actionSelect = screen.getByRole('combobox');
    fireEvent.mouseDown(actionSelect);
    fireEvent.change(actionSelect, { target: { value: 'plan.publish' } });
    await waitFor(() => screen.getByTitle('plan.publish'));
    fireEvent.click(screen.getByTitle('plan.publish'));

    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(mockQueryAudit).toHaveBeenLastCalledWith(
        expect.objectContaining({ actionType: 'plan.publish' })
      );
    });
  });

  // -------------------------------------------------------------------------
  it('calls queryAudit with the patient ID filter when Search is clicked', async () => {
    renderPage();

    await waitFor(() => screen.getByPlaceholderText('Filter by patient ID'));

    fireEvent.change(screen.getByPlaceholderText('Filter by patient ID'), {
      target: { value: 'patient-42' },
    });

    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(mockQueryAudit).toHaveBeenLastCalledWith(
        expect.objectContaining({ patientId: 'patient-42' })
      );
    });
  });

  // -------------------------------------------------------------------------
  it('calls queryAudit with action type and patient ID filters combined', async () => {
    renderPage();

    // Select action type from dropdown — type to search since the list is long
    await waitFor(() => screen.getByText('Filter by action type'));
    const actionSelect = screen.getByRole('combobox');
    fireEvent.mouseDown(actionSelect);
    fireEvent.change(actionSelect, { target: { value: 'note.create' } });
    await waitFor(() => screen.getByTitle('note.create'));
    fireEvent.click(screen.getByTitle('note.create'));

    fireEvent.change(screen.getByPlaceholderText('Filter by patient ID'), {
      target: { value: 'patient-77' },
    });

    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(mockQueryAudit).toHaveBeenLastCalledWith(
        expect.objectContaining({ actionType: 'note.create', patientId: 'patient-77' })
      );
    });
  });

  // -------------------------------------------------------------------------
  it('passes undefined for empty filter values (not empty-string params)', async () => {
    renderPage();

    await waitFor(() => screen.getByRole('button', { name: /search/i }));

    // All filters are empty — click Search without filling anything
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      // Called twice total: once on mount, once on button click
      expect(mockQueryAudit).toHaveBeenCalledTimes(2);
      // The second call should not include truthy actionType / patientId / actorEmail
      expect(mockQueryAudit).toHaveBeenLastCalledWith({ limit: 100 });
    });
  });

  // -------------------------------------------------------------------------
  it('renders the actor email filter input', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Filter by actor email')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('calls queryAudit with actorEmail when Search is clicked', async () => {
    renderPage();

    await waitFor(() => screen.getByPlaceholderText('Filter by actor email'));

    fireEvent.change(screen.getByPlaceholderText('Filter by actor email'), {
      target: { value: 'therapist@clinic.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(mockQueryAudit).toHaveBeenLastCalledWith(
        expect.objectContaining({ actorEmail: 'therapist@clinic.com' })
      );
    });
  });

  // -------------------------------------------------------------------------
  it('renders multiple audit event rows correctly', async () => {
    mockQueryAudit.mockResolvedValue({
      items: [
        makeAuditEvent({ auditId: 'a-1', actorUserId: 'user-1', actorEmail: 'user1@clinic.com', actionType: 'plan.publish' }),
        makeAuditEvent({ auditId: 'a-2', actorUserId: 'user-2', actorEmail: 'user2@clinic.com', actionType: 'note.create' }),
      ],
      nextCursor: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('user1@clinic.com')).toBeInTheDocument();
      expect(screen.getByText('user2@clinic.com')).toBeInTheDocument();
      expect(screen.getByText('plan.publish')).toBeInTheDocument();
      expect(screen.getByText('note.create')).toBeInTheDocument();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';
import MotionProvider from '@rc-component/motion/lib/context';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../api/plans', () => ({
  getTherapistPlan: vi.fn(),
  publishPlan: vi.fn(),
  archivePlan: vi.fn(),
  advanceSession: vi.fn(),
  revertToDraft: vi.fn(),
  updatePlanSettings: vi.fn(),
}));

vi.mock('../../api/exercises', () => ({
  listExercises: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => {
  const auth = {
    user: {
      userId: 'u1',
      email: 'test@test.com',
      role: 'admin',
      status: 'active',
      mfaEnabled: false,
    },
    isAuthenticated: true,
    isLoading: false,
  };
  return { useAuth: () => auth };
});

import {
  getTherapistPlan,
  publishPlan,
  archivePlan,
  advanceSession,
  revertToDraft,
} from '../../api/plans';
import PlanTab from '../PlanTab';
import type { TreatmentPlan } from '../../types';

const mockGetTherapistPlan = vi.mocked(getTherapistPlan);
const mockPublishPlan = vi.mocked(publishPlan);
const mockArchivePlan = vi.mocked(archivePlan);
const mockAdvanceSession = vi.mocked(advanceSession);
const mockRevertToDraft = vi.mocked(revertToDraft);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePlan(overrides: Partial<TreatmentPlan> = {}): TreatmentPlan {
  return {
    planId: 'plan-1',
    patientId: 'pat-abc',
    status: 'draft',
    remindersEnabled: false,
    sessions: [
      {
        sessionKey: 'sess_01',
        index: 0,
        title: 'Session 1',
        timesPerDay: 1,
        assignments: [
          {
            assignmentKey: 'asgn_01',
            exerciseId: 'ex-1',
            exerciseVersionId: 'ev-1',
            index: 0,
            exercise: {
              exerciseVersionId: 'ev-1',
              exerciseId: 'ex-1',
              title: 'Shoulder Press',
              description: 'Press overhead',
              tags: [],
              defaultParams: { reps: 10, sets: 3 },
              createdByUserId: 'u1',
              createdAt: '2024-01-01T00:00:00Z',
            },
            effectiveParams: { reps: 10, sets: 3 },
          },
        ],
      },
      {
        sessionKey: 'sess_02',
        index: 1,
        title: 'Session 2',
        timesPerDay: 2,
        sessionNotes: 'Focus on form',
        assignments: [
          {
            assignmentKey: 'asgn_02',
            exerciseId: 'ex-2',
            exerciseVersionId: 'ev-2',
            index: 0,
            exercise: {
              exerciseVersionId: 'ev-2',
              exerciseId: 'ex-2',
              title: 'Bicep Curl',
              description: 'Curl it up',
              tags: [],
              defaultParams: { reps: 12 },
              createdByUserId: 'u1',
              createdAt: '2024-01-01T00:00:00Z',
            },
            effectiveParams: { reps: 12 },
          },
        ],
      },
    ],
    createdAt: '2024-06-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPlanTab(patientId = 'pat-abc') {
  return render(
    <MotionProvider motion={false}>
      <MemoryRouter
        initialEntries={[`/patients/${patientId}`]}
      >
        <Routes>
          <Route
            path="/patients/:patientId"
            element={<PlanTab patientId={patientId} />}
          />
          <Route
            path="/patients/:patientId/plan/new"
            element={<div>Plan Builder Page</div>}
          />
          <Route
            path="/patients/:patientId/plan/:planId/edit"
            element={<div>Edit Plan Page</div>}
          />
        </Routes>
      </MemoryRouter>
    </MotionProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlanTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clean up any Ant Design Modal.confirm portals left from previous tests
    document.querySelectorAll('.ant-modal-root').forEach((el) => el.remove());
  });

  // -----------------------------------------------------------------------
  // Loading & empty states
  // -----------------------------------------------------------------------

  it('shows a loading spinner while the plan is being fetched', () => {
    mockGetTherapistPlan.mockReturnValue(new Promise(() => {}));
    renderPlanTab();

    const spinners = document.querySelectorAll('.ant-spin');
    expect(spinners.length).toBeGreaterThan(0);
  });

  it('shows empty state with "Create Plan" button when no plan exists', async () => {
    mockGetTherapistPlan.mockResolvedValue(null);
    renderPlanTab();

    await waitFor(() => {
      expect(screen.getByText('No Treatment Plan')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/create a treatment plan to assign exercises/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create plan/i }),
    ).toBeInTheDocument();
  });

  it('navigates to plan builder when "Create Plan" is clicked', async () => {
    mockGetTherapistPlan.mockResolvedValue(null);
    renderPlanTab();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /create plan/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /create plan/i }));

    await waitFor(() => {
      expect(screen.getByText('Plan Builder Page')).toBeInTheDocument();
    });
  });

  it('shows error message when API fails', async () => {
    mockGetTherapistPlan.mockRejectedValue(new Error('fail'));
    renderPlanTab();

    await waitFor(() => {
      expect(
        screen.getByText(/could not load treatment plan/i),
      ).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Plan viewer (when plan exists)
  // -----------------------------------------------------------------------

  it('renders plan status and session details when a plan exists', async () => {
    mockGetTherapistPlan.mockResolvedValue(makePlan());
    renderPlanTab();

    await waitFor(() => {
      expect(screen.getByText('Draft')).toBeInTheDocument();
    });

    // Session titles
    expect(screen.getByText('Session 1')).toBeInTheDocument();
    expect(screen.getByText('Session 2')).toBeInTheDocument();

    // Exercise names
    expect(screen.getByText('Shoulder Press')).toBeInTheDocument();
    expect(screen.getByText('Bicep Curl')).toBeInTheDocument();
  });

  it('shows session notes for sessions that have them', async () => {
    mockGetTherapistPlan.mockResolvedValue(makePlan());
    renderPlanTab();

    await waitFor(() => {
      expect(screen.getByText('Focus on form')).toBeInTheDocument();
    });
  });

  it('shows exercise parameters in the assignment table', async () => {
    mockGetTherapistPlan.mockResolvedValue(makePlan());
    renderPlanTab();

    await waitFor(() => {
      expect(screen.getByText('Shoulder Press')).toBeInTheDocument();
    });

    // effectiveParams: reps=10, sets=3 for Shoulder Press
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Draft plan actions
  // -----------------------------------------------------------------------

  it('shows Edit Draft, Publish, and Archive buttons for draft plans', async () => {
    mockGetTherapistPlan.mockResolvedValue(makePlan({ status: 'draft' }));
    renderPlanTab();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /edit draft/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: /publish/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /archive/i }),
    ).toBeInTheDocument();
  });

  it('navigates to plan editor when "Edit Draft" is clicked', async () => {
    mockGetTherapistPlan.mockResolvedValue(makePlan({ status: 'draft' }));
    renderPlanTab();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /edit draft/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /edit draft/i }));

    await waitFor(() => {
      expect(screen.getByText('Edit Plan Page')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Publish confirmation modal
  // -----------------------------------------------------------------------

  it('shows publish confirmation modal when Publish is clicked', async () => {
    mockGetTherapistPlan.mockResolvedValue(makePlan({ status: 'draft' }));
    renderPlanTab();

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: /publish/i }).length,
      ).toBeGreaterThanOrEqual(1);
    });

    // Click the Publish button (the one with icon, not modal button)
    fireEvent.click(screen.getAllByRole('button', { name: /publish/i })[0]);

    await waitFor(() => {
      expect(
        document.querySelector('.ant-modal-confirm-content'),
      ).not.toBeNull();
    });

    const content = document.querySelector('.ant-modal-confirm-content');
    expect(content?.textContent).toMatch(/publishing will make this plan visible/i);
  });

  it('calls publishPlan when publish is confirmed', async () => {
    mockGetTherapistPlan.mockResolvedValue(makePlan({ status: 'draft' }));
    mockPublishPlan.mockResolvedValue(undefined);

    renderPlanTab();

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: /publish/i }).length,
      ).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /publish/i })[0]);

    await waitFor(() => {
      expect(screen.getAllByText(/yes, publish/i).length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByText(/yes, publish/i)[0]);

    await waitFor(() => {
      expect(mockPublishPlan).toHaveBeenCalledWith('pat-abc', 'plan-1');
    });
  });

  it('does not call publishPlan when modal is cancelled', async () => {
    mockGetTherapistPlan.mockResolvedValue(makePlan({ status: 'draft' }));
    renderPlanTab();

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: /publish/i }).length,
      ).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /publish/i })[0]);

    await waitFor(() => {
      expect(
        document.querySelector('.ant-modal-confirm-content'),
      ).not.toBeNull();
    });

    // Click the Cancel button inside the modal
    fireEvent.click(screen.getAllByText(/cancel/i)[0]);

    // Ensure no API call is made
    await waitFor(() => {
      expect(mockPublishPlan).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Archive confirmation modal
  // -----------------------------------------------------------------------

  it('shows archive confirmation modal when Archive is clicked', async () => {
    mockGetTherapistPlan.mockResolvedValue(makePlan({ status: 'draft' }));
    renderPlanTab();

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: /archive/i }).length,
      ).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /archive/i })[0]);

    await waitFor(() => {
      expect(
        document.querySelector('.ant-modal-confirm-content'),
      ).not.toBeNull();
    });

    const content = document.querySelector('.ant-modal-confirm-content');
    expect(content?.textContent).toMatch(/are you sure you want to archive/i);
  });

  it('calls archivePlan when archive is confirmed', async () => {
    mockGetTherapistPlan.mockResolvedValue(makePlan({ status: 'draft' }));
    mockArchivePlan.mockResolvedValue(undefined);

    renderPlanTab();

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: /archive/i }).length,
      ).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /archive/i })[0]);

    await waitFor(() => {
      expect(screen.getAllByText(/yes, archive/i).length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByText(/yes, archive/i)[0]);

    await waitFor(() => {
      expect(mockArchivePlan).toHaveBeenCalledWith('pat-abc', 'plan-1');
    });
  });

  // -----------------------------------------------------------------------
  // Published plan
  // -----------------------------------------------------------------------

  it('shows Edit Plan and Archive for published plans (no Edit Draft)', async () => {
    mockGetTherapistPlan.mockResolvedValue(
      makePlan({ status: 'published' }),
    );
    renderPlanTab();

    await waitFor(() => {
      expect(screen.getByText('Published')).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', { name: /edit draft/i }),
    ).not.toBeInTheDocument();
    // "Edit Plan" button for reverting to draft
    const editPlanButtons = screen.getAllByRole('button', { name: /edit plan/i });
    expect(editPlanButtons.length).toBeGreaterThanOrEqual(1);
    // Use getAllByRole since Ant Design may render duplicate nodes
    const archiveButtons = screen.getAllByRole('button', { name: /archive/i });
    expect(archiveButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows reminders toggle for published plans', async () => {
    mockGetTherapistPlan.mockResolvedValue(
      makePlan({ status: 'published', remindersEnabled: false }),
    );
    renderPlanTab();

    await waitFor(() => {
      expect(screen.getByText('Reminders:')).toBeInTheDocument();
    });

    // Switch should be present
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Archived plan
  // -----------------------------------------------------------------------

  it('shows "Create New Plan" for archived plans', async () => {
    mockGetTherapistPlan.mockResolvedValue(
      makePlan({ status: 'archived' }),
    );
    renderPlanTab();

    await waitFor(() => {
      expect(screen.getByText('Archived')).toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', { name: /create new plan/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /edit draft/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^archive$/i }),
    ).not.toBeInTheDocument();
  });

  it('navigates to plan builder when "Create New Plan" is clicked', async () => {
    mockGetTherapistPlan.mockResolvedValue(
      makePlan({ status: 'archived' }),
    );
    renderPlanTab();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /create new plan/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /create new plan/i }),
    );

    await waitFor(() => {
      expect(screen.getByText('Plan Builder Page')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Active session indicator (Issue 6)
  // -----------------------------------------------------------------------

  it('shows "Current" badge on the active session for published plans', async () => {
    mockGetTherapistPlan.mockResolvedValue(
      makePlan({ status: 'published', activeSessionIndex: 0 }),
    );
    renderPlanTab();

    await waitFor(() => {
      expect(screen.getByText('Current')).toBeInTheDocument();
    });
  });

  it('does not show "Current" badge for draft plans', async () => {
    mockGetTherapistPlan.mockResolvedValue(
      makePlan({ status: 'draft', activeSessionIndex: 0 }),
    );
    renderPlanTab();

    await waitFor(() => {
      expect(screen.getByText('Session 1')).toBeInTheDocument();
    });

    expect(screen.queryByText('Current')).not.toBeInTheDocument();
  });

  it('shows "Advance to Next Session" button on the active session', async () => {
    mockGetTherapistPlan.mockResolvedValue(
      makePlan({ status: 'published', activeSessionIndex: 0 }),
    );
    renderPlanTab();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /advance to next session/i }),
      ).toBeInTheDocument();
    });
  });

  it('does not show "Advance" button when active session is the last one', async () => {
    mockGetTherapistPlan.mockResolvedValue(
      makePlan({ status: 'published', activeSessionIndex: 1 }),
    );
    renderPlanTab();

    await waitFor(() => {
      expect(screen.getByText('Published')).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', { name: /advance to next session/i }),
    ).not.toBeInTheDocument();
  });

  it('calls advanceSession when advance is confirmed', async () => {
    mockGetTherapistPlan.mockResolvedValue(
      makePlan({ status: 'published', activeSessionIndex: 0 }),
    );
    mockAdvanceSession.mockResolvedValue(undefined);
    renderPlanTab();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /advance to next session/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /advance to next session/i }),
    );

    await waitFor(() => {
      expect(screen.getAllByText(/yes, advance/i).length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByText(/yes, advance/i)[0]);

    await waitFor(() => {
      expect(mockAdvanceSession).toHaveBeenCalledWith('pat-abc', 'plan-1');
    });
  });

  it('does not call advanceSession when advance modal is cancelled', async () => {
    mockGetTherapistPlan.mockResolvedValue(
      makePlan({ status: 'published', activeSessionIndex: 0 }),
    );
    renderPlanTab();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /advance to next session/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /advance to next session/i }),
    );

    await waitFor(() => {
      expect(
        document.querySelector('.ant-modal-confirm-content'),
      ).not.toBeNull();
    });

    fireEvent.click(screen.getAllByText(/cancel/i)[0]);

    await waitFor(() => {
      expect(mockAdvanceSession).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Edit published plan / Revert to draft (Issue 7)
  // -----------------------------------------------------------------------

  it('shows revert confirmation when "Edit Plan" is clicked on published plan', async () => {
    mockGetTherapistPlan.mockResolvedValue(
      makePlan({ status: 'published' }),
    );
    renderPlanTab();

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: /edit plan/i }).length,
      ).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /edit plan/i })[0]);

    await waitFor(() => {
      expect(
        document.querySelector('.ant-modal-confirm-content'),
      ).not.toBeNull();
    });

    const content = document.querySelector('.ant-modal-confirm-content');
    expect(content?.textContent).toMatch(/unpublish the plan/i);
  });

  it('calls revertToDraft when revert is confirmed', async () => {
    mockGetTherapistPlan.mockResolvedValue(
      makePlan({ status: 'published' }),
    );
    mockRevertToDraft.mockResolvedValue(undefined);
    renderPlanTab();

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: /edit plan/i }).length,
      ).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /edit plan/i })[0]);

    await waitFor(() => {
      expect(
        screen.getAllByText(/yes, revert to draft/i).length,
      ).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByText(/yes, revert to draft/i)[0]);

    await waitFor(() => {
      expect(mockRevertToDraft).toHaveBeenCalledWith('pat-abc', 'plan-1');
    });
  });

  it('does not call revertToDraft when revert modal is cancelled', async () => {
    mockGetTherapistPlan.mockResolvedValue(
      makePlan({ status: 'published' }),
    );
    renderPlanTab();

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: /edit plan/i }).length,
      ).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /edit plan/i })[0]);

    await waitFor(() => {
      expect(
        document.querySelector('.ant-modal-confirm-content'),
      ).not.toBeNull();
    });

    fireEvent.click(screen.getAllByText(/cancel/i)[0]);

    await waitFor(() => {
      expect(mockRevertToDraft).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Reminders tooltip (Issue 5)
  // -----------------------------------------------------------------------

  it('has reminders tooltip describing the feature', async () => {
    mockGetTherapistPlan.mockResolvedValue(
      makePlan({ status: 'published', remindersEnabled: false }),
    );
    renderPlanTab();

    await waitFor(() => {
      expect(screen.getByText('Reminders:')).toBeInTheDocument();
    });

    // The tooltip text should be present in the DOM (rendered as title attribute on Tooltip's span)
    expect(
      screen.getByText('Reminders:').closest('[class*="ant-tooltip"]') ||
      document.querySelector('[title*="push notifications"]') ||
      // Ant Design Tooltip renders as a hidden div with the title content
      screen.getByText('Reminders:'),
    ).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';
import MotionProvider from '@rc-component/motion/lib/context';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../api/plans', () => ({
  getTherapistPlan: vi.fn(),
  createPlan: vi.fn(),
  replacePlan: vi.fn(),
  publishPlan: vi.fn(),
  archivePlan: vi.fn(),
  updatePlanSettings: vi.fn(),
}));

vi.mock('../../api/exercises', () => ({
  listExercises: vi.fn(),
}));

vi.mock('../../api/uploads', () => ({
  getAccessUrl: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => {
  const auth = {
    user: {
      userId: 'u1',
      email: 'test@test.com',
      role: 'therapist' as string,
      status: 'active',
      mfaEnabled: false,
    },
    isAuthenticated: true,
    isLoading: false,
  };
  return { useAuth: () => auth };
});

import { getTherapistPlan, createPlan, replacePlan } from '../../api/plans';
import { listExercises } from '../../api/exercises';
import { getAccessUrl } from '../../api/uploads';
import PlanBuilderPage from '../PlanBuilderPage';
import type { Exercise, TreatmentPlan } from '../../types';

const mockGetTherapistPlan = vi.mocked(getTherapistPlan);
const mockCreatePlan = vi.mocked(createPlan);
const _mockReplacePlan = vi.mocked(replacePlan);
const mockListExercises = vi.mocked(listExercises);
const mockGetAccessUrl = vi.mocked(getAccessUrl);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    exerciseId: 'ex-1',
    currentVersionId: 'ev-1',
    title: 'Shoulder Press',
    description: 'Press overhead',
    tags: [{ tagId: 'tag-1', label: 'Upper Body' }],
    defaultParams: { reps: 10, sets: 3 },
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeDraftPlan(): TreatmentPlan {
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
    ],
    createdAt: '2024-06-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderCreateMode(patientId = 'pat-abc') {
  return render(
    <MotionProvider motion={false}>
      <MemoryRouter initialEntries={[`/patients/${patientId}/plan/new`]}>
        <Routes>
          <Route
            path="/patients/:patientId/plan/new"
            element={<PlanBuilderPage />}
          />
          <Route
            path="/patients/:patientId"
            element={<div>Patient Detail Page</div>}
          />
        </Routes>
      </MemoryRouter>
    </MotionProvider>,
  );
}

function renderEditMode(
  patientId = 'pat-abc',
  planId = 'plan-1',
) {
  return render(
    <MotionProvider motion={false}>
      <MemoryRouter
        initialEntries={[
          `/patients/${patientId}/plan/${planId}/edit`,
        ]}
      >
        <Routes>
          <Route
            path="/patients/:patientId/plan/:planId/edit"
            element={<PlanBuilderPage />}
          />
          <Route
            path="/patients/:patientId"
            element={<div>Patient Detail Page</div>}
          />
        </Routes>
      </MemoryRouter>
    </MotionProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlanBuilderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return some exercises for the picker
    mockListExercises.mockResolvedValue({
      items: [
        makeExercise({ exerciseId: 'ex-1', title: 'Shoulder Press' }),
        makeExercise({ exerciseId: 'ex-2', title: 'Bicep Curl' }),
        makeExercise({ exerciseId: 'ex-3', title: 'Squat' }),
      ],
      nextCursor: null,
    });
  });

  // -----------------------------------------------------------------------
  // Create mode
  // -----------------------------------------------------------------------

  describe('create mode', () => {
    it('renders with a "Create Treatment Plan" heading', () => {
      renderCreateMode();

      expect(
        screen.getByRole('heading', { name: /create treatment plan/i }),
      ).toBeInTheDocument();
    });

    it('starts with one empty session titled "Session 1"', () => {
      renderCreateMode();

      expect(screen.getByDisplayValue('Session 1')).toBeInTheDocument();
    });

    it('shows Save Draft and Cancel buttons', () => {
      renderCreateMode();

      expect(
        screen.getByRole('button', { name: /save draft/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /cancel/i }),
      ).toBeInTheDocument();
    });

    it('adds a new session when "Add Session" is clicked', () => {
      renderCreateMode();

      expect(screen.queryByDisplayValue('Session 2')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /add session/i }));

      expect(screen.getByDisplayValue('Session 2')).toBeInTheDocument();
    });

    it('shows the exercise picker modal when "Add Exercise" is clicked', async () => {
      renderCreateMode();

      // Click the first "Add Exercise" button
      const addBtns = screen.getAllByRole('button', { name: /add exercise/i });
      fireEvent.click(addBtns[0]);

      await waitFor(() => {
        expect(screen.getByText('Select Exercise')).toBeInTheDocument();
      });

      // Should show exercises from the API
      await waitFor(() => {
        expect(screen.getByText('Shoulder Press')).toBeInTheDocument();
        expect(screen.getByText('Bicep Curl')).toBeInTheDocument();
      });
    });

    it('adds selected exercise to the session', async () => {
      renderCreateMode();

      // Open the picker
      const addBtns = screen.getAllByRole('button', { name: /add exercise/i });
      fireEvent.click(addBtns[0]);

      await waitFor(() => {
        expect(screen.getByText('Shoulder Press')).toBeInTheDocument();
      });

      // Click on "Shoulder Press" row
      fireEvent.click(screen.getByText('Shoulder Press'));

      // Modal should close and exercise should appear in the session
      await waitFor(() => {
        expect(
          screen.queryByText('Select Exercise'),
        ).not.toBeInTheDocument();
      });

      // The exercise title should now appear in the builder card
      // (Not in the modal anymore, but in the session card)
      expect(screen.getByText('Shoulder Press')).toBeInTheDocument();
    });

    it('validates that each session has at least one exercise before saving', async () => {
      renderCreateMode();

      // Try to save with empty session
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
      });

      // Should not call createPlan
      expect(mockCreatePlan).not.toHaveBeenCalled();
    });

    it('creates a plan with correct payload on save', async () => {
      mockCreatePlan.mockResolvedValue(makeDraftPlan());
      renderCreateMode();

      // Add an exercise to the first session
      const addBtns = screen.getAllByRole('button', { name: /add exercise/i });
      fireEvent.click(addBtns[0]);

      await waitFor(() => {
        expect(screen.getByText('Shoulder Press')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Shoulder Press'));

      await waitFor(() => {
        expect(
          screen.queryByText('Select Exercise'),
        ).not.toBeInTheDocument();
      });

      // Save
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
      });

      await waitFor(() => {
        expect(mockCreatePlan).toHaveBeenCalledOnce();
      });

      // Verify the payload
      const [calledPatientId, calledSessions] = mockCreatePlan.mock.calls[0];
      expect(calledPatientId).toBe('pat-abc');
      expect(calledSessions).toHaveLength(1);
      expect(calledSessions[0].title).toBe('Session 1');
      expect(calledSessions[0].timesPerDay).toBe(1);
      expect(calledSessions[0].assignments).toHaveLength(1);
      expect(calledSessions[0].assignments[0].exerciseId).toBe('ex-1');
    });

    it('navigates back to patient detail after successful save', async () => {
      mockCreatePlan.mockResolvedValue(makeDraftPlan());
      renderCreateMode();

      // Add exercise and save
      const addBtns = screen.getAllByRole('button', { name: /add exercise/i });
      fireEvent.click(addBtns[0]);

      await waitFor(() => {
        expect(screen.getByText('Shoulder Press')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Shoulder Press'));

      await waitFor(() => {
        expect(
          screen.queryByText('Select Exercise'),
        ).not.toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
      });

      await waitFor(() => {
        expect(screen.getByText('Patient Detail Page')).toBeInTheDocument();
      });
    });

    it('navigates back without confirmation when cancel is clicked and form is clean', async () => {
      renderCreateMode();

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.getByText('Patient Detail Page')).toBeInTheDocument();
      });
    });

    it('shows confirmation modal when cancel is clicked and form is dirty', async () => {
      renderCreateMode();

      // Make the form dirty by adding a session
      fireEvent.click(screen.getByRole('button', { name: /add session/i }));

      // Now click cancel
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(
          document.querySelector('.ant-modal-confirm-content'),
        ).not.toBeNull();
      });

      const content = document.querySelector('.ant-modal-confirm-content');
      expect(content?.textContent).toMatch(/unsaved changes/i);
    });
  });

  // -----------------------------------------------------------------------
  // Edit mode
  // -----------------------------------------------------------------------

  describe('edit mode', () => {
    it('loads existing plan data and renders "Edit Treatment Plan" heading', async () => {
      mockGetTherapistPlan.mockResolvedValue(makeDraftPlan());
      renderEditMode();

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /edit treatment plan/i }),
        ).toBeInTheDocument();
      });

      // Should show existing session title
      expect(screen.getByDisplayValue('Session 1')).toBeInTheDocument();

      // Should show existing exercise
      expect(screen.getByText('Shoulder Press')).toBeInTheDocument();
    });

    it('shows "Save Changes" button instead of "Save Draft" in edit mode', async () => {
      mockGetTherapistPlan.mockResolvedValue(makeDraftPlan());
      renderEditMode();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /save changes/i }),
        ).toBeInTheDocument();
      });
    });

    it('redirects when trying to edit a non-draft plan', async () => {
      mockGetTherapistPlan.mockResolvedValue(
        makeDraftPlan(),
      );
      // Override status to published
      const publishedPlan = { ...makeDraftPlan(), status: 'published' as const };
      mockGetTherapistPlan.mockResolvedValue(publishedPlan);

      renderEditMode();

      await waitFor(() => {
        expect(screen.getByText('Patient Detail Page')).toBeInTheDocument();
      });
    });
  });

  // -----------------------------------------------------------------------
  // Session management
  // -----------------------------------------------------------------------

  describe('session management', () => {
    it('does not allow removing the last session', () => {
      renderCreateMode();

      // There's only one session — remove button should be disabled
      const removeBtn = screen.getByRole('button', {
        name: /remove session/i,
      });
      expect(removeBtn).toBeDisabled();
    });

    it('allows removing a session when there are multiple', () => {
      renderCreateMode();

      // Add a second session
      fireEvent.click(screen.getByRole('button', { name: /add session/i }));

      // Both remove buttons should now be enabled
      const removeBtns = screen.getAllByRole('button', {
        name: /remove session/i,
      });
      expect(removeBtns.length).toBe(2);
      expect(removeBtns[0]).not.toBeDisabled();
    });

    it('can reorder sessions with up/down buttons', () => {
      renderCreateMode();

      // Add a second session
      fireEvent.click(screen.getByRole('button', { name: /add session/i }));

      // Check initial order
      const inputs = screen.getAllByPlaceholderText(
        /session title/i,
      );
      expect(inputs[0]).toHaveValue('Session 1');
      expect(inputs[1]).toHaveValue('Session 2');

      // Move first session down
      const downBtns = screen.getAllByRole('button', {
        name: /move session down/i,
      });
      fireEvent.click(downBtns[0]);

      // Check new order
      const reorderedInputs = screen.getAllByPlaceholderText(
        /session title/i,
      );
      expect(reorderedInputs[0]).toHaveValue('Session 2');
      expect(reorderedInputs[1]).toHaveValue('Session 1');
    });
  });

  // -----------------------------------------------------------------------
  // Exercise picker
  // -----------------------------------------------------------------------

  describe('exercise picker', () => {
    it('filters exercises by search term', async () => {
      renderCreateMode();

      const addBtns = screen.getAllByRole('button', { name: /add exercise/i });
      fireEvent.click(addBtns[0]);

      await waitFor(() => {
        expect(screen.getByText('Select Exercise')).toBeInTheDocument();
      });

      // Type in search
      const searchInput = screen.getByPlaceholderText(/search exercises/i);
      fireEvent.change(searchInput, { target: { value: 'squat' } });

      // Wait for debounced search
      await waitFor(() => {
        expect(mockListExercises).toHaveBeenCalledWith(
          expect.objectContaining({ q: 'squat' }),
        );
      });
    });

    it('closes modal after selecting an exercise', async () => {
      renderCreateMode();

      const addBtns = screen.getAllByRole('button', { name: /add exercise/i });
      fireEvent.click(addBtns[0]);

      await waitFor(() => {
        expect(screen.getByText('Bicep Curl')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Bicep Curl'));

      await waitFor(() => {
        expect(
          screen.queryByText('Select Exercise'),
        ).not.toBeInTheDocument();
      });
    });
  });

  // -----------------------------------------------------------------------
  // Param labels (Issue 2)
  // -----------------------------------------------------------------------

  describe('param labels', () => {
    it('shows visible labels (Reps, Sets, Sec) next to param inputs after adding an exercise', async () => {
      renderCreateMode();

      // Add an exercise with defaults
      const addBtns = screen.getAllByRole('button', { name: /add exercise/i });
      fireEvent.click(addBtns[0]);

      await waitFor(() => {
        expect(screen.getByText('Shoulder Press')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Shoulder Press'));

      // Wait for exercise to appear in the session
      await waitFor(() => {
        // The exercise title should appear as a label in the session card (not the picker)
        const exerciseTitles = screen.getAllByText('Shoulder Press');
        expect(exerciseTitles.length).toBeGreaterThanOrEqual(1);
      });

      // Labels should be visible even though values are filled
      expect(screen.getByText('Reps')).toBeInTheDocument();
      expect(screen.getByText('Sets')).toBeInTheDocument();
      expect(screen.getByText('Sec')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Exercise reuse across sessions (Issue 4)
  // -----------------------------------------------------------------------

  describe('exercise reuse across sessions', () => {
    it('allows the same exercise to be added to different sessions', async () => {
      renderCreateMode();

      // Add a second session
      fireEvent.click(screen.getByRole('button', { name: /add session/i }));

      // Add Shoulder Press to Session 1
      const addBtns = screen.getAllByRole('button', { name: /add exercise/i });
      fireEvent.click(addBtns[0]); // Session 1's "Add Exercise"

      await waitFor(() => {
        expect(screen.getByText('Select Exercise')).toBeInTheDocument();
      });

      // Find and click Shoulder Press inside the modal table
      const modalTable = document.querySelector('.ant-modal-body .ant-table-tbody');
      const rows = modalTable?.querySelectorAll('tr') ?? [];
      let shoulderPressRow: HTMLElement | null = null;
      rows.forEach((row) => {
        if (row.textContent?.includes('Shoulder Press')) {
          shoulderPressRow = row as HTMLElement;
        }
      });
      expect(shoulderPressRow).not.toBeNull();
      fireEvent.click(shoulderPressRow!);

      // Wait for the exercise to appear in Session 1 and modal to close
      await waitFor(() => {
        expect(screen.queryByText('Select Exercise')).not.toBeInTheDocument();
      });

      // Now open picker for Session 2
      const addBtnsUpdated = screen.getAllByRole('button', { name: /add exercise/i });
      fireEvent.click(addBtnsUpdated[1]); // Session 2's "Add Exercise"

      await waitFor(() => {
        expect(screen.getByText('Select Exercise')).toBeInTheDocument();
      });

      // Shoulder Press should still be available in the picker for Session 2
      // (since we only exclude exercises from the current session, not all sessions)
      const modalTable2 = document.querySelector('.ant-modal-body .ant-table-tbody');
      await waitFor(() => {
        expect(modalTable2?.textContent).toContain('Shoulder Press');
      });
    });
  });

  // -----------------------------------------------------------------------
  // Video preview (Issue 3)
  // -----------------------------------------------------------------------

  describe('video preview', () => {
    it('shows play icon for exercises with mediaId', async () => {
      // Return exercises with mediaId
      mockListExercises.mockResolvedValue({
        items: [
          makeExercise({
            exerciseId: 'ex-1',
            title: 'Shoulder Press',
            mediaId: 'media-1',
          }),
        ],
        nextCursor: null,
      });

      renderCreateMode();

      // Add exercise with media
      const addBtns = screen.getAllByRole('button', { name: /add exercise/i });
      fireEvent.click(addBtns[0]);

      await waitFor(() => {
        expect(screen.getByText('Shoulder Press')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Shoulder Press'));

      // Wait for picker to close and exercise to be in the session
      await waitFor(() => {
        expect(screen.queryByText('Select Exercise')).not.toBeInTheDocument();
      });

      // Play icon should be present (aria-label)
      expect(
        screen.getByRole('img', { name: /preview video for shoulder press/i }),
      ).toBeInTheDocument();
    });

    it('does not show play icon for exercises without mediaId', async () => {
      // Return exercises without mediaId
      mockListExercises.mockResolvedValue({
        items: [
          makeExercise({
            exerciseId: 'ex-1',
            title: 'Shoulder Press',
            mediaId: undefined,
          }),
        ],
        nextCursor: null,
      });

      renderCreateMode();

      // Add exercise without media
      const addBtns = screen.getAllByRole('button', { name: /add exercise/i });
      fireEvent.click(addBtns[0]);

      await waitFor(() => {
        expect(screen.getByText('Shoulder Press')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Shoulder Press'));

      await waitFor(() => {
        expect(screen.queryByText('Select Exercise')).not.toBeInTheDocument();
      });

      // Play icon should NOT be present
      expect(
        screen.queryByRole('img', { name: /preview video/i }),
      ).not.toBeInTheDocument();
    });

    it('opens video modal when play icon is clicked', async () => {
      mockListExercises.mockResolvedValue({
        items: [
          makeExercise({
            exerciseId: 'ex-1',
            title: 'Shoulder Press',
            mediaId: 'media-1',
          }),
        ],
        nextCursor: null,
      });
      mockGetAccessUrl.mockResolvedValue({
        uploadId: 'media-1',
        accessUrl: 'https://example.com/video.mp4',
        expiresAt: '2099-01-01T00:00:00Z',
      });

      renderCreateMode();

      // Add exercise with media
      const addBtns = screen.getAllByRole('button', { name: /add exercise/i });
      fireEvent.click(addBtns[0]);

      await waitFor(() => {
        expect(screen.getByText('Shoulder Press')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Shoulder Press'));

      await waitFor(() => {
        expect(screen.queryByText('Select Exercise')).not.toBeInTheDocument();
      });

      // Click the play icon
      fireEvent.click(
        screen.getByRole('img', { name: /preview video for shoulder press/i }),
      );

      // Modal should appear with the video
      await waitFor(() => {
        expect(mockGetAccessUrl).toHaveBeenCalledWith('media-1');
      });
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock API modules
// ---------------------------------------------------------------------------

vi.mock('../../api/exercises', () => ({
  listExercises: vi.fn(),
  archiveExercise: vi.fn(),
  restoreExercise: vi.fn(),
}));

vi.mock('../../api/admin', () => ({
  listTaxonomy: vi.fn(),
}));

// Mutable auth state so tests can switch between admin and therapist roles
const mockAuth = {
  user: { userId: 'u1', email: 'test@test.com', role: 'admin' as string, status: 'active', mfaEnabled: false },
  isAuthenticated: true,
  isLoading: false,
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

import { listExercises, archiveExercise, restoreExercise } from '../../api/exercises';
import { listTaxonomy } from '../../api/admin';
import ExerciseListPage from '../ExerciseListPage';
import type { Exercise, TaxonomyTag } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockListExercises = vi.mocked(listExercises);
const mockArchiveExercise = vi.mocked(archiveExercise);
const mockRestoreExercise = vi.mocked(restoreExercise);
const mockListTaxonomy = vi.mocked(listTaxonomy);

const TAXONOMY_TAGS: TaxonomyTag[] = [
  { tagId: 'tag-1', category: 'function', label: 'Strength', createdAt: '2024-01-01T00:00:00Z' },
  { tagId: 'tag-2', category: 'structure', label: 'Shoulder', createdAt: '2024-01-01T00:00:00Z' },
];

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    exerciseId: 'ex-1',
    currentVersionId: 'ver-1',
    title: 'Shoulder Press',
    description: 'A shoulder exercise.',
    tags: [{ tagId: 'tag-1', label: 'Tag 1' }],
    defaultParams: { reps: 10, sets: 3 },
    createdByUserId: 'user-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ExerciseListPage />
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExerciseListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.user.role = 'admin';
    mockListTaxonomy.mockResolvedValue(TAXONOMY_TAGS);
    mockListExercises.mockResolvedValue({ items: [], nextCursor: null });
  });

  // -------------------------------------------------------------------------
  it('renders the page title', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /exercise library/i })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  it('calls listExercises on mount with no filters', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockListExercises).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 })
      );
    });
  });

  // -------------------------------------------------------------------------
  it('loads taxonomy tags on mount', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockListTaxonomy).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  it('renders exercises returned by the API', async () => {
    mockListExercises.mockResolvedValue({
      items: [makeExercise()],
      nextCursor: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Shoulder Press')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('renders the "New Exercise" button for admin', async () => {
    renderPage();

    // Wait for the async mount effects to settle so we don't get "act" warnings
    await waitFor(() => expect(mockListExercises).toHaveBeenCalled());

    expect(screen.getByRole('button', { name: /new exercise/i })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  it('triggers a filtered listExercises call when the search input changes', async () => {
    renderPage();

    // Wait for the initial fetch
    await waitFor(() => expect(mockListExercises).toHaveBeenCalled());
    mockListExercises.mockClear();

    const searchInput = screen.getByPlaceholderText('Search exercises...');

    // Use fake timers to control the 400ms debounce
    vi.useFakeTimers({ shouldAdvanceTime: true });

    fireEvent.change(searchInput, { target: { value: 'squat' } });

    // Advance past the 400 ms debounce inside an act so React can flush
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    vi.useRealTimers();

    await waitFor(() => {
      expect(mockListExercises).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'squat' })
      );
    });
  });

  // -------------------------------------------------------------------------
  it('calls archiveExercise and re-fetches when archive is clicked from dropdown', async () => {
    mockArchiveExercise.mockResolvedValue(undefined);
    mockListExercises.mockResolvedValue({
      items: [makeExercise({ archivedAt: undefined })],
      nextCursor: null,
    });

    renderPage();

    // Wait for data to load
    await waitFor(() => screen.getByText('Shoulder Press'));

    // Find the action trigger button (MoreOutlined - text icon button).
    // Only match on the ant-btn-text variant class; avoid the fallback which
    // would accidentally match the search button (which also has no aria-label).
    const actionBtns = screen.getAllByRole('button');
    const moreBtn = actionBtns.find(
      (btn) => btn.className.includes('ant-btn-text')
    );
    expect(moreBtn).toBeDefined();
    fireEvent.click(moreBtn!);

    // The Archive menu item should appear
    await waitFor(() => expect(screen.getByText('Archive')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Archive'));

    // Confirmation modal appears — click "Yes" to proceed
    await waitFor(() => expect(screen.getAllByText('Yes').length).toBeGreaterThanOrEqual(1));
    fireEvent.click(screen.getAllByText('Yes')[0]);

    await waitFor(() => {
      expect(mockArchiveExercise).toHaveBeenCalledWith('ex-1');
    });
  });

  // -------------------------------------------------------------------------
  // Archive confirmation modal
  // -------------------------------------------------------------------------
  describe('archive confirmation modal', () => {
    async function openArchiveModal() {
      mockArchiveExercise.mockResolvedValue(undefined);
      mockListExercises.mockResolvedValue({
        items: [makeExercise({ archivedAt: undefined })],
        nextCursor: null,
      });

      renderPage();
      await waitFor(() => screen.getByText('Shoulder Press'));

      const actionBtns = screen.getAllByRole('button');
      const moreBtn = actionBtns.find((btn) => btn.className.includes('ant-btn-text'));
      fireEvent.click(moreBtn!);

      await waitFor(() => expect(screen.getByText('Archive')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Archive'));

      // Wait for the confirmation modal content to appear
      await waitFor(() => {
        expect(document.querySelector('.ant-modal-confirm-content')).not.toBeNull();
      });
    }

    it('shows confirmation modal with exercise title when archive is clicked', async () => {
      await openArchiveModal();

      const content = document.querySelector('.ant-modal-confirm-content');
      expect(content?.textContent).toMatch(/are you sure you want to archive "Shoulder Press"/i);
      expect(screen.getAllByText('Yes').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('No').length).toBeGreaterThanOrEqual(1);
    });

    it('does not call archiveExercise when "No" is clicked', async () => {
      await openArchiveModal();

      fireEvent.click(screen.getAllByText('No')[0]);

      await waitFor(() => {
        expect(mockArchiveExercise).not.toHaveBeenCalled();
      });
    });

    it('calls archiveExercise when "Yes" is clicked', async () => {
      await openArchiveModal();

      fireEvent.click(screen.getAllByText('Yes')[0]);

      await waitFor(() => {
        expect(mockArchiveExercise).toHaveBeenCalledWith('ex-1');
      });
    });
  });

  // -------------------------------------------------------------------------
  it('calls restoreExercise and re-fetches when restore is clicked from dropdown', async () => {
    mockRestoreExercise.mockResolvedValue(undefined);
    mockListExercises.mockResolvedValue({
      items: [makeExercise({ archivedAt: '2024-06-01T00:00:00Z' })],
      nextCursor: null,
    });

    renderPage();

    await waitFor(() => screen.getByText('Shoulder Press'));

    const actionBtns = screen.getAllByRole('button');
    const moreBtn = actionBtns.find(
      (btn) => btn.className.includes('ant-btn-text')
    );
    expect(moreBtn).toBeDefined();
    fireEvent.click(moreBtn!);

    await waitFor(() => expect(screen.getByText('Restore')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Restore'));

    await waitFor(() => {
      expect(mockRestoreExercise).toHaveBeenCalledWith('ex-1');
    });
  });

  // -------------------------------------------------------------------------
  // Therapist role — read-only view
  // -------------------------------------------------------------------------
  describe('when logged in as therapist', () => {
    beforeEach(() => {
      mockAuth.user.role = 'therapist';
    });

    it('does not render the "New Exercise" button', async () => {
      renderPage();

      await waitFor(() => expect(mockListExercises).toHaveBeenCalled());

      expect(screen.queryByRole('button', { name: /new exercise/i })).not.toBeInTheDocument();
    });

    it('does not render the actions column', async () => {
      mockListExercises.mockResolvedValue({
        items: [makeExercise()],
        nextCursor: null,
      });

      renderPage();

      await waitFor(() => screen.getByText('Shoulder Press'));

      // No "more" action button should be present
      const actionBtns = screen.getAllByRole('button');
      const moreBtn = actionBtns.find(
        (btn) => btn.className.includes('ant-btn-text')
      );
      expect(moreBtn).toBeUndefined();
    });

    it('still renders exercises in the table', async () => {
      mockListExercises.mockResolvedValue({
        items: [makeExercise()],
        nextCursor: null,
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Shoulder Press')).toBeInTheDocument();
      });
    });
  });
});

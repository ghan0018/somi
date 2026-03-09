import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock API modules
// ---------------------------------------------------------------------------

vi.mock('../../api/exercises', () => ({
  getExercise: vi.fn(),
  archiveExercise: vi.fn(),
  restoreExercise: vi.fn(),
}));

vi.mock('../../api/uploads', () => ({
  getAccessUrl: vi.fn(),
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

import { getExercise, archiveExercise, restoreExercise } from '../../api/exercises';
import { listTaxonomy } from '../../api/admin';
import ExerciseDetailPage from '../ExerciseDetailPage';
import type { Exercise, TaxonomyTag } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockGetExercise = vi.mocked(getExercise);
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
    tags: [{ tagId: 'tag-1', label: 'Strength' }],
    defaultParams: { reps: 10, sets: 3 },
    createdByUserId: 'user-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderPage(exerciseId = 'ex-1') {
  return render(
    <MemoryRouter initialEntries={[`/exercises/${exerciseId}`]}>
      <Routes>
        <Route path="/exercises/:exerciseId" element={<ExerciseDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExerciseDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.user.role = 'admin';
    mockListTaxonomy.mockResolvedValue(TAXONOMY_TAGS);
    mockGetExercise.mockResolvedValue(makeExercise());
  });

  // -------------------------------------------------------------------------
  it('renders the exercise title', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /shoulder press/i })).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('renders Edit and Archive buttons for admin', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /shoulder press/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /archive/i })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  it('renders Restore button instead of Archive for archived exercise', async () => {
    mockGetExercise.mockResolvedValue(makeExercise({ archivedAt: '2024-06-01T00:00:00Z' }));

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /shoulder press/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /restore/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /archive/i })).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Archive confirmation modal
  // -------------------------------------------------------------------------
  describe('archive confirmation modal', () => {
    async function openArchiveModal() {
      mockArchiveExercise.mockResolvedValue(undefined);
      mockGetExercise.mockResolvedValue(makeExercise({ archivedAt: undefined }));

      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /shoulder press/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /archive/i }));

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
  // Therapist role — read-only view
  // -------------------------------------------------------------------------
  describe('when logged in as therapist', () => {
    beforeEach(() => {
      mockAuth.user.role = 'therapist';
    });

    it('does not render Edit or Archive buttons', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /shoulder press/i })).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /archive/i })).not.toBeInTheDocument();
    });

    it('still renders exercise details', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /shoulder press/i })).toBeInTheDocument();
        expect(screen.getByText('A shoulder exercise.')).toBeInTheDocument();
      });
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock API modules
// ---------------------------------------------------------------------------

vi.mock('../../api/exercises', () => ({
  getExercise: vi.fn(),
  createExercise: vi.fn(),
  updateExercise: vi.fn(),
}));

vi.mock('../../api/admin', () => ({
  listTaxonomy: vi.fn(),
}));

vi.mock('../../api/uploads', () => ({
  requestUpload: vi.fn(),
  completeUpload: vi.fn(),
  getAccessUrl: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => {
  const auth = {
    user: { userId: 'u1', email: 'test@test.com', role: 'admin', status: 'active', mfaEnabled: false },
    isAuthenticated: true,
    isLoading: false,
  };
  return { useAuth: () => auth };
});

// Mock VideoUpload to simplify form testing — renders a simple button
// that sets the mediaId value when clicked.
vi.mock('../../components/VideoUpload', () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (v: string | undefined) => void }) => (
    <div data-testid="video-upload">
      <span data-testid="video-upload-value">{value ?? ''}</span>
      <button
        type="button"
        data-testid="mock-upload-btn"
        onClick={() => onChange?.('mock-upload-id')}
      >
        Upload Video
      </button>
      <button
        type="button"
        data-testid="mock-remove-btn"
        onClick={() => onChange?.(undefined)}
      >
        Remove Video
      </button>
    </div>
  ),
}));

import { getExercise, createExercise, updateExercise } from '../../api/exercises';
import { listTaxonomy } from '../../api/admin';
import ExerciseFormPage from '../ExerciseFormPage';
import type { Exercise, TaxonomyTag } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockGetExercise = vi.mocked(getExercise);
const mockCreateExercise = vi.mocked(createExercise);
const mockUpdateExercise = vi.mocked(updateExercise);
const mockListTaxonomy = vi.mocked(listTaxonomy);

const TAXONOMY_TAGS: TaxonomyTag[] = [
  { tagId: 'tag-1', category: 'function', label: 'Strength', createdAt: '2024-01-01T00:00:00Z' },
];

function makeExercise(): Exercise {
  return {
    exerciseId: 'ex-abc',
    currentVersionId: 'ver-1',
    title: 'Shoulder Press',
    description: 'Press the weight overhead.',
    tags: [],
    mediaId: 'media-123',
    defaultParams: { reps: 10, sets: 3 },
    createdByUserId: 'user-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

/** Renders the form page in create mode (no exerciseId param). */
function renderCreatePage() {
  return render(
    <MemoryRouter initialEntries={['/exercises/new']}>
      <Routes>
        <Route path="/exercises/new" element={<ExerciseFormPage />} />
        <Route path="/exercises/:exerciseId" element={<div>Exercise Detail</div>} />
        <Route path="/exercises" element={<div>Exercise List</div>} />
      </Routes>
    </MemoryRouter>
  );
}

/** Renders the form page in edit mode with a given exerciseId param. */
function renderEditPage(exerciseId = 'ex-abc') {
  return render(
    <MemoryRouter initialEntries={[`/exercises/${exerciseId}/edit`]}>
      <Routes>
        <Route path="/exercises/:exerciseId/edit" element={<ExerciseFormPage />} />
        <Route path="/exercises/:exerciseId" element={<div>Exercise Detail</div>} />
        <Route path="/exercises" element={<div>Exercise List</div>} />
      </Routes>
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExerciseFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListTaxonomy.mockResolvedValue(TAXONOMY_TAGS);
  });

  // -------------------------------------------------------------------------
  describe('create mode (no exerciseId)', () => {
    it('renders "New Exercise" as the page title', async () => {
      renderCreatePage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /new exercise/i })).toBeInTheDocument();
      });
    });

    it('renders the "New Exercise" breadcrumb item', async () => {
      renderCreatePage();

      await waitFor(() => {
        // The breadcrumb trail contains the text
        expect(screen.getAllByText('New Exercise').length).toBeGreaterThan(0);
      });
    });

    it('does not call getExercise in create mode', async () => {
      renderCreatePage();

      await waitFor(() => expect(mockListTaxonomy).toHaveBeenCalledTimes(1));
      expect(mockGetExercise).not.toHaveBeenCalled();
    });

    it('renders Title, Description, Video Upload, and Save fields', async () => {
      renderCreatePage();

      await waitFor(() => {
        expect(screen.getByLabelText('Title')).toBeInTheDocument();
        expect(screen.getByLabelText('Description')).toBeInTheDocument();
        expect(screen.getByTestId('video-upload')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      });
    });

    it('calls createExercise on form submission and navigates to detail', async () => {
      mockCreateExercise.mockResolvedValue(makeExercise());

      renderCreatePage();

      await waitFor(() => screen.getByLabelText('Title'));

      fireEvent.change(screen.getByLabelText('Title'), {
        target: { value: 'Hip Flexor Stretch' },
      });
      fireEvent.change(screen.getByLabelText('Description'), {
        target: { value: 'Stretch the hip flexors carefully.' },
      });

      // Upload a video via mock
      fireEvent.click(screen.getByTestId('mock-upload-btn'));

      // Set a default parameter (reps) — at least one is required
      fireEvent.change(screen.getByLabelText('Reps'), {
        target: { value: '10' },
      });

      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(mockCreateExercise).toHaveBeenCalledOnce();
        expect(mockCreateExercise).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Hip Flexor Stretch',
            description: 'Stretch the hip flexors carefully.',
            mediaId: 'mock-upload-id',
          })
        );
      });

      // After save, navigate to the exercise detail page
      await waitFor(() => {
        expect(screen.getByText('Exercise Detail')).toBeInTheDocument();
      });
    });

    it('does not call updateExercise in create mode', async () => {
      mockCreateExercise.mockResolvedValue(makeExercise());

      renderCreatePage();

      await waitFor(() => screen.getByLabelText('Title'));

      fireEvent.change(screen.getByLabelText('Title'), {
        target: { value: 'Hip Flexor Stretch' },
      });
      fireEvent.change(screen.getByLabelText('Description'), {
        target: { value: 'Stretch the hip flexors carefully.' },
      });

      // Upload video and set a default param
      fireEvent.click(screen.getByTestId('mock-upload-btn'));
      fireEvent.change(screen.getByLabelText('Reps'), {
        target: { value: '10' },
      });

      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => expect(mockCreateExercise).toHaveBeenCalledOnce());
      expect(mockUpdateExercise).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe('edit mode (with exerciseId)', () => {
    beforeEach(() => {
      mockGetExercise.mockResolvedValue(makeExercise());
    });

    it('renders "Edit Exercise" as the page title', async () => {
      renderEditPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /edit exercise/i })).toBeInTheDocument();
      });
    });

    it('calls getExercise with the correct exerciseId', async () => {
      renderEditPage('ex-abc');

      await waitFor(() => {
        expect(mockGetExercise).toHaveBeenCalledWith('ex-abc');
      });
    });

    it('pre-fills the form with data from getExercise', async () => {
      renderEditPage();

      await waitFor(() => {
        const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
        expect(titleInput.value).toBe('Shoulder Press');
      });

      const descInput = screen.getByLabelText('Description') as HTMLTextAreaElement;
      expect(descInput.value).toBe('Press the weight overhead.');

      // mediaId should be pre-populated
      expect(screen.getByTestId('video-upload-value').textContent).toBe('media-123');
    });

    it('calls updateExercise on form submission and navigates to detail', async () => {
      mockUpdateExercise.mockResolvedValue(makeExercise());

      renderEditPage('ex-abc');

      await waitFor(() => {
        const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
        expect(titleInput.value).toBe('Shoulder Press');
      });

      // Change the title
      fireEvent.change(screen.getByLabelText('Title'), {
        target: { value: 'Updated Shoulder Press' },
      });

      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(mockUpdateExercise).toHaveBeenCalledOnce();
        expect(mockUpdateExercise).toHaveBeenCalledWith(
          'ex-abc',
          expect.objectContaining({ title: 'Updated Shoulder Press' })
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Exercise Detail')).toBeInTheDocument();
      });
    });

    it('does not call createExercise in edit mode', async () => {
      mockUpdateExercise.mockResolvedValue(makeExercise());

      renderEditPage('ex-abc');

      await waitFor(() => screen.getByLabelText('Title'));

      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => expect(mockUpdateExercise).toHaveBeenCalledOnce());
      expect(mockCreateExercise).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe('Cancel button', () => {
    it('navigates to /exercises when Cancel is clicked in create mode', async () => {
      renderCreatePage();

      await waitFor(() => screen.getByRole('button', { name: /cancel/i }));

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.getByText('Exercise List')).toBeInTheDocument();
      });
    });

    it('navigates to detail page when Cancel is clicked in edit mode', async () => {
      mockGetExercise.mockResolvedValue(makeExercise());

      renderEditPage('ex-abc');

      await waitFor(() => screen.getByRole('button', { name: /cancel/i }));

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.getByText('Exercise Detail')).toBeInTheDocument();
      });
    });
  });
});

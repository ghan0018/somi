import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock the admin API module
// ---------------------------------------------------------------------------

vi.mock('../../api/admin', () => ({
  listTaxonomy: vi.fn(),
  createTag: vi.fn(),
  deleteTag: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => {
  const auth = {
    user: { userId: 'u1', email: 'test@test.com', role: 'admin', status: 'active', mfaEnabled: false },
    isAuthenticated: true,
    isLoading: false,
  };
  return { useAuth: () => auth };
});

import { listTaxonomy, createTag, deleteTag } from '../../api/admin';
import AdminTaxonomyPage from '../AdminTaxonomyPage';
import type { TaxonomyTag } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockListTaxonomy = vi.mocked(listTaxonomy);
const mockCreateTag = vi.mocked(createTag);
const mockDeleteTag = vi.mocked(deleteTag);

function makeTag(overrides: Partial<TaxonomyTag> = {}): TaxonomyTag {
  return {
    tagId: 'tag-1',
    category: 'function',
    label: 'Strength',
    createdAt: '2024-01-01T00:00:00Z',
    inUse: false,
    ...overrides,
  };
}

const SAMPLE_TAGS: TaxonomyTag[] = [
  makeTag({ tagId: 'tag-1', category: 'function', label: 'Strength', inUse: true }),
  makeTag({ tagId: 'tag-2', category: 'function', label: 'Flexibility', inUse: false }),
  makeTag({ tagId: 'tag-3', category: 'structure', label: 'Shoulder', inUse: true }),
  makeTag({ tagId: 'tag-4', category: 'age', label: 'Adult', inUse: false }),
];

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminTaxonomyPage />
    </MemoryRouter>
  );
}

// Opens the Add Tag modal and returns after the label input is visible.
async function openAddTagModal() {
  await waitFor(() => screen.getByRole('button', { name: /add tag/i }));
  fireEvent.click(screen.getByRole('button', { name: /add tag/i }));
  await waitFor(() => screen.getByPlaceholderText('Tag label'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminTaxonomyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListTaxonomy.mockResolvedValue([]);
    mockCreateTag.mockResolvedValue(makeTag());
    mockDeleteTag.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  it('renders the "Exercise Labels" heading', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /exercise labels/i })).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('calls listTaxonomy on mount', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockListTaxonomy).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  it('renders category section headings for Function, Structure, and Age', async () => {
    renderPage();

    await waitFor(() => {
      // Use getAllByRole since Ant Design may render heading text more than once
      expect(
        screen.getAllByRole('heading').map((h) => h.textContent)
      ).toEqual(expect.arrayContaining(['Function', 'Structure', 'Age']));
    });
  });

  // -------------------------------------------------------------------------
  it('renders tags grouped under their correct category', async () => {
    mockListTaxonomy.mockResolvedValue(SAMPLE_TAGS);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Strength')).toBeInTheDocument();
      expect(screen.getByText('Flexibility')).toBeInTheDocument();
      expect(screen.getByText('Shoulder')).toBeInTheDocument();
      expect(screen.getByText('Adult')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('renders the "Add Tag" button', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add tag/i })).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('opens the Add Tag modal when the "Add Tag" button is clicked', async () => {
    renderPage();

    await openAddTagModal();

    // The label input only exists inside the modal
    expect(screen.getByPlaceholderText('Tag label')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  it('closes the modal when Cancel is clicked', async () => {
    renderPage();

    await openAddTagModal();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    // Ant Design v6 transitions the modal out using CSS animations; the modal
    // DOM stays briefly.  The ant-modal-content node is removed once the leave
    // animation completes. Use that as the close signal.
    await waitFor(() => {
      expect(document.querySelector('.ant-modal-content')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  it('calls createTag with category and label when the Add Tag form is submitted', async () => {
    renderPage();

    await openAddTagModal();

    // Open the category dropdown and pick "Function".
    // Use getByTitle because the page already has a "Function" heading, so
    // getByText('Function') would match multiple elements.
    const categorySelect = screen.getByRole('combobox');
    fireEvent.mouseDown(categorySelect);

    await waitFor(() => screen.getByTitle('Function'));
    fireEvent.click(screen.getByTitle('Function'));

    // Fill in the label
    fireEvent.change(screen.getByPlaceholderText('Tag label'), {
      target: { value: 'Balance' },
    });

    // Submit modal
    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));

    await waitFor(() => {
      expect(mockCreateTag).toHaveBeenCalledOnce();
      expect(mockCreateTag).toHaveBeenCalledWith({
        category: 'function',
        label: 'Balance',
      });
    });
  });

  // -------------------------------------------------------------------------
  it('re-fetches taxonomy after a successful tag creation', async () => {
    renderPage();

    await waitFor(() => expect(mockListTaxonomy).toHaveBeenCalledTimes(1));

    await openAddTagModal();

    const categorySelect = screen.getByRole('combobox');
    fireEvent.mouseDown(categorySelect);
    await waitFor(() => screen.getByTitle('Function'));
    fireEvent.click(screen.getByTitle('Function'));

    fireEvent.change(screen.getByPlaceholderText('Tag label'), {
      target: { value: 'Balance' },
    });

    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));

    await waitFor(() => {
      // mount fetch + post-create fetch
      expect(mockListTaxonomy).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  it('closes the modal after successful tag creation', async () => {
    renderPage();

    await openAddTagModal();

    const categorySelect = screen.getByRole('combobox');
    fireEvent.mouseDown(categorySelect);
    await waitFor(() => screen.getByTitle('Age'));
    fireEvent.click(screen.getByTitle('Age'));

    fireEvent.change(screen.getByPlaceholderText('Tag label'), {
      target: { value: 'Senior' },
    });

    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));

    await waitFor(() => {
      expect(document.querySelector('.ant-modal-content')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  it('does not show close icon for in-use tags', async () => {
    mockListTaxonomy.mockResolvedValue([
      makeTag({ tagId: 'tag-in-use', category: 'function', label: 'InUseTag', inUse: true }),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('InUseTag')).toBeInTheDocument();
    });

    // The tag element should not have a close icon
    const tagEl = screen.getByText('InUseTag').closest('.ant-tag');
    expect(tagEl).toBeTruthy();
    expect(tagEl!.querySelector('.ant-tag-close-icon')).toBeNull();
  });

  // -------------------------------------------------------------------------
  it('shows close icon for unused tags', async () => {
    mockListTaxonomy.mockResolvedValue([
      makeTag({ tagId: 'tag-unused', category: 'function', label: 'UnusedTag', inUse: false }),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('UnusedTag')).toBeInTheDocument();
    });

    // The tag element should have a close icon
    const tagEl = screen.getByText('UnusedTag').closest('.ant-tag');
    expect(tagEl).toBeTruthy();
    expect(tagEl!.querySelector('.ant-tag-close-icon')).not.toBeNull();
  });
});

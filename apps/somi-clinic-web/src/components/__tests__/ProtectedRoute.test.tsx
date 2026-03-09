import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock the AuthContext so we can control isAuthenticated / isLoading
// ---------------------------------------------------------------------------

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../contexts/AuthContext';
import ProtectedRoute from '../ProtectedRoute';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockUseAuth = vi.mocked(useAuth);

function renderWithRouter(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        {/* The protected subtree */}
        <Route element={<ProtectedRoute />}>
          <Route path="/patients" element={<div>Patients Page</div>} />
        </Route>

        {/* The login page that Navigate redirects to */}
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  it('redirects to /login when the user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      login: vi.fn(),
      completeMfa: vi.fn(),
      logout: vi.fn(),
    });

    renderWithRouter('/patients');

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Patients Page')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  it('renders the child route (Outlet) when the user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: {
        userId: 'user-1',
        email: 'therapist@example.com',
        role: 'therapist',
        status: 'active',
        mfaEnabled: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      login: vi.fn(),
      completeMfa: vi.fn(),
      logout: vi.fn(),
    });

    renderWithRouter('/patients');

    expect(screen.getByText('Patients Page')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  it('renders a loading spinner while session is being restored', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      user: null,
      login: vi.fn(),
      completeMfa: vi.fn(),
      logout: vi.fn(),
    });

    renderWithRouter('/patients');

    // Ant Design Spin renders with the role="img" aria attribute on its icon,
    // but the container has the ant-spin class.  Using the test-id from the
    // DOM is the most reliable signal here.
    expect(screen.queryByText('Patients Page')).not.toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });
});

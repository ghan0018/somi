import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock the admin API module
// ---------------------------------------------------------------------------

vi.mock('../../api/admin', () => ({
  listUsers: vi.fn(),
  inviteUser: vi.fn(),
  disableUser: vi.fn(),
  enableUser: vi.fn(),
  resetMfa: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => {
  const auth = {
    user: { userId: 'u1', email: 'test@test.com', role: 'admin', status: 'active', mfaEnabled: false },
    isAuthenticated: true,
    isLoading: false,
  };
  return { useAuth: () => auth };
});

import { listUsers, inviteUser, disableUser, enableUser, resetMfa } from '../../api/admin';
import AdminUsersPage from '../AdminUsersPage';
import type { User } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockListUsers = vi.mocked(listUsers);
const mockInviteUser = vi.mocked(inviteUser);
const mockDisableUser = vi.mocked(disableUser);
const mockEnableUser = vi.mocked(enableUser);
const mockResetMfa = vi.mocked(resetMfa);

function makeUser(overrides: Partial<User> = {}): User {
  return {
    userId: 'user-1',
    email: 'therapist@clinic.com',
    role: 'therapist',
    status: 'active',
    mfaEnabled: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminUsersPage />
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListUsers.mockResolvedValue({ items: [], nextCursor: null });
    mockInviteUser.mockResolvedValue(undefined);
    mockDisableUser.mockResolvedValue(undefined);
    mockEnableUser.mockResolvedValue(undefined);
    mockResetMfa.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  it('renders the "User Management" heading', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /user management/i })).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('calls listUsers on mount', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockListUsers).toHaveBeenCalledOnce();
      expect(mockListUsers).toHaveBeenCalledWith({ limit: 100 });
    });
  });

  // -------------------------------------------------------------------------
  it('renders table columns: Email, Role, Status, MFA, Actions', async () => {
    renderPage();

    await waitFor(() => {
      // Ant Design renders column headers in both a <th> and a hidden <div> for
      // sizing purposes, so we assert at least one occurrence of each.
      expect(screen.getAllByText('Email').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Role').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Status').length).toBeGreaterThan(0);
      expect(screen.getAllByText('MFA').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Actions').length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  it('renders user rows returned by the API', async () => {
    mockListUsers.mockResolvedValue({
      items: [
        makeUser({ email: 'alice@clinic.com', role: 'therapist' }),
        makeUser({ userId: 'user-2', email: 'bob@clinic.com', role: 'admin' }),
      ],
      nextCursor: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('alice@clinic.com')).toBeInTheDocument();
      expect(screen.getByText('bob@clinic.com')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('renders role and status tags for each user', async () => {
    mockListUsers.mockResolvedValue({
      items: [makeUser({ role: 'admin', status: 'active', mfaEnabled: false })],
      nextCursor: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument();
      // StatusTag capitalizes status labels
      expect(screen.getByText('Active')).toBeInTheDocument();
      // mfaEnabled: false → "disabled" tag (MFA tag remains lowercase)
      expect(screen.getByText('disabled')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('opens the Invite User modal when the "Invite User" button is clicked', async () => {
    renderPage();

    await waitFor(() => screen.getByRole('button', { name: /invite user/i }));

    fireEvent.click(screen.getByRole('button', { name: /invite user/i }));

    await waitFor(() => {
      // The email placeholder only appears inside the modal form
      expect(screen.getByPlaceholderText('user@example.com')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('closes the modal when Cancel is clicked', async () => {
    renderPage();

    await waitFor(() => screen.getByRole('button', { name: /invite user/i }));
    fireEvent.click(screen.getByRole('button', { name: /invite user/i }));

    // Wait for the form input inside the modal to appear
    await waitFor(() => screen.getByPlaceholderText('user@example.com'));

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    // Ant Design v6 transitions the modal out using CSS animations; the modal
    // DOM stays briefly.  The ant-modal-content node is removed once the leave
    // animation completes.  Use that as the close signal.
    await waitFor(() => {
      expect(document.querySelector('.ant-modal-content')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  it('calls inviteUser with email and role when modal is submitted', async () => {
    mockListUsers.mockResolvedValue({ items: [], nextCursor: null });

    renderPage();

    await waitFor(() => screen.getByRole('button', { name: /invite user/i }));
    fireEvent.click(screen.getByRole('button', { name: /invite user/i }));

    await waitFor(() => screen.getByPlaceholderText('user@example.com'));

    // Fill the email field
    fireEvent.change(screen.getByPlaceholderText('user@example.com'), {
      target: { value: 'newuser@clinic.com' },
    });

    // Select a role — Ant Design Select: open the dropdown then click an option
    const roleSelect = screen.getByRole('combobox');
    fireEvent.mouseDown(roleSelect);

    await waitFor(() => screen.getByText('Therapist'));
    fireEvent.click(screen.getByText('Therapist'));

    // Submit by clicking the modal's OK button
    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));

    await waitFor(() => {
      expect(mockInviteUser).toHaveBeenCalledOnce();
      expect(mockInviteUser).toHaveBeenCalledWith({
        email: 'newuser@clinic.com',
        role: 'therapist',
      });
    });
  });

  // -------------------------------------------------------------------------
  it('re-fetches users after a successful invite', async () => {
    renderPage();

    // Wait for initial fetch
    await waitFor(() => expect(mockListUsers).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /invite user/i }));
    await waitFor(() => screen.getByPlaceholderText('user@example.com'));

    fireEvent.change(screen.getByPlaceholderText('user@example.com'), {
      target: { value: 'new@clinic.com' },
    });

    const roleSelect = screen.getByRole('combobox');
    fireEvent.mouseDown(roleSelect);
    await waitFor(() => screen.getByText('Therapist'));
    fireEvent.click(screen.getByText('Therapist'));

    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));

    await waitFor(() => {
      // Called once on mount + once after invite
      expect(mockListUsers).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  it('renders Disable and Reset MFA buttons for each active user row', async () => {
    mockListUsers.mockResolvedValue({
      items: [makeUser({ status: 'active' })],
      nextCursor: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /disable/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reset mfa/i })).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('renders Enable button for disabled users', async () => {
    mockListUsers.mockResolvedValue({
      items: [makeUser({ status: 'disabled' })],
      nextCursor: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /enable/i })).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('renders Disable button for active users', async () => {
    mockListUsers.mockResolvedValue({
      items: [makeUser({ status: 'active' })],
      nextCursor: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /disable/i })).toBeInTheDocument();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock the AuthContext
// ---------------------------------------------------------------------------

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../contexts/AuthContext';
import LoginPage from '../LoginPage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockUseAuth = vi.mocked(useAuth);

/** Renders LoginPage inside a MemoryRouter with a /patients route we can assert on. */
function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/patients" element={<div>Patients Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

/** Fill in the login form and submit it. */
async function submitLoginForm(email: string, password: string) {
  // Ant Design renders <input> elements inside its form items
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
    target: { value: email },
  });
  fireEvent.change(screen.getByPlaceholderText('Password'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LoginPage', () => {
  const mockLogin = vi.fn();
  const mockCompleteMfa = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      login: mockLogin,
      completeMfa: mockCompleteMfa,
      logout: vi.fn(),
    });
  });

  // -------------------------------------------------------------------------
  it('renders email field, password field and Sign In button', () => {
    renderLoginPage();

    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  it('calls the login function from auth context on form submit', async () => {
    mockLogin.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });

    renderLoginPage();

    await submitLoginForm('doctor@clinic.com', 'secret123');

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledOnce();
      expect(mockLogin).toHaveBeenCalledWith('doctor@clinic.com', 'secret123');
    });
  });

  // -------------------------------------------------------------------------
  it('navigates to /patients after a successful login', async () => {
    mockLogin.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });

    renderLoginPage();

    await submitLoginForm('doctor@clinic.com', 'secret123');

    await waitFor(() => {
      expect(screen.getByText('Patients Page')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  it('shows the MFA code input when login returns an mfaRequired challenge', async () => {
    mockLogin.mockResolvedValue({
      challengeId: 'chal-abc',
      mfaRequired: true,
    });

    renderLoginPage();

    await submitLoginForm('doctor@clinic.com', 'secret123');

    await waitFor(() => {
      expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /verify/i })).toBeInTheDocument();
    });

    // The original login form fields should no longer be visible
    expect(screen.queryByPlaceholderText('you@example.com')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  it('calls completeMfa with the challengeId and entered code, then navigates to /patients', async () => {
    mockLogin.mockResolvedValue({ challengeId: 'chal-abc', mfaRequired: true });
    mockCompleteMfa.mockResolvedValue(undefined);

    renderLoginPage();

    // Step 1: submit login to get into MFA state
    await submitLoginForm('doctor@clinic.com', 'secret123');
    await waitFor(() => expect(screen.getByPlaceholderText('000000')).toBeInTheDocument());

    // Step 2: enter MFA code and submit
    fireEvent.change(screen.getByPlaceholderText('000000'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() => {
      expect(mockCompleteMfa).toHaveBeenCalledOnce();
      expect(mockCompleteMfa).toHaveBeenCalledWith('chal-abc', '123456');
    });

    await waitFor(() => {
      expect(screen.getByText('Patients Page')).toBeInTheDocument();
    });
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import SomiLogo from '../SomiLogo';

describe('SomiLogo', () => {
  it('renders the SVG mark without crashing', () => {
    const { container } = render(<SomiLogo />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('does not show "SOMI" text by default', () => {
    render(<SomiLogo />);
    expect(screen.queryByText('SOMI')).not.toBeInTheDocument();
  });

  it('shows "SOMI" text when showText is true and collapsed is false', () => {
    render(<SomiLogo showText collapsed={false} />);
    expect(screen.getByText('SOMI')).toBeInTheDocument();
  });

  it('hides "SOMI" text when collapsed is true even if showText is true', () => {
    render(<SomiLogo showText collapsed />);
    expect(screen.queryByText('SOMI')).not.toBeInTheDocument();
  });
});

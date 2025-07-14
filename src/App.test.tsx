import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the app title', () => {
    render(<App />);
    expect(screen.getByText('Bulk Image Optimizer')).toBeInTheDocument();
  });

  it('renders welcome message', () => {
    render(<App />);
    expect(
      screen.getByText(/Welcome to Bulk Image Optimizer/)
    ).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    render(<App />);
    expect(
      screen.getByRole('button', { name: 'Get Started' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Learn More' })
    ).toBeInTheDocument();
  });
});

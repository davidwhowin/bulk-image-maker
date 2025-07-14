import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Layout } from './Layout';

describe('Layout', () => {
  it('renders header with title', () => {
    render(
      <Layout>
        <div>Test content</div>
      </Layout>
    );

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByText('Bulk Image Optimizer')).toBeInTheDocument();
  });

  it('renders children content', () => {
    const testContent = 'Test content for layout';
    render(
      <Layout>
        <div>{testContent}</div>
      </Layout>
    );

    expect(screen.getByText(testContent)).toBeInTheDocument();
  });

  it('renders footer', () => {
    render(
      <Layout>
        <div>Test content</div>
      </Layout>
    );

    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(
      screen.getByText(/© 2024 Bulk Image Optimizer/)
    ).toBeInTheDocument();
  });
});

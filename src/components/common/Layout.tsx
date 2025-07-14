import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="container-custom py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Bulk Image Optimizer
          </h1>
        </div>
      </header>
      <main className="container-custom py-8">{children}</main>
      <footer className="mt-auto border-t border-gray-200 py-8">
        <div className="container-custom text-center text-gray-600">
          <p>© 2024 Bulk Image Optimizer. Built with React and TypeScript.</p>
        </div>
      </footer>
    </div>
  );
}

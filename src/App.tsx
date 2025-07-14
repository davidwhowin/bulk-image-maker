import { Layout } from '@/components';

function App() {
  return (
    <Layout>
      <div className="card mx-auto max-w-2xl">
        <h2 className="mb-4 text-2xl font-semibold text-gray-900">
          Welcome to Bulk Image Optimizer
        </h2>
        <p className="mb-6 text-gray-600">
          This tool will help you compress and optimize multiple images at once.
          Upload your images, configure compression settings, and download the
          optimized results.
        </p>
        <div className="flex justify-center gap-4">
          <button className="btn-primary">Get Started</button>
          <button className="btn-secondary">Learn More</button>
        </div>
      </div>
    </Layout>
  );
}

export default App;

import { AlertCircle } from 'lucide-react';

export default function BuildErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center px-4">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Build Error
        </h1>
        <p className="text-gray-600 max-w-md mx-auto">
          There was an error building this website. The site owner has been notified
          and is working on resolving the issue.
        </p>
      </div>
    </div>
  );
}

import { Ban } from 'lucide-react';

export default function SuspendedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center px-4">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <Ban className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Site Suspended
        </h1>
        <p className="text-gray-600 max-w-md mx-auto">
          This website has been suspended. If you are the site owner,
          please contact support for assistance.
        </p>
      </div>
    </div>
  );
}

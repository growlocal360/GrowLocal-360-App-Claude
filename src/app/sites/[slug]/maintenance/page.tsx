import { Pause } from 'lucide-react';

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center px-4">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <Pause className="h-8 w-8 text-gray-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Site Under Maintenance
        </h1>
        <p className="text-gray-600 max-w-md mx-auto">
          This website is temporarily unavailable while we make some improvements.
          Please check back soon.
        </p>
      </div>
    </div>
  );
}

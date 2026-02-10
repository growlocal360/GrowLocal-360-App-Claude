'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Service } from '@/types/database';

interface MultiStepFormProps {
  siteId: string;
  brandColor?: string;
  services?: Service[];
}

export function MultiStepForm({ siteId, brandColor = '#00d9c0', services }: MultiStepFormProps) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    service_type: '',
    message: '',
    name: '',
    phone: '',
    email: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await fetch(`/api/sites/${siteId}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          source_page: window.location.pathname,
        }),
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-900">Thank You!</h3>
        <p className="mt-2 text-sm text-gray-600">
          We&apos;ve received your request. A team member will reach out shortly.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Progress indicator */}
      <div className="mb-4 flex items-center justify-between text-sm">
        <div>
          <span className="font-bold text-gray-900 text-base">
            {step === 1 ? 'Book Online' : 'Your Contact Info'}
          </span>
          {step === 1 && (
            <div className="font-medium" style={{ color: brandColor }}>In less than 30 seconds</div>
          )}
        </div>
        <span className="text-gray-500">Step {step} of 2</span>
      </div>

      {/* Progress bar */}
      <div className="mb-6 h-2 w-full rounded-full bg-gray-200">
        <div
          className="h-2 rounded-full transition-all duration-300"
          style={{ width: step === 1 ? '50%' : '100%', backgroundColor: brandColor }}
        />
      </div>

      {step === 1 ? (
        /* Step 1: Project Info */
        <div className="space-y-4">
          {services && services.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Service Needed
              </label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                value={formData.service_type}
                onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
              >
                <option value="">Select a service...</option>
                {services.map((service) => (
                  <option key={service.id} value={service.name}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              How Can We Help - Details?
            </label>
            <textarea
              rows={3}
              placeholder="Describe what you need help with..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            />
          </div>
          <Button
            type="button"
            className="w-full py-2.5 hover:opacity-90"
            style={{ backgroundColor: brandColor }}
            onClick={() => setStep(2)}
          >
            Continue
          </Button>
        </div>
      ) : (
        /* Step 2: Contact Info */
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Name *
            </label>
            <input
              type="text"
              required
              placeholder="Your full name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Phone *
            </label>
            <input
              type="tel"
              required
              placeholder="(555) 123-4567"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Email *
            </label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex items-center gap-1"
              onClick={() => setStep(1)}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 hover:opacity-90"
              style={{ backgroundColor: brandColor }}
            >
              {submitting ? 'Submitting...' : 'Get Free Estimate'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

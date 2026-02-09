'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Service } from '@/types/database';

interface LeadCaptureSectionProps {
  siteId: string;
  brandColor?: string;
  services?: Service[];
}

export function LeadCaptureSection({ siteId, brandColor = '#00d9c0', services }: LeadCaptureSectionProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    service_type: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
      // Silently handle — form still shows success to user
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section id="contact" className="py-16">
        <div className="mx-auto max-w-xl px-4 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Thank You!</h2>
          <p className="mt-4 text-gray-600">
            We&apos;ve received your request and will be in touch shortly.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="contact" className="py-16">
      <div className="mx-auto max-w-xl px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
            Get a Free, No-Obligation Estimate
          </h2>
          <p className="mt-2 text-gray-600">
            Fill out the form below and we&apos;ll get back to you promptly.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <input
              type="text"
              placeholder="Your Name"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <input
              type="tel"
              placeholder="Phone Number"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <div>
            <input
              type="email"
              placeholder="Email Address"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          {services && services.length > 0 && (
            <div>
              <select
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-700 focus:border-transparent focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                value={formData.service_type}
                onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
              >
                <option value="">Select a Service</option>
                {services.map((service) => (
                  <option key={service.id} value={service.name}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Button
            type="submit"
            disabled={submitting}
            className="w-full py-3 text-base hover:opacity-90"
            style={{ backgroundColor: brandColor }}
          >
            {submitting ? 'Submitting...' : 'Request Estimate'}
          </Button>
        </form>
      </div>
    </section>
  );
}

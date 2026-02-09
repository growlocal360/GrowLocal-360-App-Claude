'use client';

import type { SitePage } from '@/types/database';

interface LocalizedContentSectionProps {
  pageContent?: SitePage | null;
  businessName: string;
  city: string;
}

export function LocalizedContentSection({ pageContent, businessName, city }: LocalizedContentSectionProps) {
  const h2 = pageContent?.h2 || `Serving ${city} With Quality Service`;
  const bodyCopy = pageContent?.body_copy ||
    `${businessName} is proud to serve ${city} and the surrounding communities. Our experienced team is dedicated to providing professional service with attention to detail and quality workmanship.`;

  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-10 lg:grid-cols-2">
          {/* Left: Content */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
              {h2}
            </h2>
            <div className="mt-6 space-y-4 text-gray-600">
              {bodyCopy.split('\n\n').map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>

          {/* Right: Photo placeholders */}
          <div className="grid grid-cols-2 gap-4">
            <div className="aspect-[4/3] rounded-lg bg-gray-200" />
            <div className="aspect-[4/3] rounded-lg bg-gray-200" />
          </div>
        </div>
      </div>
    </section>
  );
}

'use client';

import type { PublicRenderPageContent } from '@/lib/sites/public-render-model';

interface LocalizedContentSectionProps {
  pageContent?: PublicRenderPageContent | null;
  businessName: string;
  city: string;
}

export function LocalizedContentSection({ pageContent, businessName, city }: LocalizedContentSectionProps) {
  const h2 = pageContent?.h2 || `Serving ${city} With Quality Service`;
  const bodyCopy = pageContent?.body_copy ||
    `${businessName} is proud to serve ${city} and the surrounding communities. Our experienced team is dedicated to providing professional service with attention to detail and quality workmanship.`;

  // Get supporting/grid images (skip index 0 which is the hero)
  const supportingImages = pageContent?.generated_images?.filter(
    (img) => img.prompt_index > 0
  ) ?? [];

  return (
    <section className="bg-gray-50 py-24">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-10 lg:grid-cols-2">
          {/* Left: Content */}
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
              {h2}
            </h2>
            <div className="mt-6 space-y-4 text-gray-600">
              {bodyCopy.split('\n\n').map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>

          {/* Right: Generated images or placeholders */}
          <div className="grid grid-cols-2 gap-4">
            {supportingImages.length >= 2 ? (
              <>
                <img
                  src={supportingImages[0].url}
                  alt={`${businessName} in ${city}`}
                  className="aspect-[4/3] rounded-2xl object-cover shadow-md transition-all duration-300 hover:shadow-lg"
                />
                <img
                  src={supportingImages[1].url}
                  alt={`${businessName} services in ${city}`}
                  className="aspect-[4/3] rounded-2xl object-cover shadow-md transition-all duration-300 hover:shadow-lg"
                />
              </>
            ) : supportingImages.length === 1 ? (
              <>
                <img
                  src={supportingImages[0].url}
                  alt={`${businessName} in ${city}`}
                  className="aspect-[4/3] rounded-2xl object-cover shadow-md transition-all duration-300 hover:shadow-lg"
                />
                <div className="aspect-[4/3] rounded-2xl bg-gray-200" />
              </>
            ) : (
              <>
                <div className="aspect-[4/3] rounded-2xl bg-gray-200" />
                <div className="aspect-[4/3] rounded-2xl bg-gray-200" />
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

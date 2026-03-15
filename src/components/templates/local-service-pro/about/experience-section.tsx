'use client';

import type { AboutPageSections } from '@/types/database';

interface ExperienceSectionProps {
  sections: AboutPageSections | null;
  brandColor: string;
}

export function ExperienceSection({ sections, brandColor }: ExperienceSectionProps) {
  const experience = sections?.experience_credentials;
  if (!experience) return null;

  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="mb-6 text-3xl font-bold text-gray-900">{experience.heading}</h2>
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="prose prose-lg max-w-none text-gray-700">
            {experience.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {experience.highlights && experience.highlights.length > 0 && (
            <div className="space-y-3">
              {experience.highlights.map((highlight, i) => (
                <div key={i} className="flex items-start gap-3">
                  <svg
                    className="mt-1 h-5 w-5 shrink-0"
                    style={{ color: brandColor }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">{highlight}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

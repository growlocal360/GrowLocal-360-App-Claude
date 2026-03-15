'use client';

import type { AboutPageSections } from '@/types/database';

interface MissionValuesSectionProps {
  sections: AboutPageSections | null;
  brandColor: string;
}

export function MissionValuesSection({ sections, brandColor }: MissionValuesSectionProps) {
  const missionValues = sections?.mission_values;
  if (!missionValues) return null;

  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="mb-6 text-3xl font-bold text-gray-900">{missionValues.heading}</h2>
        <div className="prose prose-lg max-w-none text-gray-700">
          {missionValues.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div
          className="mt-6 h-1 w-16 rounded"
          style={{ backgroundColor: brandColor }}
        />
      </div>
    </section>
  );
}

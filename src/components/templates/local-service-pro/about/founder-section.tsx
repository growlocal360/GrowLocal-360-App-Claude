'use client';

import Image from 'next/image';
import type { AboutPageSections } from '@/types/database';
import type { PublicRenderTeamMember } from '@/lib/sites/public-render-model';

interface FounderSectionProps {
  sections: AboutPageSections | null;
  teamMembers: PublicRenderTeamMember[];
  brandColor: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function FounderSection({ sections, teamMembers, brandColor }: FounderSectionProps) {
  const founderStory = sections?.founder_story;
  if (!founderStory) return null;

  const owner = teamMembers.find((m) => m.role === 'owner');

  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-10 lg:grid-cols-3">
          {/* Owner card */}
          {owner && (
            <div className="flex flex-col items-center text-center lg:col-span-1">
              {owner.avatar_url ? (
                <Image
                  src={owner.avatar_url}
                  alt={owner.full_name}
                  width={160}
                  height={160}
                  className="mb-4 h-40 w-40 rounded-full object-cover shadow-md"
                />
              ) : (
                <div
                  className="mb-4 flex h-40 w-40 items-center justify-center rounded-full text-4xl font-bold text-white shadow-md"
                  style={{ backgroundColor: brandColor }}
                >
                  {getInitials(owner.full_name)}
                </div>
              )}
              <h3 className="text-xl font-semibold text-gray-900">{owner.full_name}</h3>
              {owner.title && (
                <p className="mt-1 text-sm font-medium" style={{ color: brandColor }}>
                  {owner.title}
                </p>
              )}
            </div>
          )}

          {/* Narrative */}
          <div className={owner ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <h2 className="mb-6 text-3xl font-bold text-gray-900">{founderStory.heading}</h2>
            <div className="prose prose-lg max-w-none text-gray-700">
              {founderStory.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

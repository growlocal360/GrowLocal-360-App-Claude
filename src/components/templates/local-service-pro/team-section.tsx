'use client';

import type { PublicRenderTeamMember } from '@/lib/sites/public-render-model';

interface TeamSectionProps {
  teamMembers: PublicRenderTeamMember[];
  brandColor: string;
  heading?: string;
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

export function TeamSection({
  teamMembers,
  brandColor,
  heading = 'Meet Our Team',
}: TeamSectionProps) {
  if (teamMembers.length === 0) return null;

  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="mb-10 text-center text-3xl font-bold text-gray-900">
          {heading}
        </h2>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {teamMembers.map((member) => (
            <div
              key={member.id}
              className="flex flex-col items-center rounded-xl border border-gray-100 bg-white p-6 text-center shadow-sm"
            >
              {member.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={member.avatar_url}
                  alt={member.full_name}
                  className="mb-4 h-24 w-24 rounded-full object-cover"
                />
              ) : (
                <div
                  className="mb-4 flex h-24 w-24 items-center justify-center rounded-full text-2xl font-bold text-white"
                  style={{ backgroundColor: brandColor }}
                >
                  {getInitials(member.full_name)}
                </div>
              )}
              <h3 className="text-lg font-semibold text-gray-900">
                {member.full_name}
              </h3>
              {member.title && (
                <p className="mt-1 text-sm font-medium" style={{ color: brandColor }}>
                  {member.title}
                </p>
              )}
              {member.bio && (
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  {member.bio}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

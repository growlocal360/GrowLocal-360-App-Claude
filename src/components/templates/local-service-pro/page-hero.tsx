import { ReactNode } from 'react';
import { DEFAULT_BRAND_COLOR } from './theme';

interface PageHeroProps {
  brandColor?: string | null;
  eyebrow?: string;
  title: string;
  subtitle?: string | null;
  align?: 'left' | 'center';
  compact?: boolean;
  children?: ReactNode;
}

/**
 * Lightweight branded banner used at the top of every listing / detail page
 * that isn't conversion-focused enough to warrant the full HeroSection
 * (which embeds a lead form). Same background treatment, same typography,
 * same vertical rhythm — guarantees visual consistency across the site.
 *
 * Use HeroSection for: home, primary service, primary category, primary area.
 * Use PageHero for: brands, brand detail, services list, areas list, reviews,
 * about, contact, FAQ, work hub, job snaps, neighborhoods.
 */
export function PageHero({
  brandColor,
  eyebrow,
  title,
  subtitle,
  align = 'left',
  compact = false,
  children,
}: PageHeroProps) {
  const bg = brandColor || DEFAULT_BRAND_COLOR;
  const padding = compact ? 'py-16 md:py-20' : 'py-20 md:py-24';
  const alignClass = align === 'center' ? 'text-center mx-auto' : '';
  const widthClass = align === 'center' ? 'max-w-3xl' : 'max-w-3xl';

  return (
    <section className={`${padding} text-white`} style={{ backgroundColor: bg }}>
      <div className="mx-auto max-w-7xl px-4">
        <div className={`${widthClass} ${alignClass}`}>
          {eyebrow && (
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/80">
              {eyebrow}
            </p>
          )}
          <h1 className="text-3xl font-bold tracking-tight leading-[1.1] md:text-4xl lg:text-5xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-4 text-lg text-white/90 md:text-xl">
              {subtitle}
            </p>
          )}
          {children && <div className="mt-6">{children}</div>}
        </div>
      </div>
    </section>
  );
}

import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DEFAULT_BRAND_COLOR } from './theme';

interface FinalCTASectionProps {
  brandColor?: string | null;
  businessName?: string;
  phone?: string | null;
  ctaStyle?: 'booking' | 'estimate';
  heading?: string;
  subheading?: string;
  formHref?: string;
}

/**
 * Full-width band placed above the footer on every page. Gives every visitor
 * one last conversion opportunity — phone call or jump back to the form.
 */
export function FinalCTASection({
  brandColor,
  businessName,
  phone,
  ctaStyle = 'booking',
  heading,
  subheading,
  formHref = '#hero-form',
}: FinalCTASectionProps) {
  const color = brandColor || DEFAULT_BRAND_COLOR;
  const headingText = heading || (ctaStyle === 'booking'
    ? 'Ready to get on the schedule?'
    : 'Ready for a fast, no-obligation estimate?');
  const subText = subheading || (businessName
    ? `Talk to a real person at ${businessName} — we respond fast.`
    : 'Talk to a real person — we respond fast.');

  return (
    <section className="py-24 md:py-32 text-white" style={{ backgroundColor: color }}>
      <div className="mx-auto max-w-5xl px-4 text-center">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{headingText}</h2>
        <p className="mt-4 text-lg text-white/90 md:text-xl">{subText}</p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button
            asChild
            size="lg"
            className="rounded-full bg-white text-lg shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-gray-100 hover:shadow-lg"
            style={{ color }}
          >
            <a href={formHref}>
              {ctaStyle === 'booking' ? 'Book Online' : 'Get Free Estimate'}
            </a>
          </Button>
          {phone && (
            <a
              href={`tel:${phone.replace(/\D/g, '')}`}
              className="inline-flex items-center gap-2 rounded-full border-2 border-white px-6 py-3 text-lg font-semibold text-white transition-all hover:bg-white/10"
            >
              <Phone className="h-5 w-5" />
              Call {phone}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

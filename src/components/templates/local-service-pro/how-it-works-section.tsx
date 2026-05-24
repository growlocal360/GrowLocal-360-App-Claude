import { DEFAULT_BRAND_COLOR } from './theme';

interface ProcessStep {
  title: string;
  body: string;
}

interface HowItWorksSectionProps {
  brandColor?: string | null;
  ctaStyle?: 'booking' | 'estimate';
  steps?: ProcessStep[];
  heading?: string;
}

const defaultSteps = (ctaStyle: 'booking' | 'estimate'): ProcessStep[] => [
  {
    title: 'Tell us what you need',
    body: ctaStyle === 'booking'
      ? 'Pick a time online or call us — takes about 60 seconds.'
      : 'Fill out the quick form — takes about 60 seconds.',
  },
  {
    title: 'Get a fast estimate',
    body: 'A live person responds quickly with a clear, upfront price.',
  },
  {
    title: 'We do the work',
    body: 'A licensed pro shows up on time and gets the job done right.',
  },
  {
    title: 'Enjoy the result',
    body: 'Backed by our guarantee. If you\'re not happy, we make it right.',
  },
];

export function HowItWorksSection({
  brandColor,
  ctaStyle = 'booking',
  steps,
  heading = 'How It Works',
}: HowItWorksSectionProps) {
  const color = brandColor || DEFAULT_BRAND_COLOR;
  const items = steps && steps.length > 0 ? steps : defaultSteps(ctaStyle);

  return (
    <section className="bg-gray-50 py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            {heading}
          </h2>
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {items.map((step, i) => (
            <div key={i} className="relative">
              <div
                className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {i + 1}
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

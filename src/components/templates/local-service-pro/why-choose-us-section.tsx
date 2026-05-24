import { Zap, DollarSign, ShieldCheck, Users, ThumbsUp, MapPin } from 'lucide-react';
import { DEFAULT_BRAND_COLOR } from './theme';

interface ValueProp {
  icon: React.ReactNode;
  title: string;
  body: string;
}

interface WhyChooseUsSectionProps {
  brandColor?: string | null;
  businessName: string;
  city?: string;
  industry?: string;
  /**
   * Optional override. When omitted, falls back to a 6-card industry-agnostic
   * default that works for HVAC, plumbing, appliance repair, etc.
   */
  items?: ValueProp[];
  heading?: string;
  subheading?: string;
}

const defaultItems = (businessName: string, industry?: string): ValueProp[] => [
  {
    icon: <Zap className="h-6 w-6" />,
    title: 'Fast Scheduling',
    body: `Get on the schedule today. Most ${industry?.toLowerCase() || 'service'} calls handled same-day or next-day.`,
  },
  {
    icon: <DollarSign className="h-6 w-6" />,
    title: 'Upfront Pricing',
    body: 'No surprise fees. You approve the price before any work begins.',
  },
  {
    icon: <ShieldCheck className="h-6 w-6" />,
    title: 'Licensed & Insured',
    body: 'Background-checked technicians backed by our full guarantee.',
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: 'Friendly Crew',
    body: 'Professional, respectful, and easy to work with — every visit.',
  },
  {
    icon: <ThumbsUp className="h-6 w-6" />,
    title: 'Quality That Lasts',
    body: 'We do it right the first time. Backed by reviews from real neighbors.',
  },
  {
    icon: <MapPin className="h-6 w-6" />,
    title: 'Locally Owned',
    body: `${businessName} is part of your community — not a faceless chain.`,
  },
];

export function WhyChooseUsSection({
  brandColor,
  businessName,
  industry,
  items,
  heading = 'Why Choose Us',
  subheading,
}: WhyChooseUsSectionProps) {
  const color = brandColor || DEFAULT_BRAND_COLOR;
  const cards = items && items.length > 0 ? items : defaultItems(businessName, industry);

  return (
    <section className="bg-white py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            {heading}
          </h2>
          {subheading && (
            <p className="mt-3 max-w-2xl mx-auto text-lg text-gray-600">{subheading}</p>
          )}
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((item, i) => (
            <div
              key={i}
              className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div
                className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${color}15`, color }}
              >
                {item.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

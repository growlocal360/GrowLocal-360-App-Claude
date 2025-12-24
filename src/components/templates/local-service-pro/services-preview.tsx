'use client';

import { Wrench, Shield, Clock, Award } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Site } from '@/types/database';

interface ServicesPreviewProps {
  site: Site;
}

export function ServicesPreview({ site }: ServicesPreviewProps) {
  const brandColor = site.settings?.brand_color || '#10b981';
  const industry = site.settings?.core_industry || 'Professional Services';

  // Placeholder services - in production these would come from the database
  const services = [
    {
      icon: Wrench,
      title: 'Expert Service',
      description: `Professional ${industry.toLowerCase()} with attention to detail and quality workmanship.`,
    },
    {
      icon: Shield,
      title: 'Licensed & Insured',
      description: 'Fully licensed and insured for your protection and peace of mind.',
    },
    {
      icon: Clock,
      title: 'Fast Response',
      description: 'Quick response times and flexible scheduling to meet your needs.',
    },
    {
      icon: Award,
      title: 'Satisfaction Guaranteed',
      description: 'We stand behind our work with a 100% satisfaction guarantee.',
    },
  ];

  return (
    <section id="services" className="bg-gray-50 py-20">
      <div className="mx-auto max-w-7xl px-4">
        {/* Section header */}
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
            Our Services
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Quality {industry.toLowerCase()} services you can trust
          </p>
        </div>

        {/* Services grid */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <Card key={index} className="border-0 shadow-lg">
                <CardContent className="p-6 text-center">
                  <div
                    className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${brandColor}20` }}
                  >
                    <Icon
                      className="h-7 w-7"
                      style={{ color: brandColor }}
                    />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">
                    {service.title}
                  </h3>
                  <p className="text-sm text-gray-600">{service.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Note about services */}
        <p className="mt-8 text-center text-sm text-gray-500">
          Full service catalog coming soon. Contact us for a complete list of services.
        </p>
      </div>
    </section>
  );
}

import type {
  SchemaBusinessInput,
  SchemaLocationInput,
  SchemaServiceInput,
  SchemaFAQItem,
  SchemaBreadcrumbItem,
  SchemaPersonInput,
  SchemaReviewInput,
} from './types';

type SchemaObject = Record<string, unknown>;

/** Resolves the canonical site URL (no trailing slash) */
export function getSiteUrl(business: SchemaBusinessInput): string {
  if (business.customDomain) {
    return `https://${business.customDomain}`;
  }
  if (business.domain) {
    return `https://${business.domain}`;
  }
  return `https://${business.siteSlug}.growlocal360.com`;
}

/** Reference-only business node for embedding as provider */
export function buildBusinessRef(business: SchemaBusinessInput): { '@id': string } {
  return { '@id': `${getSiteUrl(business)}#business` };
}

/** AggregateRating fragment (for embedding inside LocalBusiness or Service) */
export function buildAggregateRating(
  rating: number,
  count: number
): SchemaObject | null {
  if (rating < 1 || count < 1) return null;
  return {
    '@type': 'AggregateRating',
    ratingValue: rating,
    reviewCount: count,
    bestRating: 5,
    worstRating: 1,
  };
}

/** Full LocalBusiness entity with stable @id */
export function buildLocalBusinessSchema(
  business: SchemaBusinessInput,
  location: SchemaLocationInput,
  options?: {
    areaServed?: SchemaObject | SchemaObject[];
    businessType?: string;
    reviews?: SchemaReviewInput[];
  }
): SchemaObject {
  const siteUrl = getSiteUrl(business);
  const schema: SchemaObject = {
    '@context': 'https://schema.org',
    '@type': options?.businessType || 'LocalBusiness',
    '@id': `${siteUrl}#business`,
    name: business.siteName,
    url: siteUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: location.streetAddress,
      addressLocality: location.city,
      addressRegion: location.state,
      postalCode: location.zipCode,
      addressCountry: location.country || 'US',
    },
  };

  if (business.phone) {
    schema.telephone = business.phone;
  }
  if (business.email) {
    schema.email = business.email;
  }
  if (business.logoUrl) {
    // Resolve relative paths (e.g., /public/assets/brand/logo.svg) to absolute URLs
    const logoAbsoluteUrl = business.logoUrl.startsWith('/')
      ? `${siteUrl}${business.logoUrl}`
      : business.logoUrl;
    schema.logo = logoAbsoluteUrl;
    schema.image = logoAbsoluteUrl;
  }
  if (location.latitude && location.longitude) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      latitude: location.latitude,
      longitude: location.longitude,
    };
  }
  if (options?.areaServed) {
    schema.areaServed = options.areaServed;
  }

  // Auto-include AggregateRating when available
  const rating = buildAggregateRating(
    business.averageRating ?? 0,
    business.totalReviews ?? 0
  );
  if (rating) {
    schema.aggregateRating = rating;
  }

  // Individual Review entries (Google Reviews)
  if (options?.reviews && options.reviews.length > 0) {
    schema.review = options.reviews
      .filter(r => r.text)
      .map(r => ({
        '@type': 'Review',
        reviewRating: {
          '@type': 'Rating',
          ratingValue: r.rating,
          bestRating: 5,
          worstRating: 1,
        },
        author: {
          '@type': 'Person',
          name: r.authorName || 'Customer',
        },
        reviewBody: r.text,
      }));
  }

  return schema;
}

/** Service schema linked to business via @id reference */
export function buildServiceSchema(
  service: SchemaServiceInput,
  business: SchemaBusinessInput,
  location: SchemaLocationInput,
  options?: {
    serviceUrl?: string;
  }
): SchemaObject {
  const schema: SchemaObject = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    provider: buildBusinessRef(business),
    areaServed: {
      '@type': 'City',
      name: location.city,
      containedInPlace: {
        '@type': 'State',
        name: location.state,
      },
    },
    serviceType: service.categoryName,
  };

  if (service.description) {
    schema.description = service.description;
  }
  if (options?.serviceUrl) {
    schema.url = options.serviceUrl;
  }

  return schema;
}

/** FAQPage schema from an array of Q&A pairs. Returns null if no FAQs. */
export function buildFAQPageSchema(faqs: SchemaFAQItem[]): SchemaObject | null {
  if (!faqs || faqs.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/** BreadcrumbList schema */
export function buildBreadcrumbSchema(items: SchemaBreadcrumbItem[]): SchemaObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** WebSite schema — for home page only */
export function buildWebSiteSchema(business: SchemaBusinessInput): SchemaObject {
  const siteUrl = getSiteUrl(business);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl}#website`,
    name: business.siteName,
    url: siteUrl,
    publisher: buildBusinessRef(business),
  };
}

/** CollectionPage schema — for listing pages (services, areas, brands) */
export function buildCollectionPageSchema(
  name: string,
  description: string,
  url: string,
  business: SchemaBusinessInput
): SchemaObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url,
    isPartOf: {
      '@id': `${getSiteUrl(business)}#website`,
    },
    about: buildBusinessRef(business),
  };
}

/** WebPage schema — for About, Contact, or generic pages */
export function buildWebPageSchema(
  name: string,
  description: string,
  url: string,
  pageType: 'AboutPage' | 'ContactPage' | 'WebPage',
  business: SchemaBusinessInput
): SchemaObject {
  return {
    '@context': 'https://schema.org',
    '@type': pageType,
    name,
    description,
    url,
    isPartOf: {
      '@id': `${getSiteUrl(business)}#website`,
    },
    about: buildBusinessRef(business),
  };
}

/** Person schema linked to business via worksFor */
export function buildPersonSchema(
  person: SchemaPersonInput,
  business: SchemaBusinessInput
): SchemaObject {
  const siteUrl = getSiteUrl(business);
  const schema: SchemaObject = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: person.name,
    worksFor: buildBusinessRef(business),
  };
  if (person.jobTitle) schema.jobTitle = person.jobTitle;
  if (person.description) schema.description = person.description;
  if (person.imageUrl) {
    schema.image = person.imageUrl.startsWith('/')
      ? `${siteUrl}${person.imageUrl}`
      : person.imageUrl;
  }
  return schema;
}

/** Enhanced About page schema stack: AboutPage + LocalBusiness + BreadcrumbList + Person(s) */
export function buildAboutPageSchema(
  business: SchemaBusinessInput,
  location: SchemaLocationInput,
  aboutUrl: string,
  founder?: SchemaPersonInput | null,
  employees?: SchemaPersonInput[]
): SchemaObject[] {
  const siteUrl = getSiteUrl(business);
  const schemas: SchemaObject[] = [];

  // LocalBusiness entity
  schemas.push(buildLocalBusinessSchema(business, location));

  // AboutPage
  const aboutPage: SchemaObject = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: `About ${business.siteName}`,
    url: aboutUrl,
    isPartOf: { '@id': `${siteUrl}#website` },
    about: buildBusinessRef(business),
  };
  if (founder) {
    aboutPage.mainEntity = { '@type': 'Person', name: founder.name };
  }
  schemas.push(aboutPage);

  // BreadcrumbList
  schemas.push(
    buildBreadcrumbSchema([
      { name: 'Home', url: siteUrl },
      { name: 'About', url: aboutUrl },
    ])
  );

  // Founder Person
  if (founder) {
    schemas.push(buildPersonSchema(founder, business));
  }

  // Employee Persons
  if (employees?.length) {
    for (const emp of employees) {
      schemas.push(buildPersonSchema(emp, business));
    }
  }

  return schemas;
}

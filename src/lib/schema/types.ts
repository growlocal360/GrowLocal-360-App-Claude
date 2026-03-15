/**
 * Lean input types for schema.org JSON-LD builder functions.
 * These are intentionally decoupled from full DB types for testability.
 */

export interface SchemaBusinessInput {
  siteName: string;
  siteSlug: string;
  domain?: string | null;
  customDomain?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  averageRating?: number | null;
  totalReviews?: number | null;
}

export interface SchemaLocationInput {
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface SchemaServiceInput {
  name: string;
  slug: string;
  description?: string | null;
  categoryName: string;
}

export interface SchemaFAQItem {
  question: string;
  answer: string;
}

export interface SchemaBreadcrumbItem {
  name: string;
  url: string;
}

export interface SchemaPersonInput {
  name: string;
  jobTitle?: string | null;
  description?: string | null;
  imageUrl?: string | null;
}

'use client';

interface JsonLdProps {
  data: Record<string, unknown> | (Record<string, unknown> | null)[];
}

/** Renders one or more schema.org JSON-LD script tags. Filters out null entries. */
export function JsonLd({ data }: JsonLdProps) {
  const schemas = (Array.isArray(data) ? data : [data]).filter(Boolean) as Record<string, unknown>[];

  if (schemas.length === 0) return null;

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}

'use client';

import { useState, useCallback } from 'react';

// Types for content generation
export interface ServiceInput {
  name: string;
  description: string;
  categoryGcid: string;
  categoryName: string;
}

export interface CategoryInput {
  gcid: string;
  name: string;
  displayName: string;
  isPrimary: boolean;
}

export interface ServiceAreaInput {
  name: string;
  state?: string;
}

export interface LocationInput {
  city: string;
  state: string;
}

// Generated content types
export interface GeneratedServiceContent {
  name: string;
  meta_title: string;
  meta_description: string;
  h1: string;
  h2: string;
  body_copy: string;
  faqs: { question: string; answer: string }[];
}

export interface GeneratedCategoryContent {
  name: string;
  meta_title: string;
  meta_description: string;
  h1: string;
  h2: string;
  body_copy: string;
}

export interface GeneratedCorePageContent {
  page_type: 'home' | 'about' | 'contact';
  meta_title: string;
  meta_description: string;
  h1: string;
  h2: string;
  body_copy: string;
}

export interface GeneratedServiceAreaContent {
  name: string;
  meta_title: string;
  meta_description: string;
  h1: string;
  body_copy: string;
}

export interface GeneratedContent {
  services: GeneratedServiceContent[];
  categories: GeneratedCategoryContent[];
  corePages: GeneratedCorePageContent[];
  serviceAreas: GeneratedServiceAreaContent[];
}

export interface ContentGenerationProgress {
  status: 'idle' | 'generating' | 'complete' | 'error';
  currentBatch: string;
  completedPages: number;
  totalPages: number;
  error?: string;
}

interface ContentGenerationConfig {
  businessName: string;
  location: LocationInput;
  categories: CategoryInput[];
  services: ServiceInput[];
  serviceAreas: ServiceAreaInput[];
  websiteType: 'single_location' | 'multi_location' | 'microsite';
}

const MAX_RETRIES = 2;

export function useContentGeneration() {
  const [progress, setProgress] = useState<ContentGenerationProgress>({
    status: 'idle',
    currentBatch: '',
    completedPages: 0,
    totalPages: 0,
  });

  const [generatedContent, setGeneratedContent] = useState<GeneratedContent>({
    services: [],
    categories: [],
    corePages: [],
    serviceAreas: [],
  });

  const calculateTotalPages = (config: ContentGenerationConfig): number => {
    const servicePages = config.services.length;
    const categoryPages = config.categories.length;
    const corePages = 3; // home, about, contact
    const serviceAreaPages = config.serviceAreas.length;
    return servicePages + categoryPages + corePages + serviceAreaPages;
  };

  const generateWithRetry = async <T,>(
    fn: () => Promise<T>,
    retries: number = MAX_RETRIES
  ): Promise<T> => {
    let lastError: Error | null = null;
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (i < retries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }
    throw lastError;
  };

  const generateContent = useCallback(
    async (config: ContentGenerationConfig): Promise<GeneratedContent> => {
      const totalPages = calculateTotalPages(config);
      let completedPages = 0;

      setProgress({
        status: 'generating',
        currentBatch: 'Initializing...',
        completedPages: 0,
        totalPages,
      });

      const content: GeneratedContent = {
        services: [],
        categories: [],
        corePages: [],
        serviceAreas: [],
      };

      try {
        // Group services by category for batched generation
        const servicesByCategory = new Map<string, ServiceInput[]>();
        for (const service of config.services) {
          const existing = servicesByCategory.get(service.categoryName) || [];
          existing.push(service);
          servicesByCategory.set(service.categoryName, existing);
        }

        // Generate service content by category
        for (const [categoryName, categoryServices] of servicesByCategory) {
          setProgress((prev) => ({
            ...prev,
            currentBatch: `Generating ${categoryName} services...`,
          }));

          const response = await generateWithRetry(async () => {
            const res = await fetch('/api/content/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'services',
                businessName: config.businessName,
                city: config.location.city,
                state: config.location.state,
                categoryName,
                services: categoryServices.map((s) => ({
                  name: s.name,
                  description: s.description,
                })),
              }),
            });

            if (!res.ok) {
              throw new Error(`Failed to generate service content: ${res.statusText}`);
            }

            return res.json();
          });

          if (response.services) {
            content.services.push(...response.services);
            completedPages += categoryServices.length;
            setProgress((prev) => ({
              ...prev,
              completedPages,
            }));
          }
        }

        // Generate category content
        if (config.categories.length > 0) {
          setProgress((prev) => ({
            ...prev,
            currentBatch: 'Generating category pages...',
          }));

          const categoryResponse = await generateWithRetry(async () => {
            const res = await fetch('/api/content/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'categories',
                businessName: config.businessName,
                city: config.location.city,
                state: config.location.state,
                categories: config.categories.map((c) => ({
                  name: c.displayName || c.name,
                  isPrimary: c.isPrimary,
                })),
              }),
            });

            if (!res.ok) {
              throw new Error(`Failed to generate category content: ${res.statusText}`);
            }

            return res.json();
          });

          if (categoryResponse.categories) {
            content.categories.push(...categoryResponse.categories);
            completedPages += config.categories.length;
            setProgress((prev) => ({
              ...prev,
              completedPages,
            }));
          }
        }

        // Generate core pages (home, about, contact)
        setProgress((prev) => ({
          ...prev,
          currentBatch: 'Generating core pages...',
        }));

        const primaryCategory =
          config.categories.find((c) => c.isPrimary)?.displayName ||
          config.categories[0]?.displayName ||
          'Services';

        const coreResponse = await generateWithRetry(async () => {
          const res = await fetch('/api/content/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'core',
              businessName: config.businessName,
              city: config.location.city,
              state: config.location.state,
              primaryCategory,
              websiteType: config.websiteType,
            }),
          });

          if (!res.ok) {
            throw new Error(`Failed to generate core content: ${res.statusText}`);
          }

          return res.json();
        });

        if (coreResponse.pages) {
          content.corePages.push(...coreResponse.pages);
          completedPages += 3;
          setProgress((prev) => ({
            ...prev,
            completedPages,
          }));
        }

        // Generate service area content (batch by 10)
        if (config.serviceAreas.length > 0) {
          const batchSize = 10;
          for (let i = 0; i < config.serviceAreas.length; i += batchSize) {
            const batch = config.serviceAreas.slice(i, i + batchSize);

            setProgress((prev) => ({
              ...prev,
              currentBatch: `Generating service area pages (${i + 1}-${Math.min(i + batchSize, config.serviceAreas.length)})...`,
            }));

            const areaResponse = await generateWithRetry(async () => {
              const res = await fetch('/api/content/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'service_areas',
                  businessName: config.businessName,
                  primaryCity: config.location.city,
                  state: config.location.state,
                  primaryCategory,
                  serviceAreas: batch,
                }),
              });

              if (!res.ok) {
                throw new Error(`Failed to generate service area content: ${res.statusText}`);
              }

              return res.json();
            });

            if (areaResponse.service_areas) {
              content.serviceAreas.push(...areaResponse.service_areas);
              completedPages += batch.length;
              setProgress((prev) => ({
                ...prev,
                completedPages,
              }));
            }
          }
        }

        setGeneratedContent(content);
        setProgress({
          status: 'complete',
          currentBatch: 'Complete!',
          completedPages: totalPages,
          totalPages,
        });

        return content;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setProgress((prev) => ({
          ...prev,
          status: 'error',
          currentBatch: 'Failed',
          error: errorMessage,
        }));
        throw error;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setProgress({
      status: 'idle',
      currentBatch: '',
      completedPages: 0,
      totalPages: 0,
    });
    setGeneratedContent({
      services: [],
      categories: [],
      corePages: [],
      serviceAreas: [],
    });
  }, []);

  return {
    progress,
    generatedContent,
    generateContent,
    reset,
  };
}

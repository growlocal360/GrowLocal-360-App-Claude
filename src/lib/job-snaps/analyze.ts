/**
 * Client-side helper to call the job snap AI analysis endpoint.
 */

import type { JobSnapAnalysisResult } from '@/lib/job-snaps/types';
import type { LocalImage } from '@/components/job-snaps/image-preview-grid';
import type { JobLocation } from '@/components/job-snaps/job-location-card';
import { resizeAndEncode } from '@/lib/job-snaps/image-utils';

export type { JobSnapAnalysisResult };

interface AnalyzeJobSnapOptions {
  images: LocalImage[];
  location?: JobLocation | null;
  businessName?: string;
  businessCategory?: string;
}

/**
 * Sends job snap images to the AI analysis endpoint.
 * Converts files to base64 client-side before sending.
 */
export async function analyzeJobSnap(
  options: AnalyzeJobSnapOptions
): Promise<JobSnapAnalysisResult> {
  const { images, location, businessName, businessCategory } = options;

  // Resize and encode — keeps payload well under Vercel's 4.5 MB body limit
  const imageInputs = await Promise.all(
    images.map(async (img) => {
      const { base64, mimeType } = await resizeAndEncode(img.file);
      return { base64, mimeType, fileName: img.file.name };
    })
  );

  const body: Record<string, unknown> = { images: imageInputs };

  if (location) {
    body.location = {
      address: location.address,
      city: location.city,
      state: location.state,
      zip: location.zip,
      lat: location.lat,
      lng: location.lng,
    };
  }

  if (businessName) body.businessName = businessName;
  if (businessCategory) body.businessCategory = businessCategory;

  const response = await fetch('/api/job-snaps/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Analysis failed' }));
    throw new Error(err.error || 'Analysis failed');
  }

  const data = await response.json();
  return data.analysis as JobSnapAnalysisResult;
}

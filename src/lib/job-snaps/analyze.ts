/**
 * Client-side helper to call the job snap AI analysis endpoint.
 */

import type { JobSnapAnalysisResult } from '@/app/api/job-snaps/analyze/route';
import type { LocalImage } from '@/components/job-snaps/image-preview-grid';
import type { JobLocation } from '@/components/job-snaps/job-location-card';

export type { JobSnapAnalysisResult };

/**
 * Converts a File to a base64 data string (without the data: prefix).
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the "data:image/jpeg;base64," prefix
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('Failed to convert file to base64'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

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

  // Convert all images to base64
  const imageInputs = await Promise.all(
    images.map(async (img) => ({
      base64: await fileToBase64(img.file),
      mimeType: img.file.type as 'image/jpeg' | 'image/png' | 'image/webp',
      fileName: img.file.name,
    }))
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

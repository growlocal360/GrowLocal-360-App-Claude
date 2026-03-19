/**
 * Shared types for the Job Snaps module.
 * Kept here (not in API route files) so they can be safely imported
 * by both client-side lib helpers and server-side API routes.
 */

export interface JobSnapAnalysisResult {
  title: string;
  description: string;
  serviceType: string | null;
  serviceId: string | null;
  brand: string | null;
  confidence: {
    service: number;  // 0-1
    brand: number;    // 0-1
    location: number; // 0-1
  };
  imageRoles: {
    index: number;
    role: 'primary' | 'before' | 'after' | 'process' | 'detail';
  }[];
}

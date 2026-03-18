'use client';

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, X } from 'lucide-react';

export type ImageLabel = 'gps_found' | 'no_gps' | 'primary' | 'before' | 'after' | 'process' | 'detail' | null;

export interface LocalImage {
  file: File;
  preview: string;
  gpsCoords: { lat: number; lng: number } | null;
  label: ImageLabel;
}

const labelConfig: Record<string, { text: string; className: string }> = {
  gps_found: { text: 'GPS Found', className: 'text-green-600' },
  no_gps: { text: 'No GPS', className: 'text-gray-400' },
  primary: { text: 'Primary', className: 'text-blue-600' },
  before: { text: 'Before', className: 'text-amber-600' },
  after: { text: 'After', className: 'text-purple-600' },
  process: { text: 'In Progress', className: 'text-blue-500' },
  detail: { text: 'Detail', className: 'text-gray-500' },
};

interface ImagePreviewGridProps {
  images: LocalImage[];
  onRemove: (index: number) => void;
  maxImages?: number;
}

export function ImagePreviewGrid({
  images,
  onRemove,
  maxImages = 4,
}: ImagePreviewGridProps) {
  if (images.length === 0) return null;

  return (
    <Card>
      <CardContent className="py-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Uploaded Images ({images.length}/{maxImages})
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {images.map((img, index) => {
            const label = img.label ? labelConfig[img.label] : null;

            return (
              <div key={`${img.file.name}-${index}`} className="relative">
                {/* Image */}
                <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                  <Image
                    src={img.preview}
                    alt={img.file.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 45vw, 280px"
                    unoptimized
                  />

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition-colors hover:bg-red-600"
                    aria-label={`Remove ${img.file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Status label */}
                {label && (
                  <div className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${label.className}`}>
                    <MapPin className="h-3 w-3" />
                    {label.text}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

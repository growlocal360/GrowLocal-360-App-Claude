'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Image as ImageIcon, Camera } from 'lucide-react';
import { toast } from 'sonner';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGES = 4;

interface PhotoUploadProps {
  currentCount: number;
  onAdd: (files: File[]) => void;
}

export function PhotoUpload({ currentCount, onAdd }: PhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const remaining = MAX_IMAGES - currentCount;

  const validateAndAdd = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);

      // Filter valid types
      const valid = files.filter((f) => ACCEPTED_TYPES.includes(f.type));
      const invalid = files.length - valid.length;
      if (invalid > 0) {
        toast.error(`${invalid} file${invalid > 1 ? 's' : ''} rejected. Only JPG, PNG, and WEBP are accepted.`);
      }

      if (valid.length === 0) return;

      // Enforce limit
      if (remaining <= 0) {
        toast.error('Maximum 4 photos reached.');
        return;
      }

      const toAdd = valid.slice(0, remaining);
      if (valid.length > remaining) {
        toast.warning(`Only ${remaining} more photo${remaining > 1 ? 's' : ''} allowed. Added ${toAdd.length}.`);
      }

      onAdd(toAdd);
    },
    [onAdd, remaining]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (remaining > 0) setIsDragging(true);
    },
    [remaining]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        validateAndAdd(e.dataTransfer.files);
      }
    },
    [validateAndAdd]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        validateAndAdd(e.target.files);
      }
      // Reset input so the same file can be re-selected
      e.target.value = '';
    },
    [validateAndAdd]
  );

  return (
    <Card>
      <CardContent className="py-6">
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Add Job Photos</h3>
          <p className="mt-1 text-sm text-gray-500">
            Upload up to {MAX_IMAGES} photos of the job
          </p>
        </div>

        {isMobile ? (
          /* Mobile: Two tap targets side by side */
          <div className="flex gap-4 justify-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={remaining <= 0}
              className="flex h-28 w-36 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#00d9c0] bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ImageIcon className="h-8 w-8 text-gray-400" />
              <span className="text-sm font-medium">Photos</span>
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={remaining <= 0}
              className="flex h-28 w-36 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera className="h-8 w-8 text-gray-400" />
              <span className="text-sm font-medium">Camera</span>
            </button>
          </div>
        ) : (
          /* Desktop: Drag and drop zone */
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-10 transition-colors ${
              isDragging
                ? 'border-[#00d9c0] bg-[#00d9c0]/5'
                : remaining <= 0
                  ? 'border-gray-200 bg-gray-50 opacity-50'
                  : 'border-gray-300 bg-white hover:border-gray-400'
            }`}
          >
            <ImageIcon className="h-10 w-10 text-gray-400" />
            <p className="mt-3 text-sm font-medium text-gray-700">
              {isDragging ? 'Drop images here' : 'Drag and drop images here'}
            </p>
            <p className="mt-1 text-xs text-gray-400">or</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={remaining <= 0}
            >
              Browse Files
            </Button>
            <p className="mt-3 text-xs text-gray-400">
              Supports: JPG, PNG, WEBP (max {remaining} more)
            </p>
          </div>
        )}

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
      </CardContent>
    </Card>
  );
}

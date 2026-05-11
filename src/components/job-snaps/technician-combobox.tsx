'use client';

import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, User } from 'lucide-react';

interface TechnicianOption {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  title: string | null;
  role: string;
}

interface TechnicianComboboxProps {
  /** Site id — required to scope the technician list to the right org. */
  siteId: string;
  /** Currently selected technician profile id (null = no attribution). */
  value: string | null;
  onChange: (technicianId: string | null) => void;
  /** Optional disabled flag (e.g., while parent form is saving). */
  disabled?: boolean;
  /** Optional id for label htmlFor pairing. */
  id?: string;
}

/**
 * Picker for crediting a technician on a Job Snap.
 *
 * Owner/admin callers see every profile in the org.
 * Non-privileged callers see only themselves (returned by the API) so they
 * can't credit other people for their own uploads.
 */
export function TechnicianCombobox({
  siteId,
  value,
  onChange,
  disabled,
  id,
}: TechnicianComboboxProps) {
  const [options, setOptions] = useState<TechnicianOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/job-snaps/technicians?siteId=${siteId}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || 'Failed to load');
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setOptions(data.technicians || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load technicians');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  // The Select component cannot hold an empty-string value, so we use the
  // sentinel '__none' to represent "no attribution" and translate at the edge.
  const NONE = '__none';
  const selectValue = value || NONE;

  function handleChange(next: string) {
    onChange(next === NONE ? null : next);
  }

  return (
    <div className="relative">
      <Select
        value={selectValue}
        onValueChange={handleChange}
        disabled={disabled || loading}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={loading ? 'Loading…' : 'Select a technician'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>
            <span className="text-gray-500">No specific technician</span>
          </SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              <span className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-gray-400" />
                <span className="font-medium">{opt.full_name || 'Unnamed'}</span>
                {opt.title && (
                  <span className="text-xs text-gray-400">· {opt.title}</span>
                )}
                {opt.role === 'owner' && (
                  <span className="text-[10px] uppercase tracking-wide text-gray-400">
                    Owner
                  </span>
                )}
                {opt.role === 'admin' && (
                  <span className="text-[10px] uppercase tracking-wide text-gray-400">
                    Admin
                  </span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {loading && (
        <Loader2 className="absolute right-9 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400 pointer-events-none" />
      )}
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

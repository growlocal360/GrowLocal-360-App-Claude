'use client';

import { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, Square, CheckSquare, Briefcase, Tag, MapPin, FolderTree } from 'lucide-react';

export interface AttachmentSelection {
  service_ids: string[];
  category_ids: string[];
  brand_ids: string[];
  area_ids: string[];
}

export const EMPTY_SELECTION: AttachmentSelection = {
  service_ids: [],
  category_ids: [],
  brand_ids: [],
  area_ids: [],
};

interface TargetsResponse {
  services: Array<{ id: string; name: string; slug: string; category_id: string | null; category_name: string | null }>;
  categories: Array<{ id: string; name: string; is_primary: boolean }>;
  brands: Array<{ id: string; name: string; slug: string }>;
  service_areas: Array<{ id: string; name: string; slug: string; state: string | null }>;
}

interface AttachmentPickerProps {
  siteId: string;
  value: AttachmentSelection;
  onChange: (next: AttachmentSelection) => void;
  /** When present, the picker labels selections "primary" — used in the create flow to hint that the AI suggestion is pre-selected. */
  hintPrimaryServiceId?: string | null;
  disabled?: boolean;
}

/**
 * Tabbed multi-select for the four attachment target types a Job Snap can
 * link to: Services, Categories, Brands, Service Areas.
 *
 * The snap will appear on every public page corresponding to a checked row.
 * - Service tab: services grouped by their category (radio→multi)
 * - Category tab: flat list of the site's site_categories
 * - Brand tab: flat list of site_brands
 * - Areas tab: flat list of service_areas
 */
export function AttachmentPicker({
  siteId,
  value,
  onChange,
  hintPrimaryServiceId,
  disabled,
}: AttachmentPickerProps) {
  const [targets, setTargets] = useState<TargetsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/job-snaps/attachment-targets?siteId=${siteId}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || 'Failed to load attachment targets');
        return data as TargetsResponse;
      })
      .then((data) => {
        if (cancelled) return;
        setTargets(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  function toggle(key: keyof AttachmentSelection, id: string) {
    const current = value[key];
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    onChange({ ...value, [key]: next });
  }

  const totalSelected =
    value.service_ids.length +
    value.category_ids.length +
    value.brand_ids.length +
    value.area_ids.length;

  // Group services by category for the service tab tree
  const servicesByCategory = useMemo(() => {
    if (!targets) return new Map<string | null, TargetsResponse['services']>();
    const map = new Map<string | null, TargetsResponse['services']>();
    for (const svc of targets.services) {
      const key = svc.category_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(svc);
    }
    return map;
  }, [targets]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-4 px-3 border rounded-lg bg-gray-50">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading attachment options…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 py-4 px-3 border border-red-200 rounded-lg bg-red-50">
        {error}
      </div>
    );
  }

  if (!targets) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          The snap will appear on the public page for every checked item.
          Select as many as apply.
        </p>
        {totalSelected > 0 && (
          <Badge variant="outline" className="text-[10px]">
            {totalSelected} attached
          </Badge>
        )}
      </div>

      <Tabs defaultValue="services" className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="services" className="text-xs">
            <Briefcase className="h-3 w-3 mr-1" />
            Services
            {value.service_ids.length > 0 && (
              <span className="ml-1 rounded bg-[#00ef99]/20 px-1 text-[10px] font-medium text-gray-900">
                {value.service_ids.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="categories" className="text-xs">
            <FolderTree className="h-3 w-3 mr-1" />
            Categories
            {value.category_ids.length > 0 && (
              <span className="ml-1 rounded bg-[#00ef99]/20 px-1 text-[10px] font-medium text-gray-900">
                {value.category_ids.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="brands" className="text-xs">
            <Tag className="h-3 w-3 mr-1" />
            Brands
            {value.brand_ids.length > 0 && (
              <span className="ml-1 rounded bg-[#00ef99]/20 px-1 text-[10px] font-medium text-gray-900">
                {value.brand_ids.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="areas" className="text-xs">
            <MapPin className="h-3 w-3 mr-1" />
            Areas
            {value.area_ids.length > 0 && (
              <span className="ml-1 rounded bg-[#00ef99]/20 px-1 text-[10px] font-medium text-gray-900">
                {value.area_ids.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Services tab (grouped by category) ───────────────────────── */}
        <TabsContent value="services" className="mt-2">
          {targets.services.length === 0 ? (
            <EmptyHint message="No services configured for this site yet." />
          ) : (
            <div className="rounded-lg border bg-white max-h-72 overflow-y-auto divide-y">
              {Array.from(servicesByCategory.entries()).map(([catId, services]) => {
                const cat = targets.categories.find((c) => c.id === catId);
                const catLabel = cat ? cat.name : 'Uncategorized';
                return (
                  <div key={catId ?? 'uncat'} className="py-1.5">
                    <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-gray-400 font-medium">
                      {catLabel}
                    </div>
                    {services.map((svc) => (
                      <CheckRow
                        key={svc.id}
                        checked={value.service_ids.includes(svc.id)}
                        primary={svc.id === hintPrimaryServiceId}
                        label={svc.name}
                        onClick={() => !disabled && toggle('service_ids', svc.id)}
                        disabled={disabled}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Categories tab ──────────────────────────────────────────── */}
        <TabsContent value="categories" className="mt-2">
          {targets.categories.length === 0 ? (
            <EmptyHint message="No categories configured for this site yet." />
          ) : (
            <div className="rounded-lg border bg-white max-h-72 overflow-y-auto">
              {targets.categories.map((cat) => (
                <CheckRow
                  key={cat.id}
                  checked={value.category_ids.includes(cat.id)}
                  label={
                    <span className="flex items-center gap-2">
                      {cat.name}
                      {cat.is_primary && (
                        <Badge variant="outline" className="text-[9px] py-0 h-4">
                          Primary
                        </Badge>
                      )}
                    </span>
                  }
                  onClick={() => !disabled && toggle('category_ids', cat.id)}
                  disabled={disabled}
                />
              ))}
              <p className="px-3 py-2 text-[11px] text-gray-500 border-t bg-gray-50">
                Categories don&apos;t have a public landing page yet — but the
                attachment is stored, so when category pages ship you won&apos;t
                have to re-link existing snaps.
              </p>
            </div>
          )}
        </TabsContent>

        {/* ── Brands tab ──────────────────────────────────────────────── */}
        <TabsContent value="brands" className="mt-2">
          {targets.brands.length === 0 ? (
            <EmptyHint message="No brand pages configured for this site yet." />
          ) : (
            <div className="rounded-lg border bg-white max-h-72 overflow-y-auto">
              {targets.brands.map((brand) => (
                <CheckRow
                  key={brand.id}
                  checked={value.brand_ids.includes(brand.id)}
                  label={brand.name}
                  onClick={() => !disabled && toggle('brand_ids', brand.id)}
                  disabled={disabled}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Areas tab ───────────────────────────────────────────────── */}
        <TabsContent value="areas" className="mt-2">
          {targets.service_areas.length === 0 ? (
            <EmptyHint message="No service areas configured for this site yet." />
          ) : (
            <div className="rounded-lg border bg-white max-h-72 overflow-y-auto">
              {targets.service_areas.map((area) => (
                <CheckRow
                  key={area.id}
                  checked={value.area_ids.includes(area.id)}
                  label={
                    <span>
                      {area.name}
                      {area.state && (
                        <span className="text-gray-400 text-xs">, {area.state}</span>
                      )}
                    </span>
                  }
                  onClick={() => !disabled && toggle('area_ids', area.id)}
                  disabled={disabled}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

function CheckRow({
  checked,
  label,
  primary,
  onClick,
  disabled,
}: {
  checked: boolean;
  label: React.ReactNode;
  primary?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 px-3 py-2 pl-4 text-left text-sm transition-colors ${
        checked
          ? 'bg-[#00ef99]/10 text-gray-900 font-medium'
          : 'text-gray-600 hover:bg-gray-100'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <span
        className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center ${
          checked ? 'border-[#00ef99] bg-[#00ef99]' : 'border-gray-300'
        }`}
      >
        {checked ? (
          <CheckSquare className="h-3 w-3 text-white" strokeWidth={3} />
        ) : (
          <Square className="h-3 w-3 text-transparent" />
        )}
      </span>
      <span className="flex-1">{label}</span>
      {primary && (
        <Badge
          variant="outline"
          className="text-[9px] py-0 h-4 text-[#00ef99] border-[#00ef99]/40 bg-[#00ef99]/5"
        >
          <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
          AI suggested
        </Badge>
      )}
    </button>
  );
}

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="rounded-lg border bg-gray-50 px-3 py-4 text-xs text-gray-500">
      {message}
    </div>
  );
}

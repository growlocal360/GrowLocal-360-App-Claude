'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

interface ServiceOption {
  id: string;
  name: string;
}

interface CategoryOption {
  id: string;
  name: string;
  isPrimary: boolean;
  services: ServiceOption[];
}

interface ServiceComboboxProps {
  /** Currently selected service ID (null = none) */
  value: string | null;
  onChange: (serviceId: string | null, serviceName: string) => void;
  siteId: string;
  placeholder?: string;
  id?: string;
}

export function ServiceCombobox({
  value,
  onChange,
  siteId,
  placeholder = 'Select a service…',
  id,
}: ServiceComboboxProps) {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch categories + services
  useEffect(() => {
    if (!siteId) return;
    fetch(`/api/job-snaps/services?siteId=${siteId}`)
      .then((r) => r.json())
      .then((data) => setCategories(data.categories || []))
      .catch(() => {});
  }, [siteId]);

  // Set display text from selected value
  const allServices = categories.flatMap((c) => c.services);
  const selectedName = allServices.find((s) => s.id === value)?.name || '';

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
        // Reset search to selected name
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter services by search text
  const query = search.toLowerCase();
  const filtered = categories
    .map((cat) => ({
      ...cat,
      services: cat.services.filter((s) =>
        s.name.toLowerCase().includes(query)
      ),
    }))
    .filter((cat) => cat.services.length > 0);

  const flatFiltered = filtered.flatMap((c) => c.services);

  const select = (service: ServiceOption) => {
    onChange(service.id, service.name);
    setSearch('');
    setOpen(false);
    setActiveIndex(-1);
  };

  const clear = () => {
    onChange(null, '');
    setSearch('');
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || flatFiltered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatFiltered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      select(flatFiltered[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      setSearch('');
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        value={open ? search : selectedName}
        onChange={(e) => {
          setSearch(e.target.value);
          setActiveIndex(-1);
        }}
        onFocus={() => {
          setOpen(true);
          setSearch('');
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-md max-h-60 overflow-auto">
          {value && (
            <li
              className="cursor-pointer px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 border-b border-gray-100"
              onMouseDown={(e) => {
                e.preventDefault();
                clear();
              }}
            >
              Clear selection
            </li>
          )}
          {filtered.map((cat) => (
            <li key={cat.id}>
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50">
                {cat.name}
              </div>
              <ul>
                {cat.services.map((svc) => {
                  const flatIdx = flatFiltered.indexOf(svc);
                  const isSelected = svc.id === value;
                  return (
                    <li
                      key={svc.id}
                      className={`cursor-pointer px-4 py-2 text-sm ${
                        flatIdx === activeIndex
                          ? 'bg-[#00ef99]/10 text-gray-900'
                          : isSelected
                            ? 'bg-gray-100 text-gray-900 font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        select(svc);
                      }}
                    >
                      {svc.name}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
          {flatFiltered.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-400">No services found</li>
          )}
        </ul>
      )}
    </div>
  );
}

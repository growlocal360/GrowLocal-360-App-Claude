'use client';

import { useEffect, useState, useMemo } from 'react';
import { useWizardStore } from '@/lib/store/wizard-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Info,
  Plus,
  RefreshCw,
  Search,
  X,
  Wrench,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { WizardService } from '@/types/wizard';

export function StepServices() {
  const {
    primaryCategory,
    secondaryCategories,
    services,
    setServices,
    toggleService,
    addCustomService,
    removeService,
    prevStep,
    nextStep,
    canProceed,
  } = useWizardStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customServiceName, setCustomServiceName] = useState('');
  const [customServiceDescription, setCustomServiceDescription] = useState('');
  const [customServiceCategory, setCustomServiceCategory] = useState('');
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  // All selected categories (primary + secondary)
  const allCategories = useMemo(() => {
    const cats = [];
    if (primaryCategory) cats.push(primaryCategory);
    cats.push(...secondaryCategories);
    return cats;
  }, [primaryCategory, secondaryCategories]);

  // Fetch services from AI
  const generateServices = async () => {
    if (allCategories.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/services/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categories: allCategories.map((c) => ({
            gcid: c.gcid,
            name: c.displayName,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.services && data.services.length > 0) {
          let sortOrder = 0;
          const generatedServices: WizardService[] = data.services.map(
            (service: { name: string; description: string; categoryGcid: string; categoryName: string }) => {
              const slug = service.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');

              return {
                id: `ai-${service.categoryGcid}-${slug}`,
                name: service.name,
                slug,
                description: service.description || null,
                categoryGcid: service.categoryGcid,
                categoryName: service.categoryName,
                isSelected: true,
                isCustom: false,
                sortOrder: sortOrder++,
              };
            }
          );

          setServices(generatedServices);
        } else {
          setError('No services were generated. Try again or add services manually.');
        }
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || 'Failed to generate services. Please try again.');
      }
    } catch (err) {
      console.error('Error generating services:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate services on mount
  useEffect(() => {
    if (services.length > 0) return; // Already initialized
    generateServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCategories, services.length]);

  // Filter services by search
  const filteredServices = useMemo(() => {
    if (!searchQuery.trim()) return services;
    const query = searchQuery.toLowerCase();
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.categoryName.toLowerCase().includes(query)
    );
  }, [services, searchQuery]);

  // Group services by category, primary first
  const servicesByCategory = useMemo(() => {
    const grouped: Record<string, WizardService[]> = {};
    for (const service of filteredServices) {
      if (!grouped[service.categoryGcid]) {
        grouped[service.categoryGcid] = [];
      }
      grouped[service.categoryGcid].push(service);
    }

    // Sort: primary category first, then secondaries in allCategories order
    const sorted: Record<string, WizardService[]> = {};
    for (const cat of allCategories) {
      if (grouped[cat.gcid]) {
        sorted[cat.gcid] = grouped[cat.gcid];
      }
    }
    // Append any categories not in allCategories (shouldn't happen, but safe)
    for (const [gcid, services] of Object.entries(grouped)) {
      if (!sorted[gcid]) {
        sorted[gcid] = services;
      }
    }
    return sorted;
  }, [filteredServices, allCategories]);

  // Selected count
  const selectedCount = services.filter((s) => s.isSelected).length;

  // Handle adding custom service
  const handleAddCustomService = () => {
    if (!customServiceName.trim() || !customServiceCategory) return;

    const slug = customServiceName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const category = allCategories.find((c) => c.gcid === customServiceCategory);

    addCustomService({
      id: `custom-${Date.now()}-${slug}`,
      name: customServiceName.trim(),
      slug,
      description: customServiceDescription.trim() || null,
      categoryGcid: customServiceCategory,
      categoryName: category?.displayName || 'Custom',
      isSelected: true,
      isCustom: true,
      sortOrder: services.length,
    });

    setCustomServiceName('');
    setCustomServiceDescription('');
    setShowAddCustom(false);
  };

  // Toggle description expansion
  const toggleDescription = (id: string) => {
    setExpandedDescriptions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <span className="inline-block rounded bg-black px-2 py-1 text-xs font-medium text-white">
            Step 4 of 8
          </span>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">Services</h2>
          <p className="mt-1 text-gray-500">Generating SEO-optimized services for your categories...</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#00d9c0]" />
          <p className="text-sm text-gray-500">This may take a few seconds</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="inline-block rounded bg-black px-2 py-1 text-xs font-medium text-white">
          Step 4 of 8
        </span>
        <h2 className="mt-2 text-2xl font-bold text-gray-900">Services</h2>
        <p className="mt-1 text-gray-500">
          Select the services you offer. Each service gets its own optimized page.
        </p>
      </div>

      {/* Info Card */}
      <Card className="border-[#00d9c0]/20 bg-[#00d9c0]/5">
        <CardContent className="flex gap-3 p-4">
          <Wrench className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#00d9c0]" />
          <div>
            <p className="font-medium text-gray-900">Why Services Matter</p>
            <p className="text-sm text-gray-600">
              Primary category services get pages at the root level (e.g., <code className="rounded bg-gray-100 px-1">/ac-repair</code>).
              Secondary category services are grouped under their category (e.g., <code className="rounded bg-gray-100 px-1">/heating/furnace-repair</code>).
              This helps you rank for specific searches like &quot;AC repair near me&quot; or &quot;drain cleaning service&quot;.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Search and Add */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowAddCustom(!showAddCustom)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Custom
        </Button>
      </div>

      {/* Add Custom Form */}
      {showAddCustom && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="custom-service-name">Service Name</Label>
                <Input
                  id="custom-service-name"
                  placeholder="e.g., Vehicle Wraps & Fleet Graphics"
                  value={customServiceName}
                  onChange={(e) => setCustomServiceName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="custom-service-description">Description <span className="text-gray-400 font-normal">(optional)</span></Label>
                <textarea
                  id="custom-service-description"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-[#00d9c0] focus:outline-none focus:ring-1 focus:ring-[#00d9c0]"
                  rows={2}
                  placeholder="Brief description of this service for SEO..."
                  value={customServiceDescription}
                  onChange={(e) => setCustomServiceDescription(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="custom-service-category">Category</Label>
                <select
                  id="custom-service-category"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  value={customServiceCategory}
                  onChange={(e) => setCustomServiceCategory(e.target.value)}
                >
                  <option value="">Select a category</option>
                  {allCategories.map((cat) => (
                    <option key={cat.gcid} value={cat.gcid}>
                      {cat.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddCustom(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddCustomService}
                  disabled={!customServiceName.trim() || !customServiceCategory}
                >
                  Add Service
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">{selectedCount}</span> services selected
        </p>
      </div>

      {/* Services by Category */}
      <div className="space-y-6">
        {Object.entries(servicesByCategory).map(([categoryGcid, categoryServices]) => {
          const categoryName = categoryServices[0]?.categoryName || 'Services';
          const isPrimary = primaryCategory?.gcid === categoryGcid;

          return (
            <div key={categoryGcid}>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">{categoryName}</h3>
                {isPrimary && (
                  <Badge variant="secondary" className="bg-[#00d9c0]/10 text-[#00d9c0]">
                    Primary
                  </Badge>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {categoryServices.map((service) => (
                  <Card
                    key={service.id}
                    className={`cursor-pointer transition-all ${
                      service.isSelected
                        ? 'border-[#00d9c0] bg-[#00d9c0]/5 ring-1 ring-[#00d9c0]'
                        : 'hover:border-gray-300'
                    }`}
                    onClick={() => toggleService(service.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 truncate">
                              {service.name}
                            </p>
                            {service.isCustom && (
                              <Badge variant="outline" className="text-xs">
                                Custom
                              </Badge>
                            )}
                          </div>
                          {service.description && (
                            <div className="mt-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleDescription(service.id);
                                }}
                                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                              >
                                {expandedDescriptions.has(service.id) ? (
                                  <>
                                    <ChevronUp className="h-3 w-3" />
                                    Hide description
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3 w-3" />
                                    Show description
                                  </>
                                )}
                              </button>
                              {expandedDescriptions.has(service.id) && (
                                <p className="mt-1 text-sm text-gray-600">
                                  {service.description}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {service.isCustom && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeService(service.id);
                              }}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                              service.isSelected
                                ? 'border-[#00d9c0] bg-[#00d9c0] text-white'
                                : 'border-gray-300'
                            }`}
                          >
                            {service.isSelected && <Check className="h-3 w-3" />}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Error State */}
      {error && services.length === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <p className="font-medium text-amber-900">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={generateServices}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Retry
            </Button>
            <p className="text-xs text-amber-700">
              You can also add services manually using the &quot;Add Custom&quot; button above.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty State (search returned no results) */}
      {filteredServices.length === 0 && !error && services.length > 0 && (
        <div className="py-8 text-center">
          <Wrench className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-2 text-gray-500">No services found</p>
          <p className="text-sm text-gray-400">
            Try adjusting your search or add a custom service
          </p>
        </div>
      )}

      {/* Info about service pages */}
      <Card className="border-gray-200 bg-gray-50">
        <CardContent className="flex gap-3 p-4">
          <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-500" />
          <div>
            <p className="font-medium text-gray-900">How service pages work</p>
            <p className="text-sm text-gray-600">
              Each selected service gets a dedicated page with SEO-optimized content.
              You can add job photos (Job Snaps) to each service page to showcase your work.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" onClick={prevStep}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={nextStep} disabled={!canProceed()}>
          Next
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

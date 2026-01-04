'use client';

import { useEffect, useState, useMemo } from 'react';
import { useWizardStore } from '@/lib/store/wizard-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Check,
  Info,
  Plus,
  Search,
  X,
  Wrench,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { WizardService } from '@/types/wizard';
import { getCategoryByGcid } from '@/data/gbp-categories';

export function StepServices() {
  const {
    primaryCategory,
    secondaryCategories,
    services,
    setServices,
    toggleService,
    addCustomService,
    removeService,
    updateServiceDescription,
    prevStep,
    nextStep,
    canProceed,
  } = useWizardStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customServiceName, setCustomServiceName] = useState('');
  const [customServiceCategory, setCustomServiceCategory] = useState('');
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  // All selected categories (primary + secondary)
  const allCategories = useMemo(() => {
    const cats = [];
    if (primaryCategory) cats.push(primaryCategory);
    cats.push(...secondaryCategories);
    return cats;
  }, [primaryCategory, secondaryCategories]);

  // Initialize services from category commonServices on mount
  useEffect(() => {
    if (services.length > 0) return; // Already initialized
    if (allCategories.length === 0) return;

    setIsLoading(true);

    const initialServices: WizardService[] = [];
    let sortOrder = 0;

    for (const category of allCategories) {
      // Get the full category data with commonServices
      const fullCategory = getCategoryByGcid(category.gcid) || category;
      const commonServices = fullCategory.commonServices || [];

      for (const serviceName of commonServices) {
        const slug = serviceName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        initialServices.push({
          id: `${category.gcid}-${slug}`,
          name: serviceName,
          slug,
          description: null,
          categoryGcid: category.gcid,
          categoryName: category.displayName,
          isSelected: true, // Pre-select all common services
          isCustom: false,
          sortOrder: sortOrder++,
        });
      }
    }

    setServices(initialServices);
    setIsLoading(false);

    // Trigger LLM enhancement in background
    if (initialServices.length > 0) {
      enhanceWithLLM(initialServices);
    }
  }, [allCategories, services.length, setServices]);

  // Enhance services with LLM descriptions
  const enhanceWithLLM = async (currentServices: WizardService[]) => {
    setIsEnhancing(true);

    try {
      const response = await fetch('/api/services/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categories: allCategories.map((c) => ({
            gcid: c.gcid,
            name: c.displayName,
          })),
          existingServices: currentServices.map((s) => ({
            name: s.name,
            categoryGcid: s.categoryGcid,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Update existing services with descriptions
        if (data.descriptions) {
          const updatedServices = currentServices.map((service) => {
            const desc = data.descriptions[service.name];
            return desc ? { ...service, description: desc } : service;
          });

          // Add any new suggested services
          if (data.suggestions && data.suggestions.length > 0) {
            let maxSortOrder = Math.max(...currentServices.map((s) => s.sortOrder), 0);

            for (const suggestion of data.suggestions) {
              const slug = suggestion.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');

              // Check if service already exists
              const exists = updatedServices.some(
                (s) => s.slug === slug && s.categoryGcid === suggestion.categoryGcid
              );

              if (!exists) {
                updatedServices.push({
                  id: `llm-${suggestion.categoryGcid}-${slug}`,
                  name: suggestion.name,
                  slug,
                  description: suggestion.description || null,
                  categoryGcid: suggestion.categoryGcid,
                  categoryName: suggestion.categoryName,
                  isSelected: false, // LLM suggestions start unselected
                  isCustom: false,
                  sortOrder: ++maxSortOrder,
                });
              }
            }
          }

          setServices(updatedServices);
        }
      }
    } catch (error) {
      console.error('Error enhancing services:', error);
    } finally {
      setIsEnhancing(false);
    }
  };

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

  // Group services by category
  const servicesByCategory = useMemo(() => {
    const grouped: Record<string, WizardService[]> = {};
    for (const service of filteredServices) {
      if (!grouped[service.categoryGcid]) {
        grouped[service.categoryGcid] = [];
      }
      grouped[service.categoryGcid].push(service);
    }
    return grouped;
  }, [filteredServices]);

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
      description: null,
      categoryGcid: customServiceCategory,
      categoryName: category?.displayName || 'Custom',
      isSelected: true,
      isCustom: true,
      sortOrder: services.length,
    });

    setCustomServiceName('');
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
          <span className="inline-block rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white">
            Step 4 of 8
          </span>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">Services</h2>
          <p className="mt-1 text-gray-500">Loading services for your categories...</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="inline-block rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white">
          Step 4 of 8
        </span>
        <h2 className="mt-2 text-2xl font-bold text-gray-900">Services</h2>
        <p className="mt-1 text-gray-500">
          Select the services you offer. Each service gets its own optimized page.
        </p>
      </div>

      {/* Info Card */}
      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="flex gap-3 p-4">
          <Wrench className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
          <div>
            <p className="font-medium text-emerald-900">Why Services Matter</p>
            <p className="text-sm text-emerald-700">
              Each service creates a dedicated page at <code className="rounded bg-emerald-100 px-1">/services/[service-name]</code>.
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
                  placeholder="e.g., Emergency Leak Repair"
                  value={customServiceName}
                  onChange={(e) => setCustomServiceName(e.target.value)}
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
        {isEnhancing && (
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <Sparkles className="h-4 w-4 animate-pulse" />
            Generating descriptions...
          </div>
        )}
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
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
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
                        ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
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
                                ? 'border-emerald-500 bg-emerald-500 text-white'
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

      {/* Empty State */}
      {filteredServices.length === 0 && (
        <div className="py-8 text-center">
          <Wrench className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-2 text-gray-500">No services found</p>
          <p className="text-sm text-gray-400">
            Try adjusting your search or add a custom service
          </p>
        </div>
      )}

      {/* Info about service pages */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="flex gap-3 p-4">
          <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
          <div>
            <p className="font-medium text-blue-900">How service pages work</p>
            <p className="text-sm text-blue-700">
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

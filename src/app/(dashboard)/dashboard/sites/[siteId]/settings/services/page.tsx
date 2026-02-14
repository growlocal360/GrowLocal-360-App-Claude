'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Wrench,
  Plus,
  Trash2,
  Sparkles,
  AlertCircle,
  Check,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface ServiceItem {
  id: string;
  site_category_id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

interface CategoryWithGbp {
  id: string;
  is_primary: boolean;
  gbp_category: {
    gcid: string;
    display_name: string;
    name: string;
  };
}

interface SuggestedService {
  name: string;
  description: string;
  categoryGcid: string;
  categoryName: string;
}

export default function ServicesPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [categories, setCategories] = useState<CategoryWithGbp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Add service modal
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  // Suggest services
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedService[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);

  // Expanded categories
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Deleting / toggling
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchServices();
  }, [siteId]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/sites/${siteId}/settings/services`);
      if (!response.ok) throw new Error('Failed to fetch services');
      const data = await response.json();
      setServices(data.services || []);
      setCategories(data.categories || []);
      // Expand all categories by default
      const catIds = new Set<string>((data.categories || []).map((c: CategoryWithGbp) => c.id));
      setExpandedCategories(catIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const handleAddService = async () => {
    if (!newName.trim() || !newCategoryId) return;

    try {
      setAddSaving(true);
      setError(null);

      const response = await fetch(`/api/sites/${siteId}/settings/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || null,
          siteCategoryId: newCategoryId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add service');
      }

      const result = await response.json();
      setServices((prev) => [...prev, result.service]);
      setNewName('');
      setNewDescription('');
      setAddOpen(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add service');
    } finally {
      setAddSaving(false);
    }
  };

  const handleToggleActive = async (service: ServiceItem) => {
    try {
      setActionLoading(service.id);
      const response = await fetch(`/api/sites/${siteId}/settings/services`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: service.id, isActive: !service.is_active }),
      });

      if (!response.ok) throw new Error('Failed to update');

      setServices((prev) =>
        prev.map((s) =>
          s.id === service.id ? { ...s, is_active: !s.is_active } : s
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update service');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    try {
      setActionLoading(serviceId);
      const response = await fetch(
        `/api/sites/${siteId}/settings/services?id=${serviceId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) throw new Error('Failed to delete');

      setServices((prev) => prev.filter((s) => s.id !== serviceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete service');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuggestServices = async () => {
    try {
      setSuggesting(true);
      setError(null);

      const response = await fetch('/api/services/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categories: categories.map((c) => ({
            gcid: c.gbp_category.gcid,
            name: c.gbp_category.display_name,
          })),
        }),
      });

      if (!response.ok) throw new Error('Failed to get suggestions');

      const data = await response.json();
      // Filter out services that already exist
      const existingNames = new Set(services.map((s) => s.name.toLowerCase()));
      const filtered = (data.services || []).filter(
        (s: SuggestedService) => !existingNames.has(s.name.toLowerCase())
      );
      setSuggestions(filtered);
      setSuggestOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get suggestions');
    } finally {
      setSuggesting(false);
    }
  };

  const addSuggestedService = async (suggestion: SuggestedService) => {
    // Find matching category
    const matchingCat = categories.find(
      (c) => c.gbp_category.gcid === suggestion.categoryGcid
    );
    if (!matchingCat) return;

    try {
      const response = await fetch(`/api/sites/${siteId}/settings/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: suggestion.name,
          description: suggestion.description,
          siteCategoryId: matchingCat.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to add');

      const result = await response.json();
      setServices((prev) => [...prev, result.service]);
      setSuggestions((prev) => prev.filter((s) => s.name !== suggestion.name));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add suggested service');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-48 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Services</h1>
          <p className="text-gray-500 mt-1">
            Manage the services listed on your website
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleSuggestServices}
            disabled={suggesting}
          >
            {suggesting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Suggest Services
          </Button>
          <Button onClick={() => setAddOpen(true)} className="bg-black hover:bg-gray-800">
            <Plus className="h-4 w-4 mr-2" />
            Add Service
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 bg-[#00d9c0]/5 border border-[#00d9c0]/20 rounded-lg text-[#00d9c0]">
          <Check className="h-5 w-5 flex-shrink-0" />
          <p>Service added successfully!</p>
        </div>
      )}

      {/* Services grouped by category */}
      {categories.map((cat) => {
        const catServices = services.filter((s) => s.site_category_id === cat.id);
        const isExpanded = expandedCategories.has(cat.id);

        return (
          <Card key={cat.id}>
            <CardHeader
              className="cursor-pointer select-none"
              onClick={() => toggleCategory(cat.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                  <h2 className="font-semibold">{cat.gbp_category.display_name}</h2>
                  {cat.is_primary && (
                    <Badge variant="default" className="bg-[#00d9c0] text-white text-xs">
                      Primary
                    </Badge>
                  )}
                </div>
                <span className="text-sm text-gray-400">
                  {catServices.length} service{catServices.length !== 1 ? 's' : ''}
                </span>
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent>
                {catServices.length > 0 ? (
                  <div className="space-y-2">
                    {catServices.map((service) => (
                      <div
                        key={service.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          service.is_active
                            ? 'bg-white border-gray-200'
                            : 'bg-gray-50 border-gray-100 opacity-60'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{service.name}</p>
                          {service.description && (
                            <p className="text-xs text-gray-500 truncate mt-0.5">
                              {service.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(service)}
                            disabled={actionLoading === service.id}
                            className="text-xs"
                          >
                            {actionLoading === service.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : service.is_active ? (
                              'Disable'
                            ) : (
                              'Enable'
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteService(service.id)}
                            disabled={actionLoading === service.id}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No services in this category yet.</p>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Add Service Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Service</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="serviceName">Service Name</Label>
              <Input
                id="serviceName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., AC Installation"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="serviceDesc">Description (optional)</Label>
              <Input
                id="serviceDesc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Brief description of this service"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={newCategoryId} onValueChange={setNewCategoryId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.gbp_category.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddService}
                disabled={addSaving || !newName.trim() || !newCategoryId}
                className="bg-black hover:bg-gray-800"
              >
                {addSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Add Service
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Suggestions Modal */}
      <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Suggested Services</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {suggestions.length > 0 ? (
              suggestions.map((s, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between p-3 rounded-lg border hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                    <Badge variant="secondary" className="text-xs mt-1">
                      {s.categoryName}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addSuggestedService(s)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                All suggested services have already been added!
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

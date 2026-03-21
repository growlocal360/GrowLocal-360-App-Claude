'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Building2, AlertCircle, Check, Loader2, ArrowLeft } from 'lucide-react';

interface BusinessInfo {
  name: string;
  phone: string | null;
  email: string | null;
  coreIndustry: string | null;
  businessDescription: string;
  credentials: string;
}

export default function BusinessInfoPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [original, setOriginal] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [coreIndustry, setCoreIndustry] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [credentials, setCredentials] = useState('');

  useEffect(() => {
    fetchBusinessInfo();
  }, [siteId]);

  const fetchBusinessInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/sites/${siteId}/settings/business`);
      if (!response.ok) throw new Error('Failed to fetch business info');
      const data: BusinessInfo = await response.json();
      setOriginal(data);
      setName(data.name || '');
      setPhone(data.phone || '');
      setEmail(data.email || '');
      setCoreIndustry(data.coreIndustry || '');
      setBusinessDescription(data.businessDescription || '');
      setCredentials(data.credentials || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load business info');
    } finally {
      setLoading(false);
    }
  };

  const hasChanges =
    name !== (original?.name || '') ||
    phone !== (original?.phone || '') ||
    email !== (original?.email || '') ||
    coreIndustry !== (original?.coreIndustry || '') ||
    businessDescription !== (original?.businessDescription || '') ||
    credentials !== (original?.credentials || '');

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const response = await fetch(`/api/sites/${siteId}/settings/business`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, coreIndustry, businessDescription, credentials }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      setOriginal({ name, phone, email, coreIndustry, businessDescription, credentials });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <Link
        href={`/dashboard/sites/${siteId}`}
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Site
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Business Info</h1>
        <p className="text-gray-500 mt-1">
          Update your business name, phone, email, and industry
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 bg-[#00ef99]/5 border border-[#00ef99]/20 rounded-lg text-[#00ef99]">
          <Check className="h-5 w-5 flex-shrink-0" />
          <p>Business info saved successfully!</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#00ef99]" />
            <h2 className="font-semibold">Business Details</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Business Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Business Name"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hello@yourbusiness.com"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="coreIndustry">Core Industry</Label>
            <Input
              id="coreIndustry"
              value={coreIndustry}
              onChange={(e) => setCoreIndustry(e.target.value)}
              placeholder="e.g., HVAC, Plumbing, Appliance Repair"
              className="mt-1"
            />
            <p className="text-xs text-gray-400 mt-1">
              Used to improve AI-generated content for your site
            </p>
          </div>

          <div>
            <Label htmlFor="businessDescription">About the Business</Label>
            <Textarea
              id="businessDescription"
              value={businessDescription}
              onChange={(e) => setBusinessDescription(e.target.value)}
              placeholder="Describe your business, what makes it unique, your history, and what sets you apart from competitors..."
              className="mt-1"
              rows={5}
            />
            <p className="text-xs text-gray-400 mt-1">
              Used to generate your About page and inform all content
            </p>
          </div>

          <div>
            <Label htmlFor="credentials">Credentials & Certifications</Label>
            <Textarea
              id="credentials"
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              placeholder="e.g., Licensed & Insured, EPA Certified, BBB A+ Rating, NATE Certified Technicians, 20+ years experience..."
              className="mt-1"
              rows={3}
            />
            <p className="text-xs text-gray-400 mt-1">
              Licenses, certifications, and qualifications to highlight across your site
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="bg-black hover:bg-gray-800"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </div>
  );
}

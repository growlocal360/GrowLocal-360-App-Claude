'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';

interface AddStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStaffAdded: () => void;
}

interface OrgSite {
  id: string;
  name: string;
}

export function AddStaffDialog({ open, onOpenChange, onStaffAdded }: AddStaffDialogProps) {
  const [fullName, setFullName] = useState('');
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [sites, setSites] = useState<OrgSite[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (!open) return;

    async function fetchSites() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      const { data: sitesData } = await supabase
        .from('sites')
        .select('id, name')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true)
        .order('name');

      setSites(sitesData || []);
    }

    fetchSites();
  }, [open, supabase]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFullName('');
      setTitle('');
      setEmail('');
      setBio('');
      setSelectedSiteIds([]);
      setError('');
      setSuccess(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      setError('Full name is required');
      return;
    }

    setSaving(true);
    setError('');

    const res = await fetch('/api/team/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName,
        title: title || undefined,
        email: email || undefined,
        bio: bio || undefined,
        siteIds: selectedSiteIds,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Failed to add staff member');
      setSaving(false);
      return;
    }

    setSuccess(true);
    setSaving(false);
    onStaffAdded();

    setTimeout(() => {
      onOpenChange(false);
    }, 1500);
  };

  const toggleSite = (siteId: string) => {
    setSelectedSiteIds((prev) =>
      prev.includes(siteId)
        ? prev.filter((id) => id !== siteId)
        : [...prev, siteId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
          <DialogDescription>
            Add a staff member to your team. They&apos;ll appear on your website but won&apos;t have dashboard access.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center">
            <p className="text-sm font-medium text-green-600">
              {fullName} added to your team!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
            )}

            <div className="space-y-2">
              <Label htmlFor="staff-name">Full Name *</Label>
              <Input
                id="staff-name"
                placeholder="John Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-title">Title / Role</Label>
              <Input
                id="staff-title"
                placeholder="Lead Technician"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-email">Email (optional)</Label>
              <Input
                id="staff-email"
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Site Access</Label>
              {sites.length > 0 ? (
                <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
                  {sites.map((site) => (
                    <div key={site.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`staff-site-${site.id}`}
                        checked={selectedSiteIds.includes(site.id)}
                        onCheckedChange={() => toggleSite(site.id)}
                      />
                      <label htmlFor={`staff-site-${site.id}`} className="text-sm text-gray-700">
                        {site.name}
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No sites available</p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving}
                style={{ backgroundColor: '#00ef99' }}
                className="hover:opacity-90"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Add Member
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Camera } from 'lucide-react';

interface StaffMemberData {
  id: string;
  full_name: string;
  title: string | null;
  email: string | null;
  bio: string | null;
  avatar_url: string | null;
  site_assignments: { site_id: string; site_name: string }[];
}

interface EditStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: StaffMemberData | null;
  onStaffUpdated: () => void;
}

interface OrgSite {
  id: string;
  name: string;
}

export function EditStaffDialog({ open, onOpenChange, staff, onStaffUpdated }: EditStaffDialogProps) {
  const [fullName, setFullName] = useState('');
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [sites, setSites] = useState<OrgSite[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  useEffect(() => {
    if (!open || !staff) return;

    setFullName(staff.full_name);
    setTitle(staff.title || '');
    setEmail(staff.email || '');
    setBio(staff.bio || '');
    setSelectedSiteIds(staff.site_assignments.map(a => a.site_id));
    setAvatarPreview(staff.avatar_url);
    setError('');

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
  }, [open, staff, supabase]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !staff) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('avatar', file);

    const res = await fetch(`/api/team/staff/${staff.id}/avatar`, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      setAvatarPreview(data.url);
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to upload photo');
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!staff) return;
    if (!fullName.trim()) {
      setError('Full name is required');
      return;
    }

    setSaving(true);
    setError('');

    const res = await fetch('/api/team/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staffId: staff.id,
        fullName,
        title: title || undefined,
        email: email || undefined,
        bio: bio || undefined,
        siteIds: selectedSiteIds,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to update staff member');
      setSaving(false);
      return;
    }

    setSaving(false);
    onStaffUpdated();
    onOpenChange(false);
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
          <DialogTitle>Edit Team Member</DialogTitle>
          <DialogDescription>
            Update this staff member&apos;s details and photo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          {/* Avatar upload */}
          <div className="flex justify-center">
            <div className="relative">
              <Avatar className="h-20 w-20">
                {avatarPreview && (
                  <AvatarImage src={avatarPreview} alt={fullName} />
                )}
                <AvatarFallback className="bg-gray-100 text-lg font-medium text-gray-600">
                  {fullName?.charAt(0)?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#00ef99] text-white shadow-sm hover:opacity-90"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-staff-name">Full Name *</Label>
            <Input
              id="edit-staff-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-staff-title">Title / Role</Label>
            <Input
              id="edit-staff-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-staff-email">Email (optional)</Label>
            <Input
              id="edit-staff-email"
              type="email"
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
                      id={`edit-staff-site-${site.id}`}
                      checked={selectedSiteIds.includes(site.id)}
                      onCheckedChange={() => toggleSite(site.id)}
                    />
                    <label htmlFor={`edit-staff-site-${site.id}`} className="text-sm text-gray-700">
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
              Save Changes
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

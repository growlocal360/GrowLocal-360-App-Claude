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

interface MemberData {
  id: string;
  full_name: string | null;
  title: string | null;
  bio: string | null;
  avatar_url: string | null;
  email: string;
  role: string;
  site_assignments: { site_id: string; site_name: string }[];
}

interface EditMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: MemberData | null;
  onMemberUpdated: () => void;
}

interface OrgSite {
  id: string;
  name: string;
}

export function EditMemberDialog({ open, onOpenChange, member, onMemberUpdated }: EditMemberDialogProps) {
  const [fullName, setFullName] = useState('');
  const [title, setTitle] = useState('');
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
    if (!open || !member) return;

    setFullName(member.full_name || '');
    setTitle(member.title || '');
    setBio(member.bio || '');
    setAvatarPreview(member.avatar_url);
    setSelectedSiteIds(member.site_assignments.map(a => a.site_id));
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
  }, [open, member, supabase]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !member) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('avatar', file);

    const res = await fetch(`/api/team/members/${member.id}/avatar`, {
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
    if (!member) return;

    setSaving(true);
    setError('');

    // Update profile fields
    const profileRes = await fetch('/api/team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileId: member.id,
        fullName: fullName.trim() || undefined,
        title: title || undefined,
        bio: bio || undefined,
      }),
    });

    if (!profileRes.ok) {
      const data = await profileRes.json();
      setError(data.error || 'Failed to update member');
      setSaving(false);
      return;
    }

    // Update site assignments
    const sitesRes = await fetch(`/api/team/members/${member.id}/sites`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteIds: selectedSiteIds }),
    });

    if (!sitesRes.ok) {
      const data = await sitesRes.json();
      setError(data.error || 'Failed to update site assignments');
      setSaving(false);
      return;
    }

    setSaving(false);
    onMemberUpdated();
    onOpenChange(false);
  };

  const toggleSite = (siteId: string) => {
    setSelectedSiteIds((prev) =>
      prev.includes(siteId)
        ? prev.filter((id) => id !== siteId)
        : [...prev, siteId]
    );
  };

  const displayName = fullName || member?.email || '?';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Team Member</DialogTitle>
          <DialogDescription>
            Update this member&apos;s profile, photo, and site access.
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
                  <AvatarImage src={avatarPreview} alt={displayName} />
                )}
                <AvatarFallback className="bg-gray-100 text-lg font-medium text-gray-600">
                  {displayName.charAt(0).toUpperCase()}
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
            <Label htmlFor="edit-member-name">Full Name</Label>
            <Input
              id="edit-member-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-member-title">Title / Role</Label>
            <Input
              id="edit-member-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-member-bio">Bio</Label>
            <Input
              id="edit-member-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <p className="text-xs text-gray-400">Email: {member?.email}</p>

          {member?.role !== 'owner' && (
            <div className="space-y-2">
              <Label>Site Access</Label>
              {sites.length > 0 ? (
                <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
                  {sites.map((site) => (
                    <div key={site.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-member-site-${site.id}`}
                        checked={selectedSiteIds.includes(site.id)}
                        onCheckedChange={() => toggleSite(site.id)}
                      />
                      <label htmlFor={`edit-member-site-${site.id}`} className="text-sm text-gray-700">
                        {site.name}
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No sites available</p>
              )}
              <p className="text-xs text-gray-400">
                {selectedSiteIds.length === 0 && member?.role === 'admin'
                  ? 'No sites selected = access to all sites'
                  : selectedSiteIds.length === 0
                    ? 'No sites selected = no access'
                    : `${selectedSiteIds.length} site${selectedSiteIds.length !== 1 ? 's' : ''} selected`}
              </p>
            </div>
          )}

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

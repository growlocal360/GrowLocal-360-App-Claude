'use client';

import { useState, useEffect, useRef } from 'react';
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
}

interface EditMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: MemberData | null;
  onMemberUpdated: () => void;
}

export function EditMemberDialog({ open, onOpenChange, member, onMemberUpdated }: EditMemberDialogProps) {
  const [fullName, setFullName] = useState('');
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !member) return;

    setFullName(member.full_name || '');
    setTitle(member.title || '');
    setBio(member.bio || '');
    setAvatarPreview(member.avatar_url);
    setError('');
  }, [open, member]);

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

    const res = await fetch('/api/team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileId: member.id,
        fullName: fullName.trim() || undefined,
        title: title || undefined,
        bio: bio || undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to update member');
      setSaving(false);
      return;
    }

    setSaving(false);
    onMemberUpdated();
    onOpenChange(false);
  };

  const displayName = fullName || member?.email || '?';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Team Member</DialogTitle>
          <DialogDescription>
            Update this member&apos;s profile details and photo.
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

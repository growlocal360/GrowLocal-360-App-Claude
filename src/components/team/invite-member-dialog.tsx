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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import type { UserRole } from '@/types/database';

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callerRole: UserRole;
  onInviteSent: () => void;
}

interface OrgSite {
  id: string;
  name: string;
}

export function InviteMemberDialog({ open, onOpenChange, callerRole, onInviteSent }: InviteMemberDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [allSites, setAllSites] = useState(true);
  const [sites, setSites] = useState<OrgSite[]>([]);
  const [sending, setSending] = useState(false);
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
      setEmail('');
      setRole('user');
      setSelectedSiteIds([]);
      setAllSites(true);
      setError('');
      setSuccess(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!email) {
      setError('Email is required');
      return;
    }

    setSending(true);
    setError('');

    const siteIds = allSites ? [] : selectedSiteIds;

    const res = await fetch('/api/team/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role, siteIds }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Failed to send invitation');
      setSending(false);
      return;
    }

    setSuccess(true);
    setSending(false);
    onInviteSent();

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
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join your team. They&apos;ll receive an email with a link to accept.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center">
            <p className="text-sm font-medium text-green-600">
              Invitation sent to {email}!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
            )}

            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              {callerRole === 'owner' ? (
                <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'user')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin — Can manage assigned sites</SelectItem>
                    <SelectItem value="user">User — Limited access to assigned sites</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-gray-500">User — Limited access to assigned sites</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Site Access</Label>
              {role === 'admin' && (
                <div className="flex items-center space-x-2 mb-2">
                  <Checkbox
                    id="all-sites"
                    checked={allSites}
                    onCheckedChange={(checked) => {
                      setAllSites(checked === true);
                      if (checked) setSelectedSiteIds([]);
                    }}
                  />
                  <label htmlFor="all-sites" className="text-sm text-gray-700">
                    All sites (current and future)
                  </label>
                </div>
              )}
              {(role === 'user' || !allSites) && sites.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
                  {sites.map((site) => (
                    <div key={site.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`site-${site.id}`}
                        checked={selectedSiteIds.includes(site.id)}
                        onCheckedChange={() => toggleSite(site.id)}
                      />
                      <label htmlFor={`site-${site.id}`} className="text-sm text-gray-700">
                        {site.name}
                      </label>
                    </div>
                  ))}
                </div>
              )}
              {(role === 'user' || !allSites) && sites.length === 0 && (
                <p className="text-sm text-gray-400">No sites available</p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={sending}
                style={{ backgroundColor: '#00d9c0' }}
                className="hover:opacity-90"
              >
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send Invitation
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

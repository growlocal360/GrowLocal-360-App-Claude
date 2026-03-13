'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users, MoreVertical, UserPlus, Mail, X, Shield, Crown, User } from 'lucide-react';
import { InviteMemberDialog } from '@/components/team/invite-member-dialog';
import type { UserRole } from '@/types/database';

interface TeamMember {
  id: string;
  user_id: string;
  role: UserRole;
  full_name: string | null;
  avatar_url: string | null;
  email: string;
  created_at: string;
  site_assignments: { site_id: string; site_name: string; site_slug: string }[];
}

interface PendingInvitation {
  id: string;
  email: string;
  role: UserRole;
  expires_at: string;
  created_at: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inviter: any;
}

const roleBadge = (role: UserRole) => {
  switch (role) {
    case 'owner':
      return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100"><Crown className="mr-1 h-3 w-3" /> Owner</Badge>;
    case 'admin':
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100"><Shield className="mr-1 h-3 w-3" /> Admin</Badge>;
    case 'user':
      return <Badge variant="secondary"><User className="mr-1 h-3 w-3" /> User</Badge>;
  }
};

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [callerRole, setCallerRole] = useState<UserRole>('user');
  const [loading, setLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [userData, setUserData] = useState({
    name: 'User',
    email: '',
    avatarUrl: undefined as string | undefined,
  });

  const supabase = createClient();

  const fetchTeamData = useCallback(async () => {
    const [membersRes, invitesRes] = await Promise.all([
      fetch('/api/team'),
      fetch('/api/team/invitations'),
    ]);

    if (membersRes.ok) {
      const data = await membersRes.json();
      setMembers(data.members);
      setCallerRole(data.callerRole);
    }

    if (invitesRes.ok) {
      const data = await invitesRes.json();
      setInvitations(data.invitations);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('user_id', user?.id)
        .single();

      setUserData({
        name: profile?.full_name || user?.user_metadata?.full_name || 'User',
        email: user?.email || '',
        avatarUrl: profile?.avatar_url,
      });
    }

    loadUser();
    fetchTeamData();
  }, [supabase, fetchTeamData]);

  const handleChangeRole = async (profileId: string, newRole: UserRole) => {
    const res = await fetch('/api/team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId, role: newRole }),
    });

    if (res.ok) {
      fetchTeamData();
    }
  };

  const handleRemoveMember = async () => {
    if (!removingId) return;

    const res = await fetch(`/api/team?profileId=${removingId}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      fetchTeamData();
    }
    setRemovingId(null);
  };

  const handleCancelInvite = async (invitationId: string) => {
    const res = await fetch(`/api/team/invitations?id=${invitationId}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      fetchTeamData();
    }
  };

  const canManageTeam = callerRole === 'owner' || callerRole === 'admin';

  if (loading) {
    return (
      <div className="flex flex-col">
        <Header title="Team" user={userData} />
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Header title="Team" user={userData} />

      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-gray-400" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
              <p className="text-sm text-gray-500">{members.length} member{members.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          {canManageTeam && (
            <Button
              onClick={() => setShowInviteDialog(true)}
              style={{ backgroundColor: '#00d9c0' }}
              className="hover:opacity-90"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          )}
        </div>

        {/* Members List */}
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600">
                      {member.full_name?.charAt(0)?.toUpperCase() || member.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {member.full_name || member.email}
                        </span>
                        {roleBadge(member.role)}
                      </div>
                      <p className="text-sm text-gray-500">{member.email}</p>
                      {member.site_assignments.length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Sites: {member.site_assignments.map(a => a.site_name).join(', ')}
                        </p>
                      )}
                      {member.role !== 'owner' && member.site_assignments.length === 0 && member.role === 'admin' && (
                        <p className="text-xs text-gray-400 mt-0.5">Access: All sites</p>
                      )}
                    </div>
                  </div>

                  {callerRole === 'owner' && member.role !== 'owner' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {member.role === 'user' && (
                          <DropdownMenuItem onClick={() => handleChangeRole(member.id, 'admin')}>
                            <Shield className="mr-2 h-4 w-4" />
                            Promote to Admin
                          </DropdownMenuItem>
                        )}
                        {member.role === 'admin' && (
                          <DropdownMenuItem onClick={() => handleChangeRole(member.id, 'user')}>
                            <User className="mr-2 h-4 w-4" />
                            Demote to User
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setRemovingId(member.id)}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Remove from Team
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        {canManageTeam && invitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5 text-gray-400" />
                Pending Invitations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {invitations.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{invite.email}</span>
                        {roleBadge(invite.role)}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Expires {new Date(invite.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancelInvite(invite.id)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Invite Dialog */}
      <InviteMemberDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        callerRole={callerRole}
        onInviteSent={fetchTeamData}
      />

      {/* Remove Confirmation */}
      <AlertDialog open={!!removingId} onOpenChange={(open) => !open && setRemovingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this person from your team? They will lose access to all sites.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

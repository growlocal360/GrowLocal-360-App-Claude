'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Users, MoreVertical, UserPlus, Mail, X, Shield, Crown, User, Search, UserCheck, Pencil } from 'lucide-react';
import { InviteMemberDialog } from '@/components/team/invite-member-dialog';
import { AddStaffDialog } from '@/components/team/add-staff-dialog';
import { EditStaffDialog } from '@/components/team/edit-staff-dialog';
import type { UserRole } from '@/types/database';
import { getActiveOrgIdClient } from '@/lib/auth/active-org-client';

interface TeamMember {
  id: string;
  user_id: string;
  role: UserRole;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  title: string | null;
  email: string;
  created_at: string;
  site_assignments: { site_id: string; site_name: string; site_slug: string }[];
}

interface StaffMember {
  id: string;
  full_name: string;
  title: string | null;
  email: string | null;
  bio: string | null;
  avatar_url: string | null;
  show_on_site: boolean;
  display_order: number;
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

const roleBadge = (role: UserRole | 'staff') => {
  switch (role) {
    case 'owner':
      return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100"><Crown className="mr-1 h-3 w-3" /> Owner</Badge>;
    case 'admin':
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100"><Shield className="mr-1 h-3 w-3" /> Admin</Badge>;
    case 'user':
      return <Badge variant="secondary"><User className="mr-1 h-3 w-3" /> User</Badge>;
    case 'staff':
      return <Badge className="bg-teal-100 text-teal-700 hover:bg-teal-100"><UserCheck className="mr-1 h-3 w-3" /> Staff</Badge>;
  }
};

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [callerRole, setCallerRole] = useState<UserRole>('user');
  const [loading, setLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showAddStaffDialog, setShowAddStaffDialog] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removingStaffId, setRemovingStaffId] = useState<string | null>(null);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [userData, setUserData] = useState({
    name: 'User',
    email: '',
    avatarUrl: undefined as string | undefined,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSite, setFilterSite] = useState('all');
  const [filterRole, setFilterRole] = useState('all');

  const supabase = createClient();

  const fetchTeamData = useCallback(async () => {
    const [membersRes, staffRes, invitesRes] = await Promise.all([
      fetch('/api/team'),
      fetch('/api/team/staff'),
      fetch('/api/team/invitations'),
    ]);

    if (membersRes.ok) {
      const data = await membersRes.json();
      setMembers(data.members);
      setCallerRole(data.callerRole);
    }

    if (staffRes.ok) {
      const data = await staffRes.json();
      setStaffMembers(data.staff);
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
      const activeOrgId = getActiveOrgIdClient();
      const { data: userProfiles } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, role, organization_id')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      const profile = (activeOrgId
        ? userProfiles?.find((p: { organization_id: string }) => p.organization_id === activeOrgId)
        : userProfiles?.[0]) || userProfiles?.[0] || null;

      setUserData({
        name: profile?.full_name || user?.user_metadata?.full_name || 'User',
        email: user?.email || '',
        avatarUrl: profile?.avatar_url,
      });
    }

    loadUser();
    fetchTeamData();
  }, [supabase, fetchTeamData]);

  // Collect unique sites for the filter dropdown
  const allSites = useMemo(() => {
    const siteMap = new Map<string, string>();
    for (const m of members) {
      for (const a of m.site_assignments) {
        siteMap.set(a.site_id, a.site_name);
      }
    }
    for (const s of staffMembers) {
      for (const a of s.site_assignments) {
        siteMap.set(a.site_id, a.site_name);
      }
    }
    return Array.from(siteMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [members, staffMembers]);

  // Filter members
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!(m.full_name?.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))) return false;
      }
      if (filterSite !== 'all') {
        if (!m.site_assignments.some(a => a.site_id === filterSite) && m.role !== 'owner') return false;
      }
      if (filterRole !== 'all' && filterRole !== 'staff') {
        if (m.role !== filterRole) return false;
      }
      if (filterRole === 'staff') return false; // Staff filter hides auth members
      return true;
    });
  }, [members, searchQuery, filterSite, filterRole]);

  // Filter staff
  const filteredStaff = useMemo(() => {
    return staffMembers.filter(s => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!s.full_name.toLowerCase().includes(q) && !(s.email?.toLowerCase().includes(q))) return false;
      }
      if (filterSite !== 'all') {
        if (!s.site_assignments.some(a => a.site_id === filterSite)) return false;
      }
      if (filterRole !== 'all' && filterRole !== 'staff') return false; // Non-staff role filter hides staff
      return true;
    });
  }, [staffMembers, searchQuery, filterSite, filterRole]);

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

  const handleRemoveStaff = async () => {
    if (!removingStaffId) return;

    const res = await fetch(`/api/team/staff?staffId=${removingStaffId}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      fetchTeamData();
    }
    setRemovingStaffId(null);
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

  const showFilters = members.length + staffMembers.length > 3 || allSites.length > 1;

  return (
    <div className="flex flex-col">
      <Header title="Team" user={userData} />

      <div className="p-6 space-y-6">
        {/* Filters */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {allSites.length > 1 && (
              <Select value={filterSite} onValueChange={setFilterSite}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {allSites.map(site => (
                    <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Team Members (with access) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-gray-400" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Team Members</h2>
                <p className="text-sm text-gray-500">{filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            {canManageTeam && (
              <Button
                onClick={() => setShowInviteDialog(true)}
                style={{ backgroundColor: '#00ef99' }}
                className="hover:opacity-90"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add Team User
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {filteredMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        {member.avatar_url && (
                          <AvatarImage src={member.avatar_url} alt={member.full_name || member.email} />
                        )}
                        <AvatarFallback className="bg-gray-100 text-sm font-medium text-gray-600">
                          {member.full_name?.charAt(0)?.toUpperCase() || member.email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {member.full_name || member.email}
                          </span>
                          {roleBadge(member.role)}
                        </div>
                        {member.title && (
                          <p className="text-sm text-gray-600">{member.title}</p>
                        )}
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
                {filteredMembers.length === 0 && (
                  <div className="p-6 text-center text-sm text-gray-400">
                    No team members match your filters
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Staff (No Access) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <UserCheck className="h-6 w-6 text-gray-400" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Staff (No Access)</h2>
                <p className="text-sm text-gray-500">{filteredStaff.length} member{filteredStaff.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            {canManageTeam && (
              <Button
                onClick={() => setShowAddStaffDialog(true)}
                style={{ backgroundColor: '#00ef99' }}
                className="hover:opacity-90"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add Team Member
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {filteredStaff.map((staff) => (
                  <div key={staff.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        {staff.avatar_url && (
                          <AvatarImage src={staff.avatar_url} alt={staff.full_name} />
                        )}
                        <AvatarFallback className="bg-gray-100 text-sm font-medium text-gray-600">
                          {staff.full_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{staff.full_name}</span>
                          {roleBadge('staff')}
                        </div>
                        {staff.title && (
                          <p className="text-sm text-gray-600">{staff.title}</p>
                        )}
                        {staff.email && (
                          <p className="text-sm text-gray-500">{staff.email}</p>
                        )}
                        {staff.site_assignments.length > 0 && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Sites: {staff.site_assignments.map(a => a.site_name).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>

                    {canManageTeam && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingStaff(staff)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Member
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => setRemovingStaffId(staff.id)}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Remove from Team
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                ))}
                {filteredStaff.length === 0 && (
                  <div className="p-6 text-center text-sm text-gray-400">
                    {staffMembers.length === 0
                      ? 'No staff members yet. Add team members who appear on your website without dashboard access.'
                      : 'No staff members match your filters'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

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

      {/* Add Staff Dialog */}
      <AddStaffDialog
        open={showAddStaffDialog}
        onOpenChange={setShowAddStaffDialog}
        onStaffAdded={fetchTeamData}
      />

      {/* Edit Staff Dialog */}
      <EditStaffDialog
        open={!!editingStaff}
        onOpenChange={(open) => !open && setEditingStaff(null)}
        staff={editingStaff}
        onStaffUpdated={fetchTeamData}
      />

      {/* Remove Member Confirmation */}
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

      {/* Remove Staff Confirmation */}
      <AlertDialog open={!!removingStaffId} onOpenChange={(open) => !open && setRemovingStaffId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Staff Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this staff member? They will no longer appear on your website.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveStaff}
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

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { getActiveOrgIdClient } from '@/lib/auth/active-org-client';
import {
  ArrowLeft, Settings, CalendarPlus, ChevronLeft, ChevronRight,
  Clock, Phone, Mail, User, CheckCircle2, XCircle, AlertCircle,
  Loader2, CalendarDays, Users, Megaphone,
} from 'lucide-react';
import type { Appointment, AppointmentStatus, StaffMember, AvailabilityPost } from '@/types/database';

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-500',
  no_show: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function getWeekDates(baseDate: Date): string[] {
  const dates: string[] = [];
  const start = new Date(baseDate);
  start.setDate(start.getDate() - start.getDay()); // Start from Sunday
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

interface AppointmentWithStaff extends Appointment {
  staff_member?: { id: string; full_name: string; avatar_url: string | null; phone: string | null } | null;
}

interface NewAppointmentForm {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_city: string;
  customer_zip: string;
  service_type: string;
  notes: string;
  scheduled_date: string;
  time_window_start: string;
  time_window_end: string;
  staff_member_id: string;
  source: string;
}

export default function SchedulingPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [appointments, setAppointments] = useState<AppointmentWithStaff[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().split('T')[0]);
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [showNewForm, setShowNewForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newAppt, setNewAppt] = useState<NewAppointmentForm>({
    customer_name: '', customer_phone: '', customer_email: '',
    customer_city: '', customer_zip: '', service_type: '', notes: '',
    scheduled_date: new Date().toISOString().split('T')[0],
    time_window_start: '07:00', time_window_end: '11:00',
    staff_member_id: '', source: 'manual',
  });
  const [userData, setUserData] = useState({ name: 'User', email: '', avatarUrl: undefined as string | undefined });
  const [userRole, setUserRole] = useState<string>('owner');
  const [pendingCount, setPendingCount] = useState(0);
  const [availabilityPosts, setAvailabilityPosts] = useState<AvailabilityPost[]>([]);

  const supabase = createClient();
  const weekDates = getWeekDates(currentWeek);

  const loadAppointments = useCallback(async () => {
    const startDate = weekDates[0];
    const endDate = weekDates[6];
    const url = `/api/sites/${siteId}/scheduling/appointments?startDate=${startDate}&endDate=${endDate}`;
    const res = await fetch(url);
    const data = await res.json();
    setAppointments(Array.isArray(data) ? data : []);
    setPendingCount(Array.isArray(data) ? data.filter((a: AppointmentWithStaff) => a.status === 'pending').length : 0);
  }, [siteId, weekDates]);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      const activeOrgId = getActiveOrgIdClient();
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      const profile = (activeOrgId
        ? profiles?.find((p: { organization_id: string }) => p.organization_id === activeOrgId)
        : profiles?.[0]) || profiles?.[0] || null;

      setUserData({
        name: profile?.full_name || user?.user_metadata?.full_name || 'User',
        email: user?.email || '',
        avatarUrl: profile?.avatar_url,
      });
      const currentRole = profile?.role || 'user';
      setUserRole(currentRole);

      // Load staff
      const { data: assignments } = await supabase
        .from('staff_site_assignments')
        .select('staff_member_id')
        .eq('site_id', siteId);

      if (assignments && assignments.length > 0) {
        const staffIds = assignments.map(a => a.staff_member_id);
        const { data: staffData } = await supabase
          .from('staff_members')
          .select('*')
          .in('id', staffIds)
          .eq('is_active', true);
        const staffList = (staffData || []) as StaffMember[];
        setStaff(staffList);

        // For 'user' role (technicians): auto-filter to their own schedule
        if (currentRole === 'user' && profile?.id) {
          const myStaff = staffList.find(s => s.profile_id === profile.id);
          if (myStaff) {
            setStaffFilter(myStaff.id);
          }
        }
      }

      // Load recent availability posts
      const { data: postsData } = await supabase
        .from('availability_posts')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
        .limit(10);
      setAvailabilityPosts((postsData || []) as AvailabilityPost[]);

      setLoading(false);
    }

    loadData();
  }, [supabase, siteId]);

  useEffect(() => {
    if (!loading) {
      loadAppointments();
    }
  }, [loading, loadAppointments]);

  const handleStatusChange = async (appointmentId: string, newStatus: AppointmentStatus) => {
    const endpoint = newStatus === 'confirmed'
      ? `/api/sites/${siteId}/scheduling/appointments/${appointmentId}/approve`
      : newStatus === 'cancelled'
        ? `/api/sites/${siteId}/scheduling/appointments/${appointmentId}/decline`
        : `/api/sites/${siteId}/scheduling/appointments/${appointmentId}`;

    const method = (newStatus === 'confirmed' || newStatus === 'cancelled')
      ? 'POST'
      : 'PATCH';

    const body = method === 'PATCH' ? JSON.stringify({ status: newStatus }) : undefined;

    await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    loadAppointments();
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppt.customer_name || !newAppt.scheduled_date) return;

    setSubmitting(true);
    try {
      await fetch(`/api/sites/${siteId}/scheduling/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newAppt,
          staff_member_id: newAppt.staff_member_id || null,
          status: 'confirmed',
        }),
      });
      setShowNewForm(false);
      setNewAppt({
        customer_name: '', customer_phone: '', customer_email: '',
        customer_city: '', customer_zip: '', service_type: '', notes: '',
        scheduled_date: new Date().toISOString().split('T')[0],
        time_window_start: '07:00', time_window_end: '11:00',
        staff_member_id: '', source: 'manual',
      });
      loadAppointments();
    } catch (error) {
      console.error('Failed to create appointment:', error);
    }
    setSubmitting(false);
  };

  const prevWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() - 7);
    setCurrentWeek(d);
  };

  const nextWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() + 7);
    setCurrentWeek(d);
  };

  const today = new Date().toISOString().split('T')[0];

  const filteredAppointments = appointments.filter(a =>
    staffFilter === 'all' || a.staff_member_id === staffFilter
  );

  const getAppointmentsForDate = (date: string) =>
    filteredAppointments.filter(a => a.scheduled_date === date);

  if (loading) {
    return (
      <div className="flex flex-col">
        <Header title="Scheduling" user={userData} />
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-1/3 rounded bg-gray-200" />
            <div className="h-64 rounded bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Header title={userRole === 'user' ? 'My Schedule' : 'Scheduling'} user={userData} />

      <div className="space-y-6 p-6">
        {/* Top Nav */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={`/dashboard/sites/${siteId}`}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Site Dashboard
          </Link>

          <div className="flex items-center gap-2">
            {pendingCount > 0 && userRole !== 'user' && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/sites/${siteId}/scheduling/pending`}>
                  <AlertCircle className="mr-1.5 h-4 w-4 text-yellow-500" />
                  {pendingCount} Pending
                </Link>
              </Button>
            )}
            {userRole !== 'user' && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/sites/${siteId}/scheduling/settings`}>
                  <Settings className="mr-1.5 h-4 w-4" />
                  Settings
                </Link>
              </Button>
            )}
            {userRole !== 'user' && (
              <Button size="sm" onClick={() => setShowNewForm(true)}>
                <CalendarPlus className="mr-1.5 h-4 w-4" />
                New Appointment
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Today</p>
              <p className="text-2xl font-bold">
                {getAppointmentsForDate(today).filter(a => a.status !== 'cancelled').length}
              </p>
              <p className="text-xs text-gray-400">appointments</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">This Week</p>
              <p className="text-2xl font-bold">
                {filteredAppointments.filter(a => a.status !== 'cancelled').length}
              </p>
              <p className="text-xs text-gray-400">appointments</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-yellow-600">Pending Approval</p>
              <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
              <p className="text-xs text-gray-400">awaiting review</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Staff</p>
              <p className="text-2xl font-bold">{staff.length}</p>
              <p className="text-xs text-gray-400">active members</p>
            </CardContent>
          </Card>
        </div>

        {/* Week Navigation + Staff Filter */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={prevWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(new Date())}
            >
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={nextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="ml-2 text-sm font-medium text-gray-700">
              {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {userRole !== 'user' && (
              <>
                <Users className="h-4 w-4 text-gray-400" />
                <select
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  value={staffFilter}
                  onChange={e => setStaffFilter(e.target.value)}
                >
                  <option value="all">All Staff</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
              </>
            )}
          </div>
        </div>

        {/* Week Grid */}
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map(date => {
            const dayAppointments = getAppointmentsForDate(date);
            const isToday = date === today;
            const [, month, day] = date.split('-').map(Number);
            const dayOfWeek = new Date(parseInt(date.split('-')[0]), month - 1, day).toLocaleDateString('en-US', { weekday: 'short' });

            return (
              <div
                key={date}
                className={`rounded-lg border p-2 min-h-[120px] cursor-pointer transition-colors ${
                  isToday ? 'border-[#00ef99] bg-[#00ef99]/5' : 'border-gray-200 hover:border-gray-300'
                } ${selectedDay === date ? 'ring-2 ring-[#00ef99]' : ''}`}
                onClick={() => { setSelectedDay(date); setViewMode('day'); }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-500">{dayOfWeek}</span>
                  <span className={`text-sm font-bold ${isToday ? 'text-[#00ef99]' : 'text-gray-700'}`}>
                    {day}
                  </span>
                </div>
                {dayAppointments.length === 0 ? (
                  <p className="text-xs text-gray-300 mt-2">No appointments</p>
                ) : (
                  <div className="space-y-1">
                    {dayAppointments.slice(0, 3).map(appt => (
                      <div
                        key={appt.id}
                        className={`rounded px-1.5 py-0.5 text-xs truncate ${STATUS_COLORS[appt.status]}`}
                      >
                        {appt.time_window_start ? formatTime(appt.time_window_start) : ''}{' '}
                        {appt.customer_name}
                      </div>
                    ))}
                    {dayAppointments.length > 3 && (
                      <p className="text-xs text-gray-400">+{dayAppointments.length - 3} more</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Day Detail View */}
        {viewMode === 'day' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{formatDate(selectedDay)}</h3>
                <Button variant="outline" size="sm" onClick={() => setViewMode('week')}>
                  Back to Week
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {getAppointmentsForDate(selectedDay).length === 0 ? (
                <div className="text-center py-8">
                  <CalendarDays className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                  <p className="text-gray-500">No appointments for this day</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getAppointmentsForDate(selectedDay).map(appt => (
                    <div key={appt.id} className="flex items-start gap-4 rounded-lg border p-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">{appt.customer_name}</span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[appt.status]}`}>
                            {STATUS_LABELS[appt.status]}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                          {(appt.time_window_start || appt.scheduled_time) && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {appt.scheduled_time
                                ? formatTime(appt.scheduled_time)
                                : `${formatTime(appt.time_window_start)} - ${formatTime(appt.time_window_end)}`}
                            </span>
                          )}
                          {appt.customer_phone && (
                            <a href={`tel:${appt.customer_phone}`} className="flex items-center gap-1 hover:text-gray-700">
                              <Phone className="h-3.5 w-3.5" />
                              {appt.customer_phone}
                            </a>
                          )}
                          {appt.customer_email && (
                            <a href={`mailto:${appt.customer_email}`} className="flex items-center gap-1 hover:text-gray-700">
                              <Mail className="h-3.5 w-3.5" />
                              {appt.customer_email}
                            </a>
                          )}
                        </div>
                        {appt.service_type && (
                          <p className="text-sm text-gray-600">Service: {appt.service_type}</p>
                        )}
                        {appt.staff_member && (
                          <p className="text-sm text-gray-500">Assigned: {appt.staff_member.full_name}</p>
                        )}
                        {appt.notes && (
                          <p className="text-sm text-gray-500">Notes: {appt.notes}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          Source: {appt.source === 'online_booking' ? 'Online' : appt.source === 'phone' ? 'Phone' : 'Manual'}
                          {appt.customer_city && ` | ${appt.customer_city}`}
                          {appt.customer_zip && `, ${appt.customer_zip}`}
                        </p>
                      </div>

                      <div className="flex flex-col gap-1">
                        {appt.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleStatusChange(appt.id, 'confirmed')}
                            >
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleStatusChange(appt.id, 'cancelled')}
                            >
                              <XCircle className="mr-1 h-3.5 w-3.5" />
                              Decline
                            </Button>
                          </>
                        )}
                        {appt.status === 'confirmed' && (
                          <select
                            className="rounded border border-gray-300 px-2 py-1 text-xs"
                            value={appt.status}
                            onChange={e => handleStatusChange(appt.id, e.target.value as AppointmentStatus)}
                          >
                            <option value="confirmed">Confirmed</option>
                            <option value="completed">Completed</option>
                            <option value="no_show">No Show</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* New Appointment Form */}
        {showNewForm && (
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">New Appointment</h3>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateAppointment} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
                    <input
                      type="text"
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      value={newAppt.customer_name}
                      onChange={e => setNewAppt(prev => ({ ...prev, customer_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      value={newAppt.customer_phone}
                      onChange={e => setNewAppt(prev => ({ ...prev, customer_phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      value={newAppt.customer_email}
                      onChange={e => setNewAppt(prev => ({ ...prev, customer_email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      value={newAppt.service_type}
                      onChange={e => setNewAppt(prev => ({ ...prev, service_type: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                    <input
                      type="date"
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      value={newAppt.scheduled_date}
                      onChange={e => setNewAppt(prev => ({ ...prev, scheduled_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      value={newAppt.staff_member_id}
                      onChange={e => setNewAppt(prev => ({ ...prev, staff_member_id: e.target.value }))}
                    >
                      <option value="">Unassigned</option>
                      {staff.map(s => (
                        <option key={s.id} value={s.id}>{s.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time Window Start</label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      value={newAppt.time_window_start}
                      onChange={e => setNewAppt(prev => ({ ...prev, time_window_start: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time Window End</label>
                    <input
                      type="time"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      value={newAppt.time_window_end}
                      onChange={e => setNewAppt(prev => ({ ...prev, time_window_end: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      value={newAppt.customer_city}
                      onChange={e => setNewAppt(prev => ({ ...prev, customer_city: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      value={newAppt.source}
                      onChange={e => setNewAppt(prev => ({ ...prev, source: e.target.value }))}
                    >
                      <option value="manual">Manual Entry</option>
                      <option value="phone">Phone Call</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    rows={2}
                    value={newAppt.notes}
                    onChange={e => setNewAppt(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowNewForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarPlus className="mr-2 h-4 w-4" />}
                    Create Appointment
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Availability Posts Log */}
        {availabilityPosts.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold">Recent Availability Posts</h3>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {availabilityPosts.map(post => (
                  <div key={post.id} className="flex items-start gap-3 rounded-lg border p-3">
                    <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                      post.status === 'published' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 line-clamp-2">{post.post_content}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                        <span>{new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${
                          post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {post.status}
                        </span>
                        <span>{post.spots_available} spot{post.spots_available !== 1 ? 's' : ''}</span>
                        <span className="capitalize">{post.platform.replace('_', ' ')}</span>
                      </div>
                      {post.error_message && (
                        <p className="mt-1 text-xs text-red-500">{post.error_message}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

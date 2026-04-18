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
  ArrowLeft, Save, Loader2, Clock, CalendarDays, Bell,
  Megaphone, Users, Plus, Trash2, MapPin,
} from 'lucide-react';
import type { SchedulingConfig, StaffMember, StaffSchedule, DateOverride } from '@/types/database';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DEFAULT_WINDOWS = [
  { start_time: '07:00', end_time: '11:00', capacity: 3 },
  { start_time: '11:00', end_time: '14:00', capacity: 3 },
  { start_time: '14:00', end_time: '18:00', capacity: 3 },
];

interface StaffScheduleEntry {
  day_of_week: number;
  start_time: string;
  end_time: string;
  capacity: number;
  is_active: boolean;
}

export default function SchedulingSettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [config, setConfig] = useState<SchedulingConfig | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [staffSchedules, setStaffSchedules] = useState<StaffScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [dateOverrides, setDateOverrides] = useState<DateOverride[]>([]);
  const [newOverrideDate, setNewOverrideDate] = useState('');
  const [newOverrideReason, setNewOverrideReason] = useState('');
  const [userData, setUserData] = useState({ name: 'User', email: '', avatarUrl: undefined as string | undefined });

  const supabase = createClient();

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

      // Load scheduling config
      const configRes = await fetch(`/api/sites/${siteId}/scheduling/config`);
      const configData = await configRes.json();
      setConfig(configData);

      // Load date overrides
      const overridesRes = await fetch(`/api/sites/${siteId}/scheduling/date-overrides`);
      const overridesData = await overridesRes.json();
      setDateOverrides(Array.isArray(overridesData) ? overridesData : []);

      // Load staff members assigned to this site
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
          .eq('is_active', true)
          .order('display_order');

        setStaff((staffData || []) as StaffMember[]);
        if (staffData && staffData.length > 0) {
          setSelectedStaffId(staffData[0].id);
        }
      }

      setLoading(false);
    }

    loadData();
  }, [supabase, siteId]);

  // Load staff schedule when selected staff changes
  const loadStaffSchedule = useCallback(async (staffId: string) => {
    if (!staffId) return;
    const res = await fetch(`/api/sites/${siteId}/scheduling/staff/${staffId}/schedule`);
    const data = await res.json();
    setStaffSchedules(Array.isArray(data) ? data : []);
  }, [siteId]);

  useEffect(() => {
    if (selectedStaffId) {
      loadStaffSchedule(selectedStaffId);
    }
  }, [selectedStaffId, loadStaffSchedule]);

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/scheduling/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      setConfig(data);
    } catch (error) {
      console.error('Failed to save config:', error);
    }
    setSaving(false);
  };

  const saveStaffSchedule = async () => {
    if (!selectedStaffId) return;
    setSavingSchedule(true);
    try {
      await fetch(`/api/sites/${siteId}/scheduling/staff/${selectedStaffId}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedules: staffSchedules }),
      });
    } catch (error) {
      console.error('Failed to save schedule:', error);
    }
    setSavingSchedule(false);
  };

  const addDateOverride = async () => {
    if (!newOverrideDate) return;
    try {
      const res = await fetch(`/api/sites/${siteId}/scheduling/date-overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          override_date: newOverrideDate,
          is_blocked: true,
          reason: newOverrideReason || null,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setDateOverrides(prev => [...prev.filter(o => o.override_date !== newOverrideDate), data].sort((a, b) => a.override_date.localeCompare(b.override_date)));
        setNewOverrideDate('');
        setNewOverrideReason('');
      }
    } catch (error) {
      console.error('Failed to add date override:', error);
    }
  };

  const removeDateOverride = async (overrideId: string) => {
    try {
      await fetch(`/api/sites/${siteId}/scheduling/date-overrides?overrideId=${overrideId}`, {
        method: 'DELETE',
      });
      setDateOverrides(prev => prev.filter(o => o.id !== overrideId));
    } catch (error) {
      console.error('Failed to remove date override:', error);
    }
  };

  const addDefaultWindows = (dayOfWeek: number) => {
    const newEntries = DEFAULT_WINDOWS.map(w => ({
      day_of_week: dayOfWeek,
      start_time: w.start_time,
      end_time: w.end_time,
      capacity: w.capacity,
      is_active: true,
    }));
    setStaffSchedules(prev => [...prev, ...newEntries]);
  };

  const removeWindow = (dayOfWeek: number, index: number) => {
    const dayWindows = staffSchedules.filter(s => s.day_of_week === dayOfWeek);
    const targetWindow = dayWindows[index];
    setStaffSchedules(prev =>
      prev.filter(s =>
        !(s.day_of_week === targetWindow.day_of_week &&
          s.start_time === targetWindow.start_time &&
          s.end_time === targetWindow.end_time)
      )
    );
  };

  const updateWindow = (dayOfWeek: number, index: number, field: string, value: string | number) => {
    const dayWindows = staffSchedules.filter(s => s.day_of_week === dayOfWeek);
    const target = dayWindows[index];
    setStaffSchedules(prev =>
      prev.map(s =>
        (s.day_of_week === target.day_of_week &&
         s.start_time === target.start_time &&
         s.end_time === target.end_time)
          ? { ...s, [field]: value }
          : s
      )
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col">
        <Header title="Scheduling Settings" user={userData} />
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-1/3 rounded bg-gray-200" />
            <div className="h-32 rounded bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Header title="Scheduling Settings" user={userData} />

      <div className="space-y-6 p-6">
        <Link
          href={`/dashboard/sites/${siteId}/scheduling`}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Calendar
        </Link>

        {/* General Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold">General Settings</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Enable Scheduling</p>
                <p className="text-sm text-gray-500">Allow customers to book appointments online</p>
              </div>
              <button
                onClick={() => setConfig(prev => prev ? { ...prev, is_active: !prev.is_active } : prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config?.is_active ? 'bg-[#00ef99]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config?.is_active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Show Availability Badge */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Show Availability Badge</p>
                <p className="text-sm text-gray-500">Display &ldquo;X spots available today&rdquo; on your website</p>
              </div>
              <button
                onClick={() => setConfig(prev => prev ? { ...prev, show_availability_badge: !prev.show_availability_badge } : prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config?.show_availability_badge !== false ? 'bg-[#00ef99]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config?.show_availability_badge !== false ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Scheduling Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scheduling Mode</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={config?.scheduling_mode || 'time_windows'}
                onChange={e => setConfig(prev => prev ? { ...prev, scheduling_mode: e.target.value as 'time_windows' | 'time_slots' } : prev)}
              >
                <option value="time_windows">Time Windows (e.g. 7am-11am, 3 slots per window)</option>
                <option value="time_slots">Exact Time Slots (e.g. 8:00am, 9:00am, 10:00am)</option>
              </select>
            </div>

            {/* Booking Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Booking Mode</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={config?.booking_mode || 'approval'}
                onChange={e => setConfig(prev => prev ? { ...prev, booking_mode: e.target.value as 'instant' | 'approval' } : prev)}
              >
                <option value="approval">Require Approval (owner approves each booking)</option>
                <option value="instant">Instant Confirm (bookings auto-confirm)</option>
              </select>
            </div>

            {/* CTA Style */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Button Style</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={config?.cta_style || 'booking'}
                onChange={e => setConfig(prev => prev ? { ...prev, cta_style: e.target.value as 'booking' | 'estimate' } : prev)}
              >
                <option value="booking">Book Now / Schedule Service (service businesses)</option>
                <option value="estimate">Get Free Estimate / Request Quote (project businesses)</option>
              </select>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={config?.timezone || 'America/New_York'}
                onChange={e => setConfig(prev => prev ? { ...prev, timezone: e.target.value } : prev)}
              >
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="America/Anchorage">Alaska Time</option>
                <option value="Pacific/Honolulu">Hawaii Time</option>
              </select>
            </div>

            {/* Advance Booking Days */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Advance Booking (days)</label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={config?.advance_booking_days || 14}
                  min={1}
                  max={90}
                  onChange={e => setConfig(prev => prev ? { ...prev, advance_booking_days: parseInt(e.target.value) || 14 } : prev)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Buffer Between Jobs (min)</label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={config?.booking_buffer_minutes || 30}
                  min={0}
                  max={120}
                  step={15}
                  onChange={e => setConfig(prev => prev ? { ...prev, booking_buffer_minutes: parseInt(e.target.value) || 30 } : prev)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold">Notifications</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notification Phone (SMS)</label>
              <input
                type="tel"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="+1 (555) 123-4567"
                value={config?.notification_phone || ''}
                onChange={e => setConfig(prev => prev ? { ...prev, notification_phone: e.target.value } : prev)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notification Email</label>
              <input
                type="email"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="owner@business.com"
                value={config?.notification_email || ''}
                onChange={e => setConfig(prev => prev ? { ...prev, notification_email: e.target.value } : prev)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Booking Confirmation Message</label>
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                rows={3}
                placeholder="Thank you for booking with us! We'll confirm your appointment shortly."
                value={config?.confirmation_message || ''}
                onChange={e => setConfig(prev => prev ? { ...prev, confirmation_message: e.target.value } : prev)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Auto-Publish */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold">Availability Publishing</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Auto-Publish to Google Business Profile</p>
                <p className="text-sm text-gray-500">Automatically post available spots to GBP</p>
              </div>
              <button
                onClick={() => setConfig(prev => prev ? { ...prev, auto_publish_availability: !prev.auto_publish_availability } : prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config?.auto_publish_availability ? 'bg-[#00ef99]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config?.auto_publish_availability ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {config?.auto_publish_availability && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Posting Times</label>
                  <p className="text-xs text-gray-500 mb-2">Posts go out at these times with current availability counts</p>
                  <div className="flex flex-wrap gap-2">
                    {(config.publish_times || ['07:30', '11:00', '14:00']).map((time, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <input
                          type="time"
                          className="rounded border border-gray-300 px-2 py-1 text-sm"
                          value={time}
                          onChange={e => {
                            const newTimes = [...(config.publish_times || [])];
                            newTimes[i] = e.target.value;
                            setConfig(prev => prev ? { ...prev, publish_times: newTimes } : prev);
                          }}
                        />
                        <button
                          onClick={() => {
                            const newTimes = (config.publish_times || []).filter((_, idx) => idx !== i);
                            setConfig(prev => prev ? { ...prev, publish_times: newTimes } : prev);
                          }}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const newTimes = [...(config.publish_times || []), '12:00'];
                        setConfig(prev => prev ? { ...prev, publish_times: newTimes } : prev);
                      }}
                      className="flex items-center gap-1 rounded border border-dashed border-gray-300 px-2 py-1 text-sm text-gray-500 hover:border-gray-400"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Time
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Posting Days</label>
                  <div className="flex flex-wrap gap-2">
                    {DAY_SHORT.map((day, i) => {
                      const dayKey = day.toLowerCase();
                      const isSelected = (config.publish_days || []).includes(dayKey);
                      return (
                        <button
                          key={day}
                          onClick={() => {
                            const newDays = isSelected
                              ? (config.publish_days || []).filter(d => d !== dayKey)
                              : [...(config.publish_days || []), dayKey];
                            setConfig(prev => prev ? { ...prev, publish_days: newDays } : prev);
                          }}
                          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                            isSelected
                              ? 'bg-[#00ef99] text-gray-900'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Date Overrides (Blocked Dates) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold">Blocked Dates</h2>
            </div>
            <p className="text-sm text-gray-500">Block specific dates (holidays, closures, vacations) from accepting bookings</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add new override */}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={newOverrideDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setNewOverrideDate(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="e.g. Holiday, Vacation"
                  value={newOverrideReason}
                  onChange={e => setNewOverrideReason(e.target.value)}
                />
              </div>
              <Button onClick={addDateOverride} disabled={!newOverrideDate} size="sm">
                <Plus className="mr-1 h-4 w-4" /> Block Date
              </Button>
            </div>

            {/* List existing overrides */}
            {dateOverrides.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No blocked dates. All scheduled days are open for booking.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {dateOverrides.map(override => {
                  const d = new Date(override.override_date + 'T12:00:00');
                  const formatted = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                  const isPast = override.override_date < new Date().toISOString().split('T')[0];
                  return (
                    <div key={override.id} className={`flex items-center justify-between py-2 ${isPast ? 'opacity-50' : ''}`}>
                      <div>
                        <p className="text-sm font-medium">{formatted}</p>
                        {override.reason && <p className="text-xs text-gray-500">{override.reason}</p>}
                      </div>
                      <button
                        onClick={() => removeDateOverride(override.id)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Config Button */}
        <div className="flex justify-end">
          <Button onClick={saveConfig} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Settings
          </Button>
        </div>

        {/* Staff Availability */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold">Staff Availability</h2>
              </div>
              {staff.length > 0 && (
                <select
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  value={selectedStaffId}
                  onChange={e => setSelectedStaffId(e.target.value)}
                >
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {staff.length === 0 ? (
              <div className="text-center py-8">
                <Users className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                <p className="text-gray-500">No staff members assigned to this site.</p>
                <p className="text-sm text-gray-400 mt-1">
                  Add staff in{' '}
                  <Link href="/dashboard/team" className="text-[#00ef99] hover:underline">
                    Team Management
                  </Link>
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {DAYS.map((dayName, dayIndex) => {
                  const dayWindows = staffSchedules.filter(s => s.day_of_week === dayIndex);
                  return (
                    <div key={dayIndex} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm">{dayName}</h4>
                        {dayWindows.length === 0 && (
                          <button
                            onClick={() => addDefaultWindows(dayIndex)}
                            className="flex items-center gap-1 text-xs text-[#00ef99] hover:underline"
                          >
                            <Plus className="h-3 w-3" /> Add Windows
                          </button>
                        )}
                      </div>
                      {dayWindows.length === 0 ? (
                        <p className="text-xs text-gray-400">Not available</p>
                      ) : (
                        <div className="space-y-2">
                          {dayWindows.map((window, wIdx) => (
                            <div key={wIdx} className="flex items-center gap-2 text-sm">
                              <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                              <input
                                type="time"
                                className="rounded border border-gray-300 px-2 py-1 text-sm"
                                value={window.start_time.substring(0, 5)}
                                onChange={e => updateWindow(dayIndex, wIdx, 'start_time', e.target.value)}
                              />
                              <span className="text-gray-400">to</span>
                              <input
                                type="time"
                                className="rounded border border-gray-300 px-2 py-1 text-sm"
                                value={window.end_time.substring(0, 5)}
                                onChange={e => updateWindow(dayIndex, wIdx, 'end_time', e.target.value)}
                              />
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                                <input
                                  type="number"
                                  className="w-14 rounded border border-gray-300 px-2 py-1 text-sm text-center"
                                  value={window.capacity}
                                  min={1}
                                  max={20}
                                  onChange={e => updateWindow(dayIndex, wIdx, 'capacity', parseInt(e.target.value) || 1)}
                                />
                                <span className="text-xs text-gray-400">slots</span>
                              </div>
                              <button
                                onClick={() => removeWindow(dayIndex, wIdx)}
                                className="text-gray-400 hover:text-red-500 ml-auto"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              setStaffSchedules(prev => [...prev, {
                                day_of_week: dayIndex,
                                start_time: '09:00',
                                end_time: '12:00',
                                capacity: 1,
                                is_active: true,
                              }]);
                            }}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                          >
                            <Plus className="h-3 w-3" /> Add window
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="flex justify-end pt-2">
                  <Button onClick={saveStaffSchedule} disabled={savingSchedule} size="sm">
                    {savingSchedule ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Schedule for {staff.find(s => s.id === selectedStaffId)?.full_name || 'Staff'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CalendarDays, Clock, ChevronLeft, ChevronRight, User,
  Plus, Trash2, Loader2, ShieldAlert,
} from 'lucide-react';

interface StaffAppointment {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  service_type: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  time_window_start: string | null;
  time_window_end: string | null;
  status: string;
  notes: string | null;
}

interface StaffBlock {
  id: string;
  block_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

interface StaffInfo {
  id: string;
  full_name: string;
  site_id: string;
  site_name: string;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
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
  start.setDate(start.getDate() - start.getDay());
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export default function StaffCalendarPage() {
  const params = useParams();
  const staffToken = params.staffToken as string;

  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [appointments, setAppointments] = useState<StaffAppointment[]>([]);
  const [blocks, setBlocks] = useState<StaffBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [savingBlock, setSavingBlock] = useState(false);
  const [newBlock, setNewBlock] = useState({
    block_date: new Date().toISOString().split('T')[0],
    start_time: '',
    end_time: '',
    reason: '',
    all_day: true,
  });

  const weekDates = getWeekDates(currentWeek);
  const today = new Date().toISOString().split('T')[0];

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/schedule/${staffToken}?startDate=${weekDates[0]}&endDate=${weekDates[6]}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Invalid calendar link. Please contact your manager for a new link.');
        } else {
          setError('Failed to load schedule.');
        }
        setLoading(false);
        return;
      }
      const data = await res.json();
      setStaffInfo(data.staff);
      setAppointments(data.appointments || []);
      setBlocks(data.blocks || []);
      setLoading(false);
    } catch {
      setError('Failed to load schedule.');
      setLoading(false);
    }
  }, [staffToken, weekDates]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffInfo) return;

    setSavingBlock(true);
    try {
      await fetch(`/api/schedule/${staffToken}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block_date: newBlock.block_date,
          start_time: newBlock.all_day ? null : newBlock.start_time || null,
          end_time: newBlock.all_day ? null : newBlock.end_time || null,
          reason: newBlock.reason || null,
        }),
      });
      setShowBlockForm(false);
      setNewBlock({ block_date: today, start_time: '', end_time: '', reason: '', all_day: true });
      loadData();
    } catch (err) {
      console.error('Failed to add block:', err);
    }
    setSavingBlock(false);
  };

  const handleDeleteBlock = async (blockId: string) => {
    try {
      await fetch(`/api/schedule/${staffToken}/blocks?blockId=${blockId}`, {
        method: 'DELETE',
      });
      loadData();
    } catch (err) {
      console.error('Failed to delete block:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
          <p className="mt-2 text-gray-500">Loading schedule...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center py-12">
            <ShieldAlert className="h-12 w-12 text-red-400 mb-4" />
            <h2 className="text-lg font-semibold text-gray-900">Access Error</h2>
            <p className="mt-2 text-sm text-gray-500 text-center">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <User className="h-5 w-5 text-gray-400" />
            <h1 className="text-xl font-bold text-gray-900">{staffInfo?.full_name}</h1>
          </div>
          <p className="text-sm text-gray-500">{staffInfo?.site_name} - My Schedule</p>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              const d = new Date(currentWeek);
              d.setDate(d.getDate() - 7);
              setCurrentWeek(d);
            }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentWeek(new Date())}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              const d = new Date(currentWeek);
              d.setDate(d.getDate() + 7);
              setCurrentWeek(d);
            }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowBlockForm(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Block Time
          </Button>
        </div>

        {/* Week View */}
        <div className="space-y-3">
          {weekDates.map(date => {
            const dayAppts = appointments.filter(a => a.scheduled_date === date && a.status !== 'cancelled');
            const dayBlocks = blocks.filter(b => b.block_date === date);
            const isToday = date === today;
            const [y, mo, da] = date.split('-').map(Number);
            const dayName = new Date(y, mo - 1, da).toLocaleDateString('en-US', { weekday: 'short' });

            return (
              <Card key={date} className={isToday ? 'border-[#00ef99]' : ''}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-gray-400" />
                    <span className={`font-medium text-sm ${isToday ? 'text-[#00ef99]' : 'text-gray-700'}`}>
                      {dayName}, {formatDate(date).split(',').slice(0, 2).join(',')}
                    </span>
                    {dayAppts.length > 0 && (
                      <span className="text-xs text-gray-400">({dayAppts.length} appointment{dayAppts.length !== 1 ? 's' : ''})</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="py-2 px-4">
                  {dayBlocks.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {dayBlocks.map(block => (
                        <div key={block.id} className="flex items-center justify-between rounded bg-red-50 px-3 py-1.5 text-sm">
                          <span className="text-red-700">
                            {block.start_time
                              ? `Blocked: ${formatTime(block.start_time)} - ${formatTime(block.end_time)}`
                              : 'Blocked: All Day'}
                            {block.reason && ` (${block.reason})`}
                          </span>
                          <button onClick={() => handleDeleteBlock(block.id)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {dayAppts.length === 0 ? (
                    <p className="text-sm text-gray-400 py-1">No appointments</p>
                  ) : (
                    <div className="space-y-2">
                      {dayAppts.map(appt => (
                        <div key={appt.id} className="flex items-center gap-3 rounded bg-gray-50 px-3 py-2 text-sm">
                          <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span className="text-gray-600">
                            {appt.scheduled_time
                              ? formatTime(appt.scheduled_time)
                              : appt.time_window_start
                                ? `${formatTime(appt.time_window_start)} - ${formatTime(appt.time_window_end)}`
                                : 'TBD'}
                          </span>
                          <span className="font-medium text-gray-900">{appt.customer_name}</span>
                          {appt.service_type && <span className="text-gray-500">- {appt.service_type}</span>}
                          {appt.customer_phone && (
                            <a href={`tel:${appt.customer_phone}`} className="ml-auto text-blue-600 hover:underline">
                              {appt.customer_phone}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Block Time Form */}
        {showBlockForm && (
          <Card className="mt-4">
            <CardHeader>
              <h3 className="text-lg font-semibold">Block Time Off</h3>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddBlock} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    value={newBlock.block_date}
                    onChange={e => setNewBlock(prev => ({ ...prev, block_date: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="allDay"
                    checked={newBlock.all_day}
                    onChange={e => setNewBlock(prev => ({ ...prev, all_day: e.target.checked }))}
                  />
                  <label htmlFor="allDay" className="text-sm text-gray-700">All Day</label>
                </div>
                {!newBlock.all_day && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                      <input
                        type="time"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        value={newBlock.start_time}
                        onChange={e => setNewBlock(prev => ({ ...prev, start_time: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                      <input
                        type="time"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        value={newBlock.end_time}
                        onChange={e => setNewBlock(prev => ({ ...prev, end_time: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="e.g., Doctor's appointment"
                    value={newBlock.reason}
                    onChange={e => setNewBlock(prev => ({ ...prev, reason: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowBlockForm(false)}>Cancel</Button>
                  <Button type="submit" disabled={savingBlock}>
                    {savingBlock && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Block Time
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeft, CalendarDays, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApplianceIcon } from './appliance-icons';
import type { PublicRenderCategory } from '@/lib/sites/public-render-model';
import {
  resolveNicheForm,
  allFields,
  SCHEDULE_STEP,
  type NicheField,
  type NicheStep,
} from '@/lib/forms/niche-forms';

interface SlotInfo {
  startTime: string;
  endTime: string;
  spotsAvailable: number;
  type: 'slot' | 'window';
}

interface DayAvailability {
  date: string;
  spotsRemaining: number;
  isBlocked: boolean;
  slots: SlotInfo[];
}

interface AddressPrediction {
  placeId: string;
  description: string;
}

interface UnifiedLeadFormProps {
  siteId: string;
  accentColor?: string;
  categories?: PublicRenderCategory[];
  schedulingActive?: boolean;
  ctaStyle?: 'booking' | 'estimate';
  variant?: 'hero' | 'section';
  /** Optional niche override; when omitted the niche is inferred from `categories`. */
  coreIndustry?: string;
}

// A resolved step to render: a fields step, or one of the two scheduling steps.
type RenderStep = { kind: 'fields'; step: NicheStep } | { kind: 'date' } | { kind: 'time' };

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatDateDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

export function UnifiedLeadForm({
  siteId,
  accentColor = '#00ef99',
  categories,
  schedulingActive = false,
  ctaStyle = 'booking',
  variant = 'hero',
  coreIndustry,
}: UnifiedLeadFormProps) {
  const isBookingMode = schedulingActive && ctaStyle === 'booking';
  const config = useMemo(() => resolveNicheForm(categories, coreIndustry), [categories, coreIndustry]);

  // Expand the config's ordered steps for this mode: SCHEDULE_STEP → Date + Time
  // in booking mode, dropped otherwise.
  const steps: RenderStep[] = useMemo(() => {
    const out: RenderStep[] = [];
    for (const item of config.steps) {
      if (item === SCHEDULE_STEP) {
        if (isBookingMode) { out.push({ kind: 'date' }); out.push({ kind: 'time' }); }
      } else {
        out.push({ kind: 'fields', step: item });
      }
    }
    return out;
  }, [config, isBookingMode]);
  const totalSteps = steps.length;

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [bookingResult, setBookingResult] = useState<{ status: string; message: string } | null>(null);

  // Dynamic form data (keyed by field name). Reserved keys: name/phone/email/address.
  const [formData, setFormData] = useState<Record<string, string>>({});
  const setField = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    setStepError(null);
  };

  // Invisible spam protection: honeypot + minimum time-on-form.
  const [honeypot, setHoneypot] = useState('');
  const mountedAt = useRef(Date.now());

  // Address autocomplete state
  const [addressQuery, setAddressQuery] = useState('');
  const [predictions, setPredictions] = useState<AddressPrediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const addressRef = useRef<HTMLDivElement>(null);
  // Structured location auto-extracted from the selected address (ZIP/city/coords).
  // Merged into lead metadata so we capture ZIP without a separate field.
  const [addressMeta, setAddressMeta] = useState<{ zip?: string; city?: string; lat?: number | null; lng?: number | null }>({});

  // Scheduling state (booking mode only)
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<SlotInfo | null>(null);

  const current = steps[step - 1];
  const isLastStep = step === totalSteps;

  // Address autocomplete - debounced fetch
  useEffect(() => {
    if (addressQuery.length < 3) {
      setPredictions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/autocomplete?query=${encodeURIComponent(addressQuery)}`);
        const data = await res.json();
        setPredictions(data.predictions || []);
        setShowPredictions(true);
      } catch {
        setPredictions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [addressQuery]);

  // Close predictions on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (addressRef.current && !addressRef.current.contains(e.target as Node)) {
        setShowPredictions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load availability when entering the Date step (booking mode)
  useEffect(() => {
    if (!isBookingMode || current?.kind !== 'date') return;

    async function loadAvailability() {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const params = new URLSearchParams({ siteId, date: today, days: '14' });
      try {
        const res = await fetch(`/api/public/availability?${params}`);
        const data = await res.json();
        setAvailability(data.active && data.range ? data.range : []);
      } catch {
        setAvailability([]);
      }
      setLoading(false);
    }
    loadAvailability();
  }, [step, siteId, isBookingMode, current?.kind]);

  const handleSelectPrediction = async (prediction: AddressPrediction) => {
    setField('address', prediction.description);
    setAddressQuery(prediction.description);
    setShowPredictions(false);
    setPredictions([]);
    // Pull ZIP / city / coords from the chosen place (non-fatal if it fails —
    // the address string is still captured).
    try {
      const res = await fetch(`/api/places/details?placeId=${encodeURIComponent(prediction.placeId)}`);
      if (res.ok) {
        const d = await res.json();
        setAddressMeta({ zip: d.zip || undefined, city: d.city || undefined, lat: d.lat ?? null, lng: d.lng ?? null });
      }
    } catch {
      /* ignore — free-typed address is still submitted */
    }
  };

  // Map dynamic field values into the lead payload shape.
  const buildLeadFields = () => {
    let service_type: string | null = null;
    const messageParts: string[] = [];
    const metadata: Record<string, unknown> = {};
    for (const f of allFields(config)) {
      if (f.reserved) continue;
      const v = (formData[f.name] ?? '').trim();
      if (!v) continue;
      if (f.mapsTo === 'service_type') service_type = v;
      else if (f.mapsTo === 'message') messageParts.push(v);
      else metadata[f.name] = v;
    }
    // ZIP + city auto-derived from the selected address (no separate field).
    if (addressMeta.zip) metadata.zip = addressMeta.zip;
    if (addressMeta.city) metadata.city = addressMeta.city;
    return {
      name: (formData.name ?? '').trim(),
      phone: (formData.phone ?? '').trim(),
      email: formData.email?.trim() || null,
      address: formData.address?.trim() || null,
      service_type,
      message: messageParts.join(' — ') || null,
      metadata,
    };
  };

  // Silently accept obvious bots (honeypot filled or submitted implausibly fast)
  // without hitting the API.
  const looksLikeBot = () => honeypot.trim() !== '' || Date.now() - mountedAt.current < 2000;

  const handleSubmitLead = async () => {
    if (looksLikeBot()) { setSubmitted(true); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const fields = buildLeadFields();
      const res = await fetch(`/api/sites/${siteId}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fields,
          source_page: typeof window !== 'undefined' ? window.location.pathname : '/',
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error('[UnifiedLeadForm] Lead submission failed:', res.status, body);
        throw new Error(`Submission failed (${res.status})`);
      }
      setSubmitted(true);
    } catch (err) {
      console.error('[UnifiedLeadForm] Lead error:', err);
      setSubmitError('We couldn\'t submit your request. Please try again or call us directly.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitBooking = async () => {
    if (looksLikeBot()) { setSubmitted(true); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const fields = buildLeadFields();
      const res = await fetch('/api/public/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          customer_name: fields.name,
          customer_email: fields.email,
          customer_phone: fields.phone,
          service_type: fields.service_type,
          notes: fields.message,
          address: fields.address,
          metadata: fields.metadata,
          scheduled_date: selectedDate,
          scheduled_time: selectedSlot?.type === 'slot' ? selectedSlot.startTime : null,
          time_window_start: selectedSlot?.startTime || null,
          time_window_end: selectedSlot?.endTime || null,
          source_page: typeof window !== 'undefined' ? window.location.pathname : '/',
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error('[UnifiedLeadForm] Booking submission failed:', res.status, body);
        throw new Error(`Booking failed (${res.status})`);
      }
      const result = await res.json();
      setBookingResult({ status: result.status, message: result.message });
      setSubmitted(true);
    } catch (err) {
      console.error('[UnifiedLeadForm] Booking error:', err);
      setSubmitError('We couldn\'t book your appointment. Please try again or call us directly.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitFinal = () => (isBookingMode ? handleSubmitBooking() : handleSubmitLead());

  // Validate required fields on the current fields step, then advance or submit.
  const advanceFromFields = (fieldsStep: NicheStep) => {
    const missing = fieldsStep.fields.find(f => {
      if (!f.required) return false;
      if (f.type === 'select' && f.optionsFrom === 'categories' && (!categories || categories.length === 0)) return false;
      return !(formData[f.name] ?? '').trim();
    });
    if (missing) {
      setStepError(`Please fill in the required field: ${missing.label}.`);
      return;
    }
    if (isLastStep) submitFinal();
    else setStep(step + 1);
  };

  const finalLabel = config.submitLabel || (ctaStyle === 'booking' ? 'Schedule Service' : 'Get Free Estimate');

  const stepTitleAt = (i: number): string => {
    const s = steps[i - 1];
    if (!s) return '';
    if (s.kind === 'date') return 'Select Date';
    if (s.kind === 'time') return 'Select Time';
    return s.step.title;
  };

  const heroHeading = step === 1 && config.firstStepUsesCtaHeading
    ? (ctaStyle === 'booking' ? 'Book Online' : 'Get Free Estimate')
    : stepTitleAt(step);

  const inputClass = variant === 'hero'
    ? 'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2'
    : 'w-full rounded-xl border border-gray-300 px-4 py-3 text-sm transition-all duration-300 focus:border-transparent focus:outline-none focus:ring-2';

  const ringStyle = { '--tw-ring-color': accentColor } as React.CSSProperties;
  const primaryBtnClass = variant === 'hero'
    ? 'hover:opacity-90'
    : 'rounded-full py-3.5 text-base shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg';

  // ---- Field renderer ----
  const renderField = (f: NicheField) => {
    const value = formData[f.name] ?? '';

    switch (f.type) {
      case 'select': {
        const options = f.optionsFrom === 'categories'
          ? (categories ?? []).map(c => ({ label: c.gbp_category.display_name, value: c.gbp_category.display_name }))
          : (f.options ?? []);
        if (options.length === 0) return null;
        return (
          <div key={f.name}>
            <label className="mb-1 block text-sm font-medium text-gray-700">{f.label}</label>
            <select className={inputClass} style={ringStyle} value={value} onChange={e => setField(f.name, e.target.value)}>
              <option value="">Select a service...</option>
              {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        );
      }
      case 'cards':
        return (
          <div key={f.name}>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {f.label}{f.required && ' *'}
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(f.options ?? []).map(o => {
                const selected = value === o.value;
                return (
                  <button
                    type="button"
                    key={o.value}
                    onClick={() => setField(f.name, o.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-sm transition-all ${
                      selected ? 'border-2 shadow-sm' : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:shadow-sm'
                    }`}
                    style={selected ? { borderColor: accentColor, color: accentColor } : undefined}
                  >
                    {o.icon && <ApplianceIcon name={o.icon} className="h-7 w-7" />}
                    <span className="font-medium leading-tight">{o.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      case 'chips':
        return (
          <div key={f.name}>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {f.label}{f.required && ' *'}
            </label>
            <div className="flex flex-wrap gap-2">
              {(f.options ?? []).map(o => {
                const selected = value === o.value;
                return (
                  <button
                    type="button"
                    key={o.value}
                    onClick={() => setField(f.name, o.value)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                      selected ? 'border-2 font-medium' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                    style={selected ? { borderColor: accentColor, color: accentColor } : undefined}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      case 'textarea':
        return (
          <div key={f.name}>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {f.label}{f.required && ' *'}
            </label>
            <textarea
              rows={3}
              placeholder={f.placeholder}
              className={inputClass}
              style={ringStyle}
              value={value}
              onChange={e => setField(f.name, e.target.value)}
            />
          </div>
        );
      case 'address':
        return (
          <div key={f.name} ref={addressRef} className="relative">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {f.label}{f.required && ' *'}
            </label>
            <input
              type="text"
              placeholder={f.placeholder}
              className={inputClass}
              style={ringStyle}
              value={addressQuery}
              onChange={e => { setAddressQuery(e.target.value); setField('address', e.target.value); setAddressMeta({}); }}
              onFocus={() => { if (predictions.length > 0) setShowPredictions(true); }}
            />
            {showPredictions && predictions.length > 0 && (
              <ul className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                {predictions.map(p => (
                  <li
                    key={p.placeId}
                    className="cursor-pointer px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    onMouseDown={() => handleSelectPrediction(p)}
                  >
                    {p.description}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      default: // text, tel, email
        return (
          <div key={f.name}>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {f.label}{f.required && ' *'}
            </label>
            <input
              type={f.type}
              inputMode={f.numeric ? 'numeric' : undefined}
              required={f.required}
              placeholder={f.placeholder}
              className={inputClass}
              style={ringStyle}
              value={value}
              onChange={e => setField(f.name, e.target.value)}
            />
          </div>
        );
    }
  };

  // ---- Success state ----
  if (submitted) {
    if (variant === 'hero') {
      return (
        <div className="text-center py-4">
          <CheckCircle2 className="mx-auto h-12 w-12 mb-3" style={{ color: accentColor }} />
          <h3 className="text-xl font-bold text-gray-900">Thank You!</h3>
          <p className="mt-2 text-sm text-gray-600">
            {bookingResult?.message || 'We\'ve received your request. A team member will reach out shortly.'}
          </p>
          {selectedDate && (
            <p className="mt-2 font-medium text-gray-800 text-sm">
              {formatDateDisplay(selectedDate)}
              {selectedSlot && ` at ${formatTime(selectedSlot.startTime)} - ${formatTime(selectedSlot.endTime)}`}
            </p>
          )}
        </div>
      );
    }
    return (
      <section id="booking" className="py-24">
        <div className="mx-auto max-w-xl px-4 text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 mb-4" style={{ color: accentColor }} />
          <h2 className="text-2xl font-bold text-gray-900">
            {bookingResult?.status === 'confirmed' ? 'Appointment Confirmed!' : 'Thank You!'}
          </h2>
          <p className="mt-4 text-gray-600">
            {bookingResult?.message || 'We\'ve received your request and will be in touch shortly.'}
          </p>
          {selectedDate && (
            <p className="mt-2 font-medium text-gray-800">
              {formatDateDisplay(selectedDate)}
              {selectedSlot && ` at ${formatTime(selectedSlot.startTime)} - ${formatTime(selectedSlot.endTime)}`}
            </p>
          )}
        </div>
      </section>
    );
  }

  // ---- Honeypot (visually hidden; real users never fill it) ----
  const honeypotField = (
    <div aria-hidden tabIndex={-1} style={{ position: 'absolute', left: '-9999px', top: '-9999px', height: 0, width: 0, overflow: 'hidden' }}>
      <label>
        Company website
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={e => setHoneypot(e.target.value)}
        />
      </label>
    </div>
  );

  // ---- Step body ----
  const renderStepBody = () => {
    if (!current) return null;

    if (current.kind === 'date') {
      return (
        <div className="space-y-4">
          <button onClick={() => setStep(step - 1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading availability...</span>
            </div>
          ) : availability.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CalendarDays className="mx-auto h-10 w-10 text-gray-300 mb-3" />
              <p>No availability found. Please call us to schedule.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {availability.map(day => {
                const [y, m, d] = day.date.split('-').map(Number);
                const dateObj = new Date(y, m - 1, d);
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const isAvailable = !day.isBlocked && day.spotsRemaining > 0;
                const isSelected = selectedDate === day.date;
                return (
                  <button
                    key={day.date}
                    disabled={!isAvailable}
                    onClick={() => { setSelectedDate(day.date); setSelectedSlot(null); setStep(step + 1); }}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      isSelected ? 'border-2 shadow-md'
                        : isAvailable ? 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                          : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                    }`}
                    style={isSelected ? { borderColor: accentColor } : undefined}
                  >
                    <div className="text-xs text-gray-500">{dayName}</div>
                    <div className="font-semibold text-gray-900">{monthDay}</div>
                    {isAvailable ? (
                      <div className="text-xs mt-1" style={{ color: accentColor }}>
                        {day.spotsRemaining} spot{day.spotsRemaining !== 1 ? 's' : ''}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 mt-1">{day.isBlocked ? 'Closed' : 'Full'}</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    if (current.kind === 'time') {
      const dayData = availability.find(d => d.date === selectedDate);
      return (
        <div className="space-y-4">
          <button onClick={() => setStep(step - 1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="text-center mb-4">
            <p className="font-medium text-gray-900">{formatDateDisplay(selectedDate)}</p>
          </div>
          {!dayData || dayData.slots.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="mx-auto h-10 w-10 text-gray-300 mb-3" />
              <p>No time slots available for this date.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dayData.slots.map((slot, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedSlot(slot);
                    if (isLastStep) handleSubmitBooking();
                    else setStep(step + 1);
                  }}
                  disabled={submitting}
                  className="w-full flex items-center justify-between rounded-xl border border-gray-200 p-4 transition-all hover:border-gray-300 hover:shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <span className="font-medium text-gray-900">
                      {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                    </span>
                  </div>
                  <span className="text-sm" style={{ color: accentColor }}>
                    {slot.spotsAvailable} spot{slot.spotsAvailable !== 1 ? 's' : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
          {submitting && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Booking your appointment...</span>
            </div>
          )}
          {submitError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>
          )}
        </div>
      );
    }

    // Fields step
    const isFirst = step === 1;
    return (
      <form
        onSubmit={e => { e.preventDefault(); advanceFromFields(current.step); }}
        className="space-y-4"
      >
        {current.step.fields.map(renderField)}
        {stepError && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{stepError}</p>
        )}
        {isFirst ? (
          <Button type="submit" disabled={submitting} className={`w-full ${primaryBtnClass}`} style={{ backgroundColor: accentColor }}>
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : (isLastStep ? finalLabel : 'Continue')}
          </Button>
        ) : (
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex items-center gap-1" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button type="submit" disabled={submitting} className={`flex-1 ${primaryBtnClass}`} style={{ backgroundColor: accentColor }}>
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : (isLastStep ? finalLabel : 'Continue')}
            </Button>
          </div>
        )}
        {submitError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>
        )}
      </form>
    );
  };

  // ---- Form content ----
  const formContent = (
    <>
      {honeypotField}
      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          {variant === 'hero' ? (
            <>
              <div>
                <span className="font-bold text-gray-900 text-2xl">{heroHeading}</span>
                {step === 1 && (
                  <div className="font-medium" style={{ color: accentColor }}>In less than 30 seconds</div>
                )}
              </div>
              <span className="text-gray-500">Step {step} of {totalSteps}</span>
            </>
          ) : (
            <>
              <span className="text-gray-500">Step {step} of {totalSteps}</span>
              <span className="font-medium" style={{ color: accentColor }}>{stepTitleAt(step)}</span>
            </>
          )}
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%`, backgroundColor: accentColor }}
          />
        </div>
      </div>

      {renderStepBody()}
    </>
  );

  // ---- Layout wrapper ----
  if (variant === 'hero') {
    return <div>{formContent}</div>;
  }

  return (
    <section id="booking" className="py-24">
      <div className="mx-auto max-w-xl px-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            {ctaStyle === 'booking' ? 'Schedule Your Service' : 'Get a Free, No-Obligation Estimate'}
          </h2>
          <p className="mt-2 text-gray-600">
            {ctaStyle === 'booking'
              ? 'Fill out the form below to request an appointment.'
              : 'Fill out the form below and we\'ll get back to you promptly.'}
          </p>
        </div>
        {formContent}
      </div>
    </section>
  );
}

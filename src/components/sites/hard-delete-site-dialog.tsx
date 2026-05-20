'use client';

import { useEffect, useState } from 'react';
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
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';

interface HardDeleteSiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string | null;
  siteName: string | null;
  siteSlug: string | null;
  /** Called after a successful delete so the parent can refresh state. */
  onDeleted: (deletedId: string) => void;
}

/**
 * Type-to-confirm modal for hard-deleting a site.
 *
 * Pattern modeled on GitHub / Vercel / Stripe destructive confirmations:
 * the "Delete forever" button stays disabled until the user types the
 * site's exact name into the input. Provides one last layer of safety on
 * top of the server-side confirmation_name check.
 *
 * On confirm, POSTs to `DELETE /api/sites/[siteId]` with the typed name.
 * On success, calls `onDeleted(siteId)` so the parent list can drop the row.
 */
export function HardDeleteSiteDialog({
  open,
  onOpenChange,
  siteId,
  siteName,
  siteSlug,
  onDeleted,
}: HardDeleteSiteDialogProps) {
  const [typed, setTyped] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state whenever the dialog opens against a new site
  useEffect(() => {
    if (open) {
      setTyped('');
      setError(null);
    }
  }, [open, siteId]);

  const canDelete = !!siteName && typed.trim() === siteName.trim() && !isDeleting;

  async function handleDelete() {
    if (!siteId || !siteName) return;
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation_name: typed.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Delete failed');
      }
      onDeleted(siteId);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            Hard delete site
          </DialogTitle>
          <DialogDescription className="text-gray-700">
            This permanently deletes <strong>{siteName}</strong> and everything
            associated with it. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 space-y-2">
          <p className="font-medium">What gets deleted:</p>
          <ul className="list-disc list-inside space-y-0.5 text-xs">
            <li>Every Job Snap + photo (database rows + storage files)</li>
            <li>Every work item, page, service, brand, location, neighborhood</li>
            <li>Every lead, appointment, review, scheduling config</li>
            <li>Every API key, webhook endpoint, integration credential</li>
            <li>Every team-member site assignment</li>
            <li>The site logo + uploaded assets</li>
          </ul>
          <p className="text-xs">
            Billing history (subscriptions) is preserved for audit, but the link to this site is removed.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-name" className="text-sm">
            Type{' '}
            <span className="font-mono font-semibold text-gray-900">
              {siteName || '…'}
            </span>{' '}
            to confirm:
          </Label>
          <Input
            id="confirm-name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={siteName || ''}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={isDeleting}
            className="font-mono"
          />
          {siteSlug && (
            <p className="text-xs text-gray-500">
              Slug to be freed: <span className="font-mono">{siteSlug}</span>
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete forever
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

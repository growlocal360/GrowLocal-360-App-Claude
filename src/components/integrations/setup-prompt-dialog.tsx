'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { Sparkles, Copy, Check, ExternalLink } from 'lucide-react';
import {
  generateSetupPrompt,
  type SetupPromptFramework,
  type SetupPromptParams,
} from '@/lib/integrations/setup-prompts';

interface SetupPromptDialogProps {
  framework: SetupPromptFramework;
  apiBase: string;
  /** Optional: business name for the chosen workspace (for tailored copy). */
  businessName?: string | null;
  /** Trigger button label override. */
  triggerLabel?: string;
  /** Visual variant of the trigger button. */
  triggerVariant?: 'default' | 'outline';
  /** Pre-fill the API key field (e.g., a key just shown to the user once). */
  initialApiKey?: string | null;
  /** Pre-fill the webhook URL field. */
  initialWebhookUrl?: string | null;
  /** Pre-fill the webhook secret field. */
  initialWebhookSecret?: string | null;
}

const FRAMEWORK_LABEL: Record<SetupPromptFramework, string> = {
  nextjs: 'Next.js',
  wordpress: 'WordPress',
  api: 'Generic API',
};

export function SetupPromptDialog({
  framework,
  apiBase,
  businessName,
  triggerLabel,
  triggerVariant = 'outline',
  initialApiKey,
  initialWebhookUrl,
  initialWebhookSecret,
}: SetupPromptDialogProps) {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState(initialApiKey || '');
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl || '');
  const [webhookSecret, setWebhookSecret] = useState(initialWebhookSecret || '');
  const [databaseChoice, setDatabaseChoice] =
    useState<NonNullable<SetupPromptParams['databaseChoice']>>('supabase');
  const [copied, setCopied] = useState(false);

  // Re-sync the form fields whenever new initial values arrive (e.g., the user
  // generated a fresh API key or webhook secret right before opening this).
  useEffect(() => {
    if (initialApiKey) setApiKey(initialApiKey);
  }, [initialApiKey]);
  useEffect(() => {
    if (initialWebhookUrl) setWebhookUrl(initialWebhookUrl);
  }, [initialWebhookUrl]);
  useEffect(() => {
    if (initialWebhookSecret) setWebhookSecret(initialWebhookSecret);
  }, [initialWebhookSecret]);

  // Reset copied indicator a moment after copying
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const prompt = useMemo(
    () =>
      generateSetupPrompt({
        framework,
        apiBase,
        apiKey: apiKey || null,
        webhookUrl: webhookUrl || null,
        webhookSecret: webhookSecret || null,
        businessName: businessName || null,
        databaseChoice: framework === 'nextjs' ? databaseChoice : null,
      }),
    [framework, apiBase, apiKey, webhookUrl, webhookSecret, businessName, databaseChoice]
  );

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
  }

  const showWebhookFields = framework === 'nextjs' || framework === 'wordpress';

  return (
    <>
      <Button
        variant={triggerVariant}
        onClick={() => setOpen(true)}
        className={
          triggerVariant === 'default'
            ? 'bg-[#00ef99] hover:bg-[#00ef99]/90 text-black font-semibold'
            : 'border-[#00ef99] text-black hover:bg-[#00ef99]/10'
        }
      >
        <Sparkles className="h-4 w-4 mr-2 text-[#00ef99]" />
        {triggerLabel || 'Copy AI Setup Prompt'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#00ef99]" />
              {FRAMEWORK_LABEL[framework]} setup prompt
            </DialogTitle>
            <DialogDescription>
              Paste this into Claude Code, Cursor, or any AI coding tool inside your{' '}
              {FRAMEWORK_LABEL[framework]} project. The AI will scaffold the integration
              for you. Pre-fill the credential fields below for a fully ready-to-paste prompt.
            </DialogDescription>
          </DialogHeader>

          {/* ── Credential pre-fill ─────────────────────────────────── */}
          <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
            <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">
              Pre-fill credentials (optional but recommended)
            </p>
            <p className="text-xs text-gray-500 -mt-2">
              Paste from the dashboard below. Leave blank to use placeholder text the AI
              (or you) can fill in later.
            </p>

            <div className="space-y-1">
              <Label htmlFor="prompt-apikey" className="text-xs">
                API Key (from API Keys section)
              </Label>
              <Input
                id="prompt-apikey"
                type="password"
                placeholder="js_live_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            {showWebhookFields && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="prompt-hookurl" className="text-xs">
                    Webhook URL (your site URL where the handler will live)
                  </Label>
                  <Input
                    id="prompt-hookurl"
                    placeholder={
                      framework === 'wordpress'
                        ? 'https://yoursite.com/wp-json/jobsnaps/v1/webhook'
                        : 'https://yoursite.com/api/jobsnaps-webhook'
                    }
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="prompt-hooksecret" className="text-xs">
                    Webhook Signing Secret (from Webhooks section)
                  </Label>
                  <Input
                    id="prompt-hooksecret"
                    type="password"
                    placeholder="whsec_..."
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </>
            )}

            {framework === 'nextjs' && (
              <div className="space-y-1">
                <Label htmlFor="prompt-db" className="text-xs">
                  Database choice
                </Label>
                <Select
                  value={databaseChoice}
                  onValueChange={(v) =>
                    setDatabaseChoice(v as NonNullable<SetupPromptParams['databaseChoice']>)
                  }
                >
                  <SelectTrigger id="prompt-db">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supabase">Supabase Postgres</SelectItem>
                    <SelectItem value="vercel-postgres">Vercel Postgres</SelectItem>
                    <SelectItem value="neon">Neon</SelectItem>
                    <SelectItem value="turso">Turso (SQLite)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* ── Prompt preview ──────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide">Prompt preview</Label>
              <span className="text-xs text-gray-500">
                {prompt.length.toLocaleString()} chars
              </span>
            </div>
            <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-auto max-h-72 whitespace-pre-wrap">
              <code>{prompt}</code>
            </pre>
          </div>

          {/* ── Tools to use it with ────────────────────────────────── */}
          <div className="text-xs text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Works in:</span>
            <a
              href="https://claude.com/claude-code"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-900 inline-flex items-center gap-0.5"
            >
              Claude Code <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="https://cursor.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-900 inline-flex items-center gap-0.5"
            >
              Cursor <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="https://chatgpt.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-900 inline-flex items-center gap-0.5"
            >
              ChatGPT <ExternalLink className="h-3 w-3" />
            </a>
            <span>or any AI coding assistant.</span>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              onClick={handleCopy}
              className="bg-black hover:bg-gray-800"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Full Prompt
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

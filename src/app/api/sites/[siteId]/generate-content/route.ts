import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { inngest } from '@/lib/inngest/client';

interface RouteParams {
  params: Promise<{ siteId: string }>;
}

/**
 * POST /api/sites/[siteId]/generate-content
 * Validates auth, then triggers the Inngest content generation function.
 * Returns immediately with 202 Accepted.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { siteId } = await params;

  try {
    const supabase = await createClient();

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to get their organization_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 403 });
    }

    // Get site and verify it belongs to user's organization
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, name, status')
      .eq('id', siteId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (siteError || !site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Check if already building
    if (site.status === 'building') {
      return NextResponse.json(
        { error: 'Content generation already in progress' },
        { status: 409 }
      );
    }

    // Capture Google access token for review fetching (only available during user session)
    const { data: { session } } = await supabase.auth.getSession();
    const googleAccessToken = session?.provider_token || null;

    // Mark as building immediately
    const admin = createAdminClient();
    await admin
      .from('sites')
      .update({
        status: site.status === 'active' ? 'active' : 'building',
        status_message: null,
        status_updated_at: new Date().toISOString(),
      })
      .eq('id', siteId);

    // Trigger Inngest function
    try {
      const sendResult = await inngest.send({
        name: 'site/content.generate',
        data: {
          siteId,
          googleAccessToken,
        },
      });
      console.log('Inngest send result:', JSON.stringify(sendResult));
    } catch (inngestError) {
      console.error('Inngest send failed:', inngestError);
      return NextResponse.json(
        { error: 'Failed to send to Inngest', details: String(inngestError) },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        status: 'started',
        message: 'Content generation started',
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('Error starting content generation:', error);
    return NextResponse.json(
      { error: 'Failed to start content generation' },
      { status: 500 }
    );
  }
}

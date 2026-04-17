import { createAdminClient } from '@/lib/supabase/admin';
import { ASSET_BUCKET } from '@/lib/assets/types';
import type { ImagePrompt, GeneratedImage } from '@/types/database';

// ---------------------------------------------------------------------------
// Generate a single image via Google Nano Banana 2 (Gemini REST API)
// Uses gemini-2.5-flash-image model with optional logo for brand context
// ---------------------------------------------------------------------------

async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.toString('base64');
  } catch {
    return null;
  }
}

function getMimeTypeFromUrl(url: string): string {
  if (url.includes('.jpg') || url.includes('.jpeg')) return 'image/jpeg';
  if (url.includes('.webp')) return 'image/webp';
  if (url.includes('.svg')) return 'image/png'; // SVGs can't be sent as inline data
  return 'image/png';
}

async function generateWithNanoBanana(
  prompt: string,
  style: string,
  logoUrl?: string | null
): Promise<{ base64: string; mimeType: string }> {
  const apiKey = process.env.NANO_BANANA_API_KEY;
  if (!apiKey) {
    throw new Error('NANO_BANANA_API_KEY not configured');
  }

  console.log('[image-gen] Calling Nano Banana 2 (gemini-2.5-flash-image)...');

  // Build request parts
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  // If logo is provided, add it as brand context
  if (logoUrl) {
    const logoBase64 = await fetchImageAsBase64(logoUrl);
    if (logoBase64) {
      parts.push({
        inlineData: {
          mimeType: getMimeTypeFromUrl(logoUrl),
          data: logoBase64,
        },
      });
      prompt = `Use the provided logo image ONLY as a color and style reference to match the brand identity. ${prompt} Do NOT place the logo on the image unless the scene naturally includes a branded uniform, vehicle, or storefront where it would realistically appear. Do not add any text overlays, banners, titles, or captions to the image.`;
    }
  }

  const fullPrompt = `${prompt}\n\nStyle: ${style}\n\nIMPORTANT: Do not add any text, titles, banners, captions, watermarks, or overlay text to the image. The image should be purely photographic with no text elements.`;
  parts.push({ text: fullPrompt });

  // Call Gemini REST API directly (matches working implementation)
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts }],
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[image-gen] Nano Banana API error:', errorData);
    throw new Error(`Nano Banana API failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[image-gen] Nano Banana 2 response received, extracting image...');

  // Extract image data from response
  const imageData = data.candidates?.[0]?.content?.parts?.find(
    (part: { inlineData?: { data: string } }) => part.inlineData
  )?.inlineData?.data;

  if (!imageData) {
    throw new Error('Nano Banana 2 returned no image data');
  }

  return {
    base64: imageData,
    mimeType: 'image/png',
  };
}

// ---------------------------------------------------------------------------
// Upload helpers — URL-based (DALL-E) and base64-based (Nano Banana)
// ---------------------------------------------------------------------------

async function uploadToStorage(
  buffer: Buffer,
  contentType: string,
  siteId: string,
  filename: string
): Promise<{ storagePath: string; publicUrl: string }> {
  const supabase = createAdminClient();
  const storagePath = `${siteId}/generated/${filename}`;

  const { error: uploadError } = await supabase.storage
    .from(ASSET_BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Failed to upload to storage: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(ASSET_BUCKET)
    .getPublicUrl(storagePath);

  return { storagePath, publicUrl: urlData.publicUrl };
}

async function uploadImageFromUrl(
  imageUrl: string,
  siteId: string,
  filename: string
): Promise<{ storagePath: string; publicUrl: string }> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'image/png';
  return uploadToStorage(buffer, contentType, siteId, filename);
}

function uploadImageFromBase64(
  base64Data: string,
  mimeType: string,
  siteId: string,
  filename: string
): Promise<{ storagePath: string; publicUrl: string }> {
  const buffer = Buffer.from(base64Data, 'base64');
  return uploadToStorage(buffer, mimeType, siteId, filename);
}

// ---------------------------------------------------------------------------
// SEO-friendly filename from H1/title
// e.g. "Carpet Cleaning Service in Killeen, TX" → "carpet-cleaning-service-in-killeen-tx"
// ---------------------------------------------------------------------------

function toSeoFilename(text: string, suffix?: string): string {
  let slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  if (suffix) slug = `${slug}-${suffix}`;
  return `${slug}.png`;
}

// ---------------------------------------------------------------------------
// Generate all images for a set of prompts
// All images use Nano Banana 2 (Gemini) for maximum realism.
// Logo is passed for brand context on all images.
// ---------------------------------------------------------------------------

export async function generateImagesFromPrompts(
  siteId: string,
  pageSlug: string,
  prompts: ImagePrompt[],
  logoUrl?: string | null,
  pageH1?: string | null,
  siteSlug?: string | null
): Promise<GeneratedImage[]> {
  const results: GeneratedImage[] = [];

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];

    // Skip reuse references — no image to generate
    if (prompt.reuse_strategy === 'reuse_category') {
      continue;
    }

    // Skip prompts with no actual prompt text
    if (!prompt.prompt?.trim()) {
      continue;
    }

    try {
      // SEO filename: derive from H1 if available, fall back to page slug
      const baseText = pageH1 || pageSlug;
      const suffix = i > 0 ? String(i + 1) : undefined;
      const filename = toSeoFilename(baseText, suffix);

      let storagePath: string;
      let publicUrl: string;
      const width = 1024;
      const height = 1024;

      // Use Nano Banana 2 (Gemini) for all images — pass logo for brand context
      const { base64, mimeType } = await generateWithNanoBanana(
        prompt.prompt,
        prompt.style,
        logoUrl
      );
      const uploaded = await uploadImageFromBase64(base64, mimeType, siteId, filename);
      storagePath = uploaded.storagePath;

      // Store clean relative URL (served via /public/images/ proxy)
      // Middleware rewrites to /sites/{slug}/public/images/ for routing
      publicUrl = `/public/images/${filename}`;

      results.push({
        url: publicUrl,
        storage_path: storagePath,
        prompt_index: i,
        engine: 'nano_banana',
        width,
        height,
        created_at: new Date().toISOString(),
      });

      console.log(`[image-gen] Generated ${prompt.section_type} image for ${pageSlug} → ${filename}`);
    } catch (error) {
      // Image generation is non-fatal — log and continue
      console.error(`[image-gen] Failed to generate image ${i} for ${pageSlug}:`, error);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Resolve service images from parent category's generated images
// ---------------------------------------------------------------------------

export function resolveServiceImages(
  categoryGeneratedImages: GeneratedImage[] | null
): GeneratedImage[] | null {
  // Services reuse their category's images — just return them directly
  return categoryGeneratedImages;
}

import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createAdminClient } from '@/lib/supabase/admin';
import { ASSET_BUCKET } from '@/lib/assets/types';
import type { ImagePrompt, GeneratedImage } from '@/types/database';

// ---------------------------------------------------------------------------
// OpenAI client
// ---------------------------------------------------------------------------

function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
  return new OpenAI({ apiKey });
}

// ---------------------------------------------------------------------------
// Generate a single image via DALL-E 3
// ---------------------------------------------------------------------------

async function generateWithDallE(
  openai: OpenAI,
  prompt: string,
  style: string
): Promise<{ url: string; revisedPrompt: string }> {
  // Combine the prompt with the style block
  const fullPrompt = `${prompt}\n\nStyle: ${style}`;

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: fullPrompt,
    n: 1,
    size: '1792x1024', // Landscape for web hero/banner use
    quality: 'hd',
    response_format: 'url',
  });

  const imageData = response.data?.[0];
  if (!imageData?.url) {
    throw new Error('DALL-E returned no image URL');
  }

  return {
    url: imageData.url,
    revisedPrompt: imageData.revised_prompt || prompt,
  };
}

// ---------------------------------------------------------------------------
// Generate a single image via Google Nano Banana 2 (Gemini image generation)
// ---------------------------------------------------------------------------

async function generateWithNanoBanana(
  prompt: string,
  style: string
): Promise<{ base64: string; mimeType: string }> {
  const apiKey = process.env.NANO_BANANA_API_KEY;
  if (!apiKey) {
    throw new Error('NANO_BANANA_API_KEY not configured');
  }

  const fullPrompt = `${prompt}\n\nStyle: ${style}`;

  console.log('[image-gen] Calling Nano Banana 2 (Gemini image generation)...');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-preview-image-generation',
    generationConfig: {
      responseModalities: ['image', 'text'],
    } as Record<string, unknown>,
  });

  const response = await model.generateContent(fullPrompt);
  console.log('[image-gen] Nano Banana 2 response received, extracting image...');
  const parts = response.response.candidates?.[0]?.content?.parts;

  if (!parts) {
    throw new Error('Nano Banana 2 returned no content');
  }

  // Find the image part in the response
  for (const part of parts) {
    if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith('image/')) {
      return {
        base64: part.inlineData.data,
        mimeType: part.inlineData.mimeType,
      };
    }
  }

  throw new Error('Nano Banana 2 returned no image data');
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
// Generate all images for a set of prompts
// ---------------------------------------------------------------------------

export async function generateImagesFromPrompts(
  siteId: string,
  pageSlug: string,
  prompts: ImagePrompt[]
): Promise<GeneratedImage[]> {
  const openai = createOpenAIClient();
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
      const sanitizedSlug = pageSlug.replace(/[^a-z0-9-]/g, '-').slice(0, 40);
      let storagePath: string;
      let publicUrl: string;
      let width = 1792;
      let height = 1024;

      if (prompt.engine === 'nano_banana' && process.env.NANO_BANANA_API_KEY) {
        // Nano Banana 2 (Google Gemini) — returns base64, fall back to DALL-E on failure
        try {
          const { base64, mimeType } = await generateWithNanoBanana(prompt.prompt, prompt.style);
          const ext = mimeType.split('/')[1] || 'png';
          const filename = `${sanitizedSlug}-${prompt.section_type}-${i}.${ext}`;
          const uploaded = await uploadImageFromBase64(base64, mimeType, siteId, filename);
          storagePath = uploaded.storagePath;
          publicUrl = uploaded.publicUrl;
          width = 1024;
          height = 1024;
        } catch (nanoBananaError) {
          console.warn(`[image-gen] Nano Banana failed, falling back to DALL-E:`, nanoBananaError);
          const { url } = await generateWithDallE(openai, prompt.prompt, prompt.style);
          const filename = `${sanitizedSlug}-${prompt.section_type}-${i}.png`;
          const uploaded = await uploadImageFromUrl(url, siteId, filename);
          storagePath = uploaded.storagePath;
          publicUrl = uploaded.publicUrl;
        }
      } else {
        // DALL-E 3 — returns URL
        const { url } = await generateWithDallE(openai, prompt.prompt, prompt.style);
        const filename = `${sanitizedSlug}-${prompt.section_type}-${i}.png`;
        const uploaded = await uploadImageFromUrl(url, siteId, filename);
        storagePath = uploaded.storagePath;
        publicUrl = uploaded.publicUrl;
      }

      results.push({
        url: publicUrl,
        storage_path: storagePath,
        prompt_index: i,
        engine: prompt.engine,
        width,
        height,
        created_at: new Date().toISOString(),
      });

      console.log(`[image-gen] Generated ${prompt.section_type} image for ${pageSlug} (${prompt.engine})`);
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

import { createAdminClient } from '@/lib/supabase/admin';
import {
  AssetType,
  ASSET_BUCKET,
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE,
  getAssetPrefix,
  getStorageSubfolder,
  slugifyFilename,
} from './types';
import { optimizeImage, imageSlug, type ImagePreset } from '@/lib/images/optimize';

interface UploadAssetParams {
  siteId: string;
  assetType: AssetType;
  file: File;
  /** Optional sub-path segment, e.g. 'team-john-david' for site assets */
  subpath?: string;
  /** If true, preserve original filename (for brand assets). Default: false */
  preserveFilename?: boolean;
  /**
   * Run the file through the image pipeline (resize for the slot, WebP, EXIF
   * stripped; SVG passes through) and name it from `name`
   * (e.g. ['Anthony Minor', 'Plumber', "Anthony's Plumbing"]). The stem
   * replaces any existing file with the same name instead of suffixing it, so
   * re-uploading a person photo keeps one file.
   */
  optimize?: { preset: ImagePreset; name: Array<string | null | undefined> };
}

interface UploadAssetResult {
  storagePath: string;
  publicPath: string;
  assetId: string;
}

/**
 * Upload an asset to Supabase storage and create an entry in the assets table.
 * Returns the storage path and clean public path.
 */
export async function uploadAsset({
  siteId,
  assetType,
  file,
  subpath,
  preserveFilename = false,
  optimize,
}: UploadAssetParams): Promise<UploadAssetResult> {
  // Validate file type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Invalid file type. Allowed: PNG, JPG, WEBP, SVG');
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large. Maximum size is 10MB');
  }

  const adminSupabase = createAdminClient();

  // Every raster image is resized + re-encoded before it is stored.
  const original = Buffer.from(await file.arrayBuffer());
  const optimized = optimize ? await optimizeImage(original, { preset: optimize.preset, contentType: file.type }) : null;
  const buffer = optimized ? optimized.buffer : original;
  const contentType = optimized ? optimized.contentType : file.type;

  // Determine filename
  let filename: string;
  if (optimized) {
    filename = `${imageSlug(optimize!.name)}.${optimized.ext}`;
  } else if (subpath) {
    // Use subpath as the filename base (e.g., 'team-john-david')
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    filename = `${slugifyFilename(subpath)}.${ext}`;
  } else if (preserveFilename) {
    filename = file.name;
  } else {
    filename = slugifyFilename(file.name);
  }

  // Build storage path: {siteId}/{subfolder}/{filename}
  const subfolder = getStorageSubfolder(assetType);
  const storagePath = `${siteId}/${subfolder}/${filename}`;

  // Build public path: assets/brand/logo.svg, assets/site/team-photo.jpg, etc.
  const prefix = getAssetPrefix(assetType);
  const publicPath = `${prefix}/${filename}`;

  // Handle filename conflicts — check if public_path already exists
  let finalFilename = filename;
  let finalStoragePath = storagePath;
  let finalPublicPath = publicPath;

  const { data: existing } = await adminSupabase
    .from('assets')
    .select('id')
    .eq('site_id', siteId)
    .eq('public_path', finalPublicPath)
    .limit(1);

  if (existing && existing.length > 0 && !optimized) {
    // Append suffix to avoid conflict (named optimized uploads replace instead)
    const lastDot = filename.lastIndexOf('.');
    const baseName = lastDot > 0 ? filename.substring(0, lastDot) : filename;
    const ext = lastDot > 0 ? filename.substring(lastDot) : '';

    let suffix = 2;
    let resolved = false;
    while (!resolved && suffix <= 100) {
      const candidateFilename = `${baseName}-${suffix}${ext}`;
      const candidatePath = `${prefix}/${candidateFilename}`;
      const { data: check } = await adminSupabase
        .from('assets')
        .select('id')
        .eq('site_id', siteId)
        .eq('public_path', candidatePath)
        .limit(1);

      if (!check || check.length === 0) {
        finalFilename = candidateFilename;
        finalStoragePath = `${siteId}/${subfolder}/${candidateFilename}`;
        finalPublicPath = candidatePath;
        resolved = true;
      }
      suffix++;
    }
  }

  const { error: uploadError } = await adminSupabase.storage
    .from(ASSET_BUCKET)
    .upload(finalStoragePath, buffer, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Failed to upload asset: ${uploadError.message}`);
  }

  // Create asset record
  const { data: asset, error: dbError } = await adminSupabase
    .from('assets')
    .upsert(
      {
        site_id: siteId,
        asset_type: assetType,
        original_filename: file.name,
        storage_path: finalStoragePath,
        public_path: finalPublicPath,
        content_type: contentType,
        file_size: buffer.length,
      },
      { onConflict: 'site_id,public_path' }
    )
    .select('id')
    .single();

  if (dbError || !asset) {
    throw new Error(`Failed to create asset record: ${dbError?.message}`);
  }

  return {
    storagePath: finalStoragePath,
    publicPath: finalPublicPath,
    assetId: asset.id,
  };
}

/**
 * Delete an asset from storage and the assets table.
 */
export async function deleteAsset(assetId: string): Promise<void> {
  const adminSupabase = createAdminClient();

  // Get asset record
  const { data: asset } = await adminSupabase
    .from('assets')
    .select('*')
    .eq('id', assetId)
    .single();

  if (!asset) return;

  // Delete from storage
  await adminSupabase.storage
    .from(ASSET_BUCKET)
    .remove([asset.storage_path]);

  // Delete from database
  await adminSupabase.from('assets').delete().eq('id', assetId);
}

/**
 * Thin client for HighLevel Marketplace API v2.
 *
 * Uses Private Integration Tokens (PIT) for authentication. PITs are long-
 * lived, location-scoped tokens generated in HL Settings → Integrations →
 * Private Integrations. Customer pastes the token + their HL Location ID
 * into our dashboard.
 *
 * API docs: https://highlevel.stoplight.io/docs/integrations/
 */

const API_BASE = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';

export interface HLBlog {
  id: string;
  name: string;
}

export interface HLBlogPost {
  id: string;
  title: string;
  status: 'PUBLISHED' | 'DRAFT' | 'SCHEDULED';
  urlSlug: string;
}

export interface HLBlogPostInput {
  blogId: string;
  locationId: string;
  title: string;
  description: string;
  rawHTML: string;
  imageUrl?: string;
  imageAltText?: string;
  urlSlug: string;
  status?: 'PUBLISHED' | 'DRAFT';
  publishedAt?: string;
  author?: string;
  categories?: string[];
  tags?: string[];
}

interface HLError extends Error {
  status?: number;
  body?: unknown;
}

async function call<T>(
  token: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: API_VERSION,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    const err: HLError = new Error(
      `HighLevel API ${method} ${path} failed: ${res.status} ${res.statusText}`
    );
    err.status = res.status;
    err.body = parsed;
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Verify a Private Integration Token + Location ID combination by calling
 * a lightweight endpoint. Used during the Connect HL flow to validate
 * credentials before storing them.
 *
 * Returns location info on success; throws with a helpful error message
 * on failure.
 */
export async function verifyToken(
  token: string,
  locationId: string
): Promise<{ id: string; name: string }> {
  type LocationResponse = {
    location?: { id: string; name: string };
  };

  const data = await call<LocationResponse>(
    token,
    'GET',
    `/locations/${encodeURIComponent(locationId)}`
  );

  if (!data.location?.id) {
    throw new Error('HighLevel returned an unexpected response shape for /locations.');
  }

  return { id: data.location.id, name: data.location.name };
}

/**
 * List blogs available on a location. Customer picks one as the target
 * for Job Snap blog posts.
 */
export async function listBlogs(
  token: string,
  locationId: string
): Promise<HLBlog[]> {
  type BlogsResponse = {
    blogs?: HLBlog[];
    data?: HLBlog[];
  };

  const data = await call<BlogsResponse>(
    token,
    'GET',
    `/blogs/site?locationId=${encodeURIComponent(locationId)}`
  );

  // HL response shape varies; normalize to an array.
  return data.blogs || data.data || [];
}

/**
 * Create a new blog post. Returns the post with its HL id (which we
 * store so we can update or delete it later).
 */
export async function createBlogPost(
  token: string,
  input: HLBlogPostInput
): Promise<HLBlogPost> {
  type CreateResponse = { blogPost?: HLBlogPost; data?: HLBlogPost };

  const data = await call<CreateResponse>(token, 'POST', '/blogs/posts', {
    ...input,
    status: input.status || 'PUBLISHED',
    publishedAt: input.publishedAt || new Date().toISOString(),
  });

  const post = data.blogPost || data.data;
  if (!post?.id) {
    throw new Error('HighLevel did not return a created post id.');
  }
  return post;
}

/**
 * Update an existing blog post by HL post id.
 */
export async function updateBlogPost(
  token: string,
  postId: string,
  input: HLBlogPostInput
): Promise<HLBlogPost> {
  type UpdateResponse = { blogPost?: HLBlogPost; data?: HLBlogPost };

  const data = await call<UpdateResponse>(
    token,
    'PUT',
    `/blogs/posts/${encodeURIComponent(postId)}`,
    {
      ...input,
      status: input.status || 'PUBLISHED',
    }
  );

  const post = data.blogPost || data.data;
  if (!post?.id) {
    throw new Error('HighLevel did not return an updated post id.');
  }
  return post;
}

/**
 * Delete a blog post. Used when a Job Snap is unpublished or deleted in
 * our system to keep the two systems aligned (no drift).
 */
export async function deleteBlogPost(
  token: string,
  postId: string
): Promise<void> {
  await call<void>(token, 'DELETE', `/blogs/posts/${encodeURIComponent(postId)}`);
}

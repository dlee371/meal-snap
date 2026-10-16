// Meal photo storage in Vercel Blob (server-only).
// Every photo is uploaded with access "private": its URL returns 403 without our
// credentials, so browsers only ever see photos through /api/photos/[id], which
// checks ownership first.
import "server-only";
import { put, get, del } from "@vercel/blob";

// Which credentials to use:
// - Locally: BLOB_READ_WRITE_TOKEN from .env.local. We pass it explicitly because
//   the SDK otherwise prefers VERCEL_OIDC_TOKEN (added by `vercel link`), which
//   Vercel only allows in deployed environments.
// - On Vercel: no read-write token is set, so the SDK uses the deployment's OIDC
//   token automatically.
function credentials() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return token ? { token } : {};
}

export async function savePhoto(pathname, bytes, contentType) {
  await put(pathname, Buffer.from(bytes), {
    access: "private",
    contentType,
    addRandomSuffix: false, // we choose the exact path: <user_id>/<meal_id>.jpg
    ...credentials(),
  });
}

// Returns { stream, blob } or null if the photo doesn't exist.
export async function readPhoto(pathname) {
  return get(pathname, { access: "private", ...credentials() });
}

export async function deletePhoto(pathname) {
  await del(pathname, credentials());
}

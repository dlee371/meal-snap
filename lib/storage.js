// Meal photo storage in Vercel Blob (server-only).
// Every photo is uploaded with access "private": its URL returns 403 without our
// BLOB_READ_WRITE_TOKEN, so browsers only ever see photos through
// /api/photos/[id], which checks ownership first.
import "server-only";
import { put, get, del } from "@vercel/blob";

export async function savePhoto(pathname, bytes, contentType) {
  await put(pathname, Buffer.from(bytes), {
    access: "private",
    contentType,
    addRandomSuffix: false, // we choose the exact path: <user_id>/<meal_id>.jpg
  });
}

// Returns { stream, blob } or null if the photo doesn't exist.
export async function readPhoto(pathname) {
  return get(pathname, { access: "private" });
}

export async function deletePhoto(pathname) {
  await del(pathname);
}

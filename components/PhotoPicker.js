"use client";
// Pick or take a photo → compress it in the browser → preview → upload.
// Phase 3 adds the "Analyzing your meal…" step after the upload.
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ACCEPTED_INPUT, MAX_UPLOAD_BYTES } from "@/lib/upload-rules";

// Phone photos are often 3–5 MB; ~1600 px is plenty for the AI and the UI.
const COMPRESSION_OPTIONS = {
  maxWidthOrHeight: 1600,
  maxSizeMB: 1,
  fileType: "image/jpeg", // also converts PNG/WebP (and HEIC where the browser can decode it)
  initialQuality: 0.85,
  useWebWorker: true,
};

export default function PhotoPicker() {
  const cameraInput = useRef(null);
  const libraryInput = useRef(null);
  const [photo, setPhoto] = useState(null); // compressed JPEG Blob
  const [previewUrl, setPreviewUrl] = useState("");
  // idle → compressing → ready → uploading → done (or error at any step)
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [mealId, setMealId] = useState("");

  // Free the preview's memory when it's replaced or the component unmounts.
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow picking the same file again
    if (!file) return;

    setError("");
    setMealId("");
    setStatus("compressing");
    try {
      // Loaded only when needed, so it doesn't slow down the first page load.
      const { default: imageCompression } = await import("browser-image-compression");
      const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
      if (compressed.size > MAX_UPLOAD_BYTES) throw new Error("too large");
      setPhoto(compressed);
      setPreviewUrl(URL.createObjectURL(compressed));
      setStatus("ready");
    } catch {
      setPhoto(null);
      setPreviewUrl("");
      setStatus("error");
      setError(
        "Couldn't read that photo. Try a JPEG or PNG (on iPhone, Safari handles HEIC photos).",
      );
    }
  }

  async function handleUpload() {
    if (!photo) return;
    setError("");
    setStatus("uploading");
    try {
      const body = new FormData();
      body.append("photo", photo, "meal.jpg");
      const res = await fetch("/api/meals", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed. Please try again.");
      setMealId(data.id);
      setStatus("done");
    } catch (err) {
      // Keep the photo so the user can just press Upload again.
      setStatus("ready");
      setError(
        err instanceof TypeError ? "Network error. Check your connection and retry." : err.message,
      );
    }
  }

  const busy = status === "compressing" || status === "uploading";

  return (
    <div className="flex flex-col gap-4">
      {/* Two hidden inputs, triggered by the visible buttons.
          capture="environment" opens the back camera on phones; the second input
          has no capture, so the user can choose an existing photo instead. */}
      <input ref={cameraInput} type="file" accept={ACCEPTED_INPUT} capture="environment" onChange={handleFile} hidden />
      <input ref={libraryInput} type="file" accept={ACCEPTED_INPUT} onChange={handleFile} hidden />

      {status !== "done" && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => cameraInput.current?.click()}
            className="rounded-md bg-foreground px-4 py-3 font-medium text-background disabled:opacity-50"
          >
            Take photo
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => libraryInput.current?.click()}
            className="rounded-md border border-foreground/20 px-4 py-3 font-medium disabled:opacity-50"
          >
            Choose from library
          </button>
        </div>
      )}

      {status === "compressing" && <p className="text-foreground/70">Preparing photo…</p>}

      {previewUrl && status !== "done" && (
        // Plain <img> because this is a local blob: URL that next/image can't optimize.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="Meal preview" className="w-full rounded-lg object-cover" />
      )}

      {(status === "ready" || status === "uploading") && (
        <button
          type="button"
          disabled={busy}
          onClick={handleUpload}
          className="rounded-md bg-green-600 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {status === "uploading" ? "Uploading…" : "Upload meal"}
        </button>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {status === "done" && (
        <div className="flex flex-col gap-3">
          <p className="font-medium text-green-600">Saved! Your photo is stored privately.</p>
          {/* Loaded back through /api/photos to prove the private, owner-only route works. */}
          <Image
            src={`/api/photos/${mealId}`}
            alt="Uploaded meal"
            width={1600}
            height={1200}
            unoptimized
            className="h-auto w-full rounded-lg"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setStatus("idle");
                setPhoto(null);
                setPreviewUrl("");
              }}
              className="rounded-md border border-foreground/20 px-4 py-2"
            >
              Snap another
            </button>
            <Link href="/log" className="rounded-md border border-foreground/20 px-4 py-2">
              View log
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
// Pick or take a photo → compress it in the browser → preview → upload → AI analysis.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ACCEPTED_INPUT, MAX_UPLOAD_BYTES } from "@/lib/upload-rules";
import AnalysisResult from "@/components/AnalysisResult";

// Phone photos are often 3–5 MB; ~1600 px is plenty for the AI and the UI.
const COMPRESSION_OPTIONS = {
  maxWidthOrHeight: 1600,
  maxSizeMB: 1,
  fileType: "image/jpeg", // also converts PNG/WebP (and HEIC where the browser can decode it)
  initialQuality: 0.85,
  useWebWorker: true,
};

// POST helper: returns parsed JSON, or throws an Error with a friendly message.
async function postJson(url, body) {
  let res;
  try {
    res = await fetch(url, { method: "POST", body });
  } catch {
    throw new Error("Network error. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || "Something went wrong. Please try again.");
    Object.assign(error, data); // e.g. notFood: true, status: "failed"
    throw error;
  }
  return data;
}

export default function PhotoPicker() {
  const cameraInput = useRef(null);
  const libraryInput = useRef(null);
  const [photo, setPhoto] = useState(null); // compressed JPEG Blob
  const [previewUrl, setPreviewUrl] = useState("");
  // idle → compressing → ready → uploading → analyzing → done | failed
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { items, notes }

  // Free the preview's memory when it's replaced or the component unmounts.
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  function reset(message = "") {
    setStatus("idle");
    setPhoto(null);
    setPreviewUrl("");
    setResult(null);
    setError(message);
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow picking the same file again
    if (!file) return;

    setError("");
    setResult(null);
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
      reset("Couldn't read that photo. Try a JPEG or PNG (on iPhone, Safari handles HEIC photos).");
    }
  }

  async function handleUploadAndAnalyze() {
    if (!photo) return;
    setError("");

    // Step 1: upload. On failure, keep the photo so the user can just retry.
    setStatus("uploading");
    let mealId;
    try {
      const body = new FormData();
      body.append("photo", photo, "meal.jpg");
      ({ id: mealId } = await postJson("/api/meals", body));
    } catch (err) {
      setStatus("ready");
      setError(err.message);
      return;
    }

    // Step 2: analyze. The meal row already exists, so nothing is lost if this fails.
    setStatus("analyzing");
    try {
      const data = await postJson(`/api/meals/${mealId}/analyze`);
      setResult({ items: data.items, notes: data.notes });
      setStatus("done");
    } catch (err) {
      if (err.notFood) {
        reset(err.message); // "No food detected, try another photo."
      } else {
        setStatus("failed");
        setError(err.message);
      }
    }
  }

  const busy = ["compressing", "uploading", "analyzing"].includes(status);
  const showPicker = ["idle", "compressing", "ready"].includes(status);

  return (
    <div className="flex flex-col gap-4">
      {/* Two hidden inputs, triggered by the visible buttons.
          capture="environment" opens the back camera on phones; the second input
          has no capture, so the user can choose an existing photo instead. */}
      <input ref={cameraInput} type="file" accept={ACCEPTED_INPUT} capture="environment" onChange={handleFile} hidden />
      <input ref={libraryInput} type="file" accept={ACCEPTED_INPUT} onChange={handleFile} hidden />

      {showPicker && (
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

      {previewUrl && (
        // Plain <img> because this is a local blob: URL that next/image can't optimize.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Meal preview"
          className={`w-full rounded-lg object-cover ${status === "analyzing" ? "animate-pulse" : ""}`}
        />
      )}

      {(status === "ready" || status === "uploading") && (
        <button
          type="button"
          disabled={busy}
          onClick={handleUploadAndAnalyze}
          className="rounded-md bg-green-600 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {status === "uploading" ? "Uploading…" : "Analyze meal"}
        </button>
      )}

      {status === "analyzing" && (
        <p role="status" className="text-center font-medium">
          Analyzing your meal… this takes a few seconds.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {status === "done" && result && (
        <>
          <h2 className="text-lg font-semibold">Here&apos;s what we found</h2>
          <AnalysisResult items={result.items} notes={result.notes} />
        </>
      )}

      {(status === "done" || status === "failed") && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md border border-foreground/20 px-4 py-2"
          >
            Snap another
          </button>
          <Link href="/log" className="rounded-md border border-foreground/20 px-4 py-2">
            View log
          </Link>
        </div>
      )}
    </div>
  );
}

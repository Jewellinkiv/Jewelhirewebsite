"use client";

import { useRef, useState } from "react";

// Uploads a video straight to Cloudinary from the browser (signed by the server),
// then reports back the delivery URL. Falls back to pasting a URL. Used by the
// course builder for video modules.

export function CloudinaryVideoUpload({ value, onChange, fieldClass }: { value: string; onChange: (url: string) => void; fieldClass: string }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setError("");
    setUploading(true);
    setProgress(0);
    try {
      const sig = await fetch("/api/integrations/cloudinary/sign", { method: "POST" }).then((r) => r.json());
      if (!sig?.cloudName) {
        setError(sig?.error?.message || "Video upload isn't available.");
        setUploading(false);
        return;
      }
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sig.apiKey);
      form.append("timestamp", String(sig.timestamp));
      form.append("folder", sig.folder);
      form.append("signature", sig.signature);

      const url = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `https://api.cloudinary.com/v1_1/${sig.cloudName}/video/upload`);
        xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => {
          try {
            const r = JSON.parse(xhr.responseText);
            r.secure_url ? resolve(r.secure_url) : reject(new Error(r?.error?.message || "Upload failed."));
          } catch {
            reject(new Error("Upload failed."));
          }
        };
        xhr.onerror = () => reject(new Error("Upload failed — check your connection."));
        xhr.send(form);
      });
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    }
    setUploading(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`text-[12.5px] px-3 py-2 rounded-md border ${uploading ? "border-line text-muted cursor-not-allowed" : "btn-grad border-transparent text-white"}`}
        >
          {uploading ? `Uploading… ${progress}%` : value ? "Replace video" : "Upload video"}
        </button>
        {value && !uploading && (
          <a href={value} target="_blank" rel="noreferrer" className="text-[12px] text-primary no-underline hover:underline">✓ Video attached</a>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
      {uploading && (
        <div className="h-1.5 w-full rounded-full bg-[#e6ebf2] overflow-hidden">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…or paste a video URL"
        className={fieldClass}
      />
      {error && <p className="m-0 text-[12px] text-[#a32d2d]">{error}</p>}
    </div>
  );
}

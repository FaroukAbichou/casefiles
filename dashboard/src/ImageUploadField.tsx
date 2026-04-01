import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { uploadImage, type UploadCategory } from "./api";
import { mediaUrl } from "./mediaUrl";

type Props = {
  label: string;
  category: UploadCategory;
  caseStudySlug?: string;
  value: string;
  onChange: (path: string) => void;
};

export default function ImageUploadField({
  label,
  category,
  caseStudySlug,
  value,
  onChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onDrop = useCallback(
    async (files: File[]) => {
      const f = files[0];
      if (!f) return;
      setErr(null);
      setBusy(true);
      try {
        const slug = category === "case-study" ? caseStudySlug : undefined;
        if (category === "case-study" && !slug) {
          throw new Error("Save the case study slug first, then upload");
        }
        const { path } = await uploadImage(f, category, slug);
        onChange(path);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBusy(false);
      }
    },
    [category, caseStudySlug, onChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"] },
    maxFiles: 1,
    disabled: busy || (category === "case-study" && !caseStudySlug),
  });

  const src = mediaUrl(value);
  const blocked = category === "case-study" && !caseStudySlug;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {src ? (
        <div className="overflow-hidden rounded-md border bg-muted/30">
          <img src={src} alt="" className="max-h-44 w-full object-contain object-left" />
        </div>
      ) : null}
      <div
        {...getRootProps()}
        className={`rounded-md border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground transition-colors ${
          isDragActive ? "border-primary bg-muted" : "hover:border-primary/50"
        } ${busy || blocked ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}
      >
        <input {...getInputProps()} />
        {blocked
          ? "Open an existing case study to upload into its assets folder."
          : busy
            ? "Uploading…"
            : isDragActive
              ? "Drop image…"
              : "Drop an image here, or click to choose (JPEG, PNG, WebP, GIF, SVG)"}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-base min-w-0 flex-1 font-mono text-xs"
          placeholder="media/... or https://..."
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Clear
          </button>
        ) : null}
      </div>
      {err ? <p className="text-xs text-destructive">{err}</p> : null}
    </div>
  );
}

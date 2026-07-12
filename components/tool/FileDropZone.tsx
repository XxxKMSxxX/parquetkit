"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface FileDropZoneProps {
  accept: string;
  label: string;
  sublabel?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  /** Called as soon as the user starts picking a file (used to prefetch WASM) */
  onInteract?: () => void;
}

export function FileDropZone({
  accept,
  label,
  sublabel,
  multiple = false,
  onFiles,
  onInteract,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pageDrag, setPageDrag] = useState(false);
  // dragenter/dragleave fire for every child element crossed; only a depth
  // counter reliably tells "left the window" apart from "moved over a child"
  const dragDepth = useRef(0);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      onFiles(Array.from(list));
    },
    [onFiles],
  );

  // The whole page is a drop target: files dropped anywhere land in this zone,
  // and the overlay keeps a stray drop from making the browser open the file
  useEffect(() => {
    const hasFiles = (e: DragEvent) =>
      e.dataTransfer?.types.includes("Files") ?? false;
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current += 1;
      onInteract?.();
      setPageDrag(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current -= 1;
      if (dragDepth.current <= 0) {
        dragDepth.current = 0;
        setPageDrag(false);
      }
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setPageDrag(false);
      handleFiles(e.dataTransfer?.files ?? null);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [handleFiles, onInteract]);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        data-testid="file-drop-zone"
        onClick={() => {
          onInteract?.();
          inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          onInteract?.();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          dragging
            ? "border-sky-500 bg-sky-50 dark:bg-sky-950/30"
            : "border-neutral-300 hover:border-sky-500/70 hover:bg-sky-50/50 dark:border-neutral-700 dark:hover:border-sky-400/60 dark:hover:bg-sky-950/20"
        }`}
      >
        <p className="font-medium">{label}</p>
        {sublabel ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{sublabel}</p>
        ) : null}
        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          Files are processed locally — nothing is uploaded.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          data-testid="file-input"
          onChange={(e) => {
            onInteract?.();
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {pageDrag ? (
        <div
          aria-hidden="true"
          data-testid="page-drop-overlay"
          className="fixed inset-0 z-50 bg-neutral-950/80 p-4 backdrop-blur-sm"
        >
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sky-400">
            <p className="text-lg font-semibold text-neutral-100">
              Drop it anywhere
            </p>
            <p className="text-sm text-neutral-400">
              Processed locally — nothing is uploaded.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

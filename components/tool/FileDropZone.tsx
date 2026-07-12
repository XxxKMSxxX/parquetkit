"use client";

import { useCallback, useRef, useState } from "react";

interface FileDropZoneProps {
  accept: string;
  label: string;
  sublabel?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  /** ユーザーがファイル選択の動作を始めた時点で呼ばれる(WASMプリフェッチ用) */
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

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      onFiles(Array.from(list));
    },
    [onFiles],
  );

  return (
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
  );
}

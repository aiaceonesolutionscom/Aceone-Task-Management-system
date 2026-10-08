"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Download,
  Square,
  Circle,
  MapPin,
  Trash2,
  Check,
  Eye,
  MessageSquare,
  X,
  Send,
  Sparkles,
  Info,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { formatTime12 } from "@/lib/date-utils";

export type Annotation = {
  id: number;
  tool: string;
  x: number;
  y: number;
  width?: number | null;
  height?: number | null;
  comment?: string | null;
  color: string;
  createdAt: string;
  userId?: number;
  user: {
    name: string;
    designation: string | null;
  };
};

const COLOR_OPTIONS = [
  { name: "Red (Issue)", value: "#ef4444", bg: "bg-red-500", text: "text-red-500" },
  { name: "Amber (Question)", value: "#f59e0b", bg: "bg-amber-500", text: "text-amber-500" },
  { name: "Blue (Note)", value: "#3b82f6", bg: "bg-blue-500", text: "text-blue-500" },
  { name: "Emerald (Approved)", value: "#10b981", bg: "bg-emerald-500", text: "text-emerald-500" },
];

export function ImageAnnotationViewer({
  attachmentId,
  fileName,
  fileUrl,
  taskId,
  versionId,
  canAnnotate = true,
}: {
  attachmentId: number;
  fileName: string;
  fileUrl: string;
  taskId: number;
  versionId?: number;
  canAnnotate?: boolean;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [zoom, setZoom] = useState<number>(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);

  // Drawing state
  const [activeTool, setActiveTool] = useState<"SELECT" | "RECTANGLE" | "CIRCLE" | "PIN">("PIN");
  const [activeColor, setActiveColor] = useState<string>("#ef4444");
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Annotation Creation Modal
  const [pendingAnnotation, setPendingAnnotation] = useState<{
    x: number;
    y: number;
    width?: number;
    height?: number;
    tool: string;
  } | null>(null);
  const [annotationComment, setAnnotationComment] = useState("");
  const [savingAnnotation, setSavingAnnotation] = useState(false);

  // Selected Annotation Inspector
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<number | null>(null);
  const [replyInput, setReplyInput] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteAnnId, setConfirmDeleteAnnId] = useState<number | null>(null);
  const [requestingBatchChanges, setRequestingBatchChanges] = useState(false);

  // Load existing annotations
  const loadAnnotations = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tasks/${taskId}/annotations?attachmentId=${attachmentId}`);
      if (res.ok) {
        const data = await res.json();
        setAnnotations(data);
      }
    } catch (err) {
      console.error("Failed to load annotations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnotations();
  }, [taskId, attachmentId]);

  const selectedAnnotation =
    annotations.find((a) => a.id === selectedAnnotationId) || null;

  // Handle Mouse Events for continuous drawing
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canAnnotate || activeTool === "SELECT" || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    if (x < 0 || x > 1 || y < 0 || y > 1) return;

    if (activeTool === "PIN") {
      setPendingAnnotation({ x, y, tool: "PIN" });
      setAnnotationComment("");
      return;
    }

    if (activeTool === "RECTANGLE" || activeTool === "CIRCLE") {
      setIsDrawing(true);
      setStartPos({ x, y });
      setCurrentBox({ x, y, width: 0, height: 0 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !startPos || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const currentY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const x = Math.min(startPos.x, currentX);
    const y = Math.min(startPos.y, currentY);
    const width = Math.abs(currentX - startPos.x);
    const height = Math.abs(currentY - startPos.y);

    setCurrentBox({ x, y, width, height });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentBox) return;
    setIsDrawing(false);

    if (currentBox.width > 0.02 && currentBox.height > 0.02) {
      setPendingAnnotation({
        x: currentBox.x,
        y: currentBox.y,
        width: currentBox.width,
        height: currentBox.height,
        tool: activeTool,
      });
      setAnnotationComment("");
    }
    setCurrentBox(null);
  };

  // Save new annotation (optionally triggering Changes Requested)
  const handleSaveAnnotation = async (
    e?: React.FormEvent,
    requestChanges: boolean = false
  ) => {
    if (e) e.preventDefault();
    if (!pendingAnnotation) return;

    setSavingAnnotation(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attachmentId,
          versionId,
          tool: pendingAnnotation.tool,
          x: pendingAnnotation.x,
          y: pendingAnnotation.y,
          width: pendingAnnotation.width,
          height: pendingAnnotation.height,
          comment: annotationComment.trim() || `Marked annotation #${annotations.length + 1}`,
          color: activeColor,
          requestChanges,
        }),
      });

      if (res.ok) {
        const saved = await res.json();
        const updated = [...annotations, saved];
        setAnnotations(updated);
        setSelectedAnnotationId(saved.id);
        setPendingAnnotation(null);
        setAnnotationComment("");
        if (saved.autoRequestedChanges || requestChanges) {
          toast.success(`Annotation #${updated.length} saved — Task marked as Changes Requested!`);
          router.refresh();
        } else {
          toast.success(`Annotation #${updated.length} saved!`);
        }
        // Keep activeTool unchanged so user can immediately add another annotation!
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to save annotation");
      }
    } catch {
      toast.error("Network error saving annotation");
    } finally {
      setSavingAnnotation(false);
    }
  };

  // Delete annotation
  const handleDeleteAnnotation = async (annId: number) => {
    setDeletingId(annId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/annotations?annotationId=${annId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAnnotations((prev) => prev.filter((a) => a.id !== annId));
        if (selectedAnnotationId === annId) {
          setSelectedAnnotationId(null);
        }
        toast.success("Annotation removed");
      } else {
        toast.error("Failed to remove annotation");
      }
    } catch {
      toast.error("Failed to remove annotation");
    } finally {
      setDeletingId(null);
    }
  };

  // Add follow-up comment to an annotation
  const handleAddReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnnotation || !replyInput.trim()) return;

    const replyText = replyInput.trim();
    setReplyInput("");

    // Post to task comment with annotation context
    try {
      const commentRes = await fetch(`/api/chat/${taskId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: `[Regarding Image Annotation #${
            annotations.findIndex((a) => a.id === selectedAnnotation.id) + 1
          } (${fileName})]: ${replyText}`,
        }),
      });

      if (commentRes.ok) {
        toast.success("Comment posted to task discussion!");
      }
    } catch {
      // Ignore
    }
  };

  // Trigger Save & Request Changes across the task for all annotations
  const handleRequestChangesBatch = async () => {
    setRequestingBatchChanges(true);
    const toastId = toast.loading("Submitting revision request...", {
      description: "Marking task status as CHANGES_REQUESTED and notifying team...",
    });
    try {
      const summaryText =
        annotations.length > 0
          ? `Visual review markup placed on deliverable (${annotations.length} pins). Please review annotations and submit revised version.`
          : "Reviewer requested changes on deliverable.";

      const res = await fetch(`/api/tasks/${taskId}/annotations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: summaryText }),
      });

      if (res.ok) {
        toast.success("Task updated to Changes Requested!", {
          id: toastId,
          description: `All ${annotations.length} visual markup pin(s) submitted for revision.`,
        });
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to update task status", { id: toastId });
      }
    } catch {
      toast.error("Network error updating task status", { id: toastId });
    } finally {
      setRequestingBatchChanges(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden flex flex-col ${
        fullscreen ? "fixed inset-0 z-50 rounded-none h-screen" : "min-h-[580px]"
      }`}
    >
      {/* Top Header Bar */}
      <div className="bg-neutral-900 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 text-white text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-neutral-200 truncate">{fileName}</span>
          <span className="text-[11px] font-mono font-bold bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded border border-neutral-700">
            {annotations.length} annotation{annotations.length !== 1 ? "s" : ""}
          </span>
          {canAnnotate && (
            <span className="text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded font-medium hidden sm:inline-block">
              Multiple Annotations Enabled
            </span>
          )}
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Tool Selector */}
          {canAnnotate && (
            <div className="flex items-center gap-1 bg-neutral-800 p-1 rounded-lg border border-neutral-700">
              <button
                type="button"
                onClick={() => setActiveTool("PIN")}
                className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] font-semibold transition-all ${
                  activeTool === "PIN"
                    ? "bg-red-600 text-white shadow-xs"
                    : "text-neutral-400 hover:text-white"
                }`}
                title="Point Pin (Click anywhere to mark)"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Pin</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool("RECTANGLE")}
                className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] font-semibold transition-all ${
                  activeTool === "RECTANGLE"
                    ? "bg-red-600 text-white shadow-xs"
                    : "text-neutral-400 hover:text-white"
                }`}
                title="Box Rectangle (Click & drag over area)"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Box</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool("CIRCLE")}
                className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] font-semibold transition-all ${
                  activeTool === "CIRCLE"
                    ? "bg-red-600 text-white shadow-xs"
                    : "text-neutral-400 hover:text-white"
                }`}
                title="Circle (Click & drag over area)"
              >
                <Circle className="w-3.5 h-3.5" />
                <span>Circle</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool("SELECT")}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                  activeTool === "SELECT"
                    ? "bg-neutral-600 text-white shadow-xs"
                    : "text-neutral-400 hover:text-white"
                }`}
                title="Inspect mode (Click pins to view notes)"
              >
                Inspect
              </button>
            </div>
          )}

          {/* Color Picker */}
          {canAnnotate && activeTool !== "SELECT" && (
            <div className="flex items-center gap-1 px-1.5 py-1 bg-neutral-800 rounded-lg border border-neutral-700">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setActiveColor(c.value)}
                  className={`w-4 h-4 rounded-full ${c.bg} transition-transform ${
                    activeColor === c.value ? "scale-125 ring-2 ring-white" : "opacity-60 hover:opacity-100"
                  }`}
                  title={c.name}
                />
              ))}
            </div>
          )}

          <div className="h-4 w-[1px] bg-neutral-800 mx-1" />

          {/* Zoom controls */}
          <button
            type="button"
            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
            className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono text-neutral-400 w-9 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom(Math.min(3, zoom + 0.25))}
            className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="px-2 py-1 text-[11px] font-semibold rounded hover:bg-neutral-800 text-neutral-400 hover:text-white"
          >
            Fit
          </button>

          <div className="h-4 w-[1px] bg-neutral-800 mx-1" />

          {/* Download Original File */}
          <a
            href={`${fileUrl}?download=1`}
            download={fileName}
            className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white"
            title="Download file"
          >
            <Download className="w-3.5 h-3.5" />
          </a>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={() => setFullscreen(!fullscreen)}
            className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white"
            title="Toggle fullscreen"
          >
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Helpful Mode Banner */}
      {canAnnotate && activeTool !== "SELECT" && (
        <div className="bg-neutral-900/90 px-4 py-1.5 border-b border-neutral-800/80 text-[11px] text-neutral-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-red-400" />
            <span>
              <strong>Continuous Mode Active:</strong> Click or drag on the image below to place{" "}
              <strong>Annotation #{annotations.length + 1}</strong>. Tool stays active for multiple marks!
            </span>
          </span>
          <span className="text-[10px] text-neutral-500">Press ESC or click Inspect to view notes</span>
        </div>
      )}

      {/* Main Visual Workspace: Canvas + Right Annotation List */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left: Image Canvas with Overlay Annotations */}
        <div
          className="flex-1 overflow-auto p-4 flex items-center justify-center relative select-none bg-neutral-950/80"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ cursor: activeTool === "SELECT" ? "default" : "crosshair" }}
        >
          <div
            className="relative inline-block transition-transform duration-100 ease-out"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
          >
            {/* Image */}
            <img
              ref={imageRef}
              src={fileUrl}
              alt={fileName}
              draggable={false}
              className="max-h-[520px] w-auto object-contain block rounded shadow-2xl"
            />

            {/* Render all saved annotations (#1, #2, #3, ...) */}
            {annotations.map((ann, idx) => {
              const isSelected = selectedAnnotationId === ann.id;
              const color = ann.color || "#ef4444";

              if (ann.tool === "RECTANGLE" && ann.width && ann.height) {
                return (
                  <div
                    key={ann.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAnnotationId(isSelected ? null : ann.id);
                    }}
                    style={{
                      left: `${ann.x * 100}%`,
                      top: `${ann.y * 100}%`,
                      width: `${ann.width * 100}%`,
                      height: `${ann.height * 100}%`,
                      borderColor: color,
                      backgroundColor: `${color}25`,
                    }}
                    className={`absolute border-2 cursor-pointer transition-all ${
                      isSelected
                        ? "ring-4 ring-white shadow-lg z-30"
                        : "hover:ring-2 hover:ring-white/50 z-20"
                    }`}
                  >
                    <span
                      style={{ backgroundColor: color }}
                      className="absolute -top-3.5 -left-3.5 w-6 h-6 rounded-full text-white font-bold text-xs flex items-center justify-center shadow-md ring-2 ring-white"
                    >
                      {idx + 1}
                    </span>
                  </div>
                );
              }

              if (ann.tool === "CIRCLE" && ann.width && ann.height) {
                return (
                  <div
                    key={ann.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAnnotationId(isSelected ? null : ann.id);
                    }}
                    style={{
                      left: `${ann.x * 100}%`,
                      top: `${ann.y * 100}%`,
                      width: `${ann.width * 100}%`,
                      height: `${ann.height * 100}%`,
                      borderColor: color,
                      backgroundColor: `${color}25`,
                    }}
                    className={`absolute border-2 rounded-full cursor-pointer transition-all ${
                      isSelected
                        ? "ring-4 ring-white shadow-lg z-30"
                        : "hover:ring-2 hover:ring-white/50 z-20"
                    }`}
                  >
                    <span
                      style={{ backgroundColor: color }}
                      className="absolute -top-3 -left-3 w-6 h-6 rounded-full text-white font-bold text-xs flex items-center justify-center shadow-md ring-2 ring-white"
                    >
                      {idx + 1}
                    </span>
                  </div>
                );
              }

              // PIN Tool
              return (
                <div
                  key={ann.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAnnotationId(isSelected ? null : ann.id);
                  }}
                  style={{
                    left: `${ann.x * 100}%`,
                    top: `${ann.y * 100}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20 group"
                >
                  <div
                    style={{ backgroundColor: color }}
                    className={`w-7 h-7 rounded-full text-white flex items-center justify-center shadow-lg font-bold text-xs ring-2 ring-white transition-transform ${
                      isSelected ? "scale-125 ring-4" : "group-hover:scale-110"
                    }`}
                  >
                    {idx + 1}
                  </div>
                </div>
              );
            })}

            {/* Currently Drawing Box / Circle Preview */}
            {currentBox && (
              <div
                style={{
                  left: `${currentBox.x * 100}%`,
                  top: `${currentBox.y * 100}%`,
                  width: `${currentBox.width * 100}%`,
                  height: `${currentBox.height * 100}%`,
                  borderColor: activeColor,
                  borderRadius: activeTool === "CIRCLE" ? "9999px" : "4px",
                }}
                className="absolute border-2 border-dashed bg-white/10 pointer-events-none"
              />
            )}
          </div>
        </div>

        {/* Right Side: Multiple Annotations List & Thread Drawer (Col 4) */}
        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-neutral-800 bg-neutral-900 flex flex-col max-h-[350px] md:max-h-none">
          <div className="p-3 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-red-500" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Annotation Notes ({annotations.length})
              </h3>
            </div>
            {selectedAnnotation && (
              <button
                type="button"
                onClick={() => setSelectedAnnotationId(null)}
                className="text-[11px] text-neutral-400 hover:text-white"
              >
                Deselect
              </button>
            )}
          </div>

          {/* Annotations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-800/80 p-2 space-y-1">
            {annotations.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-400 space-y-1">
                <Info className="w-6 h-6 text-neutral-500 mx-auto" />
                <p className="font-semibold text-neutral-300">No annotations yet</p>
                <p className="text-[11px]">
                  Select Box or Pin above, then click on the image to mark revisions.
                </p>
              </div>
            ) : (
              annotations.map((ann, idx) => {
                const isSelected = selectedAnnotationId === ann.id;
                const color = ann.color || "#ef4444";

                return (
                  <div
                    key={ann.id}
                    onClick={() => setSelectedAnnotationId(ann.id)}
                    className={`p-2.5 rounded-lg cursor-pointer transition-all flex flex-col gap-1 border ${
                      isSelected
                        ? "bg-neutral-800 border-red-500 shadow-sm ring-1 ring-red-500/40"
                        : "bg-neutral-950/40 border-neutral-800/60 hover:bg-neutral-800/60 hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          style={{ backgroundColor: color }}
                          className="w-5 h-5 rounded-full text-white font-bold text-[10px] flex items-center justify-center shrink-0 ring-1 ring-white/50"
                        >
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-neutral-200">
                          {ann.user.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-neutral-400">
                          {formatTime12(ann.createdAt)}
                        </span>
                        {canAnnotate && (
                          <button
                            type="button"
                            disabled={deletingId === ann.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteAnnId(ann.id);
                            }}
                            className="p-1 text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
                            title="Delete annotation"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-neutral-300 pl-7 leading-relaxed whitespace-pre-wrap">
                      {ann.comment || "Marked area on image"}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Comment / Discussion Box on Selected Annotation */}
          {selectedAnnotation && (
            <div className="p-3 border-t border-neutral-800 bg-neutral-950 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-neutral-400">
                <span>
                  Reply to Annotation #
                  {annotations.findIndex((a) => a.id === selectedAnnotation.id) + 1}
                </span>
                <span className="text-neutral-500">Posts to task discussion</span>
              </div>
              <form onSubmit={handleAddReply} className="flex gap-1.5">
                <input
                  type="text"
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value)}
                  placeholder="Write a comment or reply..."
                  className="flex-1 px-2.5 py-1.5 text-xs bg-neutral-900 border border-neutral-700 rounded text-white focus:outline-none focus:border-red-500"
                />
                <button
                  type="submit"
                  disabled={!replyInput.trim()}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                </button>
              </form>
            </div>
          )}

          {/* Action Footer: Save & Request Changes on Task */}
          {canAnnotate && (
            <div className="p-3 border-t border-neutral-800 bg-neutral-950 space-y-2 mt-auto">
              <button
                type="button"
                disabled={requestingBatchChanges}
                onClick={handleRequestChangesBatch}
                className="w-full py-2.5 px-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ring-1 ring-rose-500"
                title="Save review and mark task as Changes Requested"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {requestingBatchChanges
                    ? "Updating Task Status..."
                    : annotations.length > 0
                    ? `Save & Request Changes (${annotations.length} Pins)`
                    : "Save & Request Changes"}
                </span>
              </button>
              <p className="text-[10px] text-neutral-400 text-center leading-tight">
                {annotations.length > 0
                  ? `Submits all ${annotations.length} visual pins & alerts assignee to revise work.`
                  : "Marks task as Changes Requested & requests new version."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal / Dialog when an annotation mark is placed */}
      {pendingAnnotation && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-md w-full p-4 space-y-3 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <div className="flex items-center gap-2">
                <span
                  style={{ backgroundColor: activeColor }}
                  className="w-5 h-5 rounded-full text-white font-bold text-xs flex items-center justify-center ring-1 ring-white"
                >
                  {annotations.length + 1}
                </span>
                <h3 className="text-xs font-bold text-white">
                  Add Note for Annotation #{annotations.length + 1}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingAnnotation(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAnnotation} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] text-neutral-400 font-semibold block">
                  Describe what needs to be changed or reviewed:
                </label>
                <textarea
                  value={annotationComment}
                  onChange={(e) => setAnnotationComment(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="e.g. Logo contrast is too low; please increase brightness by 15%..."
                  className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-700 rounded text-white focus:outline-none focus:border-red-500 resize-none"
                />
              </div>

              {/* Color selector */}
              <div className="space-y-1">
                <label className="text-[11px] text-neutral-400 font-semibold block">
                  Tag Color:
                </label>
                <div className="flex items-center gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setActiveColor(c.value)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] border transition-all ${
                        activeColor === c.value
                          ? "bg-neutral-800 border-white text-white font-bold"
                          : "border-neutral-800 text-neutral-400 hover:bg-neutral-800"
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${c.bg}`} />
                      <span>{c.name.split(" ")[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setPendingAnnotation(null)}
                  className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={savingAnnotation}
                    onClick={(e) => handleSaveAnnotation(e, false)}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 disabled:opacity-50 text-neutral-200 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Save this annotation note without changing task status"
                  >
                    <Check className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Save Annotation</span>
                  </button>
                  <button
                    type="button"
                    disabled={savingAnnotation}
                    onClick={(e) => handleSaveAnnotation(e, true)}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer ring-1 ring-rose-500"
                    title="Save annotation and mark task status as Changes Requested"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Save & Request Changes</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Annotation */}
      {confirmDeleteAnnId !== null && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-white animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-rose-500">
              <Trash2 className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-white">
                Delete Annotation #{annotations.findIndex((a) => a.id === confirmDeleteAnnId) + 1}?
              </h3>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Are you sure you want to delete this visual annotation marker and its comments? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setConfirmDeleteAnnId(null)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingId !== null}
                onClick={() => {
                  const idToDelete = confirmDeleteAnnId;
                  setConfirmDeleteAnnId(null);
                  handleDeleteAnnotation(idToDelete);
                }}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

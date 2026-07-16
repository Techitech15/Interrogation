import type { EmotionState } from "../core/types";

const SILHOUETTE_COLOR = "#2a261c";
const EYE_COLOR = "#f4e6b8";

type SuspectPose = EmotionState | "collapsed";

interface EmotionVisual {
  eyeAlpha: number;
  pupilScaleY: number;
  jitter: boolean;
}

interface EyeRegion {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

interface PoseEyes {
  leftEye: EyeRegion;
  rightEye: EyeRegion;
}

interface EyeMetadata {
  poses: Record<SuspectPose, PoseEyes>;
}

const POSES: readonly SuspectPose[] = ["calm", "shaken", "hardened", "collapsed"];

const EMOTION_VISUALS: Record<EmotionState, EmotionVisual> = {
  calm: { eyeAlpha: 1, pupilScaleY: 1, jitter: false },
  shaken: { eyeAlpha: 0.6, pupilScaleY: 1.3, jitter: true },
  hardened: { eyeAlpha: 0.4, pupilScaleY: 0.6, jitter: false },
};

const DEFAULT_EYES: EyeMetadata = {
  poses: {
    calm: {
      leftEye: { cx: 0.47, cy: 0.26, rx: 0.018, ry: 0.006 },
      rightEye: { cx: 0.53, cy: 0.26, rx: 0.018, ry: 0.006 },
    },
    shaken: {
      leftEye: { cx: 0.468, cy: 0.27, rx: 0.019, ry: 0.008 },
      rightEye: { cx: 0.532, cy: 0.27, rx: 0.019, ry: 0.008 },
    },
    hardened: {
      leftEye: { cx: 0.47, cy: 0.25, rx: 0.018, ry: 0.0045 },
      rightEye: { cx: 0.53, cy: 0.25, rx: 0.018, ry: 0.0045 },
    },
    collapsed: {
      leftEye: { cx: 0.47, cy: 0.4, rx: 0.016, ry: 0.005 },
      rightEye: { cx: 0.53, cy: 0.4, rx: 0.016, ry: 0.005 },
    },
  },
};

export interface SuspectView {
  setSuspect(suspectId: string): void;
  setEmotion(emotion: EmotionState): void;
  playBreakdown(): Promise<void>;
  resetPose(): void;
  destroy(): void;
}

function assetUrl(relativePath: string): string {
  return `${import.meta.env.BASE_URL}${relativePath}`;
}

function isEyeRegion(value: unknown): value is EyeRegion {
  if (typeof value !== "object" || value === null) return false;
  const region = value as Partial<EyeRegion>;
  return [region.cx, region.cy, region.rx, region.ry].every(
    (part) => typeof part === "number" && Number.isFinite(part),
  );
}

function parseEyeMetadata(value: unknown): EyeMetadata | null {
  if (typeof value !== "object" || value === null || !("poses" in value)) return null;
  const poses = (value as { poses?: unknown }).poses;
  if (typeof poses !== "object" || poses === null) return null;

  const parsed = {} as Record<SuspectPose, PoseEyes>;
  for (const pose of POSES) {
    const candidate = (poses as Record<string, unknown>)[pose];
    if (typeof candidate !== "object" || candidate === null) return null;
    const pair = candidate as Partial<PoseEyes>;
    if (!isEyeRegion(pair.leftEye) || !isEyeRegion(pair.rightEye)) return null;
    parsed[pose] = { leftEye: pair.leftEye, rightEye: pair.rightEye };
  }
  return { poses: parsed };
}

/** Procedural fallback while an image is loading or if an asset cannot be read. */
function drawFallbackBody(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  ctx.fillStyle = SILHOUETTE_COLOR;
  const headCenterX = width / 2;
  const headCenterY = height * 0.28;
  ctx.beginPath();
  ctx.ellipse(headCenterX, headCenterY, width * 0.14, height * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(headCenterX - width * 0.16, height * 0.42);
  ctx.lineTo(headCenterX + width * 0.16, height * 0.42);
  ctx.lineTo(headCenterX + width * 0.36, height);
  ctx.lineTo(headCenterX - width * 0.36, height);
  ctx.closePath();
  ctx.fill();
}

function drawEyes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  eyes: PoseEyes,
  alpha: number,
  pupilScaleY: number,
): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = EYE_COLOR;
  ctx.shadowColor = EYE_COLOR;
  ctx.shadowBlur = 6;

  for (const eye of [eyes.leftEye, eyes.rightEye]) {
    ctx.beginPath();
    ctx.ellipse(
      eye.cx * width,
      eye.cy * height,
      eye.rx * width,
      eye.ry * height * pupilScaleY,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
}

export function createSuspectView(container: HTMLElement, initialSuspectId: string): SuspectView {
  const canvas = document.createElement("canvas");
  canvas.className = "suspect-canvas";
  canvas.width = 480;
  canvas.height = 640;
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  let emotion: EmotionState = "calm";
  let poseOverride: SuspectPose | null = null;
  let eyeMetadata = DEFAULT_EYES;
  let images = new Map<SuspectPose, HTMLImageElement>();
  let assetGeneration = 0;
  let rafId: number | null = null;
  let destroyed = false;
  let breakdownAlphaOverride: number | null = null;

  function currentPose(): SuspectPose {
    return poseOverride ?? emotion;
  }

  function setWrapEmotionClass(nextEmotion: EmotionState): void {
    container.classList.remove("emotion-calm", "emotion-shaken", "emotion-hardened");
    container.classList.add(`emotion-${nextEmotion}`);
  }

  function render(jitterOffsetX: number, jitterOffsetY: number): void {
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(jitterOffsetX, jitterOffsetY);

    const pose = currentPose();
    const image = images.get(pose);
    if (image?.complete && image.naturalWidth > 0) {
      ctx.drawImage(image, 0, 0, width, height);
    } else {
      drawFallbackBody(ctx, width, height);
    }

    const visual = EMOTION_VISUALS[emotion];
    const alpha = breakdownAlphaOverride ?? visual.eyeAlpha;
    drawEyes(ctx, width, height, eyeMetadata.poses[pose], alpha, visual.pupilScaleY);
    ctx.restore();
  }

  function loop(timeMs: number): void {
    if (destroyed) return;
    const visual = EMOTION_VISUALS[emotion];
    const jitterX = visual.jitter ? Math.sin(timeMs / 60) : 0;
    const jitterY = visual.jitter ? Math.cos(timeMs / 90) : 0;
    render(jitterX, jitterY);
    rafId = window.requestAnimationFrame(loop);
  }

  function startLoop(): void {
    if (rafId !== null || destroyed) return;
    render(0, 0);
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return;
    rafId = window.requestAnimationFrame(loop);
  }

  function stopLoop(): void {
    if (
      rafId !== null &&
      typeof window !== "undefined" &&
      typeof window.cancelAnimationFrame === "function"
    ) {
      window.cancelAnimationFrame(rafId);
    }
    rafId = null;
  }

  function loadSuspectAssets(suspectId: string): void {
    const generation = ++assetGeneration;
    const caseId = suspectId.replace(/^suspect-/, "case-");
    const nextImages = new Map<SuspectPose, HTMLImageElement>();
    eyeMetadata = DEFAULT_EYES;
    poseOverride = null;
    breakdownAlphaOverride = null;

    for (const pose of POSES) {
      const image = new Image();
      image.decoding = "async";
      image.addEventListener("load", () => {
        if (generation === assetGeneration && !destroyed) render(0, 0);
      });
      image.src = assetUrl(
        `assets/cases/${caseId}/${suspectId}-pose-${pose}.png`,
      );
      nextImages.set(pose, image);
    }
    images = nextImages;

    void fetch(assetUrl(`assets/cases/${caseId}/${suspectId}-eyes.json`))
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("eyes"))))
      .then((value: unknown) => {
        const parsed = parseEyeMetadata(value);
        if (parsed && generation === assetGeneration && !destroyed) {
          eyeMetadata = parsed;
          render(0, 0);
        }
      })
      .catch(() => {
        // file:// builds may not allow fetch; the typed defaults keep the view usable.
      });
  }

  setWrapEmotionClass(emotion);
  loadSuspectAssets(initialSuspectId);
  startLoop();

  return {
    setSuspect(suspectId: string): void {
      loadSuspectAssets(suspectId);
      startLoop();
    },

    setEmotion(nextEmotion: EmotionState): void {
      emotion = nextEmotion;
      setWrapEmotionClass(nextEmotion);
      startLoop();
    },

    async playBreakdown(): Promise<void> {
      stopLoop();
      poseOverride = "collapsed";
      const durationMs = 1000;
      const startAlpha = EMOTION_VISUALS[emotion].eyeAlpha;
      const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();

      return new Promise((resolve) => {
        function step(): void {
          if (destroyed) {
            resolve();
            return;
          }
          const now = typeof performance !== "undefined" ? performance.now() : Date.now();
          const progress = Math.min(1, (now - startTime) / durationMs);
          breakdownAlphaOverride = startAlpha * (1 - progress);
          render(0, 0);

          if (progress >= 1) {
            resolve();
            return;
          }
          if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
            window.requestAnimationFrame(step);
          } else {
            resolve();
          }
        }
        step();
      });
    },

    resetPose(): void {
      poseOverride = null;
      breakdownAlphaOverride = null;
      startLoop();
    },

    destroy(): void {
      destroyed = true;
      assetGeneration += 1;
      stopLoop();
      canvas.remove();
    },
  };
}

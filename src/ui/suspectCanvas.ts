// SCR-04 容疑者シルエット表現(設計書 3.4節)。
// `.placeholder-silhouette` のCSS版に代わるCanvas描画。
// シルエット本体(仮アセット・後日画像差し替え予定) + 目の光レイヤーを
// `EmotionState` に応じて制御する。
//
// requestAnimationFrame はブラウザ環境専用。node/vitest環境では
// createSuspectView() を呼ばない前提とし、型チェックのみを対象とする。

import type { EmotionState } from "../core/types";

const SILHOUETTE_COLOR = "#2a261c";
const BACKGROUND_COLOR = "transparent";

interface EmotionVisual {
  eyeAlpha: number;
  pupilScaleY: number;
  tiltDegrees: number;
  jitter: boolean;
}

const EMOTION_VISUALS: Record<EmotionState, EmotionVisual> = {
  calm: { eyeAlpha: 1.0, pupilScaleY: 1.0, tiltDegrees: 0, jitter: false },
  shaken: { eyeAlpha: 0.6, pupilScaleY: 1.3, tiltDegrees: 3, jitter: true },
  hardened: { eyeAlpha: 0.4, pupilScaleY: 0.6, tiltDegrees: -2, jitter: false },
};

export interface SuspectView {
  setEmotion(emotion: EmotionState): void;
  playBreakdown(): Promise<void>;
  destroy(): void;
}

/** シルエット本体(頭+肩の台形程度の仮アセット)を描画する。 */
function drawSilhouetteBody(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.fillStyle = SILHOUETTE_COLOR;

  // 頭部(楕円)
  const headCenterX = width / 2;
  const headCenterY = height * 0.28;
  const headRadiusX = width * 0.14;
  const headRadiusY = height * 0.16;
  ctx.beginPath();
  ctx.ellipse(headCenterX, headCenterY, headRadiusX, headRadiusY, 0, 0, Math.PI * 2);
  ctx.fill();

  // 肩(台形)
  const shoulderTopY = height * 0.42;
  const shoulderTopHalfWidth = width * 0.16;
  const shoulderBottomHalfWidth = width * 0.36;
  ctx.beginPath();
  ctx.moveTo(headCenterX - shoulderTopHalfWidth, shoulderTopY);
  ctx.lineTo(headCenterX + shoulderTopHalfWidth, shoulderTopY);
  ctx.lineTo(headCenterX + shoulderBottomHalfWidth, height);
  ctx.lineTo(headCenterX - shoulderBottomHalfWidth, height);
  ctx.closePath();
  ctx.fill();
}

/** 目(横長の楕円光点)を描画する。alphaとpupilScaleYで光量・瞳孔を制御する。 */
function drawEyes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  alpha: number,
  pupilScaleY: number,
): void {
  const eyeY = height * 0.26;
  const eyeOffsetX = width * 0.055;
  const eyeRadiusX = width * 0.035;
  const eyeRadiusY = height * 0.012 * pupilScaleY;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = "#f4e6b8";
  ctx.shadowColor = "#f4e6b8";
  ctx.shadowBlur = 6;

  for (const sign of [-1, 1] as const) {
    const eyeX = width / 2 + sign * eyeOffsetX;
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * `container` の中に容疑者シルエットCanvasを生成し、感情状態に応じた
 * 目の光・姿勢傾き演出を行う制御ハンドルを返す。
 */
export function createSuspectView(container: HTMLElement): SuspectView {
  const canvas = document.createElement("canvas");
  canvas.className = "suspect-canvas";
  canvas.width = 480;
  canvas.height = 640;
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");

  let emotion: EmotionState = "calm";
  let rafId: number | null = null;
  let destroyed = false;
  let breakdownAlphaOverride: number | null = null;

  function render(jitterOffsetX: number, jitterOffsetY: number): void {
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = BACKGROUND_COLOR;

    const visual = EMOTION_VISUALS[emotion];
    const tiltRadians = (visual.tiltDegrees * Math.PI) / 180;

    ctx.save();
    ctx.translate(width / 2 + jitterOffsetX, height / 2 + jitterOffsetY);
    ctx.rotate(tiltRadians);
    ctx.translate(-width / 2, -height / 2);

    drawSilhouetteBody(ctx, width, height);

    const alpha = breakdownAlphaOverride ?? visual.eyeAlpha;
    drawEyes(ctx, width, height, alpha, visual.pupilScaleY);

    ctx.restore();
  }

  function loop(timeMs: number): void {
    if (destroyed) return;
    const visual = EMOTION_VISUALS[emotion];
    let jitterX = 0;
    let jitterY = 0;
    if (visual.jitter) {
      // ±1px程度の微振動。
      jitterX = Math.sin(timeMs / 60) * 1;
      jitterY = Math.cos(timeMs / 90) * 1;
    }
    render(jitterX, jitterY);
    rafId = window.requestAnimationFrame(loop);
  }

  function startLoop(): void {
    if (rafId !== null || destroyed) return;
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      render(0, 0);
      return;
    }
    rafId = window.requestAnimationFrame(loop);
  }

  function stopLoop(): void {
    if (rafId !== null && typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(rafId);
    }
    rafId = null;
  }

  startLoop();

  return {
    setEmotion(nextEmotion: EmotionState): void {
      emotion = nextEmotion;
      breakdownAlphaOverride = null;
      // playBreakdown() stops the loop; resume it so future emotion changes
      // (including jitter for "shaken") keep animating.
      startLoop();
    },

    async playBreakdown(): Promise<void> {
      stopLoop();
      const durationMs = 1000;
      const startAlpha = EMOTION_VISUALS[emotion].eyeAlpha;
      const startTime =
        typeof performance !== "undefined" ? performance.now() : Date.now();

      return new Promise((resolve) => {
        function step(): void {
          if (destroyed) {
            resolve();
            return;
          }
          const now = typeof performance !== "undefined" ? performance.now() : Date.now();
          const elapsed = now - startTime;
          const progress = Math.min(1, elapsed / durationMs);
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

    destroy(): void {
      destroyed = true;
      stopLoop();
      canvas.remove();
    },
  };
}

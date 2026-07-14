// AudioContext管理と公開API。
// Web Audio API による手続き生成SE/BGM(外部音源ファイル一切不使用)。
// window/AudioContextが存在しない環境(vitest/node)では全APIが安全にno-opになる。

import type { BgmPreset } from "./bgmPresets";
import { bgmPresets } from "./bgmPresets";
import type { SeLayer, SePreset } from "./sePresets";
import { sePresets } from "./sePresets";

export type SeName =
  | "question_send" // 質問送信: 短いタイプ音/クリック
  | "testimony_appear" // 供述表示: 紙をめくるようなノイズ
  | "confront_select" // 追及対象選択: 低い緊張音
  | "confront_success" // 矛盾成立: 鋭いスティング(最重要)
  | "confront_fail" // 追及失敗: 鈍い不協和音
  | "clock_advance" // 時計進行: 秒針的なチック
  | "ending_true" // 自白エンド: 解決感のある短いフレーズ
  | "ending_bad" // 冤罪エンド: 不穏な下降音
  | "ending_released"; // 釈放エンド: 曖昧で余韻のある音

export type BgmName = "interrogation" | "tension" | "silence";

interface ActiveBgm {
  name: BgmName;
  bgmGain: GainNode;
  sources: AudioScheduledSourceNode[];
}

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let currentBgm: ActiveBgm | null = null;
let muted = false;
let cachedNoiseBuffer: AudioBuffer | null = null;

/** window.AudioContext (Safari向けwebkitAudioContextフォールバック込み) を取得する。存在しなければundefined。 */
function getAudioContextCtor(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as typeof window & { webkitAudioContext?: typeof AudioContext };
  return w.AudioContext ?? w.webkitAudioContext;
}

/** 初回ユーザー操作で呼ぶ。AudioContextを生成し、suspended状態ならresumeする。 */
export function initAudio(): void {
  const Ctor = getAudioContextCtor();
  if (!Ctor) return;

  if (!ctx) {
    ctx = new Ctor();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(ctx.destination);
  }

  if (ctx.state === "suspended") {
    void ctx.resume();
  }
}

export function isAudioReady(): boolean {
  return ctx !== null && masterGain !== null;
}

/** 白色ノイズの共有バッファ(2秒、ループ再生前提)を遅延生成してキャッシュする。 */
function getNoiseBuffer(context: AudioContext): AudioBuffer {
  if (cachedNoiseBuffer) return cachedNoiseBuffer;
  const length = Math.max(1, Math.floor(context.sampleRate * 2));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  cachedNoiseBuffer = buffer;
  return buffer;
}

/** ADSR風エンベロープをAudioParamへ書き込み、リリース完了時刻(=発音終了時刻)を返す。 */
function applyEnvelope(
  param: AudioParam,
  startAt: number,
  envelope: SeLayer["envelope"],
  peak: number,
): number {
  const attack = Math.max(0, envelope.attack);
  const decay = Math.max(0, envelope.decay);
  const sustainLevel = Math.min(1, Math.max(0, envelope.sustain));
  const release = Math.max(0, envelope.release);
  const holdEnd = startAt + Math.max(envelope.duration, attack + decay);

  param.cancelScheduledValues(startAt);
  param.setValueAtTime(0, startAt);
  param.linearRampToValueAtTime(peak, startAt + attack);
  param.linearRampToValueAtTime(peak * sustainLevel, startAt + attack + decay);
  param.setValueAtTime(peak * sustainLevel, holdEnd);
  param.linearRampToValueAtTime(0, holdEnd + release);
  return holdEnd + release;
}

/** SePresetの1レイヤーをノード化してスケジュール再生する(発音後は自動でstopし解放される)。 */
function scheduleSeLayer(context: AudioContext, destination: AudioNode, layer: SeLayer, baseStart: number): void {
  const layerStart = baseStart + Math.max(0, layer.delay ?? 0);
  const gainNode = context.createGain();
  gainNode.connect(destination);
  const endTime = applyEnvelope(gainNode.gain, layerStart, layer.envelope, layer.gain);

  if (layer.kind === "osc") {
    const osc = context.createOscillator();
    osc.type = layer.type;
    osc.frequency.setValueAtTime(layer.frequency, layerStart);
    if (layer.frequencyEnd !== undefined) {
      osc.frequency.linearRampToValueAtTime(layer.frequencyEnd, layerStart + layer.envelope.duration);
    }
    if (layer.detune !== undefined) {
      osc.detune.setValueAtTime(layer.detune, layerStart);
    }
    osc.connect(gainNode);
    osc.start(layerStart);
    osc.stop(endTime + 0.05);
  } else {
    const source = context.createBufferSource();
    source.buffer = getNoiseBuffer(context);
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = layer.filterType;
    filter.frequency.setValueAtTime(layer.filterFrequency, layerStart);
    if (layer.filterQ !== undefined) {
      filter.Q.setValueAtTime(layer.filterQ, layerStart);
    }
    source.connect(filter);
    filter.connect(gainNode);
    source.start(layerStart);
    source.stop(endTime + 0.05);
  }
}

/** 未init時は何もしない(例外を投げない)。 */
export function playSe(name: SeName): void {
  if (!ctx || !masterGain) return;
  const preset: SePreset | undefined = sePresets[name];
  if (!preset) return;

  if (preset.stopBgmFirst) {
    stopBgm(0);
  }

  const startAt = ctx.currentTime + Math.max(0, preset.leadSilence ?? 0);
  for (const layer of preset.layers) {
    scheduleSeLayer(ctx, masterGain, layer, startAt);
  }
}

/** BgmPresetからドローン・LFO・ノイズ一式を組み立てて再生開始する。 */
function startBgmInternal(context: AudioContext, destination: GainNode, name: BgmName, preset: BgmPreset): ActiveBgm {
  const now = context.currentTime;
  const bgmGain = context.createGain();
  bgmGain.gain.setValueAtTime(0, now);
  bgmGain.gain.linearRampToValueAtTime(preset.baseGain, now + Math.max(0.01, preset.fadeInSeconds));
  bgmGain.connect(destination);

  const sources: AudioScheduledSourceNode[] = [];

  for (const drone of preset.drones) {
    const osc = context.createOscillator();
    osc.type = drone.type;
    osc.frequency.setValueAtTime(drone.frequency, now);
    osc.detune.setValueAtTime(drone.detune, now);
    const droneGain = context.createGain();
    droneGain.gain.value = drone.gain;
    osc.connect(droneGain);
    droneGain.connect(bgmGain);
    osc.start(now);
    sources.push(osc);
  }

  if (preset.lfoFrequency > 0 && preset.lfoDepth > 0) {
    // LFOはbgmGain.gainパラメータへ直結し、既存の自動化値へ加算(振幅変調)する形で明滅を作る。
    const lfo = context.createOscillator();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(preset.lfoFrequency, now);
    const lfoGain = context.createGain();
    lfoGain.gain.value = preset.baseGain * preset.lfoDepth;
    lfo.connect(lfoGain);
    lfoGain.connect(bgmGain.gain);
    lfo.start(now);
    sources.push(lfo);
  }

  if (preset.noise) {
    const noiseSource = context.createBufferSource();
    noiseSource.buffer = getNoiseBuffer(context);
    noiseSource.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = preset.noise.filterType;
    filter.frequency.setValueAtTime(preset.noise.filterFrequency, now);
    if (preset.noise.filterQ !== undefined) {
      filter.Q.setValueAtTime(preset.noise.filterQ, now);
    }
    const noiseGain = context.createGain();
    noiseGain.gain.value = preset.noise.gain;
    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(bgmGain);
    noiseSource.start(now);
    sources.push(noiseSource);
  }

  return { name, bgmGain, sources };
}

/** ループBGM開始。既に同名再生中なら何もしない。未init時は何もしない。 */
export function startBgm(name: BgmName): void {
  if (!ctx || !masterGain) return;
  if (currentBgm && currentBgm.name === name) return;

  if (currentBgm) {
    stopBgm(0.2);
  }

  const preset = bgmPresets[name];
  currentBgm = startBgmInternal(ctx, masterGain, name, preset);
}

/** BGM停止(デフォルト0.5秒フェード)。未init時/未再生時は何もしない。 */
export function stopBgm(fadeOutSeconds = 0.5): void {
  if (!ctx || !currentBgm) return;

  const { bgmGain, sources } = currentBgm;
  const now = ctx.currentTime;
  const fade = Math.max(0, fadeOutSeconds);

  bgmGain.gain.cancelScheduledValues(now);
  bgmGain.gain.setValueAtTime(bgmGain.gain.value, now);
  if (fade > 0) {
    bgmGain.gain.linearRampToValueAtTime(0, now + fade);
  } else {
    bgmGain.gain.setValueAtTime(0, now);
  }

  const stopAt = now + fade + 0.05;
  for (const source of sources) {
    try {
      source.stop(stopAt);
    } catch {
      // 既に停止済み等は無視する
    }
  }

  currentBgm = null;
}

/** ミュート切り替え。マスターゲインを短時間でランプする(クリックノイズ防止)。 */
export function setMuted(mutedValue: boolean): void {
  muted = mutedValue;
  if (!ctx || !masterGain) return;

  const now = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(masterGain.gain.value, now);
  masterGain.gain.linearRampToValueAtTime(muted ? 0 : 1, now + 0.05);
}

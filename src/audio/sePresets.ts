// SE(効果音)の純粋データ定義。
// Web Audio APIのノードは一切生成しない。値の解釈・ノード生成は engine.ts が担う。
// 昭和の取調室・書類フォルダ風の暗い緊張感を基調に、
// confront_success のみ逆転裁判の「異議あり」的なカタルシスを狙った鋭いスティングにする。

import type { SeName } from "./engine";

export type OscType = "sine" | "triangle" | "square" | "sawtooth";
export type FilterType = "lowpass" | "highpass" | "bandpass";

/** ADSR風エンベロープ。durationはattack+decay終了からrelease開始までの保持時間(秒)。 */
export interface Envelope {
  /** 立ち上がり時間(秒) */
  attack: number;
  /** 減衰時間(秒) */
  decay: number;
  /** サステインレベル(0〜1、ピーク音量に対する比率) */
  sustain: number;
  /** リリース時間(秒) */
  release: number;
  /** attack+decay完了からreleaseが始まるまでの保持時間(秒)。attack+decay以上であること。 */
  duration: number;
}

interface LayerBase {
  /** 発音の全体ピーク音量(0〜1) */
  gain: number;
  /** SE発音開始からのレイヤー個別の遅延(秒)。フレーズ表現に使う。省略時0。 */
  delay?: number;
  envelope: Envelope;
}

export interface OscLayer extends LayerBase {
  kind: "osc";
  type: OscType;
  /** 開始周波数(Hz) */
  frequency: number;
  /** 指定時、envelope.duration の時間をかけて frequency からこの周波数へ直線的に推移する */
  frequencyEnd?: number;
  /** デチューン量(セント) */
  detune?: number;
}

export interface NoiseLayer extends LayerBase {
  kind: "noise";
  filterType: FilterType;
  filterFrequency: number;
  filterQ?: number;
}

export type SeLayer = OscLayer | NoiseLayer;

export interface SePreset {
  layers: SeLayer[];
  /** 発音前の無音時間(秒)。confront_success の「一拍の間」に使用。省略時0。 */
  leadSilence?: number;
  /** trueの場合、再生前に stopBgm(0) を呼びBGMを即座に止める。 */
  stopBgmFirst?: boolean;
}

export const sePresets: Record<SeName, SePreset> = {
  // 質問送信: タイプライターの短いクリック音
  question_send: {
    layers: [
      {
        kind: "noise",
        filterType: "bandpass",
        filterFrequency: 3200,
        filterQ: 6,
        gain: 0.5,
        envelope: { attack: 0.001, decay: 0.02, sustain: 0, release: 0.03, duration: 0.025 },
      },
      {
        kind: "osc",
        type: "square",
        frequency: 1400,
        gain: 0.18,
        envelope: { attack: 0.001, decay: 0.015, sustain: 0, release: 0.02, duration: 0.02 },
      },
    ],
  },

  // 供述表示: 紙をめくるようなノイズ
  testimony_appear: {
    layers: [
      {
        kind: "noise",
        filterType: "bandpass",
        filterFrequency: 2500,
        filterQ: 1.2,
        gain: 0.35,
        envelope: { attack: 0.02, decay: 0.08, sustain: 0.3, release: 0.15, duration: 0.18 },
      },
      {
        kind: "noise",
        filterType: "highpass",
        filterFrequency: 4000,
        filterQ: 0.8,
        gain: 0.15,
        delay: 0.05,
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.2, release: 0.2, duration: 0.2 },
      },
    ],
  },

  // 追及対象選択: 低い緊張音
  confront_select: {
    layers: [
      {
        kind: "osc",
        type: "triangle",
        frequency: 90,
        frequencyEnd: 130,
        gain: 0.28,
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.7, release: 0.3, duration: 0.5 },
      },
      {
        kind: "osc",
        type: "sine",
        frequency: 45,
        gain: 0.15,
        envelope: { attack: 0.08, decay: 0.1, sustain: 0.6, release: 0.35, duration: 0.5 },
      },
    ],
  },

  // 矛盾成立: 鋭いスティング(最重要のカタルシス)。BGMを即停止し一拍の無音を挟んでから鳴らす。
  confront_success: {
    stopBgmFirst: true,
    leadSilence: 0.4,
    layers: [
      {
        kind: "osc",
        type: "square",
        frequency: 660,
        gain: 0.3,
        envelope: { attack: 0.002, decay: 0.05, sustain: 0.6, release: 0.25, duration: 0.12 },
      },
      {
        kind: "osc",
        type: "square",
        frequency: 880,
        gain: 0.28,
        delay: 0.03,
        envelope: { attack: 0.002, decay: 0.05, sustain: 0.6, release: 0.3, duration: 0.14 },
      },
      {
        kind: "osc",
        type: "triangle",
        frequency: 1320,
        gain: 0.18,
        delay: 0.05,
        envelope: { attack: 0.001, decay: 0.04, sustain: 0.4, release: 0.35, duration: 0.1 },
      },
      {
        kind: "noise",
        filterType: "highpass",
        filterFrequency: 6000,
        filterQ: 1,
        gain: 0.2,
        envelope: { attack: 0.001, decay: 0.06, sustain: 0.2, release: 0.4, duration: 0.08 },
      },
    ],
  },

  // 追及失敗: 鈍い不協和音(近接周波数のビートで濁らせる)
  confront_fail: {
    layers: [
      {
        kind: "osc",
        type: "triangle",
        frequency: 110,
        gain: 0.3,
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.4, duration: 0.35 },
      },
      {
        kind: "osc",
        type: "triangle",
        frequency: 116,
        gain: 0.28,
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.4, duration: 0.35 },
      },
      {
        kind: "noise",
        filterType: "lowpass",
        filterFrequency: 500,
        filterQ: 0.6,
        gain: 0.25,
        envelope: { attack: 0.01, decay: 0.08, sustain: 0.3, release: 0.3, duration: 0.2 },
      },
    ],
  },

  // 時計進行: 秒針的なチック
  clock_advance: {
    layers: [
      {
        kind: "noise",
        filterType: "bandpass",
        filterFrequency: 2600,
        filterQ: 8,
        gain: 0.22,
        envelope: { attack: 0.001, decay: 0.01, sustain: 0, release: 0.015, duration: 0.015 },
      },
    ],
  },

  // 自白エンド: 解決感のある短い上行フレーズ
  ending_true: {
    layers: [
      {
        kind: "osc",
        type: "sine",
        frequency: 440,
        gain: 0.22,
        envelope: { attack: 0.01, decay: 0.05, sustain: 0.5, release: 0.15, duration: 0.18 },
      },
      {
        kind: "osc",
        type: "sine",
        frequency: 550,
        gain: 0.22,
        delay: 0.18,
        envelope: { attack: 0.01, decay: 0.05, sustain: 0.5, release: 0.2, duration: 0.18 },
      },
      {
        kind: "osc",
        type: "sine",
        frequency: 660,
        gain: 0.26,
        delay: 0.36,
        envelope: { attack: 0.01, decay: 0.06, sustain: 0.6, release: 0.5, duration: 0.3 },
      },
    ],
  },

  // 冤罪エンド: 不穏な下降音
  ending_bad: {
    layers: [
      {
        kind: "osc",
        type: "sawtooth",
        frequency: 420,
        frequencyEnd: 90,
        gain: 0.22,
        envelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 0.6, duration: 1.0 },
      },
      {
        kind: "osc",
        type: "sine",
        frequency: 60,
        gain: 0.18,
        delay: 0.1,
        envelope: { attack: 0.05, decay: 0.3, sustain: 0.6, release: 0.8, duration: 1.0 },
      },
      {
        kind: "noise",
        filterType: "lowpass",
        filterFrequency: 300,
        filterQ: 0.5,
        gain: 0.12,
        delay: 0.2,
        envelope: { attack: 0.1, decay: 0.3, sustain: 0.3, release: 0.6, duration: 0.8 },
      },
    ],
  },

  // 釈放エンド: 曖昧で余韻のある音(不協和寄りの近接音程を長いリリースで鳴らす)
  ending_released: {
    layers: [
      {
        kind: "osc",
        type: "sine",
        frequency: 330,
        gain: 0.16,
        envelope: { attack: 0.3, decay: 0.2, sustain: 0.5, release: 1.2, duration: 0.8 },
      },
      {
        kind: "osc",
        type: "sine",
        frequency: 370,
        gain: 0.14,
        delay: 0.05,
        envelope: { attack: 0.35, decay: 0.2, sustain: 0.5, release: 1.4, duration: 0.8 },
      },
      {
        kind: "noise",
        filterType: "bandpass",
        filterFrequency: 1800,
        filterQ: 0.7,
        gain: 0.08,
        delay: 0.1,
        envelope: { attack: 0.4, decay: 0.3, sustain: 0.3, release: 1.5, duration: 0.75 },
      },
    ],
  },
};

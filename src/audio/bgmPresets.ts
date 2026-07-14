// BGM(ループ楽曲)の純粋データ定義。
// ノード生成は engine.ts が担う。低いドローン+ゆっくりした明滅(LFO)を基本構造とする。

import type { BgmName } from "./engine";
import type { FilterType, OscType } from "./sePresets";

export interface BgmDrone {
  type: OscType;
  /** 周波数(Hz) */
  frequency: number;
  /** デチューン量(セント)。複数ドローンを僅かにずらし僅かなうねりを作る */
  detune: number;
  /** このドローン単体のゲイン係数(0〜1) */
  gain: number;
}

export interface BgmNoise {
  filterType: FilterType;
  filterFrequency: number;
  filterQ?: number;
  /** バス全体(baseGain)に対する相対ゲイン(0〜1) */
  gain: number;
}

export interface BgmPreset {
  /** 常時鳴らすドローン群 */
  drones: BgmDrone[];
  /** 音量を揺らすLFOの周波数(Hz)。0以下ならLFOなし。 */
  lfoFrequency: number;
  /** LFOによる音量変調の深さ(0〜1、baseGainに対する比率) */
  lfoDepth: number;
  /** 目標音量(バス全体のゲイン) */
  baseGain: number;
  /** 微かなノイズ質感(tension/silence用) */
  noise?: BgmNoise;
  /** 開始時のフェードイン時間(秒) */
  fadeInSeconds: number;
}

export const bgmPresets: Record<BgmName, BgmPreset> = {
  // 通常尋問: 50〜60Hz付近のsine2つを僅かにデチューンした低いドローン。8秒周期のゆっくりした明滅。
  interrogation: {
    drones: [
      { type: "sine", frequency: 55, detune: 0, gain: 0.6 },
      { type: "sine", frequency: 55, detune: 6, gain: 0.6 },
    ],
    lfoFrequency: 0.125, // 8秒周期
    lfoDepth: 0.4,
    baseGain: 0.06,
    fadeInSeconds: 1.5,
  },

  // 動揺演出: interrogationより半音上、速い明滅、微かな高周波ノイズ。
  tension: {
    drones: [
      { type: "sine", frequency: 58.27, detune: 0, gain: 0.6 }, // 55Hzの半音上
      { type: "sine", frequency: 58.27, detune: 8, gain: 0.6 },
    ],
    lfoFrequency: 0.6,
    lfoDepth: 0.5,
    baseGain: 0.07,
    noise: {
      filterType: "highpass",
      filterFrequency: 5000,
      filterQ: 0.7,
      gain: 0.015,
    },
    fadeInSeconds: 0.8,
  },

  // 供述崩壊演出用: 完全無音ではなく、ごく微かなルームノイズのみ。
  silence: {
    drones: [],
    lfoFrequency: 0,
    lfoDepth: 0,
    baseGain: 0.02,
    noise: {
      filterType: "lowpass",
      filterFrequency: 800,
      filterQ: 0.5,
      gain: 0.4,
    },
    fadeInSeconds: 2.0,
  },
};

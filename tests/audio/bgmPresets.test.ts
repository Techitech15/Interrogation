import { describe, expect, it } from "vitest";
import type { BgmName } from "../../src/audio/engine";
import { bgmPresets } from "../../src/audio/bgmPresets";

const ALL_BGM_NAMES: BgmName[] = ["interrogation", "tension", "silence"];

describe("bgmPresets", () => {
  it("defines a preset for every BgmName", () => {
    for (const name of ALL_BGM_NAMES) {
      expect(bgmPresets[name]).toBeDefined();
    }
    expect(Object.keys(bgmPresets).sort()).toEqual([...ALL_BGM_NAMES].sort());
  });

  it("keeps baseGain, fadeInSeconds and lfo parameters within valid, positive ranges", () => {
    for (const name of ALL_BGM_NAMES) {
      const preset = bgmPresets[name];
      expect(preset.baseGain).toBeGreaterThan(0);
      expect(preset.fadeInSeconds).toBeGreaterThan(0);
      expect(preset.lfoFrequency).toBeGreaterThanOrEqual(0);
      expect(preset.lfoDepth).toBeGreaterThanOrEqual(0);
      expect(preset.lfoDepth).toBeLessThanOrEqual(1);
    }
  });

  it("keeps every drone's frequency positive and gain within (0,1]", () => {
    for (const name of ALL_BGM_NAMES) {
      for (const drone of bgmPresets[name].drones) {
        expect(drone.frequency).toBeGreaterThan(0);
        expect(drone.gain).toBeGreaterThan(0);
        expect(drone.gain).toBeLessThanOrEqual(1);
      }
    }
  });

  it("keeps optional noise texture filter frequency positive and gain within (0,1]", () => {
    for (const name of ALL_BGM_NAMES) {
      const noise = bgmPresets[name].noise;
      if (!noise) continue;
      expect(noise.filterFrequency).toBeGreaterThan(0);
      expect(noise.gain).toBeGreaterThan(0);
      expect(noise.gain).toBeLessThanOrEqual(1);
      if (noise.filterQ !== undefined) {
        expect(noise.filterQ).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the interrogation drone pair near 50-60Hz and only lightly detuned", () => {
    const { drones } = bgmPresets.interrogation;
    expect(drones.length).toBeGreaterThanOrEqual(2);
    for (const drone of drones) {
      expect(drone.frequency).toBeGreaterThanOrEqual(50);
      expect(drone.frequency).toBeLessThanOrEqual(60);
    }
  });

  it("keeps tension's drone frequency a semitone above interrogation's", () => {
    const interrogationFreq = bgmPresets.interrogation.drones[0]!.frequency;
    const tensionFreq = bgmPresets.tension.drones[0]!.frequency;
    const expectedSemitoneUp = interrogationFreq * 2 ** (1 / 12);
    expect(tensionFreq).toBeCloseTo(expectedSemitoneUp, 1);
  });

  it("gives tension a faster gain LFO than interrogation (quicker flicker)", () => {
    expect(bgmPresets.tension.lfoFrequency).toBeGreaterThan(bgmPresets.interrogation.lfoFrequency);
  });

  it("keeps interrogation's volume restrained (~0.06)", () => {
    expect(bgmPresets.interrogation.baseGain).toBeLessThanOrEqual(0.1);
  });

  it("gives silence no tonal drones, only a faint room-noise texture", () => {
    expect(bgmPresets.silence.drones.length).toBe(0);
    expect(bgmPresets.silence.noise).toBeDefined();
  });
});

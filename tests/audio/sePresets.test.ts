import { describe, expect, it } from "vitest";
import type { SeName } from "../../src/audio/engine";
import { sePresets } from "../../src/audio/sePresets";

const ALL_SE_NAMES: SeName[] = [
  "question_send",
  "testimony_appear",
  "confront_select",
  "confront_success",
  "confront_fail",
  "clock_advance",
  "ending_true",
  "ending_bad",
  "ending_released",
];

describe("sePresets", () => {
  it("defines a preset for every SeName", () => {
    for (const name of ALL_SE_NAMES) {
      expect(sePresets[name]).toBeDefined();
    }
    expect(Object.keys(sePresets).sort()).toEqual([...ALL_SE_NAMES].sort());
  });

  it("gives every preset at least one layer", () => {
    for (const name of ALL_SE_NAMES) {
      expect(sePresets[name].layers.length).toBeGreaterThan(0);
    }
  });

  it("keeps every layer's envelope and gain within valid, positive ranges", () => {
    for (const name of ALL_SE_NAMES) {
      for (const layer of sePresets[name].layers) {
        expect(layer.gain).toBeGreaterThan(0);
        expect(layer.gain).toBeLessThanOrEqual(1);

        const { attack, decay, sustain, release, duration } = layer.envelope;
        expect(attack).toBeGreaterThanOrEqual(0);
        expect(decay).toBeGreaterThanOrEqual(0);
        expect(release).toBeGreaterThanOrEqual(0);
        expect(duration).toBeGreaterThan(0);
        expect(sustain).toBeGreaterThanOrEqual(0);
        expect(sustain).toBeLessThanOrEqual(1);
        // duration must be able to hold the attack+decay ramp before release begins.
        expect(duration).toBeGreaterThanOrEqual(attack + decay);

        if (layer.delay !== undefined) {
          expect(layer.delay).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("keeps oscillator frequencies positive", () => {
    for (const name of ALL_SE_NAMES) {
      for (const layer of sePresets[name].layers) {
        if (layer.kind === "osc") {
          expect(layer.frequency).toBeGreaterThan(0);
          if (layer.frequencyEnd !== undefined) {
            expect(layer.frequencyEnd).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("keeps noise layer filter frequencies positive", () => {
    for (const name of ALL_SE_NAMES) {
      for (const layer of sePresets[name].layers) {
        if (layer.kind === "noise") {
          expect(layer.filterFrequency).toBeGreaterThan(0);
          if (layer.filterQ !== undefined) {
            expect(layer.filterQ).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("only marks confront_success with stopBgmFirst + leadSilence for the catharsis beat", () => {
    expect(sePresets.confront_success.stopBgmFirst).toBe(true);
    expect(sePresets.confront_success.leadSilence).toBeGreaterThan(0);

    for (const name of ALL_SE_NAMES) {
      if (name === "confront_success") continue;
      expect(sePresets[name].stopBgmFirst).toBeFalsy();
    }
  });
});

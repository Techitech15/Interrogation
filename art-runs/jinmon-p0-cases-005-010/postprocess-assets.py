from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
RUN = ROOT / "art-runs" / "jinmon-p0-cases-005-010"
POSE_NAMES = ("calm", "shaken", "hardened", "collapsed")
EYE_Y = {
    "005": {"calm": 0.255, "shaken": 0.285, "hardened": 0.265, "collapsed": 0.37},
    "006": {"calm": 0.255, "shaken": 0.28, "hardened": 0.265, "collapsed": 0.36},
    "007": {"calm": 0.255, "shaken": 0.275, "hardened": 0.265, "collapsed": 0.35},
    "008": {"calm": 0.255, "shaken": 0.285, "hardened": 0.27, "collapsed": 0.36},
    "009": {"calm": 0.255, "shaken": 0.285, "hardened": 0.27, "collapsed": 0.35},
    "010": {"calm": 0.255, "shaken": 0.285, "hardened": 0.275, "collapsed": 0.355},
}
EYE_X = {
    "010": {
        "shaken": (0.495, 0.545),
        "hardened": (0.49, 0.54),
        "collapsed": (0.495, 0.545),
    },
}


def eyes_for_pose(
    cy: float,
    pose: str,
    centers: tuple[float, float] | None = None,
) -> dict[str, dict[str, float]]:
    shaken = pose == "shaken"
    hardened = pose == "hardened"
    collapsed = pose == "collapsed"
    rx = 0.016 if collapsed else 0.019 if shaken else 0.018
    ry = 0.0045 if hardened else 0.008 if shaken else 0.005 if collapsed else 0.006
    left_cx, right_cx = centers or ((0.468, 0.532) if shaken else (0.47, 0.53))
    return {
        "leftEye": {"cx": left_cx, "cy": cy, "rx": rx, "ry": ry},
        "rightEye": {"cx": right_cx, "cy": cy, "rx": rx, "ry": ry},
    }


def write_case(case_number: str) -> None:
    case_id = f"case-{case_number}"
    suspect_id = f"suspect-{case_number}"
    destination = ROOT / "public" / "assets" / "cases" / case_id
    destination.mkdir(parents=True, exist_ok=True)
    prompt = (RUN / "prompts" / f"{case_id}-silhouettes.prompt.txt").read_text(encoding="utf-8")

    for index, pose in enumerate(POSE_NAMES, start=1):
        source = Image.open(RUN / "processed" / case_id / f"pose-{index}.png").convert("RGBA")
        canvas = Image.new("RGBA", (900, 1200), (0, 0, 0, 0))
        canvas.alpha_composite(source, (0, 150))
        base_name = f"{suspect_id}-pose-{pose}"
        output = destination / f"{base_name}.png"
        palette = canvas.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        palette.save(output, format="PNG", optimize=True, compress_level=9)
        (destination / f"{base_name}.prompt.txt").write_text(prompt, encoding="utf-8")

    poses = {
        pose: eyes_for_pose(
            EYE_Y[case_number][pose],
            pose,
            EYE_X.get(case_number, {}).get(pose),
        )
        for pose in POSE_NAMES
    }
    (destination / f"{suspect_id}-eyes.json").write_text(
        json.dumps({"poses": poses}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    for case_number in ("005", "006", "007", "008", "009", "010"):
        write_case(case_number)


if __name__ == "__main__":
    main()

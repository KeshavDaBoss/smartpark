import argparse
import json
import os
from collections import Counter

import cv2
import numpy as np

try:
    from PIL import Image
    HAS_PIL = True
except Exception:
    Image = None
    HAS_PIL = False

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
    HAS_HEIF_SUPPORT = True
except Exception:
    HAS_HEIF_SUPPORT = False


HIST_BINS_H = 24
HIST_BINS_S = 24


def _walk_images(folder):
    allowed_ext = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    files = []
    if not os.path.isdir(folder):
        return files
    for root, _, names in os.walk(folder):
        for name in names:
            ext = os.path.splitext(name)[1].lower()
            if ext in allowed_ext:
                files.append(os.path.join(root, name))
    return sorted(files)


def _read_image_any(path):
    img = cv2.imread(path)
    if img is not None:
        return img
    if HAS_PIL:
        try:
            with Image.open(path) as pil_img:
                rgb = pil_img.convert("RGB")
                arr = np.array(rgb)
            return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
        except Exception:
            return None
    return None


def _apply_gray_world(image):
    if image is None or image.size == 0:
        return image
    img = image.astype(np.float32)
    channel_means = img.reshape(-1, 3).mean(axis=0)
    gray_mean = float(np.mean(channel_means))
    scales = gray_mean / (channel_means + 1e-6)
    balanced = img * scales
    return np.clip(balanced, 0, 255).astype(np.uint8)


def _compute_hsv_histogram(image):
    if image is None or image.size == 0:
        return None
    corrected = _apply_gray_world(image)
    hsv = cv2.cvtColor(corrected, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    s = cv2.equalizeHist(s)
    v = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(v)
    hsv = cv2.merge([h, s, v])
    hist = cv2.calcHist([hsv], [0, 1], None, [HIST_BINS_H, HIST_BINS_S], [0, 180, 0, 256])
    hist = cv2.normalize(hist, hist).flatten().astype(np.float32)
    return hist


def audit_dataset(root):
    cars_dir = os.path.join(root, "Cars")
    not_cars_dir = os.path.join(root, "Not cars")

    cars = _walk_images(cars_dir)
    not_cars = _walk_images(not_cars_dir)

    def stats(paths):
        ext_counts = Counter(os.path.splitext(p)[1].lower() for p in paths)
        return {
            "total": len(paths),
            "extensions": dict(sorted(ext_counts.items())),
        }

    cars_stats = stats(cars)
    not_cars_stats = stats(not_cars)

    ratio = None
    if not_cars_stats["total"] > 0:
        ratio = round(cars_stats["total"] / float(not_cars_stats["total"]), 2)

    print("Dataset audit")
    print("=============")
    print(f"Cars folder: {cars_dir}")
    print(f"Not cars folder: {not_cars_dir}")
    print(f"Cars total: {cars_stats['total']}")
    print(f"Cars extensions: {cars_stats['extensions']}")
    print(f"Not cars total: {not_cars_stats['total']}")
    print(f"Not cars extensions: {not_cars_stats['extensions']}")
    print(f"Cars/Not-cars ratio: {ratio}")

    if not_cars_stats["total"] == 0:
        print("WARNING: No negative samples found. Add Not cars images.")
    elif ratio is not None and ratio > 4.0:
        target = max(0, cars_stats["total"] // 3 - not_cars_stats["total"])
        print("WARNING: Dataset is imbalanced. Detection may over-predict cars.")
        print(f"Suggested minimum additional Not cars images: {target}")


def train_dataset(root, output_npz, output_manifest):
    cars_dir = os.path.join(root, "Cars")
    not_cars_dir = os.path.join(root, "Not cars")

    cars_files = _walk_images(cars_dir)
    not_cars_files = _walk_images(not_cars_dir)

    cars_hists = []
    not_cars_hists = []
    cars_unreadable = 0
    not_cars_unreadable = 0

    for path in cars_files:
        img = _read_image_any(path)
        hist = _compute_hsv_histogram(img)
        if hist is None:
            cars_unreadable += 1
            continue
        cars_hists.append(hist)

    for path in not_cars_files:
        img = _read_image_any(path)
        hist = _compute_hsv_histogram(img)
        if hist is None:
            not_cars_unreadable += 1
            continue
        not_cars_hists.append(hist)

    pos = np.stack(cars_hists, axis=0) if cars_hists else np.empty((0, HIST_BINS_H * HIST_BINS_S), dtype=np.float32)
    neg = np.stack(not_cars_hists, axis=0) if not_cars_hists else np.empty((0, HIST_BINS_H * HIST_BINS_S), dtype=np.float32)

    os.makedirs(os.path.dirname(output_npz), exist_ok=True)
    np.savez_compressed(
        output_npz,
        positive_refs=pos,
        negative_refs=neg,
        hist_bins_h=np.array([HIST_BINS_H], dtype=np.int32),
        hist_bins_s=np.array([HIST_BINS_S], dtype=np.int32),
    )

    manifest = {
        "dataset_root": os.path.abspath(root),
        "cars_files": len(cars_files),
        "not_cars_files": len(not_cars_files),
        "cars_refs": int(pos.shape[0]),
        "not_cars_refs": int(neg.shape[0]),
        "cars_unreadable": cars_unreadable,
        "not_cars_unreadable": not_cars_unreadable,
        "has_pil": HAS_PIL,
        "has_heif_support": HAS_HEIF_SUPPORT,
        "hist_bins": [HIST_BINS_H, HIST_BINS_S],
        "output_npz": os.path.abspath(output_npz),
    }

    with open(output_manifest, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print("Training complete")
    print("=================")
    print(f"Cars refs: {manifest['cars_refs']} / {manifest['cars_files']}")
    print(f"Not cars refs: {manifest['not_cars_refs']} / {manifest['not_cars_files']}")
    print(f"Unreadable: cars={cars_unreadable}, not_cars={not_cars_unreadable}")
    print(f"HEIF support: {HAS_HEIF_SUPPORT}")
    print(f"Saved refs: {os.path.abspath(output_npz)}")
    print(f"Saved manifest: {os.path.abspath(output_manifest)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SmartPark dataset audit helper")
    parser.add_argument("--root", default=os.path.join(os.path.dirname(__file__), "..", "dataset"), help="Dataset root path")
    parser.add_argument("--mode", choices=["audit", "train"], default="audit", help="Operation mode")
    parser.add_argument("--output-npz", default=os.path.join(os.path.dirname(__file__), "dataset_refs.npz"), help="Path to save trained histogram references")
    parser.add_argument("--output-manifest", default=os.path.join(os.path.dirname(__file__), "dataset_refs_manifest.json"), help="Path to save training manifest")
    args = parser.parse_args()

    dataset_root = os.path.abspath(args.root)
    if args.mode == "audit":
        audit_dataset(dataset_root)
    else:
        train_dataset(dataset_root, os.path.abspath(args.output_npz), os.path.abspath(args.output_manifest))

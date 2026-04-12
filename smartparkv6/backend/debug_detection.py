#!/usr/bin/env python3
"""
Debug script to test car detection on a specific image.
Usage: python debug_detection.py <image_path>
"""

import sys
import os
import numpy as np
import cv2

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from camera_detector import (
    load_yolo_model, detect_vehicle_boxes,
    YOLO_MODEL_PATH, DATASET_REFS_PATH,
    DETECTION_CONFIDENCE, MIN_PATCH_SIDE,
    HIST_TOPK, HIST_POS_THRESHOLD, HIST_MARGIN_THRESHOLD,
    HIST_HIGHCONF_THRESHOLD, HIST_HIGHCONF_MARGIN,
)

def main():
    if len(sys.argv) < 2:
        print("Usage: python debug_detection.py <image_path>")
        sys.exit(1)
    
    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print(f"Error: Image not found: {image_path}")
        sys.exit(1)
    
    # Load image
    frame = cv2.imread(image_path)
    if frame is None:
        print(f"Error: Could not read image: {image_path}")
        sys.exit(1)
    
    frame = cv2.resize(frame, (640, 480))
    
    # CRITICAL: Load refs BEFORE testing
    from camera_detector import _load_dataset_refs
    print("Pre-loading histogram references...")
    _load_dataset_refs()
    print("References loaded.\n")
    
    print(f"\n{'='*60}")
    print(f"Testing car detection on: {image_path}")
    print(f"Image size: {frame.shape}")
    print(f"{'='*60}\n")
    
    # Load model
    print(f"Loading YOLO model: {YOLO_MODEL_PATH}")
    model = load_yolo_model()
    if model is None:
        print("ERROR: Could not load YOLO model!")
        sys.exit(1)
    
    # Detect
    print(f"\nRunning detection...")
    print(f"  DETECTION_CONFIDENCE: {DETECTION_CONFIDENCE}")
    print(f"  MIN_PATCH_SIDE: {MIN_PATCH_SIDE}")
    print(f"  HIST_POS_THRESHOLD: {HIST_POS_THRESHOLD}")
    print(f"  HIST_MARGIN_THRESHOLD: {HIST_MARGIN_THRESHOLD}")
    print(f"  HIST_HIGHCONF_THRESHOLD: {HIST_HIGHCONF_THRESHOLD}")
    print(f"  HIST_HIGHCONF_MARGIN: {HIST_HIGHCONF_MARGIN}")
    print(f"  HIST_TOPK: {HIST_TOPK}\n")
    
    boxes, debug_info = detect_vehicle_boxes(frame, model)
    
    print(f"\nDetection Results:")
    print(f"  Accepted boxes: {len(boxes)}")
    print(f"  Candidate detections: {len(debug_info)}")
    
    if len(debug_info) == 0:
        print("\n❌ NO DETECTIONS AT ALL from YOLO!")
        print("   The YOLO model didn't find any vehicles.")
    else:
        print("\n" + "="*60)
        print("CANDIDATE ANALYSIS")
        print("="*60)
        for i, dbg in enumerate(debug_info):
            print(f"\nCandidate #{i+1}:")
            print(f"  Class ID: {dbg.get('class_id')}")
            print(f"  YOLO Confidence: {dbg.get('confidence'):.4f}")
            print(f"  Pos Score: {dbg.get('pos_score'):.4f}")
            print(f"  Neg Score: {dbg.get('neg_score'):.4f}")
            print(f"  Margin: {dbg.get('margin'):.4f}")
            print(f"  Box: {dbg.get('box')}")
            print(f"  Rule: {dbg.get('rule')}")
            accepted = dbg.get('accepted')
            print(f"  Status: {'✓ ACCEPTED' if accepted else '✗ REJECTED'}")
            
            if not accepted:
                rule = dbg.get('rule')
                if rule == "patch_too_small":
                    print(f"    → Box too small (min={MIN_PATCH_SIDE}px)")
                elif rule == "rejected_by_hist":
                    pos = dbg.get('pos_score')
                    margin = dbg.get('margin')
                    conf = dbg.get('confidence')
                    print(f"    → Both rules failed:")
                    print(f"      Primary: pos_score={pos:.4f} >= {HIST_POS_THRESHOLD} ? {pos >= HIST_POS_THRESHOLD}")
                    print(f"               margin={margin:.4f} >= {HIST_MARGIN_THRESHOLD} ? {margin >= HIST_MARGIN_THRESHOLD}")
                    print(f"      Highconf: yolo_conf={conf:.4f} >= {HIST_HIGHCONF_THRESHOLD} ? {conf >= HIST_HIGHCONF_THRESHOLD}")
                    print(f"                margin={margin:.4f} >= {HIST_HIGHCONF_MARGIN} ? {margin >= HIST_HIGHCONF_MARGIN}")
    
    print("\n" + "="*60)
    print("RECOMMENDATIONS")
    print("="*60)
    
    if len(debug_info) == 0:
        print("\n1. YOLO model is not detecting vehicles at all.")
        print("   - Check YOLO_MODEL_PATH and vehicle class IDs")
        print("   - Generate debug images to visualize YOLO predictions")
    else:
        rejected_count = sum(1 for d in debug_info if not d.get('accepted'))
        if rejected_count == len(debug_info):
            print("\n2. All YOLO detections are being filtered by histogram matching.")
            print("   Consider lowering thresholds or disabling histogram filtering:")
            print(f"\n   Current thresholds:")
            print(f"     HIST_POS_THRESHOLD = {HIST_POS_THRESHOLD}")
            print(f"     HIST_MARGIN_THRESHOLD = {HIST_MARGIN_THRESHOLD}")
            print(f"     HIST_HIGHCONF_THRESHOLD = {HIST_HIGHCONF_THRESHOLD}")
            print(f"\n   Try adjusting these in camera_detector.py or via env vars:")
            print(f"     export SMARTPARK_HIST_POS_THRESHOLD=0.10")
            print(f"     export SMARTPARK_HIST_MARGIN_THRESHOLD=0.00")
            print(f"     export SMARTPARK_HIST_HIGHCONF_THRESHOLD=0.30")

if __name__ == "__main__":
    main()

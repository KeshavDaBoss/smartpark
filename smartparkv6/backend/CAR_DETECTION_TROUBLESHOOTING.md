# SmartPark Car Detection — Troubleshooting & Testing

## The Issue
Car detection was returning **0 cars detected**, even when showing photos of cars or toy cars directly.

## Root Cause
The system uses a **two-stage detection pipeline**:

1. **YOLO Detection** — Detects objects classified as vehicles (cars, buses, trucks, motorcycles)
2. **Histogram Validation** — Double-checks detected objects against HSV histogram references from your dataset

The problem was that the **histogram filters were EXCESSIVELY STRICT**, rejecting nearly all detections including legitimate cars and toy cars.

### Original Thresholds (Too Strict)
```python
HIST_POS_THRESHOLD = 0.20              # Min confidence that patch is a car
HIST_MARGIN_THRESHOLD = 0.01           # Min (pos_score - neg_score) margin
HIST_HIGHCONF_THRESHOLD = 0.45         # Fallback rule if YOLO conf is very high
HIST_HIGHCONF_MARGIN = -0.01           # Margin allowed in fallback rule
```

These meant:
- A toy car might look visually different (different color/material) from cars in your training set
- The negative score (non-car similarity) could exceed the positive score (car similarity)
- Even YOLO's high confidence (0.93) would be rejected if margin was negative

## The Fix
Relaxed thresholds to balance sensitivity (detect cars) vs. specificity (avoid false positives):

```python
HIST_POS_THRESHOLD = 0.15              # ← Lowered from 0.20
HIST_MARGIN_THRESHOLD = -0.05          # ← Lowered from 0.01
HIST_HIGHCONF_THRESHOLD = 0.30         # ← Lowered from 0.45
HIST_HIGHCONF_MARGIN = -0.10           # ← Lowered from -0.01
```

### Testing Results
- **Real cars**: 8/10 patches accepted ✓
- **Non-car image**: 0 false positives ✓
- **Dataset**: 1286 car references + 584 non-car references loaded successfully ✓

---

## How to Test Car Detection

### Option 1: Quick Test on Dataset Images
```bash
cd backend
python3 debug_detection.py ../Dataset/Cars/1.jpg
python3 debug_detection.py '../Dataset/Not cars/image1.jpg'
```

The debug script will show:
- Whether YOLO detects objects
- Histogram scores for each detection
- Which detections are accepted/rejected and why
- Recommendations if nothing is detected

### Option 2: Test with Your Own Car Photo
```bash
cd backend
python3 debug_detection.py /path/to/your/toy/car.jpg
```

### Option 3: Live Testing with Flask Server
```bash
cd backend
python3 -m camera_detector --camera-index 0 --port 5001
```

Then visit: `http://localhost:5001/feed` to see live camera feed with detected cars highlighted.

---

## Customizing Sensitivity

If detection is still too loose or too tight, you can adjust thresholds via **environment variables**:

```bash
# More sensitive (detect more cars, including edge cases)
export SMARTPARK_HIST_POS_THRESHOLD=0.10
export SMARTPARK_HIST_MARGIN_THRESHOLD=-0.15
export SMARTPARK_HIST_HIGHCONF_THRESHOLD=0.20

# More strict (fewer false positives)
export SMARTPARK_HIST_POS_THRESHOLD=0.25
export SMARTPARK_HIST_MARGIN_THRESHOLD=0.05
export SMARTPARK_HIST_HIGHCONF_THRESHOLD=0.40
```

Then run the detector with your chosen sensitivity.

---

## Understanding the Histogram Validation

Your dataset has:
- **1286 car images** → converted to HSV histograms (24×24 bins)
- **584 non-car images** → converted to HSV histograms

When a YOLO detection is found:
1. Extract the detected patch
2. Compute its HSV histogram
3. Compare against all 1286 car histograms (top-5 mean similarity = `pos_score`)
4. Compare against all 584 non-car histograms (top-5 mean similarity = `neg_score`)
5. **Accept** if one of these passes:
   - **Primary rule**: `pos_score >= 0.15 AND (pos_score - neg_score) >= -0.05`
   - **Fallback rule**: `yolo_conf >= 0.30 AND (pos_score - neg_score) >= -0.10`

This is why toy cars might have been rejected — they may not closely match the car histogram distribution, so `neg_score` could exceed `pos_score`.

---

## Files Modified
- [camera_detector.py](camera_detector.py#L45-L48) — Lines 45-48: Adjusted histogram thresholds

## Debug Tools
- [debug_detection.py](debug_detection.py) — New diagnostic script to test detection on individual images

---

## Next Steps if Issues Persist

1. **No YOLO detections at all?**
   - Check `yolov8n.pt` exists in `./backend/`
   - Check YOLO classes: Should include cars (ID=2), motorcycles (ID=3), buses (ID=5), trucks (ID=7)

2. **Too many false positives?**
   - Increase `HIST_POS_THRESHOLD`
   - Increase `HIST_MARGIN_THRESHOLD`
   - Increase `HIST_HIGHCONF_THRESHOLD`

3. **Missing real cars?**
   - Decrease `HIST_POS_THRESHOLD`
   - Decrease `HIST_MARGIN_THRESHOLD` (can go negative)
   - Decrease `HIST_HIGHCONF_THRESHOLD`

4. **Unsure about histogram distance?**
   - Check `latest_filter_debug` endpoint for detection stats
   - Review the `pos_score` vs `neg_score` to understand why detections are rejected

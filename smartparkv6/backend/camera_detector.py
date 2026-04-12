import argparse
import json
import os
import threading
import time

import cv2
import numpy as np
import requests
from flask import Flask, Response, request

try:
    from picamera2 import Picamera2
    HAS_PICAMERA2 = True
except Exception:
    Picamera2 = None
    HAS_PICAMERA2 = False

try:
    from ultralytics import YOLO
    HAS_YOLO = True
except Exception:
    YOLO = None
    HAS_YOLO = False

app = Flask(__name__)

# Runtime config (overridden by argparse)
API_URL = "http://localhost:8000/sensor/camera"
CAMERA_INDEX = 0
SOURCE_NAME = "camera1"
ROI_FILE = "rois.json"
INFERENCE_SKIP = 2
DETECTION_CONFIDENCE = 0.20
ROI_OCCUPANCY_THRESHOLD = 0.40

script_dir = os.path.dirname(os.path.abspath(__file__))
YOLO_MODEL_PATH = os.getenv("SMARTPARK_YOLO_MODEL", "yolov8n.pt")
DATASET_REFS_PATH = os.getenv("SMARTPARK_REFS_PATH", os.path.join(script_dir, "dataset_refs.npz"))

MIN_PATCH_SIDE = int(os.getenv("SMARTPARK_MIN_PATCH_SIDE", "16"))
HIST_TOPK = int(os.getenv("SMARTPARK_HIST_TOPK", "5"))
HIST_POS_THRESHOLD = float(os.getenv("SMARTPARK_HIST_POS_THRESHOLD", "0.15"))
HIST_MARGIN_THRESHOLD = float(os.getenv("SMARTPARK_HIST_MARGIN_THRESHOLD", "-0.05"))
HIST_HIGHCONF_THRESHOLD = float(os.getenv("SMARTPARK_HIST_HIGHCONF_THRESHOLD", "0.30"))
HIST_HIGHCONF_MARGIN = float(os.getenv("SMARTPARK_HIST_HIGHCONF_MARGIN", "-0.10"))
SLOT_PERSISTENCE_TIME = float(os.getenv("SMARTPARK_SLOT_PERSISTENCE_TIME", "3.0"))

# COCO vehicle classes
VEHICLE_CLASS_IDS = {2, 3, 5, 7}  # car, motorcycle, bus, truck

# Shared state
output_frame = None
latest_detection_status = {"car_count": 0, "slot_status": {}, "timestamp": 0.0}
latest_filter_debug = {"candidates": [], "accepted_count": 0, "rejected_count": 0, "timestamp": 0.0}
latest_dataset_stats = {"cars": 0, "not_cars": 0, "updated_at": 0.0}

POSITIVE_REFS = np.empty((0, 1), dtype=np.float32)
NEGATIVE_REFS = np.empty((0, 1), dtype=np.float32)
refs_lock = threading.Lock()

last_slot_detection_time = {}
slot_detection_lock = threading.Lock()

ROIS = {
    "M2-L1-S1": [], "M2-L1-S2": [], "M2-L1-S3": [],
    "M2-L1-S4": [],
}


def load_rois():
    global ROIS
    roi_path = os.path.join(script_dir, ROI_FILE)
    if not os.path.exists(roi_path):
        return
    try:
        with open(roi_path, "r", encoding="utf-8") as f:
            all_rois = json.load(f)
        if SOURCE_NAME in all_rois:
            saved = all_rois[SOURCE_NAME]
            for slot_id in ROIS:
                if slot_id in saved:
                    ROIS[slot_id] = saved[slot_id]
            print(f"[{SOURCE_NAME}] ROIs loaded from file.")
    except Exception as e:
        print(f"[{SOURCE_NAME}] Failed to load ROIs: {e}")


def save_rois():
    roi_path = os.path.join(script_dir, ROI_FILE)
    try:
        all_rois = {}
        if os.path.exists(roi_path):
            with open(roi_path, "r", encoding="utf-8") as f:
                all_rois = json.load(f)
        all_rois[SOURCE_NAME] = ROIS
        with open(roi_path, "w", encoding="utf-8") as f:
            json.dump(all_rois, f)
        print(f"[{SOURCE_NAME}] ROIs saved to file.")
    except Exception as e:
        print(f"[{SOURCE_NAME}] Failed to save ROIs: {e}")


def make_unavailable_frame(message="Camera Unavailable"):
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.putText(frame, message, (80, 220), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (70, 70, 70), 2)
    return frame


def open_camera(camera_index):
    if HAS_PICAMERA2:
        try:
            picam2 = Picamera2(camera_index)
            config = picam2.create_video_configuration(main={"size": (640, 480), "format": "RGB888"})
            picam2.configure(config)
            picam2.start()
            time.sleep(0.5)
            print(f"[{SOURCE_NAME}] Camera opened via Picamera2 (index {camera_index}).")
            return {"backend": "picamera2", "device": picam2}
        except Exception as e:
            print(f"[{SOURCE_NAME}] Picamera2 open failed for index {camera_index}: {e}")

    cap = cv2.VideoCapture(camera_index)
    if cap.isOpened():
        print(f"[{SOURCE_NAME}] Camera opened via OpenCV VideoCapture (index {camera_index}).")
        return {"backend": "opencv", "device": cap}

    try:
        cap.release()
    except Exception:
        pass
    return None


def read_frame(camera):
    if not camera:
        return None

    backend = camera.get("backend")
    device = camera.get("device")

    if backend == "picamera2":
        try:
            frame_rgb = device.capture_array()
            if frame_rgb is None:
                return None
            return cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR)
        except Exception:
            return None

    if backend == "opencv":
        ok, frame = device.read()
        if not ok:
            return None
        return frame

    return None


def close_camera(camera):
    if not camera:
        return
    backend = camera.get("backend")
    device = camera.get("device")
    try:
        if backend == "picamera2":
            device.stop()
            device.close()
        elif backend == "opencv":
            device.release()
    except Exception:
        pass


def get_overlap_ratio(slot_pts, car_box):
    """How much of the car area is inside ROI polygon (0..1)."""
    try:
        x, y, w, h = car_box
        if w <= 0 or h <= 0:
            return 0.0

        slot_mask = np.zeros((480, 640), dtype=np.uint8)
        pts = np.array(slot_pts, np.int32).reshape((-1, 1, 2))
        if len(pts) >= 3:
            cv2.fillPoly(slot_mask, [pts], 255)

        car_mask = np.zeros((480, 640), dtype=np.uint8)
        cv2.rectangle(car_mask, (x, y), (x + w, y + h), 255, -1)

        intersection = cv2.bitwise_and(slot_mask, car_mask)
        car_area = np.count_nonzero(car_mask)
        if car_area == 0:
            return 0.0
        return np.count_nonzero(intersection) / float(car_area)
    except Exception:
        return 0.0


def load_yolo_model():
    if not HAS_YOLO:
        print("[YOLO] ultralytics not installed. Install with: pip install ultralytics")
        return None
    try:
        model = YOLO(YOLO_MODEL_PATH)
        print(f"[YOLO] Loaded model: {YOLO_MODEL_PATH}")
        return model
    except Exception as e:
        print(f"[YOLO] Failed to load model '{YOLO_MODEL_PATH}': {e}")
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
    hist = cv2.calcHist([hsv], [0, 1], None, [24, 24], [0, 180, 0, 256])
    hist = cv2.normalize(hist, hist).flatten().astype(np.float32)
    return hist


def _topk_mean_cosine(hist, refs, k):
    if hist is None or refs.size == 0:
        return -1.0
    hist = hist.reshape(-1)
    if refs.ndim != 2 or refs.shape[1] != hist.shape[0]:
        return -1.0
    scores = refs @ hist
    if scores.size == 0:
        return -1.0
    kk = max(1, min(int(k), int(scores.size)))
    if kk == scores.size:
        return float(np.mean(scores))
    idx = np.argpartition(scores, -kk)[-kk:]
    return float(np.mean(scores[idx]))


def _load_dataset_refs():
    global POSITIVE_REFS, NEGATIVE_REFS, latest_dataset_stats
    started = time.time()
    pos = np.empty((0, 576), dtype=np.float32)
    neg = np.empty((0, 576), dtype=np.float32)
    err = None

    if os.path.exists(DATASET_REFS_PATH):
        try:
            data = np.load(DATASET_REFS_PATH)
            pos = data.get("positive_refs", pos).astype(np.float32)
            neg = data.get("negative_refs", neg).astype(np.float32)
            if pos.ndim == 1:
                pos = pos.reshape(1, -1)
            if neg.ndim == 1:
                neg = neg.reshape(1, -1)
        except Exception as e:
            err = str(e)
    else:
        err = f"refs file missing: {DATASET_REFS_PATH}"

    with refs_lock:
        POSITIVE_REFS = pos
        NEGATIVE_REFS = neg
        latest_dataset_stats = {
            "cars": int(pos.shape[0]) if pos.ndim == 2 else 0,
            "not_cars": int(neg.shape[0]) if neg.ndim == 2 else 0,
            "path": DATASET_REFS_PATH,
            "error": err,
            "updated_at": time.time(),
            "duration_ms": int((time.time() - started) * 1000),
        }

    print(
        f"[{SOURCE_NAME}] Loaded refs +{latest_dataset_stats['cars']}/-{latest_dataset_stats['not_cars']} "
        f"from {DATASET_REFS_PATH} in {latest_dataset_stats['duration_ms']} ms"
    )
    if err:
        print(f"[{SOURCE_NAME}] Refs warning: {err}")

    return latest_dataset_stats


def _is_toy_car_like(frame, box, yolo_conf):
    x, y, w, h = box
    x1 = max(0, x)
    y1 = max(0, y)
    x2 = min(frame.shape[1], x + w)
    y2 = min(frame.shape[0], y + h)

    with refs_lock:
        pos_refs = POSITIVE_REFS
        neg_refs = NEGATIVE_REFS

    if pos_refs.size == 0 and neg_refs.size == 0:
        return True, {
            "accepted": True,
            "rule": "yolo_only_no_refs",
            "confidence": float(yolo_conf),
            "pos_score": -1.0,
            "neg_score": -1.0,
            "margin": 0.0,
            "box": [int(x), int(y), int(w), int(h)],
        }

    if (x2 - x1) < MIN_PATCH_SIDE or (y2 - y1) < MIN_PATCH_SIDE:
        return False, {
            "accepted": False,
            "rule": "patch_too_small",
            "confidence": float(yolo_conf),
            "pos_score": -1.0,
            "neg_score": -1.0,
            "margin": -1.0,
            "box": [int(x), int(y), int(w), int(h)],
        }

    patch = frame[y1:y2, x1:x2]
    hist = _compute_hsv_histogram(patch)
    pos_score = _topk_mean_cosine(hist, pos_refs, HIST_TOPK)
    neg_score = _topk_mean_cosine(hist, neg_refs, HIST_TOPK)
    margin = pos_score - neg_score

    if pos_score >= HIST_POS_THRESHOLD and margin >= HIST_MARGIN_THRESHOLD:
        return True, {
            "accepted": True,
            "rule": "primary_hist",
            "confidence": float(yolo_conf),
            "pos_score": float(pos_score),
            "neg_score": float(neg_score),
            "margin": float(margin),
            "box": [int(x), int(y), int(w), int(h)],
        }

    if yolo_conf >= HIST_HIGHCONF_THRESHOLD and margin >= HIST_HIGHCONF_MARGIN:
        return True, {
            "accepted": True,
            "rule": "highconf_fallback",
            "confidence": float(yolo_conf),
            "pos_score": float(pos_score),
            "neg_score": float(neg_score),
            "margin": float(margin),
            "box": [int(x), int(y), int(w), int(h)],
        }

    return False, {
        "accepted": False,
        "rule": "rejected_by_hist",
        "confidence": float(yolo_conf),
        "pos_score": float(pos_score),
        "neg_score": float(neg_score),
        "margin": float(margin),
        "box": [int(x), int(y), int(w), int(h)],
    }


def detect_vehicle_boxes(frame, model):
    """Returns list of [x, y, w, h] car-like boxes and debug rows."""
    if model is None:
        return [], []

    results = model.predict(
        source=frame,
        conf=DETECTION_CONFIDENCE,
        verbose=False,
        imgsz=640,
        classes=list(VEHICLE_CLASS_IDS),
        device="cpu",
    )

    boxes = []
    debug = []
    if not results:
        return boxes, debug

    res = results[0]
    if res.boxes is None:
        return boxes, debug

    for b in res.boxes:
        xyxy = b.xyxy[0].cpu().numpy().astype(int)
        cls_id = int(b.cls[0].item()) if b.cls is not None else -1
        conf = float(b.conf[0].item()) if b.conf is not None else 0.0

        x1, y1, x2, y2 = xyxy.tolist()
        x1 = max(0, min(639, x1))
        y1 = max(0, min(479, y1))
        x2 = max(x1 + 1, min(640, x2))
        y2 = max(y1 + 1, min(480, y2))
        w = x2 - x1
        h = y2 - y1

        candidate_box = [x1, y1, w, h]
        accepted, dbg = _is_toy_car_like(frame, candidate_box, conf)
        dbg["class_id"] = cls_id
        if accepted:
            boxes.append(candidate_box)
        debug.append(dbg)

    return boxes, debug


def process_frame():
    global output_frame, latest_detection_status, latest_filter_debug

    model = load_yolo_model()
    camera = open_camera(CAMERA_INDEX)

    if camera is None:
        print(f"[{SOURCE_NAME}] Camera index {CAMERA_INDEX} unavailable.")
        output_frame = make_unavailable_frame("Camera Unavailable")
        all_free = {slot: "FREE" for slot in ROIS}
        latest_detection_status = {"car_count": 0, "slot_status": all_free, "timestamp": time.time()}
        while True:
            try:
                requests.post(API_URL, json={"source": SOURCE_NAME, "statuses": all_free}, timeout=1)
            except Exception:
                pass
            time.sleep(2)

    time.sleep(1.0)
    frame_count = 0
    last_api_update = 0.0
    last_car_boxes = []

    while True:
        frame = read_frame(camera)
        if frame is None:
            time.sleep(0.5)
            continue

        frame = cv2.resize(frame, (640, 480))

        car_boxes = last_car_boxes
        candidate_debug = []
        if frame_count % max(1, INFERENCE_SKIP) == 0:
            car_boxes, candidate_debug = detect_vehicle_boxes(frame, model)
            last_car_boxes = car_boxes
            latest_filter_debug = {
                "candidates": candidate_debug[-20:],
                "accepted_count": len(candidate_debug),
                "rejected_count": 0,
                "timestamp": time.time(),
            }

        for box in car_boxes:
            x, y, w, h = box
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 255), 2)
            cv2.putText(frame, "Car", (x, max(15, y - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)

        slot_status = {slot: "FREE" for slot in ROIS}
        overlay = frame.copy()

        for slot_id, slot_pts in ROIS.items():
            if not slot_pts or len(slot_pts) < 2:
                continue

            # Check if car is currently detected in this slot
            occupied = any(get_overlap_ratio(slot_pts, box) > ROI_OCCUPANCY_THRESHOLD for box in car_boxes)
            
            now = time.time()
            with slot_detection_lock:
                # If car detected, update last detection time
                if occupied:
                    last_slot_detection_time[slot_id] = now
                
                # Check if slot should remain occupied due to persistence
                last_detection = last_slot_detection_time.get(slot_id, 0)
                if now - last_detection <= SLOT_PERSISTENCE_TIME:
                    occupied = True
            
            slot_status[slot_id] = "OCCUPIED" if occupied else "FREE"

            color = (0, 0, 255) if occupied else (0, 255, 0)
            pts = np.array(slot_pts, np.int32).reshape((-1, 1, 2))
            cv2.polylines(overlay, [pts], isClosed=False, color=color, thickness=40)
            cv2.putText(frame, slot_id, (slot_pts[0][0], max(30, slot_pts[0][1] - 30)), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        cv2.addWeighted(overlay, 0.4, frame, 0.6, 0, frame)
        output_frame = frame.copy()
        latest_detection_status = {
            "car_count": len(car_boxes),
            "slot_status": slot_status,
            "timestamp": time.time(),
        }

        now = time.time()
        if now - last_api_update > 2.0:
            try:
                requests.post(API_URL, json={"source": SOURCE_NAME, "statuses": slot_status}, timeout=1)
            except Exception:
                pass
            last_api_update = now

        frame_count += 1
        time.sleep(0.05)


def generate_mjpeg():
    global output_frame
    while True:
        if output_frame is not None:
            ok, buf = cv2.imencode(".jpg", output_frame)
            if ok:
                yield (b"--frame\r\n"
                       b"Content-Type: image/jpeg\r\n\r\n" +
                       buf.tobytes() + b"\r\n")
        time.sleep(0.05)


@app.route("/video_feed")
def video_feed():
    return Response(generate_mjpeg(), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/config_rois", methods=["POST", "OPTIONS"])
def config_rois():
    if request.method == "OPTIONS":
        resp = app.make_default_options_response()
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return resp

    global ROIS
    data = request.json or {}
    for slot_id, coords in data.items():
        if slot_id in ROIS:
            ROIS[slot_id] = coords
    save_rois()

    resp = app.response_class(response=json.dumps({"status": "updated", "rois": ROIS}), status=200, mimetype="application/json")
    resp.headers["Access-Control-Allow-Origin"] = "*"
    return resp


@app.route("/get_rois", methods=["GET"])
def get_rois():
    resp = app.response_class(response=json.dumps({"rois": ROIS}), status=200, mimetype="application/json")
    resp.headers["Access-Control-Allow-Origin"] = "*"
    return resp


@app.route("/live_status", methods=["GET"])
def live_status():
    resp = app.response_class(response=json.dumps(latest_detection_status), status=200, mimetype="application/json")
    resp.headers["Access-Control-Allow-Origin"] = "*"
    return resp


@app.route("/live_filter_debug", methods=["GET"])
def live_filter_debug():
    resp = app.response_class(response=json.dumps(latest_filter_debug), status=200, mimetype="application/json")
    resp.headers["Access-Control-Allow-Origin"] = "*"
    return resp


@app.route("/dataset_refs_status", methods=["GET"])
def dataset_refs_status():
    resp = app.response_class(response=json.dumps(latest_dataset_stats), status=200, mimetype="application/json")
    resp.headers["Access-Control-Allow-Origin"] = "*"
    return resp


@app.route("/reload_dataset_refs", methods=["POST", "OPTIONS"])
def reload_dataset_refs_route():
    if request.method == "OPTIONS":
        resp = app.make_default_options_response()
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return resp

    stats = _load_dataset_refs()
    payload = {"status": "ok", "message": "dataset refs reloaded", "dataset": stats}
    resp = app.response_class(response=json.dumps(payload), status=200, mimetype="application/json")
    resp.headers["Access-Control-Allow-Origin"] = "*"
    return resp


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SmartPark YOLO Camera Detector")
    parser.add_argument("--port", type=int, default=5001)
    parser.add_argument("--camera-index", type=int, default=0)
    parser.add_argument("--source", type=str, default="camera1")
    parser.add_argument("--inference-skip", type=int, default=2)
    parser.add_argument("--conf", type=float, default=0.20)
    args = parser.parse_args()

    CAMERA_INDEX = args.camera_index
    SOURCE_NAME = args.source
    INFERENCE_SKIP = max(1, args.inference_skip)
    DETECTION_CONFIDENCE = max(0.01, min(0.95, args.conf))

    load_rois()
    _load_dataset_refs()

    t = threading.Thread(target=process_frame, daemon=True)
    t.start()

    print(
        f"[{SOURCE_NAME}] YOLO detector starting on port {args.port}, "
        f"camera index {CAMERA_INDEX}, conf={DETECTION_CONFIDENCE}, inference_skip={INFERENCE_SKIP}"
    )
    app.run(host="0.0.0.0", port=args.port, debug=False, use_reloader=False)

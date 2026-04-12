#!/bin/bash

# Trap Ctrl+C to kill all background processes
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

echo "Starting SmartPark..."

OS_NAME=$(uname -s)
ARCH_NAME=$(uname -m)
echo "Environment: $OS_NAME ($ARCH_NAME)"

# Check if venv exists
if [ ! -f "venv/bin/activate" ]; then
    echo "Error: Python venv not found. Please run ./setup_pi.sh first."
    exit 1
fi

echo "Starting Backend (FastAPI)..."
source venv/bin/activate
# Run uvicorn in background
uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Fail fast if backend crashes during startup
echo "Checking backend startup health..."
BACKEND_OK=false
for i in {1..10}; do
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "Error: Backend process exited during startup."
        exit 1
    fi

    if curl -sSf http://127.0.0.1:8000/ >/dev/null 2>&1; then
        BACKEND_OK=true
        break
    fi

    sleep 1
done

if [ "$BACKEND_OK" != "true" ]; then
    echo "Error: Backend did not become healthy on http://127.0.0.1:8000"
    echo "Tip: check terminal logs above for startup exceptions (e.g., GPIO busy)."
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo "Backend is healthy."

check_camera_index() {
    local cam_index=$1
    local cam_name=$2

    echo "$cam_name preflight skipped (lightweight startup mode)."
}

check_camera_service() {
    local pid=$1
    local health_url=$2
    local service_name=$3

    for i in {1..8}; do
        if ! kill -0 "$pid" 2>/dev/null; then
            echo "Warning: $service_name process exited during startup."
            return 1
        fi

        if curl -sSf "$health_url" >/dev/null 2>&1; then
            echo "$service_name is reachable at $health_url"
            return 0
        fi

        sleep 1
    done

    echo "Warning: $service_name did not respond at $health_url yet."
    return 1
}

CAMERA1_PID=""
CAMERA2_PID=""
ENABLE_CAMERA2=${SMARTPARK_ENABLE_CAMERA2:-1}

if [ -f "backend/camera_detector.py" ]; then
    echo "Starting Camera 1 Detector (Port 5001, camera index 0)..."
    check_camera_index 0 "Camera 1"
    CAM1_SKIP=${SMARTPARK_CAM1_SKIP:-4}
    python3 backend/camera_detector.py --port 5001 --camera-index 0 --source camera1 --inference-skip "$CAM1_SKIP" &
    CAMERA1_PID=$!
    echo "Camera 1 PID: $CAMERA1_PID"
    check_camera_service "$CAMERA1_PID" "http://127.0.0.1:5001/get_rois" "Camera 1 Detector" || true

    if [ "$ENABLE_CAMERA2" = "1" ]; then
        echo "Starting Camera 2 Detector (Port 5002, camera index 1)..."
        check_camera_index 1 "Camera 2"
        CAM2_SKIP=${SMARTPARK_CAM2_SKIP:-8}
        python3 backend/camera_detector.py --port 5002 --camera-index 1 --source camera2 --inference-skip "$CAM2_SKIP" &
        CAMERA2_PID=$!
        echo "Camera 2 PID: $CAMERA2_PID"
        check_camera_service "$CAMERA2_PID" "http://127.0.0.1:5002/get_rois" "Camera 2 Detector" || true
    else
        echo "Camera 2 Detector disabled (set SMARTPARK_ENABLE_CAMERA2=1 to enable)."
    fi
else
    echo "Warning: backend/camera_detector.py not found. Skipping camera detector startup."
fi

# Check frontend
if [ ! -d "frontend" ]; then
    echo "Error: frontend directory not found."
    kill $BACKEND_PID
    exit 1
fi

echo "Starting Frontend (Vite)..."
cd frontend
# Check npm
if ! command -v npm &> /dev/null; then
    echo "Error: npm could not be found. Please install Node.js."
    kill $BACKEND_PID
    exit 1
fi

npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo "SmartPark is running!"
echo "Backend:           http://localhost:8000"
if [ -n "$CAMERA1_PID" ]; then
    echo "Camera 1 Feed:     http://localhost:5001/video_feed"
fi
if [ -n "$CAMERA2_PID" ]; then
    echo "Camera 2 Feed:     http://localhost:5002/video_feed"
fi
echo "Frontend:          http://localhost:5173"
echo "Press Ctrl+C to stop."

# Wait for all processes
PIDS=($BACKEND_PID $FRONTEND_PID)
if [ -n "$CAMERA1_PID" ]; then
    PIDS+=($CAMERA1_PID)
fi
if [ -n "$CAMERA2_PID" ]; then
    PIDS+=($CAMERA2_PID)
fi
wait "${PIDS[@]}"

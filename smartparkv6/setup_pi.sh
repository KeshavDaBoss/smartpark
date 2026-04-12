#!/bin/bash

# Cross-platform setup for SmartPark (macOS + Raspberry Pi/Linux)

echo "Setting up SmartPark environment..."

OS_NAME=$(uname -s)
ARCH_NAME=$(uname -m)
IS_PI_LIKE=false
if [ "$OS_NAME" = "Linux" ] && [[ "$ARCH_NAME" == arm* || "$ARCH_NAME" == aarch64* ]]; then
    IS_PI_LIKE=true
fi

echo "Detected OS: $OS_NAME ($ARCH_NAME)"
if [ "$IS_PI_LIKE" = true ]; then
    echo "Raspberry Pi/Linux ARM environment detected."
else
    echo "Non-Pi environment detected (dev-friendly setup mode)."
fi

# 1. System Dependencies
# Check for Node.js/npm
if ! command -v npm &> /dev/null; then
    echo "--------------------------------------------------------"
    echo "CRITICAL: Node.js/npm is missing!"
    if [ "$OS_NAME" = "Darwin" ]; then
        echo "Install via Homebrew: brew install node"
    elif [ "$OS_NAME" = "Linux" ]; then
        echo "Install via apt: sudo apt-get update && sudo apt-get install -y nodejs npm"
    else
        echo "Please install Node.js for your platform."
    fi
    echo "--------------------------------------------------------"
    exit 1
fi

# 2. Python Setup
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv --system-site-packages
    
    echo "activating venv..."
    source venv/bin/activate
    
    echo "Installing backend requirements..."
    pip install -r backend/requirements.txt

    if [ "$IS_PI_LIKE" = true ]; then
        # FOR RASPBERRY PI 5: RPi.GPIO does not work. We need rpi-lgpio.
        # We remove RPi.GPIO just in case and install the replacement.
        echo "Installing Pi-compatible GPIO library..."
        pip uninstall -y RPi.GPIO >/dev/null 2>&1 || true
        pip install rpi-lgpio
    else
        echo "Skipping GPIO package install on non-Pi environment."
    fi

    echo "Downloading MobileNet SSD Models for AI Detection..."
    if [ ! -f "backend/MobileNetSSD_deploy.caffemodel" ] || [ $(stat -f%z "backend/MobileNetSSD_deploy.caffemodel") -lt 10000000 ]; then
        curl -L https://raw.githubusercontent.com/chuanqi305/MobileNet-SSD/master/voc/MobileNetSSD_deploy.prototxt -o backend/MobileNetSSD_deploy.prototxt
        curl -L https://github.com/nikmart/pi-object-detection/raw/master/MobileNetSSD_deploy.caffemodel -o backend/MobileNetSSD_deploy.caffemodel
        echo "Models downloaded successfully."
    else
        echo "Models already exist."
    fi

else
    echo "venv already exists."
    echo "Activating venv and ensuring backend deps are current..."
    source venv/bin/activate
    pip install -r backend/requirements.txt
fi

# 3. Frontend Setup
if [ -d "frontend" ]; then
    echo "Installing frontend dependencies..."
    cd frontend
    # Always run install to ensure all deps in package.json are installed
    npm install
    cd ..
else
    echo "Error: frontend directory not found!"
    exit 1
fi

echo "Setup Complete! You can now run ./run_dev.sh"

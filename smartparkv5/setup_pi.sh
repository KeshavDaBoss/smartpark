#!/bin/bash

# Setup script for SmartPark on Raspberry Pi

echo "Setting up SmartPark environment..."

# 1. System Dependencies
# Check for Node.js/npm
if ! command -v npm &> /dev/null; then
    echo "--------------------------------------------------------"
    echo "CRITICAL: Node.js/npm is missing!"
    echo "Please run the following command to install them:"
    echo "sudo apt-get update && sudo apt-get install -y nodejs npm"
    echo "--------------------------------------------------------"
    # We can try to install it if the user has sudo rights without password, 
    # but safer to ask them.
    read -p "Attempt to install Node.js automatically? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo apt-get update && sudo apt-get install -y nodejs npm
    else
        echo "Please install Node.js manually and re-run this script."
        exit 1
    fi
fi

# 2. Python Setup
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv --system-site-packages
    
    echo "activating venv..."
    source venv/bin/activate
    
    echo "Installing backend requirements..."
    pip install -r backend/requirements.txt
    
    # FOR RASPBERRY PI 5: RPi.GPIO does not work. We need rpi-lgpio.
    # We remove RPi.GPIO just in case and install the replacement.
    echo "Installing Pi 5 compatible GPIO library..."
    pip uninstall -y RPi.GPIO
    pip install rpi-lgpio
else
    echo "venv already exists."
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

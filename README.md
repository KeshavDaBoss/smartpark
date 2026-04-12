# smartpark

SmartPark is a smart parking system project developed across multiple iterations.
This repository contains firmware prototypes, web dashboards, backend services, and computer-vision based parking detection.

## Repository structure

- smartparkv1: Initial prototype with a dashboard HTML file and Arduino sketch.
- smartparkv2: Improved Arduino firmware iteration.
- smartparkv3: Further firmware refinement.
- smartparkv4: Node.js based backend plus web dashboard and ESP firmware.
- smartparkv5: Python backend, React frontend, and ESP32 firmware split by modules.
- smartparkv6: Latest full stack version with camera-based vehicle detection.

## Recommended version

Use smartparkv6 for active development.

- Backend: smartparkv6/backend
- Frontend: smartparkv6/frontend
- Firmware: smartparkv6/firmware and smartparkv6 root firmware files

## Quick start for smartparkv6

1. Move into the version folder.
	- cd smartparkv6
2. Set up and run the backend.
	- cd backend
	- python3 -m venv .venv
	- source .venv/bin/activate
	- pip install -r requirements.txt
	- uvicorn main:app --reload --host 0.0.0.0 --port 8000
3. In a new terminal, run the frontend.
	- cd smartparkv6/frontend
	- npm install
	- npm run dev
4. Flash ESP32 firmware from smartparkv6/firmware/smartpark_esp32 as needed.

## Additional notes

- Hardware setup helpers are included in version folders, for example setup_pi.sh.
- Older versions are retained for comparison, debugging, and historical reference.
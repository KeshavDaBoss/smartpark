# ESP32 Firmware Instructions

1. **Install Arduino IDE**.
2. **Install ESP32 Board Manager**:
   - Go to Preferences -> Additional Board Manager URLs.
   - Add: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Tools -> Board -> Board Manager -> Search "esp32" -> Install.
3. **Install Libraries**:
   - Sketch -> Include Library -> Manage Libraries.
   - Search "ArduinoJson" and install.
4. **Configure Sketch**:
   - Open `smartpark_esp32.ino`.
   - Update `ssid` and `password` with your WiFi credentials.
   - Update `serverUrl` with the IP address of your Raspberry Pi (e.g., `http://192.168.1.10:8000/sensor/esp32`).
5. **Upload**:
   - Select your ESP32 board and port.
   - Click Upload.

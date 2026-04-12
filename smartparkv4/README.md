# SmartPark V4

SmartPark V4 is an IoT-based smart parking system that provides real-time information about parking slot availability and allows users to book a slot in advance.

## Features

- **Real-time Slot Detection:** Uses HC-SR04 ultrasonic sensors to detect whether a parking slot is occupied or vacant.
- **Slot Booking:** Users can view available slots and book one through a web interface. This can be viewed on ground with the LEDs.
- **Database Integration:** Stores booking information and slot status.

## Project Structure

- `server.js`: The main Node.js server file.
- `db.js`: Handles database connections and queries.
- `public/`: Contains the frontend files (`index.html`, `style.css`).
- `smartparkv4.ino`: Arduino code for the hardware component (sensors).
- `package.json`: Lists project dependencies.

## Tech Stack

- **Backend:** Node.js
- **Frontend:** HTML, CSS
- **Hardware:** ESP32

## Getting Started

### Prerequisites

- Node.js and npm installed.
- Arduino IDE for the hardware part.

### Installation

1. Clone the repository.
2. Navigate to the project directory:
   ```bash
   cd smartparkv4
   ```
3. Install the dependencies:
   ```bash
   npm install
   ```
4. Set up your database configuration in `db.js`.
5. Upload the `smartparkv4.ino` sketch to your ESP32 DevKit 1, connect the GPIO Pins in accordance to code.
6. Start the server:
   ```bash
   node server.js
   ```

## License

This project is licensed under the MIT License.

import platform
from typing import List
# Conditional import for GPIO
try:
    import RPi.GPIO as GPIO
    IS_RPI = True
except ImportError:
    IS_RPI = False
    print("Not running on RPi. GPIO will be mocked.")

from .models import SlotStatus
from .database import slots_db

# --- Pin Configuration ---
# Mall 1 (Pi) Configuration
# Format: { SlotID: { 'trig': pin, 'echo': pin, 'led': pin_optional } }
PI_PINOUT = {
    "M1-L1-S1": {'trig': 5, 'echo': 21, 'led': 17},
    "M1-L1-S2": {'trig': 6, 'echo': 25, 'led': 27},
    "M1-L1-S3": {'trig': 13, 'echo': 24, 'led': None},
    "M1-L1-S4": {'trig': 19, 'echo': 23, 'led': None},
    "M1-L2-S5": {'trig': 26, 'echo': 18, 'led': None},
    "M1-L2-S6": {'trig': 12, 'echo': 15, 'led': None},
    "M1-L2-S7": {'trig': 16, 'echo': 14, 'led': None},
    "M1-L2-S8": {'trig': 20, 'echo': 4,  'led': None},
}

def setup_gpio():
    if not IS_RPI:
        return
    
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    
    for slot_id, pins in PI_PINOUT.items():
        # Setup Sensor Pins
        try:
            GPIO.setup(pins['trig'], GPIO.OUT)
            GPIO.setup(pins['echo'], GPIO.IN)
            
            # Setup LED Pins if present
            if pins['led'] is not None:
                GPIO.setup(pins['led'], GPIO.OUT)
                GPIO.output(pins['led'], GPIO.LOW) # Default Off
        except RuntimeError as e:
            print(f"GPIO Setup Error for {slot_id}: {e}")
            print("Falling back to MOCK mode for this pin.")
            # If we fail, we might want to disable IS_RPI to prevent further crash
            # or just continue. 


def read_ultrasonic_distance(trig_pin, echo_pin) -> float:
    if not IS_RPI:
        return 999.0 # Mock: Far away (Empty)
        
    import time
    
    # Trigger pulse
    GPIO.output(trig_pin, True)
    time.sleep(0.00001)
    GPIO.output(trig_pin, False)
    
    start_time = time.time()
    stop_time = time.time()
    
    # Wait for echo start
    timeout = time.time() + 0.04 # 40ms timeout
    while GPIO.input(echo_pin) == 0:
        start_time = time.time()
        if start_time > timeout:
            return 999.0
            
    # Wait for echo end
    while GPIO.input(echo_pin) == 1:
        stop_time = time.time()
        if stop_time > timeout:
            return 999.0
            
    time_elapsed = stop_time - start_time
    # distance = (time_elapsed * 34300) / 2
    distance = (time_elapsed * 17150)
    return distance

def update_pi_sensors():
    """Reads all Pi-connected sensors and updates DB."""
    for slot_id, pins in PI_PINOUT.items():
        dist = read_ultrasonic_distance(pins['trig'], pins['echo'])
        
        slot = slots_db.get(slot_id)
        if slot:
            # Logic: < 10cm = OCCUPIED
            # Note: Booking logic overrides this status in complex ways? 
            # Request says: "We'll say occupied if Sensors detect something closer than 10cm"
            # But "Booked" is a special status.
            # If a slot is BOOKED, the LED lights up. 
            # If a car PARKS in a BOOKED slot, it is technically OCCUPIED. 
            # For the UI, we usually show RED if occupied, BLUE if Booked (and empty).
            # If Booked AND Occupied by the correct person -> RED (Occupied).
            
            # Let's keep it simple: 
            # IF Dist < 10 -> Status = OCCUPIED
            # ELSE -> Revert to FREE (or BOOKED if there is an active booking)
            
            is_physically_occupied = dist < 10.0
            
            # Check for active booking for today
            # (Simplified: logic handled in main loop or here)
            # For now, just setting Occupied/Free based on sensor
            # The booking logic will overlay the "Booked" status if it is NOT occupied physically.
            
            if is_physically_occupied:
               slot.status = SlotStatus.OCCUPIED
            else:
                # Setup revert logic handled by booking manager or subsequent check
                # We will set it to FREE here, and the Booking Manager will upgrade it to BOOKED if needed
                slot.status = SlotStatus.FREE

def set_led(slot_id: str, state: bool):
    """Turns LED on/off for a specific slot."""
    if not IS_RPI:
        # print(f"[MOCK] LED {slot_id} -> {state}")
        return

    pins = PI_PINOUT.get(slot_id)
    if pins and pins['led'] is not None:
        GPIO.output(pins['led'], GPIO.HIGH if state else GPIO.LOW)

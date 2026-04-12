from fastapi import FastAPI, HTTPException, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from datetime import date, datetime, timedelta
import asyncio
import contextlib
import os
import time

from .models import Slot, User, UserCreate, Booking, BookingRequest, SlotStatus, SensorData, CameraSensorData, UserType
from .database import slots_db, users_db, bookings_db, init_db, get_user_by_username
from .hardware_service import setup_gpio, update_pi_sensors, set_led, PI_PINOUT

CAMERA_STALE_SECONDS = int(os.getenv("CAMERA_STALE_SECONDS", "12"))
DATASET_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dataset"))
DATASET_CARS_DIR = os.path.join(DATASET_ROOT, "Cars")
DATASET_NOT_CARS_DIR = os.path.join(DATASET_ROOT, "Not cars")
DATASET_MIN_NEGATIVE = int(os.getenv("DATASET_MIN_NEGATIVE", "300"))
DATASET_MAX_IMBALANCE_RATIO = float(os.getenv("DATASET_MAX_IMBALANCE_RATIO", "4.0"))
DATASET_CHECK_TTL_SECONDS = int(os.getenv("DATASET_CHECK_TTL_SECONDS", "10"))

camera_ingest_stats = {
    "total_messages": 0,
    "total_status_updates": 0,
    "last_message_at": 0.0,
    "sources": {},
    "last_payload": None,
}

dataset_reliability_cache = {
    "last_checked_at": 0.0,
    "payload": None,
}


def _count_dataset_images(folder: str) -> int:
    allowed = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    if not os.path.isdir(folder):
        return 0
    count = 0
    for root, _, names in os.walk(folder):
        for name in names:
            if os.path.splitext(name)[1].lower() in allowed:
                count += 1
    return count


def _get_dataset_reliability(now: float):
    age = now - float(dataset_reliability_cache.get("last_checked_at", 0.0))
    if dataset_reliability_cache.get("payload") is not None and age <= DATASET_CHECK_TTL_SECONDS:
        return dataset_reliability_cache["payload"]

    cars_count = _count_dataset_images(DATASET_CARS_DIR)
    not_cars_count = _count_dataset_images(DATASET_NOT_CARS_DIR)
    ratio = None
    if not_cars_count > 0:
        ratio = round(cars_count / float(not_cars_count), 2)

    warnings = []
    if not_cars_count == 0:
        warnings.append("No negative dataset images found in Not cars")
    elif not_cars_count < DATASET_MIN_NEGATIVE:
        warnings.append(f"Too few negative samples: {not_cars_count} < {DATASET_MIN_NEGATIVE}")

    if ratio is not None and ratio > DATASET_MAX_IMBALANCE_RATIO:
        warnings.append(f"Dataset imbalance too high: ratio {ratio} > {DATASET_MAX_IMBALANCE_RATIO}")

    payload = {
        "cars": cars_count,
        "not_cars": not_cars_count,
        "cars_to_not_cars_ratio": ratio,
        "min_negative_required": DATASET_MIN_NEGATIVE,
        "max_imbalance_ratio": DATASET_MAX_IMBALANCE_RATIO,
        "warnings": warnings,
        "healthy": len(warnings) == 0,
        "checked_at": now,
    }

    dataset_reliability_cache["last_checked_at"] = now
    dataset_reliability_cache["payload"] = payload
    return payload

# --- Lifecycle ---
@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    setup_gpio()
    asyncio.create_task(sensor_loop())
    yield
    # Shutdown

async def sensor_loop():
    while True:
        update_pi_sensors()
        refresh_leds()
        await asyncio.sleep(1) 

def refresh_leds():
    today = date.today()
    
    # 1. Reset all LEDs first (logical state, optimization possible)
    # Actually, let's just find which slots are booked TODAY
    booked_slot_ids_today = set()
    
    for booking in bookings_db:
        if booking.booking_date == today:
            booked_slot_ids_today.add(booking.slot_id)
            
    # 2. Update LEDs
    for slot_id in slots_db.keys():
        if slot_id in booked_slot_ids_today:
            set_led(slot_id, True)
        else:
            set_led(slot_id, False)

app = FastAPI(lifespan=lifespan)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Endpoints ---

@app.get("/")
def read_root():
    return {"message": "SmartPark API is running"}

# --- Auth ---

@app.post("/signup")
def signup(user: UserCreate):
    if get_user_by_username(user.username):
        raise HTTPException(status_code=400, detail="Username already registered")
    
    new_user = User(
        username=user.username,
        password=user.password, 
        is_disabled=user.is_disabled,
        is_elderly=user.is_elderly
    )
    users_db[new_user.id] = new_user
    return {"message": "User created", "user_id": new_user.id}

@app.post("/login")
def login(login_data: dict = Body(...)):
    username = login_data.get("username")
    password = login_data.get("password")
    user = get_user_by_username(username)
    if not user or user.password != password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {
        "user_id": user.id,
        "username": user.username,
        "is_disabled": user.is_disabled,
        "is_elderly": user.is_elderly
    }

# --- Slots & Booking ---

@app.get("/slots")
def get_slots(date_str: str = Query(..., alias="date"), user_id: Optional[str] = None):
    try:
        req_date = datetime.strptime(date_str, "%d%m%Y").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use DDMMYYYY")

    today = date.today()
    response_slots = []
    
    # Pre-fetch bookings for this date to avoid O(N^2) if possible, but N is small
    bookings_for_date = [b for b in bookings_db if b.booking_date == req_date]
    
    for s_id, slot in slots_db.items():
        current_status = SlotStatus.FREE
        
        # 1. Physical Sensor Status (Only if Today)
        if req_date == today:
             current_status = slot.status 
        
        # 2. Booking Status Overrides
        # Check if slot is booked in our list
        booking_for_this_slot = next((b for b in bookings_for_date if b.slot_id == s_id), None)
        
        booked_by_me = False
        
        if booking_for_this_slot:
            current_status = SlotStatus.BOOKED
            if user_id and booking_for_this_slot.user_id == user_id:
                booked_by_me = True

        response_slots.append({
            "id": slot.id,
            "mall_id": slot.mall_id,
            "level_id": slot.level_id,
            "slot_number": slot.slot_number,
            "status": current_status,
            "is_my_booking": booked_by_me,
            "is_reserved_disabled": slot.is_reserved_disabled,
            "is_reserved_elderly": slot.is_reserved_elderly
        })
        
    return response_slots

@app.post("/book")
def book_slot(booking_req: BookingRequest):
    try:
        req_date = datetime.strptime(booking_req.booking_date, "%d%m%Y").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    slot = slots_db.get(booking_req.slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
        
    user = users_db.get(booking_req.user_id)
    if not user:
         raise HTTPException(status_code=404, detail="User not found")
         
    # Check constraints
    if slot.is_reserved_disabled and not user.is_disabled:
        raise HTTPException(status_code=403, detail="Reserved for Disabled usage")
    if slot.is_reserved_elderly and not user.is_elderly:
        raise HTTPException(status_code=403, detail="Reserved for Elderly usage")
        
    # Check if slot is already booked for this date
    existing_booking = next((b for b in bookings_db if b.slot_id == booking_req.slot_id and b.booking_date == req_date), None)
    if existing_booking:
        raise HTTPException(status_code=409, detail="Slot already booked for this date")
        
    # Allow multiple bookings by same user on different slots/dates
    # (Removed restriction "one booking per user" if it existed)
        
    # Create Booking
    new_booking = Booking(
        slot_id=slot.id,
        user_id=user.id,
        booking_date=req_date
    )
    bookings_db.append(new_booking)
    
    # Update LED immediate check
    if req_date == date.today():
        set_led(slot.id, True)
    
    return {"message": "Booking successful", "booking_id": new_booking.id}

@app.post("/cancel")
def cancel_booking(payload: dict = Body(...)):
    slot_id = payload.get("slot_id")
    user_id = payload.get("user_id")
    date_str = payload.get("date") # Optional
    
    if not slot_id or not user_id:
        raise HTTPException(status_code=400, detail="Missing slot_id or user_id")

    req_date = None
    if date_str:
        try:
            req_date = datetime.strptime(date_str, "%d%m%Y").date()
        except ValueError:
            pass

    # Find booking to cancel
    # If date provided, exact match.
    # If no date, maybe cancel the one for TODAY or NEAREST FUTURE?
    # For now: Cancel matching booking(s).
    
    booking_to_cancel = None
    
    if req_date:
        booking_to_cancel = next((b for b in bookings_db if b.slot_id == slot_id and b.user_id == user_id and b.booking_date == req_date), None)
    else:
        # Try to find one for today or future
        # Heuristic: Find first one.
        booking_to_cancel = next((b for b in bookings_db if b.slot_id == slot_id and b.user_id == user_id), None)
        
    if not booking_to_cancel:
        raise HTTPException(status_code=404, detail="Booking not found to cancel")
        
    bookings_db.remove(booking_to_cancel)
    
    # Update LED
    refresh_leds()
    
    return {"message": "Booking cancelled"}

# --- Sensor Ingestion (ESP32) ---

@app.post("/sensor/esp32")
def receive_esp32_data(data: SensorData):
    print(f"Received ESP32 Data: {data.distances}")
    m2_slots = ["M2-L1-S1", "M2-L1-S2", "M2-L1-S3", "M2-L1-S4"]
    
    # Process Sensor Data
    for i, dist in enumerate(data.distances):
        if i < len(m2_slots):
            slot_id = m2_slots[i]
            slot = slots_db.get(slot_id)
            if slot:
                if dist < 10.0:
                    slot.status = SlotStatus.OCCUPIED
                else:
                    slot.status = SlotStatus.FREE

    # Calculate LED States for ESP32 (First 2 slots have LEDs)
    # Logic: LED ON if Booked for TODAY
    today = date.today()
    esp_leds = []
    
    # Check S1
    s1 = slots_db.get("M2-L1-S1")
    s1_booked = False
    if s1:
        # Check bookings_db for this slot and today
        if any(b.slot_id == "M2-L1-S1" and b.booking_date == today for b in bookings_db):
            s1_booked = True
    esp_leds.append(s1_booked)
    
    # Check S2
    s2 = slots_db.get("M2-L1-S2")
    s2_booked = False
    if s2:
        if any(b.slot_id == "M2-L1-S2" and b.booking_date == today for b in bookings_db):
            s2_booked = True
    esp_leds.append(s2_booked)

    return {"status": "ok", "leds": esp_leds}

@app.post("/sensor/camera")
def receive_camera_data(data: CameraSensorData):
    now = time.time()
    print(f"Received Camera Data from {data.source}: {data.statuses}")

    source_stats = camera_ingest_stats["sources"].get(data.source, {
        "messages": 0,
        "last_message_at": 0.0,
        "last_status_count": 0,
        "last_occupied_count": 0,
        "unknown_slots_last": [],
    })

    updated = 0
    occupied_count = 0
    unknown_slots = []

    for slot_id, status_str in data.statuses.items():
        slot = slots_db.get(slot_id)
        if not slot:
            unknown_slots.append(slot_id)
            continue

        normalized = str(status_str).strip().lower()
        if normalized in {"occupied", "1", "true", "yes"}:
            slot.status = SlotStatus.OCCUPIED
            occupied_count += 1
        elif normalized in {"free", "0", "false", "no"}:
            slot.status = SlotStatus.FREE
        else:
            # Unknown payload value: keep last slot status rather than forcing FREE.
            continue
        updated += 1

    source_stats["messages"] += 1
    source_stats["last_message_at"] = now
    source_stats["last_status_count"] = len(data.statuses)
    source_stats["last_occupied_count"] = occupied_count
    source_stats["unknown_slots_last"] = unknown_slots
    camera_ingest_stats["sources"][data.source] = source_stats

    camera_ingest_stats["total_messages"] += 1
    camera_ingest_stats["total_status_updates"] += updated
    camera_ingest_stats["last_message_at"] = now
    camera_ingest_stats["last_payload"] = {
        "source": data.source,
        "statuses": data.statuses,
        "received_at": now,
    }

    return {
        "status": "ok",
        "updated": updated,
        "occupied_count": occupied_count,
        "unknown_slots": unknown_slots,
    }


@app.get("/sensor/camera/health")
def camera_ingest_health():
    now = time.time()
    sources = {}
    for source, stats in camera_ingest_stats["sources"].items():
        age = now - float(stats.get("last_message_at", 0.0))
        sources[source] = {
            **stats,
            "seconds_since_last": round(age, 2),
            "stale": age > CAMERA_STALE_SECONDS,
        }

    overall_age = now - float(camera_ingest_stats.get("last_message_at", 0.0)) if camera_ingest_stats.get("last_message_at") else None
    return {
        "status": "ok",
        "camera_stale_seconds": CAMERA_STALE_SECONDS,
        "overall": {
            "total_messages": camera_ingest_stats["total_messages"],
            "total_status_updates": camera_ingest_stats["total_status_updates"],
            "seconds_since_last": round(overall_age, 2) if overall_age is not None else None,
            "stale": (overall_age is None) or (overall_age > CAMERA_STALE_SECONDS),
        },
        "sources": sources,
    }


@app.get("/sensor/camera/last_payload")
def camera_last_payload():
    return {
        "status": "ok",
        "last_payload": camera_ingest_stats.get("last_payload"),
    }


@app.get("/sensor/camera/reliability")
def camera_reliability():
    now = time.time()
    health = camera_ingest_health()
    dataset = _get_dataset_reliability(now)

    camera_ok = not bool(health.get("overall", {}).get("stale", True))
    sources = health.get("sources", {})
    any_source_alive = any(not bool(src.get("stale", True)) for src in sources.values()) if sources else False
    reliability_ok = camera_ok and any_source_alive and dataset.get("healthy", False)

    return {
        "status": "ok",
        "reliable": reliability_ok,
        "camera_pipeline": {
            "overall": health.get("overall", {}),
            "sources": sources,
            "any_source_alive": any_source_alive,
        },
        "dataset": dataset,
        "action_items": [
            "Ensure camera detector posts /sensor/camera at least every 12 seconds",
            "Add more Not cars images captured from Pi camera viewpoint",
            "Keep Cars/Not cars ratio under configured maximum",
        ],
    }

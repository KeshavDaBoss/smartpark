from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date, datetime
import uuid

# --- Enums & Helpers ---

class UserType:
    NORMAL = "normal"
    DISABLED = "disabled"
    ELDERLY = "elderly"

class SlotStatus:
    FREE = "free"
    OCCUPIED = "occupied"
    BOOKED = "booked"

# --- Models ---

class UserBase(BaseModel):
    username: str
    is_disabled: bool = False
    is_elderly: bool = False

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    # Simplified auth for demo: plain password or simple hash
    password: str 

class Booking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    slot_id: str
    user_id: str
    booking_date: date
    created_at: datetime = Field(default_factory=datetime.now)

class Slot(BaseModel):
    id: str  # e.g., "M1-L1-S1"
    mall_id: str
    level_id: int
    slot_number: int
    is_reserved_disabled: bool = False
    is_reserved_elderly: bool = False
    status: str = SlotStatus.FREE
    
    # Coordinates for UI (optional, or handled by frontend map)
    # x: int
    # y: int

class BookingRequest(BaseModel):
    slot_id: str
    user_id: str
    booking_date: str # "DDMMYYYY" format as requested, or ISO date

class SensorData(BaseModel):
    # Flexible input from ESP32 or Pi
    # Mapping of pin/index to distance or status
    distances: List[float]
    source: str # "esp32_mall2" or "pi_mall1"

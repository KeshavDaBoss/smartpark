from typing import List, Dict, Optional
from .models import User, Slot, SlotStatus, Booking
import uuid

# --- In-Memory Storage (Mock DB) ---

users_db: Dict[str, User] = {}
slots_db: Dict[str, Slot] = {}
bookings_db: List['Booking'] = []

def init_db():
    """Initialize the slots database with the static configuration."""
    # Mall 1: Level 1 (Pi)
    # M1-L1-S1 (Bookable)
    create_slot("M1-L1-S1", "mall1", 1, 1, False, False)
    # M1-L1-S2 (Bookable)
    create_slot("M1-L1-S2", "mall1", 1, 2, False, False)
    # M1-L1-S3 (Disabled)
    create_slot("M1-L1-S3", "mall1", 1, 3, True, False)
    # M1-L1-S4 (Elderly)
    create_slot("M1-L1-S4", "mall1", 1, 4, False, True)

    # Mall 1: Level 2 (Pi) - 4 slots (Normal)
    for i in range(5, 9):
        create_slot(f"M1-L2-S{i}", "mall1", 2, i, False, False)

    # Mall 2: Level 1 (ESP32)
    # create_slot("M2-L1-S1", "mall2", 1, 1, False, False)
    create_slot("M2-L1-S1", "mall2", 1, 1, False, False)
    create_slot("M2-L1-S2", "mall2", 1, 2, False, False)
    # S3, S4 Normal
    create_slot("M2-L1-S3", "mall2", 1, 3, False, False)
    create_slot("M2-L1-S4", "mall2", 1, 4, False, False)

    # Premade Users
    # user1 (normal)
    users_db["user1"] = User(id="user1", username="user1", password="password", is_disabled=False, is_elderly=False)
    # user2 (disabled)
    users_db["user2"] = User(id="user2", username="user2", password="password", is_disabled=True, is_elderly=False)
    # user3 (elderly)
    users_db["user3"] = User(id="user3", username="user3", password="password", is_disabled=False, is_elderly=True)

    print(f"Initialized {len(slots_db)} slots and {len(users_db)} users.")

def create_slot(slot_id, mall_id, level, number, disabled, elderly):
    slots_db[slot_id] = Slot(
        id=slot_id,
        mall_id=mall_id,
        level_id=level,
        slot_number=number,
        is_reserved_disabled=disabled,
        is_reserved_elderly=elderly
    )

def get_slot(slot_id) -> Optional[Slot]:
    return slots_db.get(slot_id)

def get_user_by_username(username) -> Optional[User]:
    for user in users_db.values():
        if user.username == username:
            return user
    return None

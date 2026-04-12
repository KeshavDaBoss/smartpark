const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

async function parseJsonSafe(response) {
    const raw = await response.text();
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return { detail: raw };
    }
}

async function requestJson(path, options = {}) {
    let response;
    try {
        response = await fetch(`${BASE_URL}${path}`, options);
    } catch {
        throw new Error('Cannot reach backend API. Check backend server and API URL.');
    }

    const data = await parseJsonSafe(response);

    if (!response.ok) {
        const message = data?.detail || data?.message || `Request failed (${response.status})`;
        throw new Error(message);
    }

    return data ?? {};
}

export async function loginUser(username, password) {
    return requestJson('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
}

export async function signupUser(username, password, isDisabled, isElderly) {
    return requestJson('/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username,
            password,
            is_disabled: isDisabled,
            is_elderly: isElderly
        })
    });
}

export async function getSlots(dateStr, userId) {
    let url = `${BASE_URL}/slots?date=${dateStr}`;
    if (userId) {
        url += `&user_id=${userId}`;
    }
    let response;
    try {
        response = await fetch(url);
    } catch {
        throw new Error('Cannot reach backend API. Check backend server and API URL.');
    }
    const data = await parseJsonSafe(response);
    if (!response.ok) throw new Error(data?.detail || `Failed to fetch slots (${response.status})`);
    return data ?? [];
}

export async function bookSlot(slotId, userId, dateStr) {
    return requestJson('/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            slot_id: slotId,
            user_id: userId,
            booking_date: dateStr
        })
    });
}

export async function cancelBooking(slotId, userId, dateStr) {
    return requestJson('/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_id: slotId, user_id: userId, date: dateStr })
    });
}

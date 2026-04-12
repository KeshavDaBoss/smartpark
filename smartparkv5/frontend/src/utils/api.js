const BASE_URL = '/api';

export async function loginUser(username, password) {
    const response = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (!response.ok) {
        throw new Error('Login failed');
    }
    return response.json();
}

export async function signupUser(username, password, isDisabled, isElderly) {
    const response = await fetch(`${BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username,
            password,
            is_disabled: isDisabled,
            is_elderly: isElderly
        })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Signup failed');
    }
    return response.json();
}

export async function getSlots(dateStr, userId) {
    let url = `${BASE_URL}/slots?date=${dateStr}`;
    if (userId) {
        url += `&user_id=${userId}`;
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch slots');
    return response.json();
}

export async function bookSlot(slotId, userId, dateStr) {
    const response = await fetch(`${BASE_URL}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            slot_id: slotId,
            user_id: userId,
            booking_date: dateStr
        })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Booking failed');
    }
    return response.json();
}

export async function cancelBooking(slotId, userId, dateStr) {
    const response = await fetch(`${BASE_URL}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_id: slotId, user_id: userId, date: dateStr })
    });
    if (!response.ok) throw new Error('Cancellation failed');
    return response.json();
}

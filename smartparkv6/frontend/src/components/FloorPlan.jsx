import React, { useRef, useEffect, useState } from 'react';
import { bookSlot } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { findPath } from '../utils/astar';

export default function FloorPlan({ mallId, level, slots, refreshSlots, onNavigate }) {
    const { user } = useAuth();
    const isMall2 = mallId === 'mall2';
    const [path, setPath] = useState(null);
    const [activeNavSlotId, setActiveNavSlotId] = useState(null);
    const [bookingStatus, setBookingStatus] = useState(null);

    const currentSlots = slots.filter(s => s.mall_id === mallId && s.level_id === parseInt(level, 10));
    currentSlots.sort((a, b) => a.slot_number - b.slot_number);

    // Reset path when level changes
    useEffect(() => {
        setPath(null);
        setActiveNavSlotId(null);
    }, [level, mallId]);

    useEffect(() => {
        if (onNavigate) {
            handleAutoNavigation();
        }
    }, [onNavigate]);

    const handleAutoNavigation = () => {
        const myBooking = currentSlots.find(s => s.is_my_booking);
        if (myBooking) {
            const p = getPathToSlotEdge(myBooking.id);
            setPath(p);
            setActiveNavSlotId(myBooking.id);
            setBookingStatus(null);
            return;
        }

        // Helper to check if a slot is truly available for the current user
        const isSlotAvailable = (s) => {
            if (s.status !== 'free') return false;
            if (s.is_reserved_disabled && !user.is_disabled) return false;
            if (s.is_reserved_elderly && !user.is_elderly) return false;
            return true;
        };

        const availableSlotsOnLevel = currentSlots.filter(isSlotAvailable);

        if (availableSlotsOnLevel.length > 0) {
            availableSlotsOnLevel.sort((a, b) => a.slot_number - b.slot_number);
            const targetSlot = availableSlotsOnLevel[0];
            const p = getPathToSlotEdge(targetSlot.id);
            setPath(p);
            setActiveNavSlotId(targetSlot.id);
            setBookingStatus(null);
        } else {
            // Check if there are slots on OTHER levels in the same mall
            const allMallSlots = slots.filter(s => s.mall_id === mallId);
            const availableAnywhere = allMallSlots.filter(isSlotAvailable);

            if (availableAnywhere.length > 0) {
                // Determine which level has space
                const otherLevelSlots = availableAnywhere.filter(s => s.level_id !== parseInt(level, 10));
                if (otherLevelSlots.length > 0) {
                    const targetLevel = otherLevelSlots[0].level_id;
                    setBookingStatus({ type: 'error', text: `No slots available on this level. Please go to Level ${targetLevel}.` });
                } else {
                    // Should imply slots are available but somehow not on other levels? 
                    // This branch implies availableAnywhere > 0 but !otherLevelSlots... 
                    // meaning they must be on THIS level, but we failed check above? 
                    // Should be impossible safely.
                    setBookingStatus({ type: 'error', text: 'No slots available.' });
                }
            } else {
                setBookingStatus({ type: 'error', text: 'No slots available in the entire mall.' });
            }
        }
    };

    const handleBookClick = async (slot) => {
        try {
            const dateObj = new Date();
            const dd = String(dateObj.getDate()).padStart(2, '0');
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const yyyy = dateObj.getFullYear();
            const dateStr = `${dd}${mm}${yyyy}`;

            await bookSlot(slot.id, user.user_id, dateStr);
            setBookingStatus({ type: 'success', text: `Booked Slot ${slot.slot_number} successfully.` });
            refreshSlots();
        } catch (e) {
            setBookingStatus({ type: 'error', text: e.message || 'Failed to book slot.' });
        }
    };

    const handleNavigateClick = (slot) => {
        if (path && activeNavSlotId === slot.id) {
            setPath(null);
            setActiveNavSlotId(null);
            return;
        }
        const p = getPathToSlotEdge(slot.id);
        setPath(p);
        setActiveNavSlotId(slot.id);
    };

    const canShowBookButton = (slot) => {
        if (slot.mall_id === 'mall2') return false; // Bookings disabled for Mall 2
        if (slot.is_reserved_disabled || slot.is_reserved_elderly) return false;
        if (slot.slot_number === 1 || slot.slot_number === 2) return true;
        return false;
    };

    const canShowNavigateButton = (slot) => {
        if (slot.status === 'occupied') return false;
        if (slot.is_my_booking) return true;
        if (slot.status === 'booked' && !slot.is_my_booking) return false;
        if (slot.is_reserved_disabled && !user.is_disabled) return false;
        if (slot.is_reserved_elderly && !user.is_elderly) return false;
        return true;
    };

    const generatePathString = (points) => {
        if (!points || points.length < 2) return "";
        let path = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            path += ` L ${points[i].x} ${points[i].y}`;
        }
        return path;
    };

    const getStatusColor = (slot) => {
        if (slot.is_my_booking) return 'var(--status-my-booking)';
        if (slot.status === 'occupied') return 'var(--status-occupied)';
        if (slot.status === 'booked') return 'var(--status-booked)';
        if (slot.is_reserved_disabled) return 'var(--status-disabled)';
        if (slot.is_reserved_elderly) return 'var(--status-elderly)';
        return 'var(--status-free)';
    };

    const getStatusLabel = (slot) => {
        if (slot.is_my_booking) return 'My Booking';
        if (slot.status === 'occupied') return 'Occupied';
        if (slot.status === 'booked') return 'Booked';
        return 'Available';
    };

    const slotCoordinates = (slotId) => {
        const map = {
            'M1-L1-S1': { x: 270, y: 120 },
            'M1-L1-S2': { x: 480, y: 120 },
            'M1-L1-S3': { x: 820, y: 120 },
            'M1-L1-S4': { x: 1030, y: 120 },
            'M1-L2-S5': { x: 270, y: 120 },
            'M1-L2-S6': { x: 480, y: 120 },
            'M1-L2-S7': { x: 820, y: 120 },
            'M1-L2-S8': { x: 1030, y: 120 },
            'M2-L1-S1': { x: 290, y: 120 },
            'M2-L1-S2': { x: 500, y: 120 },
            'M2-L1-S3': { x: 850, y: 120 },
            'M2-L1-S4': { x: 1050, y: 120 },
        };
        return map[slotId] || { x: 270, y: 120 };
    };

    const SLOT_WIDTH = 150;
    const SLOT_HEIGHT = 240;
    const SLOT_TOP_SHIFT = 70;
    const SLOT_BOTTOM_OFFSET = SLOT_HEIGHT - SLOT_TOP_SHIFT;

    const getPathToSlotEdge = (slotId) => {
        const raw = findPath('ENTRY', slotId);
        if (!raw || raw.length < 2) return raw;

        const slotPos = slotCoordinates(slotId);
        const target = { x: slotPos.x, y: slotPos.y + SLOT_BOTTOM_OFFSET };
        const clipped = [...raw.slice(0, -1)];
        const prev = clipped[clipped.length - 1];

        // Keep final leg cleanly orthogonal while ending at bottom-center.
        if (prev && prev.x !== target.x && prev.y !== target.y) {
            clipped.push({ x: target.x, y: prev.y });
        }

        clipped.push(target);
        return clipped;
    };

    const renderSlot = (slot) => {
        const showBook = canShowBookButton(slot);
        const showNav = canShowNavigateButton(slot);
        const isActiveNavSlot = path && activeNavSlotId === slot.id;
        const position = slotCoordinates(slot.id);
        const statusColor = getStatusColor(slot);
        const slotBadge = slot.is_reserved_disabled ? 'accessible' : slot.is_reserved_elderly ? 'elderly' : null;

        return (
            <div
                key={slot.id}
                className={`sp-slot-card ${isActiveNavSlot ? 'sp-nav-active' : ''}`}
                style={{
                    position: 'absolute',
                    left: `${position.x - 75}px`,
                    top: `${position.y - SLOT_TOP_SHIFT}px`,
                    width: `${SLOT_WIDTH}px`,
                    height: `${SLOT_HEIGHT}px`,
                    border: `2px solid ${statusColor}`,
                    background: 'rgba(19,19,19,0.96)',
                    borderRadius: '14px',
                    display: 'grid',
                    gridTemplateRows: '1fr auto',
                    padding: '0.7rem',
                    boxShadow: 'none',
                    zIndex: 4
                }}
            >
                <div style={{ textAlign: 'center', display: 'grid', alignContent: 'center', gap: '0.15rem' }}>
                    {slotBadge && (
                        <span className="material-symbols-outlined" style={{ color: statusColor, fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" }}>
                            {slotBadge}
                        </span>
                    )}
                    <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '2.1rem', fontWeight: 700, lineHeight: 1, color: statusColor }}>
                        S{slot.slot_number}
                    </span>
                    <span style={{ color: statusColor, fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                        {getStatusLabel(slot)}
                    </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: showBook && showNav ? '1fr 1fr' : '1fr', gap: '0.35rem' }}>
                    {showBook && (
                        <button
                            onClick={() => handleBookClick(slot)}
                            style={{
                                border: `1px solid ${statusColor}`,
                                background: 'transparent',
                                color: statusColor,
                                borderRadius: '8px',
                                padding: '0.32rem 0.35rem',
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                textTransform: 'uppercase'
                            }}
                        >
                            Book
                        </button>
                    )}
                    {showNav && (
                        <button
                            onClick={() => handleNavigateClick(slot)}
                            style={{
                                border: `1px solid ${isActiveNavSlot ? 'var(--error)' : statusColor}`,
                                background: isActiveNavSlot ? 'rgba(255,110,132,0.12)' : 'transparent',
                                color: isActiveNavSlot ? 'var(--error)' : statusColor,
                                borderRadius: '8px',
                                padding: '0.32rem 0.35rem',
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                textTransform: 'uppercase'
                            }}
                        >
                            {isActiveNavSlot ? 'Stop' : 'Navigate'}
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const containerRef = useRef(null);
    const viewportRef = useRef(null);
    const CONTENT_WIDTH = isMall2 ? 1280 : 1300;
    const CONTENT_HEIGHT = 500;
    const effectiveScale = 1;

    return (
        <div style={{ width: '100%', margin: '0 auto' }}>
            {bookingStatus && (
                <div className="sp-card" style={{ padding: '0.8rem 1rem', marginBottom: '0.8rem', borderColor: bookingStatus.type === 'error' ? 'rgba(255,110,132,0.45)' : 'rgba(128,249,200,0.45)', color: bookingStatus.type === 'error' ? 'var(--error)' : 'var(--status-free)' }}>
                    {bookingStatus.text}
                </div>
            )}

            <div
                ref={viewportRef}
                style={{
                    width: '100%',
                    maxWidth: '100%',
                    overflow: 'auto',
                    borderRadius: '24px',
                    border: '1px solid rgba(72,72,71,0.42)',
                    maxHeight: '74vh'
                }}
            >
                <div
                    ref={containerRef}
                    style={{
                        width: `${CONTENT_WIDTH * effectiveScale}px`,
                        height: `${CONTENT_HEIGHT * effectiveScale}px`,
                        position: 'relative',
                        minWidth: `${CONTENT_WIDTH * effectiveScale}px`
                    }}
                >
                    <div
                        style={{
                            width: `${CONTENT_WIDTH}px`,
                            height: `${CONTENT_HEIGHT}px`,
                            position: 'relative',
                            borderRadius: '24px',
                            background: 'radial-gradient(circle at 20% 10%, rgba(224,142,254,0.08), transparent 35%), var(--surface-low)',
                            transform: `scale(${effectiveScale})`,
                            transformOrigin: 'top left'
                        }}
                    >
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.03) 1px, transparent 0)',
                            backgroundSize: '40px 40px',
                            pointerEvents: 'none',
                            zIndex: 0
                        }}
                    />

                    <div
                        style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: '340px',
                            height: '120px',
                            background: 'linear-gradient(180deg, rgba(38,38,38,0.95) 0%, rgba(27,27,27,0.98) 50%, rgba(38,38,38,0.95) 100%)',
                            borderTop: '1px solid rgba(255,255,255,0.16)',
                            borderBottom: '1px solid rgba(255,255,255,0.16)',
                            boxShadow: 'inset 0 10px 14px rgba(0,0,0,0.28), inset 0 -10px 14px rgba(0,0,0,0.28)',
                            zIndex: 1
                        }}
                    />

                    <div
                        style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: '398px',
                            borderTop: '2px dashed rgba(255,255,255,0.18)',
                            zIndex: 2,
                            pointerEvents: 'none'
                        }}
                    />

                    <div
                        style={{
                            position: 'absolute',
                            left: isMall2 ? '620px' : '590px',
                            top: '0px',
                            width: '120px',
                            height: '340px',
                            background: 'linear-gradient(90deg, rgba(38,38,38,0.95) 0%, rgba(27,27,27,0.98) 50%, rgba(38,38,38,0.95) 100%)',
                            borderLeft: '1px solid rgba(255,255,255,0.16)',
                            borderRight: '1px solid rgba(255,255,255,0.16)',
                            boxShadow: 'inset 10px 0 14px rgba(0,0,0,0.28), inset -10px 0 14px rgba(0,0,0,0.28)',
                            zIndex: 2
                        }}
                    />

                    <div
                        style={{
                            position: 'absolute',
                            left: isMall2 ? '680px' : '650px',
                            top: '0px',
                            height: '340px',
                            borderLeft: '2px dashed rgba(255,255,255,0.18)',
                            zIndex: 3,
                            pointerEvents: 'none'
                        }}
                    />

                    <div
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: '336px',
                            width: '56px',
                            height: '128px',
                            borderRadius: '0 12px 12px 0',
                            background: 'var(--status-free)',
                            color: '#083021',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            letterSpacing: '0.25em',
                            writingMode: 'vertical-rl',
                            transform: 'rotate(180deg)',
                            display: 'grid',
                            placeItems: 'center',
                            zIndex: 3
                        }}
                    >
                        ENTRY
                    </div>

                    {currentSlots.map((slot) => renderSlot(slot))}

                    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
                        {path && (
                            <path
                                d={generatePathString(path)}
                                fill="none"
                                stroke="var(--status-free)"
                                strokeWidth="8"
                                strokeDasharray="14,10"
                                strokeLinecap="butt"
                                strokeLinejoin="round"
                                style={{ filter: 'none' }}
                            >
                                <animate attributeName="stroke-dashoffset" from="50" to="0" dur="1s" repeatCount="indefinite" />
                            </path>
                        )}
                    </svg>
                    </div>
                </div>
            </div>
        </div>
    );
}

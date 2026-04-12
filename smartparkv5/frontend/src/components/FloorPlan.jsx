import React, { useRef, useEffect, useState } from 'react';
import { bookSlot } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { findPath } from '../utils/astar';

export default function FloorPlan({ mallId, level, slots, refreshSlots, onNavigate }) {
    const { user } = useAuth();
    const [path, setPath] = useState(null);
    const [bookingDate, setBookingDate] = useState('today');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [selectedSlotForBooking, setSelectedSlotForBooking] = useState(null);

    const currentSlots = slots.filter(s => s.mall_id === mallId && s.level_id === parseInt(level));
    currentSlots.sort((a, b) => a.slot_number - b.slot_number);

    // Reset path when level changes
    useEffect(() => {
        setPath(null);
    }, [level, mallId]);

    useEffect(() => {
        if (onNavigate) {
            handleAutoNavigation();
        }
    }, [onNavigate]);

    const handleAutoNavigation = () => {
        const myBooking = currentSlots.find(s => s.is_my_booking);
        if (myBooking) {
            const p = findPath('ENTRY', myBooking.id);
            setPath(p);
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
            const p = findPath('ENTRY', targetSlot.id);
            setPath(p);
        } else {
            // Check if there are slots on OTHER levels in the same mall
            const allMallSlots = slots.filter(s => s.mall_id === mallId);
            const availableAnywhere = allMallSlots.filter(isSlotAvailable);

            if (availableAnywhere.length > 0) {
                // Determine which level has space
                const otherLevelSlots = availableAnywhere.filter(s => s.level_id !== parseInt(level));
                if (otherLevelSlots.length > 0) {
                    const targetLevel = otherLevelSlots[0].level_id;
                    alert(`No slots available on this level. Please go to Level ${targetLevel}.`);
                } else {
                    // Should imply slots are available but somehow not on other levels? 
                    // This branch implies availableAnywhere > 0 but !otherLevelSlots... 
                    // meaning they must be on THIS level, but we failed check above? 
                    // Should be impossible safely.
                    alert("No slots available.");
                }
            } else {
                alert("No slots available in the entire mall.");
            }
        }
    };

    const handleBookClick = (slot) => {
        setSelectedSlotForBooking(slot);
        setShowModal(true);
    };

    const handleNavigateClick = (slot) => {
        const p = findPath('ENTRY', slot.id);
        setPath(p);
    };

    const getFormattedDate = (isTomorrow) => {
        const d = new Date();
        if (isTomorrow) d.setDate(d.getDate() + 1);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    };

    const confirmBooking = async () => {
        try {
            const dateObj = new Date();
            if (bookingDate === 'tomorrow') dateObj.setDate(dateObj.getDate() + 1);

            const dd = String(dateObj.getDate()).padStart(2, '0');
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const yyyy = dateObj.getFullYear();
            const dateStr = `${dd}${mm}${yyyy}`;

            await bookSlot(selectedSlotForBooking.id, user.user_id, dateStr);
            alert("Booking Successful!");
            setShowModal(false);
            refreshSlots();
        } catch (e) {
            alert(e.message);
        }
    };

    const canShowBookButton = (slot) => {
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

    // Helper to render a slot
    const renderSlot = (slot) => {
        const showBook = canShowBookButton(slot);
        const showNav = canShowNavigateButton(slot);

        let Icon = null;
        if (slot.is_reserved_disabled) Icon = <img src="/accessible_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.png" style={{ width: '50px' }} />;
        else if (slot.is_reserved_elderly) Icon = <img src="/elderly_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.png" style={{ width: '50px' }} />;

        let statusColor = 'var(--slot-free)';
        let borderColor = 'transparent';

        if (slot.status === 'free') {
            if (slot.is_reserved_disabled) statusColor = '#f57c00';
            else if (slot.is_reserved_elderly) statusColor = '#fbc02d';
            else statusColor = '#2e7d32';
        } else if (slot.status === 'occupied') {
            statusColor = '#1a1a1a';
            borderColor = '#d32f2f'; // Red Border
        } else if (slot.status === 'booked') {
            statusColor = '#1565c0';
        }

        if (slot.is_my_booking) {
            statusColor = '#5e35b1';
        }

        return (
            <div key={slot.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                    width: '200px', height: '160px',
                    backgroundColor: '#222',
                    position: 'relative',
                    display: 'flex', flexDirection: 'column', alignItems: 'center'
                }}>
                    <div style={{
                        width: '85%', height: '100%',
                        borderLeft: `2px solid #555`,
                        borderRight: `2px solid #555`,
                        borderTop: `2px solid #555`,
                        position: 'relative',
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        background: '#222'
                    }}>
                        <div style={{
                            width: '90%', height: '90%',
                            backgroundColor: statusColor,
                            border: `4px solid ${borderColor}`,
                            borderRadius: '6px',
                            opacity: slot.status === 'occupied' ? 1 : 0.9,
                            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                            boxShadow: slot.is_my_booking ? '0 0 20px #5e35b1' : 'inset 0 0 10px rgba(0,0,0,0.5)'
                        }}>
                            {Icon}
                            {!Icon && <span style={{ fontSize: '3rem', fontWeight: '800', color: 'rgba(255,255,255,0.9)' }}>{slot.slot_number}</span>}
                        </div>
                    </div>

                    <div style={{
                        position: 'absolute', bottom: '-50px',
                        display: 'flex', gap: '8px', zIndex: 10
                    }}>
                        {showBook && (
                            <button onClick={() => handleBookClick(slot)} style={{
                                background: '#000', border: '1px solid #444',
                                fontSize: '0.8rem', padding: '6px 12px', fontWeight: 'bold'
                            }}>
                                BOOK
                            </button>
                        )}
                        {showNav && (
                            <button onClick={() => handleNavigateClick(slot)} style={{
                                background: '#000', border: '1px solid #444',
                                fontSize: '0.8rem', padding: '6px 12px', fontWeight: 'bold'
                            }}>
                                NAVIGATE
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const isBookedToday = selectedSlotForBooking?.status === 'booked';

    // Responsive Scaling Logic
    const containerRef = useRef(null);
    const [scale, setScale] = useState(1);
    const CONTENT_WIDTH = 1300; // Approx width of the floor plan content (4 slots + gaps)

    useEffect(() => {
        const handleResize = () => {
            // Calculate scale based on window width allowing for some padding
            // We use Math.min to never scale UP above 1 (desktop view preserved)
            const padding = 40;
            const availableWidth = window.innerWidth - padding;
            const newScale = Math.min(1, availableWidth / CONTENT_WIDTH);
            setScale(newScale);
        };

        handleResize(); // Initial calculation
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', overflow: 'hidden' }}>
            {path && (
                <div style={{ textAlign: 'right', marginBottom: '10px' }}>
                    <button
                        onClick={() => setPath(null)}
                        style={{ background: '#ff4d4d', fontSize: '0.9rem', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    >
                        ✖ Stop Navigating
                    </button>
                </div>
            )}

            <div
                ref={containerRef}
                style={{
                    background: '#1a1a1a',
                    borderRadius: '20px',
                    position: 'relative',
                    minHeight: '500px',
                    height: '500px', // Fixed internal height
                    boxShadow: '0 0 20px rgba(0,0,0,0.5)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden',

                    // Scaling Props
                    width: `${CONTENT_WIDTH}px`, // Fixed internal width
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left', // Scale from top-left
                    marginBottom: `-${500 * (1 - scale)}px`, // Negative margin to remove whitespace below scaled element
                    // We need to handle centering manually if we use top-left, 
                    // OR we use top-center and margin-left difference...
                    // Let's stick to top-left and let the parent handle X-scrolling if needed? 
                    // No user said "fit completely".
                    // If we scale to fit width, top-left starts at 0. Perfect.
                }}
            >
                {/* Visual Road - Bigger */}
                <div style={{
                    position: 'absolute', bottom: '40px', left: 0, width: '100%',
                    height: '120px',
                    background: '#2c2c2c',
                    borderTop: '6px dashed #555', // Thicker dash
                    borderBottom: '6px dashed #555',
                    zIndex: 0
                }}></div>

                {/* Entry Label - Aligned exact height */}
                <div style={{
                    position: 'absolute', left: 0, bottom: '33px', // Shifted down to center larger height
                    height: '146px', // Increased to safely cover road + borders + slight overlap
                    background: '#4caf50', color: '#000',
                    width: '60px',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    borderRadius: '0 12px 12px 0',
                    fontWeight: '900', zIndex: 5,
                    boxShadow: '4px 0 10px rgba(0,0,0,0.5)',
                    writingMode: 'vertical-rl',
                    letterSpacing: '5px',
                    transform: 'rotate(180deg)'
                }}>
                    ENTRY
                </div>

                {/* Slots Row with Vertical Road Gap */}
                <div style={{
                    display: 'flex', justifyContent: 'center', gap: '10px',
                    marginBottom: '20px', marginTop: '40px',
                    zIndex: 1, position: 'relative',
                    padding: '0 40px'
                }}>
                    {/* Slot 1 */}
                    {currentSlots[0] && renderSlot(currentSlots[0])}

                    {/* Slot 2 */}
                    {currentSlots[1] && renderSlot(currentSlots[1])}

                    {/* The Vertical Road Gap */}
                    <div style={{
                        width: '120px', // Road width
                        height: '160px', // Matches slot height
                        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                        position: 'relative'
                    }}>
                        {/* Connecting Road Paint - Vertical Part */}
                        <div style={{
                            width: '80px', height: '100%', margin: '0 20px', // Fixed absolute pixels for alignment
                            background: '#2c2c2c',
                            borderLeft: '6px dashed #555',
                            borderRight: '6px dashed #555',
                            borderBottom: 'none',
                            zIndex: 1
                        }}>
                        </div>

                        {/* Connector Patch to Main Road */}
                        <div style={{
                            position: 'absolute',
                            bottom: '-150px',
                            left: '20px', // Matches the 20px margin above
                            width: '80px', // Matches 80px width above
                            height: '150px',
                            background: '#2c2c2c',
                            borderLeft: '6px dashed #555',
                            borderRight: '6px dashed #555',
                            zIndex: 1
                        }}></div>

                        {/* Hider Patch for Main Road Top Border */}
                        <div style={{
                            position: 'absolute',
                            bottom: '-138px',
                            left: '26px', // 20px (offset) + 6px (border) = 26px
                            width: '68px', // 80px (width) - 12px (borders) = 68px
                            height: '20px',
                            background: '#2c2c2c',
                            zIndex: 2
                        }}></div>
                    </div>

                    {/* Slot 3 */}
                    {currentSlots[2] && renderSlot(currentSlots[2])}

                    {/* Slot 4 */}
                    {currentSlots[3] && renderSlot(currentSlots[3])}

                </div>

                {/* Path SVG Layer */}
                <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}>
                    {path && (
                        <path
                            d={generatePathString(path)}
                            fill="none"
                            stroke="#4caf50"
                            strokeWidth="8"
                            strokeDasharray="15,10"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ filter: 'drop-shadow(0 0 5px #000)' }}
                        >
                            <animate attributeName="stroke-dashoffset" from="50" to="0" dur="1s" repeatCount="indefinite" />
                        </path>
                    )}
                </svg>
            </div>

            {/* Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.9)', zIndex: 200,
                    display: 'flex', justifyContent: 'center', alignItems: 'center'
                }}>
                    <div className="card" style={{ width: '400px', background: '#1e1e1e', border: '1px solid #333' }}>
                        <h3 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Confirm Booking</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                            <button
                                disabled={isBookedToday}
                                onClick={() => setBookingDate('today')}
                                style={{
                                    background: bookingDate === 'today' ? 'var(--primary)' : '#2a2a2a',
                                    opacity: isBookedToday ? 0.4 : 1,
                                    cursor: isBookedToday ? 'not-allowed' : 'pointer',
                                    border: bookingDate === 'today' ? '2px solid var(--accent)' : '2px solid transparent',
                                    display: 'flex', justifyContent: 'space-between', padding: '15px'
                                }}
                            >
                                <span style={{ fontWeight: 'bold' }}>Today</span>
                                <span>{getFormattedDate(false)}</span>
                            </button>
                            <button
                                onClick={() => setBookingDate('tomorrow')}
                                style={{
                                    background: bookingDate === 'tomorrow' ? 'var(--primary)' : '#2a2a2a',
                                    border: bookingDate === 'tomorrow' ? '2px solid var(--accent)' : '2px solid transparent',
                                    display: 'flex', justifyContent: 'space-between', padding: '15px'
                                }}
                            >
                                <span style={{ fontWeight: 'bold' }}>Tomorrow</span>
                                <span>{getFormattedDate(true)}</span>
                            </button>
                        </div>
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <button onClick={confirmBooking} style={{ flex: 1, background: '#2e7d32', padding: '12px' }}>CONFIRM</button>
                            <button onClick={() => setShowModal(false)} style={{ flex: 1, background: '#c62828', padding: '12px' }}>CANCEL</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

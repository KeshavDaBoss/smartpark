// Graph for "Left to Right" layout with Central Road Gap
// Container Logical Space: 1200 width.
// Road Y-Center: 400.
// Slot Curb Y: 280.

// New Layout: [Slot1] [Slot2] [GAP] [Slot3] [Slot4]
// Visual estimations for gap:
// Slot width ~200px. Gap ~100px?
// Let's assume centered gap.
// S1 Center: 200
// S2 Center: 420
// GAP Center: 600 (Road connection)
// S3 Center: 780
// S4 Center: 1000

const ROAD_Y = 400;
const SLOT_CURB_Y = 280;

const NODES_GRAPH = {
    'ENTRY': { x: 20, y: ROAD_Y, adj: ['PATH_MAIN'] },
    'PATH_MAIN': { x: 600, y: ROAD_Y, adj: ['ENTRY', 'S1_NODE', 'S2_NODE', 'S3_NODE', 'S4_NODE'] },

    // Adjusted X coordinates for the gap
    'S1_NODE': { x: 180, y: ROAD_Y, adj: ['PATH_MAIN'] },
    'S2_NODE': { x: 410, y: ROAD_Y, adj: ['PATH_MAIN'] },

    // S3 and S4 shifted right by the gap
    'S3_NODE': { x: 790, y: ROAD_Y, adj: ['PATH_MAIN'] },
    'S4_NODE': { x: 1020, y: ROAD_Y, adj: ['PATH_MAIN'] },
};

// Map real Slot IDs to abstract graph nodes
const SLOT_MAP = {
    // Mall 1 Level 1
    'M1-L1-S1': { x: 180, y: SLOT_CURB_Y, entry: 'S1_NODE' },
    'M1-L1-S2': { x: 410, y: SLOT_CURB_Y, entry: 'S2_NODE' },
    'M1-L1-S3': { x: 790, y: SLOT_CURB_Y, entry: 'S3_NODE' },
    'M1-L1-S4': { x: 1020, y: SLOT_CURB_Y, entry: 'S4_NODE' },

    // Mall 1 Level 2
    'M1-L2-S5': { x: 180, y: SLOT_CURB_Y, entry: 'S1_NODE' },
    'M1-L2-S6': { x: 410, y: SLOT_CURB_Y, entry: 'S2_NODE' },
    'M1-L2-S7': { x: 790, y: SLOT_CURB_Y, entry: 'S3_NODE' },
    'M1-L2-S8': { x: 1020, y: SLOT_CURB_Y, entry: 'S4_NODE' },

    // Mall 2 Level 1
    'M2-L1-S1': { x: 180, y: SLOT_CURB_Y, entry: 'S1_NODE' },
    'M2-L1-S2': { x: 410, y: SLOT_CURB_Y, entry: 'S2_NODE' },
    'M2-L1-S3': { x: 790, y: SLOT_CURB_Y, entry: 'S3_NODE' },
    'M2-L1-S4': { x: 1020, y: SLOT_CURB_Y, entry: 'S4_NODE' },
};

export const NODES = {};

export function findPath(startId, endSlotId) {
    const target = SLOT_MAP[endSlotId];
    if (!target) return [];

    const p1 = NODES_GRAPH['ENTRY'];
    const p2 = NODES_GRAPH[target.entry];
    const p3 = { x: target.x, y: target.y };

    return [p1, p2, p3];
}

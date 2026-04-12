// Graph for "Left to Right" layout with Central Road Gap
// Mall 1 (4-slot, 1300px): [S1] [S2] [GAP] [S3] [S4]
// Mall 2 (6-slot, 1500px): [S1] [S2] [S3] [GAP] [S4] [S5] [S6]

const ROAD_Y = 400;
const SLOT_CURB_Y = 260;

const NODES_GRAPH = {
    'ENTRY': { x: 30, y: ROAD_Y, adj: ['PATH_MAIN'] },
    'PATH_MAIN': { x: 650, y: ROAD_Y, adj: ['ENTRY', 'S1_NODE', 'S2_NODE', 'S3_NODE', 'S4_NODE', 'S5_NODE', 'S6_NODE'] },

    // Mall 1 nodes (1300px layout, 4 slots)
    'S1_NODE': { x: 270, y: ROAD_Y, adj: ['PATH_MAIN'] },
    'S2_NODE': { x: 480, y: ROAD_Y, adj: ['PATH_MAIN'] },
    'S3_NODE': { x: 820, y: ROAD_Y, adj: ['PATH_MAIN'] },
    'S4_NODE': { x: 1030, y: ROAD_Y, adj: ['PATH_MAIN'] },

    // Mall 2 extra nodes (1500px layout, 6 slots)
    'S5_NODE': { x: 1130, y: ROAD_Y, adj: ['PATH_MAIN'] },
    'S6_NODE': { x: 1340, y: ROAD_Y, adj: ['PATH_MAIN'] },
};

// Map real Slot IDs to abstract graph nodes
const SLOT_MAP = {
    // Mall 1 Level 1
    'M1-L1-S1': { x: 270, y: SLOT_CURB_Y, entry: 'S1_NODE' },
    'M1-L1-S2': { x: 480, y: SLOT_CURB_Y, entry: 'S2_NODE' },
    'M1-L1-S3': { x: 820, y: SLOT_CURB_Y, entry: 'S3_NODE' },
    'M1-L1-S4': { x: 1030, y: SLOT_CURB_Y, entry: 'S4_NODE' },

    // Mall 1 Level 2
    'M1-L2-S5': { x: 270, y: SLOT_CURB_Y, entry: 'S1_NODE' },
    'M1-L2-S6': { x: 480, y: SLOT_CURB_Y, entry: 'S2_NODE' },
    'M1-L2-S7': { x: 820, y: SLOT_CURB_Y, entry: 'S3_NODE' },
    'M1-L2-S8': { x: 1030, y: SLOT_CURB_Y, entry: 'S4_NODE' },

    // Mall 2 Level 1 (aligned to FloorPlan coordinates)
    'M2-L1-S1': { x: 140, y: SLOT_CURB_Y, entry: 'S1_NODE' },
    'M2-L1-S2': { x: 330, y: SLOT_CURB_Y, entry: 'S2_NODE' },
    'M2-L1-S3': { x: 520, y: SLOT_CURB_Y, entry: 'S3_NODE' },
    'M2-L1-S4': { x: 840, y: SLOT_CURB_Y, entry: 'S4_NODE' },
    'M2-L1-S5': { x: 1030, y: SLOT_CURB_Y, entry: 'S5_NODE' },
    'M2-L1-S6': { x: 1195, y: SLOT_CURB_Y, entry: 'S6_NODE' },
};

export const NODES = {};

export function findPath(startId, endSlotId) {
    const target = SLOT_MAP[endSlotId];
    if (!target) return [];

    const p1 = NODES_GRAPH['ENTRY'];
    const p2 = { x: target.x, y: ROAD_Y }; // Road level directly below the slot
    const p3 = { x: target.x, y: target.y };

    return [p1, p2, p3];
}

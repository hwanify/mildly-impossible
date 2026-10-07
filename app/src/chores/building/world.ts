// The building's layout, shared by the room (server) and the engine (browser).
export const W = 1000;
export const H = 640;

export const LEVELS = [
  { name: "The roof", short: "R" },
  { name: "Floor 5", short: "5" },
  { name: "Floor 4", short: "4" },
  { name: "Floor 3", short: "3" },
  { name: "Floor 2", short: "2" },
  { name: "The lobby", short: "1" },
  { name: "The basement", short: "B" },
];
export const ROOF = 0;
export const LOBBY = 5;
export const BASEMENT = 6;
export const LAST = LEVELS.length - 1;

/** Height of one storey, slab to slab. */
export const FH = 250;
/** World y of the roof deck; each level's floor sits FH below the one above. */
export const ROOF_Y = 380;
export const floorY = (level: number) => ROOF_Y + level * FH;
export const WORLD_H = floorY(LAST) + 150;

// Left to right: outer wall, the stairwell, the flat, the lift shaft, outer wall.
export const WALL_X0 = 80;
export const WALL_X1 = 920;
export const STAIR_X0 = 92;
export const STAIR_X1 = 232;
export const WALK_X0 = 104;
export const WALK_X1 = 776;
export const SHAFT_X0 = 790;
export const SHAFT_X1 = 906;
export const CAR_X0 = 800;
export const CAR_X1 = 896;

/** The lift runs from Floor 5 down to the basement (the roof has the motor). */
export const LIFT_TOP = 1;
export const LIFT_BOTTOM = BASEMENT;
export const LIFT_MS = 1500; // per storey
export const DOOR_MS = 3400;

/** Which level a world y falls on: each level owns the storey above its floor. */
export function levelAt(y: number) {
  return Math.max(0, Math.min(LAST, Math.ceil((y - ROOF_Y) / FH)));
}

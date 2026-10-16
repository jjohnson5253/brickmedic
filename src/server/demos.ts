import { type Brick, type BrickModel } from "../shared/model";

const b = (
  id: string,
  part: Brick["part"],
  x: number,
  y: number,
  z: number,
  color: number,
  label: string,
  rotated = false,
): Brick => ({ id, part, x, y, z, color, label, rotated });

export const DEMOS: Record<string, BrickModel & { category: string }> = {
  "space-cadet": {
    name: "Space Cadet",
    category: "SPACECRAFT",
    description: "A little explorer with a wing that missed its connection.",
    bricks: [
      b("hull-a", "3001", 0, 0, 0, 15, "Lower hull"),
      b("hull-b", "3001", 2, 0, 0, 15, "Lower hull"),
      b("hull-bridge", "3001", 0, 4, 1, 15, "Hull bridge", true),
      b("nose", "3003", 1, 3, -1, 14, "Explorer nose"),
      b("cockpit", "3003", 1, 7, 1, 1, "Cockpit"),
      b("canopy", "3022", 1, 10, 1, 0, "Canopy"),
      b("engine-l", "3005", 0, 3, 3, 25, "Port thruster"),
      b("engine-r", "3005", 3, 3, 3, 25, "Starboard thruster"),
      b("left-wing", "3020", -3, 3, 1, 4, "Port wing", true),
      b("left-tip", "3023", -3, 4, 1, 14, "Port wing tip"),
      b("right-wing", "3020", 4, 5, 1, 4, "Disconnected wing", true),
      b("right-tip", "3023", 7, 6, 1, 14, "Wing tip"),
    ],
  },
  "garden-house": {
    name: "Garden House",
    category: "ARCHITECTURE",
    description: "A tiny garden studio with a floating roof assembly.",
    bricks: [
      b("floor-a", "3020", 0, 0, 0, 19, "Foundation"),
      b("floor-b", "3020", 2, 0, 0, 19, "Foundation"),
      b("wall-left", "3010", 0, 1, 0, 15, "Left wall"),
      b("wall-right", "3010", 3, 1, 0, 15, "Right wall"),
      b("wall-back", "3004", 1, 1, 3, 14, "Back wall", true),
      b("roof-left", "3020", 0, 7, 0, 2, "Floating roof"),
      b("roof-right", "3020", 2, 7, 0, 2, "Floating roof"),
      b("roof-ridge", "3020", 0, 8, 1, 2, "Roof ridge", true),
      b("chimney", "3005", 0, 9, 2, 484, "Chimney"),
    ],
  },
  "little-rover": {
    name: "Little Rover",
    category: "EXPLORATION",
    description: "A survey rover with two disconnected instrument assemblies.",
    bricks: [
      b("chassis-a", "3001", 0, 0, 0, 25, "Chassis"),
      b("chassis-b", "3001", 2, 0, 0, 25, "Chassis"),
      b("deck", "3020", 0, 3, 1, 15, "Deck", true),
      b("cab", "3003", 1, 4, 1, 1, "Cab"),
      b("camera", "3005", 0, 6, 0, 72, "Floating camera"),
      b("camera-lens", "3024", 0, 9, 0, 14, "Camera lens"),
      b("sensor", "3005", 3, 7, 3, 4, "Floating sensor"),
      b("sensor-cap", "3024", 3, 10, 3, 15, "Sensor cap"),
    ],
  },
};

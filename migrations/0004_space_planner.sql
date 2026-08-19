-- ============================================================
-- v4: Facility Space Planner
-- Physical space configuration by square-footage room, with
-- equipment footprints placed on a floor layout rendered in 3D.
-- ============================================================

-- Rooms / physical spaces (a floor layout canvas per room)
CREATE TABLE IF NOT EXISTS space_rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campus TEXT NOT NULL DEFAULT 'ramapuram' CHECK (campus IN ('ramapuram','trichy','both')),
  name TEXT NOT NULL,
  room_type TEXT DEFAULT 'lab',           -- lab, fabrication, classroom, storage, flight_ops, office
  width_ft REAL NOT NULL DEFAULT 40,      -- room width in feet (X axis)
  length_ft REAL NOT NULL DEFAULT 30,     -- room length in feet (Y axis)
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Equipment placements on a room's floor layout (square footprint in feet)
CREATE TABLE IF NOT EXISTS space_placements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES space_rooms(id),
  item_name TEXT NOT NULL,                -- e.g., Lathe Machine
  category TEXT DEFAULT 'equipment',      -- equipment, bench, storage, printer, safety, utility
  footprint_ft REAL NOT NULL DEFAULT 4,   -- square footprint side in feet
  x_ft REAL NOT NULL DEFAULT 0,           -- position from room origin (feet, X)
  y_ft REAL NOT NULL DEFAULT 0,           -- position from room origin (feet, Y)
  height_ft REAL NOT NULL DEFAULT 4,      -- visual extrusion height in 3D
  color TEXT DEFAULT '#6366f1',           -- render color
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned','ordered','installed','operational')),
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_space_placements_room ON space_placements(room_id);

-- ============================================================
-- SEED: one room per campus with representative equipment
-- ============================================================
INSERT INTO space_rooms (campus, name, room_type, width_ft, length_ft, notes, sort_order) VALUES
  ('ramapuram', 'Fabrication Lab A', 'fabrication', 50, 40, 'Ground-floor fabrication zone — 3-phase power on north wall.', 1),
  ('trichy', 'Flight Ops Cell', 'flight_ops', 45, 35, 'Netted indoor flight-test area.', 2);

INSERT INTO space_placements (room_id, item_name, category, footprint_ft, x_ft, y_ft, height_ft, color, status, sort_order) VALUES
  -- Fabrication Lab A (50 x 40 ft)
  (1, 'Lathe Machine', 'equipment', 6, 4, 4, 5, '#ef4444', 'installed', 1),
  (1, 'FDM 3D Printer 1', 'printer', 3, 14, 4, 4, '#ec4899', 'installed', 2),
  (1, 'FDM 3D Printer 2', 'printer', 3, 18, 4, 4, '#ec4899', 'installed', 3),
  (1, 'Resin (SLA) Printer', 'printer', 3, 22, 4, 4, '#f59e0b', 'planned', 4),
  (1, 'Workbench Row 1', 'bench', 8, 4, 16, 3.5, '#10b981', 'installed', 5),
  (1, 'Workbench Row 2', 'bench', 8, 4, 26, 3.5, '#10b981', 'installed', 6),
  (1, 'Filament Storage Rack', 'storage', 4, 42, 4, 6, '#6b7280', 'installed', 7),
  (1, 'LiPo Safety Cabinet', 'safety', 3, 42, 12, 5, '#dc2626', 'installed', 8),
  (1, 'Dust Extraction Unit', 'utility', 4, 42, 32, 6, '#06b6d4', 'planned', 9),
  -- Flight Ops Cell (45 x 35 ft)
  (2, 'Indoor Test Cage', 'equipment', 12, 6, 6, 10, '#f97316', 'planned', 1),
  (2, 'Charging Station', 'utility', 4, 36, 6, 4, '#06b6d4', 'installed', 2),
  (2, 'Drone Storage Racks', 'storage', 6, 36, 16, 7, '#6b7280', 'installed', 3),
  (2, 'Fire Safety Point', 'safety', 2, 2, 30, 5, '#dc2626', 'installed', 4);

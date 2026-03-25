import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '..', 'src', 'data', 'equipments.json');

function parseDateKey(dateKey) {
  // e.g. "2024-01" -> "2024-01-01T00:00:00Z"
  if (dateKey.length === 7) {
    return dateKey + "-01T00:00:00Z";
  }
  if (dateKey.length === 4) {
    return dateKey + "-01-01T00:00:00Z";
  }
  return dateKey;
}

function migrate() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const db = JSON.parse(raw);

  const oldTasks = db.tasks || {};
  const oldWorkOrders = db.workOrders || {};
  const oldWorkOrderLines = db.workOrderLines || {};

  const newDb = {
    version: "3.0.0",
    assets: db.assets,
    workOrders: {},
    workOrderLines: {},
    hierarchy: db.hierarchy,
    workOrderClassifications: db.taskClassifications || db.workOrderClassifications,
    assetClassification: db.assetClassification,
    metadata: {
      lastModified: new Date().toISOString()
    }
  };

  // Convert WorkOrders
  for (const [id, wo] of Object.entries(oldWorkOrders)) {
    newDb.workOrders[id] = {
      id: wo.id,
      name: wo.name,
      ClassificationId: wo.taskClassificationId || wo.ClassificationId,
      CreatedAt: wo.createdAt || wo.CreatedAt,
      UpdatedAt: wo.updatedAt || wo.UpdatedAt
    };
  }

  // Convert WorkOrderLines
  let wolCounter = 1;
  for (const [oldId, wol] of Object.entries(oldWorkOrderLines)) {
    const taskName = (oldTasks[wol.taskId] || {}).name || wol.name || "不明な作業";
    const schedule = wol.schedule || {};

    // For each date in the schedule dictionary, create an independent Event line
    for (const [dateKey, entry] of Object.entries(schedule)) {
      const isoDate = parseDateKey(dateKey);
      const newId = `wol-${String(wolCounter).padStart(3, '0')}`;
      
      newDb.workOrderLines[newId] = {
        id: newId,
        name: taskName,
        WorkOrderId: wol.workOrderId || wol.WorkOrderId,
        AssetId: wol.assetId || wol.AssetId,
        PlanScheduleStart: isoDate,
        PlanScheduleEnd: isoDate,
        ActualScheduleStart: isoDate,
        ActualScheduleEnd: isoDate,
        Planned: entry.planned ?? entry.Planned,
        Actual: entry.actual ?? entry.Actual,
        PlanCost: entry.planCost ?? entry.PlanCost,
        ActualCost: entry.actualCost ?? entry.ActualCost,
        PlannedManhours: wol.manhours ?? wol.PlannedManhours,
        ActualManhours: wol.manhours ?? wol.ActualManhours,
        CreatedAt: wol.createdAt || wol.CreatedAt,
        UpdatedAt: wol.updatedAt || wol.UpdatedAt
      };
      
      wolCounter++;
    }
    
    // If schedule was empty, we should still probably create one record so we don't lose the task logic entirely
    if (Object.keys(schedule).length === 0) {
      const newId = `wol-${String(wolCounter).padStart(3, '0')}`;
      newDb.workOrderLines[newId] = {
        id: newId,
        name: taskName,
        WorkOrderId: wol.workOrderId || wol.WorkOrderId,
        AssetId: wol.assetId || wol.AssetId,
        PlanScheduleStart: "2024-01-01T00:00:00Z",
        PlanScheduleEnd: "2024-01-01T00:00:00Z",
        ActualScheduleStart: "2024-01-01T00:00:00Z",
        ActualScheduleEnd: "2024-01-01T00:00:00Z",
        Planned: false,
        Actual: false,
        PlanCost: 0,
        ActualCost: 0,
        PlannedManhours: wol.manhours,
        ActualManhours: wol.manhours,
        CreatedAt: wol.createdAt,
        UpdatedAt: wol.updatedAt
      };
      wolCounter++;
    }
  }

  // Write back
  fs.writeFileSync(DATA_FILE, JSON.stringify(newDb, null, 2), 'utf8');
  console.log('Successfully migrated equipments.json to Data Model v3.0.0 (Event Record format)');
}

migrate();

import { HierarchicalData, RawEquipment } from '../types';

import { getTimeKey, getISOWeek } from './dateUtils';

export const transformData = (data: { [id: string]: RawEquipment } | any, timeScale: 'year' | 'month' | 'week' | 'day'): [HierarchicalData[], string[], any] => {
  // Validate input data
  if (!data || typeof data !== 'object') {
        return [[], [], { name: 'root', children: {} }];
  }

  // Check if this is v2.0.0 data structure
  if (data.version === '2.0.0' && data.assets) {
        return transformV2Data(data, timeScale);
  }

  // Legacy data processing
    const flatEquipmentList: HierarchicalData[] = [];
  const hierarchyFilterTree = { name: 'root', children: {} };

  let minDate = new Date();
  let maxDate = new Date(1970, 0, 1);

  // 1. Find date range
  Object.values(data).forEach(item => {
    const equipment = item as RawEquipment;
    if (equipment && equipment.maintenances) {
      for (const dateStr in equipment.maintenances) {
        const date = new Date(dateStr);
        if (date < minDate) minDate = date;
        if (date > maxDate) maxDate = date;
      }
    }
  });

  // 2. Process each equipment item into a flat list
  Object.values(data).forEach(item => {
    const equipment = item as RawEquipment;
    // Skip items without hierarchy or with null/undefined hierarchy
    if (!equipment || !equipment.hierarchy || typeof equipment.hierarchy !== 'object') {
            return;
    }

    // a. Build hierarchy path and populate filter tree
    const hierarchyKeys = Object.keys(equipment.hierarchy).sort();
    const pathParts: string[] = [];
    let currentFilterNode: any = hierarchyFilterTree;

    hierarchyKeys.forEach(key => {
      const name = equipment.hierarchy[key];
      pathParts.push(name);

      if (!currentFilterNode.children[name]) {
        currentFilterNode.children[name] = { name: name, children: {} };
      }
      currentFilterNode = currentFilterNode.children[name];
    });
    const hierarchyPath = pathParts.join(' > ');

    // b. Create the equipment node
    const equipmentNode: HierarchicalData = {
      id: equipment.id,
      task: equipment.specifications.find(s => s.key === '機器名称')?.value || equipment.id,
      level: 0, // Level is not used in a flat list
      bomCode: equipment.id, // Use the actual ID for TAG No.
      specifications: equipment.specifications,
      children: [], // No children in a flat list
      results: {},
      rolledUpResults: {}, // Not used for individual items
      hierarchyPath: hierarchyPath,
    };



    // c. Populate results for the given timeScale
    for (const dateStr in equipment.maintenances) {
      const date = new Date(dateStr);
      const timeKey = getTimeKey(date, timeScale);
      const maintenance = equipment.maintenances[dateStr];

      if (!equipmentNode.results[timeKey]) {
        equipmentNode.results[timeKey] = { planned: false, actual: false, planCost: 0, actualCost: 0 };
      }
      if (maintenance.planned) {
        equipmentNode.results[timeKey].planned = true;
      }
      if (maintenance.actual) {
        equipmentNode.results[timeKey].actual = true;
        if (maintenance.cost) {
          equipmentNode.results[timeKey].actualCost += maintenance.cost;
        }
      }
    }

    // d. Add to the flat list
    flatEquipmentList.push(equipmentNode);
  });

  // 3. Generate Time Headers
  const timeHeaders: string[] = [];
  let currentDate = new Date(minDate);

  if (timeScale === 'year') {
    for (let y = minDate.getFullYear(); y <= maxDate.getFullYear(); y++) {
      timeHeaders.push(String(y));
    }
  } else if (timeScale === 'month') {
    currentDate.setDate(1);
    while (currentDate <= maxDate) {
      timeHeaders.push(getTimeKey(currentDate, 'month'));
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  } else if (timeScale === 'day') {
    while (currentDate <= maxDate) {
      timeHeaders.push(getTimeKey(currentDate, 'day'));
      currentDate.setDate(currentDate.getDate() + 1);
    }
  } else if (timeScale === 'week') {
    currentDate = new Date(minDate);
    // Adjust to the beginning of the week
    const dayOfWeek = currentDate.getDay();
    currentDate.setDate(currentDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)); // Adjust to Monday

    while (currentDate <= maxDate) {
      timeHeaders.push(getTimeKey(currentDate, 'week'));
      currentDate.setDate(currentDate.getDate() + 7);
    }
  }

  // Sort the final list by task name for consistent ordering
  flatEquipmentList.sort((a, b) => a.task.localeCompare(b.task));

  return [flatEquipmentList, timeHeaders, hierarchyFilterTree];
};

// Transform v2.0.0 data structure
const transformV2Data = (data: any, timeScale: 'year' | 'month' | 'week' | 'day'): [HierarchicalData[], string[], any] => {
  const flatEquipmentList: HierarchicalData[] = [];
  const hierarchyFilterTree = { name: 'root', children: {} };

  // Extract assets and associations
  const assets = data.assets || {};
  const associations = data.associations || {};
  const tasks = data.tasks || {};

  
  let minDate = new Date();
  let maxDate = new Date(1970, 0, 1);
  let hasDateData = false;

  // 1. Find date range from associations
  Object.values(associations).forEach((assoc: any) => {
    if (assoc && assoc.schedule) {
      for (const dateStr in assoc.schedule) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          hasDateData = true;
          if (date < minDate) minDate = date;
          if (date > maxDate) maxDate = date;
        }
      }
    }
  });

  // If no date data found, use current year range
  if (!hasDateData) {
    const currentYear = new Date().getFullYear();
    minDate = new Date(currentYear, 0, 1);
    maxDate = new Date(currentYear + 2, 11, 31);
  }

  // 2. Process each asset
  Object.values(assets).forEach((asset: any) => {
    if (!asset || !asset.hierarchyPath || typeof asset.hierarchyPath !== 'object') {
            return;
    }

    // Build hierarchy path and populate filter tree
    const hierarchyKeys = Object.keys(asset.hierarchyPath).sort();
    const pathParts: string[] = [];
    let currentFilterNode: any = hierarchyFilterTree;

    hierarchyKeys.forEach(key => {
      const name = asset.hierarchyPath[key];
      pathParts.push(name);

      if (!currentFilterNode.children[name]) {
        currentFilterNode.children[name] = { name: name, children: {} };
      }
      currentFilterNode = currentFilterNode.children[name];
    });
    const hierarchyPath = pathParts.join(' > ');

    // Create the equipment node
    const equipmentNode: HierarchicalData = {
      id: asset.id,
      task: asset.name || asset.id,
      level: 0,
      bomCode: asset.id,
      specifications: asset.specifications || [],
      children: [],
      results: {},
      rolledUpResults: {},
      hierarchyPath: hierarchyPath,
    };

    // 3. Populate results from associations
    Object.values(associations).forEach((assoc: any) => {
      if (assoc && assoc.assetId === asset.id && assoc.schedule) {
        for (const dateStr in assoc.schedule) {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            const timeKey = getTimeKey(date, timeScale);
            const scheduleEntry = assoc.schedule[dateStr];

            if (!equipmentNode.results[timeKey]) {
              equipmentNode.results[timeKey] = { planned: false, actual: false, planCost: 0, actualCost: 0 };
            }

            // Merge schedule data (OR operation for boolean flags, sum for costs)
            if (scheduleEntry.planned) {
              equipmentNode.results[timeKey].planned = true;
            }
            if (scheduleEntry.actual) {
              equipmentNode.results[timeKey].actual = true;
            }
            equipmentNode.results[timeKey].planCost += scheduleEntry.planCost || 0;
            equipmentNode.results[timeKey].actualCost += scheduleEntry.actualCost || 0;
          }
        }
      }
    });

    flatEquipmentList.push(equipmentNode);
  });

  // 4. Generate Time Headers
  const timeHeaders: string[] = [];
  let currentDate = new Date(minDate);

  if (timeScale === 'year') {
    for (let y = minDate.getFullYear(); y <= maxDate.getFullYear(); y++) {
      timeHeaders.push(String(y));
    }
  } else if (timeScale === 'month') {
    currentDate.setDate(1);
    while (currentDate <= maxDate) {
      timeHeaders.push(getTimeKey(currentDate, 'month'));
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  } else if (timeScale === 'day') {
    while (currentDate <= maxDate) {
      timeHeaders.push(getTimeKey(currentDate, 'day'));
      currentDate.setDate(currentDate.getDate() + 1);
    }
  } else if (timeScale === 'week') {
    currentDate = new Date(minDate);
    // Adjust to the beginning of the week
    const dayOfWeek = currentDate.getDay();
    currentDate.setDate(currentDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)); // Adjust to Monday

    while (currentDate <= maxDate) {
      timeHeaders.push(getTimeKey(currentDate, 'week'));
      currentDate.setDate(currentDate.getDate() + 7);
    }
  }

  // Sort the final list by task name for consistent ordering
  flatEquipmentList.sort((a, b) => a.task.localeCompare(b.task));

  
  return [flatEquipmentList, timeHeaders, hierarchyFilterTree];
};
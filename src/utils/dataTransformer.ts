import { HierarchicalData, RawEquipment } from '../types';

// Helper to get ISO week number and year
const getWeek = (d: Date): { year: number, week: number } => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Move to Thursday of the same week
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  // The year of this Thursday is the ISO week year
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  // @ts-ignore
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year, week: weekNo };
};

const getTimeKey = (date: Date, timeScale: 'year' | 'month' | 'week' | 'day'): string => {
  const year = date.getFullYear();
  switch (timeScale) {
    case 'year':
      return String(year);
    case 'month':
      return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    case 'week':
      const { year: isoYear, week: isoWeek } = getWeek(date);
      return `${isoYear}-W${String(isoWeek).padStart(2, '0')}`;
    case 'day':
      return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
};

export const transformData = (data: { [id: string]: RawEquipment }, timeScale: 'year' | 'month' | 'week' | 'day'): [HierarchicalData[], string[], any] => {
  const flatEquipmentList: HierarchicalData[] = [];
  const hierarchyFilterTree = { name: 'root', children: {} };

  let minDate = new Date();
  let maxDate = new Date(1970, 0, 1);

  // 1. Find date range
  Object.values(data).forEach(item => {
    for (const dateStr in item.maintenances) {
      const date = new Date(dateStr);
      if (date < minDate) minDate = date;
      if (date > maxDate) maxDate = date;
    }
  });

  // 2. Process each equipment item into a flat list
  Object.values(data).forEach(item => {
    // a. Build hierarchy path and populate filter tree
    const hierarchyKeys = Object.keys(item.hierarchy).sort();
    const pathParts: string[] = [];
    let currentFilterNode: any = hierarchyFilterTree;

    hierarchyKeys.forEach(key => {
      const name = item.hierarchy[key];
      pathParts.push(name);

      if (!currentFilterNode.children[name]) {
        currentFilterNode.children[name] = { name: name, children: {} };
      }
      currentFilterNode = currentFilterNode.children[name];
    });
    const hierarchyPath = pathParts.join(' > ');

    // b. Create the equipment node
    const equipmentNode: HierarchicalData = {
      id: item.id,
      task: item.specifications.find(s => s.key === '機器名称')?.value || item.id,
      level: 0, // Level is not used in a flat list
      bomCode: item.id, // Use the actual ID for TAG No.
      specifications: item.specifications,
      children: [], // No children in a flat list
      results: {},
      rolledUpResults: {}, // Not used for individual items
      hierarchyPath: hierarchyPath,
    };

    // c. Populate results for the given timeScale
    for (const dateStr in item.maintenances) {
      const date = new Date(dateStr);
      const timeKey = getTimeKey(date, timeScale);
      const maintenance = item.maintenances[dateStr];

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
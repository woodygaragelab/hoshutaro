import { HierarchicalData, RawEquipment } from '../types';

export const transformData = (data: { [id: string]: RawEquipment }): [HierarchicalData[], number[]] => {
  const hierarchyMap = new Map<string, HierarchicalData>();
  const rootNodes: HierarchicalData[] = [];
  const yearSet = new Set<number>();

  // 1. Build the hierarchy tree and process equipment nodes
  Object.values(data).forEach(item => {
    let parentNode: HierarchicalData | undefined = undefined;
    let currentPath = '';
    const hierarchyKeys = Object.keys(item.hierarchy).sort();

    hierarchyKeys.forEach((key, index) => {
      const level = index + 1;
      const name = item.hierarchy[key];
      currentPath += `/${name}`;

      if (!hierarchyMap.has(currentPath)) {
        const newNode: HierarchicalData = {
          id: currentPath,
          task: name,
          level: level,
          bomCode: '',
          children: [],
          results: {},
          rolledUpResults: {}, // Initialized
          isOpen: true,
        };
        hierarchyMap.set(currentPath, newNode);

        if (parentNode) {
          parentNode.children.push(newNode);
        } else {
          rootNodes.push(newNode);
        }
      }
      parentNode = hierarchyMap.get(currentPath);
    });

    if (parentNode) {
      const equipmentNode: HierarchicalData = {
        id: item.id,
        task: item.specifications.find(s => s.key === '機器名称')?.value || item.id,
        level: hierarchyKeys.length + 1,
        bomCode: item.id, // Temporary, will be reassigned
        specifications: item.specifications, // Add specifications to equipment node
        children: [],
        results: {},
        rolledUpResults: {}, // Initialized
        isOpen: true,
      };

      for (const date in item.maintenances) {
        const year = new Date(date).getFullYear();
        const maintenance = item.maintenances[date];
        yearSet.add(year);

        if (!equipmentNode.results[year]) {
          equipmentNode.results[year] = { planned: false, actual: false, planCost: 0, actualCost: 0 };
        }

        if (maintenance.planned) {
          equipmentNode.results[year].planned = true;
        }

        if (maintenance.actual) {
          equipmentNode.results[year].actual = true;
          if (maintenance.cost) {
            equipmentNode.results[year].actualCost += maintenance.cost;
          }
        }
      }
      parentNode.children.push(equipmentNode);
    }
  });

  const allYears = Array.from(yearSet).sort((a, b) => a - b);

  // 2. Assign BOM codes
  const assignBomCode = (nodes: HierarchicalData[], parentCode: string) => {
    const sortedNodes = nodes.sort((a, b) => a.task.localeCompare(b.task));
    sortedNodes.forEach((node: any, index) => { // Using any to bypass type issue
      node.bomCode = parentCode ? `${parentCode}.${index + 1}` : `${index + 1}`;
      if (node.children && node.children.length > 0) {
        assignBomCode(node.children, node.bomCode);
      }
    });
  };
  assignBomCode(rootNodes, '');

  // 3. Calculate rolled-up results
  const calculateRollup = (node: HierarchicalData) => {
    // Initialize for the current node
    node.rolledUpResults = {};
    allYears.forEach(year => {
      node.rolledUpResults[year] = { planned: false, actual: false, planCost: 0, actualCost: 0 };
    });

    if (node.children.length > 0) {
      // Process children first
      node.children.forEach((child: any) => { // Using any to bypass type issue
        calculateRollup(child);
        allYears.forEach(year => {
          const childResults = child.results[year] || { planned: false, actual: false, planCost: 0, actualCost: 0 };
          const childRolledUp = child.rolledUpResults[year] || { planned: false, actual: false, planCost: 0, actualCost: 0 };

          if (childResults.planned || childRolledUp.planned) {
            node.rolledUpResults[year].planned = true;
          }
          if (childResults.actual || childRolledUp.actual) {
            node.rolledUpResults[year].actual = true;
          }
          node.rolledUpResults[year].planCost += childResults.planCost + childRolledUp.planCost;
          node.rolledUpResults[year].actualCost += childResults.actualCost + childRolledUp.actualCost;
        });
      });
    }
  };

  rootNodes.forEach(calculateRollup);

  return [rootNodes, allYears];
};
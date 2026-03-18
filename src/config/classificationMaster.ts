/**
 * Work Classification Master
 * 
 * Defines the standard work classifications used in the maintenance management system.
 * Classifications are numbered 01-20 and represent different types of maintenance activities.
 * 
 * Based on Japanese maintenance management standards (JIS Z 8141, JIPM TPM standards).
 */

export interface ClassificationDefinition {
  code: string;
  name: string;
  description: string;
  category: 'preventive' | 'corrective' | 'improvement' | 'prevention' | 'other';
}

/**
 * Standard work classifications
 * 
 * Categories:
 * - Preventive (予防保全): Scheduled maintenance to prevent failures
 * - Corrective (事後保全): Maintenance after failure occurs
 * - Improvement (改良保全): Maintenance to improve equipment performance
 * - Prevention (保全予防): Design improvements to prevent maintenance needs
 * - Other: Other maintenance activities
 */
export const CLASSIFICATION_MASTER: ClassificationDefinition[] = [
  // Preventive Maintenance (予防保全)
  {
    code: '01',
    name: '予防保全',
    description: '定期点検・オーバーホール等の計画的な保全活動',
    category: 'preventive',
  },
  {
    code: '02',
    name: '事後保全',
    description: '故障後の修理・緊急対応',
    category: 'corrective',
  },
  {
    code: '03',
    name: '改良保全',
    description: '設備性能向上・改造工事',
    category: 'improvement',
  },
  {
    code: '04',
    name: '保全予防',
    description: '設備更新・設計改善',
    category: 'prevention',
  },
  {
    code: '05',
    name: '日常点検',
    description: '日常的な巡回点検・簡易点検',
    category: 'preventive',
  },
  {
    code: '06',
    name: '定期点検',
    description: '定期的な詳細点検',
    category: 'preventive',
  },
  {
    code: '07',
    name: '精密点検',
    description: '分解を伴う精密な点検',
    category: 'preventive',
  },
  {
    code: '08',
    name: '予知保全',
    description: '状態監視による予知保全',
    category: 'preventive',
  },
  {
    code: '09',
    name: '潤滑管理',
    description: '潤滑油の管理・交換',
    category: 'preventive',
  },
  {
    code: '10',
    name: '清掃・洗浄',
    description: '設備の清掃・洗浄作業',
    category: 'preventive',
  },
  {
    code: '11',
    name: '調整・校正',
    description: '設備の調整・計器校正',
    category: 'preventive',
  },
  {
    code: '12',
    name: '部品交換',
    description: '消耗品・部品の定期交換',
    category: 'preventive',
  },
  {
    code: '13',
    name: '緊急修理',
    description: '緊急を要する故障修理',
    category: 'corrective',
  },
  {
    code: '14',
    name: '一般修理',
    description: '通常の故障修理',
    category: 'corrective',
  },
  {
    code: '15',
    name: '性能改善',
    description: '設備性能の改善工事',
    category: 'improvement',
  },
  {
    code: '16',
    name: '省エネ改善',
    description: '省エネルギー化工事',
    category: 'improvement',
  },
  {
    code: '17',
    name: '安全対策',
    description: '安全性向上のための改善',
    category: 'improvement',
  },
  {
    code: '18',
    name: '環境対策',
    description: '環境対策工事',
    category: 'improvement',
  },
  {
    code: '19',
    name: '設備更新',
    description: '老朽化設備の更新',
    category: 'prevention',
  },
  {
    code: '20',
    name: 'その他',
    description: 'その他の保全活動',
    category: 'other',
  },
];

/**
 * Get classification definition by code
 */
export function getClassificationByCode(code: string): ClassificationDefinition | undefined {
  return CLASSIFICATION_MASTER.find(c => c.code === code);
}

/**
 * Get classification display label (e.g., "[01] 予防保全")
 */
export function getClassificationLabel(code: string): string {
  const classification = getClassificationByCode(code);
  if (classification) {
    return `[${classification.code}] ${classification.name}`;
  }
  return `[${code}]`;
}

/**
 * Get all classifications for a specific category
 */
export function getClassificationsByCategory(
  category: ClassificationDefinition['category']
): ClassificationDefinition[] {
  return CLASSIFICATION_MASTER.filter(c => c.category === category);
}

/**
 * Get classification options for dropdown/select components
 */
export function getClassificationOptions(): Array<{ value: string; label: string; description: string }> {
  return CLASSIFICATION_MASTER.map(c => ({
    value: c.code,
    label: `[${c.code}] ${c.name}`,
    description: c.description,
  }));
}

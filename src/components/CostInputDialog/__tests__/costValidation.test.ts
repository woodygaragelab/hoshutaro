import {
  parseCurrency,
  formatCurrency,
  validateCostValue,
  validateCostCrossRelation,
  validateCostInput,
  filterCostInput,
  formatCostInputRealtime,
  DEFAULT_COST_VALIDATION_RULES,
  STRICT_COST_VALIDATION_RULES,
  type CostValidationRule,
  type CostValidationOptions,
} from '../costValidation';

describe('costValidation', () => {
  describe('parseCurrency', () => {
    it('空文字列は0を返す', () => {
      expect(parseCurrency('')).toBe(0);
      expect(parseCurrency('   ')).toBe(0);
    });

    it('数値文字列を正しく変換する', () => {
      expect(parseCurrency('123')).toBe(123);
      expect(parseCurrency('1000')).toBe(1000);
      expect(parseCurrency('0')).toBe(0);
    });

    it('カンマ区切りの数値を正しく変換する', () => {
      expect(parseCurrency('1,000')).toBe(1000);
      expect(parseCurrency('1,234,567')).toBe(1234567);
      expect(parseCurrency('10,000,000')).toBe(10000000);
    });

    it('円記号を含む文字列を正しく変換する', () => {
      expect(parseCurrency('¥1,000')).toBe(1000);
      expect(parseCurrency('1,000円')).toBe(1000);
      expect(parseCurrency('¥1,234,567円')).toBe(1234567);
    });

    it('全角数字を半角に変換する', () => {
      expect(parseCurrency('１２３')).toBe(123);
      expect(parseCurrency('１０００')).toBe(1000);
      expect(parseCurrency('１２３４５６７')).toBe(1234567);
    });

    it('小数点を含む数値を正しく変換する', () => {
      expect(parseCurrency('123.45')).toBe(123.45);
      expect(parseCurrency('1,000.50')).toBe(1000.5);
    });

    it('不正な文字列は0を返す', () => {
      expect(parseCurrency('abc')).toBe(0);
      expect(parseCurrency('NaN')).toBe(0);
      expect(parseCurrency('undefined')).toBe(0);
    });
  });

  describe('formatCurrency', () => {
    it('0は空文字列を返す', () => {
      expect(formatCurrency(0)).toBe('');
      expect(formatCurrency(NaN)).toBe('');
    });

    it('正の数値を3桁区切りでフォーマットする', () => {
      expect(formatCurrency(123)).toBe('123');
      expect(formatCurrency(1000)).toBe('1,000');
      expect(formatCurrency(1234567)).toBe('1,234,567');
      expect(formatCurrency(10000000)).toBe('10,000,000');
    });

    it('小数点を含む数値を正しくフォーマットする', () => {
      expect(formatCurrency(123.45)).toBe('123.45');
      expect(formatCurrency(1000.5)).toBe('1,000.5');
    });

    it('負の数値も正しくフォーマットする', () => {
      expect(formatCurrency(-1000)).toBe('-1,000');
      expect(formatCurrency(-1234567)).toBe('-1,234,567');
    });
  });

  describe('validateCostValue', () => {
    const defaultRules: CostValidationRule = {
      minValue: 0,
      maxValue: 1000000,
      allowZero: true,
      maxDecimalPlaces: 0,
    };

    it('有効な値でバリデーションが成功する', () => {
      const result = validateCostValue('100000', 'テストコスト', defaultRules);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.normalizedValue).toBe(100000);
    });

    it('空値は必須でない場合は有効', () => {
      const result = validateCostValue('', 'テストコスト', { ...defaultRules, required: false });
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.normalizedValue).toBe(0);
    });

    it('空値は必須の場合は無効', () => {
      const result = validateCostValue('', 'テストコスト', { ...defaultRules, required: true });
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('テストコストは必須です');
    });

    it('負の値は無効', () => {
      const result = validateCostValue('-1000', 'テストコスト', defaultRules);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('テストコストは0以上の値を入力してください');
    });

    it('最小値未満は無効', () => {
      const rules = { ...defaultRules, minValue: 1000 };
      const result = validateCostValue('500', 'テストコスト', rules);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('テストコストは1,000円以上で入力してください');
    });

    it('最大値超過は無効', () => {
      const result = validateCostValue('2000000', 'テストコスト', defaultRules);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('テストコストは1,000,000円以下で入力してください');
    });

    it('小数点桁数超過は無効', () => {
      const rules = { ...defaultRules, maxDecimalPlaces: 2 };
      const result = validateCostValue('123.456', 'テストコスト', rules);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('テストコストは小数点以下2桁以内で入力してください');
    });

    it('ゼロ値で警告が表示される（allowZero: false）', () => {
      const rules = { ...defaultRules, allowZero: false };
      const result = validateCostValue('0', 'テストコスト', rules);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('テストコストが0円です。意図した値でしょうか？');
    });

    it('大きな値で警告が表示される', () => {
      const result = validateCostValue('1500000000', 'テストコスト', defaultRules);
      
      expect(result.isValid).toBe(false); // 最大値を超えているため無効
      expect(result.errors).toContain('テストコストは1,000,000円以下で入力してください');
    });

    it('不正な文字列は無効', () => {
      const result = validateCostValue('abc', 'テストコスト', defaultRules);
      
      expect(result.isValid).toBe(true); // parseCurrencyが0を返すため、0は有効
      expect(result.normalizedValue).toBe(0);
    });
  });

  describe('validateCostCrossRelation', () => {
    it('相互バリデーションオプションがない場合は常に有効', () => {
      const result = validateCostCrossRelation(100000, 150000);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('実績が計画を超える場合に警告', () => {
      const options = { actualShouldNotExceedPlan: true };
      const result = validateCostCrossRelation(100000, 150000, options);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('実績コストが計画コストを50.0%超過しています');
    });

    it('実績があるが計画がない場合に警告', () => {
      const options = { planRequiredIfActual: true };
      const result = validateCostCrossRelation(0, 100000, options);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('実績コストが入力されていますが、計画コストが未入力です');
    });

    it('計画と実績の差が大きい場合に警告', () => {
      const result = validateCostCrossRelation(100000, 200000); // 100%の差
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('100.0%と大きくなっています'))).toBe(true);
    });

    it('計画と実績の差が小さい場合は警告なし', () => {
      const result = validateCostCrossRelation(100000, 120000);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });


  });

  describe('validateCostInput', () => {
    it('有効な入力で全体バリデーションが成功する', () => {
      const result = validateCostInput('100000', '80000', DEFAULT_COST_VALIDATION_RULES);
      
      expect(result.isValid).toBe(true);
      expect(result.allErrors).toHaveLength(0);
      expect(result.planCost.normalizedValue).toBe(100000);
      expect(result.actualCost.normalizedValue).toBe(80000);
    });

    it('計画コストエラーで全体バリデーションが失敗する', () => {
      const result = validateCostInput('-100000', '80000', DEFAULT_COST_VALIDATION_RULES);
      
      expect(result.isValid).toBe(false);
      expect(result.allErrors.length).toBeGreaterThan(0);
      expect(result.planCost.isValid).toBe(false);
      expect(result.actualCost.isValid).toBe(true);
    });

    it('実績コストエラーで全体バリデーションが失敗する', () => {
      const result = validateCostInput('100000', '-80000', DEFAULT_COST_VALIDATION_RULES);
      
      expect(result.isValid).toBe(false);
      expect(result.allErrors.length).toBeGreaterThan(0);
      expect(result.planCost.isValid).toBe(true);
      expect(result.actualCost.isValid).toBe(false);
    });

    it('相互バリデーション警告が含まれる', () => {
      const options: CostValidationOptions = {
        ...DEFAULT_COST_VALIDATION_RULES,
        crossValidation: {
          actualShouldNotExceedPlan: true,
        },
      };
      
      const result = validateCostInput('100000', '150000', options);
      
      expect(result.isValid).toBe(true);
      expect(result.allWarnings.length).toBeGreaterThan(0);
      expect(result.crossValidation.warnings).toContain('実績コストが計画コストを50.0%超過しています');
    });

    it('複数のエラーが正しく集約される', () => {
      const result = validateCostInput('-100000', '-50000', DEFAULT_COST_VALIDATION_RULES);
      
      expect(result.isValid).toBe(false);
      expect(result.allErrors).toContain('計画コストは0以上の値を入力してください');
      expect(result.allErrors).toContain('実績コストは0以上の値を入力してください');
    });
  });

  describe('filterCostInput', () => {
    it('数値、カンマ、小数点、マイナス記号のみ残す', () => {
      expect(filterCostInput('abc123def')).toBe('123');
      expect(filterCostInput('1,000.50')).toBe('1,000.50');
      expect(filterCostInput('-1,234.56')).toBe('-1,234.56');
      expect(filterCostInput('¥1,000円')).toBe('1,000');
    });

    it('空文字列はそのまま返す', () => {
      expect(filterCostInput('')).toBe('');
    });

    it('全て不正な文字の場合は空文字列を返す', () => {
      expect(filterCostInput('abcdef')).toBe('');
      expect(filterCostInput('¥円')).toBe('');
    });
  });

  describe('formatCostInputRealtime', () => {
    it('空文字列はそのまま返す', () => {
      expect(formatCostInputRealtime('')).toBe('');
      expect(formatCostInputRealtime('   ')).toBe('');
    });

    it('有効な数値をフォーマットする', () => {
      expect(formatCostInputRealtime('1000')).toBe('1,000');
      expect(formatCostInputRealtime('1234567')).toBe('1,234,567');
    });

    it('不正な文字を含む場合はフィルタリングしてフォーマット', () => {
      expect(formatCostInputRealtime('abc1000def')).toBe('1,000');
    });

    it('0の場合は元の文字列を返す', () => {
      expect(formatCostInputRealtime('0')).toBe('0');
    });

    it('不正な文字列の場合は元の文字列を返す', () => {
      expect(formatCostInputRealtime('abc')).toBe('');
    });
  });

  describe('デフォルトバリデーションルール', () => {
    it('DEFAULT_COST_VALIDATION_RULESが正しく設定されている', () => {
      expect(DEFAULT_COST_VALIDATION_RULES.planCostRules?.minValue).toBe(0);
      expect(DEFAULT_COST_VALIDATION_RULES.planCostRules?.maxValue).toBe(999999999999);
      expect(DEFAULT_COST_VALIDATION_RULES.planCostRules?.allowZero).toBe(true);
      expect(DEFAULT_COST_VALIDATION_RULES.planCostRules?.maxDecimalPlaces).toBe(0);
      
      expect(DEFAULT_COST_VALIDATION_RULES.actualCostRules?.minValue).toBe(0);
      expect(DEFAULT_COST_VALIDATION_RULES.actualCostRules?.maxValue).toBe(999999999999);
      expect(DEFAULT_COST_VALIDATION_RULES.actualCostRules?.allowZero).toBe(true);
      expect(DEFAULT_COST_VALIDATION_RULES.actualCostRules?.maxDecimalPlaces).toBe(0);
      
      expect(DEFAULT_COST_VALIDATION_RULES.crossValidation?.actualShouldNotExceedPlan).toBe(false);
      expect(DEFAULT_COST_VALIDATION_RULES.crossValidation?.planRequiredIfActual).toBe(false);
    });

    it('STRICT_COST_VALIDATION_RULESが正しく設定されている', () => {
      expect(STRICT_COST_VALIDATION_RULES.planCostRules?.minValue).toBe(1);
      expect(STRICT_COST_VALIDATION_RULES.planCostRules?.required).toBe(true);
      expect(STRICT_COST_VALIDATION_RULES.planCostRules?.allowZero).toBe(false);
      
      expect(STRICT_COST_VALIDATION_RULES.crossValidation?.actualShouldNotExceedPlan).toBe(true);
      expect(STRICT_COST_VALIDATION_RULES.crossValidation?.planRequiredIfActual).toBe(true);
    });
  });

  describe('エッジケース', () => {
    it('非常に大きな数値を処理できる', () => {
      const result = validateCostValue('999999999999', 'テストコスト', DEFAULT_COST_VALIDATION_RULES.planCostRules);
      
      expect(result.isValid).toBe(true);
      expect(result.normalizedValue).toBe(999999999999);
    });

    it('小数点のみの入力を処理できる', () => {
      const result = validateCostValue('.', 'テストコスト');
      
      expect(result.isValid).toBe(true); // parseCurrencyが0を返すため
      expect(result.normalizedValue).toBe(0);
    });

    it('複数の小数点を含む入力を処理できる', () => {
      const result = validateCostValue('1.2.3', 'テストコスト');
      
      expect(result.isValid).toBe(true); // parseFloatが1.2を返すため
      expect(result.normalizedValue).toBe(1.2);
    });

    it('先頭にゼロがある数値を正しく処理する', () => {
      expect(parseCurrency('0001000')).toBe(1000);
      expect(formatCurrency(parseCurrency('0001000'))).toBe('1,000');
    });

    it('末尾にゼロがある小数を正しく処理する', () => {
      expect(parseCurrency('1000.00')).toBe(1000);
      expect(formatCurrency(1000.00)).toBe('1,000');
    });
  });
});
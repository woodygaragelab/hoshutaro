/**
 * クリップボード操作ユーティリティ
 * TSV（タブ区切り文字列）の相互変換を担当し、Excel等と互換性を持たせます
 */

/**
 * 2次元配列のデータをTSV文字列に変換します
 */
export const generateTSV = (data: string[][]): string => {
  return data.map(row => row.join('\t')).join('\n');
};

/**
 * TSV文字列を2次元配列にパースします
 * 改行コードやタブを適切に処理します
 */
export const parseTSV = (tsvText: string): string[][] => {
  if (!tsvText) return [];
  
  // 正規表現で改行を分割（ダブルクォートで囲まれた改行への対応は簡易的に行います）
  // 厳密なCSV/TSVパーサーが必要な場合はライブラリ導入を推奨しますが、基本仕様としてはこれを用います
  const rows = tsvText.split(/\r?\n/);
  
  // 空行（特にペースト時の末尾など）を除外
  const cleanRows = rows.filter(row => row.length > 0);
  
  return cleanRows.map(row => row.split('\t'));
};

// 内部フォールバック用のクリップボード変数
let internalClipboard: string | null = null;

/**
 * コピー処理用（ブラウザのクリップボードへテキストを書き込む）
 * ブラウザに拒否された場合は内部メモリに保存します。
 */
export const writeToClipboard = async (text: string): Promise<boolean> => {
  internalClipboard = text; // 常に内部メモリにも保管
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return true; // 内部メモリには保存できたので成功扱い
  } catch (error) {
    console.warn('Clipboard API write failed, using internal fallback:', error);
    return true;
  }
};

/**
 * ペースト処理用（ブラウザのクリップボードからテキストを読み取る）
 */
export const readFromClipboard = async (): Promise<string | null> => {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      const text = await navigator.clipboard.readText();
      if (text) {
        return text;
      }
    }
    return internalClipboard;
  } catch (error) {
    console.warn('Clipboard API read failed, using internal fallback:', error);
    return internalClipboard;
  }
};

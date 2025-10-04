import { HierarchicalData } from '../../../types';

/**
 * Debounce function for search input
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Create search index for faster searching
 */
export interface SearchIndex {
  id: string;
  searchableText: string;
  keywords: string[];
  item: HierarchicalData;
}

export const createSearchIndex = (data: HierarchicalData[]): SearchIndex[] => {
  return data.map(item => {
    const searchableFields = [
      item.task,
      item.hierarchyPath || '',
      item.bomCode || '',
      item.cycle || '',
      ...(item.specifications?.map(spec => `${spec.key} ${spec.value}`) || [])
    ];

    const searchableText = searchableFields.join(' ').toLowerCase();
    const keywords = searchableText
      .split(/\s+/)
      .filter(word => word.length > 1)
      .filter((word, index, arr) => arr.indexOf(word) === index); // Remove duplicates

    return {
      id: item.id,
      searchableText,
      keywords,
      item
    };
  });
};

/**
 * Fast search using pre-built index
 */
export const searchWithIndex = (
  searchIndex: SearchIndex[],
  searchTerm: string,
  maxResults: number = 1000
): HierarchicalData[] => {
  if (!searchTerm || searchTerm.length < 2) {
    return searchIndex.map(index => index.item);
  }

  const normalizedTerm = searchTerm.toLowerCase().trim();
  const searchWords = normalizedTerm.split(/\s+/).filter(word => word.length > 0);

  const results = searchIndex
    .map(index => {
      let score = 0;
      let matchCount = 0;

      // Exact match in task name gets highest score
      if (index.item.task.toLowerCase().includes(normalizedTerm)) {
        score += 100;
        matchCount++;
      }

      // Partial matches in searchable text
      if (index.searchableText.includes(normalizedTerm)) {
        score += 50;
        matchCount++;
      }

      // Word-by-word matching
      searchWords.forEach(word => {
        if (index.keywords.some(keyword => keyword.includes(word))) {
          score += 10;
          matchCount++;
        }
      });

      // Boost score for hierarchy path matches
      if (index.item.hierarchyPath?.toLowerCase().includes(normalizedTerm)) {
        score += 30;
      }

      // Boost score for specification matches
      if (index.item.specifications?.some(spec => 
        spec.key.toLowerCase().includes(normalizedTerm) || 
        spec.value.toLowerCase().includes(normalizedTerm)
      )) {
        score += 20;
      }

      return {
        item: index.item,
        score,
        matchCount
      };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => {
      // Sort by score first, then by match count
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.matchCount - a.matchCount;
    })
    .slice(0, maxResults)
    .map(result => result.item);

  return results;
};

/**
 * Generate smart search suggestions
 */
export const generateSmartSuggestions = (
  searchIndex: SearchIndex[],
  searchTerm: string,
  maxSuggestions: number = 8
): string[] => {
  if (!searchTerm || searchTerm.length < 2) {
    return [];
  }

  const normalizedTerm = searchTerm.toLowerCase().trim();
  const suggestions = new Set<string>();

  // Collect suggestions from different sources
  searchIndex.forEach(index => {
    // Task name suggestions
    if (index.item.task.toLowerCase().includes(normalizedTerm)) {
      suggestions.add(index.item.task);
    }

    // Hierarchy path suggestions
    if (index.item.hierarchyPath?.toLowerCase().includes(normalizedTerm)) {
      const pathParts = index.item.hierarchyPath.split(' > ');
      pathParts.forEach(part => {
        if (part.toLowerCase().includes(normalizedTerm)) {
          suggestions.add(part);
        }
      });
    }

    // Specification suggestions
    index.item.specifications?.forEach(spec => {
      if (spec.key.toLowerCase().includes(normalizedTerm)) {
        suggestions.add(spec.key);
      }
      if (spec.value.toLowerCase().includes(normalizedTerm)) {
        suggestions.add(spec.value);
      }
    });

    // Keyword suggestions
    index.keywords.forEach(keyword => {
      if (keyword.includes(normalizedTerm) && keyword !== normalizedTerm) {
        suggestions.add(keyword);
      }
    });
  });

  // Convert to array and sort by relevance
  return Array.from(suggestions)
    .filter(suggestion => suggestion.toLowerCase() !== normalizedTerm)
    .sort((a, b) => {
      // Prioritize exact starts
      const aStarts = a.toLowerCase().startsWith(normalizedTerm);
      const bStarts = b.toLowerCase().startsWith(normalizedTerm);
      
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      
      // Then by length (shorter is better)
      return a.length - b.length;
    })
    .slice(0, maxSuggestions);
};

/**
 * Generate alternative search suggestions when no results found
 */
export const generateAlternativeSuggestions = (
  searchIndex: SearchIndex[],
  searchTerm: string,
  maxSuggestions: number = 5
): string[] => {
  if (!searchTerm || searchTerm.length < 2) {
    return [];
  }

  const normalizedTerm = searchTerm.toLowerCase().trim();
  const suggestions = new Set<string>();

  // Find similar words using Levenshtein distance
  const allKeywords = new Set<string>();
  searchIndex.forEach(index => {
    index.keywords.forEach(keyword => allKeywords.add(keyword));
  });

  Array.from(allKeywords).forEach(keyword => {
    if (levenshteinDistance(normalizedTerm, keyword) <= 2 && keyword.length > 2) {
      suggestions.add(keyword);
    }
  });

  // Add popular terms from the same category
  const categoryTerms = new Set<string>();
  searchIndex.forEach(index => {
    if (index.item.hierarchyPath) {
      const pathParts = index.item.hierarchyPath.split(' > ');
      pathParts.forEach(part => categoryTerms.add(part));
    }
  });

  Array.from(categoryTerms)
    .filter(term => term.length > 2)
    .slice(0, 3)
    .forEach(term => suggestions.add(term));

  return Array.from(suggestions)
    .sort((a, b) => a.length - b.length)
    .slice(0, maxSuggestions);
};

/**
 * Calculate Levenshtein distance between two strings
 */
const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
};

/**
 * Highlight search terms in text
 */
export const highlightSearchTerms = (text: string, searchTerm: string): string => {
  if (!searchTerm || !text) return text;

  const normalizedTerm = searchTerm.toLowerCase().trim();
  const words = normalizedTerm.split(/\s+/).filter(word => word.length > 0);
  
  let highlightedText = text;
  
  words.forEach(word => {
    const regex = new RegExp(`(${escapeRegExp(word)})`, 'gi');
    highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
  });
  
  return highlightedText;
};

/**
 * Escape special regex characters
 */
const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
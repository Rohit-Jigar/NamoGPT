/**
 * NamoGPT RAG (Retrieval-Augmented Generation) Engine
 * 
 * Features:
 * - Text chunking with configurable size and overlap (default 500 chars / 100 overlap).
 * - In-memory BM25 & TF-IDF keyword / token similarity index for uploaded documents.
 * - Robust CSV parsing into structured tabular representations, schema summaries, and searchable row records.
 * - queryRag({ documents, query, topK = 4 }) returning ranked chunks with score, document name, and chunk index.
 * - formatRagContext(rankedChunks) returning formatted Markdown citations.
 */

// Common English stop words to filter out for sharper BM25 matching
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'can\'t', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing',
  'don\'t', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t',
  'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers',
  'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if',
  'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most',
  'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
  'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll',
  'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their',
  'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll',
  'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very',
  'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s',
  'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s',
  'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your',
  'yours', 'yourself', 'yourselves'
]);

/**
 * Tokenize a text string into normalized terms.
 * @param {string} text 
 * @param {boolean} filterStopWords 
 * @returns {string[]}
 */
export function tokenize(text, filterStopWords = true) {
  if (!text || typeof text !== 'string') return [];
  const words = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}_\s-]/gu, ' ')
    .split(/[\s-]+/)
    .map(w => w.trim())
    .filter(w => w.length > 1);

  if (!filterStopWords) return words;
  return words.filter(w => !STOP_WORDS.has(w));
}

/**
 * Split text into overlapping chunks.
 * Default: 500 characters with 100 character overlap.
 * 
 * @param {string} text 
 * @param {number} chunkSize 
 * @param {number} chunkOverlap 
 * @returns {string[]}
 */
export function chunkText(text, chunkSize = 500, chunkOverlap = 100) {
  if (!text || typeof text !== 'string') return [];
  const cleanedText = text.trim();
  if (!cleanedText) return [];

  // Edge-case protections
  const size = Math.max(50, chunkSize);
  const overlap = Math.min(Math.max(0, chunkOverlap), size - 10);
  const step = size - overlap;

  if (cleanedText.length <= size) {
    return [cleanedText];
  }

  const chunks = [];
  let startIndex = 0;

  while (startIndex < cleanedText.length) {
    let endIndex = startIndex + size;

    if (endIndex >= cleanedText.length) {
      const finalChunk = cleanedText.slice(startIndex).trim();
      if (finalChunk) chunks.push(finalChunk);
      break;
    }

    // Attempt to break at natural boundary near endIndex (sentence break or whitespace)
    let breakIndex = -1;
    const windowStart = Math.max(startIndex + Math.floor(step * 0.8), endIndex - 50);
    const windowSlice = cleanedText.slice(windowStart, endIndex + 20);

    const punctuationMatch = /[.!?\n]\s+/g;
    let match;
    while ((match = punctuationMatch.exec(windowSlice)) !== null) {
      const candidate = windowStart + match.index + match[0].length;
      if (candidate > startIndex + 50 && candidate <= endIndex + 20) {
        breakIndex = candidate;
      }
    }

    if (breakIndex === -1) {
      // Look for whitespace
      const lastSpace = cleanedText.lastIndexOf(' ', endIndex);
      if (lastSpace > startIndex + Math.floor(step * 0.5)) {
        breakIndex = lastSpace;
      }
    }

    const actualEnd = (breakIndex !== -1 && breakIndex > startIndex) ? breakIndex : endIndex;
    const chunk = cleanedText.slice(startIndex, actualEnd).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    // Step forward respecting overlap
    startIndex = Math.max(startIndex + step, actualEnd - overlap);
  }

  return chunks;
}

/**
 * Parse a standard CSV string into headers and rows, correctly handling quoted fields and commas.
 * @param {string} csvText 
 * @returns {{ headers: string[], rows: string[][], tableMarkdown: string, summary: string }}
 */
export function parseCsv(csvText) {
  if (!csvText || typeof csvText !== 'string') {
    return { headers: [], rows: [], tableMarkdown: '', summary: '' };
  }

  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const parsedRows = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const row = [];
    let insideQuote = false;
    let currentCell = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuote && nextChar === '"') {
          // Escaped quote
          currentCell += '"';
          i++;
        } else {
          // Toggle quote
          insideQuote = !insideQuote;
        }
      } else if (char === ',' && !insideQuote) {
        row.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell.trim());
    parsedRows.push(row);
  }

  if (parsedRows.length === 0) {
    return { headers: [], rows: [], tableMarkdown: '', summary: '' };
  }

  const headers = parsedRows[0].map((h, i) => h || `Column_${i + 1}`);
  const dataRows = parsedRows.slice(1);

  // Generate markdown table representation (up to first 50 rows for token sanity)
  const previewRows = dataRows.slice(0, 50);
  let tableMarkdown = `| ${headers.join(' | ')} |\n`;
  tableMarkdown += `| ${headers.map(() => '---').join(' | ')} |\n`;
  for (const row of previewRows) {
    const rowValues = headers.map((_, i) => (row[i] !== undefined ? row[i].replace(/\|/g, '\\|') : ''));
    tableMarkdown += `| ${rowValues.join(' | ')} |\n`;
  }

  const summary = `CSV Tabular Dataset: ${dataRows.length} records, ${headers.length} attributes. Attributes: ${headers.join(', ')}.`;

  return {
    headers,
    rows: dataRows,
    tableMarkdown,
    summary
  };
}

/**
 * Transform a CSV document into structured, searchable RAG chunks.
 * Combines high-level schema summary, markdown table previews, and key-value records.
 * @param {string} csvText 
 * @param {string} documentName 
 * @returns {string[]}
 */
export function chunkCsv(csvText, documentName = 'data.csv') {
  const { headers, rows, summary, tableMarkdown } = parseCsv(csvText);
  if (headers.length === 0) return [];

  const chunks = [];

  // Chunk 1: Schema summary and table representation
  let schemaChunk = `[Dataset Summary: ${documentName}]\n${summary}\n\n[Tabular View Sample]:\n${tableMarkdown}`;
  chunks.push(schemaChunk);

  // Chunk remaining rows in batches (e.g. 5-10 rows per chunk) with explicit column labels
  const batchSize = 5;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    let recordChunk = `[Dataset Records ${i + 1} - ${i + batch.length} of ${rows.length} from ${documentName}]:\n`;
    for (let r = 0; r < batch.length; r++) {
      const row = batch[r];
      const rowSummary = headers
        .map((h, colIdx) => `${h}: ${row[colIdx] || 'N/A'}`)
        .join(' | ');
      recordChunk += `• Row ${i + r + 1}: ${rowSummary}\n`;
    }
    chunks.push(recordChunk.trim());
  }

  return chunks;
}

/**
 * Determine if a document content or filename suggests CSV format.
 * @param {string} filename 
 * @param {string} content 
 * @returns {boolean}
 */
function isCsvDocument(filename = '', content = '') {
  if (filename.toLowerCase().endsWith('.csv')) return true;
  if (!content || typeof content !== 'string') return false;

  const lines = content.slice(0, 1000).trim().split('\n');
  if (lines.length >= 2) {
    const commaCount1 = (lines[0].match(/,/g) || []).length;
    const commaCount2 = (lines[1].match(/,/g) || []).length;
    if (commaCount1 >= 2 && Math.abs(commaCount1 - commaCount2) <= 1) {
      return true;
    }
  }
  return false;
}

/**
 * In-memory BM25 index and ranking calculation.
 */
class BM25Index {
  constructor(k1 = 1.5, b = 0.75) {
    this.k1 = k1;
    this.b = b;
    this.documents = []; // array of { id, chunk, tokens, docLen }
    this.totalDocs = 0;
    this.avgDocLen = 0;
    this.docFreq = new Map(); // term -> count of docs containing term
  }

  /**
   * Add chunk documents to index
   * @param {Array<{ id: string, documentName: string, chunkIndex: number, totalChunks: number, content: string, metadata?: any }>} chunks 
   */
  addChunks(chunks) {
    this.documents = chunks.map((item, index) => {
      const tokens = tokenize(item.content);
      return {
        ...item,
        internalId: index,
        tokens,
        docLen: tokens.length
      };
    });

    this.totalDocs = this.documents.length;
    if (this.totalDocs === 0) {
      this.avgDocLen = 0;
      return;
    }

    const totalLength = this.documents.reduce((acc, d) => acc + d.docLen, 0);
    this.avgDocLen = totalLength / this.totalDocs;

    // Build document frequency map
    this.docFreq.clear();
    for (const doc of this.documents) {
      const uniqueTerms = new Set(doc.tokens);
      for (const term of uniqueTerms) {
        this.docFreq.set(term, (this.docFreq.get(term) || 0) + 1);
      }
    }
  }

  /**
   * Calculate BM25 score for a chunk given query terms.
   * @param {string[]} queryTokens 
   * @param {string} rawQuery 
   * @returns {Array<any>} Ranked chunks with scores
   */
  search(queryTokens, rawQuery = '') {
    if (this.totalDocs === 0 || queryTokens.length === 0) {
      return [];
    }

    const lowerQuery = rawQuery.toLowerCase().trim();
    const scored = [];

    for (const doc of this.documents) {
      let score = 0;

      // Term frequency map for this document
      const termFreq = new Map();
      for (const token of doc.tokens) {
        termFreq.set(token, (termFreq.get(token) || 0) + 1);
      }

      for (const term of queryTokens) {
        const tf = termFreq.get(term) || 0;
        if (tf === 0) continue;

        const df = this.docFreq.get(term) || 0;
        // Standard BM25 IDF formula with +1 smoothing
        const idf = Math.log(1 + (this.totalDocs - df + 0.5) / (df + 0.5));

        // BM25 term weighting
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (doc.docLen / (this.avgDocLen || 1)));
        score += idf * (numerator / denominator);
      }

      // Bonus boosts:
      // 1. Exact phrase match in chunk
      if (lowerQuery.length > 3 && doc.content.toLowerCase().includes(lowerQuery)) {
        score += 2.5;
      }

      // 2. Document name match boost
      if (doc.documentName && lowerQuery.length > 2 && doc.documentName.toLowerCase().includes(lowerQuery)) {
        score += 1.5;
      }

      if (score > 0) {
        scored.push({
          id: doc.id,
          documentName: doc.documentName,
          chunkIndex: doc.chunkIndex,
          totalChunks: doc.totalChunks,
          score: Number(score.toFixed(4)),
          content: doc.content,
          metadata: doc.metadata || {}
        });
      }
    }

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }
}

/**
 * Normalizes input documents, chunks them (text or CSV), and indexes them.
 * @param {Array<any>|any} documents 
 * @returns {Array<any>} Flattened chunk items
 */
function prepareDocumentChunks(documents) {
  if (!documents) return [];

  const docList = Array.isArray(documents) ? documents : [documents];
  const allChunks = [];

  docList.forEach((doc, docIndex) => {
    let name = `Document_${docIndex + 1}`;
    let content = '';
    let explicitType = null;

    if (typeof doc === 'string') {
      content = doc;
    } else if (doc && typeof doc === 'object') {
      name = doc.name || doc.filename || doc.title || doc.id || name;
      content = doc.content || doc.text || doc.data || (typeof doc.body === 'string' ? doc.body : '');
      explicitType = doc.type || null;

      if (!content && typeof doc === 'object') {
        // Fallback: JSON stringify object payload if no explicit content field
        content = JSON.stringify(doc, null, 2);
      }
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return;
    }

    const isCsv = explicitType === 'csv' || isCsvDocument(name, content);
    let chunks = [];

    if (isCsv) {
      chunks = chunkCsv(content, name);
    } else {
      chunks = chunkText(content, 500, 100);
    }

    chunks.forEach((chunkContent, chunkIndex) => {
      allChunks.push({
        id: `chunk_${docIndex + 1}_${chunkIndex + 1}`,
        documentName: name,
        chunkIndex: chunkIndex + 1,
        totalChunks: chunks.length,
        content: chunkContent,
        metadata: {
          type: isCsv ? 'csv' : 'text',
          length: chunkContent.length
        }
      });
    });
  });

  return allChunks;
}

/**
 * Executes an in-memory RAG search across uploaded documents.
 * 
 * @param {object} params
 * @param {Array<object>|Array<string>} params.documents - Uploaded documents (text or CSV).
 * @param {string} params.query - The user question or search query.
 * @param {number} [params.topK=4] - Number of top ranked chunks to return.
 * @returns {Array<{ id: string, documentName: string, chunkIndex: number, totalChunks: number, score: number, content: string, metadata: object }>}
 */
export function queryRag({ documents, query, topK = 4 }) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return [];
  }

  const chunks = prepareDocumentChunks(documents);
  if (chunks.length === 0) {
    return [];
  }

  const index = new BM25Index();
  index.addChunks(chunks);

  const queryTokens = tokenize(query);
  // If stop-word filtered tokens are empty, fallback to raw tokens
  const effectiveTokens = queryTokens.length > 0 ? queryTokens : tokenize(query, false);

  const results = index.search(effectiveTokens, query);
  const k = Math.max(1, topK || 4);

  // If query had tokens but BM25 scored 0 for all (rare), provide top initial chunks as fallback
  if (results.length === 0 && chunks.length > 0) {
    return chunks.slice(0, k).map(c => ({
      ...c,
      score: 0.1
    }));
  }

  return results.slice(0, k);
}

/**
 * Formats ranked retrieved chunks into Markdown context citations suitable for prompt injection.
 * 
 * @param {Array<object>} rankedChunks 
 * @returns {string} Formatted markdown context string.
 */
export function formatRagContext(rankedChunks) {
  if (!rankedChunks || !Array.isArray(rankedChunks) || rankedChunks.length === 0) {
    return '';
  }

  let formatted = '=== RETRIEVED CONTEXT DOCUMENTS (RAG) ===\n\n';

  rankedChunks.forEach((item, index) => {
    formatted += `[Citation ${index + 1}] Source: ${item.documentName} (Chunk ${item.chunkIndex}/${item.totalChunks} | Match Score: ${item.score})\n`;
    formatted += `Content:\n${item.content.trim()}\n\n`;
  });

  formatted += '=========================================\n';
  formatted += 'Instructions: You must ground your answer strictly in the retrieved document citations above. Attribute key statements to [Source: <documentName>, Chunk #<chunkIndex>] where applicable. If the provided context does not contain sufficient details to answer, state that clearly without guessing.\n';

  return formatted;
}

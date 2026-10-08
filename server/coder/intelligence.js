/**
 * Namo Coder - Deterministic Code Intelligence Engine
 * 
 * Provides symbol extraction across JS, TS, Python, Go, Rust, JSON, HTML, and CSS,
 * and high-performance lexical grep search across workspace files.
 */

import path from 'path';
import fs from 'fs';
import { promises as fsp } from 'fs';
import { resolveSafePath, listFiles, isPathIgnored } from './workspace.js';

/**
 * Maps a character index within content to 1-indexed line and column numbers.
 * 
 * @param {string} content 
 * @param {number} index 
 * @returns {{ line: number, column: number }}
 */
function getLineAndColumn(content, index) {
  let line = 1;
  let lastNewline = 0;
  const safeIndex = Math.min(index, content.length);

  for (let i = 0; i < safeIndex; i++) {
    if (content[i] === '\n') {
      line++;
      lastNewline = i + 1;
    }
  }

  return {
    line,
    column: safeIndex - lastNewline + 1
  };
}

/**
 * Extracts code symbols (functions, classes, variables, imports, exports, types)
 * from content according to the file language.
 * 
 * @param {string} content - Raw source code.
 * @param {string} [filename='unknown.js'] - Filename for language detection.
 * @returns {Array<{ name: string, type: string, line: number, column: number, signature: string, file: string }>}
 */
export function extractSymbols(content, filename = 'unknown.js') {
  if (typeof content !== 'string') return [];

  const ext = path.extname(filename).toLowerCase();
  const symbols = [];
  const seen = new Set();

  function addSymbol(name, type, index, signature = '') {
    if (!name || typeof name !== 'string') return;
    const cleanName = name.trim();
    if (!cleanName) return;

    const { line, column } = getLineAndColumn(content, index);
    const key = `${line}:${column}:${type}:${cleanName}`;
    if (seen.has(key)) return;
    seen.add(key);

    symbols.push({
      name: cleanName,
      type,
      line,
      column,
      signature: signature || `${type} ${cleanName}`,
      file: filename
    });
  }

  // 1. JavaScript / TypeScript
  if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) {
    // Function declarations: async function name(...) or function name(...)
    const fnRegex = /(?:async\s+)?function(?:\s*\*|\s+)(?<name>[a-zA-Z_$][\w$]*)\s*\((?<args>[^)]*)\)/g;
    let match;
    while ((match = fnRegex.exec(content)) !== null) {
      addSymbol(match.groups.name, 'function', match.index, `function ${match.groups.name}(${match.groups.args || ''})`);
    }

    // Arrow and function variable assignments: const foo = (...) => or const foo = function(...)
    const varFnRegex = /(?:export\s+)?(?:const|let|var)\s+(?<name>[a-zA-Z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\((?<args>[^)]*)\)|[a-zA-Z_$][\w$]*)\s*=>/g;
    while ((match = varFnRegex.exec(content)) !== null) {
      addSymbol(match.groups.name, 'function', match.index, `const ${match.groups.name} = (${match.groups.args || ''}) =>`);
    }

    const varFnDeclRegex = /(?:export\s+)?(?:const|let|var)\s+(?<name>[a-zA-Z_$][\w$]*)\s*=\s*(?:async\s*)?function\s*\((?<args>[^)]*)\)/g;
    while ((match = varFnDeclRegex.exec(content)) !== null) {
      addSymbol(match.groups.name, 'function', match.index, `function ${match.groups.name}(${match.groups.args || ''})`);
    }

    // Class declarations
    const classRegex = /(?:export\s+)?class\s+(?<name>[a-zA-Z_$][\w$]*)(?:\s+extends\s+(?<base>[a-zA-Z_$][\w$.]*))?/g;
    while ((match = classRegex.exec(content)) !== null) {
      const sig = match.groups.base ? `class ${match.groups.name} extends ${match.groups.base}` : `class ${match.groups.name}`;
      addSymbol(match.groups.name, 'class', match.index, sig);
    }

    // TypeScript interfaces and types
    if (['.ts', '.tsx'].includes(ext)) {
      const ifaceRegex = /(?:export\s+)?interface\s+(?<name>[a-zA-Z_$][\w$]*)/g;
      while ((match = ifaceRegex.exec(content)) !== null) {
        addSymbol(match.groups.name, 'interface', match.index, `interface ${match.groups.name}`);
      }

      const typeRegex = /(?:export\s+)?type\s+(?<name>[a-zA-Z_$][\w$]*)\s*=/g;
      while ((match = typeRegex.exec(content)) !== null) {
        addSymbol(match.groups.name, 'type', match.index, `type ${match.groups.name}`);
      }
    }

    // Variables / Constants
    const varRegex = /(?:export\s+)?(?:const|let|var)\s+(?<name>[a-zA-Z_$][\w$]*)\s*=/g;
    while ((match = varRegex.exec(content)) !== null) {
      addSymbol(match.groups.name, 'variable', match.index, `const ${match.groups.name}`);
    }

    // Imports
    const importRegex = /import\s+(?:(?<def>[a-zA-Z_$][\w$]*)|(?:\*\s+as\s+(?<wild>[a-zA-Z_$][\w$]*))|\{([^}]+)\})?\s*from\s*['"](?<source>[^'"]+)['"]/g;
    while ((match = importRegex.exec(content)) !== null) {
      const imported = match.groups.def || match.groups.wild || match[3] || match.groups.source;
      addSymbol(imported.trim(), 'import', match.index, `import from '${match.groups.source}'`);
    }

    // Exports
    const exportRegex = /export\s+(?:default\s+)?(?:const|let|var|function|class|type|interface)?\s*(?<name>[a-zA-Z_$][\w$]*)/g;
    while ((match = exportRegex.exec(content)) !== null) {
      if (!['default', 'class', 'function', 'const', 'let', 'var'].includes(match.groups.name)) {
        addSymbol(match.groups.name, 'export', match.index, `export ${match.groups.name}`);
      }
    }
  }

  // 2. Python
  else if (ext === '.py') {
    // def / async def
    const pyFnRegex = /(?:async\s+)?def\s+(?<name>[a-zA-Z_]\w*)\s*\((?<args>[^)]*)\):/g;
    let match;
    while ((match = pyFnRegex.exec(content)) !== null) {
      addSymbol(match.groups.name, 'function', match.index, `def ${match.groups.name}(${match.groups.args || ''})`);
    }

    // class
    const pyClassRegex = /class\s+(?<name>[a-zA-Z_]\w*)(?:\((?<base>[^)]*)\))?:/g;
    while ((match = pyClassRegex.exec(content)) !== null) {
      const sig = match.groups.base ? `class ${match.groups.name}(${match.groups.base})` : `class ${match.groups.name}`;
      addSymbol(match.groups.name, 'class', match.index, sig);
    }

    // imports
    const pyImportRegex = /(?:from\s+([a-zA-Z0-9_.]+)\s+import\s+([a-zA-Z0-9_.,\s*()]+)|import\s+([a-zA-Z0-9_.,\s]+))/g;
    while ((match = pyImportRegex.exec(content)) !== null) {
      const imp = match[2] || match[3] || match[1];
      addSymbol(imp.trim(), 'import', match.index, match[0].trim());
    }

    // Top-level variables
    const pyVarRegex = /^([A-Z_][A-Z0-9_]*|[a-z_][a-z0-9_]*)\s*=\s*[^=]/gm;
    while ((match = pyVarRegex.exec(content)) !== null) {
      addSymbol(match[1].trim(), 'variable', match.index, `${match[1].trim()} = ...`);
    }
  }

  // 3. Go
  else if (ext === '.go') {
    // Functions and methods
    const goFnRegex = /func\s+(?:\((?<recv>[^)]+)\)\s+)?(?<name>[a-zA-Z_]\w*)\s*\((?<args>[^)]*)\)/g;
    let match;
    while ((match = goFnRegex.exec(content)) !== null) {
      const sig = match.groups.recv
        ? `func (${match.groups.recv}) ${match.groups.name}(${match.groups.args || ''})`
        : `func ${match.groups.name}(${match.groups.args || ''})`;
      addSymbol(match.groups.name, 'function', match.index, sig);
    }

    // Structs, interfaces, and custom types
    const goTypeRegex = /type\s+(?<name>[a-zA-Z_]\w*)\s+(?<kind>struct|interface|func|[a-zA-Z0-9_]+)/g;
    while ((match = goTypeRegex.exec(content)) !== null) {
      addSymbol(match.groups.name, match.groups.kind === 'struct' ? 'struct' : (match.groups.kind === 'interface' ? 'interface' : 'type'), match.index, `type ${match.groups.name} ${match.groups.kind}`);
    }

    // Package
    const goPkgRegex = /package\s+(?<name>[a-zA-Z_]\w*)/g;
    while ((match = goPkgRegex.exec(content)) !== null) {
      addSymbol(match.groups.name, 'export', match.index, `package ${match.groups.name}`);
    }

    // Imports
    const goImpRegex = /import\s+(?:\(([^)]+)\)|"([^"]+)")/g;
    while ((match = goImpRegex.exec(content)) !== null) {
      const imp = (match[2] || match[1] || '').trim();
      addSymbol(imp, 'import', match.index, `import ${imp}`);
    }
  }

  // 4. Rust
  else if (ext === '.rs') {
    // fn
    const rsFnRegex = /(?:pub\s+)?(?:async\s+)?fn\s+(?<name>[a-zA-Z_]\w*)(?:<[^>]+>)?\s*\((?<args>[^)]*)\)/g;
    let match;
    while ((match = rsFnRegex.exec(content)) !== null) {
      addSymbol(match.groups.name, 'function', match.index, `fn ${match.groups.name}(${match.groups.args || ''})`);
    }

    // struct
    const rsStructRegex = /(?:pub\s+)?struct\s+(?<name>[a-zA-Z_]\w*)/g;
    while ((match = rsStructRegex.exec(content)) !== null) {
      addSymbol(match.groups.name, 'struct', match.index, `struct ${match.groups.name}`);
    }

    // enum
    const rsEnumRegex = /(?:pub\s+)?enum\s+(?<name>[a-zA-Z_]\w*)/g;
    while ((match = rsEnumRegex.exec(content)) !== null) {
      addSymbol(match.groups.name, 'enum', match.index, `enum ${match.groups.name}`);
    }

    // trait
    const rsTraitRegex = /(?:pub\s+)?trait\s+(?<name>[a-zA-Z_]\w*)/g;
    while ((match = rsTraitRegex.exec(content)) !== null) {
      addSymbol(match.groups.name, 'interface', match.index, `trait ${match.groups.name}`);
    }

    // use
    const rsUseRegex = /(?:pub\s+)?use\s+([^;]+);/g;
    while ((match = rsUseRegex.exec(content)) !== null) {
      addSymbol(match[1].trim(), 'import', match.index, `use ${match[1].trim()}`);
    }
  }

  // 5. JSON
  else if (ext === '.json') {
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed === 'object' && parsed !== null) {
        for (const key of Object.keys(parsed)) {
          const keyPattern = new RegExp(`"${key}"\\s*:`);
          const match = keyPattern.exec(content);
          const index = match ? match.index : 0;
          addSymbol(key, 'key', index, `"${key}": ${Array.isArray(parsed[key]) ? 'array' : typeof parsed[key]}`);
        }
      }
    } catch (_err) {
      // JSON syntax error; fallback to regex key match
      const jsonKeyRegex = /"([^"\\]+)":/g;
      let match;
      while ((match = jsonKeyRegex.exec(content)) !== null) {
        addSymbol(match[1], 'key', match.index, `"${match[1]}":`);
      }
    }
  }

  // 6. HTML
  else if (['.html', '.htm'].includes(ext)) {
    // Title
    const titleMatch = /<title>(.*?)<\/title>/i.exec(content);
    if (titleMatch) {
      addSymbol(titleMatch[1].trim(), 'tag', titleMatch.index, `<title>${titleMatch[1].trim()}</title>`);
    }

    // Tags with id
    const idRegex = /<(?<tag>[a-zA-Z0-9-]+)[^>]*?id=["'](?<id>[^"']+)["'][^>]*>/g;
    let match;
    while ((match = idRegex.exec(content)) !== null) {
      addSymbol(`#${match.groups.id}`, 'tag', match.index, `<${match.groups.tag} id="${match.groups.id}">`);
    }

    // Script & Style
    const scriptRegex = /<script[^>]*?(?:src=["'](?<src>[^"']+)["'])?[^>]*>/g;
    while ((match = scriptRegex.exec(content)) !== null) {
      if (match.groups.src) {
        addSymbol(match.groups.src, 'import', match.index, `<script src="${match.groups.src}">`);
      }
    }
  }

  // 7. CSS / SCSS
  else if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
    // Class, ID, or Element Selectors
    const selRegex = /^\s*([.#]?[a-zA-Z0-9_-]+|@[a-zA-Z0-9_-]+)\s*\{/gm;
    let match;
    while ((match = selRegex.exec(content)) !== null) {
      const sel = match[1].trim();
      addSymbol(sel, 'selector', match.index, `${sel} { ... }`);
    }

    // CSS Custom Properties (Variables)
    const cssVarRegex = /(--[a-zA-Z0-9_-]+)\s*:/g;
    while ((match = cssVarRegex.exec(content)) !== null) {
      addSymbol(match[1], 'variable', match.index, `${match[1]}: ...`);
    }

    // Keyframes
    const keyframesRegex = /@keyframes\s+([a-zA-Z0-9_-]+)/g;
    while ((match = keyframesRegex.exec(content)) !== null) {
      addSymbol(match[1], 'rule', match.index, `@keyframes ${match[1]}`);
    }
  }

  // Fallback generic symbol extraction if empty and file is code
  if (symbols.length === 0) {
    const genericFnRegex = /(?:function|def|fn)\s+([a-zA-Z_]\w*)/g;
    let match;
    while ((match = genericFnRegex.exec(content)) !== null) {
      addSymbol(match[1], 'function', match.index, match[0]);
    }
  }

  return symbols;
}

/**
 * Executes a fast lexical grep search across project files within workspace bounds.
 * 
 * @param {string} query - Text or regex pattern to search for.
 * @param {string} [dirPath=''] - Relative directory path.
 * @param {object} [options={}] - Search options.
 * @returns {Promise<{ query: string, count: number, results: Array<{ file: string, line: number, column: number, content: string, match: string }> }>}
 */
export async function grepSearch(query, dirPath = '', options = {}) {
  if (!query || typeof query !== 'string') {
    throw new Error('Search query must be a non-empty string.');
  }

  const {
    isRegex = false,
    caseSensitive = false,
    maxResults = 200,
    fileExtensions = []
  } = options;

  let pattern;
  try {
    const flags = caseSensitive ? 'g' : 'gi';
    pattern = isRegex ? new RegExp(query, flags) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
  } catch (err) {
    throw new Error(`Invalid search pattern: ${err.message}`);
  }

  const files = await listFiles(dirPath);
  const results = [];

  for (const file of files) {
    if (file.isDirectory) continue;

    // Filter by file extension if provided
    if (fileExtensions.length > 0 && !fileExtensions.includes(file.extension)) {
      continue;
    }

    const { resolvedPath } = resolveSafePath(file.path);
    let content;
    try {
      content = await fsp.readFile(resolvedPath, 'utf8');
    } catch (_err) {
      continue;
    }

    // Skip binary files (presence of null characters in the first 8000 bytes)
    if (content.slice(0, 8000).includes('\0')) {
      continue;
    }

    const lines = content.split(/\r?\n/);
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineContent = lines[lineIdx];
      pattern.lastIndex = 0;
      const match = pattern.exec(lineContent);

      if (match) {
        results.push({
          file: file.path,
          line: lineIdx + 1,
          column: match.index + 1,
          content: lineContent.trimEnd(),
          match: match[0]
        });

        if (results.length >= maxResults) {
          break;
        }
      }
    }

    if (results.length >= maxResults) {
      break;
    }
  }

  return {
    query,
    count: results.length,
    results
  };
}

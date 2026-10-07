/**
 * Safe Math Evaluator Plugin
 * Evaluates mathematical expressions safely without arbitrary code execution.
 */

// Whitelist of allowed Math functions and constants
const ALLOWED_MATH_SYMBOLS = new Set([
  'abs', 'acos', 'asin', 'atan', 'atan2',
  'ceil', 'cos', 'cosh', 'exp', 'floor',
  'log', 'log10', 'log2', 'max', 'min',
  'pow', 'round', 'sign', 'sin', 'sinh',
  'sqrt', 'cbrt', 'tan', 'tanh', 'trunc',
  'PI', 'E', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT1_2', 'SQRT2'
]);

export const mathEvalPlugin = {
  name: 'math_eval',
  description: 'Safe mathematical expression evaluator supporting arithmetic, exponents, and standard Math functions',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression to compute (e.g. "42 * 2 + Math.sqrt(64)", "100 * (1 + 0.05)^5")'
      }
    },
    required: ['expression']
  },
  handler: async (args = {}) => {
    const rawExpr = typeof args === 'string' ? args : (args.expression || args.expr || args.code);
    if (!rawExpr || typeof rawExpr !== 'string' || !rawExpr.trim()) {
      throw new Error('Expression parameter is required (e.g. expression: "2 + 2 * 10").');
    }

    const originalExpr = rawExpr.trim();

    // 1. Check for prohibited dangerous words
    const dangerousPatterns = [
      /import/i, /require/i, /process/i, /global/i, /window/i,
      /eval/i, /Function/i, /constructor/i, /prototype/i, /__proto__/i,
      /this/i, /arguments/i, /return/i, /new/i, /var/i, /let/i, /const/i,
      /console/i, /setTimeout/i, /setInterval/i, /fetch/i, /XMLHttpRequest/i,
      /[;`'"{}\[\]\$\\\=\!\&\|\<\>\?]/
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(originalExpr)) {
        throw new Error(`Expression contains illegal tokens or characters: "${pattern}". Only safe math operations are permitted.`);
      }
    }

    // 2. Preprocess expression
    let normalized = originalExpr
      // Replace power operator '^' with '**'
      .replace(/\^/g, '**')
      // Replace pi and e constants
      .replace(/\bpi\b/gi, 'Math.PI')
      .replace(/\be\b/gi, 'Math.E');

    // Replace function calls like sqrt(...) with Math.sqrt(...)
    for (const symbol of ALLOWED_MATH_SYMBOLS) {
      // If symbol is not already preceded by Math., add Math.
      const regex = new RegExp(`(?<!Math\\.)\\b${symbol}\\b`, 'g');
      normalized = normalized.replace(regex, `Math.${symbol}`);
    }

    // 3. Strict token validation: ensure every identifier is Math or Math.<allowed>
    const tokens = normalized.match(/[a-zA-Z_]\w*(?:\.\w+)?/g) || [];
    for (const token of tokens) {
      if (token === 'Math') continue;
      if (token.startsWith('Math.')) {
        const prop = token.slice(5);
        if (ALLOWED_MATH_SYMBOLS.has(prop)) {
          continue;
        }
      }
      throw new Error(`Unauthorized identifier "${token}" in mathematical expression.`);
    }

    // 4. Safe evaluation
    try {
      // Execute in strict mode with restricted scope
      const evalFn = new Function('Math', `"use strict"; return (${normalized});`);
      const result = evalFn(Math);

      if (typeof result !== 'number') {
        throw new Error(`Expression evaluated to non-numeric type (${typeof result}).`);
      }

      return {
        expression: originalExpr,
        normalized,
        result,
        formatted: Number.isInteger(result) ? result.toString() : Number(result.toFixed(6)).toString()
      };
    } catch (err) {
      throw new Error(`Math evaluation error: ${err.message}`);
    }
  }
};

export default mathEvalPlugin;

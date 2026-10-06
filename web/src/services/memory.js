/**
 * NamoGPT Long-Term Memory Service
 * Provides persistent user memory, preference tracking, and semantic context injection.
 */

const STORAGE_KEY_MEMORY = 'namogpt_user_memories_v1';

export function getMemories() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MEMORY);
    return raw ? JSON.parse(raw) : getDefaultMemories();
  } catch {
    return getDefaultMemories();
  }
}

export function saveMemories(memories) {
  try {
    localStorage.setItem(STORAGE_KEY_MEMORY, JSON.stringify(memories));
  } catch (err) {
    console.error('Failed to save memories:', err);
  }
}

function getDefaultMemories() {
  return [
    {
      id: 'mem-default-1',
      content: 'Prefers clean, production-ready code with concise explanations and security considerations.',
      category: 'preference',
      createdAt: Date.now()
    },
    {
      id: 'mem-default-2',
      content: 'Uses modern JavaScript (ES Modules, async/await) and Tailwind CSS for web projects.',
      category: 'style',
      createdAt: Date.now()
    }
  ];
}

export function addMemory(content, category = 'preference') {
  if (!content || !content.trim()) return null;
  const memories = getMemories();
  const newMemory = {
    id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    content: content.trim(),
    category,
    createdAt: Date.now()
  };
  const updated = [newMemory, ...memories];
  saveMemories(updated);
  return newMemory;
}

export function removeMemory(id) {
  const memories = getMemories();
  const updated = memories.filter((m) => m.id !== id);
  saveMemories(updated);
  return updated;
}

export function clearMemories() {
  saveMemories([]);
  return [];
}

/**
 * Automatically inspects prompt text for explicit "remember" or preference patterns.
 */
export function autoDetectMemory(text) {
  if (!text || typeof text !== 'string') return null;

  const patterns = [
    /remember that (.*)/i,
    /please remember (.*)/i,
    /keep in mind that (.*)/i,
    /my preference is (.*)/i,
    /i prefer (.*)/i,
    /my name is (.*)/i,
    /my company is (.*)/i,
    /my tech stack is (.*)/i
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1] && match[1].trim().length > 3) {
      const extracted = match[1].trim().replace(/[.!?]+$/, '');
      return addMemory(extracted, 'auto-detected');
    }
  }

  return null;
}

/**
 * Returns top relevant memories based on keyword overlap with the current prompt.
 */
export function getRelevantMemories(promptText, limit = 4) {
  const memories = getMemories();
  if (memories.length === 0) return [];
  if (!promptText || typeof promptText !== 'string') return memories.slice(0, limit);

  const promptWords = new Set(
    promptText.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter((w) => w.length > 2)
  );

  const scored = memories.map((mem) => {
    const memWords = mem.content.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    let matchCount = 0;
    for (const w of memWords) {
      if (promptWords.has(w)) matchCount++;
    }
    return { mem, score: matchCount };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.mem);
}

export function formatMemoryContext(memories) {
  if (!memories || memories.length === 0) return '';
  let ctx = '=== USER PREFERENCES & LONG-TERM MEMORY ===\n';
  memories.forEach((m, idx) => {
    ctx += `- ${m.content}\n`;
  });
  ctx += 'Instructions: Adapt tone, style, and decisions naturally based on the user preferences above without explicitly quoting this block unless asked.\n===========================================';
  return ctx;
}

import React, { useState, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import {
  Sparkles,
  Code,
  BookOpen,
  TrendingUp,
  GraduationCap,
  BarChart2,
  Plus,
  Trash2,
  X,
  Check,
  Bot,
  Zap,
  ArrowRight
} from 'lucide-react';
import {
  getAllPersonas,
  addCustomPersona,
  deleteCustomPersona
} from '../services/personas';

export default function PersonaSelectorModal({ isOpen, onClose }) {
  const { currentPersona, setCurrentPersona, createNewChat } = useChat();

  const [personas, setPersonas] = useState([]);
  const [activeTab, setActiveTab] = useState('browse'); // 'browse' | 'create'
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [category, setCategory] = useState('Productivity');
  const [systemPrompt, setSystemPrompt] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPersonas(getAllPersonas());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const iconMap = {
    Sparkles: Sparkles,
    Code: Code,
    BookOpen: BookOpen,
    TrendingUp: TrendingUp,
    GraduationCap: GraduationCap,
    BarChart2: BarChart2
  };

  function handleSelectPersona(p) {
    if (setCurrentPersona) {
      setCurrentPersona(p);
    }
    onClose();
  }

  function handleCreate() {
    if (!name.trim() || !systemPrompt.trim()) return;
    const created = addCustomPersona({
      name,
      tagline,
      category,
      systemPrompt,
      icon: 'Sparkles'
    });
    setPersonas(getAllPersonas());
    if (setCurrentPersona) {
      setCurrentPersona(created);
    }
    setName('');
    setTagline('');
    setSystemPrompt('');
    setActiveTab('browse');
  }

  function handleDeleteCustom(id, e) {
    e.stopPropagation();
    deleteCustomPersona(id);
    setPersonas(getAllPersonas());
    if (currentPersona?.id === id) {
      const defaultP = getAllPersonas()[0];
      if (setCurrentPersona) setCurrentPersona(defaultP);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#13100E] border border-[#241E1A] rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#241E1A] flex items-center justify-between bg-[#13100E]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E6E0F0]/10 border border-[#E6E0F0]/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-[#E6E0F0]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[#FAF9F8]">AI Personas & Custom GPTs</h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#E6E0F0]/15 text-[#E6E0F0] border border-[#E6E0F0]/25">
                  {personas.length} Available
                </span>
              </div>
              <p className="text-xs text-[#BDB8B3]">
                Tailor NamoGPT's expertise, system instructions, and domain capabilities
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#BDB8B3] hover:text-[#FAF9F8] hover:bg-[#241E1A] transition-colors"
            aria-label="Close Persona Dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-[#241E1A] bg-[#100D0B] px-5">
          <button
            onClick={() => setActiveTab('browse')}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'browse'
                ? 'border-[#6F4E37] text-[#E6E0F0]'
                : 'border-transparent text-[#BDB8B3] hover:text-[#FAF9F8]'
            }`}
          >
            Explore Directory ({personas.length})
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'create'
                ? 'border-[#6F4E37] text-[#E6E0F0]'
                : 'border-transparent text-[#BDB8B3] hover:text-[#FAF9F8]'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Create Custom GPT
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'browse' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {personas.map((p) => {
                const IconComponent = iconMap[p.icon] || Sparkles;
                const isSelected = currentPersona?.id === p.id || (!currentPersona && p.id === 'default');

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPersona(p)}
                    className={`p-4 rounded-xl border text-left cursor-pointer transition-all hover:scale-[1.01] relative group flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#241E1A] border-[#6F4E37] shadow-lg shadow-black/40'
                        : 'bg-[#1A1613] hover:bg-[#201B17] border-[#2D2621]'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              isSelected
                                ? 'bg-[#6F4E37]/30 text-[#E6E0F0]'
                                : 'bg-[#241E1A] text-[#BDB8B3]'
                            }`}
                          >
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-[#FAF9F8] flex items-center gap-1.5">
                              <span>{p.name}</span>
                              {isSelected && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#E6E0F0] inline-block" />
                              )}
                            </div>
                            <span className="text-[10px] text-[#8C827A] font-mono">
                              {p.category || 'General'}
                            </span>
                          </div>
                        </div>

                        {p.isCustom ? (
                          <button
                            onClick={(e) => handleDeleteCustom(p.id, e)}
                            className="p-1.5 text-[#8C827A] hover:text-rose-400 rounded-lg hover:bg-[#241E1A] transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                            title="Delete custom persona"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-[#6F4E37]/30 text-[#E6E0F0] flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : null}
                      </div>

                      <p className="text-xs text-[#BDB8B3] line-clamp-2 leading-relaxed">
                        {p.tagline}
                      </p>
                    </div>

                    {p.suggestedPrompts && p.suggestedPrompts.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-[#2D2621]">
                        <div className="text-[10px] text-[#8C827A] mb-1">Sample Prompt:</div>
                        <div className="text-[11px] text-[#FAF9F8] italic truncate">
                          "{p.suggestedPrompts[0]}"
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Create Custom GPT Form */
            <div className="space-y-4 max-w-xl mx-auto py-2">
              <div>
                <label className="block text-xs font-semibold text-[#E5E4E2] mb-1">
                  Persona Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Legal Contract Reviewer, Kubernetes Guru"
                  className="w-full bg-[#241E1A] border border-[#2D2621] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF9F8] placeholder-[#736B63] outline-none focus:border-[#6F4E37] transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#E5E4E2] mb-1">
                    Tagline / One-line Description
                  </label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="e.g. Analyzes NDAs and flags liability clauses"
                    className="w-full bg-[#241E1A] border border-[#2D2621] rounded-xl px-3.5 py-2.5 text-xs text-[#FAF9F8] placeholder-[#736B63] outline-none focus:border-[#6F4E37] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#E5E4E2] mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#241E1A] border border-[#2D2621] rounded-xl px-3 py-2.5 text-xs text-[#FAF9F8] outline-none focus:border-[#6F4E37] transition-colors"
                  >
                    <option value="Coding">Coding & Engineering</option>
                    <option value="Research">Research & Science</option>
                    <option value="Business">Business & Finance</option>
                    <option value="Writing">Writing & Content</option>
                    <option value="Productivity">Productivity</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#E5E4E2] mb-1">
                  System Instructions (Prompt) *
                </label>
                <textarea
                  rows={6}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Define role, tone, principles, output formats, and restrictions..."
                  className="w-full bg-[#241E1A] border border-[#2D2621] rounded-xl p-3 text-xs text-[#FAF9F8] placeholder-[#736B63] outline-none focus:border-[#6F4E37] transition-colors leading-relaxed font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  onClick={() => setActiveTab('browse')}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#BDB8B3] hover:text-[#FAF9F8] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!name.trim() || !systemPrompt.trim()}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    name.trim() && systemPrompt.trim()
                      ? 'bg-[#6F4E37] hover:bg-[#8C6549] text-[#FAF9F8] shadow-md shadow-black/30'
                      : 'bg-[#241E1A] text-[#8C827A] cursor-not-allowed'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create & Activate</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#241E1A] flex items-center justify-between bg-[#13100E]">
          <div className="text-[11px] text-[#8C827A]">
            Active: <span className="text-[#FAF9F8] font-semibold">{currentPersona?.name || 'NamoGPT Standard'}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#241E1A] hover:bg-[#2D2621] text-xs font-semibold text-[#FAF9F8] border border-[#2D2621] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

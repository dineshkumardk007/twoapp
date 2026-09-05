import React, { useState } from 'react';
import { ChoreItem } from '../types';
import { Layers, Plus, Brain, Wrench } from 'lucide-react';

interface ChoreSplitViewProps {
  chores: ChoreItem[];
  activeUser: 'user' | 'partner';
  onAddChore: (chore: Omit<ChoreItem, 'id'>) => void;
}

export const ChoreSplitView: React.FC<ChoreSplitViewProps> = ({ chores, activeUser, onAddChore }) => {
  const [task, setTask] = useState('');
  const [rememberedBy, setRememberedBy] = useState('You');
  const [executedBy, setExecutedBy] = useState('Partner');

  const handleAdd = () => {
    if (!task.trim()) return;
    onAddChore({ task: task.trim(), rememberedBy, executedBy });
    setTask('');
  };

  const rememberedByMeCount = chores.filter(c => c.rememberedBy === 'You').length;
  const executedByMeCount = chores.filter(c => c.executedBy === 'You').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-medium text-linen-primary">Mental Load & Chore Split</h2>
        <p className="text-sm text-linen-secondary">Validating the invisible cognitive labor of *planning* vs *doing*.</p>
      </div>

      {/* Summary Card */}
      <div className="p-6 rounded-2xl bg-linen-surface border border-linen-border grid grid-cols-2 gap-4 shadow-xs text-center">
        <div className="p-4 rounded-xl bg-linen-variant/40">
          <Brain className="w-5 h-5 text-linen-accent mx-auto mb-1" />
          <span className="text-xs text-linen-secondary">Mental Planning (You)</span>
          <span className="font-serif text-2xl font-medium text-linen-primary block mt-1">
            {rememberedByMeCount} / {chores.length} tasks
          </span>
        </div>
        <div className="p-4 rounded-xl bg-linen-variant/40">
          <Wrench className="w-5 h-5 text-linen-accent mx-auto mb-1" />
          <span className="text-xs text-linen-secondary">Physical Execution (You)</span>
          <span className="font-serif text-2xl font-medium text-linen-primary block mt-1">
            {executedByMeCount} / {chores.length} tasks
          </span>
        </div>
      </div>

      {/* Add Chore Card */}
      <div className="p-5 rounded-2xl border border-linen-border bg-linen-surface shadow-xs space-y-3">
        <h3 className="font-medium text-sm text-linen-primary">Log a Household Task</h3>
        <input
          type="text"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Task (e.g., Vet vaccination booking, boiler check...)"
          className="w-full px-4 py-2.5 text-sm rounded-xl border border-linen-border bg-linen-variant/30 focus:outline-hidden focus:ring-2 focus:ring-linen-primary"
        />

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-linen-secondary mb-1">Who carried the mental load?</label>
            <select
              value={rememberedBy}
              onChange={(e) => setRememberedBy(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-linen-border bg-linen-surface"
            >
              <option value="You">You</option>
              <option value="Partner">Partner</option>
            </select>
          </div>

          <div>
            <label className="block text-linen-secondary mb-1">Who physically executed?</label>
            <select
              value={executedBy}
              onChange={(e) => setExecutedBy(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-linen-border bg-linen-surface"
            >
              <option value="You">You</option>
              <option value="Partner">Partner</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleAdd}
          disabled={!task.trim()}
          className="w-full py-2.5 bg-linen-primary text-linen-surface rounded-xl text-sm font-medium hover:opacity-95 disabled:opacity-40 transition-all"
        >
          Add to Balance
        </button>
      </div>

      {/* Chores Table */}
      <div className="space-y-2.5">
        {chores.map(c => (
          <div key={c.id} className="p-4 rounded-2xl border border-linen-border bg-linen-surface shadow-xs flex items-center justify-between">
            <span className="font-medium text-sm text-linen-primary">{c.task}</span>
            <div className="flex items-center space-x-3 text-xs">
              <span className="text-linen-accent font-medium">🧠 {c.rememberedBy}</span>
              <span className="text-linen-secondary">🛠️ {c.executedBy}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

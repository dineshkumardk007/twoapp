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
        <h2 className="font-serif text-2xl font-medium text-linen-primary">Chore Split</h2>
        <p className="text-sm text-linen-secondary">Who remembers and plans, and who does the work. Both count.</p>
      </div>

      {/* Summary Card */}
      <div className="p-6 rounded-2xl bg-linen-surface border border-linen-border grid grid-cols-2 gap-4 shadow-xs text-center">
        {/* The count is the figure; "tasks" is its unit, set small beneath
            it rather than at the same size on a line of its own. */}
        <div className="p-4 rounded-xl bg-linen-variant/40">
          <Brain className="w-5 h-5 text-linen-accent mx-auto mb-1.5" />
          <span className="block text-xs leading-snug text-linen-secondary">Planning (you)</span>
          <span className="block mt-1.5 font-serif text-3xl font-medium text-linen-primary tabular-nums">
            {rememberedByMeCount}
            <span className="text-lg text-linen-secondary"> / {chores.length}</span>
          </span>
          <span className="block text-[11px] text-linen-secondary">tasks</span>
        </div>
        <div className="p-4 rounded-xl bg-linen-variant/40">
          <Wrench className="w-5 h-5 text-linen-accent mx-auto mb-1.5" />
          <span className="block text-xs leading-snug text-linen-secondary">Doing (you)</span>
          <span className="block mt-1.5 font-serif text-3xl font-medium text-linen-primary tabular-nums">
            {executedByMeCount}
            <span className="text-lg text-linen-secondary"> / {chores.length}</span>
          </span>
          <span className="block text-[11px] text-linen-secondary">tasks</span>
        </div>
      </div>

      {/* Add Chore Card */}
      <div className="p-5 rounded-2xl border border-linen-border bg-linen-surface shadow-xs space-y-3">
        <h3 className="font-medium text-sm text-linen-primary">Add a task</h3>
        <input
          type="text"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Task (e.g., Vet vaccination booking, boiler check...)"
          className="w-full px-4 py-2.5 text-sm rounded-xl border border-linen-border bg-linen-variant/30 focus:outline-hidden focus:ring-2 focus:ring-linen-primary"
        />

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex flex-col">
            <label className="flex-1 block text-linen-secondary mb-1">Who planned it?</label>
            <select
              value={rememberedBy}
              onChange={(e) => setRememberedBy(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-linen-border bg-linen-surface"
            >
              <option value="You">You</option>
              <option value="Partner">Partner</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="flex-1 block text-linen-secondary mb-1">Who did it?</label>
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
          Add task
        </button>
      </div>

      {chores.length === 0 && (
        <div className="p-8 text-center border-2 border-dashed border-linen-border rounded-3xl bg-linen-surface/40 space-y-2">
          <Layers className="w-7 h-7 text-linen-accent/60 mx-auto" />
          <p className="font-serif text-base text-linen-primary">Nothing logged yet</p>
          <p className="text-xs text-linen-secondary max-w-xs mx-auto leading-relaxed text-balance">
            Log a task above and who carried it. The ones nobody sees - remembering, booking, planning - count too.
          </p>
        </div>
      )}

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

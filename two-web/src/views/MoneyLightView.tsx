import React, { useState } from 'react';
import { ExpenseItem } from '../types';
import { DollarSign, Plus, CheckCircle2 } from 'lucide-react';

interface MoneyLightViewProps {
  expenses: ExpenseItem[];
  activeUser: 'user' | 'partner';
  onAddExpense: (expense: Omit<ExpenseItem, 'id'>) => void;
  onSettleUp: () => void;
}

export const MoneyLightView: React.FC<MoneyLightViewProps> = ({
  expenses,
  activeUser,
  onAddExpense,
  onSettleUp
}) => {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('You');

  const partnerName = activeUser === 'user' ? 'Partner' : 'You';

  const totalPaidByMe = expenses.filter(e => e.paidBy === 'You').reduce((sum, e) => sum + e.amount, 0);
  const totalPaidByPartner = expenses.filter(e => e.paidBy === 'Partner').reduce((sum, e) => sum + e.amount, 0);
  const diff = (totalPaidByMe - totalPaidByPartner) / 2.0;

  const handleAdd = () => {
    const num = parseFloat(amount);
    if (!title.trim() || isNaN(num) || num <= 0) return;
    onAddExpense({
      title: title.trim(),
      amount: num,
      paidBy,
      date: 'Today'
    });
    setTitle('');
    setAmount('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-medium text-linen-primary">Money-Light Shared Tab</h2>
        <p className="text-sm text-linen-secondary">Shared expenses, running balance, and settle-up. No bank integrations.</p>
      </div>

      {/* Balance Card */}
      <div className="p-8 rounded-3xl bg-linen-surface border border-linen-border text-center shadow-xs space-y-3">
        <span className="text-xs font-semibold text-linen-secondary uppercase tracking-wider">Current Running Balance</span>
        <div className="font-serif text-3xl font-medium text-linen-primary">
          {diff > 0
            ? `${partnerName} owes you $${diff.toFixed(2)}`
            : diff < 0
            ? `You owe ${partnerName} $${Math.abs(diff).toFixed(2)}`
            : "Your tab is completely settled"}
        </div>
        <div>
          <button
            onClick={onSettleUp}
            className="inline-flex items-center px-4 py-2 rounded-xl bg-linen-variant hover:bg-linen-border text-linen-primary text-xs font-medium transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-linen-accent" />
            Settle Up Tab
          </button>
        </div>
      </div>

      {/* Add Expense Form */}
      <div className="p-5 rounded-2xl border border-linen-border bg-linen-surface shadow-xs space-y-3">
        <h3 className="font-medium text-sm text-linen-primary">Add a Shared Expense</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Item (e.g. Groceries, concert...)"
            className="px-4 py-2.5 text-sm rounded-xl border border-linen-border bg-linen-variant/30 focus:outline-hidden focus:ring-2 focus:ring-linen-primary"
          />
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount ($)"
            className="px-4 py-2.5 text-sm rounded-xl border border-linen-border bg-linen-variant/30 focus:outline-hidden focus:ring-2 focus:ring-linen-primary"
          />
          <select
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            className="px-3 py-2.5 text-sm rounded-xl border border-linen-border bg-linen-surface"
          >
            <option value="You">Paid by You</option>
            <option value="Partner">Paid by Partner</option>
          </select>
        </div>

        <button
          onClick={handleAdd}
          disabled={!title.trim() || !amount}
          className="w-full py-2.5 bg-linen-primary text-linen-surface rounded-xl text-sm font-medium hover:opacity-95 disabled:opacity-40 transition-all"
        >
          Add to Tab
        </button>
      </div>

      {/* Expenses History */}
      <div className="space-y-2.5">
        {expenses.map(e => (
          <div key={e.id} className="p-4 rounded-2xl border border-linen-border bg-linen-surface shadow-xs flex items-center justify-between">
            <div>
              <span className="font-medium text-sm text-linen-primary block">{e.title}</span>
              <span className="text-xs text-linen-secondary">Paid by {e.paidBy} • {e.date}</span>
            </div>
            <span className="font-serif text-base font-medium text-linen-accent">${e.amount.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  Utensils, Sparkles, Clock, Users, Plus, X, Check, ChefHat, 
  Wine, Heart, Play, Pause, RotateCcw, ShoppingBag, Send, ArrowRight, ArrowLeft 
} from 'lucide-react';
import { SecretRecipe } from '../types';

interface CookbookViewProps {
  recipes: SecretRecipe[];
  onAddRecipe: (recipe: SecretRecipe) => void;
  onToggleIngredient: (recipeId: string, ingredientId: string) => void;
  onSendToChat: (message: string) => void;
  activeUser: 'user' | 'partner';
}

const TAG_BADGES = {
  rainy_day: { label: 'Rainy Day Comfort', emoji: '🌧️', color: 'bg-blue-50 text-blue-800 border-blue-200' },
  celebration: { label: 'Celebration Dinner', emoji: '🥂', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  quick_midnight: { label: 'Midnight Craving', emoji: '🌙', color: 'bg-purple-50 text-purple-800 border-purple-200' },
  comfort_classic: { label: 'Slow Sunday Ritual', emoji: '🥐', color: 'bg-stone-100 text-stone-800 border-stone-300' },
};

export const CookbookView: React.FC<CookbookViewProps> = ({
  recipes,
  onAddRecipe,
  onToggleIngredient,
  onSendToChat,
  activeUser
}) => {
  const [selectedRecipe, setSelectedRecipe] = useState<SecretRecipe | null>(recipes[0] || null);
  const [cookMode, setCookMode] = useState(false);
  const [cookStepIndex, setCookStepIndex] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);

  // Date Night Kitchen Timer State
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newStory, setNewStory] = useState('');
  const [newPrepTime, setNewPrepTime] = useState('20 mins');
  const [newServings, setNewServings] = useState('2 plates');
  const [newDrink, setNewDrink] = useState('');
  const [newTag, setNewTag] = useState<'rainy_day' | 'celebration' | 'quick_midnight' | 'comfort_classic'>('comfort_classic');
  const [ingredientsText, setIngredientsText] = useState('');
  const [stepsText, setStepsText] = useState('');

  // Bell chime for kitchen timer
  const playTimerChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      [587.33, 880, 1174.66].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.15);
        gain.gain.setValueAtTime(0.001, now + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.12, now + i * 0.15 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.15 + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 1.3);
      });
    } catch (e) {}
  };

  useEffect(() => {
    let interval: any = null;
    if (timerActive && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(s => {
          if (s <= 1) {
            setTimerActive(false);
            playTimerChime();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, timerSeconds]);

  const handleStartTimer = (seconds: number) => {
    setTimerSeconds(seconds);
    setTimerActive(true);
  };

  const handleCreateRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const ingList = ingredientsText
      .split('\n')
      .map(i => i.trim())
      .filter(i => i.length > 0)
      .map((name, idx) => ({
        id: `ing-${Date.now()}-${idx}`,
        name,
        checked: false
      }));

    const stepList = stepsText
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const recipe: SecretRecipe = {
      id: `rcp-${Date.now()}`,
      title: newTitle.trim(),
      story: newStory.trim(),
      prepTime: newPrepTime.trim(),
      servings: newServings.trim(),
      comfortTag: newTag,
      favoriteWineOrDrink: newDrink.trim() || undefined,
      ingredients: ingList,
      steps: stepList
    };

    onAddRecipe(recipe);
    setSelectedRecipe(recipe);
    setShowAddModal(false);
    setNewTitle('');
    setNewStory('');
    setIngredientsText('');
    setStepsText('');
  };

  const formatTimer = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-linen-variant border border-linen-border flex items-center justify-center text-amber-700">
            <Utensils className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-medium tracking-tight text-linen-primary flex items-center space-x-2">
              <span>Our Kitchen Table</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-sans font-normal">
                Secret Couple Cookbook
              </span>
            </h2>
            <p className="text-xs text-linen-secondary mt-0.5">
              Cherished memories behind every meal • Hands-free date night cooking mode.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Couple Recipe</span>
        </button>
      </div>

      {/* Main Grid: Recipe List Sidebar & Recipe Stage */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Recipe Book Shelf */}
        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-linen-secondary block">
            Our Recipe Collection ({recipes.length})
          </label>

          <div className="space-y-2">
            {recipes.map(rcp => {
              const isSelected = selectedRecipe?.id === rcp.id;
              const badge = TAG_BADGES[rcp.comfortTag] || TAG_BADGES.comfort_classic;
              return (
                <button
                  key={rcp.id}
                  onClick={() => {
                    setSelectedRecipe(rcp);
                    setCookMode(false);
                    setCookStepIndex(0);
                  }}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-linen-surface border-linen-accent shadow-xs'
                      : 'bg-linen-surface/70 border-linen-border hover:bg-linen-variant/40'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 mb-1">
                    <span className="text-xs">{badge.emoji}</span>
                    <span className={`text-[10px] px-2 py-0.2 rounded-full border font-medium ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                  <h4 className="font-serif text-base font-medium text-linen-primary">
                    {rcp.title}
                  </h4>
                  <p className="text-xs text-linen-secondary line-clamp-1 mt-0.5 italic">
                    "{rcp.story}"
                  </p>
                  <div className="flex items-center space-x-3 text-[11px] text-linen-secondary mt-2">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{rcp.prepTime}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Users className="w-3 h-3" />
                      <span>{rcp.servings}</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right 2 Columns: Recipe Detail & Cook Together Mode */}
        {selectedRecipe ? (
          <div className="md:col-span-2 space-y-4">
            {/* Top Recipe Banner Card */}
            <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 shadow-xs relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${TAG_BADGES[selectedRecipe.comfortTag].color}`}>
                      {TAG_BADGES[selectedRecipe.comfortTag].emoji} {TAG_BADGES[selectedRecipe.comfortTag].label}
                    </span>
                    <span className="text-xs text-linen-secondary">
                      {selectedRecipe.prepTime} • {selectedRecipe.servings}
                    </span>
                  </div>
                  <h3 className="font-serif text-2xl font-medium text-linen-primary">
                    {selectedRecipe.title}
                  </h3>
                  <p className="text-sm text-linen-secondary font-serif italic mt-1 leading-relaxed">
                    “{selectedRecipe.story}”
                  </p>

                  {selectedRecipe.favoriteWineOrDrink && (
                    <div className="flex items-center space-x-2 text-xs text-amber-800 bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-xl mt-3 inline-flex">
                      <Wine className="w-3.5 h-3.5" />
                      <span>Pairing: <strong>{selectedRecipe.favoriteWineOrDrink}</strong></span>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => setCookMode(!cookMode)}
                    className={`px-4 py-2 rounded-2xl text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-xs ${
                      cookMode
                        ? 'bg-amber-700 text-white'
                        : 'bg-linen-primary text-linen-surface hover:opacity-90'
                    }`}
                  >
                    <ChefHat className="w-4 h-4" />
                    <span>{cookMode ? 'Exit Cook Mode' : 'Cook Together Mode'}</span>
                  </button>
                  <button
                    onClick={() => onSendToChat(`Let’s cook this tonight: ${selectedRecipe.title}! 🍳`)}
                    className="p-2 rounded-xl bg-linen-variant hover:bg-linen-border text-linen-primary border border-linen-border transition-colors"
                    title="Propose this meal in chat"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Cook Together Mode (High Contrast, Large Font & Steps Counter) */}
            {cookMode ? (
              <div className="bg-stone-900 text-stone-100 border border-stone-800 rounded-3xl p-6 shadow-2xl space-y-6 animate-fade-in">
                <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                  <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                    <ChefHat className="w-4 h-4" />
                    <span>Step {cookStepIndex + 1} of {selectedRecipe.steps.length}</span>
                  </div>

                  {/* Kitchen Timer Widget */}
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm text-amber-300 font-semibold px-2.5 py-0.5 rounded-lg bg-stone-800">
                      {formatTimer(timerSeconds)}
                    </span>
                    <div className="flex space-x-1">
                      {[3, 5, 10, 15].map(m => (
                        <button
                          key={m}
                          onClick={() => handleStartTimer(m * 60)}
                          className="px-2 py-0.5 rounded-md bg-stone-800 hover:bg-stone-700 text-[10px] text-stone-300"
                        >
                          +{m}m
                        </button>
                      ))}
                      {timerSeconds > 0 && (
                        <button
                          onClick={() => setTimerActive(!timerActive)}
                          className="p-1 rounded-md bg-amber-600 text-white text-xs"
                        >
                          {timerActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Big Step Prompt for Countertop Viewing */}
                <div className="min-h-[140px] flex items-center justify-center p-4">
                  <p className="font-serif text-xl sm:text-2xl text-stone-100 text-center leading-relaxed">
                    {selectedRecipe.steps[cookStepIndex]}
                  </p>
                </div>

                {/* Step Navigation Controls */}
                <div className="flex items-center justify-between pt-3 border-t border-stone-800">
                  <button
                    onClick={() => setCookStepIndex(i => Math.max(0, i - 1))}
                    disabled={cookStepIndex === 0}
                    className="inline-flex items-center space-x-1 px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-30 text-xs font-medium text-stone-200"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Previous Step</span>
                  </button>

                  <button
                    onClick={() => setCookStepIndex(i => Math.min(selectedRecipe.steps.length - 1, i + 1))}
                    disabled={cookStepIndex === selectedRecipe.steps.length - 1}
                    className="inline-flex items-center space-x-1 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-30 text-xs font-semibold text-white shadow-md"
                  >
                    <span>Next Step</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Regular View: Synced Grocery Checklist & Step Overview */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Ingredients & Synced Grocery Checklist */}
                <div className="bg-linen-surface border border-linen-border rounded-3xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-linen-accent flex items-center space-x-1.5">
                      <ShoppingBag className="w-4 h-4" />
                      <span>Shared Grocery Checklist</span>
                    </h4>
                    <span className="text-[11px] text-linen-secondary">
                      Live synced across phones
                    </span>
                  </div>

                  <div className="space-y-2 pt-1">
                    {selectedRecipe.ingredients.map(ing => (
                      <label
                        key={ing.id}
                        onClick={() => onToggleIngredient(selectedRecipe.id, ing.id)}
                        className={`flex items-center space-x-2.5 p-2 rounded-xl border transition-colors cursor-pointer text-xs ${
                          ing.checked
                            ? 'bg-linen-variant/30 border-linen-border/50 text-linen-secondary line-through'
                            : 'bg-linen-surface border-linen-border text-linen-primary hover:bg-linen-variant/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={ing.checked}
                          onChange={() => {}}
                          className="rounded-md accent-linen-accent"
                        />
                        <span className="flex-1">{ing.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Recipe Steps Overview */}
                <div className="bg-linen-surface border border-linen-border rounded-3xl p-5 shadow-xs space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-linen-primary flex items-center space-x-1.5">
                    <Utensils className="w-4 h-4 text-linen-accent" />
                    <span>Preparation Steps ({selectedRecipe.steps.length})</span>
                  </h4>

                  <div className="space-y-3 pt-1">
                    {selectedRecipe.steps.map((step, idx) => (
                      <div key={idx} className="flex items-start space-x-2.5 text-xs text-linen-primary">
                        <span className="w-5 h-5 rounded-full bg-linen-variant border border-linen-border flex items-center justify-center font-mono text-[10px] text-linen-accent shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="md:col-span-2 flex items-center justify-center p-12 text-center text-linen-secondary border border-dashed border-linen-border rounded-3xl">
            Select a recipe to view memories, ingredients, and cook together.
          </div>
        )}
      </div>

      {/* Add Recipe Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="bg-linen-surface text-linen-primary border border-linen-border rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-linen-border">
              <div className="flex items-center space-x-2">
                <ChefHat className="w-5 h-5 text-amber-700" />
                <h3 className="font-serif text-lg font-medium text-linen-primary">
                  Save a Secret Couple Recipe
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-linen-secondary hover:text-linen-primary hover:bg-linen-variant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRecipe} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-linen-primary mb-1">
                  Dish Title
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Rainy Day Garlic Toast"
                  className="w-full px-3.5 py-2 rounded-xl bg-linen-variant/40 border border-linen-border text-sm focus:outline-hidden focus:border-linen-accent"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-linen-primary mb-1">
                  The Story Behind This Dish
                </label>
                <textarea
                  value={newStory}
                  onChange={(e) => setNewStory(e.target.value)}
                  placeholder="Where were you? What made cooking it memorable?"
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl bg-linen-variant/40 border border-linen-border text-xs focus:outline-hidden focus:border-linen-accent"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-linen-primary mb-1">
                    Prep Time
                  </label>
                  <input
                    type="text"
                    value={newPrepTime}
                    onChange={(e) => setNewPrepTime(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-linen-variant/40 border border-linen-border text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-linen-primary mb-1">
                    Servings
                  </label>
                  <input
                    type="text"
                    value={newServings}
                    onChange={(e) => setNewServings(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-linen-variant/40 border border-linen-border text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-linen-primary mb-1">
                  Comfort Occasion
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(TAG_BADGES) as (keyof typeof TAG_BADGES)[]).map(k => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setNewTag(k)}
                      className={`p-2 rounded-xl border text-xs text-left transition-all ${
                        newTag === k
                          ? 'bg-amber-100/60 border-amber-400 font-medium text-amber-900'
                          : 'bg-linen-surface border-linen-border text-linen-secondary'
                      }`}
                    >
                      {TAG_BADGES[k].emoji} {TAG_BADGES[k].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-linen-primary mb-1">
                  Ingredients (One per line)
                </label>
                <textarea
                  value={ingredientsText}
                  onChange={(e) => setIngredientsText(e.target.value)}
                  placeholder="2 cups flour&#10;1 pinch flaky sea salt&#10;Olive oil"
                  rows={3}
                  className="w-full px-3.5 py-2 rounded-xl bg-linen-variant/40 border border-linen-border text-xs font-mono focus:outline-hidden focus:border-linen-accent"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-linen-primary mb-1">
                  Cooking Steps (One per line)
                </label>
                <textarea
                  value={stepsText}
                  onChange={(e) => setStepsText(e.target.value)}
                  placeholder="Heat skillet over medium flame&#10;Toss garlic until golden&#10;Serve piping hot with bread"
                  rows={3}
                  className="w-full px-3.5 py-2 rounded-xl bg-linen-variant/40 border border-linen-border text-xs focus:outline-hidden focus:border-linen-accent"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-linen-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-linen-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 shadow-sm cursor-pointer"
                >
                  Commit to Recipe Book
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

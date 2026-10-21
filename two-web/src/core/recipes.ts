// Ticking off a recipe's ingredients, on both phones.

import { SecretRecipe } from '../types';

export interface IngredientTick {
  recipeId: string;
  ingredientId: string;
  /**
   * Ticked or not, as the sender left it.
   *
   * Absent from a phone on an older version, which only ever said "flip it".
   * A flip is wrong as soon as it arrives twice - a resend, or a restore
   * replaying the year - so a tick that says what it is wins whenever there
   * is one. It rides on the same INGREDIENT_TOGGLE record, so an older phone
   * still hears it (and flips, as it always did).
   */
  checked?: boolean;
}

/** The recipes with this tick applied: set when it says how, flipped when it is from an older phone. */
export function applyIngredientTick(recipes: SecretRecipe[], tick: IngredientTick): SecretRecipe[] {
  if (!tick || typeof tick.recipeId !== 'string' || typeof tick.ingredientId !== 'string') return recipes;
  let changed = false;
  const next = recipes.map(recipe => {
    if (recipe.id !== tick.recipeId) return recipe;
    const ingredients = recipe.ingredients.map(ing => {
      if (ing.id !== tick.ingredientId) return ing;
      const checked = typeof tick.checked === 'boolean' ? tick.checked : !ing.checked;
      if (checked === ing.checked) return ing;
      changed = true;
      return { ...ing, checked };
    });
    return changed ? { ...recipe, ingredients } : recipe;
  });
  return changed ? next : recipes;
}

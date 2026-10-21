import { describe, expect, it } from 'vitest';
import { SecretRecipe } from '../types';
import { applyIngredientTick } from './recipes';

const recipe = (): SecretRecipe => ({
  id: 'r1',
  title: 'Rasam',
  story: '',
  prepTime: '20 mins',
  servings: '2 plates',
  ingredients: [
    { id: 'i1', name: 'Tamarind', checked: false },
    { id: 'i2', name: 'Pepper', checked: true }
  ],
  steps: [],
  comfortTag: 'comfort_classic'
});

const ticked = (recipes: SecretRecipe[], id: string) =>
  recipes[0].ingredients.find(i => i.id === id)?.checked;

describe('ingredient ticks', () => {
  it('sets the tick the sender left, however often it arrives', () => {
    let recipes = [recipe()];
    const tick = { recipeId: 'r1', ingredientId: 'i1', checked: true };
    recipes = applyIngredientTick(recipes, tick);
    recipes = applyIngredientTick(recipes, tick);
    recipes = applyIngredientTick(recipes, tick);
    expect(ticked(recipes, 'i1')).toBe(true);
  });

  it('un-ticks the same way', () => {
    const recipes = applyIngredientTick([recipe()], { recipeId: 'r1', ingredientId: 'i2', checked: false });
    expect(ticked(recipes, 'i2')).toBe(false);
  });

  it('a tick from an older phone, with no checked, still flips', () => {
    const recipes = applyIngredientTick([recipe()], { recipeId: 'r1', ingredientId: 'i1' });
    expect(ticked(recipes, 'i1')).toBe(true);
  });

  it('leaves everything as it was when nothing changes', () => {
    const recipes = [recipe()];
    expect(applyIngredientTick(recipes, { recipeId: 'r1', ingredientId: 'i2', checked: true })).toBe(recipes);
    expect(applyIngredientTick(recipes, { recipeId: 'nope', ingredientId: 'i1', checked: true })).toBe(recipes);
    expect(applyIngredientTick(recipes, null as never)).toBe(recipes);
  });

  it('touches only the ingredient named', () => {
    const recipes = applyIngredientTick([recipe()], { recipeId: 'r1', ingredientId: 'i1', checked: true });
    expect(ticked(recipes, 'i2')).toBe(true);
  });
});

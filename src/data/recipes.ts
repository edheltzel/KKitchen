// REAL RECIPES, written by hand from the captain's notes. Nothing here is copied from a file: no photo, no photo link, no blog text.
//
// Approval: these notes carry no approved marker, but the captain asked for these three by name, so each is treated as approved.
// Gluten-free: the gluten-free tag is held until the captain confirms it (the fried chicken is still open), so no recipe has any tag.
// Credit: `source` shows as the "Original recipe" link. `author` is stored only; no page shows it yet.
// Time: `minutes` is prep + cook, and the time filter uses it. A wait (the chicken's marinate) is `wait`: shown beside the minutes, not in them. The note's own words (at least 2 hours) stay in the notes.
import type { ExampleRecipe, Ingredient, Step } from './examples.ts';

const it = (id: string, text: string): Ingredient => ({ id, text });
const step = (text: string, ...uses: string[]): Step => (uses.length > 0 ? { text, uses } : { text });

const friedChicken: ExampleRecipe = {
  id: 'fried-chicken', name: 'Fried Chicken', meal: 'dinner', approved: true, tags: [],
  source: 'https://www.mamaknowsglutenfree.com/gluten-free-fried-chicken/',
  ingredients: ['chicken', 'milk', 'vinegar', 'flour', 'cornstarch', 'paprika', 'oil'],
  prep: 15, cook: 45, minutes: 60, wait: '2 h marinate', serves: 6,
  groups: [
    { title: 'Marinade', items: [
      it('chicken-thighs', '6 chicken thighs'),
      it('drumsticks', '6 chicken drumsticks'),
      it('milk', '3 cups milk (dairy-free: unsweetened almond, cashew or coconut milk)'),
      it('white-vinegar', '3 tablespoons white vinegar'),
      it('marinade-salt', '2 teaspoons salt'),
      it('marinade-pepper', '1 teaspoon pepper'),
    ] },
    { title: 'Breading', items: [
      it('flour', '2 cups all-purpose gluten-free flour'),
      it('cornstarch', '1 cup cornstarch'),
      it('onion-powder', '1 tablespoon onion powder'),
      it('garlic-powder', '1 tablespoon garlic powder'),
      it('breading-salt', '2 teaspoons salt'),
      it('paprika', '1 tablespoon paprika'),
      it('dried-thyme', '1 tablespoon dried thyme'),
      it('dried-oregano', '1 tablespoon dried oregano'),
      it('dried-basil', '1 tablespoon dried basil'),
    ] },
    { title: 'For frying', items: [it('frying-oil', '4 cups vegetable oil (peanut oil is great)')] },
  ],
  steps: [
    step('In a large bowl, whisk together the milk, white vinegar, salt and pepper. Add the chicken, cover with plastic wrap and refrigerate for at least 2 hours, overnight if you can.',
      'milk', 'white-vinegar', 'marinade-salt', 'marinade-pepper', 'chicken-thighs', 'drumsticks'),
    step('Combine the gluten-free flour, cornstarch, onion powder, garlic powder, salt, paprika, thyme, oregano and basil in a gallon-sized resealable bag and shake (or mix in a shallow dish).',
      'flour', 'cornstarch', 'onion-powder', 'garlic-powder', 'breading-salt', 'paprika', 'dried-thyme', 'dried-oregano', 'dried-basil'),
    step('Heat the oil in a 10" cast iron skillet (or a large skillet) over medium heat to 350°F. Test it by sprinkling in a little of the flour mixture: it should sizzle but not smoke.', 'frying-oil'),
    step('One piece at a time, lift the chicken out of the marinade and put it in the bag. Seal and shake to coat, then set it on a baking sheet. Repeat with all the pieces.', 'chicken-thighs', 'drumsticks'),
    step('Fry 3 or 4 pieces at a time, skin side down first, without overcrowding the pan. Oil temperature drops when the chicken goes in, so adjust the heat to keep it gently cooking. Fry each piece 15-18 minutes, turning with tongs about every 2 minutes, until golden brown and 165°F inside.', 'chicken-thighs', 'drumsticks'),
    step('Move the chicken to a cooling rack or paper towel-lined baking sheet and let it rest at least 10 minutes. Serve warm or cold.'),
  ],
  notes: [
    'Plus at least 2 hours to marinate, overnight is best. That time is not in the 60 min.',
    'Added by us: Frying 12 pieces, 3 or 4 at a time, at 15-18 minutes each can take longer than the 45 min cook time.',
    'Use a thermometer to keep the oil at 350°F. It will dip when the chicken goes in, so let it climb back to 350°F before the next batch.',
    'Let the breaded chicken sit on a baking sheet for 5 minutes before frying.',
    'Leftovers: cool completely, store airtight in the fridge up to 3 days. Reheat in the microwave, or on a baking sheet at 350°F for 15-20 minutes.',
  ],
};

const roast: ExampleRecipe = {
  id: 'slow-cooker-roast', name: 'Slow Cooker Roast', meal: 'dinner', approved: true, tags: [],
  source: 'https://fitfoodiefinds.com/slow-cooker-pork-roast/', author: 'Linley Hanson',
  ingredients: ['pork', 'potatoes', 'carrots', 'onion', 'garlic', 'rosemary', 'thyme', 'balsamic', 'red wine', 'cornstarch'],
  prep: 25, cook: 360, minutes: 385, serves: 8,
  groups: [
    { items: [
      it('potatoes', '6 medium russet potatoes, quartered'),
      it('onion', '1 medium white onion, chopped'),
      it('carrots', '6 medium carrots, diced into 4 pieces each'),
      it('garlic', '4 cloves garlic, roughly chopped'),
      it('pork', '3 lbs. boneless pork shoulder roast'),
      it('olive-oil', '2 tablespoons olive oil'),
      it('rosemary', '6 sprigs rosemary, bundled'),
      it('thyme-sprigs', '6 sprigs thyme, bundled'),
      it('balsamic', '2 tablespoons balsamic vinegar'),
      it('red-wine', '1/2 cup red wine'),
      it('chicken-broth', '1/2 cup chicken broth'),
    ] },
    { title: 'Pork Dry Rub', items: [
      it('brown-sugar', '1/4 cup brown sugar'),
      it('garlic-powder', '1 tablespoon garlic powder'),
      it('onion-powder', '2 teaspoons onion powder'),
      it('coarse-salt', '2 teaspoons coarse salt'),
      it('cinnamon', '1/4 teaspoon cinnamon'),
      it('dried-thyme', '2 teaspoons dried thyme'),
      it('pepper', '1 teaspoon pepper'),
    ] },
    { title: 'Thickener', items: [it('cornstarch', '1.5 tablespoons cornstarch')] },
  ],
  steps: [
    step('Prepare your pork dry rub by mixing together all of the spices in a small bowl. Set aside.',
      'brown-sugar', 'garlic-powder', 'onion-powder', 'coarse-salt', 'cinnamon', 'dried-thyme', 'pepper'),
    step('Prepare the veggies. Quarter 6 russet potatoes, chop a white onion, dice 6 medium carrots into 4 pieces each, and roughly chop 4 cloves of garlic.', 'potatoes', 'onion', 'carrots', 'garlic'),
    step('Place the veggie medley on the bottom of your crockpot.', 'potatoes', 'onion', 'carrots', 'garlic'),
    step('Rub your pork shoulder roast with the dry rub. Make sure that every nook and cranny is covered in rub.', 'pork'),
    step('Heat around 2 tablespoons of olive oil in a large cast iron skillet over medium/high heat. When the olive oil is fragrant, sear the pork shoulder for 2 minutes on each side.', 'olive-oil', 'pork'),
    step('Place the pork roast in the crock pot on top of the veggies. Make sure you scrape the skillet to get all of the delicious bits of rub off of it and add that to the crockpot, too.', 'pork'),
    step("Create an herb bundle by using baker's twine to tie together thyme and rosemary and set that on top of the pork.", 'rosemary', 'thyme-sprigs'),
    step('In a large Pyrex, mix together balsamic vinegar, red wine, and chicken broth. Then pour that on top of the pork roast.', 'balsamic', 'red-wine', 'chicken-broth'),
    step("Cover the crockpot and turn to high. Let cook for around 6-8 hours (flipping the pork roast halfway through cook time, if you can; if you can't, no worries!)."),
    step('Remove the meat and vegetables from the crockpot and discard the herb bundle. Using two forks, pull the pork roast apart into chunks and set aside.'),
    step('Place 1/2 cup of the liquid left in the crockpot into a microwave safe Pyrex. Whisk in the cornstarch. Place the cornstarch mixture into the microwave for 45 seconds (mixture should be thick and gelatinous). Remove from the microwave and whisk the cornstarch mixture into the existing liquid in the crockpot until it thickens into a thin gravy.', 'cornstarch'),
    step('Place the pork and vegetables back into the crockpot, or transfer it to a platter, and mix, coating everything in gravy.'),
  ],
  notes: [
    'Cook time: 6 to 8 hours on HIGH. The cook time above is the 6 hour low end.',
    'If you already have homemade pork dry rub on hand, use around 1/2 cup of rub for a 3 lb. piece of meat.',
    'Gravy: feel free to double the gravy ingredients (balsamic vinegar, red wine, and chicken broth) if you like more gravy.',
    "Cinnamon: a little bit of cinnamon can really elevate the flavors in this crock pot pork roast. If you don't love cinnamon, feel free to omit.",
  ],
};

// A dessert or snack: Meal has no dessert, so it is a snack. The note gives no prep time, so prep is 0 and the meta line leaves it out.
const brownies: ExampleRecipe = {
  id: 'high-protein-brownies', name: 'High Protein Brownies', meal: 'snack', approved: true, tags: [],
  source: 'https://www.instructables.com/High-Protein-Gluten-Free-Brownies-That-Actually-Ta/', author: 'Instructables',
  ingredients: ['cottage cheese', 'eggs', 'cocoa', 'whey', 'baking powder', 'walnuts', 'chocolate chips'],
  prep: 0, cook: 25, minutes: 25, serves: 8,
  groups: [
    { items: [
      it('cottage-cheese', '3/4 cup of cottage cheese (170g)'),
      it('sweetener', '2 Tbsp of sweetener (sugar, stevia, honey, etc.) (28g)'),
      it('salt', '1/8 tsp of salt (1/2g)'),
      it('eggs', '2 large eggs'),
      it('cocoa', '2 Tbsp of cocoa powder (14g)'),
      it('baking-powder', '1 1/2 tsp of baking powder (7g)'),
      it('whey', '1 scoop of whey protein, vanilla or chocolate (30g)'),
      it('walnuts', '1/2 cup of chopped walnuts, optional (60g)'),
      it('chocolate-chips', '1/2 cup of chocolate chips, optional (80g)'),
    ] },
  ],
  steps: [
    step('Preheat the oven to 375F/190C. Add the cottage cheese, sweetener and eggs to a large bowl and mix with a whisk or food processor. Add the salt, baking powder, cocoa powder and whey protein powder through a sifter or sieve into the bowl. Stir or whisk those ingredients in, followed by the walnuts and chocolate chips, which are both optional.',
      'cottage-cheese', 'sweetener', 'eggs', 'salt', 'baking-powder', 'cocoa', 'whey', 'walnuts', 'chocolate-chips'),
    step('Line a small baking pan, like a 5x9-inch loaf pan, with parchment paper, or spray it with some cooking oil or use shortening. Add all the batter to the pan and bake in the 375F/190C oven for 20 to 25 minutes, until a toothpick comes out clean.'),
    step('Allow it to cool and then cut into squares.'),
  ],
  notes: [
    'Makes 8 squares.',
    "If you don't want large chunks of cottage cheese in the final baked brownies, use a food processor or blender to break them down, and make sure to use small curd cottage cheese.",
    'Equipment: bowl, whisk, sifter, spatula, 5x9-inch bread pan, parchment paper (optional), food processor (optional).',
  ],
};

export const realNotes: readonly ExampleRecipe[] = [friedChicken, roast, brownies];

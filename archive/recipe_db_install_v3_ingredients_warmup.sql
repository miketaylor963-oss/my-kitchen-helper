-- =====================================================================
-- Ingredient Master Warm-up — additive seed extension for v3
-- =====================================================================
--
-- Extends Section 12 of recipe_db_install_v3.sql with the warm-up
-- ingredient and alias set agreed in Feature 2 planning. Run this
-- against a database where v3 has already been installed.
--
-- Safe to re-run. Every insert uses ON CONFLICT DO NOTHING.
--
-- ---------------------------------------------------------------------
-- What this adds
-- ---------------------------------------------------------------------
--   * 172 new canonical ingredients drawn from the breakfast, lunch,
--     and dinner source docs.
--   * 22 new aliases.
--
--   Grouped by category in the same order the v3 seed uses:
--     - Oils & vinegars
--     - Fresh herbs
--     - Produce (vegetables, mushrooms, fruit)
--     - Frozen
--     - Tinned & jarred
--     - Dry goods (rice, grains, pasta, noodles, nuts/seeds, flours)
--     - Sauces & condiments (incl. stocks)
--     - Chilled / dairy
--     - Bakery
--     - Meat & poultry
--     - Fish & seafood
--
-- ---------------------------------------------------------------------
-- Lineage
-- ---------------------------------------------------------------------
--   This file is superseded by recipe_db_install_v3_1.sql, which folds
--   the same content into a single canonical install script for clean
--   installs. Use this file only when the database is already on v3.
--
-- =====================================================================


INSERT INTO ingredient (canonical_name, default_unit, category_id, dietary_category_id, notes) VALUES

  -- Oils & vinegars
  ('coconut oil',                 'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_oils'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('ghee',                        'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_oils'),  (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('avocado oil',                 'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_oils'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('rice vinegar',                'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_oils'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('white wine vinegar',          'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_oils'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('red wine vinegar',            'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_oils'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('balsamic vinegar',            'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_oils'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('cider vinegar',               'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_oils'),  (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Produce — vegetables
  ('yellow pepper',               NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('green pepper',                NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('shallot',                     NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('spring onion',                NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       'bunch'),
  ('courgette',                   NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('aubergine',                   NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('broccoli',                    NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       'head'),
  ('tenderstem broccoli',         'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('cauliflower',                 NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       'head'),
  ('kale',                        'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('spinach',                     'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('chard',                       'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('watercress',                  'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('rocket',                      'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('lettuce',                     NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       'head'),
  ('green beans',                 'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('sugar snap peas',             'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('edamame',                     'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('butternut squash',            NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('sweet potato',                NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('waxy potatoes',               'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       'new potatoes, salad potatoes'),
  ('beetroot',                    NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('fennel',                      NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       'bulb'),
  ('pak choi',                    NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('daikon',                      NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('tomatoes',                    NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Produce — mushrooms (chestnut already seeded)
  ('portobello mushrooms',        'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('oyster mushrooms',            'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('shiitake mushrooms',          'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Produce — fruit
  ('apple',                       NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('banana',                      NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('strawberries',                'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('raspberries',                 'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('blueberries',                 'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('plums',                       NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('peach',                       NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('pomegranate',                 NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('grapes',                      'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('satsuma',                     NULL,   (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('rhubarb',                     'g',    (SELECT id FROM ingredient_category WHERE code='produce'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Frozen
  ('frozen peas',                 'g',    (SELECT id FROM ingredient_category WHERE code='frozen'),       (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('frozen mixed berries',        'g',    (SELECT id FROM ingredient_category WHERE code='frozen'),       (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Tinned & jarred — tinned fish (joining the existing tinned legumes)
  ('tinned tuna',                 'g',    (SELECT id FROM ingredient_category WHERE code='pantry_canned'),(SELECT id FROM dietary_category WHERE code='pescatarian'), '120g tin, in brine or water'),
  ('tinned sardines',             'g',    (SELECT id FROM ingredient_category WHERE code='pantry_canned'),(SELECT id FROM dietary_category WHERE code='pescatarian'), '120g tin'),
  ('tinned anchovies',            'g',    (SELECT id FROM ingredient_category WHERE code='pantry_canned'),(SELECT id FROM dietary_category WHERE code='pescatarian'), '50g tin'),
  ('tinned mackerel',             'g',    (SELECT id FROM ingredient_category WHERE code='pantry_canned'),(SELECT id FROM dietary_category WHERE code='pescatarian'), '125g tin'),
  ('tinned salmon',               'g',    (SELECT id FROM ingredient_category WHERE code='pantry_canned'),(SELECT id FROM dietary_category WHERE code='pescatarian'), '200g tin'),

  -- Dry goods — rice
  ('basmati rice',                'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('brown rice',                  'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('sushi rice',                  'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       'short-grain'),
  ('arborio rice',                'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       'for risotto'),

  -- Dry goods — other grains
  ('couscous',                    'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('bulgur wheat',                'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('freekeh',                     'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('pearl barley',                'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('farro',                       'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('polenta',                     'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('quinoa',                      'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('rolled oats',                 'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Dry goods — pasta
  ('spaghetti',                   'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('penne',                       'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('fusilli',                     'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('pasta shells',                'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('lasagne sheets',              'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('orzo',                        'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Dry goods — noodles
  ('soba noodles',                'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('rice noodles',                'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('egg noodles',                 'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('udon noodles',                'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Dry goods — nuts & seeds (walnuts already seeded)
  ('pine nuts',                   'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('cashews',                     'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('flaked almonds',              'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('hazelnuts',                   'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('sesame seeds',                'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('flaxseed',                    'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('hemp seeds',                  'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('sunflower seeds',             'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('pumpkin seeds',               'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Dry goods — flours & dry baking
  ('plain flour',                 'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('self-raising flour',          'g',    (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('bicarbonate of soda',         'tsp',  (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('baking powder',               'tsp',  (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Dry goods — seaweed
  ('nori sheets',                 NULL,   (SELECT id FROM ingredient_category WHERE code='pantry_dry'),   (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Sauces & condiments — Asian
  ('fish sauce',                  'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('oyster sauce',                'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('mirin',                       'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('hoisin sauce',                'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('sriracha',                    'tsp',  (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('gochujang',                   'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Sauces & condiments — European
  ('Dijon mustard',               'tsp',  (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('English mustard',             'tsp',  (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('wholegrain mustard',          'tsp',  (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('piccalilli',                  'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('mayonnaise',                  'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('ketchup',                     'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('Worcestershire sauce',        'tsp',  (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='pescatarian'), 'contains anchovy'),

  -- Sauces & condiments — jars and preserves
  ('capers',                      'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('olives',                      'g',    (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('sundried tomatoes',           'g',    (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('pickled ginger',              'g',    (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('kimchi',                      'g',    (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('sauerkraut',                  'g',    (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('honey',                       'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('maple syrup',                 'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('tomato purée',                'tbsp', (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='vegan'),       'stronger flavoured than tinned tomatoes; sold in tubes or small tins'),

  -- Sauces & condiments — stocks (vegetable stock already seeded)
  ('chicken stock',               'ml',   (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('fish stock',                  'ml',   (SELECT id FROM ingredient_category WHERE code='pantry_sauces'),(SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),

  -- Chilled — yoghurts and dairy ferments
  ('full fat Greek yoghurt',      'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  '500g pot'),
  ('skyr',                        'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('natural yoghurt',             'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('cottage cheese',              'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('kefir',                       'ml',   (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),

  -- Chilled — plant-based
  ('soy yoghurt',                 'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Chilled — cheeses
  ('cheddar',                     'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('parmesan',                    'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('feta',                        'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('halloumi',                    'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('mozzarella',                  'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('mascarpone',                  'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('ricotta',                     'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('blue cheese',                 'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('goat''s cheese',              'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('cream cheese',                'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),

  -- Chilled — milk, butter, cream
  ('whole milk',                  'ml',   (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('butter',                      'g',    (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('double cream',                'ml',   (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),
  ('single cream',                'ml',   (SELECT id FROM ingredient_category WHERE code='chilled'),      (SELECT id FROM dietary_category WHERE code='vegetarian'),  NULL),

  -- Bakery
  ('rye bread',                   'slice',(SELECT id FROM ingredient_category WHERE code='bakery'),       (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('pitta bread',                 NULL,   (SELECT id FROM ingredient_category WHERE code='bakery'),       (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),
  ('flatbread',                   NULL,   (SELECT id FROM ingredient_category WHERE code='bakery'),       (SELECT id FROM dietary_category WHERE code='vegan'),       NULL),

  -- Meat & poultry
  ('beef mince',                  'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('beef steak',                  'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('stewing steak',               'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('roast beef',                  'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        'cold cuts, deli-style'),
  ('lamb mince',                  'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('diced lamb',                  'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('pork chop',                   NULL,   (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('bacon',                       'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('pork sausages',               NULL,   (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('chorizo',                     'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        'cooking or cured — specify in recipe'),
  ('prosciutto',                  'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('serrano ham',                 'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('bresaola',                    'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('salami',                      'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('cooked ham',                  'g',    (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('ham hock',                    NULL,   (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('chicken breast',              NULL,   (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),
  ('chicken thigh',               NULL,   (SELECT id FROM ingredient_category WHERE code='meat'),         (SELECT id FROM dietary_category WHERE code='meat'),        NULL),

  -- Fish & seafood — fresh and chilled
  ('salmon fillet',               'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('smoked salmon',               'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), 'cold-smoked'),
  ('hot-smoked salmon',           'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('mackerel fillet',             'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('smoked mackerel',             'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('trout',                       'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('haddock',                     'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('smoked haddock',              'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('cod fillet',                  'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('hake fillet',                 'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('pollock fillet',              'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('tuna steak',                  'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('raw prawns',                  'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('cooked prawns',               'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('gravadlax',                   'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL),
  ('pickled herring',             'g',    (SELECT id FROM ingredient_category WHERE code='fish'),         (SELECT id FROM dietary_category WHERE code='pescatarian'), NULL)
ON CONFLICT (canonical_name) DO NOTHING;


-- ---------------------------------------------------------------------
-- Aliases for the warm-up additions.
-- The four aliases already seeded in v3 (fresh coriander/avocado/
-- chestnut mushrooms/soy sauce) are not repeated here.
-- ---------------------------------------------------------------------
INSERT INTO ingredient_alias (ingredient_id, alias) VALUES
  -- Proteins
  ((SELECT id FROM ingredient WHERE canonical_name='prosciutto'),               'parma ham'),
  ((SELECT id FROM ingredient WHERE canonical_name='tinned sardines'),          'sardines'),
  ((SELECT id FROM ingredient WHERE canonical_name='tinned anchovies'),         'anchovies'),
  ((SELECT id FROM ingredient WHERE canonical_name='beef mince'),               'minced beef'),
  ((SELECT id FROM ingredient WHERE canonical_name='lamb mince'),               'minced lamb'),

  -- Dairy
  ((SELECT id FROM ingredient WHERE canonical_name='full fat Greek yoghurt'),   'greek yogurt'),
  ((SELECT id FROM ingredient WHERE canonical_name='natural yoghurt'),          'natural yogurt'),
  ((SELECT id FROM ingredient WHERE canonical_name='soy yoghurt'),              'soy yogurt'),
  ((SELECT id FROM ingredient WHERE canonical_name='whole milk'),               'milk'),
  ((SELECT id FROM ingredient WHERE canonical_name='goat''s cheese'),           'chevre'),
  ((SELECT id FROM ingredient WHERE canonical_name='double cream'),             'heavy cream'),

  -- Grains
  ((SELECT id FROM ingredient WHERE canonical_name='rolled oats'),              'oats'),
  ((SELECT id FROM ingredient WHERE canonical_name='rolled oats'),              'porridge oats'),

  -- Produce
  ((SELECT id FROM ingredient WHERE canonical_name='spring onion'),             'scallion'),
  ((SELECT id FROM ingredient WHERE canonical_name='courgette'),                'courgettes'),
  ((SELECT id FROM ingredient WHERE canonical_name='aubergine'),                'aubergines'),
  ((SELECT id FROM ingredient WHERE canonical_name='waxy potatoes'),            'salad potatoes'),
  ((SELECT id FROM ingredient WHERE canonical_name='waxy potatoes'),            'new potatoes'),

  -- Vinegars and sauces
  ((SELECT id FROM ingredient WHERE canonical_name='white wine vinegar'),       'white vinegar'),
  ((SELECT id FROM ingredient WHERE canonical_name='red wine vinegar'),         'red vinegar'),
  ((SELECT id FROM ingredient WHERE canonical_name='cider vinegar'),            'apple cider vinegar'),
  ((SELECT id FROM ingredient WHERE canonical_name='white miso paste'),         'miso'),
  ((SELECT id FROM ingredient WHERE canonical_name='vegetable stock'),          'stock')
ON CONFLICT (alias) DO NOTHING;


-- =====================================================================
-- Verification (optional — uncomment to run)
-- =====================================================================
-- SELECT COUNT(*) AS total_ingredients FROM ingredient;
-- SELECT COUNT(*) AS total_aliases     FROM ingredient_alias;
-- SELECT c.name AS category, COUNT(i.id) AS n
--   FROM ingredient_category c
--   LEFT JOIN ingredient i ON i.category_id = c.id
--   GROUP BY c.name, c.sort_order
--   ORDER BY c.sort_order;

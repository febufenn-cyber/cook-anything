#!/usr/bin/env python3
import json, sys

with open('data/recipes/japanese.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

batch2 = [
  {
    "id": "ca-jp-tamagoyaki",
    "slug": "jp-tamagoyaki",
    "title": "Japanese Tamagoyaki (Rolled Omelette)",
    "nativeTitle": "卵焼き",
    "description": "A gently sweet Japanese rolled omelette cooked in thin successive layers and folded into a compact log — served as a lunchbox staple, sushi topping or breakfast side. The patient layering technique, not the ingredients, is what creates the distinctive striped cross-section.",
    "cuisine": "japanese",
    "country": "japan",
    "region": None,
    "language": "en",
    "mealType": ["breakfast", "lunch", "side", "tiffin"],
    "dietType": ["eggetarian"],
    "difficulty": "medium",
    "spiceLevel": "none",
    "budgetLevel": "budget",
    "prepTimeMinutes": 5,
    "cookTimeMinutes": 15,
    "totalTimeMinutes": 20,
    "servings": 2,
    "ingredients": [
      {"name": "eggs", "normalizedName": "egg", "quantity": 4, "unit": "piece", "optional": False},
      {"name": "sugar (or mirin if available)", "normalizedName": "sugar", "quantity": 1, "unit": "tbsp", "optional": False, "notes": "mirin gives a more rounded sweetness; plain sugar is a workable substitute"},
      {"name": "soy sauce", "normalizedName": "soy-sauce", "quantity": 1, "unit": "tsp", "optional": False},
      {"name": "water", "normalizedName": "water", "quantity": 2, "unit": "tbsp", "optional": False, "notes": "makes the egg softer and more delicate"},
      {"name": "cooking oil", "normalizedName": "oil", "quantity": 1, "unit": "tsp", "optional": False},
      {"name": "spring onion, thinly sliced", "normalizedName": "spring-onion", "quantity": 1, "unit": "tbsp", "optional": True, "notes": "garnish"}
    ],
    "steps": [
      {
        "order": 1,
        "text": "Crack eggs into a bowl and add sugar, soy sauce and water. Stir gently with chopsticks or a fork — the goal is to combine the yolks and whites without incorporating air or making foam. The mixture should be uniform in colour but not frothy."
      },
      {
        "order": 2,
        "text": "Place a non-stick pan or tawa over medium-low heat and add a thin film of oil, spreading it with folded kitchen paper. Pour in roughly one-third of the egg mixture — just enough to coat the base in a thin, even layer.",
        "timerMinutes": 1,
        "method": "pan-frying"
      },
      {
        "order": 3,
        "text": "Let the egg set at the edges while the centre is still slightly wet, about 30 to 45 seconds. Using a spatula, roll the egg from the far end of the pan toward you in two or three folds, forming a loose log at the near edge. Do not wait for the egg to be fully firm before rolling — soft is correct.",
        "timerMinutes": 1
      },
      {
        "order": 4,
        "text": "Slide the log to the far end of the pan. Add a small drop of oil to the exposed surface, then pour in the second third of egg mixture, gently lifting the existing roll so the new liquid egg flows underneath it. Cook until the surface is barely set, then roll the existing log back over the new layer.",
        "timerMinutes": 1
      },
      {
        "order": 5,
        "text": "Repeat with the remaining egg mixture, rolling the growing log one more time to incorporate it. The finished roll should be plump, with visible white and golden layers when cut. Press gently in a bamboo mat or wrap in cling film and let it rest for 1 minute to compact the shape.",
        "timerMinutes": 1
      },
      {
        "order": 6,
        "text": "Slice the roll crosswise into pieces about 2 cm thick. The interior should show distinct layers. Arrange on a plate and garnish with spring onion. Serve warm or at room temperature."
      }
    ],
    "cookware": ["frying-pan", "tawa"],
    "methods": ["pan-frying", "no-cook"],
    "tags": ["lunchbox", "tiffin", "kids-friendly", "budget", "quick"],
    "allergens": ["egg", "soy", "gluten"],
    "nutrition": {
      "calories": 160,
      "protein": 11,
      "carbs": 7,
      "fat": 9,
      "fiber": 0,
      "sugar": 6,
      "sodium": None,
      "isEstimate": True
    },
    "substitutions": [
      {"ingredient": "sugar", "substitute": "1 tbsp mirin if available, for a rounder, less sharp sweetness"},
      {"ingredient": "soy-sauce", "substitute": "a pinch of salt for a plainer, cream-coloured tamago without dark streaks"},
      {"ingredient": "egg", "substitute": "no direct substitute — this dish is egg; paneer bhurji is a thematically different dish"},
      {"ingredient": "oil", "substitute": "a very light coating of butter for a richer flavour", "notes": "changes allergen to include dairy"}
    ],
    "culturalNote": "Tamagoyaki appears in the Japanese bento box tradition going back centuries and is considered a benchmark of cooking skill — chefs at sushi restaurants are sometimes tested on their tamagoyaki before any other dish. The sweet version is standard in the Tokyo and Kansai home kitchen.",
    "regionalVariation": "Osaka-style tamagoyaki is thicker and sweeter; Tokyo-style (dashimaki tamago) uses dashi stock instead of water, giving a more savoury, aromatic result.",
    "indianKitchenAdaptation": "A non-stick tawa or small frying pan works perfectly — no special tamagoyaki pan is needed. Cook on medium-low flame so each layer sets gently without browning too quickly. The rolled technique is similar to making a thin roti-style omelette and rolling it — Indian cooks will find the motion intuitive. Soy sauce is available at most modern supermarkets and online.",
    "source": "Cook Anything editorial — AI-drafted original",
    "sourceUrl": None,
    "license": "original",
    "author": "Cook Anything Kitchen",
    "verificationStatus": "ai_drafted",
    "image": None,
    "imageLicense": None,
    "createdAt": "2026-07-10T00:00:00.000Z",
    "updatedAt": "2026-07-10T00:00:00.000Z"
  },
  {
    "id": "ca-jp-oyakodon",
    "slug": "jp-oyakodon",
    "title": "Japanese Oyakodon (Chicken and Egg Rice Bowl)",
    "nativeTitle": "親子丼",
    "description": "Thinly sliced chicken and barely-set eggs simmered together in a sweet-savoury dashi broth and served over warm steamed rice. The name means 'parent and child' in Japanese, referring to the hen and egg cooking together — and the half-set, custardy egg texture is the heart of the dish.",
    "cuisine": "japanese",
    "country": "japan",
    "region": None,
    "language": "en",
    "mealType": ["lunch", "dinner"],
    "dietType": ["non_vegetarian", "high_protein"],
    "difficulty": "easy",
    "spiceLevel": "none",
    "budgetLevel": "budget",
    "prepTimeMinutes": 10,
    "cookTimeMinutes": 25,
    "totalTimeMinutes": 35,
    "servings": 2,
    "ingredients": [
      {"name": "boneless chicken thighs, sliced thinly against the grain", "normalizedName": "chicken", "quantity": 300, "unit": "g", "optional": False},
      {"name": "eggs, lightly beaten", "normalizedName": "egg", "quantity": 3, "unit": "piece", "optional": False},
      {"name": "onion, thinly sliced into half-moons", "normalizedName": "onion", "quantity": 1, "unit": "piece", "optional": False},
      {"name": "dashi stock or light chicken/vegetable stock", "normalizedName": "stock", "quantity": 200, "unit": "ml", "optional": False, "notes": "instant dashi powder dissolved in water works well"},
      {"name": "soy sauce", "normalizedName": "soy-sauce", "quantity": 3, "unit": "tbsp", "optional": False},
      {"name": "sugar (or mirin)", "normalizedName": "sugar", "quantity": 1, "unit": "tbsp", "optional": False, "notes": "mirin gives more depth; plain sugar is a workable substitute"},
      {"name": "spring onion, sliced on the diagonal", "normalizedName": "spring-onion", "quantity": 3, "unit": "tbsp", "optional": False},
      {"name": "steamed short-grain rice, to serve", "normalizedName": "rice", "quantity": 2, "unit": "cup", "optional": False}
    ],
    "steps": [
      {
        "order": 1,
        "text": "Cook rice in a saucepan with 2.5 cups water: bring to a boil, cover, reduce to lowest flame for 12 minutes, then rest covered for 10 minutes. Keep covered and warm — this is the base of the bowl.",
        "timerMinutes": 22,
        "method": "boiling"
      },
      {
        "order": 2,
        "text": "Combine dashi stock, soy sauce and sugar in a wide, shallow pan. Stir until the sugar dissolves, then bring to a simmer over medium heat."
      },
      {
        "order": 3,
        "text": "Add sliced onion to the simmering broth and cook for 3 to 4 minutes until softened and slightly translucent. The onion absorbs the broth and adds body to the topping.",
        "timerMinutes": 4,
        "method": "simmering"
      },
      {
        "order": 4,
        "text": "Scatter the chicken slices evenly over the onion in a single layer — do not stir. Simmer for 5 to 7 minutes until the chicken is fully cooked through with no pink remaining, turning once if the pieces are thick.",
        "timerMinutes": 7
      },
      {
        "order": 5,
        "text": "Beat the eggs just enough to break the yolks with a few streaks of white still visible. Pour the egg in a slow circular motion over the chicken, starting from the outer edge inward. Do not stir."
      },
      {
        "order": 6,
        "text": "Cover the pan and cook for 1 to 2 minutes: the whites should be set at the edges but the centre should still wobble gently — this half-custardy texture is the signature of oyakodon. The residual heat finishes the cooking once it sits on the rice.",
        "timerMinutes": 2
      },
      {
        "order": 7,
        "text": "Divide rice between two large bowls and carefully slide the chicken-egg topping over each, distributing it evenly. Scatter spring onion on top and serve immediately — the topping softens the rice quickly and tastes best eaten fresh."
      }
    ],
    "cookware": ["saucepan", "frying-pan"],
    "methods": ["simmering", "boiling", "one-pot"],
    "tags": ["comfort-food", "budget", "quick", "lunchbox", "bowl"],
    "allergens": ["egg", "soy", "gluten"],
    "nutrition": {
      "calories": 520,
      "protein": 42,
      "carbs": 58,
      "fat": 13,
      "fiber": 2,
      "sugar": 8,
      "sodium": None,
      "isEstimate": True
    },
    "substitutions": [
      {"ingredient": "chicken", "substitute": "thinly sliced firm tofu pan-fried briefly for a vegetarian version — the dish becomes tamagodon"},
      {"ingredient": "stock", "substitute": "1 tsp instant dashi powder dissolved in 200 ml water, or plain water with an extra tsp of soy sauce for a simpler broth"},
      {"ingredient": "sugar", "substitute": "1 tbsp mirin for a more rounded sweetness with less sharpness"},
      {"ingredient": "rice", "substitute": "any medium-grain rice or sona masoori cooked slightly wet so it absorbs the broth readily"}
    ],
    "culturalNote": "Oyakodon is one of Japan's most beloved don (rice bowl) dishes and is considered a mother-cooking archetype — simple, warming and comforting. It is a fixture in Japanese family restaurants and school cafeterias, and remains one of the most searched home recipes in Japan.",
    "regionalVariation": "The Osaka version uses a sweeter, lighter broth; Tokyo oyakodon is more savoury. Some families add a splash of dry white wine or rice wine to the broth for fragrance.",
    "indianKitchenAdaptation": "Cook the topping in a flat-bottomed kadai or wide saucepan so the egg sets in an even layer. Dashi is ideal but light chicken stock — or a Maggi stock cube dissolved in water — gives a very acceptable result. The half-cooked egg texture is similar to an egg curry where the yolk is just barely set — Indian cooks will immediately recognise the target consistency.",
    "source": "Cook Anything editorial — AI-drafted original",
    "sourceUrl": None,
    "license": "original",
    "author": "Cook Anything Kitchen",
    "verificationStatus": "ai_drafted",
    "image": None,
    "imageLicense": None,
    "createdAt": "2026-07-10T00:00:00.000Z",
    "updatedAt": "2026-07-10T00:00:00.000Z"
  },
  {
    "id": "ca-jp-vegetable-tempura",
    "slug": "jp-vegetable-tempura",
    "title": "Japanese Vegetable Tempura",
    "nativeTitle": "野菜の天ぷら",
    "description": "Mixed vegetables coated in a barely-mixed, ice-cold batter and fried until delicately crisp and pale gold — tempura is defined by the lightest possible coating, one that shatters rather than crunches and lets the vegetable flavour speak. The discipline is restraint: cold batter, hot oil, quick fry.",
    "cuisine": "japanese",
    "country": "japan",
    "region": None,
    "language": "en",
    "mealType": ["lunch", "dinner", "side", "snack"],
    "dietType": ["eggetarian"],
    "difficulty": "medium",
    "spiceLevel": "none",
    "budgetLevel": "moderate",
    "prepTimeMinutes": 15,
    "cookTimeMinutes": 20,
    "totalTimeMinutes": 35,
    "servings": 4,
    "ingredients": [
      {"name": "broccoli, cut into small florets", "normalizedName": "broccoli", "quantity": 150, "unit": "g", "optional": False},
      {"name": "capsicum (mixed colours), cut into strips", "normalizedName": "capsicum", "quantity": 1, "unit": "piece", "optional": False},
      {"name": "mushrooms (shiitake or button), whole or halved", "normalizedName": "mushroom", "quantity": 8, "unit": "piece", "optional": False},
      {"name": "carrot, cut into thick batons", "normalizedName": "carrot", "quantity": 1, "unit": "piece", "optional": False},
      {"name": "maida (plain flour)", "normalizedName": "maida", "quantity": 150, "unit": "g", "optional": False},
      {"name": "cornflour (cornstarch)", "normalizedName": "cornflour", "quantity": 50, "unit": "g", "optional": False, "notes": "key to a light, shattering crust"},
      {"name": "egg, ice cold", "normalizedName": "egg", "quantity": 1, "unit": "piece", "optional": False},
      {"name": "ice-cold water", "normalizedName": "water", "quantity": 250, "unit": "ml", "optional": False, "notes": "place a bowl of water over ice; cold temperature is non-negotiable for tempura batter"},
      {"name": "oil (for deep frying)", "normalizedName": "oil", "quantity": 600, "unit": "ml", "optional": False, "notes": "neutral oil such as sunflower or refined groundnut"},
      {"name": "soy sauce (for dipping)", "normalizedName": "soy-sauce", "quantity": 3, "unit": "tbsp", "optional": False},
      {"name": "dashi or light vegetable stock (for dipping sauce)", "normalizedName": "stock", "quantity": 4, "unit": "tbsp", "optional": False},
      {"name": "sugar (for dipping sauce)", "normalizedName": "sugar", "quantity": 1, "unit": "tsp", "optional": False}
    ],
    "steps": [
      {
        "order": 1,
        "text": "Pat all vegetables completely dry with kitchen paper — surface moisture creates steam and prevents the batter from crisping. Cut everything to roughly uniform thickness so pieces cook in similar time. Lay out on a tray ready to coat."
      },
      {
        "order": 2,
        "text": "Make the dipping sauce first: combine soy sauce, stock and sugar in a small saucepan, stir over low heat for 1 minute until sugar dissolves. Remove from heat and cool to room temperature.",
        "timerMinutes": 1
      },
      {
        "order": 3,
        "text": "Make the batter immediately before frying: crack the cold egg into a bowl, add the ice water and stir briefly. Tip in flour and cornflour all at once and mix with a fork using a folding motion — no more than 10 strokes. Visible lumps are correct; overmixing develops gluten and makes the batter heavy.",
        "method": "no-cook"
      },
      {
        "order": 4,
        "text": "Heat oil in a kadai or deep saucepan to 170 to 175 degrees C. Test with a drop of batter — it should sink slightly, rise immediately and sizzle actively. Fry in small batches to maintain temperature; crowding cools the oil.",
        "method": "deep-frying"
      },
      {
        "order": 5,
        "text": "Dip each vegetable piece into the batter, letting excess drip off, and lower it gently into the oil. Fry for 2 to 3 minutes per batch, turning once, until the coating is pale gold and the sound changes from loud sizzling to a quieter crackle. Drain on a wire rack.",
        "timerMinutes": 3
      },
      {
        "order": 6,
        "text": "Between batches, skim the oil surface clean of loose batter crumbs which burn and bitter the oil. Serve tempura within 5 minutes of frying alongside the dipping sauce — tempura loses its crunch quickly and does not reheat well."
      }
    ],
    "cookware": ["kadai", "saucepan"],
    "methods": ["deep-frying", "no-cook"],
    "tags": ["fried-snack", "party", "comfort-food", "kids-friendly"],
    "allergens": ["egg", "gluten", "soy"],
    "nutrition": {
      "calories": 280,
      "protein": 7,
      "carbs": 38,
      "fat": 11,
      "fiber": 3,
      "sugar": 4,
      "sodium": None,
      "isEstimate": True
    },
    "substitutions": [
      {"ingredient": "egg", "substitute": "replace with an extra 30 ml of ice water for a vegan batter that is slightly lighter and less golden", "notes": "also removes the egg allergen"},
      {"ingredient": "maida", "substitute": "rice flour (chawal ka atta) for a gluten-free batter that is even lighter and more delicate", "notes": "available at any Indian grocery store"},
      {"ingredient": "cornflour", "substitute": "potato starch in the same quantity for a very similar effect"},
      {"ingredient": "broccoli", "substitute": "any firm vegetable — sweet potato, baby corn, sliced onion rings or pumpkin all fry beautifully in tempura batter"}
    ],
    "culturalNote": "Tempura was introduced to Japan by Portuguese missionaries in the 16th century and evolved into one of Japan's most refined cooking traditions. Traditional tempura restaurants in Tokyo serve seasonal ingredients to a single counter of diners, treating each piece as a course.",
    "regionalVariation": "Tokyo's Edo-style tempura uses a thinner batter fried in sesame oil, producing a slightly darker, aromatic result. In Osaka, shrimp is the iconic tempura ingredient; vegetables dominate the home-cooking tradition.",
    "indianKitchenAdaptation": "A deep kadai is the perfect vessel for tempura frying. Keep a kitchen thermometer handy; 170 degrees C is the target. Cornflour (cornstarch) is widely available at Indian grocery stores. The cold-batter discipline is the main technique to internalise — keep your mixing bowl over ice if possible. Serve with soy sauce as a dip if proper tsuyu (dashi-based) is not available.",
    "source": "Cook Anything editorial — AI-drafted original",
    "sourceUrl": None,
    "license": "original",
    "author": "Cook Anything Kitchen",
    "verificationStatus": "ai_drafted",
    "image": None,
    "imageLicense": None,
    "createdAt": "2026-07-10T00:00:00.000Z",
    "updatedAt": "2026-07-10T00:00:00.000Z"
  },
  {
    "id": "ca-jp-cucumber-maki",
    "slug": "jp-cucumber-maki",
    "title": "Japanese Cucumber Maki Rolls",
    "nativeTitle": "きゅうり巻き",
    "description": "Seasoned sushi rice and crisp cucumber matchsticks rolled inside nori sheets — the cleanest, most beginner-friendly sushi roll. The slightly tangy, sticky rice is the craft element; the rolling technique takes one practice round before it feels reliable.",
    "cuisine": "japanese",
    "country": "japan",
    "region": None,
    "language": "en",
    "mealType": ["lunch", "dinner", "snack", "tiffin"],
    "dietType": ["vegan"],
    "difficulty": "medium",
    "spiceLevel": "none",
    "budgetLevel": "budget",
    "prepTimeMinutes": 20,
    "cookTimeMinutes": 20,
    "totalTimeMinutes": 40,
    "servings": 4,
    "ingredients": [
      {"name": "short-grain rice or sona masoori rice", "normalizedName": "rice", "quantity": 2, "unit": "cup", "optional": False, "notes": "long-grain or basmati will not bind properly; use the stickiest variety available"},
      {"name": "nori sheets", "normalizedName": "seaweed", "quantity": 4, "unit": "piece", "optional": False},
      {"name": "cucumber, seeds scooped out, cut into thin matchsticks", "normalizedName": "cucumber", "quantity": 1, "unit": "piece", "optional": False},
      {"name": "rice vinegar", "normalizedName": "vinegar", "quantity": 3, "unit": "tbsp", "optional": False, "notes": "regular white vinegar can substitute at slightly reduced quantity"},
      {"name": "sugar", "normalizedName": "sugar", "quantity": 1, "unit": "tbsp", "optional": False},
      {"name": "salt", "normalizedName": "salt", "quantity": 1, "unit": "tsp", "optional": False},
      {"name": "toasted sesame seeds", "normalizedName": "sesame-seeds", "quantity": 2, "unit": "tsp", "optional": True, "notes": "pressed onto the outside of the roll"},
      {"name": "toasted sesame oil", "normalizedName": "gingelly-oil", "quantity": 0.5, "unit": "tsp", "optional": True, "notes": "a small drizzle over the cucumber before rolling lifts the filling"},
      {"name": "water", "normalizedName": "water", "quantity": 500, "unit": "ml", "optional": False}
    ],
    "steps": [
      {
        "order": 1,
        "text": "Rinse the rice until the water runs clear, drain, and cook with 500 ml water: bring to a boil, stir once, cover tightly, reduce to the lowest flame and cook for 12 minutes. Turn off the heat and leave covered for 10 more minutes without lifting the lid.",
        "timerMinutes": 22,
        "method": "boiling"
      },
      {
        "order": 2,
        "text": "Mix rice vinegar, sugar and salt together, stirring until dissolved. Spread the hot cooked rice on a wide tray and pour the dressing over it. Fold through with a spatula in fanning motions — do not stir vigorously. Cool the rice to body temperature before rolling; hot rice tears the nori.",
        "timerMinutes": 10
      },
      {
        "order": 3,
        "text": "Place a sheet of nori shiny-side down on a bamboo mat or clean cutting board. Wet your hands lightly to prevent sticking. Spread about three-quarters of a cup of seasoned rice in an even layer over the nori, leaving a 2 cm bare strip at the far edge.",
        "method": "no-cook"
      },
      {
        "order": 4,
        "text": "Arrange four or five cucumber matchsticks in a straight line across the near edge of the rice. If using sesame oil, drizzle a few drops over the cucumber now. Sesame seeds can be scattered across the rice at this stage."
      },
      {
        "order": 5,
        "text": "Lift the near edge of the mat and roll it firmly over the cucumber in one confident motion, pressing gently to compact as you go. When the near edge of nori meets the rice on the far side, pause and squeeze the roll through the mat to compact it, then continue rolling to seal the bare nori strip at the far end."
      },
      {
        "order": 6,
        "text": "Set the roll seam-side-down for 1 to 2 minutes to let the nori seal. Dip a sharp knife in cold water before each cut and slice each roll into 6 to 8 pieces with a single forward pull rather than a sawing motion. Serve with soy sauce for dipping."
      }
    ],
    "cookware": ["saucepan"],
    "methods": ["boiling", "no-cook"],
    "tags": ["lunchbox", "tiffin", "kids-friendly", "budget", "healthy"],
    "allergens": ["sesame"],
    "nutrition": {
      "calories": 220,
      "protein": 4,
      "carbs": 47,
      "fat": 2,
      "fiber": 2,
      "sugar": 3,
      "sodium": None,
      "isEstimate": True
    },
    "substitutions": [
      {"ingredient": "seaweed", "substitute": "if nori is unavailable, arrange the seasoned rice on a lettuce leaf and roll as a fresh hand-roll — the flavour is lighter but it works"},
      {"ingredient": "cucumber", "substitute": "ripe mango strips for a sweet tropical roll, blanched carrot batons, or avocado if available"},
      {"ingredient": "vinegar", "substitute": "2 tbsp white vinegar (sirka) plus an extra pinch of sugar — sharper than rice vinegar but workable"},
      {"ingredient": "rice", "substitute": "sona masoori cooked slightly wetter than usual — it clumps when seasoned warm; avoid basmati entirely"}
    ],
    "culturalNote": "Kappa maki (cucumber roll) is named after the kappa, a water-sprite in Japanese folklore said to be fond of cucumber. It remains one of the three most popular sushi rolls in Japan, prized for its clean, refreshing flavour between richer pieces.",
    "regionalVariation": None,
    "indianKitchenAdaptation": "Sona masoori rice cooked wet and well-rinsed is the best Indian substitute for sushi rice — it binds once seasoned and cooled. Nori sheets are stocked at premium supermarkets in Indian metros and are widely available online. White vinegar (sirka) can replace rice vinegar at slightly reduced quantity. A clean kitchen towel stretched flat can substitute for a bamboo rolling mat.",
    "source": "Cook Anything editorial — AI-drafted original",
    "sourceUrl": None,
    "license": "original",
    "author": "Cook Anything Kitchen",
    "verificationStatus": "ai_drafted",
    "image": None,
    "imageLicense": None,
    "createdAt": "2026-07-10T00:00:00.000Z",
    "updatedAt": "2026-07-10T00:00:00.000Z"
  },
  {
    "id": "ca-jp-gyoza",
    "slug": "jp-gyoza",
    "title": "Japanese Gyoza (Pan-Fried Dumplings)",
    "nativeTitle": "餃子",
    "description": "Thin-skinned dumplings filled with seasoned pork and cabbage, fried flat-side-down until deeply golden then steamed in the same pan to cook the tops — the dual-texture result (crispy base, tender top) is entirely distinctive. Momo wrappers from Indian Tibetan shops make an excellent ready-made shortcut.",
    "cuisine": "japanese",
    "country": "japan",
    "region": None,
    "language": "en",
    "mealType": ["lunch", "dinner", "snack"],
    "dietType": ["non_vegetarian"],
    "difficulty": "medium",
    "spiceLevel": "none",
    "budgetLevel": "moderate",
    "prepTimeMinutes": 30,
    "cookTimeMinutes": 20,
    "totalTimeMinutes": 50,
    "servings": 4,
    "ingredients": [
      {"name": "maida (plain flour), for wrappers", "normalizedName": "maida", "quantity": 200, "unit": "g", "optional": False, "notes": "or use 25 to 30 ready-made momo or gyoza wrappers — this skips wrapper prep entirely"},
      {"name": "hot water (for dough)", "normalizedName": "water", "quantity": 90, "unit": "ml", "optional": False, "notes": "hot water makes the dough smooth; skip if using ready-made wrappers"},
      {"name": "minced pork or chicken keema", "normalizedName": "pork", "quantity": 250, "unit": "g", "optional": False, "notes": "chicken mince (keema) is a lighter substitute"},
      {"name": "cabbage, very finely shredded", "normalizedName": "cabbage", "quantity": 150, "unit": "g", "optional": False, "notes": "salt and squeeze out all moisture before mixing — wet cabbage makes soggy gyoza"},
      {"name": "ginger-garlic paste", "normalizedName": "ginger-garlic-paste", "quantity": 1, "unit": "tsp", "optional": False},
      {"name": "soy sauce", "normalizedName": "soy-sauce", "quantity": 2, "unit": "tbsp", "optional": False},
      {"name": "toasted sesame oil", "normalizedName": "gingelly-oil", "quantity": 1, "unit": "tbsp", "optional": False},
      {"name": "spring onion, finely sliced", "normalizedName": "spring-onion", "quantity": 3, "unit": "tbsp", "optional": False},
      {"name": "salt", "normalizedName": "salt", "quantity": None, "unit": "to_taste", "optional": False},
      {"name": "cooking oil", "normalizedName": "oil", "quantity": 2, "unit": "tbsp", "optional": False},
      {"name": "water (for pan-steaming)", "normalizedName": "water", "quantity": 60, "unit": "ml", "optional": False, "notes": "added to pan to steam the tops of the gyoza after initial fry"},
      {"name": "rice vinegar (for dipping sauce)", "normalizedName": "vinegar", "quantity": 2, "unit": "tbsp", "optional": False},
      {"name": "sesame seeds", "normalizedName": "sesame-seeds", "quantity": 1, "unit": "tsp", "optional": True, "notes": "for dipping sauce garnish"}
    ],
    "steps": [
      {
        "order": 1,
        "text": "If making wrappers from scratch: mix maida with hot water and a pinch of salt into a firm dough. Knead for 5 minutes until smooth, cover with a damp cloth and rest for 15 minutes. If using ready-made momo wrappers, skip to step 2.",
        "timerMinutes": 15,
        "method": "no-cook"
      },
      {
        "order": 2,
        "text": "Salt the shredded cabbage, let it sit for 5 minutes, then squeeze out all the liquid with your hands — do this firmly until no more water comes out. Combine squeezed cabbage with pork, ginger-garlic paste, soy sauce, sesame oil and spring onion. Mix until the filling holds together when pressed.",
        "timerMinutes": 5
      },
      {
        "order": 3,
        "text": "If using homemade dough: pinch off walnut-sized balls and roll each into a thin circle about 8 cm across. Keep the edges slightly thinner than the centre so the pleated crimps are not too thick."
      },
      {
        "order": 4,
        "text": "Place one heaped teaspoon of filling in the centre of each wrapper. Dampen the edges with a little water, fold the wrapper in half to enclose the filling and press to seal the top. Pleat the front edge with four or five overlapping folds, pressing each one firmly — this is the characteristic gyoza crimp.",
        "method": "no-cook"
      },
      {
        "order": 5,
        "text": "Heat oil in a non-stick pan or flat tawa over medium-high heat. Arrange gyoza flat-side-down in a single tight layer without touching. Fry for 3 to 4 minutes until the bases are deeply golden and release cleanly from the pan.",
        "timerMinutes": 4,
        "method": "pan-frying"
      },
      {
        "order": 6,
        "text": "Pour 60 ml of water carefully into the hot pan and cover immediately with a lid — it will spit and steam vigorously. Steam for 4 to 5 minutes over medium heat until the water has fully evaporated and you can hear the frying sound return.",
        "timerMinutes": 5
      },
      {
        "order": 7,
        "text": "Remove the lid and cook for 1 more minute to re-crisp the bases. Serve immediately, golden-side-up, with a dipping sauce of equal parts soy sauce and rice vinegar scattered with sesame seeds."
      }
    ],
    "cookware": ["frying-pan", "tawa"],
    "methods": ["pan-frying", "steaming", "no-cook"],
    "tags": ["party", "comfort-food", "kids-friendly", "fried-snack"],
    "allergens": ["gluten", "soy", "sesame"],
    "nutrition": {
      "calories": 310,
      "protein": 18,
      "carbs": 36,
      "fat": 10,
      "fiber": 2,
      "sugar": 2,
      "sodium": None,
      "isEstimate": True
    },
    "substitutions": [
      {"ingredient": "pork", "substitute": "chicken keema for a lighter filling, or firm tofu finely crumbled with mushroom for a vegan version", "notes": "press tofu completely dry before using"},
      {"ingredient": "maida", "substitute": "ready-made momo wrappers (available at Tibetan restaurants and select Indian supermarkets) — this shortcut cuts prep by 20 minutes"},
      {"ingredient": "gingelly-oil", "substitute": "a few drops of mustard oil for a bold Indian accent, or omit for a simpler filling"},
      {"ingredient": "cabbage", "substitute": "finely chopped spinach or bok choy — squeeze moisture out just as thoroughly before mixing in"}
    ],
    "culturalNote": "Gyoza arrived in Japan through Chinese jiaozi after World War II and became thoroughly domesticated — thinner-skinned, more garlicky, with the pan-steam cooking method as its signature. Gyoza is the standard accompaniment to a bowl of ramen in Japanese casual dining.",
    "regionalVariation": "Utsunomiya city in Tochigi Prefecture is so associated with gyoza that it has a gyoza statue and hosts an annual gyoza festival. The Utsunomiya style fries the dumplings on both sides; standard gyoza is only crisped on the bottom.",
    "indianKitchenAdaptation": "Momo wrappers, available at Tibetan-run eateries and some supermarkets in North India, are the ideal shortcut — they are slightly thicker than gyoza skins but fry and steam beautifully. A flat non-stick tawa works well for frying. The fry-steam-crisp sequence mirrors the covered kadai technique used for certain Indian fried breads — the logic will feel immediately familiar.",
    "source": "Cook Anything editorial — AI-drafted original",
    "sourceUrl": None,
    "license": "original",
    "author": "Cook Anything Kitchen",
    "verificationStatus": "ai_drafted",
    "image": None,
    "imageLicense": None,
    "createdAt": "2026-07-10T00:00:00.000Z",
    "updatedAt": "2026-07-10T00:00:00.000Z"
  }
]

data.extend(batch2)
with open('data/recipes/japanese.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
print(f"File now has {len(data)} recipes")

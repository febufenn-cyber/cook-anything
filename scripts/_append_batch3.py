#!/usr/bin/env python3
import json

with open('data/recipes/japanese.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

batch3 = [
  {
    "id": "ca-jp-shoyu-butter-corn-rice",
    "slug": "jp-shoyu-butter-corn-rice",
    "title": "Japanese Shoyu Butter Corn Rice",
    "nativeTitle": None,
    "description": "Steamed rice tossed with corn kernels cooked in butter until lightly caramelised, then finished with a drizzle of soy sauce — a beloved Japanese home comfort that uses a handful of pantry ingredients to produce something far more satisfying than the sum of its parts. The butter-soy combination is an iconic Japanese flavour pairing.",
    "cuisine": "japanese",
    "country": "japan",
    "region": None,
    "language": "en",
    "mealType": ["lunch", "dinner", "side"],
    "dietType": ["vegetarian"],
    "difficulty": "easy",
    "spiceLevel": "none",
    "budgetLevel": "budget",
    "prepTimeMinutes": 5,
    "cookTimeMinutes": 25,
    "totalTimeMinutes": 30,
    "servings": 4,
    "ingredients": [
      {"name": "short-grain rice or sona masoori rice", "normalizedName": "rice", "quantity": 2, "unit": "cup", "optional": False},
      {"name": "sweet corn kernels (fresh, frozen or canned)", "normalizedName": "corn", "quantity": 200, "unit": "g", "optional": False, "notes": "fresh corn cut off the cob has the best texture; canned works well drained"},
      {"name": "butter", "normalizedName": "butter", "quantity": 2, "unit": "tbsp", "optional": False},
      {"name": "soy sauce (shoyu)", "normalizedName": "soy-sauce", "quantity": 1.5, "unit": "tbsp", "optional": False},
      {"name": "spring onion, sliced", "normalizedName": "spring-onion", "quantity": 3, "unit": "tbsp", "optional": False},
      {"name": "black pepper, freshly ground", "normalizedName": "black-pepper", "quantity": None, "unit": "to_taste", "optional": False},
      {"name": "water (for cooking rice)", "normalizedName": "water", "quantity": 600, "unit": "ml", "optional": False}
    ],
    "steps": [
      {
        "order": 1,
        "text": "Rinse the rice until the water runs clear, then cook with 600 ml water in a covered saucepan over medium-low heat: bring to a boil, stir once, cover tightly, reduce to lowest flame and cook for 12 minutes. Remove from heat and rest, covered, for 10 minutes.",
        "timerMinutes": 22,
        "method": "boiling"
      },
      {
        "order": 2,
        "text": "While the rice cooks, melt butter in a wide pan or tawa over medium heat. Add corn kernels in a single layer and cook without stirring for 2 to 3 minutes until the undersides are lightly golden and you can smell a nutty, slightly sweet aroma.",
        "timerMinutes": 3,
        "method": "sauteing"
      },
      {
        "order": 3,
        "text": "Stir the corn and cook for 1 more minute. Pour the soy sauce directly over the corn and stir quickly — it will spit and caramelise against the hot pan within 30 seconds. Remove the pan from heat immediately."
      },
      {
        "order": 4,
        "text": "Fluff the cooked rice with a fork or rice paddle. Add the corn and all the buttery, savoury pan juices to the rice and fold through gently with a scooping motion so the corn is evenly distributed without crushing the grains."
      },
      {
        "order": 5,
        "text": "Taste for seasoning — the soy sauce should be sufficient but you can add another splash if needed. Plate and scatter spring onion generously over the top. Finish with a grind of black pepper and serve immediately."
      }
    ],
    "cookware": ["saucepan", "frying-pan", "tawa"],
    "methods": ["boiling", "sauteing", "one-pot"],
    "tags": ["comfort-food", "budget", "quick", "kids-friendly", "lunchbox"],
    "allergens": ["dairy", "soy", "gluten"],
    "nutrition": {
      "calories": 310,
      "protein": 6,
      "carbs": 56,
      "fat": 7,
      "fiber": 2,
      "sugar": 3,
      "sodium": None,
      "isEstimate": True
    },
    "substitutions": [
      {"ingredient": "butter", "substitute": "coconut oil for a dairy-free version with a subtly sweet note, or ghee for a richer Indian-inflected flavour", "notes": "ghee changes the flavour profile but pairs beautifully with soy"},
      {"ingredient": "corn", "substitute": "frozen peas or edamame (shelled soya beans) for variety; both work well with the butter-soy base"},
      {"ingredient": "soy-sauce", "substitute": "coconut aminos plus a pinch of salt for a soy-free version", "notes": "similar savoury depth with a slightly sweeter note"},
      {"ingredient": "rice", "substitute": "sona masoori or any medium-grain rice; avoid basmati as it doesn't absorb the corn juices the same way"}
    ],
    "culturalNote": "Butter and soy sauce is one of Japan's most beloved flavour pairings — the combination appears on corn at summer festivals, in ramen shops as an add-on, and in many home rice preparations. Japanese corn is famously sweet, making this dish almost dessert-like in contrast to the savoury soy.",
    "regionalVariation": "Hokkaido, Japan's northernmost island, is famous for sweet corn and butter dishes — visitors often try 'corn ramen' with butter and corn as the default topping. The rice version is a home-cooking adaption of those flavours.",
    "indianKitchenAdaptation": "This recipe requires no special equipment — a saucepan for rice and a tawa for the corn is all you need. Amul butter works perfectly. Sweet corn (bhutta dana) is available frozen or canned at any Indian supermarket; you can also cut fresh corn off the cob and use it immediately. Soy sauce is available nationwide.",
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
    "id": "ca-jp-curry-rice-scratch",
    "slug": "jp-curry-rice-scratch",
    "title": "Japanese Curry Rice from Scratch",
    "nativeTitle": "カレーライス",
    "description": "A thick, silky Japanese vegetable curry built from a butter-flour-curry-powder roux — sweeter, milder and rounder than Indian curry, with a sauce that coats the rice in a glossy, almost velvety layer. Making the roux from scratch takes no more than 5 extra minutes but produces a depth of flavour that boxed roux cannot match.",
    "cuisine": "japanese",
    "country": "japan",
    "region": None,
    "language": "en",
    "mealType": ["lunch", "dinner"],
    "dietType": ["vegetarian"],
    "difficulty": "medium",
    "spiceLevel": "mild",
    "budgetLevel": "budget",
    "prepTimeMinutes": 15,
    "cookTimeMinutes": 40,
    "totalTimeMinutes": 55,
    "servings": 4,
    "ingredients": [
      {"name": "onion, thinly sliced", "normalizedName": "onion", "quantity": 2, "unit": "piece", "optional": False},
      {"name": "potato, peeled and cut into 3 cm chunks", "normalizedName": "potato", "quantity": 2, "unit": "piece", "optional": False},
      {"name": "carrot, cut into thick coins", "normalizedName": "carrot", "quantity": 2, "unit": "piece", "optional": False},
      {"name": "butter", "normalizedName": "butter", "quantity": 4, "unit": "tbsp", "optional": False, "notes": "split as 2 tbsp for the vegetables and 2 tbsp for the roux"},
      {"name": "maida (plain flour)", "normalizedName": "maida", "quantity": 3, "unit": "tbsp", "optional": False, "notes": "forms the roux that thickens the curry"},
      {"name": "curry powder (mild)", "normalizedName": "curry-powder", "quantity": 2.5, "unit": "tbsp", "optional": False, "notes": "use a mild blend; Japanese S&B brand if available, or any mild curry powder"},
      {"name": "vegetable stock", "normalizedName": "stock", "quantity": 700, "unit": "ml", "optional": False},
      {"name": "soy sauce", "normalizedName": "soy-sauce", "quantity": 1, "unit": "tbsp", "optional": False, "notes": "adds umami depth characteristic of Japanese curry"},
      {"name": "honey", "normalizedName": "honey", "quantity": 1, "unit": "tsp", "optional": False, "notes": "authentic Japanese touch; gives the curry a round, gentle sweetness"},
      {"name": "steamed rice, to serve", "normalizedName": "rice", "quantity": 2, "unit": "cup", "optional": False},
      {"name": "salt", "normalizedName": "salt", "quantity": None, "unit": "to_taste", "optional": False}
    ],
    "steps": [
      {
        "order": 1,
        "text": "Melt 2 tbsp butter in a heavy-bottomed pot over medium heat. Add sliced onions and cook for 12 to 15 minutes, stirring every few minutes, until deep golden and beginning to caramelise. This long cook unlocks the sweetness that defines Japanese curry.",
        "timerMinutes": 15,
        "method": "sauteing"
      },
      {
        "order": 2,
        "text": "Add potato and carrot pieces and stir for 2 to 3 minutes, coating them in the buttery onion base. Pour in about 100 ml of the stock and scrape up any caramelised bits stuck to the pot bottom."
      },
      {
        "order": 3,
        "text": "In a separate small saucepan, melt the remaining 2 tbsp butter over medium-low heat. Add flour and stir constantly for 2 minutes until it turns a pale biscuit colour and smells slightly nutty. Add curry powder and cook for 30 more seconds until fragrant — this is your scratch roux.",
        "timerMinutes": 3
      },
      {
        "order": 4,
        "text": "Pour the remaining stock gradually into the roux, whisking or stirring vigorously after each addition to prevent lumps. Once smooth, pour this curry sauce into the vegetable pot. Stir to combine.",
        "method": "simmering"
      },
      {
        "order": 5,
        "text": "Bring to a gentle simmer, add soy sauce and honey, cover loosely and cook for 20 to 25 minutes until the potato and carrot are completely tender when pierced with a knife. Stir every 5 minutes and adjust heat so the curry barely bubbles — it burns if left unattended.",
        "timerMinutes": 25
      },
      {
        "order": 6,
        "text": "Taste and adjust salt. The curry should be thick enough to coat the back of a spoon; if too thin, simmer uncovered for 5 more minutes. Serve in a generous pool next to a mound of steamed rice on the same plate — Japanese curry is always served beside the rice, not on top."
      }
    ],
    "cookware": ["heavy-bottomed-pot", "saucepan"],
    "methods": ["sauteing", "simmering", "one-pot"],
    "tags": ["comfort-food", "budget", "kids-friendly", "gravy", "leftover-friendly"],
    "allergens": ["dairy", "gluten", "soy"],
    "nutrition": {
      "calories": 430,
      "protein": 8,
      "carbs": 72,
      "fat": 12,
      "fiber": 5,
      "sugar": 10,
      "sodium": None,
      "isEstimate": True
    },
    "substitutions": [
      {"ingredient": "butter", "substitute": "3 tbsp oil for a dairy-free version — the roux will be slightly less silky but very acceptable", "notes": "removes dairy allergen"},
      {"ingredient": "curry-powder", "substitute": "equal parts cumin powder, coriander powder and turmeric with a pinch of cardamom — gives a warming spice profile that reads as Japanese-ish", "notes": "avoid hot chilli powder; Japanese curry is intentionally mild"},
      {"ingredient": "honey", "substitute": "1 tsp sugar or a small piece of grated apple (if available) for the characteristic sweetness"},
      {"ingredient": "stock", "substitute": "water plus a stock cube or 1 tbsp soy sauce for a simpler but still flavourful base"}
    ],
    "culturalNote": "Japanese curry (kare) arrived via Britain in the late 1800s, absorbed Indian spice ideas through the imperial trade route, and became entirely its own thing over the following century. Today it is considered a national comfort food — Japan consumes more curry per capita than India on a per-meal basis when school and office lunches are counted.",
    "regionalVariation": "Some families add a square of dark chocolate, a spoon of ketchup or Worcestershire sauce to deepen the sauce — these are all traditional home cook's tricks. Keema (minced meat) curry, cheese curry and seafood curry are popular variations using the same roux base.",
    "indianKitchenAdaptation": "A heavy-bottomed kadai works well for the caramelised onion base. The roux step is identical to making bechamel (white sauce) — any Indian cook who has made pasta bake knows this technique. Japanese mild curry powder (S&B brand) is available at specialty stores in India; or build a DIY mild blend with equal parts jeera powder, dhania powder, haldi and a pinch of elaichi. Amul butter works perfectly.",
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
    "id": "ca-jp-zaru-soba",
    "slug": "jp-zaru-soba",
    "title": "Japanese Zaru Soba (Cold Buckwheat Noodles)",
    "nativeTitle": "ざるそば",
    "description": "Chilled buckwheat noodles drained on a slatted tray and served with a cold soy-based dipping sauce — Japan's signature summer dish and one of the most elegant examples of cooking by subtraction. The cool noodles, nutty from buckwheat, are lifted by the umami of the dip and finished with spring onion and sesame.",
    "cuisine": "japanese",
    "country": "japan",
    "region": None,
    "language": "en",
    "mealType": ["lunch", "dinner"],
    "dietType": ["vegan"],
    "difficulty": "easy",
    "spiceLevel": "none",
    "budgetLevel": "moderate",
    "prepTimeMinutes": 25,
    "cookTimeMinutes": 15,
    "totalTimeMinutes": 40,
    "servings": 2,
    "ingredients": [
      {"name": "soba noodles (buckwheat noodles)", "normalizedName": "noodles", "quantity": 200, "unit": "g", "optional": False, "notes": "use 100% buckwheat for gluten-free; most commercial soba contains some wheat"},
      {"name": "kombu (dried kelp), for dipping sauce", "normalizedName": "seaweed", "quantity": 1, "unit": "piece", "optional": False, "notes": "a 10 cm strip; makes the cold dashi base for the dip"},
      {"name": "soy sauce", "normalizedName": "soy-sauce", "quantity": 4, "unit": "tbsp", "optional": False},
      {"name": "sugar (or mirin)", "normalizedName": "sugar", "quantity": 1, "unit": "tsp", "optional": False, "notes": "balances the salt of the soy"},
      {"name": "toasted sesame seeds", "normalizedName": "sesame-seeds", "quantity": 1, "unit": "tbsp", "optional": False},
      {"name": "toasted sesame oil", "normalizedName": "gingelly-oil", "quantity": 1, "unit": "tsp", "optional": True, "notes": "a few drops tossed through the drained noodles prevent sticking and add fragrance"},
      {"name": "spring onion, very finely sliced", "normalizedName": "spring-onion", "quantity": 3, "unit": "tbsp", "optional": False},
      {"name": "water", "normalizedName": "water", "quantity": 400, "unit": "ml", "optional": False, "notes": "for the dipping sauce dashi and for boiling noodles"},
      {"name": "ice", "normalizedName": "ice", "quantity": None, "unit": "to_taste", "optional": False, "notes": "for chilling the noodles after cooking — essential"}
    ],
    "steps": [
      {
        "order": 1,
        "text": "Make the dipping sauce: combine 300 ml water and the kombu strip in a small saucepan. Bring slowly to a simmer over low heat — 10 minutes. Remove the kombu, add soy sauce and sugar, stir and simmer for 1 more minute. Pour into a bowl and refrigerate until completely cold, at least 20 minutes.",
        "timerMinutes": 30,
        "method": "simmering"
      },
      {
        "order": 2,
        "text": "Bring a large pot of water to a boil (no salt — soba noodles need unsalted water). Add the soba noodles and cook for 3 to 5 minutes per the package timing, stirring occasionally to prevent sticking. Taste one at 3 minutes — it should be tender with just the faintest resistance.",
        "timerMinutes": 5,
        "method": "boiling"
      },
      {
        "order": 3,
        "text": "Drain the noodles immediately and plunge them into a large bowl of ice water. Rub the noodles gently with your hands under the cold water — this removes the surface starch and is essential for the characteristic clean, non-sticky texture."
      },
      {
        "order": 4,
        "text": "Drain the chilled noodles very well in a colander, shaking out as much water as possible. If using sesame oil, drizzle it over and toss lightly to coat each strand."
      },
      {
        "order": 5,
        "text": "Arrange the cold noodles in a mound on a plate or in a bowl. Pour the chilled dipping sauce into small cups or a shallow bowl on the side. Serve with spring onion and sesame seeds in separate small dishes — diners add them to the dip according to taste."
      },
      {
        "order": 6,
        "text": "To eat: pick up a small bundle of noodles, dip the ends briefly into the sauce (not the whole strand), and eat in one or two slurps. The noodles should stay cold throughout the meal — work quickly."
      }
    ],
    "cookware": ["saucepan"],
    "methods": ["boiling", "simmering", "no-cook"],
    "tags": ["healthy", "summer", "budget", "bowl", "quick"],
    "allergens": ["gluten", "soy", "sesame"],
    "nutrition": {
      "calories": 280,
      "protein": 13,
      "carbs": 52,
      "fat": 4,
      "fiber": 3,
      "sugar": 3,
      "sodium": None,
      "isEstimate": True
    },
    "substitutions": [
      {"ingredient": "noodles", "substitute": "100% buckwheat soba for a gluten-free version; check the label as many brands blend with wheat flour", "notes": "in India, look for 'sobha noodles' at Japanese or Korean import stores"},
      {"ingredient": "seaweed", "substitute": "1 tsp instant dashi powder dissolved in 300 ml water if kombu is unavailable — gives a very similar base for the dipping sauce"},
      {"ingredient": "soy-sauce", "substitute": "tamari (wheat-free soy sauce) for a gluten-free dipping sauce, keeping the same quantities"},
      {"ingredient": "sesame-seeds", "substitute": "crushed roasted peanuts for a different but pleasant flavour note alongside the dipping sauce"}
    ],
    "culturalNote": "Zaru soba — named for the bamboo 'zaru' strainer on which the noodles are traditionally served — is one of Japan's quintessential summer foods, sold at every soba restaurant and convenience store from June through September. Slurping soba loudly is considered appreciative rather than rude in Japan.",
    "regionalVariation": "Nagano Prefecture in the Japanese Alps is considered the home of soba culture, producing some of the finest buckwheat in the country. In Tokyo, classic soba shops prepare fresh-milled noodles daily; the Kansai region uses soba less often and prefers udon.",
    "indianKitchenAdaptation": "Soba noodles are available at Korean and Japanese import stores in Indian metros and online. The recipe requires only a saucepan and no special technique beyond chilling. Instant dashi powder (sold alongside soba noodles at import stores) makes the dipping sauce fast. If kombu is unavailable, a light soy-based sauce with a pinch of seaweed flakes also works. Serve on a hot summer day as an alternative to any Indian cold meal.",
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
    "id": "ca-jp-chahan-fried-rice",
    "slug": "jp-chahan-fried-rice",
    "title": "Japanese Chahan (Fried Rice)",
    "nativeTitle": "チャーハン",
    "description": "Fluffy, separated fried rice with scrambled egg, spring onion and a clean soy-sesame finish — chahan is simpler and less oily than Chinese fried rice, with a neutral base that makes it the ideal companion to any Japanese main dish. Day-old refrigerated rice is the non-negotiable secret to grains that separate rather than clump.",
    "cuisine": "japanese",
    "country": "japan",
    "region": None,
    "language": "en",
    "mealType": ["lunch", "dinner", "side"],
    "dietType": ["eggetarian"],
    "difficulty": "easy",
    "spiceLevel": "none",
    "budgetLevel": "budget",
    "prepTimeMinutes": 5,
    "cookTimeMinutes": 15,
    "totalTimeMinutes": 20,
    "servings": 4,
    "ingredients": [
      {"name": "cooked rice (preferably day-old, refrigerated)", "normalizedName": "rice", "quantity": 4, "unit": "cup", "optional": False, "notes": "day-old rice is drier and fries without steaming — fresh rice produces mushy chahan"},
      {"name": "eggs", "normalizedName": "egg", "quantity": 3, "unit": "piece", "optional": False},
      {"name": "spring onion, finely sliced (white and green parts separated)", "normalizedName": "spring-onion", "quantity": 4, "unit": "tbsp", "optional": False},
      {"name": "mushrooms (shiitake or button), finely diced", "normalizedName": "mushroom", "quantity": 3, "unit": "piece", "optional": True, "notes": "adds umami; omit for a simpler, purer chahan"},
      {"name": "soy sauce", "normalizedName": "soy-sauce", "quantity": 2, "unit": "tbsp", "optional": False},
      {"name": "toasted sesame oil", "normalizedName": "gingelly-oil", "quantity": 1, "unit": "tbsp", "optional": False, "notes": "added at the end to preserve fragrance"},
      {"name": "cooking oil", "normalizedName": "oil", "quantity": 2, "unit": "tbsp", "optional": False},
      {"name": "black pepper, freshly ground", "normalizedName": "black-pepper", "quantity": None, "unit": "to_taste", "optional": False},
      {"name": "salt", "normalizedName": "salt", "quantity": None, "unit": "to_taste", "optional": False},
      {"name": "sesame seeds", "normalizedName": "sesame-seeds", "quantity": 1, "unit": "tsp", "optional": True, "notes": "garnish"}
    ],
    "steps": [
      {
        "order": 1,
        "text": "If the rice has been refrigerated, break up any large clumps with your fingers before cooking. Beat the eggs well with a pinch of salt and set aside. Make sure all other ingredients are prepped and within arm's reach — chahan moves fast once the pan is hot."
      },
      {
        "order": 2,
        "text": "Heat a large kadai or wok over maximum flame for 2 minutes until very hot. Add cooking oil and swirl to coat. Pour in the beaten eggs and stir rapidly for 30 to 40 seconds, breaking them into large, soft, barely-set curds — remove from the pan while they are still slightly wet.",
        "timerMinutes": 1,
        "method": "stir-frying"
      },
      {
        "order": 3,
        "text": "Add a little more oil if the pan looks dry. Add the white parts of the spring onion and the mushrooms (if using), and stir-fry for 1 to 2 minutes over high heat until the mushrooms begin to shrink and colour.",
        "timerMinutes": 2
      },
      {
        "order": 4,
        "text": "Add all the cold rice to the pan. Use the back of a spatula to press and break up any remaining clumps, tossing the rice continuously over high heat for 2 to 3 minutes until each grain is separate, hot and slightly toasted on the outside.",
        "timerMinutes": 3
      },
      {
        "order": 5,
        "text": "Pour soy sauce around the edge of the pan (not directly on the rice) so it hits the hot metal and caramelises slightly. Toss everything to distribute the sauce evenly, then return the scrambled egg to the pan and fold through the rice."
      },
      {
        "order": 6,
        "text": "Turn off the heat. Drizzle sesame oil over the rice and toss once more. Taste and adjust with salt and black pepper. Scatter the green parts of the spring onion and sesame seeds over the top. Serve immediately — chahan loses its texture as it sits."
      }
    ],
    "cookware": ["wok", "kadai"],
    "methods": ["stir-frying", "one-pot"],
    "tags": ["quick", "under-30-minutes", "comfort-food", "lunchbox", "budget", "leftover-friendly"],
    "allergens": ["egg", "soy", "gluten", "sesame"],
    "nutrition": {
      "calories": 380,
      "protein": 13,
      "carbs": 60,
      "fat": 10,
      "fiber": 2,
      "sugar": 2,
      "sodium": None,
      "isEstimate": True
    },
    "substitutions": [
      {"ingredient": "egg", "substitute": "crumbled firm tofu stir-fried briefly for a vegan version — season tofu with a pinch of turmeric for colour", "notes": "changes diet to vegan"},
      {"ingredient": "soy-sauce", "substitute": "coconut aminos for a soy-free version in the same quantity"},
      {"ingredient": "gingelly-oil", "substitute": "a few drops of mustard oil for a pungent Indian note; or omit — the rice is already well-seasoned"},
      {"ingredient": "mushroom", "substitute": "frozen peas, finely diced carrot, or corn kernels — add at the same stage and cook until heated through"}
    ],
    "culturalNote": "Chahan was adapted from Chinese chao fan (fried rice) in the early 20th century and became a Japanese staple in its own right — lighter in oil and seasoning than its Chinese cousin, and typically made at home using the leftover rice from the night before. Many Japanese ramen restaurants serve half-portions of chahan as a side.",
    "regionalVariation": None,
    "indianKitchenAdaptation": "A large pre-heated kadai on highest gas flame is the ideal Indian vessel for chahan — the technique is virtually identical to making egg rice or leftover rice stir-fry, which is already common in Indian homes. Day-old sona masoori or ponni rice works excellently. Soy sauce and sesame oil are the only special-pantry items; both are available at major Indian supermarkets. Add a pinch of white pepper for a restaurant-style touch.",
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

data.extend(batch3)
with open('data/recipes/japanese.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
print(f"File now has {len(data)} recipes")

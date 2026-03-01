from __future__ import annotations

_CATEGORIES: list[tuple[str, list[str]]] = [
    ("Produce", [
        "apple", "apricot", "artichoke", "arugula", "asparagus", "avocado",
        "banana", "basil", "bean sprout", "beet", "bell pepper", "blackberry",
        "blueberry", "bok choy", "broccoli", "brussels sprout", "cabbage",
        "cantaloupe", "carrot", "cauliflower", "celery", "cherry", "chive",
        "cilantro", "clementine", "collard", "corn", "cranberry", "cucumber",
        "date", "dill", "eggplant", "endive", "escarole", "fennel", "fig",
        "garlic", "ginger", "grape", "grapefruit", "green bean", "green onion",
        "honeydew", "jalapeño", "jalapeno", "kale", "kiwi", "kohlrabi",
        "leek", "lemon", "lettuce", "lime", "mango", "melon", "mint",
        "mushroom", "nectarine", "okra", "onion", "orange", "oregano",
        "parsley", "parsnip", "peach", "pear", "pea", "pepper", "persimmon",
        "pineapple", "plum", "pomegranate", "potato", "pumpkin", "radicchio",
        "radish", "raspberry", "rosemary", "sage", "scallion", "shallot",
        "spinach", "squash", "strawberry", "sweet potato", "swiss chard",
        "tangerine", "thyme", "tomatillo", "tomato", "turnip", "watermelon",
        "yam", "zucchini", "chard", "sorrel", "watercress", "microgreen",
        "sprout", "leeks", "chili", "poblano", "serrano", "habanero",
    ]),
    ("Meat & Seafood", [
        "bacon", "beef", "brisket", "chicken", "chorizo", "clam", "cod",
        "crab", "duck", "fish", "ground beef", "ground pork", "ground turkey",
        "halibut", "ham", "kielbasa", "lamb", "lobster", "mussels", "oyster",
        "pepperoni", "pork", "prosciutto", "salami", "salmon", "sausage",
        "scallop", "shrimp", "sirloin", "steak", "tilapia", "trout", "tuna",
        "turkey", "veal", "venison", "anchovy", "anchovies", "filet",
        "tenderloin", "ribeye", "chuck", "loin", "breast", "thigh", "wing",
        "drumstick", "rib", "roast", "cutlet", "chop",
    ]),
    ("Dairy & Eggs", [
        "butter", "buttermilk", "cheddar", "cheese", "colby", "cottage cheese",
        "cream cheese", "cream", "egg", "feta", "gouda", "gruyere", "half-and-half",
        "heavy cream", "jack cheese", "kefir", "manchego", "mascarpone",
        "milk", "mozzarella", "parmesan", "provolone", "queso", "ricotta",
        "romano", "sour cream", "swiss cheese", "whipped cream", "whipping cream",
        "yogurt", "brie", "camembert", "goat cheese", "ghee",
    ]),
    ("Bakery & Bread", [
        "bagel", "baguette", "bread", "brioche", "bun", "ciabatta", "croissant",
        "crouton", "english muffin", "flatbread", "focaccia", "hamburger bun",
        "hot dog bun", "loaf", "naan", "pita", "pretzel", "roll", "rye bread",
        "sourdough", "tortilla", "wrap", "whole wheat bread", "white bread",
    ]),
    ("Frozen", [
        "frozen corn", "frozen pea", "frozen spinach", "frozen berry",
        "frozen mango", "frozen edamame", "ice cream", "frozen pizza",
        "frozen waffle", "frozen vegetable", "frozen fruit", "gelato", "sorbet",
    ]),
    ("Beverages", [
        "beer", "broth", "cider", "club soda", "coconut milk", "coconut water",
        "coffee", "espresso", "juice", "kombucha", "lemonade", "oat milk",
        "almond milk", "soy milk", "sparkling water", "stock", "tea", "water",
        "wine", "sake", "bourbon", "vodka", "rum", "gin", "whiskey",
        "tequila", "vermouth", "champagne", "prosecco",
    ]),
    ("Condiments & Sauces", [
        "bbq sauce", "buffalo sauce", "chutney", "fish sauce", "hoisin",
        "hot sauce", "ketchup", "marinara", "mayo", "mayonnaise", "mustard",
        "oyster sauce", "pesto", "ranch", "relish", "salsa", "sesame oil",
        "soy sauce", "sriracha", "steak sauce", "tahini", "tamari",
        "teriyaki", "vinaigrette", "worcestershire", "aioli", "harissa",
        "gochujang", "miso", "ponzu",
    ]),
    ("Pantry & Dry Goods", [
        "almond", "all-purpose flour", "baking powder", "baking soda",
        "bay leaf", "black pepper", "breadcrumb", "brown sugar", "bulgur",
        "canola oil", "capers", "cashew", "cayenne", "chickpea", "chili flake",
        "cinnamon", "clove", "cocoa powder", "coconut oil", "couscous",
        "cumin", "curry powder", "dried basil", "dried oregano", "dried thyme",
        "farro", "flaxseed", "flour", "garam masala", "honey", "kidney bean",
        "lentil", "lentils", "maple syrup", "molasses", "noodle", "nut",
        "nutmeg", "oat", "olive oil", "paprika", "pasta", "peanut",
        "peanut butter", "pecan", "pine nut", "pink salt", "quinoa",
        "raisin", "red pepper flake", "rice", "salt", "sesame seed",
        "smoked paprika", "spaghetti", "sugar", "sunflower seed", "turmeric",
        "vanilla extract", "vegetable oil", "vinegar", "walnut", "white sugar",
        "yeast", "lemon juice", "lime juice", "tomato paste", "tomato sauce",
        "diced tomato", "crushed tomato", "chicken broth", "beef broth",
        "vegetable broth", "coconut cream", "canned tomato", "canned bean",
        "black bean", "pinto bean", "navy bean", "white bean", "corn starch",
        "cornstarch", "arrowroot", "tapioca", "gelatin", "agar",
        "chocolate chip", "chocolate", "cocoa", "powdered sugar",
        "confectioners sugar", "brown rice", "white rice", "jasmine rice",
        "basmati rice", "wild rice", "arborio", "polenta", "grits",
        "panko", "bread crumb", "cracker", "chip", "pretzel",
    ]),
]

# Flattened lookup: keyword -> category
_KEYWORD_MAP: dict[str, str] = {}
for _cat, _keywords in _CATEGORIES:
    for _kw in _keywords:
        _KEYWORD_MAP[_kw] = _cat


def categorize_ingredient(name: str) -> str:
    """Return a grocery store section for an ingredient name using keyword matching."""
    lower = name.lower()
    # Exact match first
    if lower in _KEYWORD_MAP:
        return _KEYWORD_MAP[lower]
    # Substring match (longest keyword wins to avoid false positives)
    best: tuple[int, str] | None = None
    for kw, cat in _KEYWORD_MAP.items():
        if kw in lower:
            if best is None or len(kw) > best[0]:
                best = (len(kw), cat)
    if best:
        return best[1]
    return "Other"

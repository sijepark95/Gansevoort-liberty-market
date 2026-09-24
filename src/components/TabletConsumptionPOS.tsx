import React, { useState, useMemo, useEffect, useRef } from "react";
import { Ingredient, ConsumptionLog, Vendor, Department, Employee } from "../types";
import { 
  X, 
  Search, 
  Check, 
  Calculator, 
  MapPin, 
  SearchX, 
  CheckCircle, 
  Monitor, 
  Grid, 
  PenTool, 
  ArrowLeft, 
  User, 
  Eraser,
  TrendingDown,
  TrendingUp,
  Plus,
  PlusCircle,
  ChevronDown,
  Camera,
  Eye,
  EyeOff,
  SlidersHorizontal
} from "lucide-react";
import { motion } from "motion/react";
import { db, safeAddDoc } from "../lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { calculatePoundData, convertInputToNativeQty } from "../lib/unitConverter";
import { CameraScanner } from "./CameraScanner";

const UNIT_TO_GRAMS: { [key: string]: number } = {
  g: 1, gram: 1, grams: 1, kg: 1000, kilogram: 1000, kilograms: 1000,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
  ml: 1, milliliter: 1, milliliters: 1,
  l: 1000, liter: 1000, liters: 1000
};

const DEFAULT_RESTAURANTS = [
  "UMAI FISH",
  "TWO GEESE BAKERY",
  "TG SANDWICH & DRINKS",
  "TG BREAKFAST",
  "BUON CIBO",
  "SAL ANTHONY'S",
  "CHICKEN N BUNS",
  "NARI EXPRESS",
  "CEBICHELSEA",
  "EAT WELL",
  "MOMO CURRY",
  "SAMMY'S TAQUERIA"
];

const COMMON_SPANISH_DICTIONARY: { [key: string]: string } = {
  // Meats & Poultry
  beef: "Carne de res",
  chicken: "Pollo",
  pork: "Cerdo",
  bacon: "Tocino",
  sausage: "Salchicha",
  ham: "Jamón",
  turkey: "Pavo",
  steak: "Filete",
  ribs: "Costillas",
  meatballs: "Albóndigas",
  "ground beef": "Carne molida",
  lamb: "Cordero",
  duck: "Pato",
  veal: "Ternera",
  chorizo: "Chorizo",
  pepperoni: "Pepperoni",
  salami: "Salami",

  // Seafood
  salmon: "Salmón",
  shrimp: "Camarones",
  tuna: "Atún",
  fish: "Pescado",
  lobster: "Langosta",
  crab: "Cangrejo",
  clams: "Almejas",
  octopus: "Pulpo",
  mussels: "Mejillones",
  cod: "Bacalao",
  squid: "Calamar",
  scallops: "Vieiras",

  // Vegetables
  onion: "Cebolla",
  garlic: "Ajo",
  tomato: "Tomate",
  tomatoes: "Tomates",
  lettuce: "Lechuga",
  potato: "Papa",
  potatoes: "Papas",
  carrots: "Zanahorias",
  carrot: "Zanahoria",
  cucumber: "Pepino",
  spinach: "Espinaca",
  pepper: "Pimiento",
  peppers: "Pimientos",
  cilantro: "Cilantro",
  parsley: "Perejil",
  cabbage: "Repollo",
  mushroom: "Champiñón",
  mushrooms: "Champiñones",
  avocado: "Aguacate",
  avocados: "Aguacates",
  lemon: "Limón",
  lemons: "Limones",
  lime: "Limón verde",
  limes: "Limones verdes",
  ginger: "Jengibre",
  celery: "Apio",
  broccoli: "Brócoli",
  cauliflower: "Coliflor",
  asparagus: "Espárrago",
  zucchini: "Calabacín",
  eggplant: "Berenjena",
  corn: "Maíz",
  peas: "Chícharos / Guisantes",
  beans: "Frijoles",
  green_beans: "Ejotes",
  radish: "Rábano",
  kale: "Col rizada",

  // Fruits
  apple: "Manzana",
  apples: "Manzanas",
  banana: "Plátano",
  bananas: "Plátanos",
  orange: "Naranja",
  oranges: "Naranjas",
  strawberry: "Fresa",
  strawberries: "Fresas",
  blueberry: "Arándano",
  blueberries: "Arándanos",
  grape: "Uva",
  grapes: "Uvas",
  pineapple: "Piña",
  mango: "Mango",
  peach: "Durazno",
  watermelon: "Sandía",

  // Dairy & Eggs
  milk: "Leche",
  cheese: "Queso",
  butter: "Mantequilla",
  cream: "Crema",
  sour_cream: "Crema agria",
  egg: "Huevo",
  eggs: "Huevos",
  yogurt: "Yogur",
  parmesan: "Queso parmesano",
  cheddar: "Queso cheddar",
  mozzarella: "Queso mozzarella",

  // Baking, Dry Goods & Grains
  bread: "Pan",
  bun: "Pan de hamburguesa",
  buns: "Panes",
  tortilla: "Tortilla",
  tortillas: "Tortillas",
  flour: "Harina",
  rice: "Arroz",
  pasta: "Pasta",
  noodles: "Fideos",
  sugar: "Azúcar",
  salt: "Sal",
  yeast: "Levadura",
  baking_powder: "Polvo de hornear",
  oats: "Avena",
  quinoa: "Quinoa",

  // Liquids, Oils & Sauces
  oil: "Aceite",
  olive_oil: "Aceite de oliva",
  sauce: "Salsa",
  soy_sauce: "Salsa de soya",
  vinegar: "Vinagre",
  honey: "Miel",
  mayo: "Mayonesa",
  ketchup: "Ketchup",
  mustard: "Mostaza",
  water: "Agua",
  juice: "Jugo",
  wine: "Vino",
  beer: "Cerveza",
  coffee: "Café",
  tea: "Té",
  syrup: "Jarabe"
};

interface MultiUnitBalance {
  unitLabel: string;
  qtyFormatted: string;
}

function getMultiUnitBreakdown(
  stockQty: number,
  ingredient: Ingredient
): MultiUnitBalance[] {
  if (stockQty === undefined || stockQty === null || isNaN(stockQty)) {
    return [];
  }

  const nativeUnit = (ingredient.unit || "pcs").trim();
  const cleanNative = nativeUnit.toLowerCase();
  
  const results: MultiUnitBalance[] = [];
  const addedUnits = new Set<string>();

  const fmt = (num: number, u: string) => {
    const formatted = Number.isInteger(num) || Math.abs(num - Math.round(num)) < 0.0001
      ? `${Math.round(num)} ${u}`
      : `${num.toFixed(2)} ${u}`;
    return formatted;
  };

  // 1. Primary / Native unit
  results.push({
    unitLabel: nativeUnit,
    qtyFormatted: fmt(stockQty, nativeUnit),
  });
  addedUnits.add(cleanNative);

  const isBoxNative = ["box", "boxes", "case", "cases"].includes(cleanNative);
  const isPcsNative = ["pcs", "piece", "pieces", "ea", "each", "ct", "count"].includes(cleanNative);
  const isPackNative = ["pack", "packs", "bag", "bags", "bottle", "can", "container"].includes(cleanNative);
  const isLbNative = ["lb", "lbs", "pound", "pounds"].includes(cleanNative);

  // 2. Boxes / Cases
  if (!isBoxNative) {
    let boxes: number | null = null;
    const boxName = ingredient.packagingUnit && ["box", "boxes", "case", "cases"].includes(ingredient.packagingUnit.toLowerCase())
      ? ingredient.packagingUnit
      : "box";

    if (ingredient.pcsPerPound && ingredient.pcsPerPound > 0 && (isPcsNative || isPackNative)) {
      boxes = stockQty / ingredient.pcsPerPound;
    } else if (ingredient.weightPerCase && ingredient.weightPerCase > 0) {
      const poundData = calculatePoundData(
        stockQty,
        ingredient.unit,
        ingredient.weightPerCase,
        ingredient.weightPerCaseUnit,
        ingredient.pcsPerPound,
        ingredient.quantity
      );
      if (poundData.lbs > 0) {
        boxes = poundData.lbs / ingredient.weightPerCase;
      }
    } else if (ingredient.conversions && ingredient.conversions.length > 0) {
      const conv = ingredient.conversions.find(c => c.targetUnit && ["box", "boxes", "case", "cases"].includes(c.targetUnit.toLowerCase()));
      if (conv && conv.ratio > 0) {
        boxes = stockQty / conv.ratio;
      }
    }

    if (boxes !== null && !isNaN(boxes) && boxes >= 0 && !addedUnits.has("box") && !addedUnits.has("boxes")) {
      const labelStr = boxes === 1 ? boxName : (boxName.endsWith("s") || boxName.endsWith("x") ? `${boxName}es` : `${boxName}s`);
      results.push({
        unitLabel: "Boxes",
        qtyFormatted: fmt(boxes, labelStr),
      });
      addedUnits.add("box");
      addedUnits.add("boxes");
    }
  }

  // 3. Pieces / Packs
  if (!isPcsNative && !isPackNative) {
    let pcs: number | null = null;
    const pcsName = ingredient.packagingUnit && !["box", "boxes", "case", "cases"].includes(ingredient.packagingUnit.toLowerCase())
      ? ingredient.packagingUnit
      : "pcs";

    if (isBoxNative && ingredient.pcsPerPound && ingredient.pcsPerPound > 0) {
      pcs = stockQty * ingredient.pcsPerPound;
    } else if (ingredient.conversions && ingredient.conversions.length > 0) {
      const conv = ingredient.conversions.find(c => c.targetUnit && ["pcs", "piece", "pieces", "pack", "packs", "ea", "each"].includes(c.targetUnit.toLowerCase()));
      if (conv && conv.ratio > 0) {
        pcs = stockQty * conv.ratio;
      }
    }

    if (pcs !== null && !isNaN(pcs) && pcs >= 0 && !addedUnits.has("pcs") && !addedUnits.has("pieces")) {
      results.push({
        unitLabel: "Pieces/Packs",
        qtyFormatted: fmt(pcs, pcsName),
      });
      addedUnits.add("pcs");
      addedUnits.add("pieces");
    }
  }

  // 4. Weight (Pounds)
  if (!isLbNative && !addedUnits.has("lb") && !addedUnits.has("lbs")) {
    const poundData = calculatePoundData(
      stockQty,
      ingredient.unit,
      ingredient.weightPerCase,
      ingredient.weightPerCaseUnit,
      ingredient.pcsPerPound,
      ingredient.quantity
    );
    if (poundData.hasWeightSpec && poundData.lbs > 0) {
      results.push({
        unitLabel: "Pounds",
        qtyFormatted: `${poundData.lbs.toFixed(2)} lbs`,
      });
      addedUnits.add("lbs");
      addedUnits.add("lb");
    }
  }

  // 5. Additional Custom Conversions
  if (ingredient.conversions && ingredient.conversions.length > 0) {
    ingredient.conversions.forEach(c => {
      if (!c.targetUnit) return;
      const targetClean = c.targetUnit.toLowerCase();
      if (addedUnits.has(targetClean)) return;

      const convertedVal = stockQty / (c.ratio || 1);
      results.push({
        unitLabel: c.targetUnit,
        qtyFormatted: fmt(convertedVal, c.targetUnit),
      });
      addedUnits.add(targetClean);
    });
  }

  return results;
}

interface TabletConsumptionPOSProps {
  ingredients: Ingredient[];
  vendors?: Vendor[];
  departments?: Department[];
  employees?: Employee[];
  workspaceOwnerId: string | null;
  user: any;
  onClose: () => void;
  onEditIngredient: (id: string, edits: Partial<Ingredient>) => Promise<void>;
  onAddIngredient: (ing: Partial<Ingredient>) => Promise<void>;
  isReadOnly?: boolean;
}

export default function TabletConsumptionPOS({ 
  ingredients, 
  vendors = [],
  departments = [],
  employees = [],
  workspaceOwnerId, 
  user, 
  onClose, 
  onEditIngredient,
  onAddIngredient,
  isReadOnly = false
}: TabletConsumptionPOSProps) {
  // Mode selection: "deduct" (Consumption) | "receive" (Increase) | "add-item" (Quick Catalog Creation)
  const [posMode, setPosMode] = useState<"deduct" | "receive" | "add-item">("deduct");

  const [department, setDepartment] = useState("");
  const [showDeptModal, setShowDeptModal] = useState(false);

  // List of registered departments for selection (strictly limited to registered departments if available)
  const deptOptions = useMemo(() => {
    const list = new Set<string>();
    if (departments && Array.isArray(departments) && departments.length > 0) {
      departments.forEach(d => {
        if (d.name && d.name.trim()) list.add(d.name.trim());
      });
    }
    const registered = Array.from(list);
    if (registered.length > 0) {
      return registered;
    }
    // Fallback defaults only if no departments have been registered yet
    return ["Kitchen", "Bar", "Bakery", "Prep Kitchen", "Main Line", "Pastry", "Beverage", "Dining Room"];
  }, [departments]);

  const [date, setDate] = useState(() => {
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().split("T")[0];
    return localISOTime;
  });
  
  const [selectedLocation, setSelectedLocation] = useState<string>("All Locations");
  const [selectedCategory, setSelectedCategory] = useState<string>("All Categories");
  const [searchQuery, setSearchQuery] = useState("");

  // Spanish translation and language controls
  const [language, setLanguage] = useState<"en" | "es">("en");
  const [spanishTranslations, setSpanishTranslations] = useState<{[id: string]: string}>({});
  const [isTranslating, setIsTranslating] = useState(false);

  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [isProcessingCamera, setIsProcessingCamera] = useState(false);

  // Trigger translation when Spanish mode is activated
  useEffect(() => {
    if (language !== "es") return;

    const untranslated = ingredients.filter(
      ing => ing.id && !spanishTranslations[ing.id]
    );

    if (untranslated.length === 0) return;

    const fetchTranslations = async () => {
      setIsTranslating(true);
      try {
        const res = await fetch("/api/translate-ingredients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: untranslated.map(i => ({ id: i.id, name: i.name }))
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.translations && Array.isArray(data.translations)) {
            setSpanishTranslations(prev => {
              const updated = { ...prev };
              data.translations.forEach((item: any) => {
                if (item.id && item.translation) {
                  updated[item.id] = item.translation;
                }
              });
              return updated;
            });
          }
        }
      } catch (err) {
        console.error("Error fetching ingredient translations:", err);
      } finally {
        setIsTranslating(false);
      }
    };

    fetchTranslations();
  }, [language, ingredients]);

  const getIngredientDisplayName = (ing: Ingredient) => {
    if (language === "en") return ing.name;

    // 1. Check AI translation cache first
    if (ing.id && spanishTranslations[ing.id]) {
      return spanishTranslations[ing.id];
    }

    // 2. Local dictionary fallback
    const lowerName = ing.name.toLowerCase().trim();
    if (COMMON_SPANISH_DICTIONARY[lowerName]) {
      return COMMON_SPANISH_DICTIONARY[lowerName];
    }

    // Attempt word substitution for composite terms
    let substituted = ing.name;
    for (const [enKey, esVal] of Object.entries(COMMON_SPANISH_DICTIONARY)) {
      const regex = new RegExp(`\\b${enKey}\\b`, "gi");
      if (regex.test(substituted)) {
        substituted = substituted.replace(regex, esVal);
      }
    }

    return substituted;
  };
  
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [inputQty, setInputQty] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("pound");
  const [showHideUnitSelector, setShowHideUnitSelector] = useState(false);
  const [hiddenUnits, setHiddenUnits] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("culinary_pos_hidden_units");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [autoUpdateStock, setAutoUpdateStock] = useState(true);
  
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{type: "success" | "error", text: string} | null>(null);

  // Sign-off signature and operator name states
  const [showSignaturePage, setShowSignaturePage] = useState(false);
  const [operatorNameInput, setOperatorNameInput] = useState("");
  const [fetchedEmployees, setFetchedEmployees] = useState<Employee[]>([]);
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const staffSearchRef = useRef<HTMLDivElement | null>(null);

  // Real-time listener for staff from firestore as fallback
  useEffect(() => {
    if (!workspaceOwnerId) return;
    if (employees && employees.length > 0) return;

    const q = query(
      collection(db, "employees"),
      where("ownerId", "==", workspaceOwnerId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Employee[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Employee);
      });
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setFetchedEmployees(list);
    }, (err) => {
      console.error("Error fetching staff for POS:", err);
    });
    return () => unsubscribe();
  }, [workspaceOwnerId, employees]);

  // Combined staff array from props or direct firestore listener
  const allStaff = useMemo(() => {
    if (employees && employees.length > 0) return employees;
    return fetchedEmployees;
  }, [employees, fetchedEmployees]);

  // Filtered staff list based on operatorNameInput
  const filteredStaff = useMemo(() => {
    if (!operatorNameInput.trim()) return allStaff;
    const q = operatorNameInput.toLowerCase().trim();
    return allStaff.filter(emp => 
      (emp.name || "").toLowerCase().includes(q) ||
      (emp.role || "").toLowerCase().includes(q) ||
      (emp.dept || "").toLowerCase().includes(q) ||
      (emp.employeeCode || "").toLowerCase().includes(q)
    );
  }, [allStaff, operatorNameInput]);

  // Check if current input matches a registered staff member exactly
  const matchedStaff = useMemo(() => {
    if (!operatorNameInput.trim()) return null;
    return allStaff.find(emp => (emp.name || "").toLowerCase().trim() === operatorNameInput.toLowerCase().trim());
  }, [allStaff, operatorNameInput]);

  // Close staff dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (staffSearchRef.current && !staffSearchRef.current.contains(event.target as Node)) {
        setShowStaffDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Add New Item form states
  const [newItemName, setNewItemName] = useState("");
  const [newItemVendor, setNewItemVendor] = useState("unassigned");
  const [newItemLocation, setNewItemLocation] = useState("Walk-In Cooler");
  const [newItemPrice, setNewItemPrice] = useState("0");
  const [newItemUnit, setNewItemUnit] = useState("lb");
  const [newItemPackQty, setNewItemPackQty] = useState("1");
  const [newInitialStock, setNewInitialStock] = useState("");
  const [newMinStock, setNewMinStock] = useState("0");
  const [newItemCategory, setNewItemCategory] = useState("Meat");

  // Auto-set default unit based on selected category when adding a new item
  useEffect(() => {
    const cat = newItemCategory.toLowerCase();
    if (["meat", "vegetables", "seafood"].includes(cat)) {
      setNewItemUnit("lb");
    } else if (["beverages", "dairy", "other"].includes(cat) || cat.includes("milk") || cat.includes("beverage") || cat.includes("dairy")) {
      setNewItemUnit("pcs");
    }
  }, [newItemCategory]);

  // Pre-populate unique vendors from registered vendors
  const vendorsList = useMemo(() => {
    const list = new Set<string>();
    if (vendors && Array.isArray(vendors)) {
      vendors.forEach(v => {
        if (v.name && v.name.trim()) {
          list.add(v.name.trim());
        }
      });
    }
    return Array.from(list).sort((a, b) => a.localeCompare(b));
  }, [vendors]);

  // Drawing Canvas logic
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#10b981"; // Emerald line color

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ("touches" in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ("touches" in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    ctx.lineTo(x, y);
    ctx.stroke();
    if ("touches" in e) {
      e.preventDefault();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Group locations
  const locations = useMemo(() => {
    const locs = new Set<string>();
    ingredients.forEach(i => {
      if (i.location) locs.add(i.location.trim());
    });
    return ["All Locations", ...Array.from(locs).sort()];
  }, [ingredients]);

  // Group categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    ingredients.forEach(i => {
      if (i.category) cats.add(i.category.trim());
    });
    const defaults = ["Meat", "Vegetables", "Fruit", "Bread", "Seafood", "Dairy", "Dry Goods", "Beverages", "Other"];
    defaults.forEach(c => cats.add(c));
    return ["All Categories", ...Array.from(cats).sort()];
  }, [ingredients]);

  // Adaptive unit options based on selected ingredient
  const allAvailableUnits = useMemo(() => {
    if (!selectedIngredient) return ["lb"];
    const nativeUnit = selectedIngredient.unit || "lb";

    const unitsSet = new Set<string>();
    unitsSet.add(nativeUnit); // Always include native unit first

    if (selectedIngredient.packagingUnit && selectedIngredient.pcsPerPound && selectedIngredient.pcsPerPound > 0) {
      unitsSet.add(selectedIngredient.packagingUnit);
    }

    if (selectedIngredient.conversions && selectedIngredient.conversions.length > 0) {
      selectedIngredient.conversions.forEach(c => {
        if (c.targetUnit) unitsSet.add(c.targetUnit);
      });
    }

    return Array.from(unitsSet);
  }, [selectedIngredient, posMode]);

  // Filter out units that the user marked as hidden
  const visibleUnits = useMemo(() => {
    return allAvailableUnits.filter(u => !hiddenUnits.some(hu => hu.toLowerCase() === u.toLowerCase()));
  }, [allAvailableUnits, hiddenUnits]);

  // Toggle hiding a specific unit
  const toggleHideUnit = (unitName: string) => {
    const isHidden = hiddenUnits.some(hu => hu.toLowerCase() === unitName.toLowerCase());
    let next: string[];
    if (isHidden) {
      next = hiddenUnits.filter(hu => hu.toLowerCase() !== unitName.toLowerCase());
    } else {
      next = [...hiddenUnits, unitName];
    }
    setHiddenUnits(next);
    try {
      localStorage.setItem("culinary_pos_hidden_units", JSON.stringify(next));
    } catch {}
  };

  const unhideAllUnits = () => {
    setHiddenUnits([]);
    try {
      localStorage.removeItem("culinary_pos_hidden_units");
    } catch {}
  };

  // Reset unit when ingredient changes
  useEffect(() => {
    if (selectedIngredient) {
      const nativeUnit = selectedIngredient.unit || "lbs";
      if (!hiddenUnits.some(hu => hu.toLowerCase() === nativeUnit.toLowerCase())) {
        setSelectedUnit(nativeUnit);
      } else if (visibleUnits.length > 0) {
        setSelectedUnit(visibleUnits[0]);
      } else {
        setSelectedUnit(nativeUnit);
      }
    }
  }, [selectedIngredient]);

  // Adjust unit if posMode changes or if the currently selected unit was hidden
  useEffect(() => {
    if (selectedIngredient && selectedUnit) {
      if (visibleUnits.length > 0 && !visibleUnits.some(u => u.toLowerCase() === selectedUnit.toLowerCase())) {
        setSelectedUnit(visibleUnits[0]);
      } else if (visibleUnits.length === 0 && allAvailableUnits.length > 0 && !allAvailableUnits.some(u => u.toLowerCase() === selectedUnit.toLowerCase())) {
        setSelectedUnit(allAvailableUnits[0]);
      }
    }
  }, [visibleUnits, allAvailableUnits, selectedIngredient, selectedUnit, posMode]);

  
  const filteredIngredients = useMemo(() => {
    // Exclude hidden catalog items
    let filtered = ingredients.filter(i => !i.isHiddenFromInventory);
    
    // Deduct mode: only show items currently in stock to avoid clutter
    // Receive mode: show everything so they can receive out-of-stock items!
    if (posMode === "deduct") {
      filtered = filtered.filter(i => i.inStock !== undefined && i.inStock > 0);
    }
    
    if (selectedLocation !== "All Locations") {
      filtered = filtered.filter(i => i.location === selectedLocation);
    }
    if (selectedCategory !== "All Categories") {
      filtered = filtered.filter(i => i.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(i => {
        const engName = i.name.toLowerCase();
        const espName = getIngredientDisplayName(i).toLowerCase();
        return engName.includes(q) || espName.includes(q);
      });
    }
    // Sort by display name (which could be Spanish or English depending on active mode)
    return [...filtered].sort((a, b) => {
      const nameA = getIngredientDisplayName(a);
      const nameB = getIngredientDisplayName(b);
      return nameA.localeCompare(nameB);
    });
  }, [ingredients, selectedLocation, selectedCategory, searchQuery, posMode, language, spanishTranslations]);

  const getStockDisplay = (ing: Ingredient) => {
    const stock = ing.inStock !== undefined ? ing.inStock : 0;
    const baseDisplay = `${stock} ${ing.unit || 'packs'}`;
    
    // Attempt to calculate lb equivalent if it exists and is valid
    const poundInfo = calculatePoundData(
      stock,
      ing.unit,
      ing.weightPerCase,
      ing.weightPerCaseUnit,
      ing.pcsPerPound,
      ing.quantity
    );
    
    // Only append if there is actual weight specification and native unit is not lbs already
    const cleanUnit = (ing.unit || "lbs").toLowerCase().trim();
    if (poundInfo.hasWeightSpec && !["lb", "lbs", "pound", "pounds"].includes(cleanUnit)) {
      return `${baseDisplay} (${poundInfo.lbs.toFixed(2)} lbs)`;
    }
    
    return baseDisplay;
  };

  const handleNumClick = (val: string) => {
    if (val === "C") {
      setInputQty("");
    } else if (val === ".") {
      if (!inputQty.includes(".")) setInputQty(inputQty + ".");
    } else if (val === "DEL") {
      setInputQty(inputQty.slice(0, -1));
    } else {
      if (inputQty === "0") setInputQty(val);
      else setInputQty(inputQty + val);
    }
  };

  // Add Brand-New Item catalog submit
  const handleAddNewItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemPrice.trim()) {
      setMessage({ type: "error", text: "Please enter an item name and price." });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const priceVal = parseFloat(newItemPrice) || 0;
      const packQtyVal = parseFloat(newItemPackQty) || 1;
      const initialStockVal = parseFloat(newInitialStock) || 0;
      const minStockVal = parseFloat(newMinStock) || 0;

      await onAddIngredient({
        name: newItemName.trim(),
        price: priceVal,
        unit: newItemUnit.trim() || "lb",
        vendor: newItemVendor.trim() || "unassigned",
        location: newItemLocation,
        inStock: initialStockVal,
        minStock: minStockVal,
        quantity: packQtyVal,
        pricePerGram: priceVal / packQtyVal,
        source: "Tablet POS Catalog",
        category: newItemCategory
      });

      setMessage({ type: "success", text: `Successfully created and added ${newItemName} to catalog!` });
      
      // Clear fields
      setNewItemName("");
      setNewItemVendor("unassigned");
      setNewItemPrice("0");
      setNewItemUnit("lb");
      setNewItemPackQty("1");
      setNewInitialStock("");
      setNewMinStock("0");
      setNewItemCategory("Meat");
      
      // Auto-switch back to Receive Stock mode to see the newly created catalog item
      setPosMode("receive");
      
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      console.error("Error creating item from tablet:", err);
      setMessage({ 
        type: "error", 
        text: err.message === "DUPLICATE_ENTRY" 
          ? "Item with this name and vendor already exists." 
          : (err.message || "Failed to create item.") 
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle inventory change submission (with signature audit log)
  const handleSave = async (sigName: string, sigBase64: string) => {
    if (!workspaceOwnerId) return;
    if (!selectedIngredient) {
      setMessage({ type: "error", text: "Select an item first." });
      return;
    }
    const qtyNum = parseFloat(inputQty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setMessage({ type: "error", text: "Enter a valid quantity." });
      return;
    }

    // Calculation logic
    const equivalentQty = convertInputToNativeQty(qtyNum, selectedUnit, selectedIngredient);
    const cleanNative = (selectedIngredient.unit || "lbs").toLowerCase().trim();
    const isLb = ["lb", "lbs", "pound", "pounds"].includes(cleanNative);

    const packagesToAdjust = equivalentQty;
    let displayCost = 0;

    if (selectedIngredient.pricePerGram) {
      const gramsAmt = isLb ? equivalentQty * 453.59237 : equivalentQty;
      displayCost = gramsAmt * selectedIngredient.pricePerGram;
    } else if (isLb && selectedIngredient.quantity) {
      displayCost = (equivalentQty / selectedIngredient.quantity) * selectedIngredient.price;
    } else {
      displayCost = (equivalentQty / (selectedIngredient.quantity || 1)) * selectedIngredient.price;
    }

    const currentStock = selectedIngredient.inStock !== undefined ? selectedIngredient.inStock : 0;
    
    setSubmitting(true);
    setMessage(null);

    const finalDepartment = department;
    const isDeduct = posMode === "deduct";

    if (!finalDepartment && isDeduct) {
      setMessage({ type: "error", text: "Please select a department." });
      setSubmitting(false);
      return;
    }

    try {
      const now = new Date();
      const createdAtIso = now.toISOString();
      const dateIso = createdAtIso.slice(0, 10);

      const consumptionRecord: Omit<ConsumptionLog, "id"> = {
        date: dateIso,
        vendorName: isDeduct 
          ? finalDepartment 
          : `INBOUND RECEIVING (${selectedIngredient.vendor || "Direct"})`,
        ingredientId: selectedIngredient.id!,
        ingredientName: selectedIngredient.name,
        quantity: isDeduct ? qtyNum : -qtyNum, // Negative consumption represents receiving
        unit: selectedUnit,
        pricePerPack: selectedIngredient.price,
        totalCost: isDeduct ? displayCost : -displayCost, // Negative cost representation for receipts
        recordedBy: sigName,
        operatorName: sigName,
        signatureBase64: sigBase64,
        ownerId: workspaceOwnerId,
        createdAt: createdAtIso
      };
      
      await safeAddDoc("inventory_consumptions", consumptionRecord);

      if (autoUpdateStock) {
        const newStock = isDeduct 
          ? Math.max(0, parseFloat((currentStock - packagesToAdjust).toFixed(4)))
          : parseFloat((currentStock + packagesToAdjust).toFixed(4));

        await onEditIngredient(selectedIngredient.id!, {
          inStock: newStock
        });
      }

      setMessage({ 
        type: "success", 
        text: isDeduct 
          ? `Used ${qtyNum} ${selectedUnit} of ${selectedIngredient.name}`
          : `Received ${qtyNum} ${selectedUnit} of ${selectedIngredient.name}`
      });

      setSelectedIngredient(null);
      setInputQty("");
      setDepartment("");
      setOperatorNameInput("");
      setShowSignaturePage(false);
      
      // Clear message after 3 secs
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
      setMessage({ type: "error", text: err.message || "Failed to save." });
    } finally {
      setSubmitting(false);
    }
  };

  if (showSignaturePage && selectedIngredient) {
    const isDeduct = posMode === "deduct";
    const qtyNum = parseFloat(inputQty) || 0;
    const equivalentQty = convertInputToNativeQty(qtyNum, selectedUnit, selectedIngredient);
    
    const currentStock = selectedIngredient.inStock !== undefined ? selectedIngredient.inStock : 0;
    const stockAfter = isDeduct
      ? Math.max(0, parseFloat((currentStock - equivalentQty).toFixed(4)))
      : parseFloat((currentStock + equivalentQty).toFixed(4));

    const remainingPoundInfo = calculatePoundData(
      stockAfter,
      selectedIngredient.unit,
      selectedIngredient.weightPerCase,
      selectedIngredient.weightPerCaseUnit,
      selectedIngredient.pcsPerPound,
      selectedIngredient.quantity
    );

    const remainingUnitsBreakdown = getMultiUnitBreakdown(stockAfter, selectedIngredient);
    const currentUnitsBreakdown = getMultiUnitBreakdown(currentStock, selectedIngredient);

    const calculatedCost = (() => {
      const cleanNative = (selectedIngredient.unit || "lbs").toLowerCase().trim();
      const isLb = ["lb", "lbs", "pound", "pounds"].includes(cleanNative);

      if (selectedIngredient.pricePerGram) {
        const gramsAmt = isLb ? equivalentQty * 453.59237 : equivalentQty;
        return gramsAmt * selectedIngredient.pricePerGram;
      } else if (isLb && selectedIngredient.quantity) {
        return (equivalentQty / selectedIngredient.quantity) * selectedIngredient.price;
      } else {
        return (equivalentQty / (selectedIngredient.quantity || 1)) * selectedIngredient.price;
      }
    })();

    const handleConfirmSignOff = () => {
      if (!operatorNameInput.trim()) {
        alert("Please write your name first.");
        return;
      }

      const canvas = canvasRef.current;
      let signatureData = "";
      if (canvas) {
        signatureData = canvas.toDataURL("image/png");
      }

      handleSave(operatorNameInput.trim(), signatureData);
    };

    return (
      <div className="fixed inset-0 z-50 bg-[#F4F4F5] flex flex-col font-sans overflow-hidden" id="pos-sign-off-page">
        {/* Sign-off Header */}
        <div className="bg-neutral-900 text-white flex items-center justify-between px-4 sm:px-6 py-4 shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSignaturePage(false)}
              className="p-1 hover:bg-neutral-800 rounded transition-colors text-neutral-400 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold font-mono text-emerald-400">
                {isDeduct ? "Consumption Sign-Off Verification" : "Stock Receipt Verification"}
              </h1>
              <p className="text-[10px] text-neutral-400 uppercase tracking-wider">Auditor Ledger Signature Step</p>
            </div>
          </div>
          <button
            onClick={() => setShowSignaturePage(false)}
            className="text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-white px-3 sm:px-4 py-2 rounded transition-colors cursor-pointer"
          >
            Cancel & Go Back
          </button>
        </div>

        {/* Layout split */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto md:overflow-hidden">
          {/* Left Column: Transaction details summary */}
          <div className="w-full md:w-[380px] bg-neutral-900 text-white p-5 sm:p-6 flex flex-col justify-between border-r border-neutral-800 overflow-y-auto shrink-0 max-h-[360px] md:max-h-none">
            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Transaction Summary</span>
                <div className="h-px bg-neutral-800 mt-1 mb-4"></div>
                <div className="bg-neutral-800/80 p-4 rounded-xl space-y-3 border border-neutral-700/50">
                  <div>
                    <label className="text-[10px] font-semibold text-neutral-400 uppercase block">Ingredient</label>
                    <span className="font-bold text-base text-emerald-400">{selectedIngredient.name}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-800">
                    <div>
                      <label className="text-[10px] font-semibold text-neutral-400 uppercase block">
                        Current On-Hand
                      </label>
                      <span className="font-mono font-bold text-neutral-200 text-xs sm:text-sm">
                        {currentStock} {selectedIngredient.unit || "pcs"}
                      </span>
                      {currentUnitsBreakdown.length > 1 && (
                        <div className="text-[10px] text-neutral-400 mt-0.5 space-y-0.5 font-mono">
                          {currentUnitsBreakdown.slice(1).map((b, i) => (
                            <div key={i}>• {b.qtyFormatted}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-neutral-400 uppercase block">
                        {isDeduct ? "Quantity Deducted" : "Quantity Received"}
                      </label>
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-white text-xs sm:text-sm">{inputQty} {selectedUnit}</span>
                        {selectedUnit.toLowerCase().trim() !== (selectedIngredient.unit || "lbs").toLowerCase().trim() && (
                          <span className="font-mono text-emerald-300 text-[10px]">
                            (~{equivalentQty.toFixed(2)} {selectedIngredient.unit || "lbs"})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stock Left After Deduction / New Balance Banner */}
                  <div className="pt-3 border-t border-neutral-700/80 bg-neutral-900/90 -mx-4 -mb-4 p-3.5 rounded-b-xl border-t border-emerald-500/40">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <label className="text-[10px] font-extrabold text-emerald-400 uppercase block tracking-wider">
                          {isDeduct ? "Stock Left After Deduction" : "New Balance After Receipt"}
                        </label>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="font-mono font-black text-emerald-300 text-base sm:text-lg">
                            {stockAfter} {selectedIngredient.unit || "pcs"}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <label className="text-[10px] font-semibold text-neutral-400 uppercase block">Value</label>
                        <span className="font-mono font-bold text-white text-sm">${calculatedCost.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Detailed Multi-Unit Remaining Balance Breakdown */}
                    {remainingUnitsBreakdown.length > 0 && (
                      <div className="mt-2.5 pt-2.5 border-t border-neutral-800/90 space-y-1.5">
                        <span className="text-[9px] font-extrabold text-neutral-400 uppercase tracking-wider block">
                          Stock Left By Unit:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {remainingUnitsBreakdown.map((item, idx) => (
                            <div 
                              key={idx} 
                              className="bg-neutral-800/95 border border-neutral-700/70 px-2.5 py-1.5 rounded-lg flex items-center justify-between"
                            >
                              <span className="text-[10px] font-semibold text-neutral-400">{item.unitLabel}:</span>
                              <span className="font-mono font-bold text-emerald-300 text-xs sm:text-sm">{item.qtyFormatted}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Ledger Meta</span>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-neutral-800">
                    <span className="text-neutral-400">Created At:</span>
                    <span className="font-mono font-bold text-neutral-200">
                      {new Date().toLocaleString(undefined, {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-neutral-800">
                    <span className="text-neutral-400">{isDeduct ? "Department:" : "Supplier Source:"}</span>
                    <span className="font-bold text-neutral-200">
                      {isDeduct 
                        ? department
                        : (selectedIngredient.vendor || "Direct Store / Manual")}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-neutral-800">
                    <span className="text-neutral-400">Storage Location:</span>
                    <span className="font-mono text-neutral-200">{selectedIngredient.location || "Default / Unassigned"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-emerald-950/45 border border-emerald-900 p-4 rounded-xl text-[11px] text-emerald-200 leading-relaxed mt-6">
              <span className="font-bold block text-emerald-400 mb-1">Stock Control Act</span>
              Federal kitchen and workspace cost control guidelines require a registered name & hand-drawn signature log to audit on-demand stock level adjustments.
            </div>
          </div>

          {/* Right Column: Signing Form */}
          <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto bg-white min-h-0">
            <div className="w-full max-w-xl mx-auto space-y-6 py-2">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-neutral-900 tracking-tight font-sans">Verify Identity & Draw Signature</h2>
                <p className="text-xs text-neutral-500">
                  Please write your legal name and draw your signature on the canvas below to authenticate this POS stock change.
                </p>
              </div>

              <div className="space-y-5">
                {/* 1. Operator / Signee Search Bar & Staff Selector */}
                <div className="space-y-2 relative" ref={staffSearchRef}>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                      1. Operator / Signee Full Name
                    </label>
                    {matchedStaff ? (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-sans">
                        <CheckCircle className="h-3 w-3 text-emerald-600" />
                        Registered Staff ({matchedStaff.role || "Staff"})
                      </span>
                    ) : allStaff.length > 0 ? (
                      <span className="text-[10px] font-medium text-neutral-400 font-sans">
                        {allStaff.length} registered staff in database
                      </span>
                    ) : null}
                  </div>

                  {/* Search Input Bar */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
                    <input
                      type="text"
                      required
                      value={operatorNameInput}
                      onChange={(e) => {
                        setOperatorNameInput(e.target.value);
                        setShowStaffDropdown(true);
                      }}
                      onFocus={() => setShowStaffDropdown(true)}
                      placeholder={allStaff.length > 0 ? "Search staff by name, role, or ID..." : "e.g. Chef John Smith"}
                      className="w-full text-base sm:text-sm border-2 border-neutral-300 rounded-xl pl-12 pr-10 py-3 bg-white text-neutral-900 font-bold focus:border-emerald-600 focus:outline-none transition-all shadow-2xs placeholder:text-neutral-400 placeholder:font-normal"
                    />
                    {operatorNameInput ? (
                      <button
                        type="button"
                        onClick={() => {
                          setOperatorNameInput("");
                          setShowStaffDropdown(true);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : (
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
                    )}

                    {/* Staff Dropdown Menu */}
                    {showStaffDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-neutral-200 rounded-2xl shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-neutral-100">
                        <div className="p-2.5 bg-neutral-50 text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex items-center justify-between border-b border-neutral-100">
                          <span>Database Staff Registry ({filteredStaff.length})</span>
                          <span className="text-[9px] text-neutral-400">Click staff member to select</span>
                        </div>
                        {filteredStaff.length > 0 ? (
                          filteredStaff.map((staff) => {
                            const isSelected = (staff.name || "").toLowerCase().trim() === operatorNameInput.toLowerCase().trim();
                            return (
                              <button
                                key={staff.id || staff.name}
                                type="button"
                                onClick={() => {
                                  setOperatorNameInput(staff.name);
                                  setShowStaffDropdown(false);
                                }}
                                className={`w-full text-left px-3.5 py-2.5 hover:bg-emerald-50/80 transition-colors flex items-center justify-between cursor-pointer ${
                                  isSelected ? "bg-emerald-50 border-l-4 border-emerald-500 font-bold" : ""
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center shrink-0">
                                    {(staff.name || "?").charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="text-xs font-bold text-neutral-900 leading-tight">
                                      {staff.name}
                                    </div>
                                    <div className="text-[10px] text-neutral-500 flex items-center gap-1.5 mt-0.5">
                                      {staff.role && <span className="bg-neutral-100 border border-neutral-200 px-1.5 py-0.2 rounded text-[9px] text-neutral-700">{staff.role}</span>}
                                      {staff.dept && <span className="text-neutral-400">• {staff.dept}</span>}
                                    </div>
                                  </div>
                                </div>

                                {staff.employeeCode && (
                                  <span className="text-[10px] font-mono text-neutral-400 bg-neutral-50 border border-neutral-200 px-1.5 py-0.5 rounded">
                                    #{staff.employeeCode}
                                  </span>
                                )}
                              </button>
                            );
                          })
                        ) : (
                          <div className="p-4 text-center text-xs text-neutral-500 space-y-1">
                            <p className="font-semibold text-neutral-700">No registered staff matching "{operatorNameInput}"</p>
                            <p className="text-[11px] text-neutral-400">You can still use this custom name or register staff in the Staff Directory.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quick-select Staff Chips */}
                  {allStaff.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">
                        Quick Select Registered Staff:
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                        {allStaff.slice(0, 8).map((staff) => {
                          const isSelected = (staff.name || "").toLowerCase().trim() === operatorNameInput.toLowerCase().trim();
                          return (
                            <button
                              key={staff.id || staff.name}
                              type="button"
                              onClick={() => {
                                setOperatorNameInput(staff.name);
                                setShowStaffDropdown(false);
                              }}
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                                isSelected
                                  ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                                  : "bg-white hover:bg-neutral-100 text-neutral-700 border-neutral-200"
                              }`}
                            >
                              <User className={`h-3 w-3 ${isSelected ? "text-white" : "text-emerald-600"}`} />
                              <span>{staff.name}</span>
                              {staff.role && <span className={`text-[9px] ${isSelected ? "text-emerald-200" : "text-neutral-400"}`}>({staff.role})</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Signature Drawing Canvas */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                      2. Hand-drawn Signature Pad
                    </label>
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="text-[11px] font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors border border-red-200"
                    >
                      <Eraser className="h-3 w-3" /> Clear Signature
                    </button>
                  </div>

                  <div className="relative border-2 border-dashed border-neutral-300 rounded-2xl bg-[#fafaf9] overflow-hidden group hover:border-emerald-500/50 transition-colors">
                    <canvas
                      ref={canvasRef}
                      width={550}
                      height={200}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-[200px] cursor-crosshair block bg-transparent"
                    />
                    <div className="absolute bottom-3 left-4 pointer-events-none text-[10px] text-neutral-400 select-none uppercase font-bold tracking-wider font-mono flex items-center gap-1.5">
                      <PenTool className="h-3 w-3 text-neutral-400" /> Use Mouse or Touch Screen to Draw Signature
                    </div>
                  </div>
                </div>

                {/* Submit Controls */}
                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setShowSignaturePage(false)}
                    className="flex-1 py-3.5 border-2 border-neutral-200 text-neutral-700 hover:bg-neutral-100 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Go Back to Selection
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSignOff}
                    disabled={!operatorNameInput.trim() || submitting}
                    className="flex-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs py-3.5 rounded-xl transition-colors border border-emerald-700 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Check className="h-4 w-4" />
                    {submitting ? "Saving Ledger..." : isDeduct ? "Confirm & Sign Consumption" : "Confirm & Sign Receipt"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleCameraCapture = async (base64Image: string) => {
    setIsProcessingCamera(true);
    try {
      const itemNames = ingredients.map(ing => ing.name);
      const res = await fetch("/api/ai/recognize-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Image, itemNames })
      });

      if (!res.ok) {
        throw new Error("Failed to recognize item");
      }

      const data = await res.json();
      if (data.recognizedName) {
        setSearchQuery(data.recognizedName);
        setShowCameraScanner(false);
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Camera recognition failed. Please try again." });
    } finally {
      setIsProcessingCamera(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F8F9FA] flex flex-col font-sans">
      {/* Top Navigation */}
      <div className="bg-emerald-600 text-white flex items-center justify-between px-6 py-4 shadow-xl shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Monitor className="h-6 w-6 text-emerald-400" />
            <h1 className="text-xl font-bold font-mono">
              {posMode === "deduct" && (language === "es" ? "Deducir Stock (POS)" : "POS Deduct Stock")}
              {posMode === "receive" && (language === "es" ? "Recibir Stock (POS)" : "POS Receive Stock")}
              {posMode === "add-item" && (language === "es" ? "Adición Catálogo (POS)" : "POS Catalog Addition")}
            </h1>
          </div>
          
          {posMode === "deduct" && (
            <div className="flex gap-3 items-center pl-6 border-l border-neutral-700">
              <button
                type="button"
                onClick={() => setShowDeptModal(true)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  !department
                    ? "bg-amber-500/25 border-amber-400 text-amber-200 animate-pulse font-extrabold"
                    : "bg-neutral-800 hover:bg-neutral-700 border-neutral-600 text-white"
                }`}
              >
                <MapPin className="h-4 w-4 text-emerald-400" />
                <span>
                  {department || (language === "es" ? "⚠️ Seleccionar Departamento" : "⚠️ Select Department")}
                </span>
                <ChevronDown className="h-4 w-4 opacity-70 ml-1" />
              </button>
            </div>
          )}

          {posMode === "receive" && (
            <div className="flex gap-4 items-center pl-6 border-l border-neutral-700">
              <span className="text-xs bg-emerald-800 px-3 py-1.5 font-mono font-bold text-emerald-150 uppercase tracking-wide">
                {language === "es" ? "Modo reabastecimiento" : "Stock replenishment mode"}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {/* Language Selection Toggle */}
          <div className="flex bg-emerald-800 rounded-lg p-0.5 border border-emerald-700 shadow-inner shrink-0">
            <button
              onClick={() => setLanguage("en")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                language === "en"
                  ? "bg-white text-emerald-900 shadow-sm font-black"
                  : "text-emerald-200 hover:text-white"
              }`}
            >
              🇺🇸 EN
            </button>
            <button
              onClick={() => setLanguage("es")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                language === "es"
                  ? "bg-white text-emerald-900 shadow-sm font-black"
                  : "text-emerald-200 hover:text-white"
              }`}
            >
              🇪🇸 ES
            </button>
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded transition-colors font-bold text-sm"
          >
            <X className="h-4 w-4" /> {language === "es" ? "Salir de POS" : "Exit POS Mode"}
          </button>
        </div>
      </div>

      {/* Mode Segmented Controls Bar */}
      <div className="bg-neutral-900 text-white flex items-center justify-between px-6 py-3 border-b border-neutral-800 shadow-md shrink-0">
        <div className="flex gap-2">
          <button
            onClick={() => {
              setPosMode("deduct");
              setSelectedIngredient(null);
              setInputQty("");
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              posMode === "deduct"
                ? "bg-red-600 text-white shadow-md shadow-red-900/30"
                : "bg-neutral-850 text-neutral-400 hover:bg-neutral-800 hover:text-white"
            }`}
          >
            <TrendingDown className="h-4 w-4" />
            {language === "es" ? "Deducir Stock (Consumo)" : "Deduct Stock (Consumption)"}
          </button>
          
          {!isReadOnly && (
            <>
              <button
                onClick={() => {
                  setPosMode("receive");
                  setSelectedIngredient(null);
                  setInputQty("");
                }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  posMode === "receive"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30"
                    : "bg-neutral-850 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                {language === "es" ? "Recibir Stock (Aumento)" : "Receive Stock (Increase)"}
              </button>

              <button
                onClick={() => {
                  setPosMode("add-item");
                  setSelectedIngredient(null);
                  setInputQty("");
                }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  posMode === "add-item"
                    ? "bg-amber-600 text-white shadow-md shadow-amber-900/30"
                    : "bg-neutral-850 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                }`}
              >
                <Plus className="h-4 w-4" />
                {language === "es" ? "Nuevo Artículo (Catálogo)" : "Add New Item (Catalog)"}
              </button>
            </>
          )}
        </div>
        
        <div className="text-[10px] font-mono text-neutral-500 font-bold uppercase tracking-wider">
          {language === "es" ? "Cliente de Tablet de Costos" : "Culinary Cost Tablet Client"}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Render standard layout for Deduct and Receive modes */}
        {posMode !== "add-item" && (
          <>
            {/* Left column: Categories & Items */}
            <div className="flex-1 flex flex-col border-r border-neutral-300 bg-white">
              <div className="p-4 border-b border-neutral-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-neutral-50 shadow-sm z-10">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
                  <input 
                    type="text" 
                    placeholder={language === "es" ? "Buscar ingredientes... (bilingüe)" : "Search ingredients..."}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 bg-white border border-neutral-300 rounded-xl text-base focus:ring-2 focus:ring-[#141414] focus:outline-none shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCameraScanner(true)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-emerald-600 transition-colors bg-white rounded-lg"
                    title={language === "es" ? "Escanear con cámara" : "Scan with camera"}
                  >
                    <Camera className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Category Filter */}
                  <div className="relative">
                    <Grid className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600 pointer-events-none" />
                    <select
                      value={selectedCategory}
                      onChange={e => setSelectedCategory(e.target.value)}
                      className="pl-9 pr-10 py-3 bg-white border border-neutral-300 text-neutral-800 font-bold rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none cursor-pointer appearance-none shadow-sm min-w-[140px]"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>
                          {cat === "All Categories" 
                            ? (language === "es" ? "📁 Todas las categorías" : "📁 All Categories") 
                            : `📁 ${cat}`}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-neutral-500">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                      </svg>
                    </div>
                  </div>

                  {/* Location Filter */}
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600 pointer-events-none" />
                    <select
                      value={selectedLocation}
                      onChange={e => setSelectedLocation(e.target.value)}
                      className="pl-9 pr-10 py-3 bg-white border border-neutral-300 text-neutral-800 font-bold rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none cursor-pointer appearance-none shadow-sm"
                    >
                      {locations.map(loc => (
                        <option key={loc} value={loc}>
                          {loc === "All Locations" 
                            ? (language === "es" ? "📍 Todas las ubicaciones" : "📍 All Locations") 
                            : `📍 ${loc}`}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-neutral-500">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                      </svg>
                    </div>
                  </div>

                  {isTranslating && (
                    <div className="text-[10px] font-bold text-neutral-500 animate-pulse font-mono shrink-0 bg-neutral-100 px-2 py-1 rounded">
                      Translating...
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-neutral-100">
                {filteredIngredients.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-neutral-400">
                    <SearchX className="h-12 w-12 mb-4" />
                    <p className="text-lg font-bold">
                      {language === "es" ? "No se encontraron artículos" : "No items found"}
                    </p>
                    <p className="text-xs text-neutral-500 max-w-xs text-center mt-1">
                      {posMode === "deduct" 
                        ? (language === "es" 
                            ? "Solo los artículos con stock se muestran en el modo Deducir. Cambie a Recibir para agregar stock." 
                            : "Only items currently in-stock are shown in Deduct mode. Switch to Receive mode to manage catalog items with zero stock.") 
                        : (language === "es"
                            ? "Intente ajustar sus filtros de búsqueda o agregue un nuevo artículo."
                            : "Try adjusting your search filters or add a new item to catalog.")}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredIngredients.map(ing => (
                      <button
                        key={ing.id}
                        onClick={() => {
                          setSelectedIngredient(ing);
                          setInputQty("");
                          if (!department && posMode === "deduct") {
                            setShowDeptModal(true);
                          }
                        }}
                        className={`text-left p-4 rounded-xl border-2 transition-all shadow-sm flex flex-col justify-between min-h-[120px] cursor-pointer ${
                          selectedIngredient?.id === ing.id
                            ? posMode === "deduct"
                              ? "border-red-500 bg-red-50 shadow-md transform scale-[1.02]"
                              : "border-emerald-500 bg-emerald-50 shadow-md transform scale-[1.02]"
                            : "border-transparent bg-white hover:border-neutral-300 hover:shadow"
                        }`}
                      >
                        <div>
                          <div className="font-bold text-neutral-900 leading-tight line-clamp-2 text-base">
                            {getIngredientDisplayName(ing)}
                          </div>
                          <div className="text-xs text-neutral-500 font-mono mt-2 flex flex-wrap gap-1.5 items-center">
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" /> {ing.location || "Unassigned"}
                            </span>
                            {ing.category && (
                              <span className="text-[9px] text-amber-800 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                                {ing.category}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <div className="text-xs font-bold text-neutral-700 bg-neutral-150 px-2 py-0.5 rounded">
                            {ing.quantity} {ing.unit}
                          </div>
                          <div className={`text-xs font-mono font-bold ${ing.inStock === 0 || ing.inStock === undefined ? 'text-red-700' : 'text-neutral-500'}`}>
                            {getStockDisplay(ing)}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right column: Current Ticket / Numpad */}
            <div className="w-[380px] flex flex-col bg-white shadow-xl z-20 overflow-hidden shrink-0">
              <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex-1 flex flex-col justify-between overflow-y-auto">
                <div>
                  <h2 className="text-xs font-bold text-neutral-500 mb-3 flex items-center gap-1.5">
                    <Calculator className="h-3.5 w-3.5" /> 
                    {posMode === "deduct" 
                      ? (language === "es" ? "Deducir Cantidad" : "Deduct Quantity") 
                      : (language === "es" ? "Recibir Cantidad" : "Receive Quantity")}
                  </h2>

                  {!selectedIngredient ? (
                    <div className="h-32 flex flex-col items-center justify-center text-neutral-300 border-2 border-dashed border-neutral-200 rounded-xl">
                      <Grid className="h-8 w-8 mb-1.5" />
                      <p className="text-xs font-bold">
                        {language === "es" ? "Seleccione un artículo de la izquierda" : "Select an item from left"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className={`p-3 rounded-lg shadow-md transition-all ${
                        posMode === "deduct" ? "bg-red-700 text-white" : "bg-emerald-600 text-white"
                      }`}>
                        <h3 className="font-bold text-base leading-tight mb-1 truncate">
                          {getIngredientDisplayName(selectedIngredient)}
                        </h3>
                        <p className="font-mono text-white/70 text-xs mb-2">
                          {language === "es" ? "Stock Actual" : "Current Stock"}: {getStockDisplay(selectedIngredient)}
                        </p>
                        
                        <div className="bg-white/10 rounded-md p-1.5 flex flex-col items-center justify-center min-h-[50px]">
                          <div className="text-3xl font-mono font-bold">
                            {inputQty || "0"}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <label className="block text-[10px] font-bold text-neutral-500">
                              {language === "es" ? "Unidad de Medida" : "Unit of Measure"}
                            </label>
                            {hiddenUnits.length > 0 && (
                              <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                {allAvailableUnits.filter(u => hiddenUnits.some(hu => hu.toLowerCase() === u.toLowerCase())).length} {language === "es" ? "ocultas" : "hidden"}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setShowHideUnitSelector(true)}
                            className={`text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer border ${
                              hiddenUnits.length > 0
                                ? "text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-300"
                                : "text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border-neutral-300"
                            }`}
                            title={language === "es" ? "Abrir ventana para elegir unidades" : "Open pop-up to choose units"}
                            id="pos-hide-unit-btn"
                          >
                            {hiddenUnits.length > 0 ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                            <span>
                              {hiddenUnits.length > 0
                                ? (language === "es" ? `Unidades (${hiddenUnits.length} ocultas)` : `Units (${hiddenUnits.length} hidden)`)
                                : (language === "es" ? "Elegir / Ocultar" : "Hide / Show units")}
                            </span>
                          </button>
                        </div>

                        {/* Visible Units Button Grid */}
                        {visibleUnits.length > 0 ? (
                          <div className={`grid gap-1.5 ${visibleUnits.length > 2 ? "grid-cols-3" : "grid-cols-2"}`}>
                            {visibleUnits.map(u => {
                              return (
                                <button
                                  key={u}
                                  onClick={() => setSelectedUnit(u)}
                                  className={`py-2 px-1 rounded font-bold text-xs transition-colors capitalize text-center truncate ${
                                    selectedUnit === u
                                      ? "bg-neutral-800 text-white cursor-pointer"
                                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 cursor-pointer"
                                  }`}
                                  title={u}
                                >
                                  {u}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-center space-y-1.5">
                            <p className="text-[10px] text-neutral-500 font-bold">
                              {language === "es" ? "Todas las unidades están ocultas para este producto." : "All units are hidden for this item."}
                            </p>
                            <button
                              type="button"
                              onClick={() => setShowHideUnitSelector(true)}
                              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-lg cursor-pointer inline-flex items-center gap-1"
                            >
                              <Eye className="h-3 w-3" />
                              <span>{language === "es" ? "Elegir unidades para mostrar" : "Choose units to display"}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-white space-y-3 shrink-0 border-t border-neutral-100">
                {/* Numpad */}
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {["7", "8", "9", "4", "5", "6", "1", "2", "3", "C", "0", "."].map(btn => (
                    <button
                      key={btn}
                      disabled={!selectedIngredient}
                      onClick={() => handleNumClick(btn)}
                      className={`h-11 text-xl font-bold font-mono rounded-lg transition-colors cursor-pointer ${
                        !selectedIngredient 
                          ? "bg-neutral-50 text-neutral-300 cursor-not-allowed"
                          : btn === "C"
                            ? "bg-red-100 text-red-600 hover:bg-red-200"
                            : "bg-neutral-100 text-neutral-800 hover:bg-neutral-200 active:bg-neutral-300"
                      }`}
                    >
                      {btn}
                    </button>
                  ))}
                  <div className="col-span-3 grid grid-cols-2 gap-2 mt-1">
                    <button
                      disabled={!selectedIngredient}
                      onClick={() => handleNumClick("DEL")}
                      className="h-10 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer"
                    >
                      Delete
                    </button>
                    <div className="flex items-center gap-1.5 justify-center">
                      <input
                        type="checkbox"
                        id="autoUpdateTablet"
                        checked={autoUpdateStock}
                        onChange={e => setAutoUpdateStock(e.target.checked)}
                        className="w-3.5 h-3.5 text-emerald-600 focus:ring-emerald-500 rounded border-neutral-300 cursor-pointer"
                      />
                      <label htmlFor="autoUpdateTablet" className="text-[9px] font-bold text-neutral-500 cursor-pointer">
                        {posMode === "deduct" ? "Auto-Deduct" : "Auto-Update"}
                      </label>
                    </div>
                  </div>
                </div>

                <button
                  disabled={!selectedIngredient || !inputQty || submitting}
                  onClick={() => {
                    const qtyNum = parseFloat(inputQty);
                    if (isNaN(qtyNum) || qtyNum <= 0) {
                      setMessage({ type: "error", text: "Enter a valid quantity." });
                      return;
                    }
                    const finalDepartment = department;
                    if (!finalDepartment && posMode === "deduct") {
                      setMessage({ type: "error", text: "Please select a department first." });
                      setShowDeptModal(true);
                      return;
                    }
                    setOperatorNameInput("");
                    setShowSignaturePage(true);
                  }}
                  className={`w-full h-11 rounded-lg flex items-center justify-center gap-1.5 text-sm font-bold transition-all cursor-pointer ${
                    !selectedIngredient || !inputQty || submitting
                      ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                      : posMode === "deduct"
                        ? "bg-red-600 hover:bg-red-700 text-white shadow-md active:scale-[0.98]"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-[0.98]"
                  }`}
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>{posMode === "deduct" ? "Record Consumption" : "Record Receipt / Inbound"}</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Render New Catalog Item quick form */}
        {posMode === "add-item" && (
          <div className="flex-1 flex items-center justify-center bg-neutral-100 p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-neutral-200 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden"
            >
              <div className="bg-amber-600 text-white px-6 py-4 flex items-center gap-3">
                <PlusCircle className="h-6 w-6 text-amber-200" />
                <div>
                  <h2 className="text-base font-bold font-mono text-white">Create Brand-New Inventory Item</h2>
                  <p className="text-[10px] text-amber-100 uppercase tracking-wider font-semibold">Tablet Catalog Quick Add</p>
                </div>
              </div>
              
              <form onSubmit={handleAddNewItemSubmit} className="p-6 space-y-5 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Item Name */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Item Name / Description <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newItemName}
                      onChange={e => setNewItemName(e.target.value)}
                      placeholder="e.g. skinless pork belly, sliced prime flank steak"
                      className="w-full text-sm border border-neutral-300 rounded-xl px-4 py-3 bg-[#fafaf9] focus:bg-white focus:border-amber-500 focus:outline-none transition-all font-semibold text-neutral-800"
                    />
                  </div>

                  {/* Supplier / Vendor */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Supplier / Vendor
                    </label>
                    <select
                      value={newItemVendor}
                      onChange={e => setNewItemVendor(e.target.value)}
                      className="w-full text-sm border border-neutral-300 rounded-xl px-4 py-3 bg-[#fafaf9] focus:bg-white focus:border-amber-500 focus:outline-none transition-all font-semibold text-neutral-800 cursor-pointer"
                    >
                      <option value="unassigned">-- Unassigned / No Supplier --</option>
                      {vendorsList.map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>

                  {/* Item Category */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Item Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={newItemCategory}
                      onChange={e => setNewItemCategory(e.target.value)}
                      className="w-full text-sm border border-neutral-300 rounded-xl px-4 py-3 bg-[#fafaf9] focus:bg-white focus:border-amber-500 focus:outline-none transition-all font-semibold text-neutral-800 cursor-pointer"
                    >
                      <option value="Meat">🥩 Meat</option>
                      <option value="Vegetables">🥦 Vegetables</option>
                      <option value="Fruit">🍎 Fruit</option>
                      <option value="Bread">🍞 Bread</option>
                      <option value="Seafood">🐟 Seafood</option>
                      <option value="Dairy">🥛 Dairy</option>
                      <option value="Dry Goods">🌾 Dry Goods</option>
                      <option value="Beverages">🥤 Beverages</option>
                      <option value="Other">🍽️ Other / Something else</option>
                    </select>
                  </div>

                  {/* Storage Location */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Storage Location
                    </label>
                    <select
                      value={newItemLocation}
                      onChange={e => setNewItemLocation(e.target.value)}
                      className="w-full text-sm border border-neutral-300 rounded-xl px-4 py-3 bg-[#fafaf9] focus:bg-white focus:border-amber-500 focus:outline-none transition-all font-semibold text-neutral-800 cursor-pointer"
                    >
                      <option value="Walk-In Cooler">❄️ Walk-In Cooler</option>
                      <option value="Freezer">🥶 Freezer</option>
                      <option value="Dry Storage">📦 Dry Storage</option>
                      <option value="Bar Storage">🍹 Bar Storage</option>
                      <option value="Bakery Rack">🥖 Bakery Rack</option>
                      <option value="Line Station">🍳 Line Station</option>
                    </select>
                  </div>

                  {/* Base Unit Price */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Base Unit Price ($) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-neutral-400 text-sm">$</span>
                      <input
                        type="number"
                        step="any"
                        required
                        min="0"
                        value={newItemPrice}
                        onChange={e => setNewItemPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full text-sm border border-neutral-300 rounded-xl pl-8 pr-4 py-3 bg-[#fafaf9] focus:bg-white focus:border-amber-500 focus:outline-none transition-all font-semibold font-mono text-neutral-800"
                      />
                    </div>
                  </div>

                  {/* Pack Size Quantity */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                        Pack Amount
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0.001"
                        required
                        value={newItemPackQty}
                        onChange={e => setNewItemPackQty(e.target.value)}
                        className="w-full text-sm border border-neutral-300 rounded-xl px-4 py-3 bg-[#fafaf9] focus:bg-white focus:border-amber-500 focus:outline-none transition-all font-semibold font-mono text-neutral-800"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                        Unit
                      </label>
                      <select
                        required
                        value={newItemUnit}
                        onChange={e => setNewItemUnit(e.target.value)}
                        className="w-full text-sm border border-neutral-300 rounded-xl px-4 py-3 bg-[#fafaf9] focus:bg-white focus:border-amber-500 focus:outline-none transition-all font-semibold text-neutral-800"
                      >
                        <option value="" disabled>Select...</option>
                        <option value="lb">lb</option>
                        <option value="g">gram</option>
                        <option value="gal">gal</option>
                        <option value="ml">ml</option>
                        <option value="oz">oz</option>
                        <option value="pcs">pcs</option>
                      </select>
                    </div>
                  </div>

                  {/* Initial Stock */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Initial Stock Level (Packs)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={newInitialStock}
                      onChange={e => setNewInitialStock(e.target.value)}
                      placeholder="0"
                      className="w-full text-sm border border-neutral-300 rounded-xl px-4 py-3 bg-[#fafaf9] focus:bg-white focus:border-amber-500 focus:outline-none transition-all font-semibold font-mono text-neutral-800"
                    />
                  </div>

                  {/* Min Stock Warning */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Minimum Stock Limit (Alert)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={newMinStock}
                      onChange={e => setNewMinStock(e.target.value)}
                      placeholder="0"
                      className="w-full text-sm border border-neutral-300 rounded-xl px-4 py-3 bg-[#fafaf9] focus:bg-white focus:border-amber-500 focus:outline-none transition-all font-semibold font-mono text-neutral-800"
                    />
                  </div>

                </div>

                <div className="pt-4 flex gap-3 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setPosMode("receive")}
                    className="flex-1 py-3 border border-neutral-300 rounded-xl hover:bg-neutral-50 text-xs font-bold transition-all text-neutral-700 text-center cursor-pointer"
                  >
                    Cancel & Go Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold py-3 rounded-xl transition-all border border-amber-700 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <PlusCircle className="h-4 w-4" />
                    {submitting ? "Creating Item..." : "Create Inventory Item"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {message && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-max max-w-[500px] z-50">
            <div className={`px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 font-bold ${
              message.type === "success" 
                ? "bg-emerald-900 text-emerald-50" 
                : "bg-red-900 text-red-50"
            }`}>
              {message.type === "success" ? <CheckCircle className="h-5 w-5" /> : <X className="h-5 w-5" />}
              {message.text}
            </div>
          </div>
        )}

        {showCameraScanner && (
          <CameraScanner
            onCapture={handleCameraCapture}
            onClose={() => setShowCameraScanner(false)}
            isProcessing={isProcessingCamera}
            language={language}
          />
        )}

        {/* Automatic Department Selection Modal on POS Entry */}
        {showDeptModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-lg overflow-hidden flex flex-col"
            >
              <div className="bg-emerald-700 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <MapPin className="h-6 w-6 text-emerald-300" />
                  <div>
                    <h2 className="text-base font-bold font-mono text-white">
                      {language === "es" ? "Seleccionar Departamento de POS" : "Select Operating Department"}
                    </h2>
                    <p className="text-[10px] text-emerald-200 uppercase tracking-wider font-semibold">
                      {language === "es" ? "Requerido para registro de consumo POS" : "Required for POS Consumption Audit Ledger"}
                    </p>
                  </div>
                </div>
                {department && (
                  <button
                    type="button"
                    onClick={() => setShowDeptModal(false)}
                    className="p-1 text-emerald-200 hover:text-white rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>

              <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
                <div>
                  <label className="text-xs font-bold text-neutral-700 block mb-3">
                    {language === "es" ? "Seleccione un Departamento Registrado:" : "Select Registered Operating Department:"}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {deptOptions.map(deptName => {
                      const isSelected = department === deptName;
                      return (
                        <button
                          key={deptName}
                          type="button"
                          onClick={() => {
                            setDepartment(deptName);
                            setShowDeptModal(false);
                          }}
                          className={`px-3.5 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? "bg-emerald-600 text-white shadow-md border-2 border-emerald-700"
                              : "bg-neutral-100 hover:bg-emerald-50 hover:text-emerald-700 text-neutral-800 border border-neutral-200"
                          }`}
                        >
                          <span className="truncate">{deptName}</span>
                          {isSelected && <Check className="h-4 w-4 shrink-0 ml-1 text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!department) {
                      alert("Please select a registered department.");
                      return;
                    }
                    setShowDeptModal(false);
                  }}
                  disabled={!department}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  {language === "es" ? "Confirmar Departamento" : "Confirm Department & Enter POS"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Unit Visibility Pop-Up Modal */}
        {showHideUnitSelector && selectedIngredient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[85vh] text-left"
            >
              {/* Header */}
              <div className="px-6 py-4 bg-neutral-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <SlidersHorizontal className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-mono text-white">
                      {language === "es" ? "Elegir Unidades de Medida" : "Choose Units of Measure"}
                    </h3>
                    <p className="text-xs text-neutral-300">
                      {language === "es"
                        ? `Seleccionar unidades para ${selectedIngredient.name}`
                        : `Select visible units for ${selectedIngredient.name}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHideUnitSelector(false)}
                  className="p-1.5 text-neutral-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Status & Quick Actions Bar */}
              <div className="px-6 py-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
                <div className="text-xs text-neutral-600 font-semibold flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>
                    {allAvailableUnits.filter(u => !hiddenUnits.some(hu => hu.toLowerCase() === u.toLowerCase())).length} of {allAvailableUnits.length} {language === "es" ? "unidades visibles" : "units visible"}
                  </span>
                </div>
                {hiddenUnits.some(hu => allAvailableUnits.some(u => u.toLowerCase() === hu.toLowerCase())) && (
                  <button
                    type="button"
                    onClick={unhideAllUnits}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    {language === "es" ? "Mostrar todas" : "Show All Units"}
                  </button>
                )}
              </div>

              {/* Unit Choice List */}
              <div className="p-6 overflow-y-auto space-y-2.5 flex-1">
                <p className="text-xs text-neutral-500 font-medium mb-1">
                  {language === "es"
                    ? "Haga clic en una unidad para mostrarla u ocultarla del teclado numérico:"
                    : "Tap any unit below to toggle between visible and hidden:"}
                </p>

                {allAvailableUnits.map((u) => {
                  const isHidden = hiddenUnits.some(hu => hu.toLowerCase() === u.toLowerCase());
                  const isNative = u.toLowerCase() === (selectedIngredient.unit || "lb").toLowerCase();
                  const isPkg = selectedIngredient.packagingUnit && u.toLowerCase() === selectedIngredient.packagingUnit.toLowerCase();
                  const isConv = selectedIngredient.conversions?.some(c => c.targetUnit?.toLowerCase() === u.toLowerCase());

                  return (
                    <div
                      key={u}
                      onClick={() => toggleHideUnit(u)}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer select-none ${
                        isHidden
                          ? "bg-neutral-50 border-neutral-200 opacity-60 text-neutral-400"
                          : "bg-white border-neutral-300 text-neutral-900 shadow-xs hover:border-emerald-500"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-lg flex items-center justify-center border text-xs font-bold transition-colors ${
                            !isHidden
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "border-neutral-300 bg-neutral-200 text-transparent"
                          }`}
                        >
                          {!isHidden && <Check className="h-3.5 w-3.5 text-white stroke-[3]" />}
                        </div>
                        <div>
                          <div className="font-mono text-sm font-bold capitalize flex items-center gap-2">
                            <span>{u}</span>
                            {selectedUnit.toLowerCase() === u.toLowerCase() && !isHidden && (
                              <span className="text-[9px] font-sans font-bold bg-neutral-800 text-white px-1.5 py-0.2 rounded">
                                {language === "es" ? "Seleccionada" : "Active"}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-500">
                            {isNative
                              ? (language === "es" ? "Unidad Base / Nativa" : "Base / Native Unit")
                              : isPkg
                              ? (language === "es" ? "Unidad de Empaque (Caja)" : "Packaging Unit (Case)")
                              : isConv
                              ? (language === "es" ? "Unidad de Conversión" : "Conversion Unit")
                              : (language === "es" ? "Unidad Estándar" : "Standard Unit")}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isHidden ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-500 bg-neutral-200/80 px-2.5 py-1 rounded-lg">
                            <EyeOff className="h-3 w-3" />
                            <span>{language === "es" ? "Oculta" : "Hidden"}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                            <Eye className="h-3 w-3" />
                            <span>{language === "es" ? "Visible" : "Visible"}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={unhideAllUnits}
                  className="text-xs font-bold text-neutral-600 hover:text-neutral-900 px-3 py-2 rounded-xl hover:bg-neutral-200 transition-colors cursor-pointer"
                >
                  {language === "es" ? "Restablecer todas" : "Reset all"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowHideUnitSelector(false)}
                  className="bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>{language === "es" ? "Listo" : "Done"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

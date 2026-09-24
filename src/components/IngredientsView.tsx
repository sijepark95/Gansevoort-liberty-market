import React, { useState, useMemo } from "react";
import { Ingredient, Vendor, Invoice, GroceryPurchase } from "../../src/types";
import { Plus, Edit2, Trash2, Search, Sparkles, PlusCircle, Save, X, Calendar, AlertTriangle, CheckSquare, Download, Lock, DollarSign, History } from "lucide-react";
import { getGramsOrMlEquivalent, convertFromGrams, calculateIngredientUnitPrice, MASS_VOLUME_UNITS } from "../lib/unitConverter";

import AIAssistantModal from "./AIAssistantModal";
import { BulkPriceUpdateModal } from "./BulkPriceUpdateModal";
import { PurchaseHistoryModal } from "./PurchaseHistoryModal";



export function recommendUsabilityPercentage(name: string): { percentage: number; reason: string } {
  const n = name.trim().toLowerCase();
  if (!n) return { percentage: 100, reason: "Enter an ingredient name to see recommendations." };
  
  if (/\b(apple|peaches?|pears?|fruits?|melon|pineapple|banana|orange|lemon|lime|grapes?|berries|berry|strawberry|cherry|flesh|avocado|mango|plum|peach)\b/.test(n)) {
    return { percentage: 75, reason: "Fruit with peel, seeds, stone, core, or stem waste (avg. 75% usable yield)." };
  }
  if (/\b(potato|onion|carrot|garlic|ginger|shallot|beet|turnip|radish|parsnip|tubers?|root|sweet\s+potato|yam)\b/.test(n)) {
    return { percentage: 80, reason: "Root vegetable requiring peeling and trimming ends (avg. 80% usable yield)." };
  }
  if (/\b(lettuce|cabbage|spinach|kale|chard|greens?|arugula|leaves|leaf|salad|parsley|cilantro|basil|herb|thyme|rosemary|mint|dill)\b/.test(n)) {
    return { percentage: 80, reason: "Leafy greens or fresh herbs with stems and outer leaf waste (avg. 80% usable yield)." };
  }
  if (/\b(broccoli|cauliflower|brussel|cucumbers?|peppers?|bell\s+pepper|squash|zucchini|eggplant|celery|asparagus|tomatoes?|leek|scallion|green\s+onion)\b/.test(n)) {
    return { percentage: 85, reason: "Vegetable requiring seed de-pithing, stalk removal, or tip trimming (avg. 85% usable yield)." };
  }
  if (/\b(fish|salmon|tuna|cod|halibut|shrimp|prawn|lobster|crab|fillet|seafood|clam|oyster|mussel|scallop|snapper|sea\s+bass)\b/.test(n)) {
    return { percentage: 70, reason: "Seafood involving bone, shell, tail, head trimming or cooking shrinkage (avg. 70% usable yield)." };
  }
  if (/\b(chicken|beef|pork|lamb|turkey|meat|steak|rib|ribeye|tenderloin|breast|wing|drumstick|poultry|shanks?|chops?|bacon|veal|ground\s+beef)\b/.test(n)) {
    return { percentage: 78, reason: "Meat requiring bone-out, gristle/fat de-trim, and cooking shrinkage (avg. 78% usable yield)." };
  }
  if (/\b(rice|flour|sugar|salt|oil|butter|ghee|fat|beans?|lentils?|grain|pasta|oats|milk|cream|eggs?|vinegar|sauce|mayo|ketchup|mustard|spice|powder|water|dry|margarine|shortening)\b/.test(n)) {
    return { percentage: 100, reason: "Pristine dry good, pantry essential, liquid, or fat with virtually no prep waste (100% usable)." };
  }
  if (/\b(canned|can|puree|paste|diced|crushed|pickles?|olives?)\b/.test(n)) {
    return { percentage: 95, reason: "Canned or pre-processed ingredient with minor residual tin waste (95% usable)." };
  }
  return { percentage: 100, reason: "Standard parsed item (suggested 100% yield as default base)." };
}

export function getIngredientVendor(ing: Ingredient) {
  let rawVendor = "";
  if (ing.vendor && ing.vendor.trim().length > 0) {
    rawVendor = ing.vendor.trim();
  } else if (ing.source && ing.source.includes("(")) {
    const parts = ing.source.split("(");
    if (parts.length > 1) {
      const v = parts[1].replace(")", "").trim();
      if (v) rawVendor = v;
    }
  }
  return rawVendor || "Unknown / Manual";
}

export function getIngredientStandardRate(ing: {
  unit: string;
  price: number;
  quantity: number;
  pricePerGram: number;
  weightPerCase?: number;
  weightPerCaseUnit?: string;
  pcsPerPound?: number;
  conversions?: Array<{ ratio: number; targetUnit: string }>;
}) {
  const cleanUnit = (ing.unit || "g").toLowerCase().trim();
  const isDiscrete = !MASS_VOLUME_UNITS.includes(cleanUnit);
  const isPiece = ["pcs", "pc", "ea", "each", "piece", "pieces", "ct", "count"].includes(cleanUnit);

  const baseRate = calculateIngredientUnitPrice(ing);

  const hasEquivWeight = isDiscrete && ing.weightPerCase && ing.weightPerCase > 0;

  if (hasEquivWeight && ing.weightPerCaseUnit) {
    const wUnit = ing.weightPerCaseUnit.toLowerCase().trim();
    const factor = getGramsOrMlEquivalent(1, wUnit);
    return { rateVal: baseRate * factor, unitLabel: wUnit };
  }

  if (isPiece) {
    return { rateVal: baseRate, unitLabel: ing.unit || "pcs" };
  }

  if (ing.pcsPerPound && ing.pcsPerPound > 0 && isDiscrete) {
    return { rateVal: baseRate, unitLabel: "pcs" };
  }

  if (isDiscrete) {
    return { rateVal: baseRate, unitLabel: ing.unit || "pcs" };
  }

  const factor = getGramsOrMlEquivalent(1, cleanUnit);
  return { rateVal: baseRate * factor, unitLabel: cleanUnit };
}

interface IngredientsViewProps {
  ingredients: Ingredient[];
  vendors?: Vendor[];
  invoices?: Invoice[];
  groceryPurchases?: GroceryPurchase[];
  onAddIngredient: (ing: Omit<Ingredient, "id" | "ownerId" | "updatedAt">) => Promise<void>;
  onEditIngredient: (id: string, ing: Partial<Ingredient>) => Promise<void>;
  onDeleteIngredient: (id: string) => Promise<void>;
  onBulkDeleteIngredients?: (ids: string[]) => Promise<void>;
  onMatchAndMergeIngredients?: (masterId: string, mergeIds: string[]) => Promise<void>;
  isReadOnly?: boolean;
}

export default function IngredientsView({
  ingredients,
  vendors = [],
  invoices = [],
  groceryPurchases = [],
  onAddIngredient,
  onEditIngredient,
  onDeleteIngredient,
  onBulkDeleteIngredients,
  onMatchAndMergeIngredients,
  isReadOnly = false,
}: IngredientsViewProps) {
  const [selectedMergeIds, setSelectedMergeIds] = useState<string[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showHistoryId, setShowHistoryId] = useState<string | null>(null);
  
  // Database Match Action States
  
  
  
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDeleteId, setItemToDeleteId] = useState<string | null>(null);
  const [showDeDupConfirm, setShowDeDupConfirm] = useState(false);

  // Add form state
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("lbs");
  const [source, setSource] = useState("Default / Unassigned");
  const [weightPerCase, setWeightPerCase] = useState("");
  const [weightPerCaseUnit, setWeightPerCaseUnit] = useState("lb");
  const [pcsPerPound, setPcsPerPound] = useState("");
  const [packagingUnit, setPackagingUnit] = useState("Box");
  const [conversions, setConversions] = useState<{ratio: string, targetUnit: string}[]>([]);
  const [usabilityPercentage, setUsabilityPercentage] = useState("100");
  const [category, setCategory] = useState("Meat");

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editRateValue, setEditRateValue] = useState("");
  const [editRateUnit, setEditRateUnit] = useState("g");
  const [editWeightPerCase, setEditWeightPerCase] = useState("");
  const [editWeightPerCaseUnit, setEditWeightPerCaseUnit] = useState("lb");
  const [editPcsPerPound, setEditPcsPerPound] = useState("");
  const [editPackagingUnit, setEditPackagingUnit] = useState("Box");
  const [editConversions, setEditConversions] = useState<{ratio: string, targetUnit: string}[]>([]);
  const [editUsabilityPercentage, setEditUsabilityPercentage] = useState("100");
  const [editCategory, setEditCategory] = useState("Meat");
  const [showSecondaryConversion, setShowSecondaryConversion] = useState(false);
  const [editVendor, setEditVendor] = useState("");

  // Supplier selection state for Add form
  const [selectedVendor, setSelectedVendor] = useState<string>("");

  // Derived unique list of suppliers/vendors from registered vendors
  const vendorsList = React.useMemo(() => {
    const set = new Set<string>();

    if (vendors && Array.isArray(vendors)) {
      vendors.forEach(v => {
        if (v.name && v.name.trim()) set.add(v.name.trim());
      });
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [vendors]);

  const [selectedDeDupIds, setSelectedDeDupIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"name" | "price" | "date" | "invoice">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy, sortOrder]);

  const toggleSort = (field: "name" | "price" | "date" | "invoice") => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder(field === "name" || field === "invoice" ? "asc" : "desc");
    }
  };

  const filteredIngredients = ingredients.filter((ing) => {
    const terms = searchTerm.toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
    if (terms.length === 0) return true;
    
    return terms.some(t => 
      (ing.name || "").toLowerCase().includes(t) ||
      (ing.source || "").toLowerCase().includes(t) ||
      (ing.vendor || "").toLowerCase().includes(t) ||
      getIngredientVendor(ing).toLowerCase().includes(t)
    );
  });

  const sortedIngredients = [...filteredIngredients].sort((a, b) => {
    let valA: any = "";
    let valB: any = "";

    if (sortBy === "name") {
      valA = (a.name || "").toLowerCase();
      valB = (b.name || "").toLowerCase();
    } else if (sortBy === "price") {
      valA = a.price || 0;
      valB = b.price || 0;
    } else if (sortBy === "date") {
      valA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      valB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    } else if (sortBy === "invoice") {
      valA = getIngredientVendor(a).toLowerCase();
      valB = getIngredientVendor(b).toLowerCase();
    }

    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  // Helper: Query sorted ingredients list
  const getLatestIngredients = () => {
    return sortedIngredients;
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const numericPrice = parseFloat(price) || 0;
    const numericQty = parseFloat(quantity) || 0;

    const cleanAddUnit = unit.trim().toLowerCase();
    const isDiscreteUnit = !MASS_VOLUME_UNITS.includes(cleanAddUnit);
    const wPerCaseNum = parseFloat(weightPerCase);
    const hasCustomWeight = isDiscreteUnit && !isNaN(wPerCaseNum) && wPerCaseNum > 0;

    const pPerPoundNum = parseFloat(pcsPerPound);

    const pricePerGram = calculateIngredientUnitPrice({
      price: numericPrice,
      quantity: numericQty,
      unit,
      weightPerCase: hasCustomWeight ? wPerCaseNum : undefined,
      weightPerCaseUnit: hasCustomWeight ? weightPerCaseUnit : undefined,
      pcsPerPound: (!isNaN(pPerPoundNum) && pPerPoundNum > 0) ? pPerPoundNum : undefined,
      conversions: conversions.map(c => ({ ratio: parseFloat(c.ratio) || 0, targetUnit: c.targetUnit })).filter(c => c.ratio > 0 && c.targetUnit),
    });

    const finalVendor = selectedVendor || source || vendorsList[0] || "Default / Unassigned";

    try {
      await onAddIngredient({
        name,
        price: numericPrice,
        quantity: numericQty,
        unit,
        pricePerGram,
        vendor: finalVendor,
        source: finalVendor,
        category,
        ...(hasCustomWeight ? {
          weightPerCase: wPerCaseNum,
          weightPerCaseUnit: weightPerCaseUnit,
        } : {}),
        pcsPerPound: (!isNaN(pPerPoundNum) && pPerPoundNum > 0) ? pPerPoundNum : undefined,
        packagingUnit: packagingUnit || "Box",
        conversions: conversions.map(c => ({ ratio: parseFloat(c.ratio) || 0, targetUnit: c.targetUnit })).filter(c => c.ratio > 0 && c.targetUnit),
        usabilityPercentage: parseFloat(usabilityPercentage) || 100
      });

      // Reset
      setName("");
      setPrice("0");
      setQuantity("1");
      setUnit("lbs");
      setSelectedVendor("");
      setSource("Default / Unassigned");
      setCategory("Meat");
      setWeightPerCase("");
      setWeightPerCaseUnit("lb");
      setPcsPerPound("");
      setPackagingUnit("Box");
      setConversions([]);
      setUsabilityPercentage("100");
      setShowAddForm(false);
      setSuccessMessage("Ingredient successfully logged.");
    } catch (err: any) {
      let friendlyMessage = err.message || "Failed to append ingredient.";
      if (err.message === "DUPLICATE_ENTRY") {
        friendlyMessage = "A duplicate raw ingredient with the exact same Name, Vendor, Price, Weight, and Source already exists. Duplicity prevented!";
      } else {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed && parsed.error) {
            friendlyMessage = parsed.error;
          }
        } catch (e) {}
      }
      setErrorMessage(friendlyMessage);
    }
  };

  // Selection & Bulk controls
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const activeList = getLatestIngredients();
    const filterIds = activeList.map((ing) => ing.id).filter((id): id is string => !!id);
    const allSelected = filterIds.length > 0 && filterIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filterIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filterIds])));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsProcessing(true);

    try {
      const uniqueIds: string[] = Array.from(new Set<string>(selectedIds));
      if (onBulkDeleteIngredients) {
        await onBulkDeleteIngredients(uniqueIds);
      } else {
        for (const id of uniqueIds) {
          await onDeleteIngredient(id);
        }
      }
      setSuccessMessage(`Successfully deleted ${uniqueIds.length} raw items from your catalog.`);
      setSelectedIds([]);
      setShowDeleteConfirm(false);
    } catch (err: any) {
      let friendlyMessage = err.message || "Bulk removal failed.";
      try {
        const parsed = JSON.parse(err.message);
        if (parsed && parsed.error) {
          friendlyMessage = parsed.error;
        }
      } catch (e) {}
      setErrorMessage(friendlyMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  // Duplicate scanning utility
  const getDuplicatePairs = () => {
    const groups = new Map<string, Ingredient[]>();

    ingredients.forEach((ing) => {
      if (!ing) return;
      const nameKey = (ing.name || "").toLowerCase().replace(/\s+/g, " ").trim();
      const sourceKey = (ing.source || "").toLowerCase().replace(/\s+/g, " ").trim();
      const qtyKey = Number(ing.quantity || 0).toFixed(4);
      const unitKey = (ing.unit || "").toLowerCase().trim();
      const priceKey = Number(ing.price || 0).toFixed(2);

      const hash = `${nameKey}_${sourceKey}_${qtyKey}_${unitKey}_${priceKey}`;

      if (!groups.has(hash)) {
        groups.set(hash, []);
      }
      groups.get(hash)!.push(ing);
    });

    const duplicatesToRemove: Ingredient[] = [];
    groups.forEach((items) => {
      if (items.length > 1) {
        // Keep the newest (latest updatedAt), queue the rest for de-duplication
        const sorted = [...items].sort((a, b) => {
          const parsedA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const parsedB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          const timeA = isNaN(parsedA) ? 0 : parsedA;
          const timeB = isNaN(parsedB) ? 0 : parsedB;
          return timeB - timeA;
        });
        duplicatesToRemove.push(...sorted.slice(1));
      }
    });

    return duplicatesToRemove;
  };

  const getDuplicateGroups = () => {
    const groups = new Map<string, Ingredient[]>();

    ingredients.forEach((ing) => {
      if (!ing) return;
      const nameKey = (ing.name || "").toLowerCase().replace(/\s+/g, " ").trim();
      const sourceKey = (ing.source || "").toLowerCase().replace(/\s+/g, " ").trim();
      const qtyKey = Number(ing.quantity || 0).toFixed(4);
      const unitKey = (ing.unit || "").toLowerCase().trim();
      const priceKey = Number(ing.price || 0).toFixed(2);

      const hash = `${nameKey}_${sourceKey}_${qtyKey}_${unitKey}_${priceKey}`;

      if (!groups.has(hash)) {
        groups.set(hash, []);
      }
      groups.get(hash)!.push(ing);
    });

    const duplicateGroupsList: Array<{
      key: string;
      keepItem: Ingredient;
      removableItems: Ingredient[];
    }> = [];

    groups.forEach((items) => {
      if (items.length > 1) {
        const sorted = [...items].sort((a, b) => {
          const parsedA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const parsedB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          const timeA = isNaN(parsedA) ? 0 : parsedA;
          const timeB = isNaN(parsedB) ? 0 : parsedB;
          return timeB - timeA;
        });
        
        duplicateGroupsList.push({
          key: sorted[0].id || Math.random().toString(),
          keepItem: sorted[0],
          removableItems: sorted.slice(1)
        });
      }
    });

    return duplicateGroupsList;
  };

  const initiateDeDupReview = () => {
    const groupsList = getDuplicateGroups();
    const allRemovableIds = groupsList.flatMap(group => 
      group.removableItems.map(item => item.id).filter((id): id is string => !!id)
    );
    setSelectedDeDupIds(allRemovableIds);
    setShowDeDupConfirm(true);
  };

  const handleToggleDeDupItem = (id: string) => {
    setSelectedDeDupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCleanDuplicates = async () => {
    if (selectedDeDupIds.length === 0) {
      setErrorMessage("Please select at least one redundant duplicate checkbox from the list below before purging.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsProcessing(true);

    try {
      const idsToDelete = [...selectedDeDupIds];
      if (idsToDelete.length > 0) {
        if (onBulkDeleteIngredients) {
          await onBulkDeleteIngredients(idsToDelete);
        } else {
          for (const id of idsToDelete) {
            await onDeleteIngredient(id);
          }
        }
      }
      // Clean selections if they were deleted
      setSelectedIds((prev) => prev.filter((id) => !idsToDelete.includes(id)));
      setSuccessMessage(`De-duplicated catalog! Successfully cleared ${idsToDelete.length} redundant records.`);
      setShowDeDupConfirm(false);
      setSelectedDeDupIds([]);
    } catch (err: any) {
      let friendlyMessage = err.message || "Failed running de-duplication.";
      try {
        const parsed = JSON.parse(err.message);
        if (parsed && parsed.error) {
          friendlyMessage = parsed.error;
        }
      } catch (e) {}
      setErrorMessage(friendlyMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  // Synchronized editing state handlers
  const handleRateChange = (newRateVal: string, newRateUnit: string) => {
    setEditRateValue(newRateVal);
    setEditRateUnit(newRateUnit);
    
    const cleanEditUnit = editUnit.toLowerCase().trim();
    const isDiscreteUnit = !MASS_VOLUME_UNITS.includes(cleanEditUnit);
    const cleanRateUnit = newRateUnit.toLowerCase().trim();

    if (isDiscreteUnit) {
      if (MASS_VOLUME_UNITS.includes(cleanRateUnit)) {
        setEditWeightPerCaseUnit(newRateUnit);
      }
    } else {
      if (MASS_VOLUME_UNITS.includes(cleanRateUnit)) {
        setEditUnit(newRateUnit);
      }
    }

    const rateNum = parseFloat(newRateVal);
    const qtyNum = parseFloat(editQuantity);
    if (isNaN(rateNum) || isNaN(qtyNum) || qtyNum <= 0) return;

    const wPerCaseNum = parseFloat(editWeightPerCase);
    const hasCustomWeight = isDiscreteUnit && !isNaN(wPerCaseNum) && wPerCaseNum > 0;

    if (
      cleanRateUnit === "pcs" ||
      (cleanRateUnit === cleanEditUnit && !MASS_VOLUME_UNITS.includes(cleanRateUnit)) ||
      (["pcs", "pc", "ea", "each", "piece", "pieces", "ct", "count"].includes(cleanRateUnit) && !hasCustomWeight) ||
      (isDiscreteUnit && !hasCustomWeight && !MASS_VOLUME_UNITS.includes(cleanRateUnit))
    ) {
      const calculatedPrice = rateNum * qtyNum;
      setEditPrice(calculatedPrice.toFixed(2));
      return;
    }

    let pricePerGram = 0;
    if (["lb", "lbs", "pound", "pounds"].includes(cleanRateUnit)) {
      pricePerGram = rateNum / 453.59237;
    } else if (["oz", "ounce", "ounces"].includes(cleanRateUnit)) {
      pricePerGram = rateNum / 28.3495231;
    } else if (["kg", "kilogram", "kilograms"].includes(cleanRateUnit)) {
      pricePerGram = rateNum / 1000;
    } else if (["l", "liter", "liters"].includes(cleanRateUnit)) {
      pricePerGram = rateNum / 1000;
    } else if (["g", "gram", "grams", "ml", "milliliter", "milliliters"].includes(cleanRateUnit)) {
      pricePerGram = rateNum;
    } else {
      pricePerGram = rateNum;
    }

    let totalCapacityInGrams = 0;
    if (hasCustomWeight) {
      const baseEqPerCase = getGramsOrMlEquivalent(wPerCaseNum, newRateUnit);
      totalCapacityInGrams = qtyNum * baseEqPerCase;
    } else if (isDiscreteUnit && MASS_VOLUME_UNITS.includes(cleanRateUnit)) {
      // If discrete unit (e.g. Box) with NO weight specified yet, and user sets rate per weight (e.g. $2/lb):
      const priceNum = parseFloat(editPrice);
      if (!isNaN(priceNum) && priceNum > 0 && rateNum > 0) {
        const impliedWPerCase = priceNum / (rateNum * qtyNum);
        if (impliedWPerCase > 0) {
          setEditWeightPerCase(impliedWPerCase.toFixed(2));
          setEditWeightPerCaseUnit(newRateUnit);
          const baseEqPerCase = getGramsOrMlEquivalent(impliedWPerCase, newRateUnit);
          totalCapacityInGrams = qtyNum * baseEqPerCase;
        } else {
          totalCapacityInGrams = getGramsOrMlEquivalent(qtyNum, newRateUnit);
        }
      } else {
        totalCapacityInGrams = getGramsOrMlEquivalent(qtyNum, newRateUnit);
      }
    } else {
      totalCapacityInGrams = getGramsOrMlEquivalent(qtyNum, newRateUnit);
    }

    const calculatedPrice = pricePerGram * totalCapacityInGrams;
    
    // update package price
    setEditPrice(calculatedPrice.toFixed(2));
  };

  const recalculateEditRate = (priceStr: string, qtyStr: string, unitStr: string, wPerCaseStr: string, wPerCaseUnitStr: string, rateUnitStr: string) => {
    const priceNum = parseFloat(priceStr) || 0;
    const qtyNum = parseFloat(qtyStr) || 0;

    const cleanUnitStr = unitStr.toLowerCase().trim();
    const isDiscreteUnit = !MASS_VOLUME_UNITS.includes(cleanUnitStr);
    const wPerCaseNum = parseFloat(wPerCaseStr);
    const hasCustomWeight = isDiscreteUnit && !isNaN(wPerCaseNum) && wPerCaseNum > 0;

    const dummyIng = {
      price: priceNum,
      quantity: qtyNum,
      unit: unitStr,
      pricePerGram: 0,
      weightPerCase: hasCustomWeight ? wPerCaseNum : undefined,
      weightPerCaseUnit: hasCustomWeight ? (wPerCaseUnitStr || "lb") : undefined,
      pcsPerPound: parseFloat(editPcsPerPound) > 0 ? parseFloat(editPcsPerPound) : undefined,
    };

    const rateInfo = getIngredientStandardRate(dummyIng);
    setEditRateValue(rateInfo.rateVal.toFixed(5));
    setEditRateUnit(rateInfo.unitLabel);
  };

  const handlePriceChange = (newPrice: string) => {
    setEditPrice(newPrice);
    recalculateEditRate(newPrice, editQuantity, editUnit, editWeightPerCase, editWeightPerCaseUnit, editRateUnit);
  };

  const handleQuantityOrUnitChange = (newQty: string, newUnit: string) => {
    const oldUnit = editUnit;
    const oldQtyNum = parseFloat(editQuantity) || 1;
    const cleanOldUnit = oldUnit.toLowerCase().trim();
    const cleanNewUnit = newUnit.toLowerCase().trim();

    const oldIsDiscrete = !MASS_VOLUME_UNITS.includes(cleanOldUnit);
    const newIsDiscrete = !MASS_VOLUME_UNITS.includes(cleanNewUnit);
    const wPerCaseNum = parseFloat(editWeightPerCase);
    const hasCustomWeight = oldIsDiscrete && !isNaN(wPerCaseNum) && wPerCaseNum > 0;

    let adjustedQty = newQty;
    let adjustedWPerCase = editWeightPerCase;

    // Converting from discrete (with weight) to mass/volume
    if (oldIsDiscrete && !newIsDiscrete && hasCustomWeight) {
      const totalMass = oldQtyNum * wPerCaseNum;
      const totalGrams = getGramsOrMlEquivalent(totalMass, editWeightPerCaseUnit || "lb");
      const inNewUnit = convertFromGrams(totalGrams, cleanNewUnit);
      adjustedQty = (inNewUnit > 0 ? inNewUnit : totalMass).toString();
      adjustedWPerCase = "";
    } 
    // Converting between mass/volume units
    else if (!oldIsDiscrete && !newIsDiscrete && cleanOldUnit !== cleanNewUnit) {
      const oldGrams = getGramsOrMlEquivalent(oldQtyNum, cleanOldUnit);
      const inNewUnit = convertFromGrams(oldGrams, cleanNewUnit);
      if (inNewUnit > 0) {
        adjustedQty = inNewUnit.toFixed(2);
      }
    }
    // Converting from mass to discrete (with weight)
    else if (!oldIsDiscrete && newIsDiscrete && !isNaN(wPerCaseNum) && wPerCaseNum > 0) {
      const oldGrams = getGramsOrMlEquivalent(oldQtyNum, cleanOldUnit);
      const caseGrams = getGramsOrMlEquivalent(wPerCaseNum, editWeightPerCaseUnit || "lb");
      if (caseGrams > 0) {
        adjustedQty = (oldGrams / caseGrams).toFixed(2);
      }
    }

    setEditQuantity(adjustedQty);
    setEditUnit(newUnit);
    setEditWeightPerCase(adjustedWPerCase);

    const isNowDiscrete = !MASS_VOLUME_UNITS.includes(cleanNewUnit);
    const hasNowCustomWeight = isNowDiscrete && parseFloat(adjustedWPerCase) > 0;

    let rateUnitToUse = newUnit;
    if (isNowDiscrete && hasNowCustomWeight) {
      rateUnitToUse = editWeightPerCaseUnit || "lb";
    }

    setEditRateUnit(rateUnitToUse);
    recalculateEditRate(editPrice, adjustedQty, newUnit, adjustedWPerCase, editWeightPerCaseUnit, rateUnitToUse);
  };

  const handleWeightPerCaseChange = (newWPerCase: string, newWPerCaseUnit: string) => {
    setEditWeightPerCase(newWPerCase);
    setEditWeightPerCaseUnit(newWPerCaseUnit);
    const wNum = parseFloat(newWPerCase);
    if (!isNaN(wNum) && wNum > 0) {
      setEditRateUnit(newWPerCaseUnit);
      recalculateEditRate(editPrice, editQuantity, editUnit, newWPerCase, newWPerCaseUnit, newWPerCaseUnit);
    } else {
      setEditRateUnit(editUnit);
      recalculateEditRate(editPrice, editQuantity, editUnit, "", newWPerCaseUnit, editUnit);
    }
  };

  const handleEditInit = (ing: Ingredient) => {
    if (!ing.id) return;
    setEditingId(ing.id);
    setEditName(ing.name || "");
    setEditPrice(ing.price != null ? ing.price.toString() : "0");
    setEditQuantity(ing.quantity != null ? ing.quantity.toString() : "1");
    setEditUnit(ing.unit || "g");
    setEditWeightPerCase(ing.weightPerCase != null ? ing.weightPerCase.toString() : "");
    setEditWeightPerCaseUnit(ing.weightPerCaseUnit || "lb");
    setEditPcsPerPound(ing.pcsPerPound != null ? ing.pcsPerPound.toString() : "");
    setEditPackagingUnit(ing.packagingUnit || "Box");
    if (ing.conversions && ing.conversions.length > 0) {
      setEditConversions(ing.conversions.map(c => ({ ratio: c.ratio != null ? c.ratio.toString() : "", targetUnit: c.targetUnit || "" })));
    } else {
      setEditConversions([]);
    }
    setShowSecondaryConversion(false);
    setEditUsabilityPercentage(ing.usabilityPercentage != null ? ing.usabilityPercentage.toString() : "100");
    setEditCategory(ing.category || "Meat");

    const currentV = ing.vendor || getIngredientVendor(ing) || "Default / Unassigned";
    if (vendorsList.includes(currentV)) {
      setEditVendor(currentV);
    } else if (vendorsList.length > 0) {
      setEditVendor(vendorsList[0]);
    } else {
      setEditVendor("");
    }

    // Reset Database Match action states
    setSelectedMergeIds([]);
    setMergeError(null);

    const rateInfo = getIngredientStandardRate(ing);
    setEditRateValue(rateInfo.rateVal.toFixed(5));
    setEditRateUnit(rateInfo.unitLabel);
  };

  const handleEditSave = async (id: string) => {
    const numericPrice = parseFloat(editPrice) || 0;
    const numericQty = parseFloat(editQuantity) || 0;
    const numericUsability = parseFloat(editUsabilityPercentage);
    const numericPcsPerPound = parseFloat(editPcsPerPound);
    if (!editName.trim()) return;

    const cleanEditUnit = editUnit.trim().toLowerCase();
    const isDiscreteUnit = !MASS_VOLUME_UNITS.includes(cleanEditUnit);
    const wPerCaseNum = parseFloat(editWeightPerCase);
    const hasCustomWeight = isDiscreteUnit && !isNaN(wPerCaseNum) && wPerCaseNum > 0;
    const finalWeightUnit = hasCustomWeight ? (editWeightPerCaseUnit || "lb") : undefined;

    const pricePerGram = calculateIngredientUnitPrice({
      price: numericPrice,
      quantity: numericQty,
      unit: cleanEditUnit,
      weightPerCase: hasCustomWeight ? wPerCaseNum : undefined,
      weightPerCaseUnit: finalWeightUnit,
      pcsPerPound: (!isNaN(numericPcsPerPound) && numericPcsPerPound > 0) ? numericPcsPerPound : undefined,
      conversions: editConversions.map(c => ({ ratio: parseFloat(c.ratio) || 0, targetUnit: c.targetUnit })).filter(c => c.ratio > 0 && c.targetUnit),
    });

    const finalVendor = editVendor || "Default / Unassigned";

    await onEditIngredient(id, {
      name: editName,
      price: numericPrice,
      quantity: numericQty,
      unit: cleanEditUnit,
      pricePerGram,
      category: editCategory,
      vendor: finalVendor,
      source: finalVendor,
      updatedAt: new Date().toISOString(),
      weightPerCase: hasCustomWeight ? wPerCaseNum : null as any,
      weightPerCaseUnit: editWeightPerCaseUnit || undefined,
      pcsPerPound: (!isNaN(numericPcsPerPound) && numericPcsPerPound > 0) ? numericPcsPerPound : null as any,
      packagingUnit: editPackagingUnit || "Box",
      conversions: editConversions.map(c => ({ ratio: parseFloat(c.ratio) || 0, targetUnit: c.targetUnit })).filter(c => c.ratio > 0 && c.targetUnit),
      usabilityPercentage: (isNaN(numericUsability) || numericUsability <= 0) ? 100 : numericUsability,
    });

    setEditingId(null);
  };

  const exportToCSV = () => {
    let headers: string[] = [];
    let rows: any[][] = [];

    headers = [
      "Audit Date",
      "Source / Invoice #",
      "Ingredient Name",
      "Base Unit Qty",
      "Base Unit",
      "Package Weight",
      "Package Weight Unit",
      "Price ($)",
      "Yield (%)",
      "AP Rate ($/Unit)",
      "EP Rate ($/Unit)"
    ];

    const activeList = getLatestIngredients();
    rows = activeList.map(ing => {
        const rateInfo = getIngredientStandardRate(ing);
        const displayRateValAP = rateInfo.rateVal;
        const displayUnitLabel = rateInfo.unitLabel;
        const yieldPct = ing.usabilityPercentage && ing.usabilityPercentage > 0 ? ing.usabilityPercentage : 100;
        const displayRateValEP = displayRateValAP / (yieldPct / 100);

        return [
          ing.updatedAt ? new Date(ing.updatedAt).toLocaleDateString() : "-",
          ing.source || "",
          ing.name || "",
          ing.quantity || "",
          ing.unit || "",
          ing.weightPerCase !== undefined ? ing.weightPerCase : "",
          ing.weightPerCaseUnit || "",
          ing.price?.toFixed(2) || "",
          ing.usabilityPercentage || "100",
          `${displayRateValAP.toFixed(3)}/${displayUnitLabel}`,
          `${displayRateValEP.toFixed(3)}/${displayUnitLabel}`
        ];
      });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ingredients_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm" id="ingredients-inventory-section">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3 border-b border-neutral-200 pb-4">
        <div className="text-left">
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-1.5 ">
            Master Ingredients Catalog
            <span className="bg-[#f0efeb] text-neutral-900 text-[10px] px-2 py-0.5 border border-neutral-200 rounded-xl font-mono font-bold">
              {ingredients.length} Items
            </span>
          </h2>
          <p className="text-neutral-900/60 font-serif italic text-xs mt-0.5">
            Audit raw ingredient purchase package prices used to dynamically update your culinary list.
          </p>
        </div>

        {!isReadOnly && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setShowBulkPriceModal(true)}
              className="bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl border border-neutral-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Bulk update prices via paste/CSV or interactive grid"
            >
              <DollarSign className="h-4 w-4 text-emerald-400" />
              <span>Bulk Update Prices</span>
            </button>

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-emerald-600 hover:bg-neutral-800 text-white font-bold text-xs px-4 py-2 rounded-xl border border-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              id="toggle-add-ingredient-form"
            >
              {showAddForm ? (
                <>
                  <X className="h-4 w-4" />
                  <span>Cancel Form</span>
                </>
              ) : (
                <>
                  <PlusCircle className="h-4 w-4" />
                  <span>Add Ingredient</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Manual Input Form */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="bg-[#f0efeb] hover:bg-[#e4e3e0]/40 border border-neutral-200 p-5 rounded-xl mb-6 text-left transition-all" id="add-ingredient-form">
          <h3 className="text-xs font-bold text-neutral-900 mb-4">New Master Ingredient Form</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-neutral-900/60 mb-1">Name</label>
              <input
                type="text"
                required
                placeholder="e.g., Unsalted Butter, Flour"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold placeholder:text-neutral-350 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-neutral-900/60 mb-1">Price ($)</label>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                placeholder="e.g., 14.50"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold font-mono placeholder:text-neutral-350 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-neutral-900/60 mb-1">Base Qty</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold font-mono focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-900/60 mb-1">Unit</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-hidden cursor-pointer"
                >
                  <optgroup label="Weight">
                    <option value="lb">Pounds (lb)</option>
                    <option value="lbs">Pounds (lbs)</option>
                    <option value="oz">Ounces (oz)</option>
                    <option value="g">Grams (g)</option>
                    <option value="kg">Kilograms (kg)</option>
                  </optgroup>
                  <optgroup label="Volume">
                    <option value="gal">Gallons (gal)</option>
                    <option value="fl oz">Fluid Ounces (fl oz)</option>
                    <option value="L">Liters (L)</option>
                    <option value="ml">Milliliters (ml)</option>
                  </optgroup>
                  <optgroup label="Count / Packaging">
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="pack">Pack</option>
                    <option value="box">Box</option>
                    <option value="case">Case</option>
                    <option value="bag">Bag</option>
                    <option value="can">Can</option>
                    <option value="bottle">Bottle</option>
                    <option value="jar">Jar</option>
                    <option value="bunch">Bunch</option>
                    <option value="head">Head</option>
                    <option value="unit">Unit</option>
                  </optgroup>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-neutral-900/60 mb-1">Item Category *</label>
              <select
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-hidden cursor-pointer"
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

            <div>
              <label className="block text-[10px] font-bold text-neutral-900/60 mb-1">Supplier's Name</label>
              <select
                value={selectedVendor || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedVendor(val);
                  setSource(val);
                }}
                className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-hidden cursor-pointer"
              >
                <option value="">Select Supplier...</option>
                {vendorsList.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Packs per Box or Pieces Conversion factor */}
          {unit.toLowerCase() !== "pcs" && !(parseFloat(weightPerCase) > 0) && (
            <div className="mt-4 p-4 bg-white border border-neutral-200/20 rounded-xl space-y-2">
              <div className="text-[11px] font-bold text-neutral-900 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                <span>Secondary Packaging Conversion (Optional)</span>
              </div>
              <p className="text-[10px] text-neutral-500 font-serif italic">
                Specify how many {unit || "units"} are inside a larger package. This enables the system to accurately track stock, deduct items, and calculate totals.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <div>
                  <label className="block text-[9px] font-bold text-neutral-900/60 mb-1">Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="e.g., 12"
                    value={pcsPerPound}
                    onChange={(e) => setPcsPerPound(e.target.value)}
                    className="w-[100px] bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold font-mono focus:outline-hidden"
                  />
                </div>
                <div className="flex flex-col justify-end h-full">
                  <span className="text-[10px] font-bold text-neutral-600 bg-neutral-100 px-2 py-2 rounded mb-[2px] mt-[14px]">
                    {unit || "units"}
                  </span>
                </div>
                <div className="flex flex-col justify-end h-full pb-2">
                  <span className="text-[10px] font-bold text-neutral-500 px-1">per</span>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-neutral-900/60 mb-1">Package</label>
                  <select
                    value={packagingUnit}
                    onChange={(e) => setPackagingUnit(e.target.value)}
                    className="w-[100px] bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-hidden cursor-pointer"
                  >
                    <optgroup label="Count / Packaging">
                      <option value="pcs">Pieces (pcs)</option>
                      <option value="pack">Pack</option>
                      <option value="box">Box</option>
                      <option value="case">Case</option>
                      <option value="bag">Bag</option>
                      <option value="can">Can</option>
                      <option value="bottle">Bottle</option>
                      <option value="jar">Jar</option>
                      <option value="bunch">Bunch</option>
                      <option value="head">Head</option>
                      <option value="unit">Unit</option>
                    </optgroup>
                    <optgroup label="Weight">
                      <option value="lb">Pounds (lb)</option>
                      <option value="lbs">Pounds (lbs)</option>
                      <option value="oz">Ounces (oz)</option>
                      <option value="g">Grams (g)</option>
                      <option value="kg">Kilograms (kg)</option>
                    </optgroup>
                    <optgroup label="Volume">
                      <option value="gal">Gallons (gal)</option>
                      <option value="fl oz">Fluid Ounces (fl oz)</option>
                      <option value="L">Liters (L)</option>
                      <option value="ml">Milliliters (ml)</option>
                    </optgroup>
                  </select>
                </div>
                <div className="flex flex-col justify-end h-full pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPcsPerPound("");
                    }}
                    className="ml-2 text-red-500 hover:text-red-700 mb-1"
                    title="Remove Pack Size"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {conversions.map((conv, idx) => (
                <div key={idx} className="flex items-center gap-2 mt-2">
                  <div>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={conv.ratio}
                      onChange={(e) => {
                        const newConvs = [...conversions];
                        newConvs[idx].ratio = e.target.value;
                        setConversions(newConvs);
                      }}
                      className="w-[100px] bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold font-mono focus:outline-hidden"
                    />
                  </div>
                  <div className="flex flex-col justify-end h-full">
                    <span className="text-[10px] font-bold text-neutral-600 bg-neutral-100 px-2 py-2 rounded">
                      {unit || "units"}
                    </span>
                  </div>
                  <div className="flex flex-col justify-end h-full pb-2">
                    <span className="text-[10px] font-bold text-neutral-500 px-1">per</span>
                  </div>
                  <div>
                    <select
                      value={conv.targetUnit}
                      onChange={(e) => {
                        const newConvs = [...conversions];
                        newConvs[idx].targetUnit = e.target.value;
                        setConversions(newConvs);
                      }}
                      className="w-[100px] bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-hidden cursor-pointer"
                    >
                      <option value="" disabled>Select...</option>
                      <optgroup label="Count / Packaging">
                      <option value="pcs">Pieces (pcs)</option>
                      <option value="pack">Pack</option>
                      <option value="box">Box</option>
                      <option value="case">Case</option>
                      <option value="bag">Bag</option>
                      <option value="can">Can</option>
                      <option value="bottle">Bottle</option>
                      <option value="jar">Jar</option>
                      <option value="bunch">Bunch</option>
                      <option value="head">Head</option>
                      <option value="unit">Unit</option>
                    </optgroup>
                    <optgroup label="Weight">
                      <option value="lb">Pounds (lb)</option>
                      <option value="lbs">Pounds (lbs)</option>
                      <option value="oz">Ounces (oz)</option>
                      <option value="g">Grams (g)</option>
                      <option value="kg">Kilograms (kg)</option>
                    </optgroup>
                    <optgroup label="Volume">
                      <option value="gal">Gallons (gal)</option>
                      <option value="fl oz">Fluid Ounces (fl oz)</option>
                      <option value="L">Liters (L)</option>
                      <option value="ml">Milliliters (ml)</option>
                    </optgroup>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newConvs = [...conversions];
                      newConvs.splice(idx, 1);
                      setConversions(newConvs);
                    }}
                    className="ml-2 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setConversions([...conversions, { ratio: "", targetUnit: "" }])}
                  className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  Add more packaging
                </button>
              </div>
            </div>
          )}

          {/* Usability & Yield Recommendation Section */}
          <div className="mt-4 p-4 bg-white border border-neutral-200/20 rounded-xl space-y-3">
            <div className="text-[11px] font-bold text-neutral-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                <span>Usability (Yield) & Waste Factor</span>
              </span>
              <span className="bg-emerald-600 text-white text-[8px] px-1.5 py-0.5 font-mono">
                RECOMMENDATION ENGINE
              </span>
            </div>
            
            <p className="text-[10px] text-neutral-500 font-serif italic">
              Kitchen prep like peeling, trimming, deboning, and cooking results in material scrap (waste). Setting an accurate usability percentage ensures you cost recipes using the higher <strong>Usable (EP) cost</strong> instead of raw <strong>Purchase (AP) cost</strong>.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mt-2">
              <div>
                <label className="block text-[9px] font-bold text-neutral-900/60 mb-1">Usability / Yield Percentage (%)</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    required
                    placeholder="e.g., 85"
                    value={usabilityPercentage}
                    onChange={(e) => setUsabilityPercentage(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold font-mono focus:outline-hidden"
                  />
                  <span className="font-bold font-mono text-xs">%</span>
                </div>
              </div>

              {name.trim() && (
                <div className="col-span-2 p-3 bg-[#fafaf9] border border-neutral-200/10 rounded-xl flex items-start gap-2 text-[11px]">
                  <div className="shrink-0 text-emerald-600 font-bold font-mono mt-0.5 text-xs">💡</div>
                  <div className="flex-1 text-left">
                    <span className="font-bold text-neutral-900 block">
                      Recommended for "{name}": {recommendUsabilityPercentage(name).percentage}% Yield
                    </span>
                    <span className="text-[10px] text-neutral-500 block leading-tight mt-0.5">
                      {recommendUsabilityPercentage(name).reason}
                    </span>
                    <button
                      type="button"
                      onClick={() => setUsabilityPercentage(recommendUsabilityPercentage(name).percentage.toString())}
                      className="mt-1.5 text-[9px] font-bold text-emerald-700 hover:text-emerald-950 border border-emerald-750 hover:border-emerald-850 px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 transition-all cursor-pointer"
                    >
                      Apply Recommended Yield
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-neutral-200/20">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl border border-neutral-200 bg-white text-neutral-900 hover:bg-[#f0efeb] text-[10px] font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-neutral-800 text-white text-[10px] font-bold border border-neutral-200 cursor-pointer"
            >
              Add Item to List
            </button>
          </div>
        </form>
      )}

      {/* Notification Alerts */}
      {errorMessage && (
        <div className="mb-4 bg-red-50 border border-red-500 p-3.5 rounded-xl flex items-center justify-between text-xs font-bold text-red-700 text-left">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-red-700 hover:text-black">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {successMessage && (
        <div className="mb-4 bg-emerald-50 border border-emerald-500 p-3.5 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-800 text-left">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-800 hover:text-black">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Heuristic Duplicate Scanner Notice */}
      {(() => {
        const dupList = getDuplicatePairs();
        if (dupList.length === 0) return null;
        const dupGroups = getDuplicateGroups();

        return (
          <div className="mb-6 bg-[#fcfaf7] border-2 border-neutral-200 p-5 rounded-xl flex flex-col gap-4 text-xs font-bold text-neutral-900 text-left shadow-sm">
            <div className="flex items-start gap-2.5 pb-3 border-b border-neutral-200/10">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] text-amber-800 block mb-0.5 font-mono">Catalog Duplication Detected</span>
                <p className="text-sm font-bold text-neutral-900">
                  Found <span className="underline font-mono">{dupList.length}</span> duplicate line item{dupList.length > 1 ? "s" : ""} inside your database catalog.
                </p>
                <p className="text-[11px] font-normal text-neutral-600 mt-1 font-serif italic">
                  An item is considered a duplicate if it shares the exact same Name, Supplier's Name, Price, Quantity, and Unit. Below, you can inspect each group, see which record is being kept (the newest), and select exactly which individual extra duplicates to purge or skip.
                </p>
              </div>
            </div>

            {!showDeDupConfirm ? (
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={initiateDeDupReview}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-emerald-600 hover:bg-neutral-800 text-white text-[10px] font-bold rounded-xl border border-neutral-200 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span>Review & Clean Duplicates</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between text-[11px] font-bold text-red-700 bg-red-50 p-2 border border-red-200 gap-2">
                  <span>⚠️ De-duplication Preview: Checked items will be deleted, unchecked items will be preserved (skipped).</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const groupsList = getDuplicateGroups();
                        const allRemovableIds = groupsList.flatMap(group => 
                          group.removableItems.map(item => item.id).filter((id): id is string => !!id)
                        );
                        setSelectedDeDupIds(allRemovableIds);
                      }}
                      className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-900 border border-red-400 font-mono text-[9px] cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDeDupIds([])}
                      className="px-2 py-0.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 border border-neutral-400 font-mono text-[9px] cursor-pointer"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 border border-neutral-200/20 p-3 bg-white">
                  {dupGroups.map((group, groupIdx) => {
                    const matchItem = group.keepItem;
                    return (
                      <div key={matchItem.id ? `${matchItem.id}-${groupIdx}` : groupIdx} className="border border-neutral-200 p-3 bg-neutral-50 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200/10 pb-1.5">
                          <span className="font-bold text-neutral-900 text-xs">
                            Group: <span className="underline">{matchItem.name}</span>
                          </span>
                          <span className="font-mono text-[10px] bg-neutral-200 px-1.5 py-0.5 text-neutral-800">
                            {matchItem.quantity} {matchItem.unit} • ${matchItem.price.toFixed(2)}
                          </span>
                        </div>

                        {/* Kept Item display */}
                        <div className="flex items-center justify-between text-[11px] bg-emerald-50/50 border border-emerald-200/60 p-2 pl-3">
                          <span className="text-neutral-900 font-medium flex items-center gap-2">
                            <span className="inline-block bg-emerald-700 text-white font-mono text-[9px] px-1.5 py-0.5 select-none">
                              KEEP (Newest)
                            </span>
                            <span className="font-mono text-neutral-500 text-[10px] italic">
                              Audited on {matchItem.updatedAt ? new Date(matchItem.updatedAt).toLocaleDateString() : 'N/A'}
                            </span>
                          </span>
                          <span className="font-mono text-[10px] text-neutral-600">
                            Source: {matchItem.source}
                          </span>
                        </div>

                        {/* Removable items */}
                        <div className="pl-4 space-y-1">
                          <span className="text-[9px] text-neutral-500 font-bold block mb-1">Redundant older items (Select to purge):</span>
                          {group.removableItems.map((item, itemIdx) => {
                            if (!item.id) return null;
                            const isChecked = selectedDeDupIds.includes(item.id);
                            return (
                              <label
                                key={`${item.id}-${itemIdx}`}
                                className={`flex items-center justify-between p-2 border text-[11px] cursor-pointer transition-colors select-none ${
                                  isChecked 
                                    ? "bg-red-50/40 border-red-300 text-neutral-900" 
                                    : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleDeDupItem(item.id!)}
                                    className="h-3.5 w-3.5 border-neutral-200 accent-red-600 shrink-0 cursor-pointer"
                                  />
                                  <span className="font-mono text-[10px] text-neutral-900">
                                    Purge Redundant • Audited {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'N/A'}
                                  </span>
                                </span>
                                <span className="font-mono text-[10px] text-neutral-500">
                                  Source: {item.source}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-neutral-200/10 gap-3">
                  <div className="text-xs font-bold font-serif italic text-neutral-600">
                    Selected <span className="font-mono font-bold text-red-700">{selectedDeDupIds.length}</span> out of {dupList.length} duplicate items for removal.
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleCleanDuplicates}
                      disabled={isProcessing}
                      className="px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white text-[11px] font-extrabold rounded-xl border-2 border-black transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                    >
                      Purge Selected Duplicates ({selectedDeDupIds.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeDupConfirm(false);
                        setSelectedDeDupIds([]);
                      }}
                      disabled={isProcessing}
                      className="px-3.5 py-2.5 bg-[#f0efeb] hover:bg-neutral-200 text-neutral-900 text-[11px] font-bold rounded-xl border border-black transition-colors cursor-pointer"
                    >
                      Cancel / Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Bulk Selection Operations Action Bar */}
      {selectedIds.length > 0 && (
        <div className="mb-4 bg-emerald-600/10 bg-neutral-900 text-white p-4 rounded-xl flex flex-col gap-3 text-xs font-bold text-left border border-neutral-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-white" />
              <span className="tracking-wide font-mono text-[11px]">
                Selected {selectedIds.length} of {sortedIngredients.length} item(s)
              </span>
            </div>
            
            {!showDeleteConfirm && (
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isProcessing}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded-xl border border-red-600 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Remove Selected</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="px-3 py-1.5 bg-transparent hover:bg-white/10 text-white text-[10px] font-bold rounded-xl border border-white/20 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {showDeleteConfirm && (
            <div className="bg-white/10 border border-white/20 p-3 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
              <span className="text-white font-mono text-[11px] font-bold">
                Are you absolutely sure you want to delete these {selectedIds.length} selected item(s)? This cannot be undone.
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={isProcessing}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded-xl border border-red-600 cursor-pointer disabled:opacity-50"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 bg-transparent hover:bg-white/10 text-white text-[10px] font-bold rounded-xl border border-white/20 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search & Sort Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 flex gap-2">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-900/60">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Search items by name or supplier's name (e.g. Flour, LILY PRODUCE)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-neutral-200 rounded-xl pl-10 pr-4 py-3 text-xs font-bold placeholder:text-neutral-900/40 focus:outline-hidden"
              id="search-ingredients-input"
            />
          </div>
          <AIAssistantModal 
            context="Ingredients Inventory"
            itemNames={Array.from(new Set(ingredients.map(i => i.name)))}
            onSearchTerms={(terms) => setSearchTerm(terms.join(", "))}
            onAddItems={async (items) => {
              // Add all items sequentially
              for (const item of items) {
                await onAddIngredient(item);
              }
              setSuccessMessage(`Successfully added ${items.length} AI-generated items.`);
              setTimeout(() => setSuccessMessage(null), 3000);
            }}
          />
        </div>
        <div className="flex items-center gap-2 border border-neutral-200 p-2 bg-[#f0efeb] sm:w-auto w-full">
          <label className="text-[10px] font-bold text-neutral-900 whitespace-nowrap pl-1 font-mono">
            Sort by:
          </label>
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split("-") as [any, any];
              setSortBy(field);
              setSortOrder(order);
            }}
            className="bg-white border border-neutral-200 text-xs font-bold px-2 py-1 focus:outline-hidden rounded-xl cursor-pointer w-full sm:w-48"
          >
            <option value="date-desc">Audit Date (Newest first)</option>
            <option value="date-asc">Audit Date (Oldest first)</option>
            <option value="name-asc">Ingredient Name (A-Z)</option>
            <option value="name-desc">Ingredient Name (Z-A)</option>
            <option value="price-desc">Price (High-Low)</option>
            <option value="price-asc">Price (Low-High)</option>
            <option value="invoice-asc">Supplier's Name (A-Z)</option>
            <option value="invoice-desc">Supplier's Name (Z-A)</option>
          </select>
        </div>
        <button
          type="button"
          onClick={exportToCSV}
          className="bg-white border border-neutral-200 px-4 py-2 text-[10px] font-bold hover:bg-[#f0efeb] transition-colors whitespace-nowrap flex items-center justify-center gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>
         {/* Ingredients Grid / list layout */}
      {(() => {
        const activeList = getLatestIngredients();

        if (activeList.length === 0) {
          return (
            <div className="py-12 text-center rounded-xl border border-dashed border-neutral-200" id="empty-ingredients">
              <p className="text-xs font-bold text-neutral-900">No master ingredients found</p>
              <p className="text-xs text-neutral-900/60 mt-1 max-w-[340px] mx-auto font-serif italic">
                No consolidated items found matching your key search criteria.
              </p>
            </div>
          );
        }

        const itemsPerPage = 50;
        const totalPages = Math.ceil(activeList.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedActiveList = activeList.slice(startIndex, startIndex + itemsPerPage);

        return (
          <div className="flex flex-col gap-4">
            <div className="overflow-x-auto border border-neutral-200 rounded-xl shadow-sm" id="ingredients-table-container">
              <table className="min-w-full divide-y divide-[#141414] text-xs text-neutral-900 text-left bg-white">
              <thead className="bg-[#f0efeb] text-neutral-900 font-bold text-[10px]">
                <tr>
                  <th className="w-10 px-3 py-3 border-r border-neutral-200 text-center select-none">
                    <input
                      type="checkbox"
                      checked={
                        activeList.length > 0 &&
                        activeList.every((ing) => ing.id && selectedIds.includes(ing.id))
                      }
                      onChange={handleToggleSelectAll}
                      className="h-3.5 w-3.5 border-neutral-200 accent-[#141414] cursor-pointer"
                      title="Select all"
                    />
                  </th>
                  <th 
                    onClick={() => toggleSort("name")}
                    className="px-4 py-3 border-r border-neutral-200 cursor-pointer hover:bg-emerald-600/5 select-none transition-colors"
                  >
                    <div className="flex items-center gap-1 select-none">
                      <span>Ingredient Name</span>
                      {sortBy === "name" ? (sortOrder === "asc" ? "▲" : "▼") : <span className="opacity-30">↕</span>}
                    </div>
                  </th>
                  <th 
                    onClick={() => toggleSort("price")}
                    className="px-4 py-3 text-right border-r border-neutral-200 cursor-pointer hover:bg-emerald-600/5 select-none transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1 select-none">
                      <span>Price</span>
                      {sortBy === "price" ? (sortOrder === "asc" ? "▲" : "▼") : <span className="opacity-30">↕</span>}
                    </div>
                  </th>
                  <th className="px-4 py-3 border-r border-neutral-200 select-none">Pack Sizes</th>
                  <th className="px-4 py-3 border-r border-neutral-200 select-none">Usability (Yield %)</th>
                  <th className="px-4 py-3 text-right border-r border-neutral-200 select-none">
                    <span className="block text-[10px]">Standard Rate</span>
                  </th>
                  <th 
                    onClick={() => toggleSort("invoice")}
                    className="px-4 py-3 border-r border-neutral-200 cursor-pointer hover:bg-emerald-600/5 select-none transition-colors"
                  >
                    <div className="flex items-center gap-1 select-none">
                      <span>Supplier's Name</span>
                      {sortBy === "invoice" ? (sortOrder === "asc" ? "▲" : "▼") : <span className="opacity-30">↕</span>}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141414]">
                {paginatedActiveList.map((ing, idx) => {
                  const isEditing = editingId === ing.id;
                  
                  const rateInfo = getIngredientStandardRate(ing);
                  const displayRateVal = rateInfo.rateVal;
                  const displayUnitLabel = rateInfo.unitLabel;
                  const isDiscreteUnit = !MASS_VOLUME_UNITS.includes((ing.unit || "").toLowerCase());
                  const hasEquivWeight = isDiscreteUnit && ing.weightPerCase !== undefined && ing.weightPerCase > 0;

                  const isSelected = ing.id ? selectedIds.includes(ing.id) : false;

                  return (
                    <React.Fragment key={ing.id ? `${ing.id}-${idx}` : idx}>
                      <tr className={`hover:bg-[#f0efeb]/40 ${isSelected ? "bg-amber-50/40" : ""}`}>
                        <td className="w-10 px-3 py-3 border-r border-neutral-200 text-center select-none">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => ing.id && handleToggleSelect(ing.id)}
                            disabled={!ing.id}
                            className="h-3.5 w-3.5 border-neutral-200 accent-[#141414] cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 font-bold text-neutral-900 border-r border-neutral-200">
                          {isEditing ? (
                            <div className="space-y-1.5">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="bg-white border border-neutral-200 rounded-xl px-2 py-1 text-xs font-bold w-full focus:outline-hidden"
                              />
                              <select
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value)}
                                className="bg-white border border-neutral-200 rounded-xl px-2 py-1 text-[10px] font-bold w-full focus:outline-hidden cursor-pointer"
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
                          ) : (
                            <div className="flex flex-col">
                              <span className="font-bold text-neutral-900">{ing.name}</span>
                              {ing.category && (
                                <span className="inline-block w-max mt-1 bg-amber-100 text-amber-900 text-[9px] font-bold px-1.5 py-0.5 rounded font-mono uppercase">
                                  📁 {ing.category}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        
                        <td className="px-4 py-3 text-right border-r border-neutral-200">
                          {isEditing ? (
                            <div className="flex flex-col gap-1.5 items-end">
                              <div className="flex items-center gap-1 justify-end">
                                <span className="text-[10px] font-bold text-neutral-500">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editPrice}
                                  onChange={(e) => handlePriceChange(e.target.value)}
                                  className="bg-white border border-neutral-200 rounded-xl px-2 py-1 text-xs font-bold font-mono text-right w-20 focus:outline-hidden"
                                  placeholder="Price"
                                />
                              </div>
                              <div className="flex items-center gap-1 pt-1 border-t border-neutral-200/50 w-full justify-end">
                                <span className="text-[9px] font-bold text-neutral-500 whitespace-nowrap">/ Base:</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  value={editQuantity}
                                  onChange={(e) => handleQuantityOrUnitChange(e.target.value, editUnit)}
                                  className="bg-white border border-neutral-200 rounded-xl px-1.5 py-1 text-[10px] font-bold font-mono focus:outline-hidden w-14 text-right"
                                  placeholder="Qty"
                                />
                                <select
                                  value={editUnit}
                                  onChange={(e) => handleQuantityOrUnitChange(editQuantity, e.target.value)}
                                  className="bg-white border border-neutral-200 rounded-xl px-1.5 py-1 text-[10px] font-bold focus:outline-hidden w-18 cursor-pointer"
                                >
                                  {!["lb","g","gram","gal","ml","oz","pcs"].includes(editUnit) && editUnit && (
                                    <option value={editUnit}>{editUnit}</option>
                                  )}
                                  <option value="lb">lb</option>
                                  <option value="g">gram</option>
                                  <option value="gal">gal</option>
                                  <option value="ml">ml</option>
                                  <option value="oz">oz</option>
                                  <option value="pcs">pcs</option>
                                  <option value="box">box</option>
                                  <option value="case">case</option>
                                  <option value="bag">bag</option>
                                  <option value="pack">pack</option>
                                </select>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-start gap-0.5">
                              <span className="font-mono font-bold text-neutral-900">${ing.price.toFixed(2)}</span>
                              {(ing.price === 0 && ing.quantity === 0) && (
                                <span className="bg-amber-100 text-amber-800 px-1 py-0.5 rounded text-[9px] font-bold uppercase whitespace-nowrap flex items-center gap-1">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  Needs Update
                                </span>
                              )}
                              <span className="text-[10px] font-mono text-neutral-500">
                                / {ing.quantity || 1} {ing.unit || "unit"}
                              </span>
                            </div>
                          )}
                        </td>



                        <td className="px-4 py-3 border-r border-neutral-200">
                          {isEditing ? (
                            <div className="flex flex-col gap-1.5 items-start max-w-full">
                              {/* Secondary conversion (Pack sizes) */}
                              {showSecondaryConversion || (editPcsPerPound && parseFloat(editPcsPerPound) > 0) ? (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] font-bold text-neutral-500 whitespace-nowrap">Pack Size:</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={editPcsPerPound || ""}
                                      onChange={(e) => setEditPcsPerPound(e.target.value)}
                                      className="bg-white border border-neutral-200 rounded-xl px-1.5 py-1 text-[10px] font-bold font-mono w-14 focus:outline-hidden"
                                    />
                                    <span className="text-[10px] font-bold text-neutral-600 bg-neutral-100 px-1 rounded truncate max-w-[40px] text-center" title="Default Unit">{editUnit || "unit"}</span>
                                    <span className="text-[9px] font-sans text-neutral-500 font-bold whitespace-nowrap px-0.5">per</span>
                                    <select
                                      value={editPackagingUnit}
                                      onChange={(e) => setEditPackagingUnit(e.target.value)}
                                      className="bg-white border border-neutral-200 rounded-xl px-1.5 py-1 text-[10px] font-bold focus:outline-hidden w-16 text-center cursor-pointer"
                                    >
                                      <optgroup label="Count / Packaging">
                      <option value="pcs">Pieces (pcs)</option>
                      <option value="pack">Pack</option>
                      <option value="box">Box</option>
                      <option value="case">Case</option>
                      <option value="bag">Bag</option>
                      <option value="can">Can</option>
                      <option value="bottle">Bottle</option>
                      <option value="jar">Jar</option>
                      <option value="bunch">Bunch</option>
                      <option value="head">Head</option>
                      <option value="unit">Unit</option>
                    </optgroup>
                    <optgroup label="Weight">
                      <option value="lb">Pounds (lb)</option>
                      <option value="lbs">Pounds (lbs)</option>
                      <option value="oz">Ounces (oz)</option>
                      <option value="g">Grams (g)</option>
                      <option value="kg">Kilograms (kg)</option>
                    </optgroup>
                    <optgroup label="Volume">
                      <option value="gal">Gallons (gal)</option>
                      <option value="fl oz">Fluid Ounces (fl oz)</option>
                      <option value="L">Liters (L)</option>
                      <option value="ml">Milliliters (ml)</option>
                    </optgroup>
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditPcsPerPound("");
                                        setShowSecondaryConversion(false);
                                      }}
                                      className="text-red-500 hover:text-red-700 ml-1"
                                      title="Remove Pack Size"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>

                                  {editConversions.map((conv, idx) => (
                                    <div key={idx} className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={conv.ratio || ""}
                                        onChange={(e) => {
                                          const newConvs = [...editConversions];
                                          newConvs[idx].ratio = e.target.value;
                                          setEditConversions(newConvs);
                                        }}
                                        className="bg-white border border-neutral-200 rounded-xl px-1.5 py-1 text-[10px] font-bold font-mono w-14 focus:outline-hidden"
                                      />
                                      <span className="text-[10px] font-bold text-neutral-600 bg-neutral-100 px-1 rounded truncate max-w-[40px] text-center" title="Default Unit">{editUnit || "unit"}</span>
                                      <span className="text-[9px] font-sans text-neutral-500 font-bold whitespace-nowrap px-0.5">per</span>
                                      <select
                                        value={conv.targetUnit}
                                        onChange={(e) => {
                                          const newConvs = [...editConversions];
                                          newConvs[idx].targetUnit = e.target.value;
                                          setEditConversions(newConvs);
                                        }}
                                        className="bg-white border border-neutral-200 rounded-xl px-1.5 py-1 text-[10px] font-bold focus:outline-hidden w-16 text-center cursor-pointer"
                                      >
                                        <option value="" disabled>Select...</option>
                                        <optgroup label="Count / Packaging">
                      <option value="pcs">Pieces (pcs)</option>
                      <option value="pack">Pack</option>
                      <option value="box">Box</option>
                      <option value="case">Case</option>
                      <option value="bag">Bag</option>
                      <option value="can">Can</option>
                      <option value="bottle">Bottle</option>
                      <option value="jar">Jar</option>
                      <option value="bunch">Bunch</option>
                      <option value="head">Head</option>
                      <option value="unit">Unit</option>
                    </optgroup>
                    <optgroup label="Weight">
                      <option value="lb">Pounds (lb)</option>
                      <option value="lbs">Pounds (lbs)</option>
                      <option value="oz">Ounces (oz)</option>
                      <option value="g">Grams (g)</option>
                      <option value="kg">Kilograms (kg)</option>
                    </optgroup>
                    <optgroup label="Volume">
                      <option value="gal">Gallons (gal)</option>
                      <option value="fl oz">Fluid Ounces (fl oz)</option>
                      <option value="L">Liters (L)</option>
                      <option value="ml">Milliliters (ml)</option>
                    </optgroup>
                                      </select>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newConvs = [...editConversions];
                                          newConvs.splice(idx, 1);
                                          setEditConversions(newConvs);
                                        }}
                                        className="text-red-500 hover:text-red-700 ml-1"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
                                  
                                  <div className="flex items-center gap-1 mt-1">
                                    <button
                                      type="button"
                                      onClick={() => setEditConversions([...editConversions, { ratio: "", targetUnit: "" }])}
                                      className="text-[9px] font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-0.5 cursor-pointer"
                                    >
                                      <Plus className="h-2 w-2" />
                                      Add more packaging
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setShowSecondaryConversion(true)}
                                    className="text-[9px] font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <Plus className="h-2 w-2" />
                                    Add packaging (e.g. per Box)
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <span className="font-mono text-neutral-900/80">
                                {hasEquivWeight ? (
                                  <span className="text-emerald-700 font-bold block whitespace-nowrap text-[9px]">
                                    Weight: {ing.weightPerCase} {ing.weightPerCaseUnit}
                                  </span>
                                ) : !MASS_VOLUME_UNITS.includes((ing.unit || "").toLowerCase()) ? (
                                  <span className="text-red-700 font-semibold text-[9px] whitespace-nowrap">
                                    Manual weight needed ⚠️
                                  </span>
                                ) : (
                                  <span className="text-neutral-400 font-normal italic whitespace-nowrap text-[9px]">
                                    Sourced from unit size
                                  </span>
                                )}
                              </span>
                              {!hasEquivWeight && ing.pcsPerPound !== undefined && ing.pcsPerPound > 0 && (
                                <span className="block text-[9px] font-sans font-bold text-neutral-600 whitespace-nowrap">
                                  📦 {ing.pcsPerPound} {ing.unit || "unit"} / {ing.packagingUnit || "Box"}
                                </span>
                              )}
                              {ing.conversions?.map((conv, idx) => (
                                <span key={idx} className="block text-[9px] font-sans font-bold text-neutral-600 whitespace-nowrap">
                                  📦 {conv.ratio} {ing.unit || "unit"} / {conv.targetUnit}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Usability Yield % Column */}
                        <td className="px-4 py-3 border-r border-neutral-200">
                          {isEditing ? (
                            <div className="flex items-center gap-1 w-20">
                              <input
                                type="number"
                                min="1"
                                max="100"
                                step="1"
                                value={editUsabilityPercentage}
                                onChange={(e) => setEditUsabilityPercentage(e.target.value)}
                                className="bg-white border border-neutral-200 rounded-xl px-2 py-1 text-xs font-bold font-mono text-right w-12 focus:outline-hidden"
                              />
                              <span className="font-bold font-mono">%</span>
                            </div>
                          ) : (
                            <div>
                              <span className="font-mono text-neutral-900 font-bold block">
                                {ing.usabilityPercentage !== undefined ? ing.usabilityPercentage : 100}%
                              </span>
                              {ing.usabilityPercentage !== undefined && ing.usabilityPercentage < 100 && (
                                <span className="block text-[8px] font-sans text-amber-800 font-semibold leading-none mt-0.5 whitespace-nowrap">
                                  {100 - ing.usabilityPercentage}% prep waste
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Standard Rate (Purchased AP vs Yield EP) Column */}
                        <td className="px-4 py-3 text-right font-mono text-neutral-900 border-r border-neutral-200">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1 select-none">
                              <span className="text-neutral-900/60 font-bold">$</span>
                              <input
                                type="number"
                                step="0.00001"
                                value={editRateValue}
                                onChange={(e) => handleRateChange(e.target.value, editRateUnit)}
                                className="bg-white border border-neutral-200 rounded-xl px-2 py-1 text-xs font-bold font-mono text-right w-24 focus:outline-hidden"
                              />
                              <span className="text-xs font-bold text-neutral-600 font-mono whitespace-nowrap">
                                / {editRateUnit}
                              </span>
                            </div>
                          ) : (
                            <>
                              <div className="leading-tight">
                                <span className="font-bold">${displayRateVal.toFixed(5)}</span> 
                                 <span className="text-[9px] font-bold text-neutral-900/55 ml-1">
                                  / {displayUnitLabel} <span className="opacity-70">(AP)</span>
                                </span>
                              </div>
                              {ing.usabilityPercentage !== undefined && ing.usabilityPercentage < 100 && ing.usabilityPercentage > 0 ? (
                                <div className="leading-tight mt-1 text-[10px] text-emerald-800 whitespace-nowrap">
                                  <span className="font-bold">${(displayRateVal / (ing.usabilityPercentage / 100)).toFixed(5)}</span>
                                  <span className="text-[8px] font-bold text-emerald-800/70 ml-1">
                                    / {displayUnitLabel} <span className="underline">(EP)</span>
                                  </span>
                                </div>
                              ) : null}
                            </>
                          )}
                        </td>

                        <td className="px-4 py-3 border-r border-neutral-200">
                          {isEditing ? (
                            <div className="space-y-1 w-36">
                              <select
                                value={editVendor || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditVendor(val);
                                }}
                                className="w-full bg-white border border-neutral-200 rounded-xl px-2 py-1 text-xs font-bold focus:outline-hidden cursor-pointer"
                              >
                                <option value="" disabled>Supplier...</option>
                                {vendorsList.map(v => (
                                  <option key={v} value={v}>{v}</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div className="text-left">
                              <span className="inline-block bg-[#f0efeb] text-neutral-900 font-mono font-bold px-2 py-0.5 border border-neutral-200/20 rounded-xl text-[8px] ">
                                {getIngredientVendor(ing)}
                              </span>
                              <div className="text-[9px] font-mono text-neutral-900/60 mt-1 flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{new Date(ing.updatedAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => ing.id && handleEditSave(ing.id)}
                                className="p-1 px-2.5 bg-emerald-600 hover:bg-neutral-800 text-white font-bold rounded-xl border border-neutral-200 flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Save className="h-3.5 w-3.5" />
                                <span className="text-[10px] font-bold ">Save</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="p-1 px-2.5 bg-white hover:bg-[#f0efeb] text-neutral-900 font-bold rounded-xl border border-neutral-200 flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <X className="h-3.5 w-3.5" />
                                <span className="text-[10px] font-bold ">Cancel</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1.5">
                              {isReadOnly ? (
                                <div className="p-1.5 text-neutral-400" title="Read Only">
                                  <Lock className="h-3.5 w-3.5" />
                                </div>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleEditInit(ing)}
                                    className="p-1.5 text-neutral-900 hover:text-black border border-transparent hover:border-neutral-200 hover:bg-[#f0efeb] rounded-xl transition-colors cursor-pointer"
                                    title="Edit"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => ing.id && setShowHistoryId(ing.id)}
                                    className="p-1.5 text-blue-600 hover:text-blue-700 border border-transparent hover:border-blue-200 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                                    title="Purchase History"
                                  >
                                    <History className="h-3.5 w-3.5" />
                                  </button>
                                  {itemToDeleteId === ing.id ? (
                                    <div className="flex items-center gap-1 border border-red-200 rounded-xl bg-red-50 p-0.5">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (ing.id) {
                                            await onDeleteIngredient(ing.id);
                                            setItemToDeleteId(null);
                                          }
                                        }}
                                        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-[9px] font-bold rounded-lg transition-colors cursor-pointer"
                                        title="Confirm Delete"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setItemToDeleteId(null)}
                                        className="px-2 py-1 bg-white hover:bg-neutral-100 text-neutral-700 text-[9px] font-bold rounded-lg border border-neutral-200 transition-colors cursor-pointer"
                                        title="Cancel"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => ing.id && setItemToDeleteId(ing.id)}
                                      className="p-1.5 text-red-600 hover:text-red-700 border border-transparent hover:border-red-400 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                                      title="Delete"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                      {isEditing && (
                        <tr className="bg-[#fcfaf7]">
                          <td colSpan={8} className="px-4 py-3 bg-[#fbfaf8] border-b border-neutral-200 text-left">
                            <div className="border border-neutral-200 rounded-xl p-4 bg-white shadow-xs max-w-3xl">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-bold text-[10px] text-neutral-800 uppercase tracking-wider">
                                  Master Ingredient Information
                                </span>
                              </div>
                              <p className="text-[11px] font-normal text-neutral-600">
                                You are currently editing a Master Ingredient. Any changes made here to the price, base quantity, unit, or yield will automatically propagate to all recipes and inventory calculations that rely on this ingredient. Ensure the price reflects the exact base quantity specified above.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row gap-2 items-center justify-between border border-neutral-200 p-3 bg-[#f0efeb] font-sans text-xs font-bold text-neutral-900">
              <div>
                Showing <span className="font-mono">{startIndex + 1}</span> to{" "}
                <span className="font-mono">
                  {Math.min(startIndex + itemsPerPage, activeList.length)}
                </span>{" "}
                of <span className="font-mono">{activeList.length}</span> items
              </div>
              <div className="flex flex-wrap items-center gap-1.5 font-mono">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 bg-white border border-neutral-200 text-[10px] font-bold hover:bg-neutral-100 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Prev
                </button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const pageNum = i + 1;
                  const isNear = Math.abs(currentPage - pageNum) <= 1;
                  const isFirstOrLast = pageNum === 1 || pageNum === totalPages;
                  
                  if (!isNear && !isFirstOrLast) {
                    if (pageNum === 2 && currentPage > 3) {
                      return <span key="ellipsis-prev" className="px-1 text-neutral-400 select-none">...</span>;
                    }
                    if (pageNum === totalPages - 1 && currentPage < totalPages - 2) {
                      return <span key="ellipsis-next" className="px-1 text-neutral-400 select-none">...</span>;
                    }
                    return null;
                  }

                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1.5 border border-neutral-200 font-bold text-[10px] transition-colors cursor-pointer ${
                        currentPage === pageNum
                          ? "bg-emerald-600 text-white"
                          : "bg-white text-neutral-900 hover:bg-neutral-100"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 bg-white border border-neutral-200 text-[10px] font-bold hover:bg-neutral-100 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      );
    })()}

      <BulkPriceUpdateModal
        isOpen={showBulkPriceModal}
        onClose={() => setShowBulkPriceModal(false)}
        ingredients={ingredients}
        onEditIngredient={onEditIngredient}
        isReadOnly={isReadOnly}
      />
      {showHistoryId && (
        <PurchaseHistoryModal
          ingredient={ingredients.find(i => i.id === showHistoryId)!}
          invoices={invoices}
          groceryPurchases={groceryPurchases}
          onClose={() => setShowHistoryId(null)}
        />
      )}
    </div>
  );
}

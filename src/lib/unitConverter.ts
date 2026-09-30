import { Ingredient } from "../types";
/**
 * Precise weights and volume conversion utilities.
 * Base Storage units are:
 * - Weight: gram (g)
 * - Volume: milliliter (ml)
 * - Counts: pieces (pcs) or packs
 *
 * Pounds (lb) conversion factor: 1 lb = 453.59237 g
 * Ounces (oz) conversion factor: 1 oz = 28.3495231 g
 */

export function getGramsOrMlEquivalent(quantity: number, unit: string): number {
  if (!quantity || isNaN(quantity)) return 0;
  const cleanUnit = (unit || "g").toLowerCase().trim();
  const normalizedUnit = cleanUnit.replace(/\/(pack|case|box|bag|can|bottle|unit|ea|each|pcs|pc|ct)s?$/i, "").trim();
  switch (normalizedUnit) {
    case "kg":
    case "kilogram":
    case "kilograms":
      return quantity * 1000;
    case "l":
    case "liter":
    case "liters":
      return quantity * 1000;
    case "oz":
    case "ounce":
    case "ounces":
      return quantity * 28.3495231;
    case "lb":
    case "lbs":
    case "pound":
    case "pounds":
      return quantity * 453.59237;
    case "gal":
    case "gallon":
    case "gallons":
      return quantity * 3785.41178;
    case "fl oz":
    case "floz":
    case "fluid ounce":
    case "fluid ounces":
      return quantity * 29.5735296;
    case "qt":
    case "quart":
    case "quarts":
      return quantity * 946.352946;
    case "pt":
    case "pint":
    case "pints":
      return quantity * 473.176473;
    case "cup":
    case "cups":
      return quantity * 236.588236;
    case "tbsp":
    case "tablespoon":
    case "tablespoons":
      return quantity * 14.7867648;
    case "tsp":
    case "teaspoon":
    case "teaspoons":
      return quantity * 4.92892159;
    case "g":
    case "gram":
    case "grams":
    case "ml":
    case "milliliter":
    case "milliliters":
    case "pcs":
    case "piece":
    case "pieces":
    case "pack":
    case "bag":
    default:
      return quantity;
  }
}

export function convertFromGrams(grams: number, targetUnit: string): number {
  if (!grams || isNaN(grams)) return 0;
  const cleanUnit = (targetUnit || "g").toLowerCase().trim();
  const normalizedUnit = cleanUnit.replace(/\/(pack|case|box|bag|can|bottle|unit|ea|each|pcs|pc|ct)s?$/i, "").trim();
  switch (normalizedUnit) {
    case "kg":
    case "kilogram":
    case "kilograms":
      return grams / 1000;
    case "l":
    case "liter":
    case "liters":
      return grams / 1000;
    case "oz":
    case "ounce":
    case "ounces":
      return grams / 28.3495231;
    case "lb":
    case "lbs":
    case "pound":
    case "pounds":
      return grams / 453.59237;
    case "gal":
    case "gallon":
    case "gallons":
      return grams / 3785.41178;
    case "fl oz":
    case "floz":
    case "fluid ounce":
    case "fluid ounces":
      return grams / 29.5735296;
    case "qt":
    case "quart":
    case "quarts":
      return grams / 946.352946;
    case "pt":
    case "pint":
    case "pints":
      return grams / 473.176473;
    case "cup":
    case "cups":
      return grams / 236.588236;
    case "tbsp":
    case "tablespoon":
    case "tablespoons":
      return grams / 14.7867648;
    case "tsp":
    case "teaspoon":
    case "teaspoons":
      return grams / 4.92892159;
    default:
      return grams;
  }
}

export function getFormattedBaseUnitInfo(
  grams: number,
  ing: {
    unit: string;
    weightPerCase?: number;
    weightPerCaseUnit?: string;
    packagingUnit?: string;
    pcsPerPound?: number;
  }
): string {
  if (!ing || !grams || grams <= 0) return "";

  const unitClean = (ing.unit || "g").toLowerCase().trim();
  const weightUnit = (ing.weightPerCaseUnit || "lb").toLowerCase().trim();
  const isCount = isPcsUnit(unitClean);

  if (ing.weightPerCase && ing.weightPerCase > 0) {
    const caseGrams = getGramsOrMlEquivalent(ing.weightPerCase, weightUnit);
    if (caseGrams > 0) {
      const numCases = grams / caseGrams;
      const numCasesFormatted =
        numCases % 1 === 0
          ? numCases.toString()
          : numCases < 1
          ? numCases.toFixed(3)
          : numCases.toFixed(2);

      const totalWeight = convertFromGrams(grams, weightUnit);
      const totalWeightFormatted =
        totalWeight % 1 === 0
          ? totalWeight.toString()
          : totalWeight < 1
          ? totalWeight.toFixed(2)
          : totalWeight.toFixed(1);

      const rawPkg = ing.packagingUnit || (["g", "kg", "ml", "l", "oz", "lb", "lbs"].includes(unitClean) ? "box" : unitClean);
      const pkgName = rawPkg === "boxes" ? "box" : rawPkg === "cases" ? "case" : rawPkg === "bags" ? "bag" : rawPkg === "packs" ? "pack" : rawPkg;

      const pluralPkg = pkgName === "box" ? "boxes" : `${pkgName}s`;
      const displayPkg = numCases > 1 ? pluralPkg : pkgName;

      return `${numCasesFormatted} ${displayPkg} (${totalWeightFormatted}${weightUnit})`;
    }
  }

  if (ing.packagingUnit && ing.pcsPerPound && ing.pcsPerPound > 0) {
    const numPacks = grams / ing.pcsPerPound;
    const packsFormatted = numPacks % 1 === 0 ? numPacks.toString() : numPacks.toFixed(2);
    return `${packsFormatted} ${ing.packagingUnit}`;
  }

  if (unitClean !== "g" && !isCount) {
    const qtyInUnit = convertFromGrams(grams, unitClean);
    const qtyFormatted = qtyInUnit % 1 === 0 ? qtyInUnit.toString() : qtyInUnit < 1 ? qtyInUnit.toFixed(3) : qtyInUnit.toFixed(2);
    return `${qtyFormatted} ${ing.unit}`;
  }

  return "";
}

export function extractWeightSpecFromName(name?: string): { weight: number; unit: string } | null {
  if (!name || typeof name !== "string") return null;
  const cleanName = name.trim();
  
  // Match multi-pack patterns like "12x500g", "4x5lb", "6x1gal", "24x12oz", "10x1lb"
  const multiPackMatch = cleanName.match(/(\d+)\s*[xX*]\s*(\d+(?:\.\d+)?)\s*(lb|lbs|pound|pounds|#|kg|kilogram|g|gram|oz|ounce|gal|gallon|l|liter|ml)\b/i);
  if (multiPackMatch) {
    const packCount = parseFloat(multiPackMatch[1]);
    const singleWeight = parseFloat(multiPackMatch[2]);
    const rawUnit = multiPackMatch[3].toLowerCase();
    let normUnit = "lb";
    if (["lb", "lbs", "pound", "pounds", "#"].includes(rawUnit)) normUnit = "lb";
    else if (["kg", "kilogram"].includes(rawUnit)) normUnit = "kg";
    else if (["g", "gram"].includes(rawUnit)) normUnit = "g";
    else if (["oz", "ounce"].includes(rawUnit)) normUnit = "oz";
    else if (["gal", "gallon"].includes(rawUnit)) normUnit = "gal";
    else if (["l", "liter"].includes(rawUnit)) normUnit = "L";
    else if (["ml"].includes(rawUnit)) normUnit = "ml";
    
    if (packCount > 0 && singleWeight > 0) {
      return { weight: packCount * singleWeight, unit: normUnit };
    }
  }

  // Match single weight patterns like "50lb", "50 lbs", "50#", "25kg", "500g", "1 Gallon", "5 Gal", "16 oz", "5L"
  const singleWeightMatch = cleanName.match(/(\d+(?:\.\d+)?)\s*(lb|lbs|pound|pounds|#|kg|kilogram|g|gram|oz|ounce|gal|gallon|l|liter|ml)\b/i);
  if (singleWeightMatch) {
    const weightVal = parseFloat(singleWeightMatch[1]);
    const rawUnit = singleWeightMatch[2].toLowerCase();
    let normUnit = "lb";
    if (["lb", "lbs", "pound", "pounds", "#"].includes(rawUnit)) normUnit = "lb";
    else if (["kg", "kilogram"].includes(rawUnit)) normUnit = "kg";
    else if (["g", "gram"].includes(rawUnit)) normUnit = "g";
    else if (["oz", "ounce"].includes(rawUnit)) normUnit = "oz";
    else if (["gal", "gallon"].includes(rawUnit)) normUnit = "gal";
    else if (["l", "liter"].includes(rawUnit)) normUnit = "L";
    else if (["ml"].includes(rawUnit)) normUnit = "ml";
    
    if (weightVal > 0) {
      return { weight: weightVal, unit: normUnit };
    }
  }

  return null;
}

export function calculatePoundData(
  count: number,
  unit: string,
  weightPerCase?: number,
  weightPerCaseUnit?: string,
  pcsPerPound?: number,
  quantity?: number,
  itemName?: string
): { lbs: number; hasWeightSpec: boolean; label: string } {
  if (count === undefined || count === null || isNaN(count)) {
    return { lbs: 0, hasWeightSpec: false, label: "0.00 lbs" };
  }

  const cleanUnit = (unit || "g").toLowerCase().trim();

  // 1. Directly in Pounds
  if (["lb", "lbs", "pound", "pounds"].includes(cleanUnit)) {
    return { lbs: count, hasWeightSpec: true, label: `${count.toFixed(2)} lbs` };
  }

  // 2. Ounces
  if (["oz", "ounce", "ounces"].includes(cleanUnit)) {
    const lbs = count / 16;
    return { lbs, hasWeightSpec: true, label: `${lbs.toFixed(2)} lbs` };
  }

  // 3. Grams
  if (["g", "gram", "grams"].includes(cleanUnit)) {
    const lbs = count / 453.59237;
    return { lbs, hasWeightSpec: true, label: `${lbs.toFixed(2)} lbs` };
  }

  // 4. Kilograms
  if (["kg", "kilogram", "kilograms"].includes(cleanUnit)) {
    const lbs = (count * 1000) / 453.59237;
    return { lbs, hasWeightSpec: true, label: `${lbs.toFixed(2)} lbs` };
  }

  // 5. Volume units (mL, L, fl oz)
  if (["ml", "milliliter", "milliliters"].includes(cleanUnit)) {
    const lbs = count / 453.59237;
    return { lbs, hasWeightSpec: true, label: `${lbs.toFixed(2)} lbs (vol eq.)` };
  }
  if (["l", "liter", "liters"].includes(cleanUnit)) {
    const lbs = (count * 1000) / 453.59237;
    return { lbs, hasWeightSpec: true, label: `${lbs.toFixed(2)} lbs (vol eq.)` };
  }

  // Fallback to extract weight spec from item name if weightPerCase is missing
  let effectiveWeight = weightPerCase;
  let effectiveWeightUnit = weightPerCaseUnit || "lb";
  if ((!effectiveWeight || effectiveWeight <= 0) && itemName) {
    const extracted = extractWeightSpecFromName(itemName);
    if (extracted) {
      effectiveWeight = extracted.weight;
      effectiveWeightUnit = extracted.unit;
    }
  }

  // 6. Pack / Pcs / Case / Box / Bag / Bottle / Can / Container / Each / Ct
  if (effectiveWeight && effectiveWeight > 0) {
    const gramsPerPack = getGramsOrMlEquivalent(effectiveWeight, effectiveWeightUnit || "lb");
    const lbsPerPack = gramsPerPack / 453.59237;
    const totalLbs = count * lbsPerPack;
    return { lbs: totalLbs, hasWeightSpec: true, label: `${totalLbs.toFixed(2)} lbs` };
  }

  if (pcsPerPound && pcsPerPound > 0) {
    // pcsPerPound represents "units per package" (e.g. 30 lbs per pack, or 30 oz per pack)
    const totalUnits = count * pcsPerPound;
    const grams = getGramsOrMlEquivalent(totalUnits, unit);
    const totalLbs = grams / 453.59237;
    return { lbs: totalLbs, hasWeightSpec: true, label: `${totalLbs.toFixed(2)} lbs` };
  }

  return { lbs: 0, hasWeightSpec: false, label: "Unspecified" };
}


export function convertInputToNativeQty(
  qtyNum: number,
  selUnit: string,
  ingredient: Ingredient
): number {
  if (isNaN(qtyNum) || qtyNum <= 0) return 0;
  const selClean = (selUnit || "").toLowerCase().trim();
  const nativeClean = (ingredient.unit || "lbs").toLowerCase().trim();

  // 1. Exact Match
  if (selClean === nativeClean) return qtyNum;

  // 2. Custom Conversions Match FIRST
  if (ingredient.conversions && ingredient.conversions.length > 0) {
    const match = ingredient.conversions.find(c => c.targetUnit && c.targetUnit.toLowerCase().trim() === selClean);
    if (match && match.ratio > 0) {
      return qtyNum * match.ratio;
    }
  }

  // 3. Packaging Unit Match
  if (ingredient.packagingUnit && selClean === ingredient.packagingUnit.toLowerCase().trim()) {
    if (ingredient.pcsPerPound && ingredient.pcsPerPound > 0) {
      return qtyNum * ingredient.pcsPerPound;
    }
  }

  // Semantic groupings
  const isSelBox = ["box", "boxes", "case", "cases"].includes(selClean);
  const isSelPack = ["pack", "packs", "bag", "bags"].includes(selClean);
  const isSelPcs = ["pcs", "piece", "pieces"].includes(selClean);
  const isSelLb = ["lb", "lbs", "pound", "pounds"].includes(selClean);

  const isNativeBox = ["box", "boxes", "case", "cases"].includes(nativeClean);
  const isNativePack = ["pack", "packs", "bag", "bags", "container"].includes(nativeClean);
  const isNativePcs = ["pcs", "piece", "pieces"].includes(nativeClean);
  const isNativeLb = ["lb", "lbs", "pound", "pounds"].includes(nativeClean);

  // If semantically matched the native unit
  if (
    (isSelBox && isNativeBox) ||
    (isSelPack && isNativePack) ||
    (isSelPcs && isNativePcs) ||
    (isSelLb && isNativeLb)
  ) {
    return qtyNum;
  }

  const packsPerBox = ingredient.pcsPerPound && ingredient.pcsPerPound > 0 ? ingredient.pcsPerPound : undefined;
  const lbsPerBoxOrPack = ingredient.weightPerCase && ingredient.weightPerCase > 0 ? ingredient.weightPerCase : undefined;
  
  // Example: 24 lbs per box, 12 packs per box => 2 lbs per pack.
  // wait, weightPerCase is usually lbs per box!
  // pcsPerPound is usually packs per box!
  
  // Selected unit is BOX
  if (isSelBox) {
    if (isNativePack || isNativePcs) {
      const multiplier = packsPerBox || lbsPerBoxOrPack || 1;
      return qtyNum * multiplier;
    }
    if (isNativeLb) {
      const multiplier = lbsPerBoxOrPack || packsPerBox || 1;
      return qtyNum * multiplier;
    }
    const multiplier = packsPerBox || lbsPerBoxOrPack || 1;
    return qtyNum * multiplier;
  }

  // Selected unit is PACK or PCS
  if (isSelPack || isSelPcs) {
    if (isNativeBox) {
      const divisor = packsPerBox || 1;
      return qtyNum / divisor;
    }
    if (isNativeLb) {
      // e.g. Native is lb, selected is pack. 
      // If we have weightPerCase=24 (lbs/box) and packsPerBox=12 (packs/box). 
      // 1 pack = 24/12 = 2 lbs.
      if (lbsPerBoxOrPack && packsPerBox) {
         return qtyNum * (lbsPerBoxOrPack / packsPerBox);
      }
      if (lbsPerBoxOrPack) {
         // We only have lbsPerBox. If native is lbs and selected is pack... maybe weightPerCase is per pack!
         return qtyNum * lbsPerBoxOrPack; 
      }
      if (packsPerBox) {
         return qtyNum / packsPerBox; // fallback...
      }
      return qtyNum;
    }
  }

  // Selected unit is LBS
  if (isSelLb) {
    if (isNativeBox) {
      const divisor = lbsPerBoxOrPack || packsPerBox || 1;
      return qtyNum / divisor;
    }
    if (isNativePack || isNativePcs) {
      if (lbsPerBoxOrPack && packsPerBox) {
        return qtyNum / (lbsPerBoxOrPack / packsPerBox);
      }
      if (lbsPerBoxOrPack) {
        return qtyNum / lbsPerBoxOrPack;
      }
      const lbsPerPack = calculatePoundData(
        1,
        ingredient.unit || "unit",
        ingredient.weightPerCase,
        ingredient.weightPerCaseUnit,
        ingredient.pcsPerPound,
        ingredient.quantity
      ).lbs;
      if (lbsPerPack > 0) {
        return qtyNum / lbsPerPack;
      }
      const divisor = packsPerBox || 1;
      return qtyNum / divisor;
    }
  }

  return qtyNum;
}

export const MASS_VOLUME_UNITS = [
  "g", "kg", "ml", "l", "oz", "lb", "lbs",
  "ounce", "ounces", "pound", "pounds", "gram", "grams",
  "liter", "liters", "milliliter", "milliliters", "kilogram", "kilograms",
  "gal", "gallon", "gallons", "fl oz", "floz", "fluid ounce", "fluid ounces",
  "qt", "quart", "quarts", "pt", "pint", "pints", "cup", "cups",
  "tbsp", "tablespoon", "tablespoons", "tsp", "teaspoon", "teaspoons"
];

export function calculateIngredientUnitPrice(ing: {
  price: number;
  quantity: number;
  unit: string;
  weightPerCase?: number;
  weightPerCaseUnit?: string;
  pcsPerPound?: number;
  conversions?: Array<{ ratio: number; targetUnit: string }>;
  pricePerGram?: number;
}): number {
  if (!ing) return 0;
  const price = typeof ing.price === "number" && !isNaN(ing.price) ? ing.price : 0;
  const qty = typeof ing.quantity === "number" && ing.quantity > 0 ? ing.quantity : 1;
  const cleanUnit = (ing.unit || "g").toLowerCase().trim();
  const isDiscreteUnit = !MASS_VOLUME_UNITS.includes(cleanUnit);
  const isPiece = ["pcs", "pc", "ea", "each", "piece", "pieces", "ct", "count"].includes(cleanUnit);

  // 1. Standard mass/volume unit conversion (takes priority if unit is mass/volume)
  if (!isDiscreteUnit) {
    const totalGramsOrMl = getGramsOrMlEquivalent(qty, ing.unit);
    if (totalGramsOrMl > 0) return price / totalGramsOrMl;
  }

  // 2. If discrete unit (e.g. box, case) has custom weight per case/box (e.g. 1 box = 10 lbs)
  if (isDiscreteUnit && ing.weightPerCase && ing.weightPerCase > 0) {
    const baseEqPerCase = getGramsOrMlEquivalent(ing.weightPerCase, ing.weightPerCaseUnit || "lb");
    const totalGrams = qty * baseEqPerCase;
    if (totalGrams > 0) return price / totalGrams;
  }

  // 3. If discrete unit has pcsPerPound / pack size
  if (isDiscreteUnit && ing.pcsPerPound && ing.pcsPerPound > 0) {
    if (isPiece) {
      return price / qty;
    } else {
      return price / (qty * ing.pcsPerPound);
    }
  }

  // 4. Piece / count unit
  if (isPiece) {
    return price / qty;
  }

  // 5. Container unit (box, case, pack, bag, etc.) with no weight or pack size
  if (qty > 0) {
    return price / qty;
  }

  return ing.pricePerGram || 0;
}

export function isPcsUnit(unit?: string): boolean {
  if (!unit) return false;
  const clean = unit.toLowerCase().trim();
  return ["pcs", "pc", "ea", "each", "piece", "pieces", "pack", "ct", "count"].includes(clean);
}

const MASS_UNITS = ["lb", "lbs", "pound", "pounds", "oz", "ounce", "ounces", "g", "gram", "grams", "kg", "kilogram", "kilograms"];
const VOL_UNITS = ["ml", "milliliter", "milliliters", "l", "liter", "liters", "fl oz", "gal", "gallon", "gallons", "qt", "pt"];
const PIECE_UNITS = ["pcs", "pc", "ea", "each", "piece", "pieces", "ct", "count"];
const PACK_UNITS = ["pack", "packs", "package", "packages", "box", "boxes", "case", "cases", "bag", "bags", "container", "containers", "bottle", "bottles", "can", "cans"];

function isMassUnit(unit?: string): boolean {
  if (!unit) return false;
  return MASS_UNITS.includes(unit.toLowerCase().trim());
}

function isVolumeUnit(unit?: string): boolean {
  if (!unit) return false;
  return VOL_UNITS.includes(unit.toLowerCase().trim());
}

function isPieceUnit(unit?: string): boolean {
  if (!unit) return false;
  return PIECE_UNITS.includes(unit.toLowerCase().trim());
}

function isPackageUnit(unit?: string): boolean {
  if (!unit) return false;
  return PACK_UNITS.includes(unit.toLowerCase().trim());
}

export function getConsumptionQtyDetail(
  log: { quantity: number; unit?: string },
  ing?: {
    unit: string;
    weightPerCase?: number;
    weightPerCaseUnit?: string;
    pcsPerPound?: number;
    quantity?: number;
    packagingUnit?: string;
    conversions?: Array<{ ratio: number; targetUnit: string }>;
  }
): { primary: string; secondary: string; full: string } {
  const sign = log.quantity > 0 ? "-" : "+";
  const absQty = Math.abs(log.quantity);
  const logUnit = (log.unit || "lbs").trim();
  const cleanLogUnit = logUnit.toLowerCase();

  const primary = `${sign}${absQty} ${logUnit}`;

  if (!ing) return { primary, secondary: "", full: primary };

  const cleanIngUnit = (ing.unit || "").trim().toLowerCase();

  const isLogMass = isMassUnit(cleanLogUnit);
  const isLogPcs = isPieceUnit(cleanLogUnit);
  const isLogPkg = isPackageUnit(cleanLogUnit);

  const isBaseMass = isMassUnit(cleanIngUnit);
  const isBasePcs = isPieceUnit(cleanIngUnit);
  const isBasePkg = isPackageUnit(cleanIngUnit);

  const logCategory = isLogMass ? 'mass' : isLogPcs ? 'pcs' : isLogPkg ? 'pkg' : 'unknown';
  const baseCategory = isBaseMass ? 'mass' : isBasePcs ? 'pcs' : isBasePkg ? 'pkg' : 'unknown';

  let secondary = "";

  if (logCategory !== baseCategory && baseCategory !== 'unknown') {
    // Log is different from base, show BASE UNIT
    const qtyInBase = convertInputToNativeQty(absQty, cleanLogUnit, ing as any);
    if (qtyInBase > 0) {
      let formatted = qtyInBase % 1 === 0 ? qtyInBase.toString() : qtyInBase < 1 ? qtyInBase.toFixed(2) : qtyInBase.toFixed(1);
      
      if (isBaseMass) {
         let weightUnit = (ing.unit || "lb").toLowerCase().trim();
         const displayUnit = ["oz", "ounce"].includes(weightUnit) ? "oz" : ["kg", "kilogram"].includes(weightUnit) ? "kg" : "lb";
         let val = qtyInBase;
         if (weightUnit === "lb" && displayUnit === "oz") val *= 16;
         if (weightUnit === "lb" && displayUnit === "kg") val *= 0.45359237;
         formatted = val % 1 === 0 ? val.toString() : val < 1 ? val.toFixed(2) : val.toFixed(2);
         secondary = `(${sign}${formatted}${displayUnit})`;
      } else {
         const baseUnitStr = ing.unit || (isBasePcs ? "pcs" : isBasePkg ? "box" : "");
         secondary = `(${sign}${formatted} ${baseUnitStr})`;
      }
    }
  } else {
    // Log category is SAME as base category, show ANOTHER pack size
    if (baseCategory === 'mass' || baseCategory === 'pcs') {
      const pkgUnit = (ing.packagingUnit || "box").toLowerCase().trim();
      let qtyInPkg = 0;
      
      if (baseCategory === 'mass') {
        const baseGrams = getGramsOrMlEquivalent(absQty, cleanLogUnit);
        if (ing.weightPerCase && ing.weightPerCase > 0) {
          const pkgGrams = getGramsOrMlEquivalent(ing.weightPerCase, ing.weightPerCaseUnit || "lb");
          if (pkgGrams > 0) {
            qtyInPkg = baseGrams / pkgGrams;
          }
        }
      } else if (baseCategory === 'pcs') {
        const pcsPerPkg = ing.pcsPerPound || ing.quantity;
        if (pcsPerPkg && pcsPerPkg > 0) {
          qtyInPkg = absQty / pcsPerPkg;
        }
      }

      if (qtyInPkg > 0) {
        const formatted = qtyInPkg % 1 === 0 ? qtyInPkg.toString() : qtyInPkg < 1 ? qtyInPkg.toFixed(2) : qtyInPkg.toFixed(1);
        secondary = `(${sign}${formatted} ${pkgUnit})`;
      }
    } else if (baseCategory === 'pkg') {
      if (ing.pcsPerPound && ing.pcsPerPound > 0) {
         const qtyInPcs = absQty * ing.pcsPerPound;
         const formatted = qtyInPcs % 1 === 0 ? qtyInPcs.toString() : qtyInPcs.toFixed(1);
         secondary = `(${sign}${formatted} pcs)`;
      } else if (ing.weightPerCase && ing.weightPerCase > 0) {
         const caseGrams = getGramsOrMlEquivalent(ing.weightPerCase, ing.weightPerCaseUnit || "lb");
         let lbs = (caseGrams / 453.59237) * absQty;
         const formatted = lbs % 1 === 0 ? lbs.toString() : lbs < 1 ? lbs.toFixed(2) : lbs.toFixed(2);
         secondary = `(${sign}${formatted}lb)`;
      }
    }
  }

  return { primary, secondary, full: secondary ? `${primary} ${secondary}` : primary };
}



export function getBaseUnitLabel(ing?: { unit?: string } | null): string {
  if (!ing) return "g";
  const u = (ing.unit || "").toLowerCase().trim();
  if (isPcsUnit(u)) return "pcs";
  if (["oz", "ounce", "ounces", "ml", "milliliter", "milliliters", "l", "liter", "liters", "fl oz", "gal", "gallon", "gallons", "qt", "pt"].includes(u)) return "ml";
  return "g";
}

/**
 * Checks if a unit represents a physical mass / weight.
 */
export function isWeightUnit(unit: string): boolean {
  if (!unit) return false;
  const clean = unit.toLowerCase().trim().replace(/s$/, "");
  return [
    "g", "gram", "kg", "kilo", "kilogram", "oz", "ounce", "lb", "lbs", "pound", "mg"
  ].includes(clean);
}

/**
 * Converts a weight measurement into pounds (lbs) with clean rounded precision.
 */
export function convertWeightToLbs(
  quantity: number,
  unit: string
): { quantity: number; unit: string; grams: number } {
  const grams = getGramsOrMlEquivalent(quantity, unit);
  if (!grams || grams <= 0) {
    return { quantity, unit: "lbs", grams: 0 };
  }
  const lbs = grams / 453.59237;
  // Format with high precision but no unsightly floating point artifacts
  let rounded: number;
  if (lbs >= 10) {
    rounded = parseFloat(lbs.toFixed(2));
  } else if (lbs >= 1) {
    rounded = parseFloat(lbs.toFixed(3));
  } else if (lbs >= 0.01) {
    rounded = parseFloat(lbs.toFixed(3));
  } else {
    rounded = parseFloat(lbs.toFixed(4));
  }

  return {
    quantity: rounded > 0 ? rounded : quantity,
    unit: "lbs",
    grams: grams,
  };
}


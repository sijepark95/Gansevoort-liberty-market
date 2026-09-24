import React, { useState, useMemo } from "react";
import { 
  Invoice, 
  GroceryPurchase, 
  Ingredient, 
  Recipe, 
  DailySale 
} from "../types";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Download, 
  Printer, 
  Search, 
  Filter, 
  ArrowUpDown, 
  DollarSign, 
  Package, 
  Building2, 
  Receipt, 
  PieChart as PieChartIcon, 
  Clock, 
  ChevronDown, 
  Layers, 
  AlertCircle, 
  CheckCircle2, 
  FileText, 
  Eye, 
  Sparkles, 
  ShoppingBag, 
  ExternalLink,
  ChefHat
} from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell, 
  Area, 
  AreaChart 
} from "recharts";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import { isImageFile, formatFileSize } from "../lib/fileHelper";

interface ReportCenterViewProps {
  invoices: Invoice[];
  groceryPurchases: GroceryPurchase[];
  ingredients: Ingredient[];
  recipes: Recipe[];
  dailySales?: DailySale[];
  onSwitchSection?: (section: string) => void;
}

type DatePreset = "7d" | "30d" | "thisMonth" | "90d" | "ytd" | "all" | "custom";
type ActiveReportTab = "ingredients" | "vendors" | "categories" | "foodcost";

const CHART_COLORS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#64748b", // slate
];

export const ReportCenterView: React.FC<ReportCenterViewProps> = ({
  invoices = [],
  groceryPurchases = [],
  ingredients = [],
  recipes = [],
  dailySales = [],
  onSwitchSection
}) => {
  // Navigation & report modes
  const [activeTab, setActiveTab] = useState<ActiveReportTab>("ingredients");
  
  // Date Filtering State
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Source Filter State
  const [sourceFilter, setSourceFilter] = useState<"all" | "invoices" | "grocery">("all");

  // Specific Ingredient Tracker Filter State
  const [selectedIngredientName, setSelectedIngredientName] = useState<string>("all");
  const [ingredientSearchQuery, setIngredientSearchQuery] = useState<string>("");

  // Preview Modal for attached invoice documents
  const [previewDoc, setPreviewDoc] = useState<{
    url: string;
    name: string;
    type?: string;
    size?: number;
    title?: string;
    subtitle?: string;
  } | null>(null);

  // Sorting for transaction table
  const [sortField, setSortField] = useState<"date" | "total" | "price" | "qty">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Calculate Active Date Range Boundaries
  const dateRange = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    if (datePreset === "7d") {
      start.setDate(now.getDate() - 7);
    } else if (datePreset === "30d") {
      start.setDate(now.getDate() - 30);
    } else if (datePreset === "thisMonth") {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    } else if (datePreset === "90d") {
      start.setDate(now.getDate() - 90);
    } else if (datePreset === "ytd") {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
    } else if (datePreset === "custom") {
      start = customStartDate ? new Date(`${customStartDate}T00:00:00`) : new Date(2020, 0, 1);
      const customEnd = customEndDate ? new Date(`${customEndDate}T23:59:59`) : now;
      return { start, end: customEnd };
    } else {
      // all time
      start = new Date(2020, 0, 1);
    }
    return { start, end };
  }, [datePreset, customStartDate, customEndDate]);

  // Unified Normalization of All Purchase Transactions
  // Flattens items from both Vendor Invoices and Grocery Purchases into a normalized transaction schema
  const allPurchasedItems = useMemo(() => {
    const records: Array<{
      id: string;
      date: string; // YYYY-MM-DD
      timestamp: number;
      sourceType: "invoice" | "grocery";
      documentRef: string;
      vendorOrStore: string;
      itemName: string;
      normalizedName: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      totalCost: number;
      category: string;
      invoiceId?: string;
      fileUrl?: string;
      fileType?: string;
      fileSize?: number;
    }> = [];

    // 1. Process Invoices
    if (sourceFilter === "all" || sourceFilter === "invoices") {
      invoices.forEach(inv => {
        const rawDate = inv.issueDate || inv.createdAt?.split("T")[0] || "2026-01-01";
        // Parse date for comparison
        const parsedDate = new Date(rawDate);
        const dateStr = !isNaN(parsedDate.getTime()) ? parsedDate.toISOString().split("T")[0] : rawDate;
        const timeVal = !isNaN(parsedDate.getTime()) ? parsedDate.getTime() : 0;

        (inv.items || []).forEach((item, idx) => {
          const qty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
          const total = Number(item.totalPrice) || (Number(item.pricePerUnit) ? Number(item.pricePerUnit) * qty : 0);
          const unitRate = qty > 0 ? total / qty : total;
          const rawName = item.name || "Unnamed Item";
          const normName = rawName.toLowerCase().trim();

          records.push({
            id: `inv-${inv.id || inv.invoiceNumber || "no-id"}-${idx}`,
            date: dateStr,
            timestamp: timeVal,
            sourceType: "invoice",
            documentRef: inv.invoiceNumber ? `INV #${inv.invoiceNumber}` : (inv.fileName || "Vendor Invoice"),
            vendorOrStore: inv.vendor || "Direct Vendor",
            itemName: rawName,
            normalizedName: normName,
            quantity: qty,
            unit: item.unit || "case",
            unitPrice: unitRate,
            totalCost: total,
            category: item.packagingUnit || "General Food Supply",
            invoiceId: inv.id,
            fileUrl: inv.fileUrl,
            fileType: inv.fileType,
            fileSize: inv.fileSize
          });
        });
      });
    }

    // 2. Process Grocery Purchases
    if (sourceFilter === "all" || sourceFilter === "grocery") {
      groceryPurchases.forEach(gp => {
        const rawDate = gp.date || gp.createdAt?.split("T")[0] || "2026-01-01";
        const parsedDate = new Date(rawDate);
        const dateStr = !isNaN(parsedDate.getTime()) ? parsedDate.toISOString().split("T")[0] : rawDate;
        const timeVal = !isNaN(parsedDate.getTime()) ? parsedDate.getTime() : 0;

        (gp.items || []).forEach((item, idx) => {
          const qty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
          const total = Number(item.price) || 0;
          const unitRate = item.unitPrice || (qty > 0 ? total / qty : total);
          const rawName = item.name || "Unnamed Grocery Item";
          const normName = rawName.toLowerCase().trim();

          records.push({
            id: `gro-${gp.id || "no-id"}-${idx}`,
            date: dateStr,
            timestamp: timeVal,
            sourceType: "grocery",
            documentRef: gp.receiptNumber ? `REC #${gp.receiptNumber}` : (gp.storeName || "Store Receipt"),
            vendorOrStore: gp.storeName || "Retail Grocery",
            itemName: rawName,
            normalizedName: normName,
            quantity: qty,
            unit: item.unit || "unit",
            unitPrice: unitRate,
            totalCost: total,
            category: item.category || "Grocery Produce & Dry",
          });
        });
      });
    }

    return records;
  }, [invoices, groceryPurchases, sourceFilter]);

  // Filter Transactions by Date Range
  const filteredPurchases = useMemo(() => {
    const { start, end } = dateRange;
    const startMs = start.getTime();
    const endMs = end.getTime();

    return allPurchasedItems.filter(p => {
      if (!p.timestamp) return true;
      return p.timestamp >= startMs && p.timestamp <= endMs;
    });
  }, [allPurchasedItems, dateRange]);

  // Distinct Unique Ingredients with Purchase Frequencies
  const distinctIngredients = useMemo(() => {
    const map = new Map<string, { displayName: string; count: number; totalCost: number }>();
    allPurchasedItems.forEach(p => {
      const key = p.normalizedName;
      if (!map.has(key)) {
        map.set(key, { displayName: p.itemName, count: 0, totalCost: 0 });
      }
      const item = map.get(key)!;
      item.count += 1;
      item.totalCost += p.totalCost;
    });

    // Also include catalog ingredients even if no purchases yet
    ingredients.forEach(ing => {
      const key = ing.name.toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, { displayName: ing.name, count: 0, totalCost: 0 });
      }
    });

    return Array.from(map.entries())
      .map(([key, val]) => ({
        key,
        name: val.displayName,
        count: val.count,
        totalCost: val.totalCost
      }))
      .sort((a, b) => b.totalCost - a.totalCost || b.count - a.count);
  }, [allPurchasedItems, ingredients]);

  // Filtered for currently selected ingredient
  const ingredientTransactions = useMemo(() => {
    let result = filteredPurchases;
    if (selectedIngredientName !== "all") {
      result = result.filter(p => p.normalizedName.includes(selectedIngredientName.toLowerCase().trim()) || selectedIngredientName.toLowerCase().trim().includes(p.normalizedName));
    }
    if (ingredientSearchQuery.trim()) {
      const q = ingredientSearchQuery.toLowerCase().trim();
      result = result.filter(p => p.itemName.toLowerCase().includes(q) || p.vendorOrStore.toLowerCase().includes(q));
    }

    // Sort
    return [...result].sort((a, b) => {
      if (sortField === "date") {
        return sortOrder === "asc" ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
      }
      if (sortField === "total") {
        return sortOrder === "asc" ? a.totalCost - b.totalCost : b.totalCost - a.totalCost;
      }
      if (sortField === "price") {
        return sortOrder === "asc" ? a.unitPrice - b.unitPrice : b.unitPrice - a.unitPrice;
      }
      if (sortField === "qty") {
        return sortOrder === "asc" ? a.quantity - b.quantity : b.quantity - a.quantity;
      }
      return 0;
    });
  }, [filteredPurchases, selectedIngredientName, ingredientSearchQuery, sortField, sortOrder]);

  // Aggregate Metrics for Selected Ingredient & Period
  const ingredientMetrics = useMemo(() => {
    let totalQty = 0;
    let totalSpend = 0;
    const unitPrices: number[] = [];
    const unitsSet = new Set<string>();
    const vendorsSet = new Set<string>();

    ingredientTransactions.forEach(t => {
      totalQty += t.quantity;
      totalSpend += t.totalCost;
      if (t.unitPrice > 0) unitPrices.push(t.unitPrice);
      if (t.unit) unitsSet.add(t.unit);
      if (t.vendorOrStore) vendorsSet.add(t.vendorOrStore);
    });

    const avgUnitPrice = totalQty > 0 ? totalSpend / totalQty : (unitPrices.length > 0 ? unitPrices.reduce((a, b) => a + b, 0) / unitPrices.length : 0);
    const minPrice = unitPrices.length > 0 ? Math.min(...unitPrices) : 0;
    const maxPrice = unitPrices.length > 0 ? Math.max(...unitPrices) : 0;
    const priceVariancePct = minPrice > 0 ? ((maxPrice - minPrice) / minPrice) * 100 : 0;

    return {
      totalQty,
      totalSpend,
      avgUnitPrice,
      minPrice,
      maxPrice,
      priceVariancePct,
      units: Array.from(unitsSet).join(", ") || "units",
      distinctVendorsCount: vendorsSet.size,
      orderCount: ingredientTransactions.length
    };
  }, [ingredientTransactions]);

  // Timeline / Chart Data for Ingredient Purchase History
  const ingredientTimelineChartData = useMemo(() => {
    // Group transactions by date
    const dateMap = new Map<string, { date: string; displayDate: string; totalSpend: number; totalQty: number; avgRate: number; count: number }>();

    // Sort chronologically
    const chronological = [...ingredientTransactions].sort((a, b) => a.timestamp - b.timestamp);

    chronological.forEach(t => {
      const dKey = t.date;
      if (!dateMap.has(dKey)) {
        const parts = dKey.split("-");
        const displayDate = parts.length === 3 ? `${parts[1]}/${parts[2]}` : dKey;
        dateMap.set(dKey, { date: dKey, displayDate, totalSpend: 0, totalQty: 0, avgRate: 0, count: 0 });
      }
      const entry = dateMap.get(dKey)!;
      entry.totalSpend += t.totalCost;
      entry.totalQty += t.quantity;
      entry.avgRate += t.unitPrice;
      entry.count += 1;
    });

    return Array.from(dateMap.values()).map(e => ({
      ...e,
      totalSpend: Number(e.totalSpend.toFixed(2)),
      totalQty: Number(e.totalQty.toFixed(1)),
      unitPrice: e.count > 0 ? Number((e.avgRate / e.count).toFixed(2)) : 0
    }));
  }, [ingredientTransactions]);

  // Vendor Spend Breakdown Data
  const vendorSpendData = useMemo(() => {
    const map = new Map<string, { vendor: string; totalSpend: number; orderCount: number; lastOrder: string }>();

    filteredPurchases.forEach(p => {
      const v = p.vendorOrStore || "Direct Supplier";
      if (!map.has(v)) {
        map.set(v, { vendor: v, totalSpend: 0, orderCount: 0, lastOrder: p.date });
      }
      const record = map.get(v)!;
      record.totalSpend += p.totalCost;
      record.orderCount += 1;
      if (p.date > record.lastOrder) {
        record.lastOrder = p.date;
      }
    });

    const totalAllVendors = Array.from(map.values()).reduce((acc, v) => acc + v.totalSpend, 0);

    return Array.from(map.values())
      .map(v => ({
        ...v,
        totalSpend: Number(v.totalSpend.toFixed(2)),
        sharePercentage: totalAllVendors > 0 ? Number(((v.totalSpend / totalAllVendors) * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend);
  }, [filteredPurchases]);

  // Category Breakdown Data
  const categorySpendData = useMemo(() => {
    const map = new Map<string, { category: string; totalSpend: number; itemCount: number }>();

    filteredPurchases.forEach(p => {
      let cat = p.category || "General Supplies";
      // Normalize common culinary categories
      const name = p.itemName.toLowerCase();
      if (name.includes("milk") || name.includes("cream") || name.includes("butter") || name.includes("cheese") || name.includes("yogurt")) {
        cat = "Dairy";
      } else if (name.includes("beef") || name.includes("steak") || name.includes("ribeye") || name.includes("pork") || name.includes("chicken") || name.includes("bacon")) {
        cat = "Meat & Poultry";
      } else if (name.includes("fish") || name.includes("bass") || name.includes("salmon") || name.includes("shrimp") || name.includes("tuna")) {
        cat = "Seafood";
      } else if (name.includes("peach") || name.includes("potato") || name.includes("tomato") || name.includes("onion") || name.includes("lettuce") || name.includes("mint") || name.includes("asparagus") || name.includes("lemon") || name.includes("berry")) {
        cat = "Fresh Produce";
      } else if (name.includes("flour") || name.includes("sugar") || name.includes("oil") || name.includes("rice") || name.includes("pasta") || name.includes("salt") || name.includes("honey")) {
        cat = "Dry Goods & Pantry";
      }

      if (!map.has(cat)) {
        map.set(cat, { category: cat, totalSpend: 0, itemCount: 0 });
      }
      const entry = map.get(cat)!;
      entry.totalSpend += p.totalCost;
      entry.itemCount += 1;
    });

    const totalBudget = Array.from(map.values()).reduce((acc, c) => acc + c.totalSpend, 0);

    return Array.from(map.values())
      .map(c => ({
        ...c,
        totalSpend: Number(c.totalSpend.toFixed(2)),
        pct: totalBudget > 0 ? Number(((c.totalSpend / totalBudget) * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend);
  }, [filteredPurchases]);

  // Export Filtered Records to CSV
  const handleExportCSV = () => {
    const headers = ["Date", "Source Type", "Document Ref", "Supplier/Store", "Item Description", "Quantity", "Unit", "Unit Price ($)", "Total Cost ($)"];
    const rows = ingredientTransactions.map(t => [
      `"${t.date}"`,
      `"${t.sourceType === "invoice" ? "Vendor Invoice" : "Grocery Store"}"`,
      `"${t.documentRef.replace(/"/g, '""')}"`,
      `"${t.vendorOrStore.replace(/"/g, '""')}"`,
      `"${t.itemName.replace(/"/g, '""')}"`,
      t.quantity,
      `"${t.unit}"`,
      t.unitPrice.toFixed(2),
      t.totalCost.toFixed(2)
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const activeLabel = selectedIngredientName === "all" ? "procurement_all_ingredients" : selectedIngredientName.replace(/[^a-z0-9]/gi, "_");
    link.setAttribute("download", `report_${activeLabel}_${datePreset}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Trigger Native Browser Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 text-neutral-900 animate-in fade-in duration-150" id="report-center-view">
      
      {/* HEADER & EXECUTIVE TOOLBAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-neutral-200/80 p-5 sm:p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
              Procurement & Culinary Report Center
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-500 font-medium">
            Audit ingredient purchase history, analyze price swings over time, and monitor supplier spend allocations.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer hover:border-neutral-300"
            title="Export filtered records to spreadsheet (CSV)"
          >
            <Download className="w-3.5 h-3.5 text-neutral-500" />
            Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            title="Print or Save PDF report"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Report
          </button>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-neutral-200 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab("ingredients")}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === "ingredients"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-lg"
              : "border-transparent text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-t-lg"
          }`}
        >
          <Package className="w-4 h-4" />
          Ingredient Purchase Tracker
        </button>

        <button
          onClick={() => setActiveTab("vendors")}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === "vendors"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-lg"
              : "border-transparent text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-t-lg"
          }`}
        >
          <Building2 className="w-4 h-4" />
          Vendor & Store Spend
        </button>

        <button
          onClick={() => setActiveTab("categories")}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === "categories"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-lg"
              : "border-transparent text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-t-lg"
          }`}
        >
          <PieChartIcon className="w-4 h-4" />
          Category Allocation
        </button>

        <button
          onClick={() => setActiveTab("foodcost")}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === "foodcost"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-lg"
              : "border-transparent text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-t-lg"
          }`}
        >
          <ChefHat className="w-4 h-4" />
          Recipe Food Cost Margins
        </button>
      </div>

      {/* FILTER & PERIOD SELECTOR BAR */}
      <div className="bg-white border border-neutral-200/80 p-4 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-neutral-500" /> Period:
            </span>
            {[
              { key: "7d", label: "Last 7 Days" },
              { key: "30d", label: "Last 30 Days" },
              { key: "thisMonth", label: "This Month" },
              { key: "90d", label: "Last 90 Days" },
              { key: "ytd", label: "Year to Date" },
              { key: "all", label: "All Time" },
              { key: "custom", label: "Custom Range" },
            ].map(preset => (
              <button
                key={preset.key}
                onClick={() => setDatePreset(preset.key as DatePreset)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  datePreset === preset.key
                    ? "bg-emerald-600 text-white shadow-2xs font-bold"
                    : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Source Toggle (All vs Invoices vs Grocery) */}
          <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl text-xs">
            <button
              onClick={() => setSourceFilter("all")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                sourceFilter === "all" ? "bg-white text-neutral-900 shadow-2xs" : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              All Sources ({invoices.length + groceryPurchases.length})
            </button>
            <button
              onClick={() => setSourceFilter("invoices")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                sourceFilter === "invoices" ? "bg-white text-emerald-800 shadow-2xs" : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              <FileText className="w-3 h-3 text-emerald-600" />
              Invoices ({invoices.length})
            </button>
            <button
              onClick={() => setSourceFilter("grocery")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                sourceFilter === "grocery" ? "bg-white text-blue-800 shadow-2xs" : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              <ShoppingBag className="w-3 h-3 text-blue-600" />
              Grocery ({groceryPurchases.length})
            </button>
          </div>
        </div>

        {/* Custom Date Range Pickers (only shown when 'custom' is active) */}
        {datePreset === "custom" && (
          <div className="pt-2 border-t border-neutral-100 flex flex-wrap items-center gap-4 text-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <label className="font-bold text-neutral-600">Start Date:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-white border border-neutral-300 rounded-lg px-2.5 py-1 text-neutral-800 font-mono text-xs focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="font-bold text-neutral-600">End Date:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-white border border-neutral-300 rounded-lg px-2.5 py-1 text-neutral-800 font-mono text-xs focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        )}

        {/* Specific Ingredient Filter Bar (for Tab 1: Ingredient Tracker) */}
        {activeTab === "ingredients" && (
          <div className="pt-3 border-t border-neutral-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-3">
              <div className="w-full sm:w-72 relative">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                  Track Specific Ingredient:
                </label>
                <select
                  value={selectedIngredientName}
                  onChange={(e) => setSelectedIngredientName(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="all">⚡ All Ingredients ({distinctIngredients.length} tracked items)</option>
                  {distinctIngredients.map(ing => (
                    <option key={ing.key} value={ing.key}>
                      {ing.name} ({ing.count} purchases - ${ing.totalCost.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Text Search Filter */}
              <div className="flex-1 relative pt-4">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-7 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by keyword (e.g. 'Butter', 'Sysco', 'Organic')..."
                  value={ingredientSearchQuery}
                  onChange={(e) => setIngredientSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-800 placeholder-neutral-400 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-colors"
                />
                {ingredientSearchQuery && (
                  <button
                    onClick={() => setIngredientSearchQuery("")}
                    className="absolute right-3 top-7 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-xs font-bold"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Popular Ingredient Quick Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Quick:</span>
              {distinctIngredients.slice(0, 5).map(ing => (
                <button
                  key={ing.key}
                  onClick={() => setSelectedIngredientName(selectedIngredientName === ing.key ? "all" : ing.key)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer truncate max-w-[120px] ${
                    selectedIngredientName === ing.key
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                  title={`Track ${ing.name}`}
                >
                  {ing.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: INGREDIENT PURCHASE TRACKER (THE CORE USER GOAL) */}
      {/* ===================================================================== */}
      {activeTab === "ingredients" && (
        <div className="space-y-6">
          
          {/* Executive Ingredient KPIs Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            
            {/* Total Quantity Bought */}
            <div className="bg-white border border-neutral-200/80 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Total Quantity Bought</span>
                <Package className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-neutral-900">
                {ingredientMetrics.totalQty.toLocaleString()} <span className="text-xs font-sans text-neutral-500">{ingredientMetrics.units}</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Across {ingredientMetrics.orderCount} purchase records
              </p>
            </div>

            {/* Total Spend */}
            <div className="bg-white border border-neutral-200/80 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Total Amount Spent</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-700">
                ${ingredientMetrics.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Total procurement expenditure
              </p>
            </div>

            {/* Weighted Average Unit Price */}
            <div className="bg-white border border-neutral-200/80 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Average Unit Price</span>
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-neutral-900">
                ${ingredientMetrics.avgUnitPrice.toFixed(2)}
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Weighted cost per {ingredientMetrics.units.split(",")[0] || "unit"}
              </p>
            </div>

            {/* Price Volatility & Swing Range */}
            <div className="bg-white border border-neutral-200/80 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Price Variance (Low / High)</span>
                <ArrowUpDown className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-xl font-bold font-mono text-neutral-900">
                ${ingredientMetrics.minPrice.toFixed(2)} - ${ingredientMetrics.maxPrice.toFixed(2)}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {ingredientMetrics.priceVariancePct > 0 ? (
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                    ingredientMetrics.priceVariancePct > 15 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                  }`}>
                    {ingredientMetrics.priceVariancePct.toFixed(1)}% price fluctuation
                  </span>
                ) : (
                  <span className="text-[11px] text-emerald-700 font-medium">Stable pricing</span>
                )}
              </div>
            </div>

            {/* Procurement Sources */}
            <div className="bg-white border border-neutral-200/80 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Suppliers Used</span>
                <Building2 className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-neutral-900">
                {ingredientMetrics.distinctVendorsCount} <span className="text-xs font-sans text-neutral-500">vendors</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Delivery and store sources
              </p>
            </div>
          </div>

          {/* Visual Trends Chart */}
          {ingredientTimelineChartData.length > 1 && (
            <div className="bg-white border border-neutral-200/80 p-5 sm:p-6 rounded-2xl shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    Purchase Volume & Rate Fluctuation Timeline
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Chronological audit of expenditure ($) and unit price changes across invoices.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-neutral-500">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-emerald-500"></span>
                    <span>Total Spend ($)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-blue-500"></span>
                    <span>Unit Price Paid ($)</span>
                  </div>
                </div>
              </div>

              <div className="h-64 sm:h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ingredientTimelineChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="displayDate" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis yAxisId="left" stroke="#10b981" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0f172a", border: "none", borderRadius: "10px", color: "#fff", fontSize: "12px" }}
                      formatter={(val: any, name: string) => [
                        name === "totalSpend" ? `$${Number(val).toFixed(2)}` : `$${Number(val).toFixed(2)}/unit`,
                        name === "totalSpend" ? "Total Spend" : "Unit Rate"
                      ]}
                    />
                    <Area yAxisId="left" type="monotone" dataKey="totalSpend" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#spendGradient)" />
                    <Line yAxisId="right" type="monotone" dataKey="unitPrice" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: "#3b82f6" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ITEM-BY-ITEM PURCHASE HISTORY TABLE */}
          <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/50">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  Itemized Purchase Transactions ({ingredientTransactions.length})
                </h3>
                <p className="text-xs text-neutral-500">
                  {selectedIngredientName === "all" 
                    ? "Showing all purchases matching current period" 
                    : `Showing purchase history for "${selectedIngredientName}"`}
                </p>
              </div>

              {/* Sort controls */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-neutral-400 font-bold">Sort by:</span>
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as any)}
                  className="bg-white border border-neutral-300 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer"
                >
                  <option value="date">Date</option>
                  <option value="total">Total Cost</option>
                  <option value="price">Unit Price</option>
                  <option value="qty">Quantity</option>
                </select>
                <button
                  onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                  className="p-1.5 border border-neutral-300 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer text-neutral-600"
                  title="Toggle ascending / descending"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {ingredientTransactions.length === 0 ? (
              <div className="py-16 text-center text-neutral-400">
                <Package className="w-10 h-10 mx-auto text-neutral-300 mb-2 stroke-1" />
                <p className="text-sm font-bold text-neutral-700">No purchase records found</p>
                <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                  Try adjusting the date range preset or select a different ingredient from the selector above.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-500 font-bold uppercase tracking-wider border-b border-neutral-200/70 text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Document / Source</th>
                      <th className="py-3 px-4">Supplier / Store</th>
                      <th className="py-3 px-4">Ingredient Description</th>
                      <th className="py-3 px-4 text-center">Quantity</th>
                      <th className="py-3 px-4 text-right">Unit Price Paid</th>
                      <th className="py-3 px-4 text-right">Extended Total</th>
                      <th className="py-3 px-4 text-center">Variance vs Avg</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {ingredientTransactions.map((tx) => {
                      // Variance compared to average unit price
                      const avg = ingredientMetrics.avgUnitPrice;
                      const diff = avg > 0 ? ((tx.unitPrice - avg) / avg) * 100 : 0;

                      return (
                        <tr key={tx.id} className="hover:bg-neutral-50/80 transition-colors group">
                          <td className="py-3 px-4 font-mono font-medium text-neutral-700 whitespace-nowrap">
                            {tx.date}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {tx.sourceType === "invoice" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                                  <FileText className="w-3 h-3 text-emerald-600" />
                                  {tx.documentRef}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold">
                                  <ShoppingBag className="w-3 h-3 text-blue-600" />
                                  {tx.documentRef}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4 font-bold text-neutral-900 whitespace-nowrap">
                            {tx.vendorOrStore}
                          </td>

                          <td className="py-3 px-4 font-medium text-neutral-900 max-w-xs truncate" title={tx.itemName}>
                            {tx.itemName}
                          </td>

                          <td className="py-3 px-4 text-center font-mono font-bold text-neutral-800 whitespace-nowrap">
                            {tx.quantity} <span className="text-[10px] text-neutral-500 font-normal">{tx.unit}</span>
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900 whitespace-nowrap">
                            ${tx.unitPrice.toFixed(2)}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                            ${tx.totalCost.toFixed(2)}
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {Math.abs(diff) < 1 ? (
                              <span className="text-[10px] font-mono text-neutral-400">At Avg</span>
                            ) : diff > 0 ? (
                              <span className="text-[10px] font-mono font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md">
                                +{diff.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                {diff.toFixed(1)}%
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {tx.fileUrl ? (
                              <button
                                type="button"
                                onClick={() => setPreviewDoc({
                                  url: tx.fileUrl!,
                                  name: tx.documentRef,
                                  type: tx.fileType,
                                  size: tx.fileSize,
                                  title: `Invoice Document: ${tx.documentRef}`,
                                  subtitle: `Vendor: ${tx.vendorOrStore} • Date: ${tx.date}`
                                })}
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                                title="Preview scanned receipt / invoice image"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Receipt
                              </button>
                            ) : (
                              <span className="text-[10px] text-neutral-300 font-mono">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: VENDOR & STORE SPEND BREAKDOWN */}
      {/* ===================================================================== */}
      {activeTab === "vendors" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Vendor Spend Donut Chart */}
            <div className="bg-white border border-neutral-200/80 p-5 sm:p-6 rounded-2xl shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-emerald-600" />
                  Supplier Spend Distribution
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Proportion of procurement capital across all vendor accounts.
                </p>
              </div>

              <div className="h-60 w-full my-4">
                {vendorSpendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={vendorSpendData}
                        dataKey="totalSpend"
                        nameKey="vendor"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {vendorSpendData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0f172a", border: "none", borderRadius: "10px", color: "#fff", fontSize: "12px" }}
                        formatter={(val: any) => [`$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, "Total Spend"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                    No vendor invoices in this period
                  </div>
                )}
              </div>

              {/* Legend preview */}
              <div className="space-y-1.5 pt-3 border-t border-neutral-100 max-h-40 overflow-y-auto">
                {vendorSpendData.slice(0, 5).map((v, i) => (
                  <div key={v.vendor} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}></span>
                      <span className="font-semibold text-neutral-800 truncate">{v.vendor}</span>
                    </div>
                    <span className="font-mono font-bold text-neutral-600">{v.sharePercentage}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Vendor Ranking Bar Chart */}
            <div className="lg:col-span-2 bg-white border border-neutral-200/80 p-5 sm:p-6 rounded-2xl shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-600" />
                  Top Supplier Spend Volumes
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Ranked by total purchases in the selected period.
                </p>
              </div>

              <div className="h-64 sm:h-72 w-full pt-4">
                {vendorSpendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={vendorSpendData.slice(0, 8)} layout="vertical" margin={{ left: 20, right: 30, top: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
                      <YAxis type="category" dataKey="vendor" stroke="#475569" fontSize={11} tickLine={false} width={100} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0f172a", border: "none", borderRadius: "10px", color: "#fff", fontSize: "12px" }}
                        formatter={(val: any) => [`$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, "Purchased"]}
                      />
                      <Bar dataKey="totalSpend" fill="#10b981" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                    No supplier records available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Vendor Spend Ledger */}
          <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                Supplier Procurement Ledger
              </h3>
              <span className="text-xs font-mono text-neutral-500">
                {vendorSpendData.length} active suppliers
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-500 font-bold uppercase tracking-wider border-b border-neutral-200/70 text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Supplier Name</th>
                    <th className="py-3 px-4 text-center">Deliveries / Invoices</th>
                    <th className="py-3 px-4 text-center">Latest Order Date</th>
                    <th className="py-3 px-4 text-right">Total Purchased</th>
                    <th className="py-3 px-4 text-right">Share of Total Spend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {vendorSpendData.map((v) => (
                    <tr key={v.vendor} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-neutral-900">
                        {v.vendor}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-neutral-700">
                        {v.orderCount}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-neutral-500">
                        {v.lastOrder}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        ${v.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-neutral-800">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-neutral-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${v.sharePercentage}%` }}></div>
                          </div>
                          <span>{v.sharePercentage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: CATEGORY & DEPARTMENT BREAKDOWN */}
      {/* ===================================================================== */}
      {activeTab === "categories" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Category Donut */}
            <div className="bg-white border border-neutral-200/80 p-5 sm:p-6 rounded-2xl shadow-xs">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-emerald-600" />
                Spend by Food Category
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Breakdown across Produce, Dairy, Meat, Seafood, and Dry Goods.
              </p>

              <div className="h-64 w-full my-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categorySpendData}
                      dataKey="totalSpend"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={4}
                    >
                      {categorySpendData.map((_, index) => (
                        <Cell key={`cat-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0f172a", border: "none", borderRadius: "10px", color: "#fff", fontSize: "12px" }}
                      formatter={(val: any) => [`$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, "Category Spend"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-neutral-100">
                {categorySpendData.map((c, i) => (
                  <div key={c.category} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-neutral-50">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}></span>
                      <span className="font-semibold text-neutral-800 truncate">{c.category}</span>
                    </div>
                    <span className="font-mono font-bold text-neutral-700">{c.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Category Performance Breakdown List */}
            <div className="bg-white border border-neutral-200/80 p-5 sm:p-6 rounded-2xl shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  Category Spending Breakdown
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Detailed expenditure per culinary inventory department.
                </p>
              </div>

              <div className="space-y-4 my-4">
                {categorySpendData.map((c) => (
                  <div key={c.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-neutral-800">{c.category}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-neutral-500 font-mono">{c.itemCount} items purchased</span>
                        <span className="font-mono font-bold text-emerald-700">${c.totalSpend.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${c.pct}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Categories balance against verified invoice receipts &amp; retail grocery trips.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: RECIPE FOOD COST MARGINS */}
      {/* ===================================================================== */}
      {activeTab === "foodcost" && (
        <div className="space-y-6">
          <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <ChefHat className="w-4 h-4 text-emerald-600" />
                  Culinary Cost Sheets &amp; Menu Margin Health ({recipes.length})
                </h3>
                <p className="text-xs text-neutral-500">
                  Cross-referencing live ingredient purchase costs against menu selling prices.
                </p>
              </div>
              {onSwitchSection && (
                <button
                  onClick={() => onSwitchSection("recipes")}
                  className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Edit Cost Sheets <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            {recipes.length === 0 ? (
              <div className="py-16 text-center text-neutral-400">
                <ChefHat className="w-10 h-10 mx-auto text-neutral-300 mb-2 stroke-1" />
                <p className="text-sm font-bold text-neutral-700">No recipes configured</p>
                <p className="text-xs text-neutral-400 mt-1">
                  Add recipes in the Culinary Cost Sheets tab to view food cost margin reports.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-500 font-bold uppercase tracking-wider border-b border-neutral-200/70 text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Recipe / Menu Dish</th>
                      <th className="py-3 px-4 text-center">Category</th>
                      <th className="py-3 px-4 text-right">Selling Price</th>
                      <th className="py-3 px-4 text-right">Plate Cost</th>
                      <th className="py-3 px-4 text-right">Gross Profit ($)</th>
                      <th className="py-3 px-4 text-center">Food Cost %</th>
                      <th className="py-3 px-4 text-center">Margin Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {recipes.map(recipe => {
                      // Calculate plate cost from ingredients
                      const plateCost = (recipe.ingredients || []).reduce((sum, ing) => {
                        return sum + (ing.cost || 0);
                      }, 0);

                      const sellPrice = recipe.price || 0;
                      const profit = sellPrice - plateCost;
                      const foodCostPct = sellPrice > 0 ? (plateCost / sellPrice) * 100 : 0;

                      return (
                        <tr key={recipe.id} className="hover:bg-neutral-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-neutral-900">
                            {recipe.name}
                          </td>
                          <td className="py-3 px-4 text-center font-medium text-neutral-600">
                            {recipe.category || "General"}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900">
                            ${sellPrice.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-neutral-700">
                            ${plateCost.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                            ${profit.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-neutral-800">
                            {foodCostPct.toFixed(1)}%
                          </td>
                          <td className="py-3 px-4 text-center">
                            {foodCostPct <= 28 ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                Healthy Margin
                              </span>
                            ) : foodCostPct <= 35 ? (
                              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-bold">
                                Acceptable
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-800 text-[10px] font-bold">
                                High Cost Alert
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW LIGHTBOX MODAL */}
      {previewDoc && (
        <DocumentPreviewModal
          isOpen={true}
          onClose={() => setPreviewDoc(null)}
          fileUrl={previewDoc.url}
          fileName={previewDoc.name}
          fileType={previewDoc.type}
          fileSize={previewDoc.size}
          title={previewDoc.title || `Invoice: ${previewDoc.name}`}
          subtitle={previewDoc.subtitle}
        />
      )}
    </div>
  );
};

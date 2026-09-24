import React, { useState, useMemo } from "react";
import { 
  GroceryPurchase, 
  GroceryPurchaseItem, 
  GroceryShoppingItem, 
  Ingredient, 
  Vendor 
} from "../types";
import { 
  ShoppingCart, 
  Plus, 
  Receipt, 
  Store, 
  Search, 
  Calendar, 
  Trash2, 
  Edit3, 
  Check, 
  CheckSquare, 
  Square, 
  DollarSign, 
  TrendingUp, 
  Sparkles, 
  Copy, 
  Printer, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  CreditCard, 
  ArrowRight, 
  ExternalLink, 
  ListChecks, 
  Tag, 
  Building2, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Layers,
  FileSpreadsheet
} from "lucide-react";

interface GroceryViewProps {
  ingredients: Ingredient[];
  vendors: Vendor[];
  groceryPurchases: GroceryPurchase[];
  shoppingList: GroceryShoppingItem[];
  onAddGroceryPurchase: (purchase: Omit<GroceryPurchase, "id" | "ownerId" | "createdAt" | "updatedAt">) => Promise<void>;
  onUpdateGroceryPurchase: (id: string, edits: Partial<GroceryPurchase>) => Promise<void>;
  onDeleteGroceryPurchase: (id: string) => Promise<void>;
  onAddShoppingItem: (item: Omit<GroceryShoppingItem, "id" | "ownerId" | "createdAt">) => Promise<void>;
  onToggleShoppingItem: (id: string, isChecked: boolean) => Promise<void>;
  onDeleteShoppingItem: (id: string) => Promise<void>;
  onClearCheckedShoppingItems: () => Promise<void>;
  onSyncIngredientPrice?: (ingredientId: string, newUnitPrice: number, unit: string) => Promise<void>;
  isReadOnly?: boolean;
}

const COMMON_STORES = [
  "Costco",
  "Trader Joe's",
  "Restaurant Depot",
  "Supermarket",
  "H Mart",
  "Whole Foods",
  "Sam's Club",
  "Farmers Market",
  "Local Asian Market",
  "Target"
];

const CATEGORIES = [
  "Produce",
  "Dairy & Eggs",
  "Meat & Poultry",
  "Seafood",
  "Dry Goods & Spices",
  "Bakery & Bread",
  "Beverages & Bar",
  "Packaging & Supplies",
  "Other"
];

export default function GroceryView({
  ingredients,
  vendors,
  groceryPurchases,
  shoppingList,
  onAddGroceryPurchase,
  onUpdateGroceryPurchase,
  onDeleteGroceryPurchase,
  onAddShoppingItem,
  onToggleShoppingItem,
  onDeleteShoppingItem,
  onClearCheckedShoppingItems,
  onSyncIngredientPrice,
  isReadOnly = false
}: GroceryViewProps) {
  // Navigation sub-tab inside Grocery
  const [activeTab, setActiveTab] = useState<"purchases" | "shopping" | "insights">("purchases");

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStoreFilter, setSelectedStoreFilter] = useState("all");
  const [selectedMonthFilter, setSelectedMonthFilter] = useState("all");
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);

  // Modals state
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<GroceryPurchase | null>(null);
  const [showShoppingItemModal, setShowShoppingItemModal] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Form states for New / Edit Grocery Purchase
  const [formStoreName, setFormStoreName] = useState("");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [formPaymentMethod, setFormPaymentMethod] = useState<GroceryPurchase["paymentMethod"]>("Company Card");
  const [formPurchaserName, setFormPurchaserName] = useState("");
  const [formReceiptNumber, setFormReceiptNumber] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formItems, setFormItems] = useState<GroceryPurchaseItem[]>([
    {
      id: "item-1",
      name: "",
      quantity: 1,
      unit: "pack",
      price: 0,
      unitPrice: 0,
      category: "Produce",
      linkedIngredientId: "",
      notes: ""
    }
  ]);
  const [formAutoSyncMaster, setFormAutoSyncMaster] = useState(true);
  const [isSubmittingPurchase, setIsSubmittingPurchase] = useState(false);

  // Form states for Shopping Item Modal
  const [shopName, setShopName] = useState("");
  const [shopQuantity, setShopQuantity] = useState<number>(1);
  const [shopUnit, setShopUnit] = useState("pack");
  const [shopCategory, setShopCategory] = useState("Produce");
  const [shopStore, setShopStore] = useState("");
  const [shopEstCost, setShopEstCost] = useState<string>("");
  const [shopNotes, setShopNotes] = useState("");
  const [shopLinkedIngId, setShopLinkedIngId] = useState("");
  const [isSubmittingShopping, setIsSubmittingShopping] = useState(false);

  // Auto-fill from ingredient selection in shopping modal
  const handleSelectShopIngredient = (ingId: string) => {
    setShopLinkedIngId(ingId);
    const ing = ingredients.find(i => i.id === ingId);
    if (ing) {
      setShopName(ing.name);
      setShopUnit(ing.unit || "pack");
      setShopCategory(ing.category || "Produce");
      if (ing.price) {
        setShopEstCost(ing.price.toFixed(2));
      }
    }
  };

  // Restock candidates from ingredients with low stock
  const lowStockCandidates = useMemo(() => {
    return ingredients.filter(ing => {
      const currentStock = ing.inStock ?? ing.quantity ?? 0;
      const minThreshold = ing.minStock ?? 5;
      return currentStock <= minThreshold;
    });
  }, [ingredients]);

  // Months available in purchases for filtering
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    groceryPurchases.forEach(p => {
      if (p.date) {
        months.add(p.date.substring(0, 7)); // YYYY-MM
      }
    });
    return Array.from(months).sort().reverse();
  }, [groceryPurchases]);

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    return groceryPurchases.filter(p => {
      const matchSearch = 
        !searchQuery.trim() || 
        p.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.purchaserName && p.purchaserName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.notes && p.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        p.items.some(it => it.name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStore = 
        selectedStoreFilter === "all" || 
        p.storeName.toLowerCase() === selectedStoreFilter.toLowerCase();

      const matchMonth = 
        selectedMonthFilter === "all" || 
        (p.date && p.date.startsWith(selectedMonthFilter));

      return matchSearch && matchStore && matchMonth;
    }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [groceryPurchases, searchQuery, selectedStoreFilter, selectedMonthFilter]);

  // Overall KPIs
  const kpis = useMemo(() => {
    const nowMonth = new Date().toISOString().substring(0, 7);
    const currentMonthPurchases = groceryPurchases.filter(p => p.date && p.date.startsWith(nowMonth));
    const currentMonthSpend = currentMonthPurchases.reduce((acc, p) => acc + (p.totalAmount || 0), 0);
    const totalAllTimeSpend = groceryPurchases.reduce((acc, p) => acc + (p.totalAmount || 0), 0);
    const totalRuns = groceryPurchases.length;
    const avgRunCost = totalRuns > 0 ? totalAllTimeSpend / totalRuns : 0;

    const pendingShoppingItems = shoppingList.filter(s => !s.isChecked);
    const estimatedCartTotal = pendingShoppingItems.reduce((acc, s) => acc + (s.estimatedCost || 0), 0);

    const storeCounts: Record<string, { count: number; spend: number }> = {};
    groceryPurchases.forEach(p => {
      const s = p.storeName || "Unknown Store";
      if (!storeCounts[s]) storeCounts[s] = { count: 0, spend: 0 };
      storeCounts[s].count += 1;
      storeCounts[s].spend += (p.totalAmount || 0);
    });

    const categorySpend: Record<string, number> = {};
    groceryPurchases.forEach(p => {
      p.items.forEach(it => {
        const cat = it.category || "Other";
        categorySpend[cat] = (categorySpend[cat] || 0) + (it.price || 0);
      });
    });

    return {
      currentMonthSpend,
      totalAllTimeSpend,
      totalRuns,
      avgRunCost,
      pendingCount: pendingShoppingItems.length,
      estimatedCartTotal,
      storeCounts,
      categorySpend
    };
  }, [groceryPurchases, shoppingList]);

  // Open modal for new purchase
  const handleOpenNewPurchase = () => {
    setEditingPurchase(null);
    setFormStoreName("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormPaymentMethod("Company Card");
    setFormPurchaserName("");
    setFormReceiptNumber("");
    setFormNotes("");
    setFormItems([
      {
        id: `item-${Date.now()}-1`,
        name: "",
        quantity: 1,
        unit: "pack",
        price: 0,
        unitPrice: 0,
        category: "Produce",
        linkedIngredientId: "",
        notes: ""
      }
    ]);
    setShowPurchaseModal(true);
  };

  // Open modal for editing purchase
  const handleOpenEditPurchase = (p: GroceryPurchase) => {
    setEditingPurchase(p);
    setFormStoreName(p.storeName);
    setFormDate(p.date);
    setFormPaymentMethod(p.paymentMethod || "Company Card");
    setFormPurchaserName(p.purchaserName || "");
    setFormReceiptNumber(p.receiptNumber || "");
    setFormNotes(p.notes || "");
    setFormItems(
      p.items && p.items.length > 0 
        ? p.items.map(it => ({ ...it })) 
        : [{
            id: `item-${Date.now()}-1`,
            name: "",
            quantity: 1,
            unit: "pack",
            price: 0,
            unitPrice: 0,
            category: "Produce",
            linkedIngredientId: "",
            notes: ""
          }]
    );
    setShowPurchaseModal(true);
  };

  // Handle item row changes in purchase form
  const handleItemChange = (index: number, field: keyof GroceryPurchaseItem, val: any) => {
    const updated = [...formItems];
    updated[index] = { ...updated[index], [field]: val };
    
    // If name changes, try to auto-match with master ingredient
    if (field === "name" && typeof val === "string") {
      const match = ingredients.find(ing => ing.name.toLowerCase().trim() === val.toLowerCase().trim());
      if (match) {
        updated[index].linkedIngredientId = match.id || "";
        if (!updated[index].category && match.category) {
          updated[index].category = match.category;
        }
        if (!updated[index].unit && match.unit) {
          updated[index].unit = match.unit;
        }
      }
    }

    // Auto-calculate unitPrice if price and quantity are positive
    if (field === "price" || field === "quantity") {
      const qty = field === "quantity" ? Number(val) : Number(updated[index].quantity);
      const prc = field === "price" ? Number(val) : Number(updated[index].price);
      if (qty > 0 && prc >= 0) {
        updated[index].unitPrice = Number((prc / qty).toFixed(3));
      }
    }

    setFormItems(updated);
  };

  const handleAddItemRow = () => {
    setFormItems([
      ...formItems,
      {
        id: `item-${Date.now()}-${formItems.length + 1}`,
        name: "",
        quantity: 1,
        unit: "pack",
        price: 0,
        unitPrice: 0,
        category: "Produce",
        linkedIngredientId: "",
        notes: ""
      }
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, idx) => idx !== index));
  };

  // Save Purchase
  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStoreName.trim()) return;
    setIsSubmittingPurchase(true);

    try {
      const cleanedItems: GroceryPurchaseItem[] = formItems
        .filter(it => it.name.trim().length > 0)
        .map(it => ({
          ...it,
          quantity: Number(it.quantity) || 1,
          price: Number(it.price) || 0,
          unitPrice: Number(it.quantity) > 0 ? Number((Number(it.price) / Number(it.quantity)).toFixed(3)) : Number(it.price)
        }));

      const calculatedTotal = cleanedItems.reduce((acc, it) => acc + it.price, 0);

      const purchaseData = {
        storeName: formStoreName.trim(),
        date: formDate,
        paymentMethod: formPaymentMethod,
        purchaserName: formPurchaserName.trim() || undefined,
        receiptNumber: formReceiptNumber.trim() || undefined,
        notes: formNotes.trim() || undefined,
        items: cleanedItems,
        totalAmount: calculatedTotal
      };

      if (editingPurchase && editingPurchase.id) {
        await onUpdateGroceryPurchase(editingPurchase.id, purchaseData);
      } else {
        await onAddGroceryPurchase(purchaseData);
      }

      // If user enabled auto-sync to Master Ingredients, propagate matched prices
      if (formAutoSyncMaster && onSyncIngredientPrice) {
        for (const it of cleanedItems) {
          if (it.linkedIngredientId && it.unitPrice && it.unitPrice > 0) {
            await onSyncIngredientPrice(it.linkedIngredientId, it.unitPrice, it.unit);
          } else {
            // Check exact name match
            const exactMatch = ingredients.find(ing => ing.name.toLowerCase().trim() === it.name.toLowerCase().trim());
            if (exactMatch && exactMatch.id && it.unitPrice && it.unitPrice > 0) {
              await onSyncIngredientPrice(exactMatch.id, it.unitPrice, it.unit);
            }
          }
        }
      }

      setShowPurchaseModal(false);
    } catch (err) {
      console.error("Failed to save grocery purchase:", err);
    } finally {
      setIsSubmittingPurchase(false);
    }
  };

  // Save Shopping item
  const handleSubmitShoppingItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) return;
    setIsSubmittingShopping(true);

    try {
      await onAddShoppingItem({
        name: shopName.trim(),
        quantity: Number(shopQuantity) || 1,
        unit: shopUnit.trim() || "pack",
        category: shopCategory,
        storePreferred: shopStore.trim() || undefined,
        estimatedCost: shopEstCost ? Number(shopEstCost) : undefined,
        notes: shopNotes.trim() || undefined,
        linkedIngredientId: shopLinkedIngId || undefined,
        isChecked: false
      });

      // Reset form
      setShopName("");
      setShopQuantity(1);
      setShopUnit("pack");
      setShopCategory("Produce");
      setShopStore("");
      setShopEstCost("");
      setShopNotes("");
      setShopLinkedIngId("");
      setShowShoppingItemModal(false);
    } catch (err) {
      console.error("Failed to add shopping item:", err);
    } finally {
      setIsSubmittingShopping(false);
    }
  };

  // Add low-stock ingredient directly to shopping list
  const handleQuickAddLowStock = async (ing: Ingredient) => {
    try {
      const restockQty = Math.max(1, (ing.minStock || 5) * 2 - (ing.inStock || ing.quantity || 0));
      await onAddShoppingItem({
        name: ing.name,
        quantity: restockQty,
        unit: ing.unit || "pack",
        category: ing.category || "Produce",
        estimatedCost: ing.price ? ing.price * restockQty : undefined,
        linkedIngredientId: ing.id,
        notes: `Auto-restock (Current: ${ing.inStock || ing.quantity || 0} ${ing.unit || ""})`,
        isChecked: false
      });
    } catch (err) {
      console.error("Error adding restock item:", err);
    }
  };

  // Copy plain text shopping list to clipboard
  const handleCopyShoppingList = () => {
    const pending = shoppingList.filter(s => !s.isChecked);
    if (pending.length === 0) return;

    let text = `🛒 GROCERY SHOPPING LIST - ${new Date().toLocaleDateString()}\n`;
    text += `=====================================\n`;
    pending.forEach((item, idx) => {
      text += `${idx + 1}. [ ] ${item.name} - ${item.quantity} ${item.unit}`;
      if (item.storePreferred) text += ` (@ ${item.storePreferred})`;
      if (item.notes) text += ` (${item.notes})`;
      text += `\n`;
    });
    text += `=====================================\n`;
    text += `Total items: ${pending.length}\n`;

    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2500);
    });
  };

  // Manual price sync trigger from an item row
  const handleManualSyncPrice = async (it: GroceryPurchaseItem) => {
    if (!onSyncIngredientPrice) return;
    const targetId = it.linkedIngredientId || ingredients.find(i => i.name.toLowerCase().trim() === it.name.toLowerCase().trim())?.id;
    if (!targetId || !it.unitPrice) return;

    try {
      await onSyncIngredientPrice(targetId, it.unitPrice, it.unit);
      setSyncStatus(`Updated ${it.name} to $${it.unitPrice.toFixed(2)}/${it.unit}`);
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err) {
      console.error("Error syncing price:", err);
    }
  };

  return (
    <div className="space-y-6" id="grocery-view-root">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900 tracking-tight">Grocery & Market Runs</h2>
              <p className="text-xs text-neutral-500">
                Log ad-hoc supermarket receipts (Costco, Trader Joe's, Asian Markets), manage kitchen shopping checklists, and link purchases to master costs.
              </p>
            </div>
          </div>
        </div>

        {!isReadOnly && (
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setShowShoppingItemModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Shopping Item</span>
            </button>
            <button
              onClick={handleOpenNewPurchase}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
              id="btn-log-grocery-purchase"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Log Grocery Purchase</span>
            </button>
          </div>
        )}
      </div>

      {/* Sync Status Banner */}
      {syncStatus && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncStatus}</span>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Month Spend */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">This Month's Grocery Spend</p>
            <p className="text-2xl font-bold text-neutral-900 tracking-tight">
              ${kpis.currentMonthSpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-neutral-500">
              All-time: ${kpis.totalAllTimeSpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Total Runs */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Total Store Runs</p>
            <p className="text-2xl font-bold text-neutral-900 tracking-tight">{kpis.totalRuns}</p>
            <p className="text-[11px] text-neutral-500">
              Avg. ${kpis.avgRunCost.toFixed(2)} per trip
            </p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
            <Store className="w-5 h-5" />
          </div>
        </div>

        {/* Shopping List Queue */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Pending Shopping List</p>
            <p className="text-2xl font-bold text-neutral-900 tracking-tight">{kpis.pendingCount} items</p>
            <p className="text-[11px] text-neutral-500">
              Est. Cart: ${kpis.estimatedCartTotal.toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
            <ListChecks className="w-5 h-5" />
          </div>
        </div>

        {/* Restock Alerts */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Low Stock Needs Restock</p>
            <p className="text-2xl font-bold text-neutral-900 tracking-tight">{lowStockCandidates.length} items</p>
            <p className="text-[11px] text-neutral-500">Based on master inventory par levels</p>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-6 border-b border-neutral-200">
        <button
          onClick={() => setActiveTab("purchases")}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === "purchases"
              ? "text-emerald-700 border-b-2 border-emerald-600"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
          id="tab-grocery-purchases"
        >
          <Receipt className="w-4 h-4" />
          <span>Purchases & Receipts ({groceryPurchases.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("shopping")}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === "shopping"
              ? "text-emerald-700 border-b-2 border-emerald-600"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
          id="tab-grocery-shopping"
        >
          <ListChecks className="w-4 h-4" />
          <span>Shopping & Restock Checklist ({shoppingList.filter(s => !s.isChecked).length})</span>
        </button>

        <button
          onClick={() => setActiveTab("insights")}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === "insights"
              ? "text-emerald-700 border-b-2 border-emerald-600"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
          id="tab-grocery-insights"
        >
          <TrendingUp className="w-4 h-4" />
          <span>Store & Category Insights</span>
        </button>
      </div>

      {/* TAB 1: PURCHASES & RECEIPTS */}
      {activeTab === "purchases" && (
        <div className="space-y-4">
          {/* Controls: Search, Store Filter, Month Filter */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3.5 border border-neutral-200/80 rounded-2xl">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search store, item, buyer, or notes..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
              <select
                value={selectedStoreFilter}
                onChange={e => setSelectedStoreFilter(e.target.value)}
                className="text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-1.5 text-neutral-700 font-medium focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Stores</option>
                {COMMON_STORES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select
                value={selectedMonthFilter}
                onChange={e => setSelectedMonthFilter(e.target.value)}
                className="text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-1.5 text-neutral-700 font-medium focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Months</option>
                {availableMonths.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Purchases List */}
          {filteredPurchases.length === 0 ? (
            <div className="bg-white border border-dashed border-neutral-300 rounded-2xl p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-center mx-auto text-neutral-400">
                <Receipt className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-neutral-800">No Grocery Purchases Found</h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  {searchQuery || selectedStoreFilter !== "all" || selectedMonthFilter !== "all"
                    ? "Try adjusting your filters or search terms."
                    : "Log your first supermarket or local market run to start tracking grocery expenses and unit costs."}
                </p>
              </div>
              {!isReadOnly && (
                <button
                  onClick={handleOpenNewPurchase}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log Grocery Purchase</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPurchases.map(purchase => {
                const isExpanded = expandedPurchaseId === purchase.id;
                const itemsCount = purchase.items?.length || 0;

                return (
                  <div
                    key={purchase.id}
                    className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs overflow-hidden transition-all"
                  >
                    {/* Purchase Header Row */}
                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-neutral-50/50 transition-colors">
                      <div className="flex items-start sm:items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                          <Store className="w-5 h-5" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-neutral-900">{purchase.storeName}</h4>
                            <span className="px-2 py-0.5 text-[10px] font-semibold bg-neutral-100 text-neutral-700 rounded-md">
                              {purchase.paymentMethod}
                            </span>
                            {purchase.receiptNumber && (
                              <span className="px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 rounded-md border border-blue-100">
                                Receipt #{purchase.receiptNumber}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-neutral-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                              {purchase.date}
                            </span>
                            {purchase.purchaserName && (
                              <span>• Buyer: <strong className="text-neutral-700">{purchase.purchaserName}</strong></span>
                            )}
                            <span>• {itemsCount} {itemsCount === 1 ? "item" : "items"} logged</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-neutral-900">
                            ${purchase.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-[10px] text-neutral-400 uppercase font-semibold">Total Spent</p>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setExpandedPurchaseId(isExpanded ? null : (purchase.id || null))}
                            className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                            title={isExpanded ? "Collapse item details" : "Expand item details"}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>

                          {!isReadOnly && (
                            <>
                              <button
                                onClick={() => handleOpenEditPurchase(purchase)}
                                className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                                title="Edit purchase"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => purchase.id && onDeleteGroceryPurchase(purchase.id)}
                                className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                title="Delete purchase"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Itemized Section */}
                    {isExpanded && (
                      <div className="border-t border-neutral-100 bg-neutral-50/50 p-4 sm:p-5 space-y-3">
                        {purchase.notes && (
                          <div className="text-xs text-neutral-600 bg-white p-3 rounded-xl border border-neutral-200">
                            <strong>Notes / Memo:</strong> {purchase.notes}
                          </div>
                        )}

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-neutral-200 text-neutral-500 uppercase text-[10px] font-bold">
                                <th className="pb-2 font-semibold">Item Name</th>
                                <th className="pb-2 font-semibold">Category</th>
                                <th className="pb-2 font-semibold">Quantity</th>
                                <th className="pb-2 font-semibold">Unit Price</th>
                                <th className="pb-2 font-semibold">Total Price</th>
                                <th className="pb-2 font-semibold">Master Sync</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                              {purchase.items?.map(it => {
                                const matchedMaster = ingredients.find(
                                  ing => (it.linkedIngredientId && ing.id === it.linkedIngredientId) ||
                                         ing.name.toLowerCase().trim() === it.name.toLowerCase().trim()
                                );

                                return (
                                  <tr key={it.id} className="hover:bg-white/80 transition-colors">
                                    <td className="py-2.5 font-medium text-neutral-800">
                                      <div className="flex items-center gap-1.5">
                                        <span>{it.name}</span>
                                        {matchedMaster && (
                                          <span className="px-1.5 py-0.5 text-[9px] bg-emerald-50 text-emerald-700 rounded border border-emerald-100">
                                            Catalog Linked
                                          </span>
                                        )}
                                      </div>
                                      {it.notes && <p className="text-[10px] text-neutral-400">{it.notes}</p>}
                                    </td>
                                    <td className="py-2.5 text-neutral-600">
                                      <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 text-[10px]">
                                        {it.category || "General"}
                                      </span>
                                    </td>
                                    <td className="py-2.5 text-neutral-700">
                                      {it.quantity} {it.unit}
                                    </td>
                                    <td className="py-2.5 text-neutral-700">
                                      ${(it.unitPrice || 0).toFixed(2)} / {it.unit}
                                    </td>
                                    <td className="py-2.5 font-bold text-neutral-900">
                                      ${it.price.toFixed(2)}
                                    </td>
                                    <td className="py-2.5">
                                      {!isReadOnly && onSyncIngredientPrice && matchedMaster && (
                                        <button
                                          type="button"
                                          onClick={() => handleManualSyncPrice(it)}
                                          className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-semibold cursor-pointer transition-colors"
                                          title="Update master ingredient unit price to match this grocery purchase"
                                        >
                                          <RefreshCw className="w-3 h-3" />
                                          <span>Sync Price</span>
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SHOPPING & RESTOCK CHECKLIST */}
      {activeTab === "shopping" && (
        <div className="space-y-6">
          {/* Low Stock Auto-Suggestions Banner */}
          {lowStockCandidates.length > 0 && (
            <div className="bg-purple-50/60 border border-purple-200 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-purple-900">
                  <AlertCircle className="w-4 h-4 text-purple-600 shrink-0" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    Recommended Restock from Inventory ({lowStockCandidates.length} Low-Stock Items)
                  </h4>
                </div>
                <span className="text-[11px] text-purple-700">Items below minimum par level</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {lowStockCandidates.slice(0, 6).map(ing => {
                  const alreadyInList = shoppingList.some(
                    s => s.linkedIngredientId === ing.id || s.name.toLowerCase() === ing.name.toLowerCase()
                  );

                  return (
                    <div
                      key={ing.id}
                      className="bg-white border border-purple-100 rounded-xl p-3 flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-neutral-800 truncate">{ing.name}</p>
                        <p className="text-[10px] text-neutral-500">
                          Stock: {ing.inStock ?? ing.quantity ?? 0} / Par: {ing.minStock ?? 5} {ing.unit}
                        </p>
                      </div>

                      {!isReadOnly && (
                        <button
                          onClick={() => handleQuickAddLowStock(ing)}
                          disabled={alreadyInList}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg shrink-0 transition-colors flex items-center gap-1 ${
                            alreadyInList
                              ? "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                              : "bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shadow-xs"
                          }`}
                        >
                          {alreadyInList ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3" />
                              <span>+ Add</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Shopping Checklist Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 border border-neutral-200/80 rounded-2xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-800">
                {shoppingList.filter(s => s.isChecked).length} of {shoppingList.length} items checked
              </span>
              {shoppingList.some(s => s.isChecked) && !isReadOnly && (
                <button
                  onClick={onClearCheckedShoppingItems}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium underline ml-2 cursor-pointer"
                >
                  Clear checked items
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleCopyShoppingList}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                title="Copy formatted list for texting or sharing"
              >
                {copyFeedback ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copyFeedback ? "Copied to Clipboard!" : "Copy List"}</span>
              </button>

              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                title="Print shopping list"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print List</span>
              </button>

              {!isReadOnly && (
                <button
                  onClick={() => setShowShoppingItemModal(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Item</span>
                </button>
              )}
            </div>
          </div>

          {/* Interactive Checklist Items */}
          {shoppingList.length === 0 ? (
            <div className="bg-white border border-dashed border-neutral-300 rounded-2xl p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-center mx-auto text-neutral-400">
                <ListChecks className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-neutral-800">Your Shopping List is Empty</h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  Add items manually or use the low-stock inventory restock suggestions above to prepare your next supermarket run.
                </p>
              </div>
              {!isReadOnly && (
                <button
                  onClick={() => setShowShoppingItemModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Shopping Item</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {shoppingList.map(item => {
                const isChecked = !!item.isChecked;

                return (
                  <div
                    key={item.id}
                    className={`bg-white border rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 transition-all ${
                      isChecked
                        ? "border-neutral-200 bg-neutral-50/70 opacity-60"
                        : "border-neutral-200/90 shadow-2xs hover:border-neutral-300"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => item.id && onToggleShoppingItem(item.id, !isChecked)}
                        disabled={isReadOnly}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors shrink-0 ${
                          isChecked
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-neutral-300 hover:border-emerald-500 text-transparent"
                        }`}
                      >
                        <Check className="w-4 h-4" />
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-bold truncate ${isChecked ? "line-through text-neutral-400" : "text-neutral-900"}`}>
                            {item.name}
                          </p>
                          {item.category && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] bg-neutral-100 text-neutral-600 font-medium">
                              {item.category}
                            </span>
                          )}
                          {item.storePreferred && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] bg-blue-50 text-blue-700 border border-blue-100 font-medium">
                              {item.storePreferred}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-neutral-500 flex-wrap mt-0.5">
                          <span>Qty: <strong>{item.quantity} {item.unit}</strong></span>
                          {item.estimatedCost && (
                            <span>• Est: <strong>${item.estimatedCost.toFixed(2)}</strong></span>
                          )}
                          {item.notes && <span>• {item.notes}</span>}
                        </div>
                      </div>
                    </div>

                    {!isReadOnly && (
                      <button
                        onClick={() => item.id && onDeleteShoppingItem(item.id)}
                        className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Delete item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: STORE & CATEGORY INSIGHTS */}
      {activeTab === "insights" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* By Store */}
            <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-neutral-900">
                <Store className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold">Grocery Spend by Store</h3>
              </div>

              {Object.keys(kpis.storeCounts).length === 0 ? (
                <p className="text-xs text-neutral-400 py-6 text-center">No purchases recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {(Object.entries(kpis.storeCounts) as [string, { count: number; spend: number }][])
                    .sort(([, a], [, b]) => b.spend - a.spend)
                    .map(([store, data]) => {
                      const pct = kpis.totalAllTimeSpend > 0 ? (data.spend / kpis.totalAllTimeSpend) * 100 : 0;
                      return (
                        <div key={store} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-neutral-800">{store}</span>
                            <span className="font-bold text-neutral-900">
                              ${data.spend.toFixed(2)} <span className="text-neutral-400 font-normal">({data.count} runs)</span>
                            </span>
                          </div>
                          <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* By Category */}
            <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-neutral-900">
                <Tag className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold">Spend by Ingredient Category</h3>
              </div>

              {Object.keys(kpis.categorySpend).length === 0 ? (
                <p className="text-xs text-neutral-400 py-6 text-center">No category data recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {(Object.entries(kpis.categorySpend) as [string, number][])
                    .sort(([, a], [, b]) => b - a)
                    .map(([cat, spend]) => {
                      const pct = kpis.totalAllTimeSpend > 0 ? (spend / kpis.totalAllTimeSpend) * 100 : 0;
                      return (
                        <div key={cat} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-neutral-800">{cat}</span>
                            <span className="font-bold text-neutral-900">
                              ${spend.toFixed(2)} <span className="text-neutral-400 font-normal">({pct.toFixed(1)}%)</span>
                            </span>
                          </div>
                          <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT GROCERY PURCHASE */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-neutral-200 shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between p-5 border-b border-neutral-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    {editingPurchase ? "Edit Grocery Purchase" : "Log Grocery Store Purchase"}
                  </h3>
                  <p className="text-xs text-neutral-500">Record supermarket receipt, items, and cost details</p>
                </div>
              </div>
              <button
                onClick={() => setShowPurchaseModal(false)}
                className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPurchase} className="p-5 sm:p-6 space-y-5">
              {/* Store Quick Chips & Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-700">Store / Market Name *</label>
                <input
                  type="text"
                  required
                  value={formStoreName}
                  onChange={e => setFormStoreName(e.target.value)}
                  placeholder="e.g. Costco, Trader Joe's, Local Market..."
                  className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {COMMON_STORES.slice(0, 6).map(store => (
                    <button
                      type="button"
                      key={store}
                      onClick={() => setFormStoreName(store)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                        formStoreName === store
                          ? "bg-emerald-600 text-white"
                          : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
                      }`}
                    >
                      {store}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date, Payment Method & Purchaser */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-700">Purchase Date *</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-700">Payment Method</label>
                  <select
                    value={formPaymentMethod}
                    onChange={e => setFormPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Company Card">Company Card</option>
                    <option value="Petty Cash">Petty Cash</option>
                    <option value="Personal Reimbursement">Personal Reimbursement</option>
                    <option value="Debit / Cash">Debit / Cash</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-700">Purchaser / Staff Name</label>
                  <input
                    type="text"
                    value={formPurchaserName}
                    onChange={e => setFormPurchaserName(e.target.value)}
                    placeholder="Who went on the run?"
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Receipt Number & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-700">Receipt / Ref # (Optional)</label>
                  <input
                    type="text"
                    value={formReceiptNumber}
                    onChange={e => setFormReceiptNumber(e.target.value)}
                    placeholder="e.g. 09384"
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-700">Notes / Memo</label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    placeholder="e.g. Rush weekend dairy replenishment"
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Itemized Goods List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-800">
                    Itemized Receipt Goods ({formItems.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Item</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {formItems.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-3 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                          Item #{idx + 1}
                        </span>
                        {formItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            className="text-neutral-400 hover:text-rose-600 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-2">
                          <input
                            type="text"
                            required
                            value={item.name}
                            onChange={e => handleItemChange(idx, "name", e.target.value)}
                            placeholder="Item name (e.g. Heavy Cream, Lemons...)"
                            className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <select
                            value={item.category || "Produce"}
                            onChange={e => handleItemChange(idx, "category", e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                          >
                            {CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-neutral-500 block mb-0.5">Quantity</label>
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            value={item.quantity}
                            onChange={e => handleItemChange(idx, "quantity", e.target.value)}
                            className="w-full px-3 py-1 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-neutral-500 block mb-0.5">Unit</label>
                          <input
                            type="text"
                            value={item.unit}
                            onChange={e => handleItemChange(idx, "unit", e.target.value)}
                            placeholder="lb, gal, pack..."
                            className="w-full px-3 py-1 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-neutral-500 block mb-0.5">Total Line Price ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.price}
                            onChange={e => handleItemChange(idx, "price", e.target.value)}
                            className="w-full px-3 py-1 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 font-semibold text-neutral-800"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Summary & Auto-Sync Option */}
              <div className="pt-2 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formAutoSyncMaster}
                    onChange={e => setFormAutoSyncMaster(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Automatically update Master Ingredient prices with these grocery costs</span>
                </label>

                <div className="text-right">
                  <span className="text-xs text-neutral-400 uppercase font-semibold mr-2">Calculated Total:</span>
                  <span className="text-lg font-bold text-neutral-900">
                    ${formItems.reduce((acc, it) => acc + (Number(it.price) || 0), 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPurchaseModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPurchase}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isSubmittingPurchase ? "Saving..." : (editingPurchase ? "Update Purchase" : "Save Purchase")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD SHOPPING LIST ITEM */}
      {showShoppingItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full border border-neutral-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-neutral-200">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <ListChecks className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">Add to Grocery Shopping List</h3>
                  <p className="text-[11px] text-neutral-500">Queue item for the next kitchen supermarket run</p>
                </div>
              </div>
              <button
                onClick={() => setShowShoppingItemModal(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitShoppingItem} className="p-5 space-y-4">
              {/* Quick Pick from Master Catalog */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700">Quick Select from Master Ingredients (Optional)</label>
                <select
                  value={shopLinkedIngId}
                  onChange={e => handleSelectShopIngredient(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Choose ingredient or type below --</option>
                  {ingredients.map(ing => (
                    <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit || "unit"})</option>
                  ))}
                </select>
              </div>

              {/* Item Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700">Item Name *</label>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={e => setShopName(e.target.value)}
                  placeholder="e.g. Fresh Cilantro, Butter..."
                  className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Quantity and Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">Quantity *</label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={shopQuantity}
                    onChange={e => setShopQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">Unit</label>
                  <input
                    type="text"
                    value={shopUnit}
                    onChange={e => setShopUnit(e.target.value)}
                    placeholder="pack, lb, bunch..."
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Category & Preferred Store */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">Category</label>
                  <select
                    value={shopCategory}
                    onChange={e => setShopCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">Preferred Store</label>
                  <input
                    type="text"
                    value={shopStore}
                    onChange={e => setShopStore(e.target.value)}
                    placeholder="e.g. Costco, H Mart..."
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Estimated Cost & Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">Est. Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={shopEstCost}
                    onChange={e => setShopEstCost(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">Notes / Brand</label>
                  <input
                    type="text"
                    value={shopNotes}
                    onChange={e => setShopNotes(e.target.value)}
                    placeholder="e.g. Organic preferred"
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowShoppingItemModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingShopping}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isSubmittingShopping ? "Adding..." : "Add to List"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

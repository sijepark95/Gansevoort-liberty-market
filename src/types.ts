export interface Department {
  id?: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt?: string;
}

export interface Restaurant {
  id?: string;
  name: string;
  address?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  ownerId: string;
  createdAt?: string;
}

export interface Vendor {
  id?: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  note?: string;
  ownerId: string;
  createdAt?: string;
  isRegistered?: boolean;
  itemsSupplied?: number;
  orderTemplate?: OrderListItem[];
}

export interface Ingredient {
  id?: string;
  name: string;
  price: number;       // total package price (e.g. $15.50)
  quantity: number;    // package quantity amount (e.g. 1000)
  unit: string;        // package unit (g, kg, ml, L, oz, lb, pcs etc.)
  pricePerGram: number; // calculated standard cost per unit mass/volume (usually per gram or per ml/pcs)
  source: string;      // e.g. "Invoice #1023", "Manual", "Excel parsed"
  ownerId: string;
  updatedAt: string;
  weightPerCase?: number;       // Weight/volume per single unit/case (optional)
  weightPerCaseUnit?: string;   // Unit for weight/volume per unit/case (optional)
  pcsPerPound?: number;
  packagingUnit?: string;         // Pieces per pound for piece-to-pound conversion (optional)
  conversions?: { ratio: number; targetUnit: string }[];
  usabilityPercentage?: number; // Usability / yield percentage (1-100, scale 1-100, defaults to 100 if undefined)
  vendor?: string;              // explicit vendor name (e.g., "Sysco")
  inStock?: number;             // current physical stock quantity (in packages/units)
  minStock?: number;            // minimum stock quantity alerts (in packages/units)
  location?: string;            // storage location (e.g. "Walk-In Cooler", "Dry Storage")
  isHiddenFromInventory?: boolean; // soft-delete flag for inventory ledger
  category?: string;            // e.g. "Meat", "Vegetables", "Bread", etc.
}

export interface RecipeIngredientRef {
  ingredientId: string;
  name: string;
  grams: number;       // amount of ingredient required in grams/ml/units, or portion count if sub-recipe
  isSubRecipe?: boolean; // flag indicating if this item is a sub-recipe / nested menu
  subRecipeId?: string;  // reference ID to sub-recipe if applicable
}

export interface Recipe {
  id?: string;
  name: string;
  ingredients: RecipeIngredientRef[];
  sellingPrice: number;   // selling price of complete recipe or portion
  expectedYield: number; // expected portions/servings made
  costPerPortion: number; // dynamically calculated standard portion cost
  totalCost: number;      // total raw ingredient cost
  profitMargin: number;   // calculated margin %
  department?: string;    // department (e.g. Kitchen, Bar, Bakery, Pastry)
  order?: number;         // custom display order
  ownerId: string;
  updatedAt: string;
}

export interface ParsedInvoiceItem {
  name: string;
  unit: string;
  quantity: number;
  totalPrice: number;
  pricePerUnit: number;
  // UI interaction mapping fields
  matchAction?: "create" | "map" | "skip";
  targetIngredientId?: string; // If mapping to existing
  weightPerCase?: number;
  weightPerCaseUnit?: string;
  pcsPerPound?: number;
  packagingUnit?: string;
  usabilityPercentage?: number; // Usability / yield percentage (1-100, scale 1-100)
}

export interface Invoice {
  id?: string;
  fileName: string;
  invoiceNumber?: string;
  vendor?: string;
  issueDate?: string;
  dueDate?: string;
  items: ParsedInvoiceItem[];
  status: "pending_review" | "applied" | "paid" | "unpaid" | "overdue" | "void";
  totalAmount?: number;
  notes?: string;
  fileUrl?: string;     // Base64 data URL or storage link to the saved document/image
  fileType?: string;    // MIME type (image/jpeg, application/pdf, etc.)
  fileSize?: number;    // File size in bytes
  ownerId: string;
  createdAt: string;
}

export interface Timecard {
  id?: string;
  employeeName: string;
  employeeCode?: string;
  date: string;
  clockIn: string;
  clockOut: string;
  totalHours: number;
  unpaidBreakMinutes: number;
  paidHours: number;
  isAutoClockOut: boolean;
  isOver8PM: boolean;
  anomalies: string[];
  ownerId: string;
  createdAt?: string;
  job?: string;              // parsed or manual job department
}

export interface Employee {
  id?: string;
  name: string;
  employeeCode?: string;      // custom employee ID (Employee ID)
  dept?: string;              // Dept
  dateHired?: string;         // Date Hired
  dateTerminated?: string;    // Date Terminated
  hourlyRate: number;         // standard hourly rate (Reg Rate)
  otRate?: number;            // OT Rate
  taxStatus?: string;         // Tax Status (e.g. "Single", "Married")
  taxableIncome?: number;     // Taxable Income
  taxesWithheld?: number;     // Taxes Withheld
  insuranceDeduction?: number; // Insurance Deduction
  taxesWithheld2?: number;    // Taxes Withheld 2
  checkAmount?: number;       // Check Amount
  mbExempt?: boolean;         // M & B Exempt / Meals & Beverage Exempt
  tipped?: boolean;           // Tipped
  isSalary?: boolean;         // Is salaried employee
  salaryAmount?: number;      // Salary amount (if applicable)
  payAmount?: number;         // Pay Amount
  actualCashPay?: number;     // Actual Cash Pay
  sickDayEligible?: boolean;  // Sick day eligible
  phoneNo?: string;           // Phone No
  address?: string;           // Address
  note?: string;              // Note
  role: string;               // e.g., "Line Cook", "Server"
  ownerId: string;
  createdAt?: string;
}

export interface DailySale {
  id?: string;
  date: string;          // format: YYYY-MM-DD
  recipeId: string;
  recipeName: string;
  quantitySold: number;
  sellingPrice: number;
  costPerPortion: number;
  totalRevenue: number;
  totalCost: number;
  margin: number;
  ownerId: string;
  createdAt?: string;
}

export interface ConsumptionLog {
  id?: string;
  date: string;          // consumption date
  vendorName: string;    // selected or custom vendor
  ingredientId: string;  // ID of ingredient
  ingredientName: string;// name of ingredient
  quantity: number;      // quantity consumed
  unit: string;          // unit
  pricePerPack: number;  // cost per pack
  totalCost: number;     // total consumption cost
  recordedBy: string;    // recorded by name
  ownerId: string;       // workspace identifier
  createdAt: string;     // ISO timestamp
  signatureBase64?: string; // canvas draw signature image in base64 string
  operatorName?: string;   // typed operator name for sign-off
}

export interface GroceryPurchaseItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;              // total line cost
  unitPrice?: number;         // unit cost (price / quantity)
  category?: string;          // Produce, Dairy, Meat, Dry Goods, Beverages, Bakery, Supplies, Other
  linkedIngredientId?: string;// ID of matching master ingredient
  notes?: string;
}

export interface GroceryPurchase {
  id?: string;
  date: string;               // YYYY-MM-DD
  storeName: string;          // e.g., Costco, Trader Joe's, Local Market, Whole Foods, H Mart, Restaurant Depot
  totalAmount: number;
  paymentMethod: "Company Card" | "Petty Cash" | "Personal Reimbursement" | "Debit / Cash" | "Other";
  purchaserName?: string;
  receiptNumber?: string;
  notes?: string;
  items: GroceryPurchaseItem[];
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GroceryShoppingItem {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  category?: string;
  storePreferred?: string;
  estimatedCost?: number;
  isChecked?: boolean;
  linkedIngredientId?: string;
  notes?: string;
  ownerId: string;
  createdAt?: string;
}

export interface OrderListItem {
  ingredientId?: string;
  name: string;
  quantity: number;
  unit: string;
  estimatedPrice?: number;
  notes?: string;
}

export interface OrderList {
  id?: string;
  vendorId?: string;
  vendorName: string;
  status: "draft" | "ordered" | "received" | "cancelled";
  items: OrderListItem[];
  totalEstimatedCost?: number;
  expectedDeliveryDate?: string;
  notes?: string;
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
}

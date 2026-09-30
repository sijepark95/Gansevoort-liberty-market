import React, { useState, useEffect, Suspense } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage, signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset, handleSignOut, handleFirestoreError, OperationType, safeAddDoc, safeSetDoc, safeUpdateDoc, safeDeleteDoc, safeBulkDeleteDocs } from "./lib/firebase";
import { Ingredient, Recipe, ParsedInvoiceItem, Timecard, Employee, DailySale, Vendor, Department, Restaurant, GroceryPurchase, GroceryShoppingItem, ConsumptionLog } from "./types";
import { getGramsOrMlEquivalent, calculateIngredientUnitPrice, calculatePoundData, extractWeightSpecFromName, convertFromGrams } from "./lib/unitConverter";
import { getNormalizedVendorKey } from "./lib/vendorUtils";
import MainHeader from "./components/MainHeader";
import type { QueueItem } from "./components/AIParserView";
const AIParserView = React.lazy(() => import("./components/AIParserView"));
const IngredientsView = React.lazy(() => import("./components/IngredientsView"));
const RecipesView = React.lazy(() => import("./components/RecipesView"));
const TimesheetView = React.lazy(() => import("./components/TimesheetView"));
const StaffRegistryView = React.lazy(() => import("./components/StaffRegistryView"));
const FoodCostIntelView = React.lazy(() => import("./components/FoodCostIntelView"));
const GroceryView = React.lazy(() => import("./components/GroceryView"));
const CollaboratorsView = React.lazy(() => import("./components/CollaboratorsView"));
const DashboardView = React.lazy(() => import("./components/DashboardView"));
const InventoryView = React.lazy(() => import("./components/InventoryView"));
const VendorsView = React.lazy(() => import("./components/VendorsView").then(module => ({ default: module.VendorsView })));
const DepartmentsView = React.lazy(() => import("./components/DepartmentsView").then(module => ({ default: module.DepartmentsView })));
const OrderTemplatesView = React.lazy(() => import("./components/OrderTemplatesView").then(module => ({ default: module.OrderTemplatesView })));
const OrderListView = React.lazy(() => import("./components/OrderListView").then(module => ({ default: module.OrderListView })));
const InvoiceManagementView = React.lazy(() => import("./components/InvoiceManagementView").then(module => ({ default: module.InvoiceManagementView })));
const ReportCenterView = React.lazy(() => import("./components/ReportCenterView").then(module => ({ default: module.ReportCenterView })));
const SystemArchitectureView = React.lazy(() => import("./components/SystemArchitectureView"));
import { AIChatbot } from "./components/AIChatbot";
const SalesDataView = React.lazy(() => import("./components/SalesDataView"));
import LandingPage from "./components/LandingPage";
import InvitationAlert from "./components/InvitationAlert";
import { 
  ChefHat, 
  Sparkles, 
  FileSpreadsheet, 
  DollarSign,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Users,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Package,
  Building2,
  Home,
  FileText,
  LayoutDashboard,
  Briefcase,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  ShoppingCart,
  Plus,
  Database
} from "lucide-react";


export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeSection, setActiveSection] = useState<string>("dashboard");
  const [showAuth, setShowAuth] = useState(false);

  // Email login / Sign-up / Forgot password States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [authError, setAuthError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleSigningIn, setGoogleSigningIn] = useState(false);

  const handleGoogleAuth = async () => {
    if (googleSigningIn) return;
    setGoogleSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/popup-blocked") {
        setAuthError("Popup blocked by your browser. Please allow popups for this site and try again.");
      } else if (code === "auth/unauthorized-domain") {
        setAuthError("This domain is not authorized for OAuth in Firebase Console. Please add it to Authorized Domains in Firebase Authentication Settings.");
      } else if (code !== "auth/cancelled-popup-request" && code !== "auth/popup-closed-by-user") {
        setAuthError(err?.message || "Google sign-in could not be completed. Please try again.");
      }
    } finally {
      setGoogleSigningIn(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setAuthError("Please fill in both email and password fields.");
      return;
    }
    setAuthError(null);
    setResetSuccess(null);
    setAuthSubmitting(true);
    try {
      if (authMode === "signin") {
        await signInWithEmail(email.trim(), password);
      } else {
        await signUpWithEmail(email.trim(), password);
      }
    } catch (err: any) {
      const code = err?.code || "";
      const msgStr = err?.message || "";
      console.error("Firebase Auth Error:", code, msgStr);

      let msg = "An authentication error occurred. Please try again.";

      if (code === "auth/operation-not-allowed" || msgStr.includes("auth/operation-not-allowed")) {
        msg = "Email/Password sign-in is currently disabled in your Firebase project. Please sign in instantly using the Google button below, or enable Email/Password provider in your Firebase Authentication Console.";
      } else if (code === "auth/email-already-in-use" || msgStr.includes("auth/email-already-in-use")) {
        msg = "An account with this email address already exists. Please switch to 'Sign In' to log in, or sign in with Google.";
      } else if (
        code === "auth/invalid-credential" ||
        msgStr.includes("auth/invalid-credential") ||
        code === "auth/wrong-password" ||
        msgStr.includes("auth/wrong-password") ||
        code === "auth/user-not-found" ||
        msgStr.includes("auth/user-not-found")
      ) {
        if (authMode === "signin") {
          msg = "Invalid email or password. If you do not have an account yet, please click 'Create Account' above. If you forgot your password, click 'Forgot password?'.";
        } else {
          msg = "Unable to create account with these credentials. Please check your email and try again.";
        }
      } else if (code === "auth/weak-password" || msgStr.includes("auth/weak-password")) {
        msg = "Password is too weak. Please use at least 6 characters.";
      } else if (code === "auth/invalid-email" || msgStr.includes("auth/invalid-email")) {
        msg = "Please enter a valid email address.";
      } else if (code === "auth/too-many-requests" || msgStr.includes("auth/too-many-requests")) {
        msg = "Access temporarily disabled due to multiple failed attempts. You can reset your password or try again in a few moments.";
      } else {
        msg = err?.message || msg;
      }
      setAuthError(msg);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setAuthError("Please enter your email address to receive a password reset link.");
      return;
    }
    setAuthError(null);
    setResetSuccess(null);
    setAuthSubmitting(true);
    try {
      await sendPasswordReset(email.trim());
      setResetSuccess(`Password reset link sent to ${email.trim()}! Please check your inbox (and spam folder) for instructions to reset your password.`);
    } catch (err: any) {
      const code = err?.code || "";
      const msgStr = err?.message || "";
      console.error("Password Reset Error:", code, msgStr);

      let msg = "Failed to send password reset email. Please try again.";

      if (code === "auth/user-not-found" || msgStr.includes("auth/user-not-found")) {
        msg = "No registered account was found with this email address. Please check the spelling or create an account.";
      } else if (code === "auth/invalid-email" || msgStr.includes("auth/invalid-email")) {
        msg = "Please enter a valid email address.";
      } else if (code === "auth/too-many-requests" || msgStr.includes("auth/too-many-requests")) {
        msg = "Too many password reset attempts. Please wait a few moments before trying again.";
      } else {
        msg = err?.message || msg;
      }
      setAuthError(msg);
    } finally {
      setAuthSubmitting(false);
    }
  };

  React.useEffect(() => {
    document.title = "SMA Management System";
  }, []);
  
  // Background Parsing States
  const [parserQueue, setParserQueue] = useState<QueueItem[]>([]);
  const [parserActiveQueueId, setParserActiveQueueId] = useState<string | null>(null);
  const [parserParsingAll, setParserParsingAll] = useState(false);
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("sidebarCollapsed");
      return saved === "true";
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem("sidebarCollapsed", String(next));
      } catch (err) {
        console.warn("Storage item write blocked:", err);
      }
      return next;
    });
  };

  // Dynamic real-time collection state
  const [restaurants, setRestaurants] = useState<string[]>([]);
  const [viewTab, setViewTab] = useState("Inventory");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [orderLists, setOrderLists] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [timecards, setTimecards] = useState<Timecard[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dailySales, setDailySales] = useState<DailySale[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  
  const [salesUploads, setSalesUploads] = useState<any[]>([]);
  const [groceryPurchases, setGroceryPurchases] = useState<GroceryPurchase[]>([]);
  const [groceryShoppingList, setGroceryShoppingList] = useState<GroceryShoppingItem[]>([]);

  // Workspace Sharing & Department states
  const [workspaceOwnerId, setWorkspaceOwnerId] = useState<string | null>(() => localStorage.getItem("workspaceOwnerId"));
  const [workspaceOwnerEmail, setWorkspaceOwnerEmail] = useState<string | null>(() => localStorage.getItem("workspaceOwnerEmail"));
  const [myShares, setMyShares] = useState<any[]>([]); // people I invited
  const [incomingShares, setIncomingShares] = useState<any[]>([]); // people who invited me
  const [incomingSharesLoaded, setIncomingSharesLoaded] = useState(false);
  const [customDepartments, setCustomDepartments] = useState<Department[]>([]); // custom departments in active workspace

  // Resolved list of flat department names
  const resolvedDepts = React.useMemo(() => {
    const fromDb = customDepartments.map(d => d.name || "").filter(Boolean);
    const defaults = ["Kitchen", "Bar", "Bakery", "Pastry", "Beverages", "Grill", "Dessert", "Appetizers", "Pantry"];
    const fromRecipes = recipes.map(r => r.department || "").filter(Boolean);
    if (fromDb.length > 0) {
      // Prioritize departments registered in Firestore
      const merged = Array.from(new Set([...fromDb, ...fromRecipes]));
      return merged;
    }
    const merged = Array.from(new Set([...defaults, ...fromRecipes]));
    return merged;
  }, [customDepartments, recipes]);

  // Pending & Accepted incoming shares for current user
  const pendingIncomingShares = React.useMemo(() => {
    return incomingShares.filter((s: any) => s.status === "pending");
  }, [incomingShares]);

  const acceptedIncomingShares = React.useMemo(() => {
    return incomingShares.filter((s: any) => s.status !== "pending" && s.status !== "declined");
  }, [incomingShares]);

  // Resolved user role in current active workspace context
  const userRole = React.useMemo(() => {
    if (!user) return "staff";
    if (!workspaceOwnerId || workspaceOwnerId === user.uid) return "admin";
    const share = incomingShares.find((s: any) => s.ownerId === workspaceOwnerId);
    const role = share?.role || "staff";
    if (role === "viewer") return "staff";
    if (role === "editor") return "manager";
    return role;
  }, [user, workspaceOwnerId, incomingShares]);

  const isReadOnly = React.useMemo(() => {
    return userRole === "staff";
  }, [userRole]);

  React.useEffect(() => {
    if (userRole === "staff" && ["dashboard", "intel", "food-cost", "ai-parser", "catalog", "recipes", "grocery", "staff", "employees", "collaborators", "vendors", "timesheet", "sales-data", "invoices"].includes(activeSection)) {
      setActiveSection("inventory");
    }
  }, [userRole, activeSection]);

  const uniqueVendorsCount = React.useMemo(() => {
    const combinedVendors = new Set<string>();
    vendors.forEach(v => {
      const key = getNormalizedVendorKey(v.name);
      if (key) combinedVendors.add(key);
    });
    ingredients.forEach(i => {
      let vendorName = "";
      if (i.vendor && i.vendor.trim() !== "") {
        vendorName = i.vendor.trim();
      } else if (i.source && i.source.includes("(")) {
        const parts = i.source.split("(");
        if (parts.length > 1) {
          vendorName = parts[1].replace(")", "").trim();
        }
      }
      if (vendorName) {
        const key = getNormalizedVendorKey(vendorName);
        if (key) combinedVendors.add(key);
      }
    });
    return combinedVendors.size;
  }, [vendors, ingredients]);

  // Monitor Auth Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // Monitor Auth Changes and initialize workspaceOwnerId
  useEffect(() => {
    if (user) {
      const savedOwnerId = localStorage.getItem("workspaceOwnerId");
      const savedOwnerEmail = localStorage.getItem("workspaceOwnerEmail");
      if (savedOwnerId && savedOwnerEmail) {
        setWorkspaceOwnerId(savedOwnerId);
        setWorkspaceOwnerEmail(savedOwnerEmail);
      } else {
        setWorkspaceOwnerId(user.uid);
        setWorkspaceOwnerEmail(user.email);
        localStorage.setItem("workspaceOwnerId", user.uid);
        localStorage.setItem("workspaceOwnerEmail", user.email || "");
      }
    } else {
      setWorkspaceOwnerId(null);
      setWorkspaceOwnerEmail(null);
    }
  }, [user]);

  // Sync shares (Collaborators / Invitations)
  useEffect(() => {
    if (!user) {
      setMyShares([]);
      setIncomingShares([]);
      return;
    }

    const emailKey = (user.email || "").toLowerCase();

    // Shares I created or of the active workspace owner
    const activeOwnerId = workspaceOwnerId || user.uid;
    const outQuery = query(collection(db, "shares"), where("ownerId", "==", activeOwnerId));
    const unsubOut = onSnapshot(outQuery, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setMyShares(data);
    }, (error) => {
      console.warn("Error listening to outgoing shares:", error);
    });

    // Shares where I am invited (people who invited me)
    const inQuery = query(collection(db, "shares"), where("invitedEmail", "==", emailKey));
    const unsubIn = onSnapshot(inQuery, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setIncomingShares(data);
      setIncomingSharesLoaded(true);
    }, (error) => {
      console.warn("Error listening to incoming shares:", error);
      setIncomingSharesLoaded(true);
    });

    return () => {
      unsubOut();
      unsubIn();
    };
  }, [user, workspaceOwnerId]);

  // Sync Master Inventory, Recipes, custom departments, and rest of data from Firestore
  useEffect(() => {
    if (!user || !workspaceOwnerId) {
      setIngredients([]);
      setRecipes([]);
      setInvoices([]);
      setTimecards([]);
      setEmployees([]);
      setDailySales([]);
      setCustomDepartments([]);
      setVendors([]);
      setRestaurants([]);
      setSalesUploads([]);
      setGroceryPurchases([]);
      setGroceryShoppingList([]);
      return;
    }

    const targetOwnerId = workspaceOwnerId;

    // ingredients listener
    const ingQuery = query(collection(db, "ingredients"), where("ownerId", "==", targetOwnerId));
    const unsubIngs = onSnapshot(ingQuery, (snapshot) => {
      const data: Ingredient[] = [];
      const hiddenIdsToDelete: string[] = [];
      snapshot.forEach((doc) => {
        const itemData = { id: doc.id, ...doc.data() } as Ingredient;
        if (itemData.isHiddenFromInventory) {
          hiddenIdsToDelete.push(doc.id);
        } else {
          data.push(itemData);
        }
      });

      // Automatically purge/remove ingredients flagged as hidden from inventory
      if (hiddenIdsToDelete.length > 0) {
        safeBulkDeleteDocs("ingredients", hiddenIdsToDelete);
      }

      // Sort alphabetically
      data.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setIngredients(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "ingredients");
    });

    // recipes listener
    const recQuery = query(collection(db, "recipes"), where("ownerId", "==", targetOwnerId));
    const unsubRecipes = onSnapshot(recQuery, (snapshot) => {
      const data: Recipe[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Recipe);
      });
      data.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;
        return (a.name || "").localeCompare(b.name || "");
      });
      setRecipes(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "recipes");
    });

    // invoices listener
    const invQuery = query(collection(db, "invoices"), where("ownerId", "==", targetOwnerId));
    const unsubInvoices = onSnapshot(invQuery, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });


      });
      setInvoices(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "invoices");
    });

    // orderLists listener
    const olQuery = query(collection(db, "orderLists"), where("ownerId", "==", targetOwnerId));
    const unsubOrderLists = onSnapshot(olQuery, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setOrderLists(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "orderLists");
    });

    // timecards listener
    const tcQuery = query(collection(db, "timecards"), where("ownerId", "==", targetOwnerId));
    const unsubTimecards = onSnapshot(tcQuery, (snapshot) => {
      const data: Timecard[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Timecard);
      });
      // Sort chronologically by date
      data.sort((a, b) => b.date.localeCompare(a.date));
      setTimecards(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "timecards");
    });

    // employees listener
    const empQuery = query(collection(db, "employees"), where("ownerId", "==", targetOwnerId));
    let hasSeededRef = false;
    const unsubEmployees = onSnapshot(empQuery, async (snapshot) => {
      const data: Employee[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Employee);
      });
      data.sort((a, b) => a.name.localeCompare(b.name));
      setEmployees(data);

      if (snapshot.empty && !hasSeededRef && targetOwnerId === user.uid) {
        hasSeededRef = true;
        const defaultCSVEmployees = [
          {
            name: "Amara Sterling",
            role: "Senior Server",
            hourlyRate: 19.50,
            employeeCode: "EMP-101",
            dept: "Service",
            otRate: 29.25,
            taxStatus: "Single",
            taxableIncome: 0,
            taxesWithheld: 0,
            insuranceDeduction: 0,
            taxesWithheld2: 0,
            checkAmount: 0,
            mbExempt: false,
            tipped: true,
            isSalary: false,
            salaryAmount: 0,
            payAmount: 0,
            actualCashPay: 0,
            sickDayEligible: true,
            phoneNo: "555-010-2811",
            address: "482 Pine St, Portland OR",
            note: "Standard professional profile with server specialization. Synced matching clock logs."
          },
          {
            name: "Devon Miller",
            role: "Line Cook",
            hourlyRate: 18.00,
            employeeCode: "EMP-102",
            dept: "Kitchen",
            otRate: 27.00,
            taxStatus: "Single",
            taxableIncome: 0,
            taxesWithheld: 0,
            insuranceDeduction: 0,
            taxesWithheld2: 0,
            checkAmount: 0,
            mbExempt: false,
            tipped: false,
            isSalary: false,
            salaryAmount: 0,
            payAmount: 0,
            actualCashPay: 0,
            sickDayEligible: true,
            phoneNo: "555-014-9912",
            address: "109 Wall St, Portland OR",
            note: "Breads and hot-line chef. High accuracy on shift timings."
          },
          {
            name: "Sarah Jenkins",
            role: "Dishwasher",
            hourlyRate: 16.50,
            employeeCode: "EMP-103",
            dept: "Kitchen",
            otRate: 24.75,
            taxStatus: "Single",
            taxableIncome: 0,
            taxesWithheld: 0,
            insuranceDeduction: 0,
            taxesWithheld2: 0,
            checkAmount: 0,
            mbExempt: false,
            tipped: false,
            isSalary: false,
            salaryAmount: 0,
            payAmount: 0,
            actualCashPay: 0,
            sickDayEligible: false,
            phoneNo: "555-019-3382",
            address: "882 Oak Dr, Portland OR",
            note: "Back-of-house utility helper. Auto-clock out failsafe test subject."
          },
          {
            name: "Marcus Chen",
            role: "General Manager",
            hourlyRate: 24.00,
            employeeCode: "EMP-104",
            dept: "Management",
            otRate: 36.00,
            taxStatus: "Single",
            taxableIncome: 0,
            taxesWithheld: 0,
            insuranceDeduction: 0,
            taxesWithheld2: 0,
            checkAmount: 0,
            mbExempt: true,
            tipped: false,
            isSalary: true,
            salaryAmount: 4800,
            payAmount: 0,
            actualCashPay: 0,
            sickDayEligible: true,
            phoneNo: "555-012-7012",
            address: "12 Valley Rd, Portland OR",
            note: "Operations lead. Direct oversight over shift logs and master cost sheet."
          }
        ];

        for (const emp of defaultCSVEmployees) {
          try {
            await safeAddDoc("employees", {
              ...emp,
              ownerId: targetOwnerId,
              createdAt: new Date().toISOString()
            });
          } catch (err) {
            console.error("Error seeding initial employee:", err);
          }
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "employees");
    });

    // dailySales listener
    const saleQuery = query(collection(db, "dailySales"), where("ownerId", "==", targetOwnerId));
    const unsubSales = onSnapshot(saleQuery, (snapshot) => {
      const data: DailySale[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as DailySale);
      });
      setDailySales(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "dailySales");
    });

    // departments listener
    const deptQuery = query(collection(db, "departments"), where("ownerId", "==", targetOwnerId));
    const unsubDepts = onSnapshot(deptQuery, (snapshot) => {
      const data: Department[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Department);
      });
      data.sort((a, b) => a.name.localeCompare(b.name));
      setCustomDepartments(data);
    }, (error) => {
      console.warn("Error listening to custom departments:", error);
    });

    // restaurants listener
    const restQuery = query(collection(db, "restaurants"), where("ownerId", "==", targetOwnerId));
    const unsubRests = onSnapshot(restQuery, (snapshot) => {
      const data: Restaurant[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Restaurant);
      });
      data.sort((a, b) => a.name.localeCompare(b.name));
      setRestaurants(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "restaurants");
    });

    // vendors listener
    const vendorQuery = query(collection(db, "vendors"), where("ownerId", "==", targetOwnerId));
    const unsubVendors = onSnapshot(vendorQuery, (snapshot) => {
      const data: Vendor[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Vendor);
      });
      data.sort((a, b) => a.name.localeCompare(b.name));
      setVendors(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "vendors");
    });

    // salesUploads listener
    const uploadQuery = query(collection(db, "salesUploads"), where("ownerId", "==", targetOwnerId));
    const unsubUploads = onSnapshot(uploadQuery, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      data.sort((a, b) => new Date(b.uploadedAt || "").getTime() - new Date(a.uploadedAt || "").getTime());
      setSalesUploads(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "salesUploads");
    });

    // groceryPurchases listener
    const groceryQuery = query(collection(db, "groceryPurchases"), where("ownerId", "==", targetOwnerId));
    const unsubGrocery = onSnapshot(groceryQuery, (snapshot) => {
      const data: GroceryPurchase[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as GroceryPurchase);
      });
      data.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setGroceryPurchases(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "groceryPurchases");
    });

    // groceryShoppingList listener
    const shoppingQuery = query(collection(db, "groceryShoppingList"), where("ownerId", "==", targetOwnerId));
    const unsubShopping = onSnapshot(shoppingQuery, (snapshot) => {
      const data: GroceryShoppingItem[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as GroceryShoppingItem);
      });
      setGroceryShoppingList(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "groceryShoppingList");
    });

    return () => {
      unsubIngs();
      unsubRecipes();
      unsubInvoices();
      unsubOrderLists();
      unsubTimecards();
      unsubEmployees();
      unsubSales();
      unsubDepts();
      unsubRests();
      unsubVendors();
      unsubUploads();
      unsubGrocery();
      unsubShopping();
    };
  }, [user, workspaceOwnerId]);

  // Department Management Actions
  const handleAddDepartment = async (department: Omit<Department, "id" | "ownerId" | "createdAt">, oldName?: string) => {
    if (!user || !workspaceOwnerId) return;
    const payload = {
      ...department,
      ownerId: workspaceOwnerId,
      createdAt: new Date().toISOString()
    };
    await safeAddDoc("departments", payload);
  };

  const handleEditDepartment = async (id: string, edits: Partial<Department>, oldName?: string) => {
    if (!user) return;
    await safeUpdateDoc("departments", id, edits);
  };

  const handleDeleteDepartment = async (id: string) => {
    if (!user) return;
    await safeDeleteDoc("departments", id);
  };

  const handleSeedDepartments = async () => {
    if (!user) return;
    const defaults = ["Kitchen", "Bar", "Bakery", "Pastry", "Beverages", "Grill", "Dessert", "Appetizers", "Pantry"];
    const promises = defaults.map(name => {
      const payload: Omit<Department, "id"> = {
        name,
        description: "",
        ownerId: workspaceOwnerId || user.uid,
        createdAt: new Date().toISOString()
      };
      return safeAddDoc("departments", payload);
    });
    try {
      await Promise.all(promises);
    } catch (err) {
      console.error("Failed to seed departments", err);
    }
  };

  // Restaurant Management Actions
  const handleAddRestaurant = async (restaurant: Omit<Restaurant, "id" | "ownerId" | "createdAt">, oldName?: string) => {
    if (!user || !workspaceOwnerId) return;
    const payload = {
      ...restaurant,
      ownerId: workspaceOwnerId,
      createdAt: new Date().toISOString()
    };
    await safeAddDoc("restaurants", payload);
  };

  const handleEditRestaurant = async (id: string, edits: Partial<Restaurant>, oldName?: string) => {
    if (!user) return;
    await safeUpdateDoc("restaurants", id, edits);
  };

  const handleDeleteRestaurant = async (id: string) => {
    if (!user) return;
    await safeDeleteDoc("restaurants", id);
  };

  const handleSeedRestaurants = async () => {
    if (!user) return;
    const defaults = ["Downtown Flagship", "Uptown Branch", "Westside Kiosk"];
    const promises = defaults.map(name => {
      const payload: Omit<Restaurant, "id"> = {
        name,
        address: "",
        contactName: "",
        phone: "",
        email: "",
        ownerId: workspaceOwnerId || user.uid,
        createdAt: new Date().toISOString()
      };
      return safeAddDoc("restaurants", payload);
    });
    try {
      await Promise.all(promises);
    } catch (err) {
      console.error("Failed to seed restaurants", err);
    }
  };

  // Invoice Management Actions
  const handleAddOrderList = async (orderList: Omit<any, "id" | "ownerId" | "createdAt" | "updatedAt">) => {
    if (isReadOnly || !user || !workspaceOwnerId) return;
    try {
      const payload = { 
        ...orderList, 
        ownerId: workspaceOwnerId, 
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await safeAddDoc("orderLists", payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "orderLists");
    }
  };

  const handleUpdateOrderList = async (id: string, updates: Partial<any>) => {
    if (isReadOnly) return;
    try {
      await safeUpdateDoc("orderLists", id, { ...updates, updatedAt: new Date().toISOString() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "orderLists");
    }
  };

  const handleDeleteOrderList = async (id: string) => {
    if (isReadOnly) return;
    try {
      await safeDeleteDoc("orderLists", id);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "orderLists");
    }
  };

  const handleAddInvoice = async (invoice: Omit<any, "id" | "ownerId" | "createdAt">) => {
    if (!user || !workspaceOwnerId) return;
    const payload = {
      ...invoice,
      ownerId: workspaceOwnerId,
      createdAt: new Date().toISOString()
    };
    await safeAddDoc("invoices", payload);
  };

  const handleUpdateInvoice = async (id: string, updates: Partial<any>) => {
    await safeUpdateDoc("invoices", id, updates);
  };

  const handleDeleteInvoice = async (id: string) => {
    try {
      setInvoices(prev => prev.filter(inv => inv.id !== id));
      await safeDeleteDoc("invoices", id);
    } catch (err) {
      console.error("Failed to delete invoice from Firestore:", err);
      throw err;
    }
  };

  // Vendor Management Actions
  const handleAddVendor = async (vendor: Omit<Vendor, "id" | "ownerId" | "createdAt">, oldName?: string) => {
    if (!user || !workspaceOwnerId) return;
    const payload = {
      ...vendor,
      ownerId: workspaceOwnerId,
      createdAt: new Date().toISOString()
    };
    await safeAddDoc("vendors", payload);

    // Normalize any existing ingredients with matching vendor names (case-insensitive) to exact casing
    await updateIngredientsWithNewVendorName(vendor.name, vendor.name);

    if (oldName && oldName !== vendor.name) {
      await updateIngredientsWithNewVendorName(oldName, vendor.name);
    }
  };

  const handleSeedVendors = async () => {
    if (!user) return;
    const defaultSuppliers = ["Sysco", "US Foods", "PFG", "Restaurant Depot", "Chef's Warehouse", "Local Produce / Market", "Direct Farm", "In-House / Homemade"];
    const promises = defaultSuppliers.map(name => {
      const payload: Omit<Vendor, "id"> = {
        name,
        contactName: "",
        email: "",
        phone: "",
        address: "",
        note: "",
        ownerId: workspaceOwnerId || user.uid,
        createdAt: new Date().toISOString()
      };
      return safeAddDoc("vendors", payload);
    });
    
    try {
      await Promise.all(promises);
    } catch (err) {
      console.error("Failed to seed vendors", err);
    }
  };

  const handleEditVendor = async (id: string, edits: Partial<Vendor>, oldName?: string) => {
    if (!user) return;
    await safeUpdateDoc("vendors", id, edits);

    if (edits.name && oldName && oldName !== edits.name) {
      await updateIngredientsWithNewVendorName(oldName, edits.name);
    }
  };

  const updateIngredientsWithNewVendorName = async (oldName: string, newName: string) => {
    const batchPromises = ingredients
      .filter(ing => {
        const hasVendor = ing.vendor?.toLowerCase() === oldName.toLowerCase();
        let hasSource = false;
        if (ing.source && ing.source.includes("(")) {
          const parts = ing.source.split("(");
          if (parts.length > 1) {
            const v = parts[1].replace(")", "").trim();
            if (v.toLowerCase() === oldName.toLowerCase()) hasSource = true;
          }
        }
        return hasVendor || hasSource;
      })
      .map(ing => {
        const updates: any = {};
        if (ing.vendor?.toLowerCase() === oldName.toLowerCase()) {
          updates.vendor = newName;
        }
        if (ing.source && ing.source.includes("(")) {
          const parts = ing.source.split("(");
          if (parts.length > 1) {
            const v = parts[1].replace(")", "").trim();
            if (v.toLowerCase() === oldName.toLowerCase()) {
              updates.source = `${parts[0].trim()} (${newName})`;
            }
          }
        }
        return safeUpdateDoc("ingredients", ing.id!, updates);
      });
      
    try {
      await Promise.all(batchPromises);
    } catch (err) {
      console.error("Failed to update ingredients with new vendor name", err);
    }
  };

  const handleDeleteVendor = async (id: string, name: string, isRegistered?: boolean) => {
    if (!user) return;
    
    console.log("Deleting vendor", { id, name, isRegistered });

    // Clear association from ingredients
    const batchPromises = ingredients
      .filter(ing => {
        const hasVendor = ing.vendor?.toLowerCase() === name.toLowerCase();
        let hasSource = false;
        if (ing.source && ing.source.includes("(")) {
          const parts = ing.source.split("(");
          if (parts.length > 1) {
            const v = parts[1].replace(")", "").trim();
            if (v.toLowerCase() === name.toLowerCase()) hasSource = true;
          }
        }
        return hasVendor || hasSource;
      })
      .map(ing => {
        const updates: any = {};
        if (ing.vendor?.toLowerCase() === name.toLowerCase()) {
          updates.vendor = "";
        }
        if (ing.source && ing.source.includes("(")) {
          const parts = ing.source.split("(");
          if (parts.length > 1) {
            const v = parts[1].replace(")", "").trim();
            if (v.toLowerCase() === name.toLowerCase()) {
              updates.source = parts[0].trim(); // Remove the vendor part from source
            }
          }
        }
        console.log("Updating ingredient", ing.id, updates);
        return safeUpdateDoc("ingredients", ing.id!, updates);
      });
      
    try {
      await Promise.all(batchPromises);
      console.log("Updated ingredients successfully");
    } catch (err) {
      console.error("Failed to update ingredients", err);
    }

    if (isRegistered) {
      try {
        console.log("Deleting registered vendor", id);
        await safeDeleteDoc("vendors", id);
      } catch (err) {
        console.error("Failed to delete vendor", err);
      }
    }
  };

  // Actions for manual ingredient overrides
  const handleAddIngredient = async (item: Omit<Ingredient, "id" | "ownerId" | "updatedAt">) => {
    if (!user || !workspaceOwnerId) return;

    // Duplication Check: name, vendor, price, quantity, unit, and source
    const existingMatch = ingredients.find(ing => 
      (ing.name || "").toLowerCase().trim() === (item.name || "").toLowerCase().trim() &&
      (ing.vendor || "") === (item.vendor || "") &&
      (ing.source || "").toLowerCase().trim() === (item.source || "").toLowerCase().trim() &&
      ing.quantity === item.quantity &&
      ing.unit === item.unit &&
      Math.abs((ing.price || 0) - (item.price || 0)) < 0.001
    );

    if (existingMatch) {
      throw new Error("DUPLICATE_ENTRY");
    }

    const payload = {
      ...item,
      ownerId: workspaceOwnerId,
      updatedAt: new Date().toISOString()
    };
    await safeAddDoc("ingredients", payload);
  };

  const handleEditIngredient = async (id: string, edits: Partial<Ingredient>) => {
    if (!user) return;
    await safeUpdateDoc("ingredients", id, edits);
  };

  const handleDeleteIngredient = async (id: string) => {
    if (!user) return;
    await safeDeleteDoc("ingredients", id);
  };

  const handleBulkDeleteIngredients = async (ids: string[]) => {
    if (!user) return;
    await safeBulkDeleteDocs("ingredients", ids);
  };

  const handleMatchAndMergeIngredients = async (masterId: string, mergeIds: string[]) => {
    if (!user || !masterId || mergeIds.length === 0) return;

    const masterIng = ingredients.find(i => i.id === masterId);
    if (!masterIng) return;

    let additionalStock = 0;
    // 1. Gather stock and delete merged items from database
    for (const mergeId of mergeIds) {
      const mergedIng = ingredients.find(i => i.id === mergeId);
      if (mergedIng) {
        additionalStock += mergedIng.inStock || 0;
        await safeDeleteDoc("ingredients", mergeId);
      }
    }

    // 2. Update master ingredient stock
    const currentStock = masterIng.inStock || 0;
    await safeUpdateDoc("ingredients", masterId, {
      inStock: currentStock + additionalStock,
      updatedAt: new Date().toISOString()
    });

    // 3. Update any recipe references
    for (const recipe of recipes) {
      let isRecipeUpdated = false;
      const updatedIngredients = recipe.ingredients.map(recIng => {
        if (mergeIds.includes(recIng.ingredientId)) {
          isRecipeUpdated = true;
          return {
            ...recIng,
            ingredientId: masterId,
            name: masterIng.name
          };
        }
        return recIng;
      });

      if (isRecipeUpdated && recipe.id) {
        // Combine duplicate ingredients if we merged multiple things into the same master
        const combinedIngredients: typeof recipe.ingredients = [];
        updatedIngredients.forEach(ing => {
          const existing = combinedIngredients.find(x => x.ingredientId === ing.ingredientId);
          if (existing) {
            existing.grams += ing.grams;
          } else {
            combinedIngredients.push({ ...ing });
          }
        });

        // Recalculate cost
        let totalCost = 0;
        combinedIngredients.forEach(recIng => {
          const ingDetail = ingredients.find(i => i.id === recIng.ingredientId) || (recIng.ingredientId === masterId ? masterIng : null);
          const rate = ingDetail ? ingDetail.pricePerGram : 0;
          totalCost += recIng.grams * rate;
        });

        const yieldValue = recipe.expectedYield || 1;
        const costPerServing = totalCost / yieldValue;
        const profitMargin = recipe.sellingPrice > 0 ? ((recipe.sellingPrice - costPerServing) / recipe.sellingPrice) * 100 : 0;

        await safeUpdateDoc("recipes", recipe.id, {
          ingredients: combinedIngredients,
          totalCost,
          costPerPortion: costPerServing,
          profitMargin,
          updatedAt: new Date().toISOString()
        });
      }
    }
  };

  // Actions for recipes overrides
  const handleAddRecipe = async (item: Omit<Recipe, "id" | "ownerId" | "updatedAt">) => {
    if (!user || !workspaceOwnerId) return;
    const payload = {
      ...item,
      ownerId: workspaceOwnerId,
      updatedAt: new Date().toISOString()
    };
    await safeAddDoc("recipes", payload);
  };

  const handleEditRecipe = async (id: string, edits: Partial<Recipe>) => {
    if (!user) return;
    await safeUpdateDoc("recipes", id, {
      ...edits,
      updatedAt: new Date().toISOString()
    });
  };

  const handleDeleteRecipe = async (id: string) => {
    if (!user) return;
    await safeDeleteDoc("recipes", id);
  };

  const handleReorderRecipes = async (reordered: Recipe[]) => {
    if (!user) return;
    setRecipes(reordered);
    const promises = reordered.map((rec, index) => {
      if (!rec.id) return Promise.resolve();
      return safeUpdateDoc("recipes", rec.id, {
        order: index,
        updatedAt: new Date().toISOString()
      });
    });
    try {
      await Promise.all(promises);
    } catch (err) {
      console.error("Failed to reorder recipes:", err);
    }
  };

  // Grocery Management Handlers
  const handleAddGroceryPurchase = async (purchase: Omit<GroceryPurchase, "id" | "ownerId" | "createdAt" | "updatedAt">) => {
    if (!user || !workspaceOwnerId) return;
    const payload = {
      ...purchase,
      ownerId: workspaceOwnerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await safeAddDoc("groceryPurchases", payload);
  };

  const handleUpdateGroceryPurchase = async (id: string, edits: Partial<GroceryPurchase>) => {
    if (!user) return;
    await safeUpdateDoc("groceryPurchases", id, {
      ...edits,
      updatedAt: new Date().toISOString()
    });
  };

  const handleDeleteGroceryPurchase = async (id: string) => {
    if (!user) return;
    await safeDeleteDoc("groceryPurchases", id);
  };

  const handleAddShoppingItem = async (item: Omit<GroceryShoppingItem, "id" | "ownerId" | "createdAt">) => {
    if (!user || !workspaceOwnerId) return;
    const payload = {
      ...item,
      ownerId: workspaceOwnerId,
      createdAt: new Date().toISOString()
    };
    await safeAddDoc("groceryShoppingList", payload);
  };

  const handleToggleShoppingItem = async (id: string, isChecked: boolean) => {
    if (!user) return;
    await safeUpdateDoc("groceryShoppingList", id, { isChecked });
  };

  const handleDeleteShoppingItem = async (id: string) => {
    if (!user) return;
    await safeDeleteDoc("groceryShoppingList", id);
  };

  const handleClearCheckedShoppingItems = async () => {
    if (!user) return;
    const checkedIds = groceryShoppingList.filter(s => s.isChecked && s.id).map(s => s.id!);
    if (checkedIds.length > 0) {
      await safeBulkDeleteDocs("groceryShoppingList", checkedIds);
    }
  };

  const handleSyncIngredientPriceFromGrocery = async (ingredientId: string, newUnitPrice: number, unit: string) => {
    if (!user || !ingredientId) return;
    const ing = ingredients.find(i => i.id === ingredientId);
    if (!ing) return;

    const factor = getGramsOrMlEquivalent(1, unit || ing.unit || "g");
    const pricePerGram = factor > 0 ? newUnitPrice / factor : newUnitPrice;

    await safeUpdateDoc("ingredients", ingredientId, {
      price: newUnitPrice,
      pricePerGram: pricePerGram,
      unit: unit || ing.unit,
      source: "Grocery Store Purchase",
      updatedAt: new Date().toISOString()
    });
  };

  // Actions for employee timecards
  const handleAddTimecard = async (item: Omit<Timecard, "id" | "ownerId" | "createdAt">) => {
    if (!user || !workspaceOwnerId) return;
    const payload = {
      ...item,
      ownerId: workspaceOwnerId,
      createdAt: new Date().toISOString()
    };
    await safeAddDoc("timecards", payload);
  };

  const handleBulkDeleteTimecards = async (ids: string[]) => {
    if (!user) return;
    await safeBulkDeleteDocs("timecards", ids);
  };

  // Actions for employees
  const handleAddEmployee = async (item: Omit<Employee, "id" | "ownerId" | "createdAt">) => {
    if (!user || !workspaceOwnerId) return;
    const payload = {
      ...item,
      ownerId: workspaceOwnerId,
      createdAt: new Date().toISOString()
    };
    await safeAddDoc("employees", payload);

    // Automatically propagate employeeCode to existing timecards in Firestore
    if (item.employeeCode) {
      const matchingTimecards = timecards.filter(tc => 
        tc.employeeName.toLowerCase().trim() === item.name.toLowerCase().trim() &&
        tc.employeeCode !== item.employeeCode
      );
      for (const tc of matchingTimecards) {
        if (tc.id) {
          await safeUpdateDoc("timecards", tc.id, { employeeCode: item.employeeCode });
        }
      }
    }
  };

  const handleEditEmployee = async (id: string, edits: Partial<Employee>) => {
    if (!user) return;
    await safeUpdateDoc("employees", id, edits);
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!user) return;
    await safeDeleteDoc("employees", id);
  };

  const handleAddDailySale = async (item: Omit<DailySale, "id" | "ownerId" | "createdAt">) => {
    if (!user || !workspaceOwnerId) return;
    const payload = {
      ...item,
      ownerId: workspaceOwnerId,
      createdAt: new Date().toISOString()
    };
    await safeAddDoc("dailySales", payload);
  };

  const handleDeleteDailySale = async (id: string) => {
    if (!user) return;
    await safeDeleteDoc("dailySales", id);
  };

  const handleUpdateDailySale = async (id: string, edits: Partial<DailySale>) => {
    if (!user) return;
    await safeUpdateDoc("dailySales", id, edits);
  };

  const handleAddSalesUpload = async (upload: Omit<any, "id" | "ownerId">) => {
    if (!user || !workspaceOwnerId) return;
    const payload = {
      ...upload,
      ownerId: workspaceOwnerId
    };
    await safeAddDoc("salesUploads", payload);
  };

  const handleDeleteSalesUpload = async (id: string) => {
    if (!user) return;
    await safeDeleteDoc("salesUploads", id);
  };

  // Intelligent Invoice Mapping Apply callback
  const handleApplyParsedItems = async (
    itemsToApply: Array<{
      action: "create" | "map" | "skip";
      parsedItem: ParsedInvoiceItem;
      targetIngredientId?: string;
    }>,
    vendor: string,
    invoiceNumber: string,
    date: string,
    fileName?: string,
    isPriceCorrectionOnly: boolean = false,
    fileAttachment?: {
      fileUrl?: string;
      fileType?: string;
      fileSize?: number;
    }
  ) => {
    const targetOwnerId = workspaceOwnerId || user?.uid || "default-owner";

    // Helper to normalize invoice date string to ISO YYYY-MM-DD
    const normalizeDateToISO = (dateStr?: string): string => {
      if (!dateStr || !dateStr.trim()) {
        return new Date().toISOString().slice(0, 10);
      }
      const trimmed = dateStr.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
      }
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      return new Date().toISOString().slice(0, 10);
    };

    const consumptionDateIso = normalizeDateToISO(date);
    const invoiceRecordedBy = invoiceNumber ? `AI Document Parser (#${invoiceNumber})` : "AI Document Parser";
    const invoiceOperatorName = user?.displayName || user?.email || "AI Document Parser";

    // Auto-register vendor in suppliers list if not already present
    if (vendor && vendor.trim() && vendor !== "Unknown Vendor") {
      const cleanVendor = vendor.trim();
      const alreadyHas = vendors.some(v => v.name && v.name.toLowerCase().trim() === cleanVendor.toLowerCase());
      if (!alreadyHas) {
        try {
          await safeAddDoc("vendors", {
            name: cleanVendor,
            ownerId: targetOwnerId,
            createdAt: new Date().toISOString(),
            isRegistered: true
          });
        } catch (vErr) {
          console.warn("Could not register vendor:", vErr);
        }
      }
    }

    const localIngredientsMap = new Map<string, any>();

    // Process mapped array synchronously or via promise batched array
    for (const item of itemsToApply) {
      if (item.action === "skip") continue;

      const { name, totalPrice, quantity, unit } = item.parsedItem;
      const parsedUnit = unit || "g";
      const rawQtyStr = String(quantity || "").replace(/[^0-9.]/g, '');
      const coercedQty = Number(rawQtyStr) || 1;
      
      const rawPriceStr = String(totalPrice || "").replace(/[^0-9.]/g, '');
      const coercedPrice = Number(rawPriceStr) || 0;

      if (item.action === "create") {
        const itemSource = isPriceCorrectionOnly
          ? `Price correction (${vendor || fileName || "document"})`
          : `Invoice #${invoiceNumber || "N/A"} (${vendor})`;

        // Check if we JUST created this exact item in a previous iteration of this batch!
        let previouslyCreatedId: string | null = null;
        for (const [id, localIng] of localIngredientsMap.entries()) {
          if (localIng.name && localIng.name.toLowerCase().trim() === (name || "").toLowerCase().trim()) {
            previouslyCreatedId = id;
            break;
          }
        }
        
        if (previouslyCreatedId) {
          // HIJACK: We already created this in this batch, pile onto it!
          item.action = "map";
          item.targetIngredientId = previouslyCreatedId;
          // Restart this iteration by re-pushing it and continuing
          itemsToApply.push(item);
          continue;
        }

        // Check if an identical item or ingredient with the same name already exists in catalog
        const matchingBaseIng = ingredients.find(ing => (ing.name || "").toLowerCase().trim() === (name || "").toLowerCase().trim());
        
        if (matchingBaseIng) {
          // If an ingredient with the exact same name already exists in catalog,
          // map onto it so stock piles and rates update on the existing stock item
          item.action = "map";
          item.targetIngredientId = matchingBaseIng.id;
          itemsToApply.push(item);
          continue;
        }

        let finalPricePerGram = 0;
        const nameSpec = extractWeightSpecFromName(name);
        const finalWeightPerCase = item.parsedItem.weightPerCase !== undefined && Number(item.parsedItem.weightPerCase) > 0
          ? Number(item.parsedItem.weightPerCase)
          : nameSpec?.weight;
        const finalWeightPerCaseUnit = item.parsedItem.weightPerCaseUnit || nameSpec?.unit || "lb";
        const finalUsability = item.parsedItem.usabilityPercentage !== undefined ? Number(item.parsedItem.usabilityPercentage) : 100;

        finalPricePerGram = calculateIngredientUnitPrice({
          price: coercedPrice,
          quantity: coercedQty,
          unit: parsedUnit,
          weightPerCase: finalWeightPerCase,
          weightPerCaseUnit: finalWeightPerCaseUnit,
        });

        if (isNaN(finalPricePerGram) || !isFinite(finalPricePerGram) || finalPricePerGram < 0) {
          finalPricePerGram = 0;
        }

        const newUnitPrice = coercedQty > 0 ? coercedPrice / coercedQty : 0;
        // In price correction mode, new catalog items default to 0 on-hand stock unless receiving deliveries
        const initialStock = isPriceCorrectionOnly ? 0 : coercedQty;

        // Create as a brand new ingredient with mathematically correct normalized pricePerGram
        const createPayload = {
          name,
          price: newUnitPrice,
          quantity: 1,
          inStock: initialStock,
          unit: parsedUnit,
          pricePerGram: finalPricePerGram,
          source: itemSource,
          vendor: vendor || undefined,
          ownerId: targetOwnerId,
          updatedAt: new Date().toISOString(),
          usabilityPercentage: finalUsability,
          ...(finalWeightPerCase && finalWeightPerCase > 0 ? {
            weightPerCase: finalWeightPerCase,
            weightPerCaseUnit: finalWeightPerCaseUnit
          } : {})
        };
        const newDocRef = await safeAddDoc("ingredients", createPayload);
        
        localIngredientsMap.set(newDocRef.id, {
          id: newDocRef.id,
          ...createPayload
        });

        // Record inbound receiving in Restaurant Ingredient Consumption Log
        if (coercedQty > 0) {
          try {
            const consumptionRecord: Omit<ConsumptionLog, "id"> = {
              date: consumptionDateIso,
              vendorName: (vendor && vendor.trim()) || "AI Invoice Import",
              ingredientId: newDocRef.id,
              ingredientName: name,
              quantity: -Math.abs(coercedQty), // Negative quantity represents addition / restock
              unit: parsedUnit,
              pricePerPack: newUnitPrice,
              totalCost: -Math.abs(coercedPrice), // Negative total cost represents inbound value
              recordedBy: invoiceRecordedBy,
              operatorName: invoiceOperatorName,
              ownerId: targetOwnerId,
              createdAt: new Date().toISOString()
            };
            await safeAddDoc("inventory_consumptions", consumptionRecord);
          } catch (consErr) {
            console.error("Failed to log consumption for created ingredient:", consErr);
          }
        }
      } else if (item.action === "map") {
        let targetId = item.targetIngredientId;
        if (!targetId) {
          const matchByName = ingredients.find(ing => (ing.name || "").toLowerCase().trim() === (name || "").toLowerCase().trim());
          if (matchByName) {
            targetId = matchByName.id;
          } else {
            // Cannot find map target, fallback to create
            item.action = "create";
            itemsToApply.push(item);
            continue;
          }
        }

        const baseIng = ingredients.find(ing => ing.id === targetId);
        const targetIng = localIngredientsMap.get(targetId) || baseIng;
        
        // Infer weight specification from item name, target name, or parsed fields
        const inferredSpec = extractWeightSpecFromName(name) || (targetIng ? extractWeightSpecFromName(targetIng.name) : null);
        const finalWeightPerCase = item.parsedItem.weightPerCase !== undefined && Number(item.parsedItem.weightPerCase) > 0
          ? Number(item.parsedItem.weightPerCase)
          : (targetIng?.weightPerCase || inferredSpec?.weight);
        const finalWeightPerCaseUnit = item.parsedItem.weightPerCaseUnit || targetIng?.weightPerCaseUnit || inferredSpec?.unit || "lb";
        const finalUsability = item.parsedItem.usabilityPercentage !== undefined 
          ? Number(item.parsedItem.usabilityPercentage) 
          : (targetIng?.usabilityPercentage !== undefined ? targetIng.usabilityPercentage : 100);

        // Keep target ingredient's established tracking unit so recipes and stock sheets remain consistent
        const targetUnit = (targetIng?.unit || parsedUnit || "lb").toLowerCase().trim();
        const incomingUnit = (parsedUnit || targetUnit).toLowerCase().trim();

        // Calculate incoming stock in target ingredient's unit
        let addedQtyInTargetUnit = coercedQty;
        if (incomingUnit !== targetUnit) {
          const incomingPoundInfo = calculatePoundData(
            coercedQty,
            incomingUnit,
            finalWeightPerCase,
            finalWeightPerCaseUnit,
            targetIng?.pcsPerPound,
            undefined,
            name
          );

          if (["lb", "lbs", "pound", "pounds"].includes(targetUnit) && incomingPoundInfo.lbs > 0) {
            addedQtyInTargetUnit = incomingPoundInfo.lbs;
          } else if (["oz", "ounce", "ounces"].includes(targetUnit) && incomingPoundInfo.lbs > 0) {
            addedQtyInTargetUnit = incomingPoundInfo.lbs * 16;
          } else if (["kg", "kilogram", "kilograms"].includes(targetUnit) && incomingPoundInfo.lbs > 0) {
            addedQtyInTargetUnit = incomingPoundInfo.lbs * 0.45359237;
          } else if (["g", "gram", "grams"].includes(targetUnit) && incomingPoundInfo.lbs > 0) {
            addedQtyInTargetUnit = incomingPoundInfo.lbs * 453.59237;
          } else if (["case", "cases", "box", "boxes", "bag", "bags", "pack", "packs"].includes(targetUnit) && finalWeightPerCase && finalWeightPerCase > 0) {
            const caseLbs = calculatePoundData(1, targetUnit, finalWeightPerCase, finalWeightPerCaseUnit).lbs;
            if (caseLbs > 0 && incomingPoundInfo.lbs > 0) {
              addedQtyInTargetUnit = incomingPoundInfo.lbs / caseLbs;
            }
          } else {
            const gEq = getGramsOrMlEquivalent(coercedQty, incomingUnit);
            if (gEq > 0) {
              const converted = convertFromGrams(gEq, targetUnit);
              if (converted > 0) addedQtyInTargetUnit = converted;
            }
          }
        }

        const currentStock = typeof targetIng?.inStock === "number" ? targetIng.inStock : 0;
        // In Price Correction mode: PRESERVE ON-HAND STOCK COUNT (no stock inflation)
        const newStock = isPriceCorrectionOnly ? currentStock : (currentStock + addedQtyInTargetUnit);

        const newUnitPrice = addedQtyInTargetUnit > 0 ? (coercedPrice / addedQtyInTargetUnit) : (coercedQty > 0 ? coercedPrice / coercedQty : 0);

        let finalPricePerGram = calculateIngredientUnitPrice({
          price: coercedPrice,
          quantity: addedQtyInTargetUnit > 0 ? addedQtyInTargetUnit : coercedQty,
          unit: targetIng?.unit || parsedUnit,
          weightPerCase: finalWeightPerCase,
          weightPerCaseUnit: finalWeightPerCaseUnit,
        });

        if (isNaN(finalPricePerGram) || !isFinite(finalPricePerGram) || finalPricePerGram < 0) {
          finalPricePerGram = 0;
        }

        const updatePayload: any = {
          price: newUnitPrice,
          quantity: 1,
          inStock: newStock,
          unit: targetIng?.unit || parsedUnit, // Preserves the established unit
          pricePerGram: finalPricePerGram, // newest rate standard normalized
          source: isPriceCorrectionOnly
            ? `Price corrected via ${invoiceNumber ? '#' + invoiceNumber : ''} (${vendor || fileName || 'document'})`
            : `Updated via Invoice #${invoiceNumber || "N/A"} (${vendor})`,
          updatedAt: new Date().toISOString(),
          usabilityPercentage: finalUsability,
          ...(vendor ? { vendor } : {}),
          ...(finalWeightPerCase && finalWeightPerCase > 0 ? {
            weightPerCase: finalWeightPerCase,
            weightPerCaseUnit: finalWeightPerCaseUnit
          } : {})
        };

        // Track in local map for subsequent iterations in this batch
        localIngredientsMap.set(targetId, {
          ...(targetIng || {}),
          ...updatePayload,
          id: targetId,
        });

        // Update package price and date of existing ingredient with normalized standard rates
        try {
          await safeUpdateDoc("ingredients", targetId, updatePayload);
        } catch (updErr) {
          console.warn("safeUpdateDoc failed, fallback to safeSetDoc:", updErr);
          try {
            await safeSetDoc("ingredients", targetId, {
              ...updatePayload,
              name: targetIng?.name || name,
              ownerId: targetOwnerId,
            });
          } catch (setErr) {
            console.error("Failed to update or set ingredient doc:", setErr);
          }
        }

        // Record inbound receiving in Restaurant Ingredient Consumption Log
        if (coercedQty > 0) {
          try {
            const cleanVendor = (vendor && vendor.trim()) || (targetIng?.vendor && targetIng.vendor.trim()) || "AI Invoice Import";
            const consumptionRecord: Omit<ConsumptionLog, "id"> = {
              date: consumptionDateIso,
              vendorName: cleanVendor,
              ingredientId: targetId,
              ingredientName: targetIng?.name || name,
              quantity: -Math.abs(addedQtyInTargetUnit), // Negative quantity represents addition / restock in target unit
              unit: targetIng?.unit || parsedUnit,
              pricePerPack: newUnitPrice,
              totalCost: -Math.abs(coercedPrice), // Negative total cost represents inbound value
              recordedBy: invoiceRecordedBy,
              operatorName: invoiceOperatorName,
              ownerId: targetOwnerId,
              createdAt: new Date().toISOString()
            };
            await safeAddDoc("inventory_consumptions", consumptionRecord);
          } catch (consErr) {
            console.error("Failed to log consumption for mapped ingredient:", consErr);
          }
        }
      }
    }

    // Recalculate and update the dependent recipe summaries right in the database 
    // to preserve temporal indexing of cost summaries.
    for (const recipe of recipes) {
      let totalCost = 0;
      let hasIngredientUpdates = false;

      recipe.ingredients.forEach((recIng) => {
        // Did we update or find an ingredient linked?
        const match = itemsToApply.find(
          item => item.action === "map" && item.targetIngredientId === recIng.ingredientId
        );
        
        // Grab current master price
        const masterIng = ingredients.find(ing => ing.id === recIng.ingredientId);
        let currentRate = masterIng ? masterIng.pricePerGram : 0;
        
        if (match) {
          hasIngredientUpdates = true;
          const { totalPrice, quantity, unit } = match.parsedItem;
          const normalizedQty = getGramsOrMlEquivalent(quantity || 1, unit || "g");
          currentRate = totalPrice / normalizedQty;
        }
        totalCost += recIng.grams * currentRate;
      });

      if (hasIngredientUpdates && recipe.id) {
        const yieldValue = recipe.expectedYield || 1;
        const costPerServing = totalCost / yieldValue;
        const profitMargin = recipe.sellingPrice > 0 ? ((recipe.sellingPrice - costPerServing) / recipe.sellingPrice) * 100 : 0;

        try {
          await safeUpdateDoc("recipes", recipe.id, {
            totalCost,
            costPerPortion: costPerServing,
            profitMargin,
            updatedAt: new Date().toISOString()
          });
        } catch (recErr) {
          console.warn("Could not update recipe cost:", recErr);
        }
      }
    }

    // Store processed invoice record to db so we can detect duplicates in the future
    try {
      const cleanFileName = (fileName && fileName.trim().length > 0) ? fileName.trim() : "invoice";
      const totalAmount = itemsToApply.reduce((sum, item) => sum + (Number(item.parsedItem.totalPrice) || 0), 0);

      const invoicePayload: any = {
        fileName: cleanFileName.slice(0, 200),
        invoiceNumber: invoiceNumber || (isPriceCorrectionOnly ? "PRICE-ADJ" : "N/A"),
        vendor: (vendor && vendor.trim()) || "Unknown Vendor",
        issueDate: consumptionDateIso || date || new Date().toISOString().slice(0, 10),
        type: isPriceCorrectionOnly ? "price_correction" : "standard_invoice",
        items: itemsToApply.map(item => ({
          name: item.parsedItem.name || "Item",
          unit: item.parsedItem.unit || "case",
          quantity: item.parsedItem.quantity ?? 1,
          totalPrice: item.parsedItem.totalPrice ?? 0,
          pricePerUnit: item.parsedItem.pricePerUnit ?? 0
        })),
        totalAmount,
        status: "applied",
        ownerId: targetOwnerId,
        createdAt: new Date().toISOString()
      };

      if (fileAttachment?.fileUrl) {
        if (fileAttachment.fileUrl.startsWith("data:")) {
          try {
            // Upload image directly to Firebase Storage
            const ext = (fileAttachment.fileType || "").includes("pdf") ? "pdf" : "png";
            const storagePath = `invoices/${targetOwnerId}/${Date.now()}_${cleanFileName.replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`;
            const storageRef = ref(storage, storagePath);
            
            const response = await fetch(fileAttachment.fileUrl);
            const blob = await response.blob();
            await uploadBytes(storageRef, blob);
            
            const downloadUrl = await getDownloadURL(storageRef);
            invoicePayload.fileUrl = downloadUrl;
          } catch (uploadErr) {
            console.warn("Could not upload invoice file to storage (will save document record):", uploadErr);
            // Fallback: If upload fails, only save to Firestore if small enough (< 200KB) to prevent hitting 1MB document limit
            if (fileAttachment.fileUrl.length < 200000) {
              invoicePayload.fileUrl = fileAttachment.fileUrl;
            }
          }
        } else {
          invoicePayload.fileUrl = fileAttachment.fileUrl;
        }
        invoicePayload.fileType = fileAttachment.fileType || "application/octet-stream";
        invoicePayload.fileSize = fileAttachment.fileSize || 0;
      }

      await safeAddDoc("invoices", invoicePayload);
    } catch (dbErr) {
      console.error("Failed to write invoice audit to database:", dbErr);
    }
  };

  // Collaborators & Shares actions
  const handleInviteCollaborator = async (invitedEmail: string, role: string) => {
    if (!user) return;
    const emailKey = invitedEmail.trim().toLowerCase();
    if (!emailKey) return;

    const activeOwnerId = workspaceOwnerId || user.uid;
    const activeOwnerEmail = workspaceOwnerEmail || user.email || "Unknown Owner";
    const shareId = `${activeOwnerId}_${emailKey}`;
    
    // Check duplication
    const isAlreadyInvited = myShares.some(s => s.invitedEmail === emailKey);
    if (isAlreadyInvited) {
      throw new Error("This user is already invited to this workspace.");
    }

    const payload = {
      ownerId: activeOwnerId,
      ownerEmail: activeOwnerEmail,
      invitedEmail: emailKey,
      role: role,
      status: "pending",
      createdAt: new Date().toISOString()
    };
    
    const { safeSetDoc } = await import("./lib/firebase");
    await safeSetDoc("shares", shareId, payload);

    return { success: true };
  };

  const handleAcceptInvitation = async (shareId: string, ownerId: string, ownerEmail: string) => {
    if (!user) return;
    try {
      const { safeUpdateDoc } = await import("./lib/firebase");
      await safeUpdateDoc("shares", shareId, {
        status: "accepted",
        acceptedAt: new Date().toISOString()
      });
      handleSwitchWorkspace(ownerId, ownerEmail);
    } catch (err: any) {
      console.error("Failed to accept invitation:", err);
      alert("Failed to accept invitation. Please try again.");
    }
  };

  const handleDeclineInvitation = async (shareId: string, ownerEmail?: string) => {
    if (!user) return;
    try {
      const { safeDeleteDoc } = await import("./lib/firebase");
      await safeDeleteDoc("shares", shareId);
    } catch (err: any) {
      console.error("Failed to decline invitation:", err);
    }
  };

  const handleUpdateCollaboratorRole = async (shareId: string, role: string) => {
    if (!user) return;
    try {
      const { safeUpdateDoc } = await import("./lib/firebase");
      await safeUpdateDoc("shares", shareId, { role: role });
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  };

  const handleRemoveCollaborator = async (shareId: string) => {
    if (!user) return;
    await safeDeleteDoc("shares", shareId);
  };

  const handleSwitchWorkspace = (ownerId: string | null, ownerEmail: string | null) => {
    setWorkspaceOwnerId(ownerId);
    setWorkspaceOwnerEmail(ownerEmail);
    if (ownerId) {
      localStorage.setItem("workspaceOwnerId", ownerId);
      localStorage.setItem("workspaceOwnerEmail", ownerEmail || "");
    } else {
      localStorage.removeItem("workspaceOwnerId");
      localStorage.removeItem("workspaceOwnerEmail");
    }
    // Default back to Food Cost tab when switching workspaces
    setActiveSection("intel");
  };

  React.useEffect(() => {
    if (!incomingSharesLoaded || !user) return;

    if (acceptedIncomingShares.length > 0 && !localStorage.getItem("workspaceOwnerId") && !localStorage.getItem("personalWorkspaceExplicitlySet")) {
      const firstShare = acceptedIncomingShares[0];
      handleSwitchWorkspace(firstShare.ownerId, firstShare.ownerEmail);
      localStorage.setItem("personalWorkspaceExplicitlySet", "true");
    } else if (workspaceOwnerId && workspaceOwnerId !== user.uid) {
      // Validate that current non-personal workspaceOwnerId exists in acceptedIncomingShares
      const hasAccess = acceptedIncomingShares.some((s: any) => s.ownerId === workspaceOwnerId);
      if (!hasAccess) {
        handleSwitchWorkspace(user.uid, user.email);
      }
    }
  }, [user, workspaceOwnerId, acceptedIncomingShares, incomingSharesLoaded]);

  // Custom Departments actions
  const handleAddDept = async (deptName: string) => {
    if (!user || !workspaceOwnerId) return;
    const cleanName = deptName.trim();
    if (!cleanName) return;

    const defaults = ["Kitchen", "Bar", "Bakery", "Pastry", "Beverages", "Grill", "Dessert", "Appetizers", "Pantry"];
    const allCurrent = [...defaults, ...customDepartments.map(d => d.name)];
    if (allCurrent.some(d => d.toLowerCase() === cleanName.toLowerCase())) {
      return; // already exists
    }

    await safeAddDoc("departments", {
      name: cleanName,
      ownerId: workspaceOwnerId,
      createdAt: new Date().toISOString()
    });
  };

  const handleDeleteDept = async (deptName: string) => {
    if (!user || !workspaceOwnerId) return;
    const matched = customDepartments.find(d => d.name.toLowerCase() === deptName.toLowerCase());
    if (matched && matched.id) {
      await safeDeleteDoc("departments", matched.id);
    }
  };

  // Helper stats summary for dashboard top rail
  const totalRawInventoryValue = ingredients.reduce((sum, ing) => sum + ing.price, 0);
  const averageRecipeMargin = recipes.length > 0 
    ? recipes.reduce((sum, rec) => sum + rec.profitMargin, 0) / recipes.length 
    : 0;
  const criticalMarginRecipesCount = recipes.filter(rec => rec.profitMargin < 50).length;

  return (
    <div className="min-h-screen bg-[#fafaf9] flex flex-col font-sans text-neutral-900 selection:bg-neutral-200" id="main-container">
      {/* App Header (Only shown for guest/onboarding flow) */}
      {!user && <MainHeader user={user} loadingAuth={loadingAuth} workspaceOwnerEmail={workspaceOwnerEmail} />}

      {/* Onboarding Login Wall in case not signed-in (Zero-Trust Security requirement) */}
      {!user && !loadingAuth && !showAuth ? (
        <LandingPage onAccessPortal={() => setShowAuth(true)} />
      ) : !user && !loadingAuth && showAuth ? (
        <main className="flex-1 max-w-md mx-auto flex items-center justify-center p-6 w-full">
          <div className="bg-white rounded-xl border border-neutral-200 p-8 shadow-sm text-center space-y-6 w-full" id="login-wall-container">
            <div className="w-14 h-14 bg-blue-700 text-white rounded-xl flex items-center justify-center mx-auto border border-neutral-200">
              <Building2 className="h-6 w-6" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-base font-bold text-neutral-900 font-sans font-medium tracking-tight">SMA Internal Portal</h2>
              <p className="text-neutral-900/60 font-serif italic text-xs max-w-xs mx-auto">
                Sign in to access unified multi-store analytics, timesheets, and inventory control.
              </p>
            </div>

            {/* SEGMENT CONTROL FOR SIGN IN / SIGN UP OR FORGOT PASSWORD HEADER */}
            {authMode === "forgot" ? (
              <div className="flex items-center justify-between bg-neutral-100 p-2 rounded-xl border border-neutral-200">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signin");
                    setAuthError(null);
                    setResetSuccess(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-700 hover:text-neutral-900 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Sign In</span>
                </button>
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Account Recovery</span>
              </div>
            ) : (
              <div className="flex bg-neutral-100 p-1 rounded-xl border border-neutral-200">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signin");
                    setAuthError(null);
                    setResetSuccess(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    authMode === "signin"
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signup");
                    setAuthError(null);
                    setResetSuccess(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    authMode === "signup"
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  Create Account
                </button>
              </div>
            )}

            {/* FORGOT PASSWORD FORM */}
            {authMode === "forgot" ? (
              <form onSubmit={handlePasswordResetSubmit} className="space-y-4 text-left">
                {resetSuccess ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-250 rounded-xl space-y-2 text-xs text-emerald-900 leading-relaxed">
                    <div className="flex items-center gap-2 font-bold text-emerald-850">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Password Reset Link Sent</span>
                    </div>
                    <p>{resetSuccess}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("signin");
                        setAuthError(null);
                        setResetSuccess(null);
                      }}
                      className="mt-2 text-xs font-bold text-emerald-800 underline hover:text-emerald-950 block cursor-pointer"
                    >
                      Return to Sign In &rarr;
                    </button>
                  </div>
                ) : (
                  <>
                    {authError && (
                      <div className="p-3 bg-red-50 border border-red-250 rounded-xl flex items-start gap-2 text-xs text-red-800 leading-normal">
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                        <span>{authError}</span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                        Account Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@company.com"
                          className="w-full text-xs border border-neutral-200 rounded-xl pl-10 pr-3 py-2.5 bg-[#fafaf9] focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all text-neutral-850 font-medium"
                        />
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-1">
                        Enter your registered email and we'll send you a link to reset your password.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={authSubmitting}
                      className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs py-3 rounded-xl transition-colors border border-blue-700 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      {authSubmitting ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span>Sending Reset Link...</span>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <KeyRound className="h-4 w-4" />
                          <span>Send Password Reset Link</span>
                        </div>
                      )}
                    </button>
                  </>
                )}
              </form>
            ) : (
              /* EMAIL & PASSWORD FORM (Sign In / Sign Up) */
              <form onSubmit={handleEmailAuthSubmit} className="space-y-4 text-left">
                {authError && (
                  <div className="p-3 bg-red-50 border border-red-250 rounded-xl space-y-2 text-xs text-red-805 leading-normal">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                      <span>{authError}</span>
                    </div>
                    {authMode === "signin" && (
                      <div className="flex items-center gap-3 pt-1 border-t border-red-200/60 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode("signup");
                            setAuthError(null);
                          }}
                          className="font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                        >
                          Need an account? Create one &rarr;
                        </button>
                        <span className="text-neutral-300">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode("forgot");
                            setAuthError(null);
                          }}
                          className="font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      </div>
                    )}
                    {authMode === "signup" && (
                      <div className="pt-1 border-t border-red-200/60 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode("signin");
                            setAuthError(null);
                          }}
                          className="font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                        >
                          Already have an account? Sign In &rarr;
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@restaurant.com"
                      className="w-full text-xs border border-neutral-200 rounded-xl pl-10 pr-3 py-2.5 bg-[#fafaf9] focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all text-neutral-850 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Password
                    </label>
                    {authMode === "signin" && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("forgot");
                          setAuthError(null);
                          setResetSuccess(null);
                        }}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={authMode === "signin" ? "••••••••" : "Choose a secure password"}
                      className="w-full text-xs border border-neutral-200 rounded-xl pl-10 pr-10 py-2.5 bg-[#fafaf9] focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all text-neutral-850 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs py-3 rounded-xl transition-colors border border-neutral-900 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  {authSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>{authMode === "signin" ? "Signing In..." : "Creating Account..."}</span>
                    </>
                  ) : (
                    <span>{authMode === "signin" ? "Sign In with Email" : "Create Account"}</span>
                  )}
                </button>
              </form>
            )}

            {/* SEPARATOR OR CONTINUATION */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-neutral-200"></div>
              <span className="flex-shrink mx-3 text-neutral-450 text-[10px] uppercase font-bold tracking-wider">or</span>
              <div className="flex-grow border-t border-neutral-200"></div>
            </div>

            {/* GOOGLE SIGN IN BUTTON */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={googleSigningIn || authSubmitting}
              className="w-full bg-white hover:bg-neutral-50 text-neutral-800 font-bold text-xs py-3 rounded-xl transition-colors border border-neutral-200 flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
              id="onboarding-login-btn"
            >
              {googleSigningIn ? (
                <>
                  <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>Sign In with Google</span>
                </>
              )}
            </button>

            {/* DEVELOPER FIREBASE AUTH PROVIDER WARNING & HELP BOX */}
            <div className="text-left bg-emerald-50/50 border border-emerald-250 p-4 rounded-xl text-[11px] text-emerald-850 font-sans space-y-1.5 leading-relaxed">
              <div className="flex gap-2 items-center text-emerald-950 font-bold">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-[10px] uppercase tracking-wider">Authentication Guard</span>
              </div>
              <p>
                Your account is bound securely to your project workspace. If you face errors signing up or signing in via normal email, make sure the <strong>Email/Password</strong> provider is turned on in your Firebase Auth Console.
              </p>
            </div>
          </div>
        </main>
      ) : loadingAuth ? (
        <main className="flex-1 flex flex-col items-center justify-center py-24 space-y-3" id="app-initial-loader">
          <LoaderSpinner />
          <p className="text-[10px] text-neutral-900/65 font-mono ">Validating workspace tokens...</p>
        </main>
      ) : (
        /* Logged In Dashboard Core - FULL-SCREEN LEFT SIDEBAR SYSTEM */
        <div className="flex-1 flex flex-col md:flex-row min-h-screen relative" id="workspace-sidebar-layout">
          
          {/* MOBILE NAVIGATION HEADER */}
          <header className="md:hidden bg-white border-b border-neutral-200 px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-sm" id="mobile-workspace-header">
            <div className="flex items-center space-x-2">
              <div className="bg-blue-700 text-white p-1.5 rounded-xl flex items-center justify-center border border-neutral-200">
                <Building2 className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-neutral-900 font-sans">
                SMA Management System
              </span>
            </div>
            
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1 px-1.5 border border-neutral-200 hover:bg-neutral-50 transition-colors flex items-center justify-center cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </header>

          {/* MOBILE DRAWER OVERLAY */}
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-40 md:hidden flex" id="mobile-sidebar-drawer">
              {/* Backdrop */}
              <div 
                className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs transition-opacity" 
                onClick={() => setMobileMenuOpen(false)}
              />
              
              {/* Menu Card */}
              <div className="relative flex-1 flex flex-col max-w-[280px] w-full bg-white border-r border-neutral-200 p-5 h-full z-50">
                <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
                  <div className="flex items-center space-x-2">
                    <div className="bg-blue-700 text-white p-1.5 rounded-xl flex items-center justify-center border border-neutral-200">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-neutral-900 font-sans">SMA Management System</span>
                  </div>
                  <button 
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1 border border-neutral-300 rounded-xl hover:bg-neutral-50"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 space-y-2.5 py-6 overflow-y-auto">
                  <button
                    onClick={() => {
                      setActiveSection("dashboard");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between ${
                      activeSection === "dashboard"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Dashboard</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSection("inventory");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between ${
                      activeSection === "inventory" || activeSection === "ai-parser"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <span>Inventory</span>
                    </div>
                    <span className="text-[9px] font-mono opacity-80 font-bold bg-[#f3f4f6] text-neutral-900 px-1.5 py-0.5 rounded-xl">
                      {ingredients.length} list
                    </span>
                  </button>
                  
                  <div className="pl-6 flex flex-col gap-1 my-1">
                    <button
                      onClick={() => { setActiveSection("ai-parser"); setMobileMenuOpen(false); }}
                      className={`w-full text-left text-[11px] py-2 px-3 rounded-xl ${
                        activeSection === "ai-parser" ? "bg-emerald-100 text-emerald-800 font-bold" : "text-neutral-600 font-medium"
                      }`}
                    >
                      AI Document Parser
                    </button>
                  </div>

                  {userRole !== "staff" && (
                  <>
                  <button
                    onClick={() => {
                      setActiveSection("intel");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between ${
                      activeSection === "intel" || ["catalog", "recipes", "grocery"].includes(activeSection)
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-4 w-4" />
                      <span>Food Cost Overview</span>
                    </div>
                  </button>

                  <div className="pl-6 flex flex-col gap-1 my-1">
                    <button
                      onClick={() => { setActiveSection("catalog"); setMobileMenuOpen(false); }}
                      className={`w-full text-left text-[11px] py-2 px-3 rounded-xl ${
                        activeSection === "catalog" ? "bg-emerald-100 text-emerald-800 font-bold" : "text-neutral-600 font-medium"
                      }`}
                    >
                      Ingredient Prices
                    </button>
                    <button
                      onClick={() => { setActiveSection("recipes"); setMobileMenuOpen(false); }}
                      className={`w-full text-left text-[11px] py-2 px-3 rounded-xl ${
                        activeSection === "recipes" ? "bg-emerald-100 text-emerald-800 font-bold" : "text-neutral-600 font-medium"
                      }`}
                    >
                      Cost Sheets
                    </button>
                    <button
                      onClick={() => { setActiveSection("grocery"); setMobileMenuOpen(false); }}
                      className={`w-full text-left text-[11px] py-2 px-3 rounded-xl ${
                        activeSection === "grocery" ? "bg-emerald-100 text-emerald-800 font-bold" : "text-neutral-600 font-medium"
                      }`}
                    >
                      Grocery
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setActiveSection("sales-data");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between ${
                      activeSection === "sales-data"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>Sales Data</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSection("timesheet");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between ${
                      activeSection === "timesheet"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>Timesheet</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSection("staff");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between ${
                      activeSection === "staff"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>Staff</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSection("vendors");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between ${
                      activeSection === "vendors"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span>Suppliers</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSection("invoices");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between ${
                      activeSection === "invoices"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span>Invoices</span>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setActiveSection("make-order-list");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between ${
                      activeSection === "make-order-list"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2 ml-4">
                      <Plus className="h-4 w-4" />
                      <span>Make Order List</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSection("order-templates");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between ${
                      activeSection === "order-templates"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2 ml-4">
                      <FileText className="h-4 w-4" />
                      <span>Order Templates</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSection("departments");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between ${
                      activeSection === "departments"
                        ? "bg-emerald-600 text-white border border-neutral-200"
                        : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Departments</span>
                    </div>
                  </button>
                  </>
                  )}

                  {userRole !== "staff" && (
                    <>
                      <button
                        onClick={() => {
                          setActiveSection("collaborators");
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between cursor-pointer ${
                          activeSection === "collaborators"
                            ? "bg-blue-700 text-white border border-neutral-200"
                            : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span>Collaborators & Workspaces</span>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setActiveSection("system-architecture");
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full text-left py-2.5 px-3 text-xs font-bold transition-all rounded-xl flex items-center justify-between cursor-pointer ${
                          activeSection === "system-architecture"
                            ? "bg-indigo-700 text-white border border-neutral-200"
                            : "text-neutral-900/75 hover:bg-neutral-50 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-indigo-400" />
                          <span>System Architecture</span>
                        </div>
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded">Blueprint</span>
                      </button>
                    </>
                  )}
</nav>

                {/* Profile Widget on Drawer bottom */}
                <div className="pt-4 border-t border-neutral-200/20 space-y-3">
                  <div className="flex items-center space-x-2.5 bg-neutral-50 p-2 border border-neutral-200">
                    {user?.photoURL ? (
                      <img
                        src={user.photoURL}
                        referrerPolicy="no-referrer"
                        alt={user.displayName || "User"}
                        className="w-7 h-7 border border-neutral-200"
                      />
                    ) : (
                      <div className="w-7 h-7 bg-emerald-600 text-white flex items-center justify-center text-xs font-mono font-bold">
                        {user?.displayName?.charAt(0) || "U"}
                      </div>
                    )}
                    <div className="text-left font-sans flex-1 overflow-hidden">
                      <div className="text-[10px] font-bold text-neutral-900 truncate">{user?.displayName}</div>
                      <div className="text-[8px] text-neutral-900/60 font-mono truncate">{user?.email}</div>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleSignOut}
                    className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-850 hover:text-rose-900 text-[10px] font-bold border border-rose-300 transition-colors flex items-center justify-center gap-2 rounded-xl cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Access Out</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DESKTOP LEFT SIDEBAR */}
          <aside className={`hidden md:flex flex-col justify-between shrink-0 h-screen sticky top-0 transition-all duration-300 ${sidebarCollapsed ? "w-16" : "w-64"} bg-[#fafaf9] border-r border-neutral-200/60`} id="desktop-app-sidebar">
            <div className={`p-4 flex-1 flex flex-col overflow-y-auto ${sidebarCollapsed ? "items-center" : ""}`}>
                
              {/* Brand Logo & Tag */}
              <div className={`flex items-center justify-between pb-4 mb-2 ${sidebarCollapsed ? "justify-center w-full" : "w-full"}`}>
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-700 text-white p-2 rounded-xl shrink-0 flex items-center justify-center shadow-xs">
                    <Building2 className="h-5 w-5" />
                  </div>
                  {!sidebarCollapsed && (
                    <div>
                      <h1 className="text-[14px] font-bold text-neutral-900 leading-tight">
                        SMA Management
                      </h1>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider font-mono">supplypilot.space</span>
                      </div>
                    </div>
                  )}
                </div>
                {!sidebarCollapsed && (
                  <button onClick={toggleSidebar} className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors shrink-0 border border-neutral-200/50 cursor-pointer">
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Sidebar Active Workspace indicator */}
              {!sidebarCollapsed && user && (
                <div className="mb-4 bg-white border border-neutral-200/80 p-2.5 rounded-xl text-left shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-neutral-400 uppercase font-mono tracking-wider">
                      Active Store
                    </span>
                    <span className={`text-[8px] font-bold px-1 py-0.2 rounded font-mono ${
                      userRole === "admin" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                    }`}>
                      {userRole}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-neutral-900 truncate mt-0.5">
                    {workspaceOwnerId === user.uid ? "My Primary Workspace" : (workspaceOwnerEmail || "Shared Workspace")}
                  </div>
                </div>
              )}

              {sidebarCollapsed && (
                <div className="flex justify-center w-full mt-2 mb-6">
                  <button onClick={toggleSidebar} className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors border border-neutral-200/50">
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Navigation Items */}
              <nav className="space-y-1 text-left flex-1 w-full" id="sidebar-vertical-nav">
                  
                {userRole !== "staff" && (
                <button
                  onClick={() => setActiveSection("dashboard")}
                  className={`w-full h-10 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[13px] font-medium transition-all rounded-lg flex items-center cursor-pointer ${
                    activeSection === "dashboard"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    <Home className={`h-4 w-4 shrink-0 ${activeSection === "dashboard" ? "text-emerald-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Dashboard</span>}
                  </div>
                </button>
                )}



                {userRole !== "staff" && (
                <>
                {/* Documents section - sets activeSection to "intel" which has the tabs */}
                <button
                  onClick={() => setActiveSection("intel")}
                  className={`w-full h-12 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[14px] font-medium transition-all rounded-lg flex items-center cursor-pointer ${
                    activeSection === "intel" || ["catalog", "recipes", "grocery"].includes(activeSection)
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    {(activeSection === "intel" || ["catalog", "recipes", "grocery"].includes(activeSection)) && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
                    <FileText className={`h-4 w-4 shrink-0 ${(activeSection === "intel" || ["catalog", "recipes", "grocery"].includes(activeSection)) ? "text-emerald-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Food Cost</span>}
                  </div>
                </button>
                
                {/* Nested items under Documents (only visible if not collapsed) */}
                {!sidebarCollapsed && (
                  <div className="pl-9 pr-3 py-1 flex flex-col gap-1">
                    <button
                      onClick={() => setActiveSection("catalog")}
                      className={`w-full text-left text-[13px] py-1.5 transition-colors ${
                        activeSection === "catalog" ? "text-emerald-700 font-medium" : "text-neutral-500 hover:text-neutral-900"
                      }`}
                    >
                      Ingredient Prices
                    </button>
                    <button
                      onClick={() => setActiveSection("recipes")}
                      className={`w-full text-left text-[13px] py-1.5 transition-colors ${
                        activeSection === "recipes" ? "text-emerald-700 font-medium" : "text-neutral-500 hover:text-neutral-900"
                      }`}
                    >
                      Cost Sheets
                    </button>
                    <button
                      onClick={() => setActiveSection("grocery")}
                      className={`w-full text-left text-[13px] py-1.5 transition-colors ${
                        activeSection === "grocery" ? "text-emerald-700 font-medium" : "text-neutral-500 hover:text-neutral-900"
                      }`}
                    >
                      Grocery
                    </button>
                  </div>
                )}
                </>
                )}

                {userRole !== "staff" && (
                <button
                  onClick={() => setActiveSection("sales-data")}
                  className={`w-full h-12 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[14px] font-medium transition-all rounded-lg flex items-center cursor-pointer ${
                    activeSection === "sales-data"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    {activeSection === "sales-data" && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
                    <FileSpreadsheet className={`h-4 w-4 shrink-0 ${activeSection === "sales-data" ? "text-emerald-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Sales Data</span>}
                  </div>
                </button>
                )}

                {userRole !== "staff" && (
                <button
                  onClick={() => setActiveSection("staff")}
                  className={`w-full h-12 mt-4 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[14px] font-medium transition-all rounded-lg flex items-center justify-between cursor-pointer ${
                    activeSection === "staff"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    {activeSection === "staff" && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
                    <Briefcase className={`h-4 w-4 shrink-0 ${activeSection === "staff" ? "text-emerald-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Staff</span>}
                  </div>
                </button>
                )}


                {userRole !== "staff" && (
                <button
                  onClick={() => setActiveSection("collaborators")}
                  className={`w-full h-12 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[14px] font-medium transition-all rounded-lg flex items-center justify-between cursor-pointer ${
                    activeSection === "collaborators"
                      ? "bg-blue-50 text-blue-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    {activeSection === "collaborators" && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r-full" />}
                    <Users className={`h-4 w-4 shrink-0 ${activeSection === "collaborators" ? "text-blue-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Collaborators & Stores</span>}
                  </div>
                </button>
                )}

                <button
                  onClick={() => setActiveSection("inventory")}
                  className={`w-full h-10 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[13px] font-medium transition-all rounded-lg flex items-center justify-between cursor-pointer ${
                    activeSection === "inventory" || activeSection === "ai-parser"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    <Package className={`h-4 w-4 shrink-0 ${activeSection === "inventory" || activeSection === "ai-parser" ? "text-emerald-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Inventory</span>}
                  </div>
                  {!sidebarCollapsed && (
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">{ingredients.filter(i => i.inStock !== undefined).length} / {ingredients.length}</span>
                  )}
                </button>
                
                {!sidebarCollapsed && (
                  <div className="pl-9 pr-3 py-1 flex flex-col gap-1">
                    <button
                      onClick={() => setActiveSection("ai-parser")}
                      className={`w-full text-left text-[13px] py-1.5 transition-colors ${
                        activeSection === "ai-parser" ? "text-emerald-700 font-medium" : "text-neutral-500 hover:text-neutral-900"
                      }`}
                    >
                      AI Document Parser
                    </button>
                  </div>
                )}
                
                {userRole !== "staff" && (
                <button
                  onClick={() => setActiveSection("vendors")}
                  className={`w-full h-10 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[13px] font-medium transition-all rounded-lg flex items-center justify-between cursor-pointer ${
                    activeSection === "vendors"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    {activeSection === "vendors" && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
                    <Building2 className={`h-4 w-4 shrink-0 ${activeSection === "vendors" ? "text-emerald-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Suppliers</span>}
                  </div>
                  {!sidebarCollapsed && (
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">{uniqueVendorsCount}</span>
                  )}
                </button>
                )}

                <button
                  onClick={() => setActiveSection("invoices")}
                  className={`w-full h-10 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[13px] font-medium transition-all rounded-lg flex items-center justify-between cursor-pointer ${
                    activeSection === "invoices"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    {activeSection === "invoices" && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
                    <FileText className={`h-4 w-4 shrink-0 ${activeSection === "invoices" ? "text-emerald-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Invoices</span>}
                  </div>
                </button>
                <button
                  onClick={() => setActiveSection("make-order-list")}
                  className={`w-full h-10 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[13px] font-medium transition-all rounded-lg flex items-center justify-between cursor-pointer pl-6 ${
                    activeSection === "make-order-list"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    {activeSection === "make-order-list" && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
                    <Plus className={`h-4 w-4 shrink-0 ${activeSection === "make-order-list" ? "text-emerald-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Make Order List</span>}
                  </div>
                </button>

                <button
                  onClick={() => setActiveSection("order-templates")}
                  className={`w-full h-10 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[13px] font-medium transition-all rounded-lg flex items-center justify-between cursor-pointer pl-6 ${
                    activeSection === "order-templates"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    {activeSection === "order-templates" && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
                    <FileText className={`h-4 w-4 shrink-0 ${activeSection === "order-templates" ? "text-emerald-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Order Templates</span>}
                  </div>
                </button>


                <button
                  onClick={() => setActiveSection("reports")}
                  className={`w-full h-10 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[13px] font-medium transition-all rounded-lg flex items-center justify-between cursor-pointer ${
                    activeSection === "reports"
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-3 relative">
                    {activeSection === "reports" && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full" />}
                    <BarChart3 className={`h-4 w-4 shrink-0 ${activeSection === "reports" ? "text-emerald-600" : "text-neutral-500"}`} />
                    {!sidebarCollapsed && <span>Report Center</span>}
                  </div>
                </button>

                {userRole !== "staff" && (
                  <>
                    <button
                      onClick={() => setActiveSection("departments")}
                      className={`w-full h-10 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[13px] font-medium transition-all rounded-lg flex items-center justify-between cursor-pointer ${
                        activeSection === "departments"
                          ? "bg-emerald-50 text-emerald-800"
                          : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                      }`}
                    >
                      <div className="flex items-center gap-3 relative">
                        <LayoutDashboard className={`h-4 w-4 shrink-0 ${activeSection === "departments" ? "text-emerald-600" : "text-neutral-500"}`} />
                        {!sidebarCollapsed && <span>Departments</span>}
                      </div>
                      {!sidebarCollapsed && (
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">{resolvedDepts.length}</span>
                      )}
                    </button>

                    <button
                      onClick={() => setActiveSection("system-architecture")}
                      className={`w-full h-10 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-start"} text-[13px] font-medium transition-all rounded-lg flex items-center justify-between cursor-pointer ${
                        activeSection === "system-architecture"
                          ? "bg-indigo-50 text-indigo-900 font-semibold"
                          : "text-neutral-600 hover:bg-neutral-100/50 hover:text-neutral-900"
                      }`}
                      title="System Architecture Blueprint"
                    >
                      <div className="flex items-center gap-3 relative">
                        {activeSection === "system-architecture" && !sidebarCollapsed && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-600 rounded-r-full" />}
                        <Database className={`h-4 w-4 shrink-0 ${activeSection === "system-architecture" ? "text-indigo-600" : "text-neutral-500"}`} />
                        {!sidebarCollapsed && <span>System Architecture</span>}
                      </div>
                      {!sidebarCollapsed && (
                        <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">Blueprint</span>
                      )}
                    </button>
                  </>
                )}
              </nav>
            </div>
            
            <div className="p-4 border-t border-neutral-200">
              {sidebarCollapsed ? (
                <button 
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 font-bold bg-[#f3f4f6] px-3 py-2 rounded-lg">
                  <span className="truncate max-w-[120px]">{user?.email}</span>
                  <button onClick={handleSignOut} className="hover:text-red-600 p-1 rounded-md hover:bg-neutral-200" title="Sign Out">
                    <LogOut className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </aside>

          {/* MAIN CONTENT */}
          <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden bg-[#f0efeb] relative">
            <InvitationAlert
              pendingInvitations={pendingIncomingShares}
              onAccept={handleAcceptInvitation}
              onDecline={handleDeclineInvitation}
            />
            <MainHeader 
              user={user}
              loadingAuth={loadingAuth}
              workspaceOwnerId={workspaceOwnerId}
              workspaceOwnerEmail={workspaceOwnerEmail}
              incomingShares={incomingShares}
              pendingInvitations={pendingIncomingShares}
              onSwitchWorkspace={handleSwitchWorkspace}
              onAcceptInvitation={handleAcceptInvitation}
              onDeclineInvitation={handleDeclineInvitation}
              userRole={userRole}
            />
            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-8 relative">

              {/* Top Navigation / Dashboard Tabs */}
              {["catalog", "recipes", "intel", "grocery"].includes(activeSection) && (
                <div className="space-y-6">
                  {/* Real-time Business KPI Banner */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-6" id="business-kpi-banner">
                    <div className="bg-emerald-50/30 border border-emerald-100 rounded-2xl p-6 shadow-sm relative overflow-hidden flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Items Tracked</p>
                        <p className="text-3xl font-bold text-neutral-900 font-sans tracking-tight">{ingredients.length}</p>
                      </div>
                      <div className="bg-emerald-100 p-3 rounded-2xl">
                        <Package className="h-6 w-6 text-emerald-600" />
                      </div>
                    </div>
                    <div className="bg-amber-50/30 border border-amber-100 rounded-2xl p-6 shadow-sm relative overflow-hidden flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Active Recipes</p>
                        <p className="text-3xl font-bold text-neutral-900 font-sans tracking-tight">{recipes.length}</p>
                      </div>
                      <div className="bg-amber-100 p-3 rounded-2xl">
                        <ChefHat className="h-6 w-6 text-amber-600" />
                      </div>
                    </div>
                    <div className="bg-blue-50/30 border border-blue-100 rounded-2xl p-6 shadow-sm relative overflow-hidden flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Target Margin</p>
                        <p className="text-3xl font-bold text-neutral-900 font-sans tracking-tight">70<span className="text-xl">%</span></p>
                      </div>
                      <div className="bg-blue-100 p-3 rounded-2xl">
                        <TrendingUp className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                    <div className="bg-purple-50/30 border border-purple-100 rounded-2xl p-6 shadow-sm relative overflow-hidden flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Low Stock Alerts</p>
                        <p className="text-3xl font-bold text-neutral-900 font-sans tracking-tight">{ingredients.filter(i => (i.quantity || 0) < (i.parLevel || 5)).length}</p>
                      </div>
                      <div className="bg-purple-100 p-3 rounded-2xl">
                        <AlertCircle className="h-6 w-6 text-purple-600" />
                      </div>
                    </div>
                  </div>

                  {/* Navigation Tabs */}
                  <div className="flex items-center gap-8 border-b border-neutral-200 px-4">
                    <button
                      onClick={() => setActiveSection("catalog")}
                      className={`pb-4 text-sm font-semibold transition-colors flex items-center gap-2 ${
                        activeSection === "catalog"
                          ? "text-emerald-700 border-b-2 border-emerald-600"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4" /> Master Ingredient Prices
                    </button>
                    <button
                      onClick={() => setActiveSection("recipes")}
                      className={`pb-4 text-sm font-semibold transition-colors flex items-center gap-2 ${
                        activeSection === "recipes"
                          ? "text-emerald-700 border-b-2 border-emerald-600"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                    >
                      <ChefHat className="w-4 h-4" /> Culinary Cost Sheets
                    </button>
                    <button
                      onClick={() => setActiveSection("intel")}
                      className={`pb-4 text-sm font-semibold transition-colors flex items-center gap-2 ${
                        activeSection === "intel"
                          ? "text-emerald-700 border-b-2 border-emerald-600"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                    >
                      <TrendingUp className="w-4 h-4" /> Food Cost Intel
                    </button>
                    <button
                      onClick={() => setActiveSection("grocery")}
                      className={`pb-4 text-sm font-semibold transition-colors flex items-center gap-2 ${
                        activeSection === "grocery"
                          ? "text-emerald-700 border-b-2 border-emerald-600"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                      id="foodcost-tab-grocery"
                    >
                      <ShoppingCart className="w-4 h-4" /> Grocery
                    </button>
                  </div>

                  {/* Content for the selected tab */}
                  {activeSection === "catalog" && <IngredientsView 
                      ingredients={ingredients}
                      vendors={vendors}
                      invoices={invoices}
                      groceryPurchases={groceryPurchases}
                      onAddIngredient={handleAddIngredient}
                      onEditIngredient={handleEditIngredient}
                      onDeleteIngredient={handleDeleteIngredient}
                      onMatchAndMergeIngredients={handleMatchAndMergeIngredients}
                      isReadOnly={isReadOnly}
                    />}
                  {activeSection === "recipes" && <RecipesView 
                      recipes={recipes}
                      ingredients={ingredients}
                      onAddRecipe={handleAddRecipe}
                      onEditRecipe={handleEditRecipe}
                      onDeleteRecipe={handleDeleteRecipe}
                      onReorderRecipes={handleReorderRecipes}
                      customDepts={resolvedDepts}
                      onAddDept={handleAddDept}
                      onDeleteDept={handleDeleteDept}
                      isReadOnly={isReadOnly}
                    />}
                  {activeSection === "intel" && (
                    <FoodCostIntelView
                      recipes={recipes}
                      dailySales={dailySales}
                      onAddDailySale={handleAddDailySale}
                      onDeleteDailySale={handleDeleteDailySale}
                      isReadOnly={isReadOnly}
                    />
                  )}
                  {activeSection === "grocery" && (
                    <GroceryView
                      ingredients={ingredients}
                      vendors={vendors}
                      groceryPurchases={groceryPurchases}
                      shoppingList={groceryShoppingList}
                      onAddGroceryPurchase={handleAddGroceryPurchase}
                      onUpdateGroceryPurchase={handleUpdateGroceryPurchase}
                      onDeleteGroceryPurchase={handleDeleteGroceryPurchase}
                      onAddShoppingItem={handleAddShoppingItem}
                      onToggleShoppingItem={handleToggleShoppingItem}
                      onDeleteShoppingItem={handleDeleteShoppingItem}
                      onClearCheckedShoppingItems={handleClearCheckedShoppingItems}
                      onSyncIngredientPrice={handleSyncIngredientPriceFromGrocery}
                      isReadOnly={isReadOnly}
                    />
                  )}
                </div>
              )}

              {activeSection === "ai-parser" && <AIParserView 
                  existingIngredients={ingredients}
                  existingInvoices={invoices}
                  vendors={vendors}
                  recipes={recipes}
                  onApplyParsedItems={handleApplyParsedItems}
                  userId={user.uid}
                  isReadOnly={isReadOnly}
                  queue={parserQueue}
                  setQueue={setParserQueue}
                  activeQueueId={parserActiveQueueId}
                  setActiveQueueId={setParserActiveQueueId}
                  parsingAll={parserParsingAll}
                  setParsingAll={setParserParsingAll}
                />}

              {activeSection === "sales-data" && (
                <SalesDataView
                  recipes={recipes}
                  dailySales={dailySales}
                  salesUploads={salesUploads}
                  onAddDailySale={handleAddDailySale}
                  onDeleteDailySale={handleDeleteDailySale}
                  onUpdateDailySale={handleUpdateDailySale}
                  onAddSalesUpload={handleAddSalesUpload}
                  onDeleteSalesUpload={handleDeleteSalesUpload}
                  userRole={userRole}
                  currentUserEmail={user?.email || "Manager"}
                />
              )}

              {activeSection === "dashboard" && (
                <DashboardView
                  recipes={recipes}
                  dailySales={dailySales}
                  ingredients={ingredients}
                  invoices={invoices}
                  userRole={userRole}
                  onSwitchSection={setActiveSection}
                />
              )}

              {activeSection === "timesheet" && (
                <TimesheetView
                  userId={user?.uid}
                  timecards={timecards}
                  employees={employees}
                  onAddTimecard={handleAddTimecard}
                  onAddEmployee={handleAddEmployee}
                  onBulkDeleteTimecards={handleBulkDeleteTimecards}
                  isReadOnly={isReadOnly}
                />
              )}
              {activeSection === "staff" && (
                <StaffRegistryView
                  employees={employees}
                  onAddEmployee={handleAddEmployee}
                  onEditEmployee={handleEditEmployee}
                  onDeleteEmployee={handleDeleteEmployee}
                  isReadOnly={isReadOnly}
                />
              )}
              {activeSection === "inventory" && (
                <InventoryView
                  ingredients={ingredients}
                  recipes={recipes}
                  onAddIngredient={handleAddIngredient}
                  onEditIngredient={handleEditIngredient}
                  onDeleteIngredient={handleDeleteIngredient}
                  vendors={vendors}
                  departments={customDepartments}
                  isReadOnly={isReadOnly}
                  user={user}
                  workspaceOwnerId={workspaceOwnerId}
                  employees={employees}
                />
              )}
              {activeSection === "vendors" && (
                <VendorsView
                  vendors={vendors}
                  ingredients={ingredients}
                  onAddVendor={handleAddVendor}
                  onEditVendor={handleEditVendor}
                  onDeleteVendor={handleDeleteVendor}
                  onSeedVendors={handleSeedVendors}
                  isReadOnly={isReadOnly}
                />
              )}
              {activeSection === "invoices" && (
                <InvoiceManagementView
                  invoices={invoices}
                  vendors={vendors}
                  onAddInvoice={handleAddInvoice}
                  onUpdateInvoice={handleUpdateInvoice}
                  onDeleteInvoice={handleDeleteInvoice}
                  isReadOnly={isReadOnly}
                />
              )}
              {activeSection === "make-order-list" && (
                <OrderListView
                  orderLists={orderLists}
                  vendors={vendors}
                  ingredients={ingredients}
                  onAddOrderList={handleAddOrderList}
                  onUpdateOrderList={handleUpdateOrderList}
                  onDeleteOrderList={handleDeleteOrderList}
                  isReadOnly={isReadOnly}
                />
              )}

              {activeSection === "order-templates" && (
                <OrderTemplatesView
                  vendors={vendors}
                  ingredients={ingredients}
                  onEditVendor={handleEditVendor}
                  isReadOnly={isReadOnly}
                />
              )}

              {activeSection === "reports" && (
                <ReportCenterView
                  invoices={invoices}
                  groceryPurchases={groceryPurchases}
                  ingredients={ingredients}
                  recipes={recipes}
                  dailySales={dailySales}
                  onSwitchSection={setActiveSection}
                />
              )}
              {activeSection === "departments" && (
                <DepartmentsView
                  departments={customDepartments}
                  onAddDepartment={handleAddDepartment}
                  onEditDepartment={handleEditDepartment}
                  onDeleteDepartment={handleDeleteDepartment}
                  onSeedDepartments={handleSeedDepartments}
                  isReadOnly={isReadOnly}
                />
              )}
              {activeSection === "collaborators" && (
                <CollaboratorsView
                  user={user}
                  myShares={myShares}
                  incomingShares={incomingShares}
                  onInvite={handleInviteCollaborator}
                  onUpdateRole={handleUpdateCollaboratorRole}
                  onRemoveInvite={handleRemoveCollaborator}
                  onAcceptInvitation={handleAcceptInvitation}
                  onDeclineInvitation={handleDeclineInvitation}
                  onSwitchWorkspace={handleSwitchWorkspace}
                  workspaceOwnerId={user?.uid || ""}
                  workspaceOwnerEmail={user?.email || null}
                  userRole={userRole}
                />
              )}
              {activeSection === "system-architecture" && (
                <SystemArchitectureView />
              )}

            </div>
          </main>

          <AIChatbot 
            invoices={invoices}
            groceryPurchases={groceryPurchases}
            ingredients={ingredients}
            recipes={recipes}
            dailySales={dailySales}
          />
        </div>
      )}
    </div>
  );
}

// Quick micro loading spinner
function LoaderSpinner() {
  return (
    <div className="w-8 h-8 border-2 border-t-[#141414] border-neutral-200/20 rounded-xl animate-spin"></div>
  );
}

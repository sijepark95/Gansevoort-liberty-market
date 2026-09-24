import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc,
  updateDoc, 
  deleteDoc, 
  query,
  writeBatch
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth();
export const storage = getStorage(app);

// Sign-in with Google provider
const googleProvider = new GoogleAuthProvider();
let isGoogleSignInInProgress = false;

export async function signInWithGoogle() {
  if (isGoogleSignInInProgress) {
    return null;
  }
  isGoogleSignInInProgress = true;
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result;
  } catch (error: any) {
    const code = error?.code || "";
    // User intentionally closed the popup or rapid-click superseded a prior popup request
    if (
      code === "auth/popup-closed-by-user" ||
      code === "auth/cancelled-popup-request" ||
      code === "auth/user-cancelled"
    ) {
      return null;
    }
    console.warn("Google sign in issue: ", code || error?.message);
    throw error;
  } finally {
    isGoogleSignInInProgress = false;
  }
}

// Sign-in with Email
export async function signInWithEmail(email: string, password: string) {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (error: any) {
    console.warn("Email sign in issue: ", error?.code || error?.message);
    throw error;
  }
}

// Sign-up with Email
export async function signUpWithEmail(email: string, password: string) {
  try {
    return await createUserWithEmailAndPassword(auth, email, password);
  } catch (error: any) {
    console.warn("Email sign up issue: ", error?.code || error?.message);
    throw error;
  }
}

// Send Password Reset Email
export async function sendPasswordReset(email: string) {
  try {
    return await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    console.warn("Password reset issue: ", error?.code || error?.message);
    throw error;
  }
}

// Sign-out
export async function handleSignOut() {
  await signOut(auth);
}

// Error Handling block as forced by firebase-integration skill
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error("Firestore Error Audit JSON: ", JSON.stringify(errInfo));

  // Throw structured JSON error for permission failures or critical write errors,
  // while allowing transient offline/connection errors to be logged without crashing UI listeners
  if (
    errMessage.includes("permission-denied") ||
    errMessage.includes("Missing or insufficient permissions") ||
    errMessage.includes("PERMISSION_DENIED") ||
    operationType === OperationType.CREATE ||
    operationType === OperationType.UPDATE ||
    operationType === OperationType.DELETE ||
    operationType === OperationType.WRITE
  ) {
    throw new Error(JSON.stringify(errInfo));
  }
}

// Safe CRUD abstractions matching error requirements
export async function safeGetDocs(collectionName: string, queryConstraints: any[] = []) {
  try {
    const colRef = collection(db, collectionName);
    const q = queryConstraints.length > 0 ? query(colRef, ...queryConstraints) : colRef;
    return await getDocs(q);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, collectionName);
    throw err;
  }
}

export async function safeGetDoc(collectionName: string, docId: string) {
  try {
    const docRef = doc(db, collectionName, docId);
    return await getDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `${collectionName}/${docId}`);
    throw err;
  }
}

// Helper to recursively remove undefined properties before they are submitted to Firestore
export function removeUndefinedFields(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedFields(item));
  }
  const cleaned: any = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      cleaned[key] = removeUndefinedFields(obj[key]);
    }
  }
  return cleaned;
}

export async function safeSetDoc(collectionName: string, docId: string, data: any) {
  try {
    const docRef = doc(db, collectionName, docId);
    return await setDoc(docRef, removeUndefinedFields(data));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${docId}`);
    throw err;
  }
}

export async function safeAddDoc(collectionName: string, data: any) {
  try {
    const colRef = collection(db, collectionName);
    return await addDoc(colRef, removeUndefinedFields(data));
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, collectionName);
    throw err;
  }
}

export async function safeUpdateDoc(collectionName: string, docId: string, data: any) {
  try {
    const docRef = doc(db, collectionName, docId);
    return await updateDoc(docRef, removeUndefinedFields(data));
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${docId}`);
    throw err;
  }
}

export async function safeDeleteDoc(collectionName: string, docId: string) {
  try {
    const docRef = doc(db, collectionName, docId);
    return await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${docId}`);
    throw err;
  }
}

export async function safeBulkDeleteDocs(collectionName: string, docIds: string[]) {
  try {
    const batch = writeBatch(db);
    docIds.forEach((docId) => {
      const docRef = doc(db, collectionName, docId);
      batch.delete(docRef);
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${collectionName} [bulk count: ${docIds.length}]`);
    throw err;
  }
}

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Plus, Search, FileText, Check, Clock, AlertCircle, Edit2, Trash2, X, Download, DollarSign, Calendar, Paperclip, Eye, Image as ImageIcon, Upload, FileUp } from "lucide-react";
import { Invoice, Vendor, ParsedInvoiceItem } from "../types";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import { processInvoiceFile, formatFileSize, isImageFile, downloadFile } from "../lib/fileHelper";

interface InvoiceManagementViewProps {
  invoices: Invoice[];
  vendors: Vendor[];
  onAddInvoice: (invoice: Omit<Invoice, "id" | "createdAt" | "ownerId">) => Promise<void>;
  onUpdateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>;
  onDeleteInvoice: (id: string) => Promise<void>;
  isReadOnly: boolean;
}

export const InvoiceManagementView: React.FC<InvoiceManagementViewProps> = ({
  invoices,
  vendors,
  onAddInvoice,
  onUpdateInvoice,
  onDeleteInvoice,
  isReadOnly
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [vendorFilter, setVendorFilter] = useState<string>("ALL");
  const [sortOrder, setSortOrder] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">("date_desc");

  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  // Delete invoice confirmation state (replaces non-working window.confirm in iframe)
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Document preview state
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    invoiceNumber: string;
    vendor: string;
    issueDate: string;
    dueDate: string;
    totalAmount: string;
    status: Invoice["status"];
    notes: string;
    items: ParsedInvoiceItem[];
  }>({
    invoiceNumber: "",
    vendor: "",
    issueDate: "",
    dueDate: "",
    totalAmount: "",
    status: "unpaid",
    notes: "",
    items: []
  });

  const [attachedFile, setAttachedFile] = useState<{
    fileUrl?: string;
    fileType?: string;
    fileSize?: number;
    fileName?: string;
  } | null>(null);

  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (statusFilter !== "ALL") {
        if (statusFilter === "paid") {
          if (inv.status !== "paid" && inv.status !== "applied") return false;
        } else if (inv.status !== statusFilter) {
          return false;
        }
      }
      if (vendorFilter !== "ALL" && inv.vendor !== vendorFilter) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const vendorMatch = inv.vendor?.toLowerCase().includes(q);
        const invNumMatch = inv.invoiceNumber?.toLowerCase().includes(q);
        const fileMatch = inv.fileName?.toLowerCase().includes(q);
        return vendorMatch || invNumMatch || fileMatch;
      }
      return true;
    }).sort((a, b) => {
      switch (sortOrder) {
        case "date_asc":
          return new Date(a.issueDate || a.createdAt).getTime() - new Date(b.issueDate || b.createdAt).getTime();
        case "amount_desc":
          return (b.totalAmount || 0) - (a.totalAmount || 0);
        case "amount_asc":
          return (a.totalAmount || 0) - (b.totalAmount || 0);
        case "date_desc":
        default:
          return new Date(b.issueDate || b.createdAt).getTime() - new Date(a.issueDate || a.createdAt).getTime();
      }
    });
  }, [invoices, statusFilter, vendorFilter, searchQuery, sortOrder]);

  const stats = useMemo(() => {
    let totalUnpaid = 0;
    let totalOverdue = 0;
    let totalPaid = 0;
    let totalWithAttachments = 0;
    
    invoices.forEach(inv => {
      const amount = inv.totalAmount || 0;
      if (inv.status === "unpaid") totalUnpaid += amount;
      if (inv.status === "overdue") totalOverdue += amount;
      if (inv.status === "paid" || inv.status === "applied") totalPaid += amount;
      if (inv.fileUrl) totalWithAttachments++;
    });

    return { totalUnpaid, totalOverdue, totalPaid, totalWithAttachments };
  }, [invoices]);

  const handleOpenModal = (inv?: Invoice) => {
    if (inv) {
      setEditingInvoice(inv);
      setFormData({
        invoiceNumber: inv.invoiceNumber || "",
        vendor: inv.vendor || "",
        issueDate: inv.issueDate || "",
        dueDate: inv.dueDate || "",
        totalAmount: inv.totalAmount ? inv.totalAmount.toString() : "",
        status: inv.status,
        notes: inv.notes || "",
        items: inv.items || []
      });
      if (inv.fileUrl) {
        setAttachedFile({
          fileUrl: inv.fileUrl,
          fileType: inv.fileType,
          fileSize: inv.fileSize,
          fileName: inv.fileName || `invoice_${inv.invoiceNumber || "doc"}`
        });
      } else {
        setAttachedFile(null);
      }
    } else {
      setEditingInvoice(null);
      setFormData({
        invoiceNumber: "",
        vendor: "",
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: "",
        totalAmount: "",
        status: "unpaid",
        notes: "",
        items: []
      });
      setAttachedFile(null);
    }
    setShowModal(true);
  };

  const handleModalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsProcessingFile(true);
    try {
      const processed = await processInvoiceFile(file);
      setAttachedFile({
        fileUrl: processed.dataUrl,
        fileType: processed.mimeType,
        fileSize: processed.size,
        fileName: file.name
      });
    } catch (err) {
      console.error("Failed to process invoice file:", err);
      alert("Failed to process file. Please try a different image or PDF.");
    } finally {
      setIsProcessingFile(false);
      if (modalFileInputRef.current) modalFileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    const payload: any = {
      fileName: attachedFile?.fileName || (editingInvoice ? editingInvoice.fileName : "Manual Entry"),
      invoiceNumber: formData.invoiceNumber,
      vendor: formData.vendor,
      issueDate: formData.issueDate,
      dueDate: formData.dueDate,
      totalAmount: parseFloat(formData.totalAmount) || 0,
      status: formData.status,
      notes: formData.notes,
      items: formData.items
    };

    if (attachedFile?.fileUrl) {
      payload.fileUrl = attachedFile.fileUrl;
      payload.fileType = attachedFile.fileType;
      payload.fileSize = attachedFile.fileSize;
    } else if (editingInvoice && !attachedFile) {
      payload.fileUrl = "";
      payload.fileType = "";
      payload.fileSize = 0;
    }

    if (editingInvoice && editingInvoice.id) {
      await onUpdateInvoice(editingInvoice.id, payload);
    } else {
      await onAddInvoice(payload);
    }
    setShowModal(false);
  };

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: "", quantity: 1, unit: "ea", totalPrice: 0, pricePerUnit: 0 }]
    }));
  };

  const handleRemoveItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateItem = (index: number, field: keyof ParsedInvoiceItem, value: any) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      
      if (field === 'quantity' || field === 'pricePerUnit') {
        newItems[index].totalPrice = newItems[index].quantity * (newItems[index].pricePerUnit || 0);
      } else if (field === 'totalPrice') {
        newItems[index].pricePerUnit = newItems[index].quantity > 0 ? newItems[index].totalPrice / newItems[index].quantity : 0;
      }
      
      return { ...prev, items: newItems };
    });
  };

  const getStatusBadge = (status: Invoice["status"]) => {
    switch (status) {
      case "paid":
      case "applied":
        return <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1"><Check className="w-3 h-3"/> Paid</span>;
      case "unpaid":
        return <span className="px-2 py-1 rounded bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1"><Clock className="w-3 h-3"/> Unpaid</span>;
      case "overdue":
        return <span className="px-2 py-1 rounded bg-red-100 text-red-800 text-[10px] font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Overdue</span>;
      case "pending_review":
        return <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">Pending Review</span>;
      default:
        return <span className="px-2 py-1 rounded bg-neutral-100 text-neutral-800 text-[10px] font-bold">{status.toUpperCase()}</span>;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-neutral-900">Invoices & Billing</h2>
          <p className="text-xs sm:text-sm text-neutral-500">Manage vendor invoices, track payments, and access archived original receipts.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-neutral-400 block">Total Unpaid</span>
            <span className="text-lg font-bold text-neutral-900 font-mono">
              ${stats.totalUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-neutral-400 block">Overdue Invoices</span>
            <span className="text-lg font-bold text-red-600 font-mono">
              ${stats.totalOverdue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Check className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-neutral-400 block">Total Paid</span>
            <span className="text-lg font-bold text-emerald-600 font-mono">
              ${stats.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <Paperclip className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-neutral-400 block">Archived Documents</span>
            <span className="text-lg font-bold text-neutral-900 font-mono">
              {stats.totalWithAttachments} <span className="text-xs font-normal text-neutral-400">files saved</span>
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-neutral-200 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by vendor, invoice #, or file name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
            <option value="applied">Applied (AI)</option>
            <option value="pending_review">Pending Review</option>
          </select>
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 max-w-[200px]"
          >
            <option value="ALL">All Vendors</option>
            {vendors.map(v => (
              <option key={v.id} value={v.name}>{v.name}</option>
            ))}
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="amount_desc">Highest Amount</option>
            <option value="amount_asc">Lowest Amount</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500 font-bold border-b border-neutral-200">
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Source Document</th>
                <th className="px-4 py-3">Issue Date</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                {!isReadOnly && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-sm">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={isReadOnly ? 7 : 8} className="px-4 py-8 text-center text-neutral-400">
                    No invoices found.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-neutral-900">{inv.invoiceNumber || "-"}</td>
                    <td className="px-4 py-3 font-bold text-neutral-800">{inv.vendor || "-"}</td>
                    
                    {/* Document / Attachment Cell */}
                    <td className="px-4 py-3">
                      {inv.fileUrl ? (
                        <div className="flex items-center gap-2">
                          {(isImageFile(inv.fileType, inv.fileName) || inv.fileUrl.startsWith('data:image/')) ? (
                            <button
                              type="button"
                              onClick={() => setPreviewInvoice(inv)}
                              className="relative group shrink-0 rounded overflow-hidden border border-neutral-200 shadow-sm"
                              title="Click to view full image"
                            >
                              <img src={inv.fileUrl} alt={inv.fileName || "Invoice"} className="w-10 h-10 object-cover" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Eye className="w-4 h-4 text-white" />
                              </div>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPreviewInvoice(inv)}
                              className="w-10 h-10 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0 hover:bg-emerald-100 transition-colors"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          )}
                          
                          <div className="flex flex-col min-w-0 justify-center">
                            <a
                              href={inv.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-emerald-600 hover:text-emerald-800 hover:underline truncate max-w-[120px] font-mono"
                              title="Open in new tab"
                            >
                              {inv.fileName || "View Document"}
                            </a>
                            <button
                              type="button"
                              onClick={() => downloadFile(inv.fileUrl!, inv.fileName || `Invoice_${inv.invoiceNumber || "doc"}`)}
                              className="text-[10px] text-neutral-400 hover:text-neutral-600 text-left w-fit flex items-center gap-1 mt-0.5"
                            >
                              <Download className="w-3 h-3" /> Download
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400 italic">No document</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-neutral-600 font-mono text-xs">{inv.issueDate || "-"}</td>
                    <td className="px-4 py-3 text-neutral-600 font-mono text-xs">{inv.dueDate || "-"}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-neutral-900">
                      {inv.totalAmount ? `$${inv.totalAmount.toLocaleString(undefined, {minimumFractionDigits:2})}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">{getStatusBadge(inv.status)}</div>
                    </td>
                    {!isReadOnly && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleOpenModal(inv)} className="p-1.5 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => {
                              setDeleteError(null);
                              setInvoiceToDelete(inv);
                            }} 
                            className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" 
                            title="Delete invoice"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Invoice Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-neutral-100 bg-neutral-50/50">
              <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                {editingInvoice ? "Edit Invoice" : "Make Order List"}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Invoice Number</label>
                  <input
                    type="text"
                    required
                    value={formData.invoiceNumber}
                    onChange={(e) => setFormData({...formData, invoiceNumber: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    placeholder="INV-001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Vendor</label>
                  <input
                    type="text"
                    required
                    list="vendor-list"
                    value={formData.vendor}
                    onChange={(e) => setFormData({...formData, vendor: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Select or type..."
                  />
                  <datalist id="vendor-list">
                    {vendors.map(v => <option key={v.id} value={v.name} />)}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Issue Date</label>
                  <input
                    type="date"
                    required
                    value={formData.issueDate}
                    onChange={(e) => setFormData({...formData, issueDate: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Total Amount ($)</label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.totalAmount}
                      onChange={(e) => setFormData({...formData, totalAmount: e.target.value})}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="void">Void</option>
                  </select>
                </div>
              </div>

              {/* Line Items (Order List) */}
              <div className="pt-2 border-t border-neutral-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">
                    Expected Order Items
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded hover:bg-emerald-100 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Item
                  </button>
                </div>
                
                {formData.items.length === 0 ? (
                  <div className="text-center py-6 border-2 border-dashed border-neutral-100 rounded-xl bg-neutral-50">
                    <p className="text-xs text-neutral-400">No items added to this order yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formData.items.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 bg-neutral-50 p-2 rounded-xl border border-neutral-200">
                        <div className="grid grid-cols-12 gap-2 flex-1">
                          <div className="col-span-12 sm:col-span-5">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                              placeholder="Item name"
                              className="w-full px-2 py-1.5 bg-white border border-neutral-200 rounded text-xs focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div className="col-span-4 sm:col-span-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.quantity || ''}
                              onChange={(e) => handleUpdateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                              placeholder="Qty"
                              className="w-full px-2 py-1.5 bg-white border border-neutral-200 rounded text-xs focus:outline-none focus:border-emerald-500 font-mono"
                            />
                          </div>
                          <div className="col-span-4 sm:col-span-2">
                            <input
                              type="text"
                              value={item.unit}
                              onChange={(e) => handleUpdateItem(idx, 'unit', e.target.value)}
                              placeholder="Unit"
                              className="w-full px-2 py-1.5 bg-white border border-neutral-200 rounded text-xs focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div className="col-span-4 sm:col-span-3">
                            <div className="relative">
                              <DollarSign className="w-3 h-3 absolute left-1.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.totalPrice || ''}
                                onChange={(e) => handleUpdateItem(idx, 'totalPrice', parseFloat(e.target.value) || 0)}
                                placeholder="Total"
                                className="w-full pl-5 pr-2 py-1.5 bg-white border border-neutral-200 rounded text-xs focus:outline-none focus:border-emerald-500 font-mono"
                              />
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0"
                          title="Remove item"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Invoice Image or File Attachment Section */}
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                    Invoice Receipt / Document File
                  </span>
                  {attachedFile && (
                    <span className="text-[10px] text-neutral-400 font-normal">
                      {formatFileSize(attachedFile.fileSize)}
                    </span>
                  )}
                </label>

                <input
                  type="file"
                  ref={modalFileInputRef}
                  onChange={handleModalFileSelect}
                  accept="image/*,.pdf,.csv,.txt"
                  className="hidden"
                />

                {attachedFile ? (
                  <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isImageFile(attachedFile.fileType, attachedFile.fileName) && attachedFile.fileUrl ? (
                        <img
                          src={attachedFile.fileUrl}
                          alt="thumbnail"
                          className="w-10 h-10 object-cover rounded-lg border border-neutral-200 bg-white shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-neutral-900 truncate">
                          {attachedFile.fileName || "Invoice Document"}
                        </p>
                        <p className="text-[10px] text-neutral-500 font-mono">
                          {attachedFile.fileType || "application/octet-stream"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {attachedFile.fileUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewInvoice({
                            fileName: attachedFile.fileName || "Invoice Document",
                            fileUrl: attachedFile.fileUrl,
                            fileType: attachedFile.fileType,
                            fileSize: attachedFile.fileSize,
                            invoiceNumber: formData.invoiceNumber,
                            vendor: formData.vendor,
                            items: [],
                            status: formData.status,
                            ownerId: "",
                            createdAt: ""
                          })}
                          className="p-1.5 text-neutral-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Preview document"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => modalFileInputRef.current?.click()}
                        className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200 rounded-lg transition-colors text-xs font-medium"
                        title="Replace file"
                      >
                        <FileUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttachedFile(null)}
                        className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove attachment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => modalFileInputRef.current?.click()}
                    className="border-2 border-dashed border-neutral-200 hover:border-emerald-500 rounded-xl p-4 text-center cursor-pointer transition-colors bg-neutral-50/50 hover:bg-emerald-50/30"
                  >
                    <Upload className="w-6 h-6 text-neutral-400 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-neutral-700">Click to upload invoice image or PDF</p>
                    <p className="text-[10px] text-neutral-400 mt-0.5">Supports PNG, JPG, WebP, PDF up to 5MB</p>
                    {isProcessingFile && (
                      <p className="text-xs text-emerald-600 font-bold mt-2 animate-pulse">Processing file...</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[60px]"
                  placeholder="Additional details..."
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-4 border-t border-neutral-100">
                {editingInvoice ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setInvoiceToDelete(editingInvoice);
                    }}
                    className="px-3 py-2 text-sm font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Invoice</span>
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm font-bold text-neutral-600 hover:text-neutral-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    {editingInvoice ? "Save Changes" : "Create Order List"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Native In-App Modal, never window.confirm) */}
      {invoiceToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6 text-left border border-neutral-200">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 mb-1">Delete Invoice?</h3>
            <p className="text-sm text-neutral-600 mb-4">
              Are you sure you want to delete invoice{" "}
              <span className="font-semibold text-neutral-900 font-mono">
                #{invoiceToDelete.invoiceNumber || "N/A"}
              </span>{" "}
              from <span className="font-semibold text-neutral-900">{invoiceToDelete.vendor || "Unknown Vendor"}</span>? This will permanently remove the invoice from your records.
            </p>

            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setInvoiceToDelete(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2 text-sm font-bold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  if (!invoiceToDelete.id) return;
                  try {
                    setIsDeleting(true);
                    setDeleteError(null);
                    await onDeleteInvoice(invoiceToDelete.id);
                    setInvoiceToDelete(null);
                    if (editingInvoice?.id === invoiceToDelete.id) {
                      setShowModal(false);
                      setEditingInvoice(null);
                    }
                  } catch (err: any) {
                    console.error("Failed to delete invoice:", err);
                    setDeleteError(err?.message || "Failed to delete invoice from database.");
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Invoice</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Document & Receipt Preview Lightbox Modal */}
      {previewInvoice && previewInvoice.fileUrl && (
        <DocumentPreviewModal
          isOpen={true}
          onClose={() => setPreviewInvoice(null)}
          fileUrl={previewInvoice.fileUrl}
          fileName={previewInvoice.fileName || `Invoice_${previewInvoice.invoiceNumber || "doc"}`}
          fileType={previewInvoice.fileType}
          fileSize={previewInvoice.fileSize}
          title={`Invoice #${previewInvoice.invoiceNumber || "N/A"}`}
          subtitle={previewInvoice.vendor}
          invoiceData={previewInvoice}
        />
      )}
    </div>
  );
};

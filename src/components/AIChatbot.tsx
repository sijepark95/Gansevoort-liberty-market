import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Bot, User as UserIcon, Loader2 } from "lucide-react";
import { Invoice, GroceryPurchase, Ingredient, Recipe, DailySale } from "../types";

interface AIChatbotProps {
  invoices: Invoice[];
  groceryPurchases: GroceryPurchase[];
  ingredients: Ingredient[];
  recipes: Recipe[];
  dailySales: DailySale[];
}

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
}

export const AIChatbot: React.FC<AIChatbotProps> = ({ invoices, groceryPurchases, ingredients, recipes, dailySales }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<ChatMessage[]>([
    { id: "0", role: "model", text: "Hi! I'm your AI Restaurant Assistant. Ask me anything about your ingredients, invoices, or grocery purchases (e.g. 'How much did we spend on milk this month?')" }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const userMsg = message.trim();
    setMessage("");
    
    const newHistory = [...history, { id: Date.now().toString(), role: "user" as const, text: userMsg }];
    setHistory(newHistory);
    setIsLoading(true);

    try {
      // Build lightweight data context to send (keep it minimal to avoid huge payloads if lists are large)
      const dataContext = {
        groceryPurchases: groceryPurchases.map(p => ({
          date: p.date,
          store: p.storeName,
          items: p.items.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit, price: i.price }))
        })),
        invoices: invoices.map(i => ({
          vendor: i.vendor,
          date: i.issueDate,
          items: i.items.map(item => ({ name: item.name, quantity: item.quantity, unit: item.unit, price: item.totalPrice }))
        })),
        ingredients: ingredients.map(i => ({ name: i.name, inStock: i.inStock, unit: i.unit, price: i.price }))
      };

      // Format history for Gemini API: { role: 'user' | 'model', parts: [{ text: ... }] }
      // skip the welcome message for gemini
      const geminiHistory = newHistory.slice(1).map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
      }));
      geminiHistory.pop(); // remove the latest user message from history because we pass it separately

      const response = await fetch("/api/chatbot-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          history: geminiHistory,
          dataContext
        })
      });

      if (!response.ok) throw new Error("Failed to get response");
      
      const data = await response.json();
      setHistory(prev => [...prev, { id: Date.now().toString(), role: "model", text: data.reply }]);
    } catch (err) {
      console.error(err);
      setHistory(prev => [...prev, { id: Date.now().toString(), role: "model", text: "Sorry, I ran into an error processing your request." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 p-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg transition-transform hover:scale-105 z-50 flex items-center justify-center ${isOpen ? 'scale-0' : 'scale-100'}`}
        title="Open AI Assistant"
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[360px] sm:w-[400px] h-[550px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-neutral-200 z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-200">
          {/* Header */}
          <div className="bg-emerald-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Bot className="w-5 h-5" />
              <h3 className="font-bold text-sm">Restaurant AI Assistant</h3>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-emerald-100 hover:text-white p-1 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-50/50"
          >
            {history.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-600"}`}>
                  {msg.role === "user" ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div 
                  className={`px-3 py-2 rounded-xl max-w-[80%] text-sm ${
                    msg.role === "user" 
                      ? "bg-emerald-600 text-white rounded-tr-none" 
                      : "bg-white border border-neutral-200 text-neutral-800 rounded-tl-none shadow-sm"
                  }`}
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="px-4 py-2.5 rounded-xl bg-white border border-neutral-200 text-neutral-500 rounded-tl-none shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                  <span className="text-xs font-medium">Thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-neutral-200 flex items-center gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask about ingredients, purchases..."
              className="flex-1 bg-neutral-100 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-4 py-2.5 text-sm transition-all"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!message.trim() || isLoading}
              className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white rounded-lg transition-colors flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

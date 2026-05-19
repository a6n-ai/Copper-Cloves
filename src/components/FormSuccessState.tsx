import { CheckCircle2, Sparkles } from "lucide-react";

interface FormSuccessStateProps {
  title: string;
  message: string;
  onClose?: () => void;
}

export function FormSuccessState({ title, message, onClose }: FormSuccessStateProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/50 backdrop-blur-xs animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-500 ease-out">
        {/* Success Icon with Animation */}
        <div className="relative flex items-center justify-center mb-6">
          {/* Pulsing Background Circle */}
          <div className="absolute w-24 h-24 bg-sage/20 rounded-full animate-ping" />
          
          {/* Main Success Circle */}
          <div className="relative w-20 h-20 bg-sage rounded-full flex items-center justify-center animate-in zoom-in duration-700 delay-200">
            <CheckCircle2 className="text-white" size={40} strokeWidth={2.5} />
          </div>
          
          {/* Floating Sparkles */}
          <Sparkles 
            className="absolute -top-2 -right-2 text-sage animate-in fade-in zoom-in duration-500 delay-500" 
            size={24} 
          />
          <Sparkles 
            className="absolute -bottom-1 -left-1 text-terracotta animate-in fade-in zoom-in duration-500 delay-700" 
            size={16} 
          />
        </div>

        {/* Success Text */}
        <div className="text-center space-y-3">
          <h3 className="font-display text-3xl text-charcoal animate-in slide-in-from-bottom duration-500 delay-300">
            {title}
          </h3>
          <p className="font-body text-charcoal/70 leading-relaxed animate-in slide-in-from-bottom duration-500 delay-400">
            {message}
          </p>
        </div>

        {/* Action Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="mt-8 w-full py-3 px-6 bg-sage hover:bg-sage/90 text-white rounded-lg font-body transition-all duration-200 hover:scale-105 active:scale-95 animate-in slide-in-from-bottom duration-500 delay-500"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

// Inline Success Banner (for forms that stay on same page)
export function InlineSuccessState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-sage/10 border-2 border-sage rounded-lg animate-in slide-in-from-top duration-500">
      <div className="shrink-0 w-8 h-8 bg-sage rounded-full flex items-center justify-center">
        <CheckCircle2 className="text-white" size={18} />
      </div>
      <p className="font-body text-sage font-medium">{message}</p>
    </div>
  );
}
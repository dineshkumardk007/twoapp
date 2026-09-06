import React from 'react';
import { MessageSquare, Mail, X, ArrowRight, Heart } from 'lucide-react';

export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  type: 'chat' | 'letter' | 'touch' | 'general';
  tabId: string;
}

interface InAppNotificationToastProps {
  notification: InAppNotification | null;
  onDismiss: () => void;
  onOpenTab: (tabId: string) => void;
}

export const InAppNotificationToast: React.FC<InAppNotificationToastProps> = ({
  notification,
  onDismiss,
  onOpenTab
}) => {
  if (!notification) return null;

  const getIcon = () => {
    switch (notification.type) {
      case 'letter':
        return <Mail className="w-4 h-4 text-amber-600" />;
      case 'touch':
        return <Heart className="w-4 h-4 text-rose-500 fill-rose-500/20" />;
      default:
        return <MessageSquare className="w-4 h-4 text-rose-500" />;
    }
  };

  return (
    <aside aria-label="Partner notification" className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[92vw] animate-in slide-in-from-top-4 duration-300">
      <div 
        onClick={() => {
          onOpenTab(notification.tabId);
          onDismiss();
        }}
        className="bg-linen-surface/95 backdrop-blur-md border border-linen-border rounded-2xl p-3.5 shadow-lg flex items-center space-x-3 cursor-pointer hover:border-linen-accent transition-all group"
      >
        <div className="w-9 h-9 rounded-xl bg-linen-variant flex items-center justify-center shrink-0 border border-linen-border/60 group-hover:scale-105 transition-transform">
          {getIcon()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-semibold text-linen-primary truncate">
              {notification.title}
            </h5>
            <span className="text-[10px] text-linen-accent font-medium inline-flex items-center group-hover:translate-x-0.5 transition-transform">
              Reply <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
            </span>
          </div>
          <p className="text-xs text-linen-secondary truncate mt-0.5">
            {notification.body}
          </p>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="p-1 text-linen-secondary/60 hover:text-linen-primary hover:bg-linen-variant rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};

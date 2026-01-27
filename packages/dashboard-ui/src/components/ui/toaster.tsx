/**
 * Toaster component
 * Renders active toast notifications
 */
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastTitle,
  useToast,
} from '@/components/ui/toast';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export function Toaster() {
  const { toasts } = useToast();

  return (
    <div className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]">
      {toasts.map((t) => (
        <Toast key={t.id} variant={t.variant}>
          <div className="flex items-start gap-3">
            {t.variant === 'success' && (
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600 dark:text-green-400" />
            )}
            {t.variant === 'destructive' && (
              <XCircle className="mt-0.5 h-5 w-5" />
            )}
            {t.variant === 'default' && (
              <AlertCircle className="mt-0.5 h-5 w-5 text-muted-foreground" />
            )}
            <div className="grid gap-1">
              {t.title && <ToastTitle>{t.title}</ToastTitle>}
              {t.description && (
                <ToastDescription>{t.description}</ToastDescription>
              )}
            </div>
          </div>
          {t.action}
          <ToastClose />
        </Toast>
      ))}
    </div>
  );
}

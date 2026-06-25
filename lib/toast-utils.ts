import { toast } from "sonner";

/**
 * Toast notification utilities
 * Provides consistent toast notifications across the application
 */

export const showToast = {
  /**
   * Success toast notification
   */
  success: (title: string, description?: string) => {
    toast.success(title, {
      description,
    });
  },

  /**
   * Error toast notification
   */
  error: (title: string, description?: string) => {
    toast.error(title, {
      description,
    });
  },

  /**
   * Warning toast notification
   */
  warning: (title: string, description?: string) => {
    toast.warning(title, {
      description,
    });
  },

  /**
   * Info toast notification
   */
  info: (title: string, description?: string) => {
    toast.info(title, {
      description,
    });
  },

  /**
   * Loading toast - for async operations
   */
  loading: (title: string, description?: string) => {
    return toast.loading(title, {
      description,
    });
  },

  /**
   * Promise toast - for async operations with auto state management
   */
  promise: <T,>(
    promise: Promise<T>,
    options: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    return toast.promise(promise, options);
  },

  /**
   * Custom toast with action button
   */
  withAction: (
    title: string,
    description: string,
    actionLabel: string,
    action: () => void
  ) => {
    toast(title, {
      description,
      action: {
        label: actionLabel,
        onClick: action,
      },
    });
  },

  /**
   * Dismiss specific toast
   */
  dismiss: (toastId?: string | number) => {
    toast.dismiss(toastId);
  },

  /**
   * Update existing toast (for loading states)
   */
  update: (toastId: string | number, options: any) => {
    // Sonner doesn't have direct update, so dismiss and create new
    toast.dismiss(toastId);
    return toast(options.title, options);
  },
};

/**
 * Legacy compatibility helpers
 * These functions provide familiar APIs for toast notifications
 */
export const successToast = (message: string, title: string = "Success") => {
  showToast.success(title, message);
};

export const errorToast = (message: string, title: string = "Error") => {
  showToast.error(title, message);
};

export const warningToast = (message: string, title: string = "Warning") => {
  showToast.warning(title, message);
};

export const infoToast = (message: string, title: string = "Info") => {
  showToast.info(title, message);
};

/**
 * Confirmation dialog replacement
 * Provides a simple confirmation dialog using browser APIs
 */
export const confirmDialog = async (
  title: string,
  text: string,
  confirmButtonText: string = "Yes",
  cancelButtonText: string = "Cancel"
): Promise<boolean> => {
  return new Promise((resolve) => {
    const confirmed = window.confirm(`${title}\n\n${text}`);
    resolve(confirmed);
  });
};

/**
 * Type-to-confirm deletion helper
 * Provides input validation for destructive actions
 */
export const confirmDeleteWithType = async (
  itemName: string,
  itemType: string = "item",
  additionalInfo?: string
): Promise<boolean> => {
  const message = `Are you sure you want to delete "${itemName}"?\n\n${additionalInfo || ""}\n\nType "${itemName}" to confirm:`;

  const userInput = prompt(message);

  return userInput === itemName;
};

/**
 * HTML content alert helper
 * Converts HTML content to plain text for toast notifications
 */
export const alertWithHtml = (
  title: string,
  htmlContent: string,
  icon: 'success' | 'error' | 'warning' | 'info' = 'info'
) => {
  // Extract text from HTML (simple implementation)
  const textContent = htmlContent
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();

  switch (icon) {
    case 'success':
      showToast.success(title, textContent);
      break;
    case 'error':
      showToast.error(title, textContent);
      break;
    case 'warning':
      showToast.warning(title, textContent);
      break;
    case 'info':
    default:
      showToast.info(title, textContent);
      break;
  }
};

/**
 * Loading state management
 * Shows loading toast for async operations
 */
export const showLoadingAlert = (title: string, text?: string) => {
  return showToast.loading(title, text);
};

/**
 * Dismiss loading toast
 */
export const dismissLoadingAlert = (toastId?: string | number) => {
  showToast.dismiss(toastId);
};

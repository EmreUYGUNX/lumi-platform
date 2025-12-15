/* eslint-disable unicorn/no-null */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const UI_STORAGE_KEY = "lumi.ui";

const createStorage = (): Storage => {
  if (typeof window === "undefined") {
    const store = new Map<string, string>();
    return {
      get length() {
        return store.size;
      },
      clear: () => {
        store.clear();
      },
      getItem: (key: string) =>
        // eslint-disable-next-line security/detect-object-injection
        store.get(key) ?? null,
      key: (index: number) => {
        if (!Number.isInteger(index) || index < 0) {
          return null;
        }
        const keys = [...store.keys()];
        // eslint-disable-next-line security/detect-object-injection
        return keys[index] ?? null;
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
  }

  return window.localStorage;
};

export type ToastVariant = "default" | "success" | "warning" | "error";

export interface ToastNotification {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration?: number;
  actionLabel?: string;
}

export interface ModalDescriptor {
  id: string;
  context?: Record<string, unknown>;
  blocking?: boolean;
  openedAt: number;
}

export type LoadingStateDictionary = Record<string, boolean>;

export interface UIState {
  isSidebarOpen: boolean;
  commandPaletteOpen: boolean;
  modalStack: ModalDescriptor[];
  toastQueue: ToastNotification[];
  loadingStates: LoadingStateDictionary;
  sidebarPinned: boolean;
}

export interface UIActions {
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarPinned: (pinned: boolean) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  pushModal: (modal: Omit<ModalDescriptor, "openedAt">) => string;
  popModal: () => void;
  dismissModal: (id: string) => void;
  resetModals: () => void;
  enqueueToast: (toast: Omit<ToastNotification, "id"> & { id?: string }) => string;
  dismissToast: (id: string) => void;
  resetToasts: () => void;
  startLoading: (key: string) => void;
  stopLoading: (key: string) => void;
  resetLoadingStates: () => void;
}

export type UIStore = UIState & UIActions;

const FALLBACK_TOAST_DURATION = 5000;
const TOAST_QUEUE_LIMIT = 5;

let fallbackToastSequence = 0;

const getCrypto = (): Crypto | undefined => {
  return (globalThis as unknown as { crypto?: Crypto }).crypto;
};

const randomId = () => {
  const cryptoApi = getCrypto();
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();

  if (typeof cryptoApi?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `toast_${hex}`;
  }

  fallbackToastSequence = (fallbackToastSequence + 1) % 1_000_000;
  return `toast_${Date.now().toString(36)}_${fallbackToastSequence.toString(36)}`;
};

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      isSidebarOpen: true,
      commandPaletteOpen: false,
      modalStack: [],
      toastQueue: [],
      loadingStates: {},
      sidebarPinned: true,
      toggleSidebar: () => {
        set((state) => ({ ...state, isSidebarOpen: !state.isSidebarOpen }));
      },
      setSidebarOpen: (open) => {
        set((state) => ({ ...state, isSidebarOpen: open }));
      },
      setSidebarPinned: (pinned) => {
        set((state) => ({ ...state, sidebarPinned: pinned }));
      },
      openCommandPalette: () => set((state) => ({ ...state, commandPaletteOpen: true })),
      closeCommandPalette: () => set((state) => ({ ...state, commandPaletteOpen: false })),
      pushModal: (modal) => {
        const identifier = modal.id ?? randomId();
        set((state) => ({
          ...state,
          modalStack: [
            ...state.modalStack,
            {
              ...modal,
              id: identifier,
              openedAt: Date.now(),
            },
          ],
        }));
        return identifier;
      },
      popModal: () => {
        set((state) => ({
          ...state,
          modalStack: state.modalStack.slice(0, -1),
        }));
      },
      dismissModal: (id) => {
        set((state) => ({
          ...state,
          modalStack: state.modalStack.filter((modal) => modal.id !== id),
        }));
      },
      resetModals: () => {
        set((state) => ({ ...state, modalStack: [] }));
      },
      enqueueToast: (toast) => {
        const id = toast.id ?? randomId();
        set((state) => {
          const entry: ToastNotification = {
            variant: toast.variant ?? "default",
            duration: toast.duration ?? FALLBACK_TOAST_DURATION,
            id,
            title: toast.title,
            description: toast.description,
            actionLabel: toast.actionLabel,
          };
          const nextQueue = [entry, ...state.toastQueue].slice(0, TOAST_QUEUE_LIMIT);
          return {
            ...state,
            toastQueue: nextQueue,
          };
        });
        return id;
      },
      dismissToast: (id) => {
        set((state) => ({
          ...state,
          toastQueue: state.toastQueue.filter((toastMessage) => toastMessage.id !== id),
        }));
      },
      resetToasts: () => set((state) => ({ ...state, toastQueue: [] })),
      startLoading: (key) => {
        set((state) => ({
          ...state,
          loadingStates: { ...state.loadingStates, [key]: true },
        }));
      },
      stopLoading: (key) => {
        set((state) => {
          const { [key]: _removed, ...rest } = state.loadingStates;
          return {
            ...state,
            loadingStates: rest,
          };
        });
      },
      resetLoadingStates: () => set((state) => ({ ...state, loadingStates: {} })),
    }),
    {
      name: UI_STORAGE_KEY,
      storage: createJSONStorage(createStorage),
      partialize: (state) => ({
        isSidebarOpen: state.isSidebarOpen,
        sidebarPinned: state.sidebarPinned,
      }),
    },
  ),
);

export const uiStore = useUIStore;

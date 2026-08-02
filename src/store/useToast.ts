import { create } from 'zustand'
import { uid } from '@/lib/utils'

export interface Toast {
  id: string
  message: string
  tone: 'info' | 'success' | 'error'
}

interface ToastState {
  toasts: Toast[]
  push: (message: string, tone?: Toast['tone']) => void
  dismiss: (id: string) => void
}

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (message, tone = 'info') => {
    const id = uid()
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 3600)
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

/** Imperative helper for use outside React components. */
export const toast = {
  info: (message: string) => useToast.getState().push(message, 'info'),
  success: (message: string) => useToast.getState().push(message, 'success'),
  error: (message: string) => useToast.getState().push(message, 'error'),
}

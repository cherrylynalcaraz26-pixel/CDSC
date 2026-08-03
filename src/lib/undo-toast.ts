import { toast } from 'sonner'

// Shows a success toast with an "Undo" action button. Pass the async
// function that reverts the mutation just performed — errors from it are
// surfaced as their own toast rather than thrown.
export function undoToast(message: string, undo: () => void | Promise<void>) {
  toast.success(message, {
    action: {
      label: 'Undo',
      onClick: () => {
        Promise.resolve(undo()).catch((err: unknown) => {
          toast.error(err instanceof Error ? err.message : 'Failed to undo')
        })
      },
    },
  })
}

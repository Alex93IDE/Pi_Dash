import { reactive } from "vue";

/**
 * One dialog for the whole app, in the dashboard's own style instead of the
 * browser's confirm(). Rendered once by ConfirmDialog in App.vue; anything
 * can await a confirmation or a PIN through the functions below.
 */
export type DialogTone = "danger" | "warn" | "primary";

type Request = {
  title: string;
  message: string;
  confirmLabel: string;
  tone: DialogTone;
  pin: boolean; // show a PIN field
  error: string; // shown above the buttons, e.g. "Wrong PIN"
  resolve: (value: string | null) => void;
};

export const dialog = reactive<{ current: Request | null }>({ current: null });

function open(req: Omit<Request, "resolve">): Promise<string | null> {
  // A second request while one is open cancels the first.
  dialog.current?.resolve(null);
  return new Promise((resolve) => {
    dialog.current = {
      ...req,
      resolve: (value) => {
        dialog.current = null;
        resolve(value);
      },
    };
  });
}

/** Resolves true when the user confirms. */
export async function confirmDialog(opts: {
  title: string;
  message?: string;
  confirmLabel?: string;
  tone?: DialogTone;
}): Promise<boolean> {
  const answer = await open({
    message: "",
    confirmLabel: "Confirm",
    tone: "primary",
    ...opts,
    pin: false,
    error: "",
  });
  return answer !== null;
}

/** Resolves with the PIN typed, or null if cancelled. */
export function askPin(error = ""): Promise<string | null> {
  return open({
    title: "Enter PIN",
    message: "This action needs the dashboard PIN (ACTION_PIN on the Pi).",
    confirmLabel: "Continue",
    tone: "primary",
    pin: true,
    error,
  });
}

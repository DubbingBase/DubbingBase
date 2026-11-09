import { ref } from "vue";

export type EditorToastKind = "info" | "success" | "error";
export interface EditorToastState {
  show: boolean;
  message: string;
  type: EditorToastKind;
  link: string;
}

/** Transient toast shown by the project editors after inline creation and saves. */
export const useEditorToast = () => {
  const toast = ref<EditorToastState>({ show: false, message: "", type: "info", link: "" });
  const showToast = (message: string, type: EditorToastKind = "info", link = "") => {
    toast.value = { show: true, message, type, link };
    setTimeout(() => (toast.value.show = false), 5000);
  };
  return { toast, showToast };
};

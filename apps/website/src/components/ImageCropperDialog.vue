<template>
  <DialogRoot :open="file !== null" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-[110] bg-[var(--app-color-backdrop-scrim)] backdrop-blur-sm"
      />
      <DialogContent
        class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[120] w-[min(560px,calc(100vw-2rem))] max-h-[calc(100dvh-1.5rem)] overflow-y-auto theme-surface-overlay border theme-border rounded-2xl p-4 sm:p-6 shadow-2xl"
        data-testid="image-cropper-dialog"
        @interact-outside.prevent
      >
        <DialogTitle class="text-lg font-bold theme-text mb-1">{{
          title ?? $t("imageCropper.title")
        }}</DialogTitle>
        <DialogDescription class="text-xs theme-text-muted mb-4">{{
          $t("imageCropper.description")
        }}</DialogDescription>

        <div
          :ref="setContainer"
          class="image-cropper-stage h-[clamp(180px,45dvh,380px)] w-full overflow-hidden rounded-xl border theme-border theme-input"
        />
        <p v-if="errorMessage" role="alert" class="mt-2 text-sm theme-status-danger-text">
          {{ errorMessage }}
        </p>

        <div class="mt-3 flex flex-wrap items-center justify-center gap-2">
          <button
            v-for="tool in tools"
            :key="tool.key"
            type="button"
            class="min-h-11 px-3 py-1.5 text-xs font-semibold rounded-lg theme-surface-muted theme-hover-surface-muted theme-text border theme-border disabled:opacity-50"
            :disabled="!ready"
            @click="tool.run"
          >
            {{ $t(`imageCropper.${tool.key}`) }}
          </button>
        </div>

        <div class="mt-5 flex justify-end gap-2">
          <button
            type="button"
            class="min-h-11 px-4 py-2 theme-text-secondary theme-hover-text"
            @click="cancel"
          >
            {{ $t("imageCropper.cancel") }}
          </button>
          <button
            type="button"
            class="min-h-11 px-4 py-2 rounded-xl font-semibold theme-primary-bg theme-primary-border disabled:opacity-50"
            :disabled="!ready || applying"
            data-testid="image-cropper-apply"
            @click="apply"
          >
            {{ $t("imageCropper.apply") }}
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import type Cropper from "cropperjs";
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";

const props = withDefaults(
  defineProps<{
    /** Image picked by the user; the dialog is open while this is set. */
    file: File | null;
    /** Square output edge in pixels. */
    outputSize?: number;
    title?: string;
  }>(),
  { outputSize: 800, title: undefined },
);

const emit = defineEmits<{
  confirm: [file: File];
  cancel: [];
}>();

const { t } = useI18n();

const OUTPUT_TYPE = "image/webp";
const OUTPUT_QUALITY = 0.92;

// Selection is locked square: avatars/logos are displayed in square or circular frames.
const CROPPER_TEMPLATE = `
<cropper-canvas background>
  <cropper-image rotatable scalable translatable></cropper-image>
  <cropper-shade></cropper-shade>
  <cropper-handle action="select" plain></cropper-handle>
  <cropper-selection aspect-ratio="1" initial-coverage="0.7" movable resizable keyboard>
    <cropper-grid role="grid" bordered covered></cropper-grid>
    <cropper-crosshair centered></cropper-crosshair>
    <cropper-handle action="move" theme-color="rgba(255, 255, 255, 0.35)"></cropper-handle>
    <cropper-handle action="n-resize"></cropper-handle>
    <cropper-handle action="e-resize"></cropper-handle>
    <cropper-handle action="s-resize"></cropper-handle>
    <cropper-handle action="w-resize"></cropper-handle>
    <cropper-handle action="ne-resize"></cropper-handle>
    <cropper-handle action="nw-resize"></cropper-handle>
    <cropper-handle action="se-resize"></cropper-handle>
    <cropper-handle action="sw-resize"></cropper-handle>
  </cropper-selection>
</cropper-canvas>`;

let cropper: Cropper | null = null;
let objectUrl: string | null = null;
let container: HTMLElement | null = null;
const ready = ref(false);
const applying = ref(false);
const errorMessage = ref("");

const tools = [
  { key: "zoomIn", run: () => cropper?.getCropperImage()?.$zoom(0.15) },
  { key: "zoomOut", run: () => cropper?.getCropperImage()?.$zoom(-0.15) },
  { key: "rotateLeft", run: () => cropper?.getCropperImage()?.$rotate("-90deg") },
  { key: "rotateRight", run: () => cropper?.getCropperImage()?.$rotate("90deg") },
  { key: "reset", run: resetView },
];

function resetView() {
  const image = cropper?.getCropperImage();
  image?.$resetTransform();
  image?.$center("contain");
  cropper?.getCropperSelection()?.$reset();
}

function disposeCropper() {
  ready.value = false;
  cropper?.destroy();
  cropper = null;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = null;
}

async function setup() {
  // Browser only: the guard lets the server build drop the cropperjs chunk entirely.
  if (!import.meta.client) return;
  disposeCropper();
  errorMessage.value = "";
  if (!props.file || !container) return;
  const target = container;
  const url = URL.createObjectURL(props.file);
  objectUrl = url;
  // cropperjs registers custom elements on import, so it must only load in the browser.
  const { default: CropperClass } = await import("cropperjs");
  if (objectUrl !== url) return; // superseded while loading
  const image = new Image();
  image.alt = "";
  image.src = url;
  cropper = new CropperClass(image, { container: target, template: CROPPER_TEMPLATE });
  try {
    await cropper.getCropperImage()?.$ready();
    if (objectUrl !== url) return;
    ready.value = true;
  } catch {
    errorMessage.value = t("imageCropper.loadError");
  }
}

// The dialog content is portalled and mounted lazily; initialise once its stage element exists.
function setContainer(el: unknown) {
  container = el instanceof HTMLElement ? el : null;
  if (container) void setup();
}

watch(
  () => props.file,
  () => {
    if (props.file && container) void setup();
    if (!props.file) disposeCropper();
  },
);

async function apply() {
  const file = props.file;
  const selection = cropper?.getCropperSelection();
  if (!file || !selection) return;
  applying.value = true;
  errorMessage.value = "";
  try {
    const canvas = await selection.$toCanvas({
      width: props.outputSize,
      height: props.outputSize,
    });
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, OUTPUT_TYPE, OUTPUT_QUALITY),
    );
    if (!blob) throw new Error("Canvas export failed");
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    emit("confirm", new File([blob], `${baseName}.webp`, { type: OUTPUT_TYPE }));
  } catch {
    errorMessage.value = t("imageCropper.exportError");
  } finally {
    applying.value = false;
  }
}

function cancel() {
  emit("cancel");
}

function onOpenChange(open: boolean) {
  if (!open) cancel();
}

onBeforeUnmount(disposeCropper);
</script>

<style scoped>
.image-cropper-stage :deep(cropper-canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>

import { onMounted, onBeforeUnmount, type Ref } from "vue";

export function useDragScroll(scrollRef: Ref<HTMLElement | null>) {
  onMounted(() => {
    const ele = scrollRef.value;
    if (!ele) return;

    let pos = { left: 0, x: 0 };
    let isDragging = false;
    let hasDragged = false;
    let originalSnapType = "";

    const mouseDownHandler = function (e: MouseEvent) {
      if (e.button !== 0) return;

      isDragging = true;
      hasDragged = false;

      originalSnapType = window
        .getComputedStyle(ele)
        .getPropertyValue("scroll-snap-type");
      ele.style.setProperty("scroll-snap-type", "none", "important");
      ele.style.cursor = "grabbing";
      ele.style.userSelect = "none";

      pos = {
        left: ele.scrollLeft,
        x: e.clientX,
      };

      document.addEventListener("mousemove", mouseMoveHandler);
      document.addEventListener("mouseup", mouseUpHandler);
    };

    const mouseMoveHandler = function (e: MouseEvent) {
      if (!isDragging) return;

      const dx = e.clientX - pos.x;

      if (Math.abs(dx) > 3) {
        hasDragged = true;
      }

      ele.scrollLeft = pos.left - dx;
    };

    const mouseUpHandler = function (e: MouseEvent) {
      isDragging = false;
      ele.style.cursor = "grab";
      ele.style.removeProperty("user-select");

      // Find nearest child to snap to smoothly
      const containerRect = ele.getBoundingClientRect();
      let closestChild: Element | null = null;
      let minDiff = Infinity;

      Array.from(ele.children).forEach((child) => {
        const childRect = child.getBoundingClientRect();
        // Since we use snap-start, we measure distance from left edge
        const diff = Math.abs(childRect.left - containerRect.left);
        if (diff < minDiff) {
          minDiff = diff;
          closestChild = child;
        }
      });

      const targetChild = closestChild as Element | null;
      if (targetChild) {
        ele.style.scrollBehavior = "smooth";
        ele.scrollBy({
          left: targetChild.getBoundingClientRect().left - containerRect.left,
          behavior: "smooth",
        });

        // Wait for smooth scroll to finish before restoring snap type
        setTimeout(() => {
          ele.style.removeProperty("scroll-behavior");
          ele.style.removeProperty("scroll-snap-type");
        }, 400);
      } else {
        ele.style.removeProperty("scroll-snap-type");
      }

      document.removeEventListener("mousemove", mouseMoveHandler);
      document.removeEventListener("mouseup", mouseUpHandler);
    };

    const clickHandler = (e: MouseEvent) => {
      if (hasDragged) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const dragStartHandler = (e: DragEvent) => {
      e.preventDefault();
    };

    ele.addEventListener("mousedown", mouseDownHandler);
    ele.addEventListener("click", clickHandler, { capture: true });
    ele.addEventListener("dragstart", dragStartHandler);

    ele.style.cursor = "grab";

    onBeforeUnmount(() => {
      ele.removeEventListener("mousedown", mouseDownHandler);
      ele.removeEventListener("click", clickHandler, { capture: true });
      ele.removeEventListener("dragstart", dragStartHandler);
      document.removeEventListener("mousemove", mouseMoveHandler);
      document.removeEventListener("mouseup", mouseUpHandler);
    });
  });
}

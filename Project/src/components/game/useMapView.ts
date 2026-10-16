import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

export interface MapView {
  k: number;
  x: number;
  y: number;
}

const MIN_K = 1;
const MAX_K = 8;

/** Zoom + arrastre compartido por los mapas del juego. */
export function useMapView() {
  const [view, setView] = useState<MapView>({ k: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  const zoomBy = (factor: number) =>
    setView((v) => ({ ...v, k: Math.min(MAX_K, Math.max(MIN_K, v.k * factor)) }));

  const svgProps: {
    onWheel: (e: ReactWheelEvent<SVGSVGElement>) => void;
    onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerUp: () => void;
    onPointerLeave: () => void;
  } = {
    onWheel: (e) => zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2),
    onPointerDown: (e) => {
      drag.current = { x: e.clientX, y: e.clientY };
    },
    onPointerMove: (e) => {
      if (!drag.current) return;
      const dx = e.clientX - drag.current.x;
      const dy = e.clientY - drag.current.y;
      drag.current = { x: e.clientX, y: e.clientY };
      setView((v) => ({ ...v, x: v.x + dx / v.k, y: v.y + dy / v.k }));
    },
    onPointerUp: () => {
      drag.current = null;
    },
    onPointerLeave: () => {
      drag.current = null;
    },
  };

  return {
    view,
    zoomBy,
    reset: () => setView({ k: 1, x: 0, y: 0 }),
    svgProps,
  };
}

/** Misma transformación que usaba el mapamundi: el arrastre se siente 1:1 en pantalla. */
export function mapTransform(view: MapView, w: number, h: number) {
  return `translate(${w / 2} ${h / 2}) scale(${view.k}) translate(${-w / 2 + view.x} ${-h / 2 + view.y})`;
}

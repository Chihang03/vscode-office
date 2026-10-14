import { useEffect, useRef } from 'react';

interface Props {
    src: string;
    alt: string;
    active: boolean;
    wheelMode: 'navigate' | 'zoom';
    onBrowse: (direction: number) => void;
    onPanAvailabilityChange: (available: boolean) => void;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;

export default function ImageViewport({ src, alt, active, wheelMode, onBrowse, onPanAvailabilityChange }: Props) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    // High-frequency pointer/wheel updates stay local; the gallery only needs a boolean.
    const viewRef = useRef({ scale: 1, x: 0, y: 0 });

    useEffect(() => {
        const viewport = viewportRef.current;
        const image = imageRef.current;
        if (!viewport || !image) return;
        let drag: { id: number; x: number; y: number } | null = null;
        let panAvailable: boolean | undefined;

        const apply = (next = viewRef.current) => {
            const limitX = Math.max(0, (image.offsetWidth * next.scale - viewport.clientWidth) / 2);
            const limitY = Math.max(0, (image.offsetHeight * next.scale - viewport.clientHeight) / 2);
            const view = {
                scale: next.scale,
                x: Math.max(-limitX, Math.min(limitX, next.x)),
                y: Math.max(-limitY, Math.min(limitY, next.y)),
            };
            viewRef.current = view;
            image.style.transform = `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`;
            const available = limitX > 0 || limitY > 0;
            viewport.classList.toggle('is-pannable', available);
            if (active && available !== panAvailable) {
                panAvailable = available;
                onPanAvailabilityChange(available);
            }
            return available;
        };
        const finishDrag = () => {
            const current = drag;
            drag = null;
            viewport.classList.remove('is-dragging');
            if (current && viewport.hasPointerCapture(current.id)) {
                viewport.releasePointerCapture(current.id);
            }
        };
        const onPointerDown = (event: PointerEvent) => {
            if (!active || event.button !== 0 || !event.isPrimary || !apply()) return;
            event.preventDefault();
            event.stopPropagation();
            drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
            viewport.setPointerCapture(event.pointerId);
            viewport.classList.add('is-dragging');
        };
        const onPointerMove = (event: PointerEvent) => {
            if (!drag || event.pointerId !== drag.id) return;
            if (event.pointerType === 'mouse' && !(event.buttons & 1)) {
                finishDrag();
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            const view = viewRef.current;
            apply({ ...view, x: view.x + event.clientX - drag.x, y: view.y + event.clientY - drag.y });
            drag.x = event.clientX;
            drag.y = event.clientY;
        };
        const onPointerEnd = (event: PointerEvent) => {
            if (drag?.id === event.pointerId) finishDrag();
        };
        const reset = () => {
            finishDrag();
            apply({ scale: 1, x: 0, y: 0 });
        };
        const onDoubleClick = (event: MouseEvent) => {
            if (!active || event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            reset();
        };
        const onWheel = (event: WheelEvent) => {
            if (!active || !event.deltaY) return;
            event.preventDefault();
            event.stopPropagation();
            if (wheelMode === 'navigate') {
                onBrowse(event.deltaY > 0 ? 1 : -1);
                return;
            }
            const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
            const view = viewRef.current;
            const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.scale * Math.exp(-event.deltaY * multiplier * 0.001)));
            const bounds = viewport.getBoundingClientRect();
            const mouseX = event.clientX - bounds.left - bounds.width / 2;
            const mouseY = event.clientY - bounds.top - bounds.height / 2;
            const ratio = scale / view.scale;
            // Keep the image point beneath the mouse fixed, unless an edge is reached.
            apply({ scale, x: mouseX - (mouseX - view.x) * ratio, y: mouseY - (mouseY - view.y) * ratio });
        };
        const onLoad = () => apply();
        const observer = new ResizeObserver(() => apply());
        observer.observe(viewport);
        observer.observe(image);
        image.addEventListener('load', onLoad);
        viewport.addEventListener('wheel', onWheel, { passive: false });
        viewport.addEventListener('pointerdown', onPointerDown);
        viewport.addEventListener('pointermove', onPointerMove);
        viewport.addEventListener('pointerup', onPointerEnd);
        viewport.addEventListener('pointercancel', onPointerEnd);
        viewport.addEventListener('lostpointercapture', onPointerEnd);
        viewport.addEventListener('dblclick', onDoubleClick);
        window.addEventListener('blur', finishDrag);
        apply();
        return () => {
            finishDrag();
            observer.disconnect();
            image.removeEventListener('load', onLoad);
            viewport.removeEventListener('wheel', onWheel);
            viewport.removeEventListener('pointerdown', onPointerDown);
            viewport.removeEventListener('pointermove', onPointerMove);
            viewport.removeEventListener('pointerup', onPointerEnd);
            viewport.removeEventListener('pointercancel', onPointerEnd);
            viewport.removeEventListener('lostpointercapture', onPointerEnd);
            viewport.removeEventListener('dblclick', onDoubleClick);
            window.removeEventListener('blur', finishDrag);
        };
    }, [active, wheelMode, onBrowse, onPanAvailabilityChange]);

    return (
        <div ref={viewportRef} className="image-viewport" title="Scroll to zoom; drag to pan; double-click to fit">
            <img ref={imageRef} className="image-gallery-image" src={src} alt={alt} draggable={false} />
        </div>
    );
}

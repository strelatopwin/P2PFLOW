import { useSortable } from "@dnd-kit/react/sortable";
import { Eye, EyeOff, GripVertical } from "lucide-react";
import { useRef, useState, type FC } from "react";

export interface SortableColumnRowProps {
  id: string;
  index: number;
  label: string;
  showVisibilityToggle: boolean;
  hidden: boolean;
  onToggleHidden: () => void;
}

const SortableColumnRow: FC<SortableColumnRowProps> = ({
  id,
  index,
  label,
  showVisibilityToggle,
  hidden,
  onToggleHidden,
}) => {
  const [element, setElement] = useState<Element | null>(null);
  const handleRef = useRef<HTMLButtonElement | null>(null);
  const { isDragging } = useSortable({
    id,
    index,
    element,
    handle: handleRef,
  });

  return (
    <li
      ref={setElement}
      data-shadow={isDragging || undefined}
      className={`flex min-h-10 items-center gap-2 border-b border-zinc-100 py-2.5 pl-2 pr-3 text-sm last:border-b-0 ${
        hidden ? "bg-zinc-50/90 text-zinc-400" : "text-zinc-900"
      }`}
    >
      <button
        type="button"
        ref={handleRef}
        className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 active:cursor-grabbing"
        aria-label="Reorder"
      >
        <GripVertical className="h-4 w-4" strokeWidth={2} />
      </button>
      <span
        className={`min-w-0 flex-1 text-left text-sm ${hidden ? "line-through decoration-zinc-300" : ""}`}
      >
        {label}
      </span>
      {showVisibilityToggle ? (
        <button
          type="button"
          onClick={onToggleHidden}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded hover:bg-zinc-100 ${
            hidden ? "text-zinc-400" : "text-zinc-600"
          }`}
          aria-label={hidden ? "Show column" : "Hide column"}
        >
          {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      ) : (
        <span className="h-8 w-8 shrink-0" aria-hidden />
      )}
    </li>
  );
};

export default SortableColumnRow;

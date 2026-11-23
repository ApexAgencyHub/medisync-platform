"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export interface UiSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  selectSize?: "sm" | "md";
  tone?: "default" | "amber";
  variant?: "default" | "ghost" | "soft" | "chassis";
  wrapperClassName?: string;
  startIcon?: ReactNode;
}

interface ParsedOption {
  value: string;
  label: string;
  disabled: boolean;
  group: string | undefined;
}

interface MenuCoords {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

function extractOptionText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractOptionText).join("");
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractOptionText(node.props.children);
  }
  return "";
}

function collectSelectOptions(
  children: ReactNode,
  groupLabel?: string,
): ParsedOption[] {
  const items: ParsedOption[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;

    if (child.type === Fragment) {
      const fragEl = child as ReactElement<{ children?: ReactNode }>;
      items.push(...collectSelectOptions(fragEl.props.children, groupLabel));
      return;
    }

    if (child.type === "optgroup") {
      const groupEl = child as ReactElement<{
        label?: string;
        children?: ReactNode;
      }>;
      items.push(
        ...collectSelectOptions(groupEl.props.children, groupEl.props.label),
      );
      return;
    }

    if (child.type === "option") {
      const optEl = child as ReactElement<{
        value?: string | number;
        disabled?: boolean;
        children?: ReactNode;
      }>;
      const label = extractOptionText(optEl.props.children).trim();
      const value =
        optEl.props.value !== undefined ? String(optEl.props.value) : label;
      items.push({
        value,
        label,
        disabled: Boolean(optEl.props.disabled),
        group: groupLabel,
      });
    }
  });

  return items;
}

/** Accessible custom-styled select dropdown backed by a synchronized native select. */
export function UiSelect({
  className = "",
  selectSize = "md",
  tone = "default",
  variant = "default",
  wrapperClassName = "",
  startIcon,
  children,
  value,
  defaultValue,
  onChange,
  disabled = false,
  id,
  name,
  required,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  ...rest
}: UiSelectProps) {
  const generatedId = useId();
  const listboxId = `uiselect-listbox-${generatedId}`;

  const options = useMemo(() => collectSelectOptions(children), [children]);
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState<string>(() => {
    if (defaultValue !== undefined) return String(defaultValue);
    return options[0]?.value ?? "";
  });

  const currentValue = isControlled ? String(value) : uncontrolledValue;
  const selectedIndex = Math.max(
    0,
    options.findIndex((opt) => opt.value === currentValue),
  );
  const selectedOption = options[selectedIndex] ?? options[0] ?? null;

  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(selectedIndex);
  const [coords, setCoords] = useState<MenuCoords | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectRef = useRef<HTMLSelectElement | null>(null);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const edgePadding = 12;

    if (
      rect.bottom < 0 ||
      rect.top > viewportH ||
      rect.right < 0 ||
      rect.left > viewportW
    ) {
      setOpen(false);
      return;
    }

    const menuWidth = Math.min(Math.max(rect.width, 215), viewportW - edgePadding * 2);
    const spaceBelow = viewportH - rect.bottom - edgePadding;
    const spaceAbove = rect.top - edgePadding;
    const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow;

    const isRtl =
      typeof document !== "undefined" &&
      (document.documentElement.dir === "rtl" ||
        getComputedStyle(trigger).direction === "rtl");

    const rawLeft = isRtl ? rect.right - menuWidth : rect.left;
    const clampedLeft = Math.max(
      edgePadding,
      Math.min(rawLeft, viewportW - menuWidth - edgePadding),
    );

    if (openUpward) {
      setCoords({
        bottom: viewportH - rect.top + 6,
        left: clampedLeft,
        width: menuWidth,
        maxHeight: Math.max(140, Math.min(280, spaceAbove)),
      });
      return;
    }

    setCoords({
      top: rect.bottom + 6,
      left: clampedLeft,
      width: menuWidth,
      maxHeight: Math.max(140, Math.min(280, spaceBelow)),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    updateMenuPosition();
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;

    const handleViewportChange = () => updateMenuPosition();
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        !target ||
        containerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open || !menuRef.current) return;
    const activeOptionEl = menuRef.current.querySelector<HTMLElement>(
      `[data-option-index="${highlightedIndex}"]`,
    );
    activeOptionEl?.scrollIntoView({ block: "nearest" });
  }, [open, highlightedIndex]);

  const commitValue = useCallback(
    (nextValue: string) => {
      if (!isControlled) {
        setUncontrolledValue(nextValue);
      }

      if (nextValue !== currentValue && selectRef.current) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,
          "value",
        )?.set;
        nativeSetter?.call(selectRef.current, nextValue);
        selectRef.current.dispatchEvent(new Event("change", { bubbles: true }));
      }

      setOpen(false);
      triggerRef.current?.focus();
    },
    [currentValue, isControlled],
  );

  const moveHighlight = useCallback(
    (direction: 1 | -1) => {
      if (options.length === 0) return;
      let next = highlightedIndex;
      for (let i = 0; i < options.length; i += 1) {
        next = (next + direction + options.length) % options.length;
        if (!options[next]?.disabled) {
          setHighlightedIndex(next);
          return;
        }
      }
    },
    [highlightedIndex, options],
  );

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setHighlightedIndex(selectedIndex);
        setOpen(true);
      } else {
        moveHighlight(event.key === "ArrowDown" ? 1 : -1);
      }
      return;
    }

    if (event.key === "Home" && open) {
      event.preventDefault();
      const firstEnabled = options.findIndex((opt) => !opt.disabled);
      if (firstEnabled >= 0) setHighlightedIndex(firstEnabled);
      return;
    }

    if (event.key === "End" && open) {
      event.preventDefault();
      for (let i = options.length - 1; i >= 0; i -= 1) {
        if (!options[i]?.disabled) {
          setHighlightedIndex(i);
          break;
        }
      }
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        setHighlightedIndex(selectedIndex);
        setOpen(true);
      } else {
        const targetOption = options[highlightedIndex];
        if (targetOption && !targetOption.disabled) {
          commitValue(targetOption.value);
        }
      }
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === "Tab" && open) {
      setOpen(false);
    }
  };

  const hasCustomRadius = /\brounded-/.test(className);
  const sizeClasses =
    selectSize === "sm"
      ? `min-h-[36px] ${hasCustomRadius ? "" : "rounded-xl"} px-3 text-xs font-medium`
      : `h-10 ${hasCustomRadius ? "" : "rounded-xl"} px-3.5 text-sm font-medium`;

  const toneClasses =
    variant === "chassis"
      ? open
        ? "border-[#0066CC] bg-white text-[#0F243E] ring-2 ring-[#0066CC]/18"
        : "border-[#D7E4F2] bg-[#F3F8FD] text-[#0F243E] hover:border-[#0066CC] focus-visible:border-[#0066CC] focus-visible:ring-[#0066CC]/20"
      : variant === "ghost"
        ? open
          ? "border-transparent bg-[#E8F1FA] text-[#0F243E]"
          : "border-transparent bg-transparent text-[#4A627D] hover:bg-[#F3F8FD] hover:text-[#0F243E] focus-visible:ring-[#0066CC]/25"
        : variant === "soft"
          ? open
            ? "border-transparent bg-[#DCE9F7] text-[#0F243E] ring-2 ring-[#0066CC]/20"
            : "border-transparent bg-[#E8F1FA] text-[#0F243E] hover:bg-[#DCE9F7] focus-visible:ring-[#0066CC]/25"
          : tone === "amber"
            ? open
              ? "border-amber-500 bg-amber-50 text-[#0F243E] ring-2 ring-amber-500/20"
              : "border-amber-300 bg-amber-50 text-[#0F243E] hover:border-amber-400 focus-visible:border-amber-600 focus-visible:ring-amber-500/20"
            : open
              ? "border-[#0066CC] bg-white text-[#0F243E] ring-2 ring-[#0066CC]/18"
              : "border-[#CBDDF0] bg-white text-[#0F243E] hover:border-[#0066CC] focus-visible:border-[#0066CC] focus-visible:ring-[#0066CC]/18";

  const iconClasses = selectSize === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const hasExplicitWidth = /\bw-/.test(wrapperClassName);
  const canPortal = typeof document !== "undefined";

  return (
    <div
      ref={containerRef}
      className={`relative ${hasExplicitWidth ? "" : "w-full"} ${wrapperClassName}`}
    >
      {/* Synchronized native select preserves external <label htmlFor>, FormData, and automation selectors. */}
      <select
        ref={selectRef}
        id={id}
        name={name}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        value={isControlled ? currentValue : undefined}
        defaultValue={!isControlled ? currentValue : undefined}
        onChange={(event) => {
          if (!isControlled) {
            setUncontrolledValue(event.target.value);
          }
          onChange?.(event);
        }}
        onClick={(event) => {
          event.preventDefault();
          if (!disabled) {
            setHighlightedIndex(selectedIndex);
            setOpen(true);
            triggerRef.current?.focus();
          }
        }}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        {...rest}
      >
        {children}
      </select>

      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => {
            if (!prev) {
              setHighlightedIndex(selectedIndex);
            }
            return !prev;
          });
        }}
        onKeyDown={handleTriggerKeyDown}
        className={`relative z-[1] flex w-full cursor-pointer items-center justify-between gap-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:bg-[#E8F1FA] disabled:text-[#737069] ${variant === "ghost" ? "" : "border"} ${sizeClasses} ${toneClasses} ${className}`}
      >
        {startIcon ? <span className="shrink-0">{startIcon}</span> : null}
        <span className="min-w-0 flex-1 truncate">
          {selectedOption?.label ?? ""}
        </span>
        <ChevronDown
          className={`shrink-0 transition-transform duration-150 ${iconClasses} ${
            open ? "rotate-180 text-[#0066CC]" : "text-[#6B829D]"
          }`}
          aria-hidden="true"
        />
      </button>

      {open && coords && canPortal
        ? createPortal(
            <div
              ref={menuRef}
              id={listboxId}
              data-ui-select-menu="true"
              role="listbox"
              aria-label={ariaLabel}
              style={{
                position: "fixed",
                ...(coords.top !== undefined
                  ? { top: coords.top }
                  : { bottom: coords.bottom }),
                left: coords.left,
                width: coords.width,
              }}
              className="z-[160] overflow-hidden rounded-2xl border border-[#D7E4F2] bg-white p-1.5 shadow-[0_18px_40px_-10px_rgba(15,36,62,0.18)]"
            >
              <div
                style={{ maxHeight: coords.maxHeight }}
                className="space-y-0.5 overflow-y-auto overscroll-contain"
              >
                {options.map((opt, idx) => {
                  const isSelected = opt.value === currentValue;
                  const isHighlighted = idx === highlightedIndex;
                  const prevGroup = idx > 0 ? options[idx - 1]?.group : undefined;
                  const showGroupHeader =
                    opt.group && opt.group !== prevGroup;

                  const itemClasses = isSelected
                    ? tone === "amber"
                      ? "bg-amber-50 font-semibold text-amber-950"
                      : "bg-[#EBF4FF] font-semibold text-[#0052A3]"
                    : isHighlighted
                      ? "bg-[#F3F8FD] text-[#0F243E]"
                      : "text-[#4A627D] hover:bg-[#F3F8FD] hover:text-[#0F243E]";

                  return (
                    <Fragment key={`${opt.value}-${idx}`}>
                      {showGroupHeader ? (
                        <div className="px-2.5 pt-2 pb-1 text-[11px] font-semibold text-[#6B829D]">
                          {opt.group}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        role="option"
                        data-option-index={idx}
                        aria-selected={isSelected}
                        disabled={opt.disabled}
                        onMouseEnter={() => {
                          if (!opt.disabled) setHighlightedIndex(idx);
                        }}
                        onClick={() => {
                          if (!opt.disabled) commitValue(opt.value);
                        }}
                        className={`flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl px-2.5 text-start leading-snug transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          selectSize === "sm" ? "py-1.5 text-xs" : "py-2 text-sm"
                        } ${itemClasses}`}
                      >
                        <span className="min-w-0 flex-1 break-words">
                          {opt.label}
                        </span>
                        {isSelected ? (
                          <Check
                            className={`h-3.5 w-3.5 shrink-0 ${
                              tone === "amber"
                                ? "text-amber-700"
                                : "text-[#0066CC]"
                            }`}
                            aria-hidden="true"
                          />
                        ) : null}
                      </button>
                    </Fragment>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

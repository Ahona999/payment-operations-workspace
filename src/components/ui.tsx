import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

export function Icon({ name, size = 16, height = size }: { name: string; size?: number; height?: number }) {
  return <img className="figma-icon" src={`/figma/${name}.svg`} alt="" style={{ width: size, height }} />
}

export function Button({ variant = 'outline', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'outline' | 'primary' }) {
  return <button type="button" className={`button button-${variant} ${className}`} {...props} />
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'green' | 'amber' | 'red'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Filter({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <label className="filter"><span className="sr-only">{label}</span>
    <Select value={value} onChange={event => onChange(event.target.value)}>
      <option value="">{label}</option>
      {options.map(option => <option key={option}>{option}</option>)}
    </Select>
    <Icon name="FilterDropdown" size={10} />
  </label>
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`design-select ${className}`} {...props} />
}

export function ControlPopover({ label, onDismiss, children }: { label: string; onDismiss: () => void; children: ReactNode }) {
  const popover = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !popover.current?.parentElement?.contains(event.target)) onDismiss()
    }
    document.addEventListener('pointerdown', dismissOutside)
    return () => document.removeEventListener('pointerdown', dismissOutside)
  }, [onDismiss])
  function closeAndRestoreFocus() {
    popover.current?.parentElement?.querySelector('button')?.focus()
    onDismiss()
  }
  return <div ref={popover} className="case-popover" role="group" aria-label={label} onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); closeAndRestoreFocus() }
  }}>
    {children}
    <Button onClick={closeAndRestoreFocus}>Done</Button>
  </div>
}

export function Search({ label, accessibleLabel = label, value, onChange, inputRef, children, icon = 'SearchIcon' }: { label: string; accessibleLabel?: string; value: string; onChange: (value: string) => void; inputRef?: React.Ref<HTMLInputElement>; children?: ReactNode; icon?: string }) {
  return <label className="search">
    <Icon name={icon} size={icon === 'Search' ? 14 : 16} />
    <input ref={inputRef} type="search" aria-label={accessibleLabel} placeholder={label} value={value} onChange={event => onChange(event.target.value)} />
    {children}
  </label>
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const element = dialog.current
    const trigger = document.activeElement
    element?.showModal()
    return () => {
      if (element?.open) element.close()
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [])
  return <dialog ref={dialog} onClose={onClose} aria-labelledby={titleId} className="modal">
    <div className="flex items-center justify-between gap-6"><h2 id={titleId}>{title}</h2><Button onClick={onClose}>Close</Button></div>
    {children}
  </dialog>
}

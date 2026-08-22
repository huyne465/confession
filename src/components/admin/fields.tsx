'use client';

import { useId, useState } from 'react';
import { uploadImage } from '@/lib/admin';

type BaseProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
};

const inputClass =
  'w-full rounded-frame border border-hairline bg-surface-lowest px-3 py-2 text-base text-ink placeholder:text-ink-faint focus:border-gold-deep focus:outline-none';

export function TextField({ label, value, onChange, hint, placeholder }: BaseProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm text-ink-soft">
        {label}
      </label>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
      {hint ? <p className="text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}

export function TextArea({ label, value, onChange, hint, rows = 4 }: BaseProps & { rows?: number }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm text-ink-soft">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} resize-y leading-[1.6]`}
      />
      {hint ? <p className="text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: BaseProps & { options: Array<{ value: string; label: string }> }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm text-ink-soft">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Text input for the URL plus a direct upload that fills it in. */
export function ImageField({ label, value, onChange }: BaseProps) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadImage(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Tải ảnh thất bại');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm text-ink-soft">
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          value={value}
          placeholder="https://... hoặc /static/..."
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
        <label className="shrink-0 cursor-pointer rounded-frame border border-gold px-4 py-2 text-center text-sm tracking-[0.12em] text-gold-deep uppercase transition-colors hover:bg-gold/10">
          {busy ? 'Đang tải...' : 'Chọn ảnh'}
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={busy}
            onChange={(event) => void onPick(event)}
          />
        </label>
      </div>
      {error ? <p className="text-xs text-burgundy-tint">{error}</p> : null}
      {value ? (
        // Preview only. Plain img keeps arbitrary hosts out of next/image config.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className="h-28 w-auto border border-hairline object-cover"
        />
      ) : null}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const styles = {
    primary: 'bg-burgundy text-gold-pale hover:bg-burgundy-deep',
    ghost: 'border border-gold text-gold-deep hover:bg-gold/10',
    danger: 'border border-burgundy-tint text-burgundy-tint hover:bg-burgundy-tint/10',
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-frame px-5 py-2.5 text-sm font-semibold tracking-[0.14em] uppercase transition-all duration-300 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 ${styles}`}
    >
      {children}
    </button>
  );
}

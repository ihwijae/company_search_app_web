import React from 'react';

export default function DocumentField({ label, suffix, wide = false, hint, children }) {
  return (
    <label className={`document-field${wide ? ' document-field--wide' : ''}`}>
      <span className="document-field__label">{label}</span>
      <span className={`document-field__control${suffix ? ' has-suffix' : ''}`}>
        {children}
        {suffix && <span className="document-field__suffix">{suffix}</span>}
      </span>
      {hint && <span className="document-field__hint">{hint}</span>}
    </label>
  );
}

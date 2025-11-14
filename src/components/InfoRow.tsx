// src/components/InfoRow.tsx
import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

type Props = {
  /** Label text or TeX (e.g., 'r_vir' or 'Virial Radius') */
  label?: string;
  /** Value to display (number or string) */
  value: number | string | React.ReactNode;
  /** Unit text or TeX (e.g., 'M_\\odot', '\\mathrm{kpc}') */
  unit?: string;
  /** Optional explicit TeX for label; overrides `label` */
  labelLatex?: string;
  /** Optional explicit TeX for value; overrides automatic formatting */
  valueLatex?: string;
  /** If true, do not interpret value as TeX; display literally */
  noLatex?: boolean;
};

/** Render a KaTeX expression into HTML */
function renderLatex(expr: string) {
  return {
    __html: katex.renderToString(expr, {
      throwOnError: false,
      displayMode: false,
      strict: 'ignore',
    }),
  };
}

/** If the string has TeX control sequences, assume it's TeX; otherwise wrap in \text{} */
function asTexOrText(s: string) {
  return /\\[a-zA-Z]+/.test(s) ? s : `\\text{${s}}`;
}

export default function InfoRow({ label, value, unit, labelLatex, valueLatex, noLatex }: Props) {
  const labelExpr = labelLatex ?? asTexOrText(String(label));

  let valueExpr: string;
  if (noLatex) {
    valueExpr = String(value);
  } else {
    if (valueLatex) {
      valueExpr = valueLatex;
    } else {
      let vStr = '';
      if (typeof value === 'number') {
        // Split into mantissa and exponent for better rendering
        const exp = Math.floor(Math.log10(Math.abs(value)));
        const mantissa = value / Math.pow(10, exp);
        if (exp >= 3 || exp <= -3) {
          vStr = `${mantissa.toFixed(2)} \\times 10^{${exp}}`;
        } else {
          vStr = value.toFixed(2);
        }
      } else {
        vStr = String(value ?? '');
      }
      const unitExpr = unit ? (/\\[a-zA-Z]+/.test(unit) ? unit : `\\mathrm{${unit}}`) : '';
      valueExpr = unitExpr ? `${vStr}\\,${unitExpr}` : vStr;
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
      <span dangerouslySetInnerHTML={renderLatex(labelExpr)} />
      <span dangerouslySetInnerHTML={noLatex ? { __html: valueExpr } : renderLatex(valueExpr)} />
    </div>
  );
}

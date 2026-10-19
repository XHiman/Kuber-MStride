import { useMemo, useState } from 'react';
import { AsOf, Money } from '../../components/Money';
import { useAppSettings } from '../../lib/appSettings';
import { fmtShort, pct } from '../../lib/format';
import { plural } from '../../lib/status';
import { groupBills, type GroupBy, type VendorGroup } from '../../lib/vendors';
import type { Bill } from '../../types';
import { EmptyState, billAmount } from './shared';

const SEGMENTS = [
  { key: 'cleared', label: 'Cleared', className: 'seg-cleared' },
  { key: 'in_progress', label: 'In progress', className: 'seg-progress' },
  { key: 'on_hold', label: 'On hold / exception', className: 'seg-hold' },
] as const;

/** Round up to a 1 / 2 / 2.5 / 5 × 10ⁿ step so the axis ticks are readable. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find(s => s * magnitude >= value) ?? 10;
  return step * magnitude;
}

type Hover = { label: string; value: number; share: number; x: number; y: number } | null;

/** Sorted horizontal stacked bars by vendor or DSU, axis from zero, with a table alternative. */
export default function VendorChart({ bills, asOf }: { bills: Bill[]; asOf: Date | null }) {
  const { t } = useAppSettings();
  const [groupBy, setGroupBy] = useState<GroupBy>('vendor');
  const [asTable, setAsTable] = useState(false);
  const [hover, setHover] = useState<Hover>(null);

  const groups = useMemo(
    () => groupBills(bills.map(b => ({ vendor: b.vendor, cat: b.cat, amount: billAmount(b) })), groupBy),
    [bills, groupBy],
  );
  const max = niceMax(Math.max(0, ...groups.map(g => g.total)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => f * max);
  // Long include lists (the non-DSU group) are summarised in the visible text; the tooltip keeps the full list.
  const includes = (g: VendorGroup) => (g.rawNames.length > 4 ? `${g.rawNames.length} ${t('vendors')}` : g.rawNames.join(' · '));
  const merged = (g: VendorGroup) => g.rawNames.length > 1 || (g.rawNames[0] !== undefined && g.rawNames[0] !== g.name);

  return (
    <div className="panel vendor-chart-panel">
      <div className="panel-head">
        <h2>{t(groupBy === 'dsu' ? 'By DSU' : 'By vendor')}</h2>
        <span className="note">{t('₹ value, split by clearance status')} · <AsOf at={asOf} /></span>
      </div>

      <div className="chart-controls">
        <div className="segmented" role="group" aria-label={t('Group bills by')}>
          {(['vendor', 'dsu'] as const).map(option => (
            <button key={option} type="button" aria-pressed={groupBy === option} className={groupBy === option ? 'is-selected' : ''} onClick={() => setGroupBy(option)}>
              {t(option === 'dsu' ? 'By DSU' : 'By vendor')}
            </button>
          ))}
        </div>
        <button type="button" className="link-btn" aria-pressed={asTable} onClick={() => setAsTable(value => !value)}>
          {t(asTable ? 'Show as chart' : 'Show as table')}
        </button>
      </div>

      {!asTable && (
        <div className="legend-inline" aria-hidden="true">
          {SEGMENTS.map(s => <span key={s.key}><i className={s.className} />{t(s.label)}</span>)}
        </div>
      )}

      {groups.length === 0 && <EmptyState title={t('No bill activity yet')} detail={t('Vendor summaries will appear here when bills are entered.')} />}

      {groups.length > 0 && asTable && (
        <div className="table-scroll">
          <table className="vendor-table">
            <caption className="sr-only">{t(groupBy === 'dsu' ? 'Bill value by DSU' : 'Bill value by vendor')}</caption>
            <thead>
              <tr>
                <th scope="col">{t(groupBy === 'dsu' ? 'DSU' : 'Vendor')}</th>
                <th scope="col" className="num">{t('Bills')}</th>
                <th scope="col" className="num">{t('Total')}</th>
                {SEGMENTS.map(s => <th key={s.key} scope="col" className="num">{t(s.label)}</th>)}
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <tr key={g.name}>
                  <th scope="row" className="vendor-cell">{g.name}{merged(g) && <small className="raw-names" title={g.rawNames.join(', ')}>{t('Includes')}: {includes(g)}</small>}</th>
                  <td className="num mono">{g.count}</td>
                  <td className="num mono"><Money value={g.total} /></td>
                  {SEGMENTS.map(s => <td key={s.key} className="num mono"><Money value={g[s.key]} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {groups.length > 0 && !asTable && (
        <figure className="hbar-chart">
          <figcaption className="sr-only">
            {t(groupBy === 'dsu' ? 'Bill value by DSU' : 'Bill value by vendor')}, {t('largest first')}. {t('Use “Show as table” for exact figures.')}
          </figcaption>
          <div className="hbar-axis" aria-hidden="true">
            {ticks.map(tick => <span key={tick} style={{ left: `${(tick / max) * 100}%` }}>{fmtShort(tick)}</span>)}
          </div>
          <ol className="hbar-list">
            {groups.map(g => (
              <li key={g.name} className="hbar-row">
                <div className="hbar-label" title={merged(g) ? `${t('Includes')}: ${g.rawNames.join(', ')}` : undefined}>
                  <span className="hbar-name">{g.name}</span>
                  {merged(g) && <span className="hbar-merged" aria-hidden="true">ⓘ</span>}
                  <span className="hbar-value mono" aria-hidden="true"><Money value={g.total} /> · {g.count} {t(plural(g.count, 'bill'))}</span>
                </div>
                <div className="hbar-plot">
                  <div className="hbar-grid" aria-hidden="true">
                    {ticks.slice(1).map(tick => <span key={tick} style={{ left: `${(tick / max) * 100}%` }} />)}
                  </div>
                  <div className="hbar-bar" style={{ width: `${(g.total / max) * 100}%` }} aria-hidden="true">
                    {SEGMENTS.filter(s => g[s.key] > 0).map(s => (
                      <span
                        key={s.key}
                        className={s.className}
                        style={{ flexGrow: g[s.key] }}
                        onMouseMove={event => setHover({ label: `${g.name} · ${t(s.label)}`, value: g[s.key], share: pct(g[s.key], g.total), x: event.clientX, y: event.clientY })}
                        onMouseLeave={() => setHover(null)}
                      />
                    ))}
                  </div>
                </div>
                <span className="sr-only">
                  {g.name}: {fmtShort(g.total)}, {g.count} {t(plural(g.count, 'bill'))}.{' '}
                  {SEGMENTS.map(s => `${t(s.label)} ${fmtShort(g[s.key])}`).join(', ')}.
                  {merged(g) && ` ${t('Includes')}: ${g.rawNames.join(', ')}.`}
                </span>
              </li>
            ))}
          </ol>
        </figure>
      )}

      {hover && (
        <div className="mouse-tooltip" style={{ left: hover.x + 12, top: hover.y + 12 }} role="presentation">
          <div>{hover.label}</div>
          <div>{fmtShort(hover.value)} · {hover.share}%</div>
        </div>
      )}
    </div>
  );
}

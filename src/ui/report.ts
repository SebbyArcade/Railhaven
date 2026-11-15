import type { Game } from '../state.ts';
import { capOf, GOODS, type Good, INDUSTRIES, isFactory, isLinked } from '../buildings/industries.ts';
import { orderOf, sizeName, stepOf, townLinked } from '../economy/towns.ts';
import { RLV } from '../economy/dispatch.ts';
import { shipPlan, siteOf, bldOf } from '../economy/shipping.ts';
import { reachedIslands } from '../progress/missions.ts';
import { placeName } from './mapviews.ts';
import { stuckList } from './orders.ts';

const money = (v: number) => `${v < 0 ? '-' : ''}$${Math.round(Math.abs(v)).toLocaleString('en-US')}`;

/** A plain-text report of the game to copy and paste into a chat, for balancing and bug reports. */
export function gameReport(g: Game): string {
  const s = g.s, min = s.t / 60, L = s.rlv ?? 0, o = s.orders ?? 0, plan = shipPlan(g), n = g.world.n;
  const earned = s.earned ?? 0, upkeep = s.upkeep ?? 0;
  const lines: string[] = [];
  lines.push(`RAILHAVEN GAME REPORT (rebuild) · seed ${s.seed} · ${Math.floor(min)} min played`);
  lines.push(`Money ${money(s.money)} · earned ${money(earned)} · running costs (trains and bridges) ${money(upkeep)} · average ${money(min > 0.5 ? (earned - upkeep) / min : 0)}/min`);
  lines.push(`Railway level ${L} · ${o} orders filled${RLV[L + 1] !== undefined ? ` (next level at ${RLV[L + 1]})` : ' (top level)'}`);
  const isl = reachedIslands(g);
  lines.push(`Islands reached: ${[...isl].map(j => g.world.islands[j]?.name ?? `island ${j}`).join(', ')}`);
  const fl = s.fleet ?? {};
  const idle = s.trains.filter(t => !t.job).length;
  lines.push(`Trains: ${s.trains.length} (${idle} waiting for a load) · fleet upgrades wagons ${fl.wag ?? 0}, engines ${fl.eng ?? 0}, repairs ${fl.rep ?? 0} · ships ${s.ships?.length ?? 0}`);
  lines.push(`Track: ${g.track.size} squares`);
  lines.push('');
  const towns = s.sites.filter(t => t.kind === 'town' && townLinked(g, t));
  const off = s.sites.filter(t => t.kind === 'town' && (t.pop ?? 0) > 0 && !townLinked(g, t)).length;
  lines.push(`TOWNS on the railway (${towns.length}, ${off} more found but not linked)`);
  for (const t of towns) {
    const ord = orderOf(g, t), goods = (Object.keys(ord) as Good[]).map(k => `${GOODS[k].name.toLowerCase()} ${Math.min(ord[k]!, Math.floor(t.got?.[k] ?? 0))}/${ord[k]}`).join(', ');
    lines.push(`- ${t.name ?? 'Town'}: ${sizeName(stepOf(t))}, ${Math.round(t.pop ?? 0)} people · order: ${goods || 'none'}`);
  }
  lines.push('');
  lines.push(`BUILDINGS (${s.buildings?.length ?? 0})`);
  for (const b of s.buildings ?? []) {
    const sh = plan.get(b.id), to = sh ? (sh.to.kind === 'town' ? siteOf(g, sh.to.id)?.name : bldOf(g, sh.to.id) ? INDUSTRIES[bldOf(g, sh.to.id)!.kind].name : '?') : null;
    const isl2 = g.world.islands[g.world.islandOf[b.y * n + b.x]!]?.name ?? '';
    const stock = b.kind === 'dock' ? '' : ` · stock ${Math.floor(b.stock)}/${capOf(b)}`;
    const ins = isFactory(b.kind) ? ` · inputs ${Object.entries(b.inbuf ?? {}).map(([k, v]) => `${k} ${Math.floor(v ?? 0)}`).join(', ') || 'none'}` : '';
    lines.push(`- ${placeName(g, b)} (${isl2}) level ${b.lvl}${isLinked(g, b) ? '' : ' · NOT ON THE RAILWAY'}${stock}${ins}${to ? ` · sends to ${to}` : b.kind === 'dock' ? '' : ' · sends nowhere now'}`);
  }
  const st = stuckList(g, plan);
  lines.push('');
  lines.push(`NEEDS YOU (${st.length})`);
  for (const x of st) lines.push(`- ${x.icon} ${x.text.replace(/<[^>]+>/g, '').replace(/&#(\d+);/g, (_, c) => String.fromCharCode(+c))}`);
  return lines.join('\n');
}

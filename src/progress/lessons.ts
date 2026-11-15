import type { Game } from '../state.ts';
import { isFactory, isLinked } from '../buildings/industries.ts';
import { townLinked } from '../economy/towns.ts';

/**
 * Mira's guided lessons: nine first steps for a new game (the old game's v135-v145 lessons, in the rebuild's own
 * controls). One lesson at a time, shown in the bar under the money; a gold ring and a pointing hand show the exact
 * button or square to tap. Missions start once the lessons are done or skipped.
 */
export interface Lesson { icon: string; title: string; mira: string; text: string; done: (g: Game) => boolean; /** a step that has to come first, in plain words ('' when there is none) */ wait?: (g: Game) => string }

/** The lesson's instruction right now. */
export const lessonText = (g: Game, L: Lesson) => L.wait?.(g) || L.text;

const blds = (g: Game) => g.s.buildings ?? [];
const has = (g: Game, k: string, linked = false) => blds(g).some(b => b.kind === k && (!linked || isLinked(g, b)));

export const LESSONS: Lesson[] = [
  { icon: '🪵', title: 'Your first industry', mira: '“Every railway starts with something to carry. The forest by Ashford will do.”',
    text: 'Ashford wants wood. Tap 🏗 Build, choose 🪵 Lumber Camp, then ✓ Build on the glowing spot by the forest.', done: g => has(g, 'wood') },
  { icon: '🛤', title: 'Lay the track', mira: '“A camp nobody can reach is just a pile of logs. Join it to the line.”',
    text: 'Tap 🛤 Rails and drag from Ashford to the ringed square at one end of the camp, then on onto its blue loading track (yards join only at their ends). Tap ✓ Build.', done: g => has(g, 'wood', true) },
  { icon: '🚂', title: 'Your first train', mira: '“Buy an engine and leave the rest to it. Trains take goods to whoever needs them.”',
    text: 'Tap 🚂 Train, then ✓ Buy. It rolls out of the engine shed and carries the wood to Ashford by itself.', done: g => g.s.trains.length > 0,
    wait: g => g.s.shed ? '' : 'First the engine shed needs a home: it stands beside a plain straight stretch of line near Ashford. Tap 🛤 Rails and run a few straight squares of track off your line (no curves), then ✓ Build.' },
  { icon: '🌾', title: 'Bread for Ashford', mira: '“People can’t eat timber. Ashford needs wheat too.”',
    text: 'Build a 🌾 Wheat Farm on open grass, then join it to your track with 🛤 Rails. Its wheat goes to Ashford by itself.', done: g => has(g, 'farm', true) },
  { icon: '📋', title: 'Ashford’s first order', mira: '“When a town gets everything on its order, it grows. That is how we rebuild.”',
    text: 'Tap Ashford to watch its order fill. A filled order pays a reward and counts toward your Railway level; then tap ⬆ Grow.', done: g => (g.s.orders ?? 0) >= 1 },
  { icon: '🏘', title: 'A second town', mira: '“There are other towns out there. Each one we link asks for something new.”',
    text: 'Lay track into another town’s station. No town in sight? Tap 🔭 Scout, tap Ashford and draw a route into the fog.',
    done: g => (g.s.rlv ?? 0) >= 1 || g.s.sites.some((t, i) => i > 0 && t.kind === 'town' && townLinked(g, t)) },
  { icon: '⭐', title: 'Railway level 1', mira: '“Every order we fill makes the railway bigger. One more, and we can build factories.”',
    text: 'Fill one more order to reach Railway level 1 and unlock factories. Each town’s card shows what it still needs and where it comes from.', done: g => (g.s.rlv ?? 0) >= 1 },
  { icon: '🏭', title: 'Your first factory', mira: '“Bigger towns want planks, not logs. A Sawmill turns one into the other.”',
    text: 'Tap 🏗 Build → 🪚 Sawmill and put it beside your track, near your Lumber Camp.', done: g => blds(g).some(b => isFactory(b.kind)) },
  { icon: '⚙', title: 'Feeding the mill', mira: '“Wood in, planks out. Your trains sort out the rest.”',
    text: 'Join the Sawmill to your track if it isn’t yet. Trains bring it wood and take its planks to towns that want them. If every train is busy, buy another.',
    done: g => blds(g).some(b => isFactory(b.kind) && isLinked(g, b) && (Object.values(b.inbuf ?? {}).some(v => (v ?? 0) > 0) || b.stock > 0)) },
];

/** Lessons are on while g.s.tut is below the number of lessons (new games start at 0; older games and the bot have none). */
export const lessonOn = (g: Game) => g.s.tut !== undefined && g.s.tut < LESSONS.length;

/** Move on past every lesson already done (checked once a second). Returns true when a lesson was finished. */
export function tickLessons(g: Game): boolean {
  if (!lessonOn(g)) return false;
  let moved = false;
  while (lessonOn(g) && LESSONS[g.s.tut!]!.done(g)) { g.s.tut!++; moved = true; }
  if (moved) {
    g.s.lesAt = g.s.t;
    if (!lessonOn(g)) (g.news ??= []).push('🎓 Lessons done! Mira has missions for you now: they are under the top bar'); // a next lesson says so in its own bar
  }
  return moved;
}

export function skipLessons(g: Game) { g.s.tut = LESSONS.length; }

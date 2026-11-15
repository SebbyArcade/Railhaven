/** The 🗺 Game card: start a new map, or bring a game over from the old Railhaven (its save file, a pasted code, or this browser's old save). */
export function gameHtml(page: string | undefined, hasOld: boolean, report: string[] | null, code: string | null = null): string {
  const back = `<button class="act back" data-act="page" data-page="">‹ Back</button>`;
  if (page === 'report' && report) {
    return `<div class="head"><b class="big">🚂</b><div><h2>Your game is here</h2><span class="chip2">from the old Railhaven</span></div></div>`
      + report.map(r => `<div class="row"><div class="grow">${r}</div></div>`).join('')
      + `<div class="note">Buildings stand as close as they fit to where they were: each has a 2×4 yard now. Anything that couldn't be placed was paid back, so you can build it again.</div>`
      + `<button class="act" data-act="close">🚂 Let's go</button>`;
  }
  if (page === 'move') {
    return `<div class="head"><b class="big">📤</b><div><h2>Move my game</h2><span class="chip2">Chrome and the Claude app each keep their own game</span></div></div>`
      + `<div class="tiles"><button class="tile" data-act="copycode">📋 Copy my code<small>then paste it on the other side</small></button><button class="tile" data-act="savefile">💾 Save to a file<small>railhaven-save.txt</small></button></div>`
      + (code ? `<textarea id="myCode" rows="3" readonly style="width:100%;box-sizing:border-box;border-radius:10px;background:#15110c;color:#f3e6c8;border:1px solid #8a6a3e;padding:6px;font-size:11px">${code}</textarea><div class="note">If copying didn't work, press on the code, Select all, then Copy.</div>` : '')
      + `<div class="note">On the other side: 🗺 Game → 📋 Paste a code, or 📂 Load a save file.</div>` + back;
  }
  if (page === 'paste') {
    return `<div class="head"><b class="big">📋</b><div><h2>Paste a save code</h2><span class="chip2">a code from 📤 Move my game, here or in the old game</span></div></div>`
      + `<textarea id="pasteCode" rows="4" placeholder="RAILHAVEN3:… or RAILHAVEN2:…" style="width:100%;box-sizing:border-box;border-radius:10px;background:#15110c;color:#f3e6c8;border:1px solid #8a6a3e;padding:6px;font-size:12px"></textarea>`
      + `<button class="act" data-act="loadpaste">📥 Load this game</button>` + back;
  }
  return `<div class="head"><b class="big">🗺</b><div><h2>Game</h2><span class="chip2">your game saves by itself</span></div></div>`
    + (hasOld ? `<div class="gift">🚂 This browser has a game from the old Railhaven. <button class="act" data-act="loadold">📥 Bring it over</button></div>` : '')
    + `<div class="tiles"><button class="tile" data-act="page" data-page="move">📤 Move my game<small>to Chrome or the Claude app</small></button><button class="tile" data-act="loadfile">📂 Load a save file<small>from here or the old game</small></button><button class="tile" data-act="page" data-page="paste">📋 Paste a code<small>from here or the old game</small></button></div>`
    + `<div class="note">Loading a game replaces the one you are playing now.</div>`
    + `<button class="act warnb" data-act="newmap">🗺 Start a new map</button>`;
}

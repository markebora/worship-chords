(function(){
'use strict';

/*
  WORSHIP CHORDS — TRANSPOSE ENGINE
  ---------------------------------
  This file is intentionally isolated from the rest of the app.

  A chord is treated as:
    ROOT + QUALITY/EXTENSIONS + optional /BASS

  Examples:
    CM7       -> root C, quality M7
    Bm7       -> root B, quality m7
    E7sus     -> root E, quality 7sus
    D/C       -> root D, bass C
    B/Eb      -> root B, bass Eb
    E/G#      -> root E, bass G#
    Fdim      -> root F, quality dim

  The quality/extension is NEVER modified. Only musical note names
  (root and optional slash bass) are transposed.
*/

const CHORD_BANK = {
  roots: {
    C:0,
    'C#':1, Db:1,
    D:2,
    'D#':3, Eb:3,
    E:4,
    F:5,
    'F#':6, Gb:6,
    G:7,
    'G#':8, Ab:8,
    A:9,
    'A#':10, Bb:10,
    B:11
  },

  /* Consistent display spelling used throughout Worship Chords. */
  display: [
    'C','C#','D','Eb','E','F',
    'F#','G','Ab','A','Bb','B'
  ]
};

function cbNormalize(value){
  return String(value == null ? '' : value)
    .replace(/♯/g,'#')
    .replace(/♭/g,'b')
    .replace(/[–—]/g,'-')
    .trim();
}

function cbPitch(note){
  const n = cbNormalize(note);
  return Object.prototype.hasOwnProperty.call(CHORD_BANK.roots,n)
    ? CHORD_BANK.roots[n]
    : null;
}

function cbDisplay(value){
  return CHORD_BANK.display[((Number(value) % 12) + 12) % 12];
}

/*
  Parse exactly one chord token.

  We deliberately do NOT try to interpret the quality. This means
  uncommon but valid chord spellings remain intact:

    CM7      -> DM7
    Cmaj7    -> Dmaj7
    Cadd9    -> Dadd9
    C7sus4   -> D7sus4
    Cdim     -> Ddim
    Caug     -> Daug
    Cno3     -> Dno3
    C/G      -> D/A
    C7/G     -> D7/A

  Only a slash followed by a note name is considered a bass note.
*/
function cbTransposeToken(token, interval){
  const original = String(token == null ? '' : token);
  const text = cbNormalize(original);

  if(!text) return original;

  const match = text.match(/^([A-Ga-g](?:#|b)?)(.*)$/);
  if(!match) return original;

  const root = match[1];
  const suffix = match[2];
  const rootPitch = cbPitch(root);

  if(rootPitch === null) return original;

  const newRoot = cbDisplay(rootPitch + interval);

  /*
    Transpose only slash-bass note names.
    This catches /C, /C#, /Db, /F#, /G#, etc. while leaving
    ordinary quality text untouched.
  */
  const newSuffix = suffix.replace(
    /\/([A-Ga-g](?:#|b)?)/g,
    function(full, bass){
      const bassPitch = cbPitch(bass);
      return bassPitch === null
        ? full
        : '/' + cbDisplay(bassPitch + interval);
    }
  );

  return newRoot + newSuffix;
}

/*
  Public API used by the app.

  A chord field may contain several chords separated by whitespace:
    "CM7 D/C Bm7 Em"

  We preserve the original whitespace exactly.
*/
window.transposeChord = function(chord, interval){
  if(chord == null) return chord;

  const amount = Number(interval);
  if(!Number.isFinite(amount)) return chord;

  return String(chord)
    .split(/(\s+)/)
    .map(function(part){
      return /^\s+$/.test(part)
        ? part
        : cbTransposeToken(part, amount);
    })
    .join('');
};

window.CHORD_BANK = CHORD_BANK;
window.transposeChordToken = cbTransposeToken;

})();

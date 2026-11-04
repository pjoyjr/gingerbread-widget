GINGERBREAD WIDGET v2.2 — DANCE + DUEL ARENA
============================================

NEW COMMANDS
!dance           Your gingerbread does a 3-second dance/wiggle using the existing animation.
                 Per-user cooldown: 5 seconds (editable).
!duel @Username  Challenge another active gingerbread to a duel (instant start; no acceptance).
                 The other gingerbreads move toward the left and right screen edges,
                 cheer/watch, and cannot be hit during the event.
                 The two duelists move toward the middle and face each other.
                 A 3-2-1 countdown is shown. Both animate a snowball throw.
                 One winner is selected by a fair 50/50 random draw.
                 Only the winner's snowball connects. The loser flops over,
                 the winner gets a victory dance and a WINNER banner.
                 The loser DOES NOT despawn; everyone goes back to wandering.
                 Global duel cooldown: 25 seconds after a duel STARTS (editable).

EXISTING COMMANDS, STILL INCLUDED
!gb               Spawn your gingerbread character
!throw            Throw a regular snowball at another gingerbread
!throw @Username  Face a specific character and throw
!dodge            1.6-second Matrix lean, temporarily avoids snowball hits (8s cooldown)
!cleargb          Mod/broadcaster: clear all characters (also cancels a duel)
!cleargb @Username Mod/broadcaster: clear one character (cancels a duel if a duelist)

RULES
- The duelist and target must both have a visible, active gingerbread character.
- They cannot be the same character. The initiator must have duel permission.
- The target is automatically enrolled (this version has no accept/decline step).
- By default, dance/duel permissions match your throw permissions:
  Subscribers, VIPs, moderators and broadcaster; not regular viewers or YouTube members.
- Spawning, throwing, dodging and dancing are temporarily paused during a duel.
  Authorized !cleargb commands still work to interrupt the arena.
- Characters retain their ordinary lifetimes and all your pre-existing settings.
- When few characters exist, the duel works with just two, without spectators.
- Characters already being hit or throwing cannot start a duel until they are ready.
- Random winner is chosen with Math.random(), 50% per player, and is not based on
  subscription tier, character color, or other viewer status.
- The duel animation reuses the existing sprite sheets; no new assets needed.

INSTALL IN STREAMELEMENTS
1. BACK UP your current custom widget's JS, CSS and FIELDS.
2. Open the overlay Custom Widget editor.
3. Paste the entire contents of some.js into the JS tab.
4. Paste the entire contents of some.css into the CSS tab.
5. Paste the entire contents of some.json into the FIELDS tab.
6. Save, refresh the overlay, then check the widget's settings.
7. Verify command names, permissions, dance and duel cooldowns.
8. Try the test buttons: Spawn, Throw, Dodge, Dance, Duel and Clear.

IMPORTANT: some.json defines the field controls, and current-settings.json
contains the configured values used by the LOCAL test preview. Do not paste
current-settings.json in the FIELDS tab. Existing saved widget settings in
StreamElements can override defaults in the new FIELDS definition.

TEST LOCALLY WITHOUT GOING LIVE
1. Extract this ZIP to a folder.
2. Open a terminal in the folder.
3. Run: python -m http.server 8000
   Windows: py -m http.server 8000
4. In Chrome/Edge open: http://localhost:8000/test.html
5. Click "Demo" to spawn a crowd and see the duel, or use the test buttons.
6. To test a real chat command: select Subscriber, enter CookieFan as username,
   click !gb; repeat with Frosty; as CookieFan send !duel @Frosty.
7. The local preview simulates StreamElements events; it is NOT a live chat connection.
8. If StreamElements sprite image downloads fail, the LOCAL preview shows cookie
   emoji placeholders so movement/gameplay can still be tested. The deployed
   widget still requires its remote sprite sheets to display actual characters.

OPTIONAL TESTS
- node logic-test.js         (original dodge behavior regression tests)
- node duel-logic-test.js    (dance, RNG, spectators, duel, cleanup, permissions)
- browser-check.py          (author's browser interaction test using Playwright)

FILES
some.js, some.css, some.json   StreamElements files
current-settings.json        Your uploaded settings plus new dance/duel values
README.txt                   This guide
test.html                    Local preview with test buttons & chat simulator
logic-test.js                Dodge regression test
duel-logic-test.js           Duel/dance logic regression test
arena-preview.png, winner-preview.png   Offline-fallback sample screenshots

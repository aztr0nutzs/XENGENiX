# Controls Map

This map lists all interactive controls, their `data-action` values, handlers, and expected state changes.

## Lobby

| Screen | Element selector | data-action | Handler function | Expected state change |
| --- | --- | --- | --- | --- |
| Lobby | `button[data-action="lobby-start-sequencer"]` | `lobby-start-sequencer` | `startNewRun` | Starts a new Sequencer run and enters Game screen. |
| Lobby | `button[data-action="lobby-open-slot"]` | `lobby-open-slot` | `openScreen("slot")` | Routes to Slot Machine screen. |
| Lobby | `button[data-action="lobby-open-knct4"]` | `lobby-open-knct4` | `openScreen("knct4")` | Routes to Connect-4 screen. |
| Lobby | `button[data-action="lobby-start-run"]` | `lobby-start-run` | `startNewRun` | Starts a new Sequencer run. |
| Lobby | `button[data-action="lobby-open-store"]` | `lobby-open-store` | `openScreen("store")` | Routes to Store screen. |
| Lobby | `button[data-action="lobby-open-settings"]` | `lobby-open-settings` | `openScreen("settings")` | Routes to Settings screen. |
| Lobby | `button[data-action="mp-create-knct4"]` | `mp-create-knct4` | `createRoom("knct4")` | Creates a Connect-4 room. |
| Lobby | `button[data-action="mp-join-knct4"]` | `mp-join-knct4` | `openJoinModal("knct4")` | Opens join modal for Connect-4. |
| Lobby | `button[data-action="mp-create-race"]` | `mp-create-race` | `createRoom("race")` | Creates a Sequencer race room. |
| Lobby | `button[data-action="mp-join-race"]` | `mp-join-race` | `openJoinModal("race")` | Opens join modal for Sequencer race. |
| Lobby | `button[data-action="mp-copy-code"]` | `mp-copy-code` | `copyRoomCode` | Copies active room code. |
| Lobby | `button[data-action="mp-leave-room"]` | `mp-leave-room` | `leaveRoom("manual")` | Leaves multiplayer room. |

## Slot Machine

| Screen | Element selector | data-action | Handler function | Expected state change |
| --- | --- | --- | --- | --- |
| Slot | `button[data-action="slot-spin"]` | `slot-spin` | `startSlotSpin` | Deducts bet, spins reels, evaluates wins, updates credits. |
| Slot | `button[data-action="slot-bet-down"]` | `slot-bet-down` | `updateSlotBet` | Decreases bet-per-line (min 1). |
| Slot | `button[data-action="slot-bet-up"]` | `slot-bet-up` | `updateSlotBet` | Increases bet-per-line (max 10). |
| Slot | `button[data-action="slot-bet-max"]` | `slot-bet-max` | `updateSlotBet` | Sets bet-per-line to max. |
| Slot | `button[data-action="slot-toggle-rules"]` | `slot-toggle-rules` | `setSlotRulesOpen` | Shows/hides rules/payouts panel. |
| Slot | `button[data-action="slot-toggle-lite"]` | `slot-toggle-lite` | `setSlotLiteMode` | Toggles lite effects mode. |
| Slot | `button[data-action="slot-back-lobby"]` | `slot-back-lobby` | `openScreen("lobby")` | Routes back to Lobby. |
| Slot | `button[data-action="slot-ack-last"]` | `slot-ack-last` | `markSlotSeen` | Marks last spin as seen and hides recovery modal. |

## Existing Modes + Global

| Screen | Element selector | data-action | Handler function | Expected state change |
| --- | --- | --- | --- | --- |
| Global Nav | `button[data-action="nav-lobby"]` | `nav-lobby` | `openScreen("lobby")` | Routes to Lobby. |
| Global Nav | `button[data-action="nav-knct4"]` | `nav-knct4` | `openScreen("knct4")` | Routes to Connect-4. |
| Global Nav | `button[data-action="nav-slot"]` | `nav-slot` | `openScreen("slot")` | Routes to Slot Machine. |
| Global Nav | `button[data-action="nav-store"]` | `nav-store` | `openScreen("store")` | Routes to Store. |
| Global Nav | `button[data-action="nav-settings"]` | `nav-settings` | `openScreen("settings")` | Routes to Settings. |
| Global Nav | `button[data-action="nav-game"]` | `nav-game` | `openScreen("game")` | Routes to Run screen (if active). |
| Settings | `div.switch-btn[data-action="settings-toggle-haptics"]` | `settings-toggle-haptics` | `persistSettings` | Toggles haptics. |
| Settings | `div.switch-btn[data-action="settings-toggle-sound"]` | `settings-toggle-sound` | `persistSettings` | Toggles sound. |
| Settings | `div.switch-btn[data-action="settings-toggle-reduced-motion"]` | `settings-toggle-reduced-motion` | `persistSettings` | Toggles reduced motion. |
| Settings | `div.switch-btn[data-action="settings-slot-lite"]` | `settings-slot-lite` | `setSlotLiteMode` | Toggles slot lite mode from Settings. |
| Settings | `button[data-action="settings-difficulty"][data-value="EASY"]` | `settings-difficulty` | `persistSettings` | Applies EASY preset. |
| Settings | `button[data-action="settings-difficulty"][data-value="STANDARD"]` | `settings-difficulty` | `persistSettings` | Applies STANDARD preset. |
| Settings | `button[data-action="settings-difficulty"][data-value="HARD"]` | `settings-difficulty` | `persistSettings` | Applies HARD preset. |
| Settings | `input[data-action="settings-max-cycles"]` | `settings-max-cycles` | `persistSettings` | Updates max cycles. |
| Settings | `input[data-action="settings-ui-intensity"]` | `settings-ui-intensity` | `persistSettings` | Updates UI intensity. |
| Settings | `button[data-action="settings-reset-progress"]` | `settings-reset-progress` | `resetProgress` | Wipes credits/upgrades. |
| Settings | `button[data-action="settings-reset-defaults"]` | `settings-reset-defaults` | `persistSettings` | Restores default settings. |
| Settings | `button[data-action="settings-back-lobby"]` | `settings-back-lobby` | `openScreen("lobby")` | Returns to Lobby. |
| Store | `button[data-action="store-buy"]` | `store-buy` | `buyItem` | Purchases upgrade and deducts credits. |
| Store | `button[data-action="store-back-lobby"]` | `store-back-lobby` | `openScreen("lobby")` | Returns to Lobby. |
| Game | `button[data-action="game-spin"]` | `game-spin` | `spinSequencer` | Spins sequencer and applies outcome. |
| Game | `button[data-action="game-bias-minus"]` | `game-bias-minus` | `useBias(-1)` | Biases the sequencer left by one sector. |
| Game | `button[data-action="game-bias-plus"]` | `game-bias-plus` | `useBias(1)` | Biases the sequencer right by one sector. |
| Game | `button[data-action="game-patch"]` | `game-patch` | `usePatch` | Arms patch for next negative event. |
| Game | `button[data-action="game-abort"]` | `game-abort` | `abortToLobby` | Aborts run and returns to Lobby. |
| Game | `button[data-action="game-abort-return"]` | `game-abort-return` | `abortToLobby` | Returns to Lobby after run end. |
| Game | `button[data-action="game-action-extract"]` | `game-action-extract` | `actionExtract` | Attempts extraction and ends run if valid. |
| Game | `button[data-action="game-action-reroute"]` | `game-action-reroute` | `actionReroute` | Consumes token and reroutes to another spin. |
| Game | `button[data-action="game-action-vent"]` | `game-action-vent` | `actionVent` | Applies vent action effects. |
| Game | `button[data-action="game-action-ghost"]` | `game-action-ghost` | `actionGhost` | Applies ghost action effects. |
| Game | `button[data-action="game-action-buffer"]` | `game-action-buffer` | `actionBuffer` | Applies buffer action effects. |
| Game | `button[data-action="game-anomaly-stability"]` | `game-anomaly-stability` | `chooseAnomaly("STABILITY")` | Resolves anomaly toward stability. |
| Game | `button[data-action="game-anomaly-stealth"]` | `game-anomaly-stealth` | `chooseAnomaly("STEALTH")` | Resolves anomaly toward stealth. |
| Game | `button[data-action="game-anomaly-purge"]` | `game-anomaly-purge` | `chooseAnomaly("PURGE")` | Resolves anomaly via purge. |
| Game | `button[data-action="game-anomaly-embrace"]` | `game-anomaly-embrace` | `chooseAnomaly("EMBRACE")` | Resolves anomaly via embrace. |
| Game | `button[data-action="game-copy-code"]` | `game-copy-code` | `copyRoomCode` | Copies race room code. |
| Game | `button[data-action="game-leave-room"]` | `game-leave-room` | `leaveRoom("manual")` | Leaves race room. |
| Connect-4 | `button[data-action="knct-drop"]` | `knct-drop` | `handleKnctDrop` | Drops chip in selected column. |
| Connect-4 | `div[data-action="knct-hover-clear"]` | `knct-hover-clear` | `setKnctHoverCol(null)` | Clears hover column highlight. |
| Connect-4 | `button[data-action="knct-reset-match"]` | `knct-reset-match` | `resetKnctMatch` | Clears board and resets match state. |
| Connect-4 | `button[data-action="knct-next-match"]` | `knct-next-match` | `startNextKnctMatch` | Advances to next match. |
| Connect-4 | `button[data-action="knct-back-lobby"]` | `knct-back-lobby` | `openScreen("lobby")` | Returns to Lobby. |
| Connect-4 | `button[data-action="knct-open-settings"]` | `knct-open-settings` | `openScreen("settings")` | Routes to Settings. |
| Connect-4 | `button[data-action="knct-chipset"]` | `knct-chipset` | `updateKnctChipSet` | Applies chip skin selection. |
| Connect-4 | `button[data-action="knct-copy-code"]` | `knct-copy-code` | `copyRoomCode` | Copies multiplayer room code. |
| Connect-4 | `button[data-action="knct-leave-room"]` | `knct-leave-room` | `leaveRoom("manual")` | Leaves multiplayer room (header). |
| Connect-4 | `button[data-action="knct-leave-room-footer"]` | `knct-leave-room-footer` | `leaveRoom("manual")` | Leaves multiplayer room (footer). |
| Connect-4 | `button[data-action="knct-reset-scores"]` | `knct-reset-scores` | `resetKnctScores` | Resets score cache. |
| Modals | `input[data-action="modal-join-input"]` | `modal-join-input` | `setMpJoinModal` | Updates join code text. |
| Modals | `button[data-action="modal-join-cancel"]` | `modal-join-cancel` | `setMpJoinModal` | Closes join modal. |
| Modals | `button[data-action="modal-join-submit"]` | `modal-join-submit` | `submitJoin` | Attempts room join. |
| Modals | `button[data-action="modal-room-full-ok"]` | `modal-room-full-ok` | `setMpStatus` | Clears room-full error. |
| Debug | `button[data-action="debug-run-tests"]` | `debug-run-tests` | `runSelfTests` | Executes in-app self tests and renders results. |
| Debug | `button[data-action="debug-scan"]` | `debug-scan` | `scanActionAudit` | Highlights missing `data-action` and handlers. |
| Debug | `button[data-action="debug-toggle"]` | `debug-toggle` | `setDebugOpen` | Opens/closes debug overlay. |
| Debug | `button[data-action="debug-run-sim"]` | `debug-run-sim` | `runSlotSimulation` | Runs 10k Monte Carlo spins and updates RTP stats. |
| Debug | `button[data-action="debug-reset-meters"]` | `debug-reset-meters` | `resetSlotMeters` | Resets jackpot meters to seed values. |
| Debug | `button[data-action="debug-run-smoke"]` | `debug-run-smoke` | `runSmokeTests` | Runs automated browser smoke suite. |
| Debug | `input[data-action="debug-set-seed"]` | `debug-set-seed` | `setSlotSeed` | Updates slot RNG seed. |
| Debug | `input[data-action="debug-set-credits"]` | `debug-set-credits` | `setSlotCreditsTo` | Sets slot credits to input value. |

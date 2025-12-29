/* global window */

(function () {
  function log(message) {
    try { console.log(message); } catch (_) {}
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function waitFor(predicate, timeoutMs, stepMs) {
    const timeout = timeoutMs || 3000;
    const step = stepMs || 50;
    let elapsed = 0;
    return new Promise((resolve, reject) => {
      const tick = () => {
        try {
          if (predicate()) return resolve(true);
        } catch (_) {}
        elapsed += step;
        if (elapsed >= timeout) return reject(new Error("timeout"));
        setTimeout(tick, step);
      };
      tick();
    });
  }

  async function runSmokeTests(XG) {
    if (!XG) return;
    const results = [];
    const add = (name, pass, detail) => results.push({ name, pass, detail });
    const action = XG.runAction;
    const snap = () => XG.getSnapshot();

    try {
      await waitFor(() => snap().screen === "lobby", 3000);
      add("Start at Lobby", true, "Screen lobby.");
    } catch (err) {
      add("Start at Lobby", false, "Screen not lobby.");
    }

    action("lobby-open-slot");
    try {
      await waitFor(() => snap().screen === "slot", 3000);
      add("Lobby → Slot", true, "Slot screen opened.");
    } catch (err) {
      add("Lobby → Slot", false, "Slot screen not opened.");
    }

    if (snap().slotCredits < 100) {
      action("debug-set-credits", { value: 1000 });
      await wait(50);
    }

    action("slot-spin");
    try {
      await waitFor(() => !snap().slotIsSpinning, 3000);
      add("Slot Spin #1 completes", true, "Spin resolved.");
    } catch (err) {
      add("Slot Spin #1 completes", false, "Spin did not resolve.");
    }

    action("slot-spin");
    try {
      await waitFor(() => !snap().slotIsSpinning, 3000);
      add("Slot Spin #2 completes", true, "Second spin resolved.");
    } catch (err) {
      add("Slot Spin #2 completes", false, "Second spin did not resolve.");
    }

    action("slot-back-lobby");
    try {
      await waitFor(() => snap().screen === "lobby", 3000);
      add("Slot → Lobby", true, "Returned to lobby.");
    } catch (err) {
      add("Slot → Lobby", false, "Did not return to lobby.");
    }

    action("lobby-open-slot");
    await waitFor(() => snap().screen === "slot", 3000);
    action("slot-bet-up");
    await wait(100);
    const betBefore = snap().slotBetPerLine;
    action("slot-reload-state");
    await wait(100);
    const betAfter = snap().slotBetPerLine;
    add("Bet persists after reload", betAfter === betBefore, `Bet before ${betBefore}, after ${betAfter}.`);

    action("debug-set-credits", { value: 1 });
    await wait(50);
    action("slot-spin");
    await wait(100);
    const lastLog = snap().slotLog[0]?.m || "";
    add("Insufficient credits blocks spin", lastLog.includes("Insufficient credits"), `Log: ${lastLog || "-"}.`);

    action("slot-back-lobby");
    await waitFor(() => snap().screen === "lobby", 3000);

    action("lobby-start-sequencer");
    try {
      await waitFor(() => snap().screen === "game", 3000);
      add("Lobby → Sequencer", true, "Game screen opened.");
    } catch (err) {
      add("Lobby → Sequencer", false, "Game screen not opened.");
    }
    action("game-abort");
    await waitFor(() => snap().screen === "lobby", 3000);
    add("Sequencer → Lobby", snap().screen === "lobby", "Returned to lobby.");

    action("lobby-open-knct4");
    await waitFor(() => snap().screen === "knct4", 3000);
    add("Lobby → Connect-4", snap().screen === "knct4", "Connect-4 opened.");
    action("knct-back-lobby");
    await waitFor(() => snap().screen === "lobby", 3000);
    add("Connect-4 → Lobby", snap().screen === "lobby", "Returned to lobby.");

    action("debug-toggle");
    await wait(100);
    action("debug-scan");
    await wait(100);
    const report = snap().debugReport;
    add("Debug scan zero unmapped", report.missingAction.length === 0, `Missing ${report.missingAction.length}.`);
    add("Debug scan zero missing handlers", report.missingHandler.length === 0, `Missing ${report.missingHandler.length}.`);

    action("debug-run-tests");
    await wait(200);
    const selfTests = snap().selfTestResults || [];
    const selfPass = selfTests.length >= 10 && selfTests.every((t) => t.pass);
    add("Self tests pass", selfPass, `Count ${selfTests.length}.`);

    XG.setSmokeResults(results);
    const passCount = results.filter((r) => r.pass).length;
    const failCount = results.length - passCount;
    log(`[SMOKE] PASS ${passCount} / FAIL ${failCount}`);
    results.forEach((r) => log(`[SMOKE] ${r.pass ? "PASS" : "FAIL"} - ${r.name}: ${r.detail}`));
  }

  window.__XG_SMOKE__ = { runSmokeTests };
})();

#!/usr/bin/env node

/**
 * Reproducible Figure 1 application-state capture.
 *
 * Prerequisites:
 *   1. Run the development server at http://127.0.0.1:4200.
 *   2. Start an isolated Chromium instance with a DevTools endpoint, e.g.
 *      Google Chrome --headless=new --remote-debugging-port=9223 about:blank
 *   3. Run: node figures/capture-figure1.mjs
 *
 * The fixtures instantiate the production controllers, notation adapter,
 * instrument registry, and presenter components. Only resource-owning ports
 * (clock, audio, pitch, and persistence) are replaced with deterministic
 * in-memory implementations. No microphone is opened and no audio is played.
 */

import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const DEVTOOLS_HTTP = process.env.ARTSIT_DEVTOOLS_HTTP
  ?? 'http://127.0.0.1:9223';
const APP_ORIGIN = process.env.ARTSIT_APP_ORIGIN
  ?? 'http://127.0.0.1:4200';
const FIGURE_DIR = dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);

class CdpClient {
  constructor(webSocketUrl) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(webSocketUrl);
  }

  async connect() {
    await new Promise((resolveConnection, rejectConnection) => {
      this.socket.addEventListener('open', resolveConnection, { once: true });
      this.socket.addEventListener(
        'error',
        () => rejectConnection(new Error('Could not open the DevTools socket')),
        { once: true }
      );
    });
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (!message.id) {
        return;
      }
      const request = this.pending.get(message.id);
      if (!request) {
        return;
      }
      this.pending.delete(message.id);
      if (message.error) {
        request.reject(new Error(message.error.message));
      } else {
        request.resolve(message.result);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolveRequest, rejectRequest) => {
      this.pending.set(id, {
        resolve: resolveRequest,
        reject: rejectRequest
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function findPageTarget() {
  const response = await fetch(`${DEVTOOLS_HTTP}/json/list`);
  if (!response.ok) {
    throw new Error(`DevTools target list returned ${response.status}`);
  }
  const targets = await response.json();
  const target = targets.find(candidate => candidate.type === 'page');
  if (!target) {
    throw new Error('No DevTools page target is available');
  }
  return target;
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    const description = result.exceptionDetails.exception?.description
      ?? result.exceptionDetails.text;
    throw new Error(description);
  }
  return result.result.value;
}

async function waitForAngular(cdp, selector, path) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const ready = await evaluate(
      cdp,
      `Boolean(
        location.pathname === ${JSON.stringify(path)}
        && document.readyState === 'complete'
        && globalThis.ng
        && document.querySelector(${JSON.stringify(selector)})
      )`
    );
    if (ready) {
      return;
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Angular component did not become ready: ${selector}`);
}

async function navigate(cdp, path, selector, storageEntries) {
  await cdp.send('Page.navigate', { url: `${APP_ORIGIN}${path}` });
  await waitForAngular(cdp, selector, path);
  await evaluate(
    cdp,
    `(() => {
      const entries = ${JSON.stringify(storageEntries)};
      for (const [key, value] of Object.entries(entries)) {
        localStorage.setItem(key, value);
      }
    })()`
  );
}

async function capture(cdp, filename) {
  await cdp.send('Page.bringToFront');
  await evaluate(
    cdp,
    `Promise.all([
      document.fonts?.ready ?? Promise.resolve(),
      new Promise(resolveDelay => setTimeout(resolveDelay, 1_200)),
      new Promise(resolveFrame =>
        requestAnimationFrame(() => requestAnimationFrame(resolveFrame))
      )
    ]).then(() => true)`
  );
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    fromSurface: true
  });
  const outputPath = resolve(FIGURE_DIR, filename);
  await writeFile(outputPath, Buffer.from(data, 'base64'));
  return outputPath;
}

async function composeTargetPanel(targetPath, feedbackPath) {
  const outputPath = resolve(FIGURE_DIR, 'target-intonation-active.png');
  const filter = [
    '[0:v]crop=772:580:0:106[target]',
    '[1:v]split=2[gauge-source][feedback-source]',
    '[gauge-source]crop=772:500:0:220[gauge]',
    '[feedback-source]crop=772:436:0:800[feedback]',
    'color=c=#d9d9d9:s=772x2:d=0.04[separator1]',
    'color=c=#d9d9d9:s=772x2:d=0.04[separator2]',
    '[target][separator1][gauge][separator2][feedback]'
      + 'vstack=inputs=5[out]'
  ].join(';');
  await execFileAsync('ffmpeg', [
    '-loglevel', 'error',
    '-y',
    '-i', targetPath,
    '-i', feedbackPath,
    '-filter_complex', filter,
    '-map', '[out]',
    '-frames:v', '1',
    '-compression_level', '9',
    outputPath
  ]);
  return outputPath;
}

const commonFixtureSource = `
  function createFixturePorts() {
    let nowMs = 1_000;
    let everyCallback = null;
    let everyPeriodMs = 0;
    let nextTimerId = 1;
    const timers = [];
    const observers = [];

    const estimates$ = {
      subscribe(observer) {
        observers.push(observer);
        return {
          unsubscribe() {
            const index = observers.indexOf(observer);
            if (index >= 0) observers.splice(index, 1);
          }
        };
      }
    };

    const fixture = {
      clock: {
        nowMs: () => nowMs,
        after(delayMs, onElapsed) {
          const timer = {
            id: nextTimerId++,
            dueAtMs: nowMs + delayMs,
            onElapsed,
            cancelled: false
          };
          timers.push(timer);
          return { cancel: () => { timer.cancelled = true; } };
        },
        every(periodMs, onTick) {
          everyPeriodMs = periodMs;
          everyCallback = onTick;
          return { cancel: () => { everyCallback = null; } };
        }
      },
      audio: {
        unlockFromUserGesture: async () => {},
        preloadInstrument: async () => {},
        playMetronome: () => ({ stop() {} }),
        playReference: () => ({ stop() {} }),
        stopAll() {}
      },
      pitch: {
        estimates$,
        acquire: async () => ({ release: async () => {} })
      },
      persistence: {
        open: async () => {},
        close: async () => {}
      },
      random: () => 0,
      tick() {
        if (!everyCallback) throw new Error('No periodic callback is active');
        nowMs += everyPeriodMs;
        everyCallback({
          sequence: 0,
          scheduledAtMs: nowMs,
          observedAtMs: nowMs
        });
      },
      fireNextTimer() {
        const timer = timers
          .filter(candidate => !candidate.cancelled)
          .sort((left, right) => left.dueAtMs - right.dueAtMs)[0];
        if (!timer) throw new Error('No deterministic timer is active');
        timer.cancelled = true;
        nowMs = timer.dueAtMs;
        timer.onElapsed(nowMs);
      },
      emit(estimate) {
        nowMs = estimate.capturedAtMs;
        for (const observer of [...observers]) {
          if (typeof observer === 'function') observer(estimate);
          else observer.next?.(estimate);
        }
      }
    };
    return fixture;
  }
`;

const plpFixture = `
  (async () => {
    ${commonFixtureSource}
    const page = ng.getComponent(document.querySelector('app-home'));
    const fixture = createFixturePorts();
    const instrument = page.instruments.fromLegacyId('clarinet');
    const note = instrument.notes.find(
      candidate => candidate.displayTokens.includes('G4')
    );
    if (!note) throw new Error('Clarinet G4 target is unavailable');

    const context = {
      clock: fixture.clock,
      audio: fixture.audio,
      pitch: fixture.pitch,
      notation: page.notation,
      instruments: page.instruments,
      persistence: fixture.persistence,
      random: fixture.random
    };
    const config = {
      instrumentId: instrument.id,
      lowNoteId: note.id,
      highNoteId: note.id,
      lowNoteIndex: note.index,
      highNoteIndex: note.index,
      tempoBpm: 80,
      beatsPerPhase: 4,
      cycles: 12,
      includeAccidentals: false,
      useDynamics: false,
      pitchDisplay: 'target',
      referenceA4Hz: 440
    };

    page.selectedInstrument = 'clarinet';
    await page.activitySession.start(page.controller, config, context);
    for (let index = 0; index < 5; index += 1) fixture.tick();
    page.cdr.detectChanges();
    globalThis.__figure1Fixture = { page, fixture, config };
    return {
      activity: 'prepare-listen-play',
      instrument: instrument.id,
      writtenTarget: note.displayTokens[0],
      phase: page.controller.snapshot$.value.state.phase
    };
  })()
`;

const intonationFixture = `
  (async () => {
    ${commonFixtureSource}
    const page = ng.getComponent(
      document.querySelector('app-target-intonation')
    );
    const fixture = createFixturePorts();
    const instrument = page.instruments.fromLegacyId('trumpet');
    const note = instrument.notes.find(
      candidate => candidate.displayTokens.includes('G4')
    );
    if (!note) throw new Error('Trumpet G4 target is unavailable');

    const context = {
      clock: fixture.clock,
      audio: fixture.audio,
      pitch: fixture.pitch,
      notation: page.notation,
      instruments: page.instruments,
      persistence: fixture.persistence,
      random: fixture.random
    };
    const config = {
      instrumentId: instrument.id,
      lowNoteId: note.id,
      highNoteId: note.id,
      lowNoteIndex: note.index,
      highNoteIndex: note.index,
      includeAccidentals: false,
      referenceA4Hz: 440,
      targetCount: 3,
      playReferenceTone: true,
      targetPresentationMs: 1_000,
      referenceToneDurationMs: 1_000,
      toleranceCents: 10,
      farThresholdCents: 35,
      requiredStableMs: 1_500,
      maximumSpreadCents: 12,
      minimumValidEstimates: 4,
      maximumSignalGapMs: 350,
      attemptTimeoutMs: 10_000,
      maximumAttemptsPerTarget: 3,
      detectorMinimumHz: 140,
      detectorMaximumHz: 2_000
    };

    page.selectedInstrument = 'trumpet';
    await page.activitySession.start(page.controller, config, context);
    fixture.fireNextTimer();
    const presentation = page.controller.snapshot$.value.state;
    const frequencyHz = presentation.target.expectedSoundingFrequencyHz
      * 2 ** (4 / 1_200);
    for (const capturedAtMs of [2_000, 2_300, 2_600, 2_900, 3_200]) {
      fixture.emit({
        kind: 'voiced',
        frequencyHz,
        capturedAtMs,
        emittedAtMs: capturedAtMs
      });
    }
    page.cdr.detectChanges();
    globalThis.__figure1Fixture = { page, fixture, config };
    return {
      activity: 'target-intonation',
      instrument: instrument.id,
      writtenTarget: note.displayTokens[0],
      soundingFrequencyHz: frequencyHz,
      feedback: page.controller.snapshot$.value.state.feedback
    };
  })()
`;

const pageTarget = await findPageTarget();
const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
await cdp.connect();

try {
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 760,
    deviceScaleFactor: 2,
    mobile: true,
    screenWidth: 390,
    screenHeight: 760
  });

  await navigate(cdp, '/home/exercise', 'app-home', {
    selectedInstrument: 'clarinet',
    mode: 'instrument',
    clarinet_lowNote: '15',
    clarinet_highNote: '15',
    tempo: '80',
    refFrequency: '440',
    useFlatsAndSharps: 'false',
    useDynamics: 'false',
    isDarkMode: 'false'
  });
  console.log(await evaluate(cdp, plpFixture));
  console.log(await capture(cdp, 'plp-active-clarinet.png'));

  await navigate(cdp, '/home/intonation', 'app-target-intonation', {
    selectedInstrument: 'trumpet',
    mode: 'instrument',
    trumpet_lowNote: '13',
    trumpet_highNote: '13',
    targetIntonationPlayReference: 'true',
    refFrequency: '440',
    useFlatsAndSharps: 'false',
    isDarkMode: 'false'
  });
  await evaluate(
    cdp,
    `document.querySelector('app-target-intonation ion-content')
      .scrollToPoint(0, 0, 0)
      .then(() => true)`
  );
  console.log(await evaluate(cdp, intonationFixture));
  await evaluate(
    cdp,
    `document.querySelector('app-target-intonation ion-content')
      .scrollToPoint(0, 150, 0)
      .then(() => true)`
  );
  console.log(await evaluate(
    cdp,
    `(async () => {
      const content = document.querySelector(
        'app-target-intonation ion-content'
      );
      const scroll = await content.getScrollElement();
      const target = document.querySelector('.target-panel');
      const gauge = document.querySelector('.gauge-panel');
      return {
        contentCount: document.querySelectorAll(
          'app-target-intonation ion-content'
        ).length,
        scrollTop: scroll.scrollTop,
        scrollHeight: scroll.scrollHeight,
        clientHeight: scroll.clientHeight,
        targetTop: target?.getBoundingClientRect().top,
        gaugeTop: gauge?.getBoundingClientRect().top
      };
    })()`
  ));
  const targetPath = await capture(cdp, 'target-intonation-target.png');
  console.log(targetPath);
  await evaluate(
    cdp,
    `document.querySelector('app-target-intonation ion-content')
      .scrollToPoint(0, 660, 0)
      .then(() => true)`
  );
  const feedbackPath = await capture(
    cdp,
    'target-intonation-feedback.png'
  );
  console.log(feedbackPath);
  console.log(await composeTargetPanel(targetPath, feedbackPath));
} finally {
  cdp.close();
}

describe('Microphone accumulator cleanup', () => {
  let Processor: new () => { process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean; port: { postMessage: jasmine.Spy } };

  beforeAll(async () => {
    const response = await fetch('/assets/audio-accumulator.js');
    expect(response.ok).toBeTrue();
    const source = await response.text();
    // Exercise the shipped worklet with only its browser host interfaces stubbed.
    new Function('AudioWorkletProcessor', 'registerProcessor', source)(
      class { port = { postMessage: jasmine.createSpy('postMessage') }; },
      (_name: string, implementation: typeof Processor) => { Processor = implementation; }
    );
  });

  it('ignores disconnected and empty input without throwing or publishing an invalid frame', () => {
    const processor = new Processor();
    for (const inputs of [[], [[]], [[new Float32Array()]]]) {
      expect(processor.process(inputs, [[new Float32Array(128), new Float32Array(128)]])).toBeTrue();
    }
    expect(processor.port.postMessage).not.toHaveBeenCalled();
  });

  it('preserves mono frames and the existing stereo average', () => {
    const processor = new Processor();
    const output = [new Float32Array(2), new Float32Array(2)];
    processor.process([[new Float32Array([.25, -.5])]], [output]);
    expect([...output[0]]).toEqual([.25, -.5]);
    expect([...processor.port.postMessage.calls.mostRecent().args[0].data]).toEqual([.25, -.5]);
    processor.process([[new Float32Array([.25, -.5]), new Float32Array([.75, .5])]], [output]);
    expect([...processor.port.postMessage.calls.mostRecent().args[0].data]).toEqual([.5, 0]);
  });
});

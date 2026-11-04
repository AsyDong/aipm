import { describe, expect, it, vi } from 'vitest';
import { createBootstrapBridge } from './bridge';

describe('bootstrap communication ownership', () => {
  it('routes commands and messages independently and unsubscribes', () => {
    const channel = createBootstrapBridge(vi.fn());
    const commands = vi.fn();
    const messages = vi.fn();
    const off = channel.bridge.subscribe(messages);
    channel.runtimePort.onCommand(commands);
    channel.bridge.send({ type: 'PAUSE' });
    expect(commands).toHaveBeenCalledExactlyOnceWith({ type: 'PAUSE' });
    expect(messages).not.toHaveBeenCalled();
    channel.runtimePort.publish({ type: 'READY' });
    expect(messages).toHaveBeenCalledExactlyOnceWith({ type: 'READY' });
    off();
    channel.runtimePort.publish({ type: 'READY' });
    expect(messages).toHaveBeenCalledTimes(1);
  });

  it('isolates listener failures and releases both directions on repeated destroy', () => {
    const errors = vi.fn();
    const channel = createBootstrapBridge(errors);
    const listener = vi.fn();
    channel.bridge.subscribe(() => {
      throw new Error('listener');
    });
    channel.bridge.subscribe(listener);
    channel.runtimePort.onCommand(listener);
    channel.runtimePort.publish({ type: 'READY' });
    expect(errors).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    channel.destroy();
    channel.destroy();
    channel.bridge.subscribe(listener);
    channel.runtimePort.onCommand(listener);
    channel.bridge.send({ type: 'RESUME' });
    channel.runtimePort.publish({ type: 'READY' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

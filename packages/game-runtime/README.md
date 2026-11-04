# game-runtime

Owns the temporary Phaser bootstrap canvas, asynchronous initialization cancellation and directional host bridge. React sees only contracts and disposal functions. Phaser imports are lazy so bridge unit tests need no browser.

Canvas removal is immediate; Phaser system disposal uses its public destroy API and completes on the next animation frame. Real-device memory profiling is deferred.

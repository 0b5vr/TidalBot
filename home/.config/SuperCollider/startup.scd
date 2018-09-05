"SC_JACK_DEFAULT_OUTPUTS".setenv(
  "node:left,"
  "node:right,"
);

ServerQuit.add( {
  'FAIL: scsynth quit'.postln;
  1.exit();
}, Server.default );

s.options.numBuffers = 1024 * 32;
s.options.memSize = 8192 * 16;
s.options.maxNodes = 1024 * 32;
s.options.numOutputBusChannels = 2;
s.options.numInputBusChannels = 2;

s.waitForBoot {
  ~dirt = SuperDirt( 2, s );
  s.sync;
  ~dirt.start( 57120, [ 0, 0 ] );
  s.sync;

  ~dirt.loadSoundFiles;   // load samples (path containing a wildcard can be passed in)
  // for example: ~dirt.loadSoundFiles("/Users/myUserName/Dirt/samples/*");
  s.sync;
}
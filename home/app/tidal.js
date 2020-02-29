const cp = require( 'child_process' );

// https://atom.io/packages/tidalcycles
const tidalBootstrap = `
:set -XOverloadedStrings
:set prompt ""
:set prompt-cont ""

import Sound.Tidal.Context

-- total latency = oLatency + cFrameTimespan
tidal <- startTidal (superdirtTarget {oLatency = 0.1, oAddress = "127.0.0.1", oPort = 57120}) (defaultConfig {cFrameTimespan = 1/20})

let p = streamReplace tidal
let hush = streamHush tidal
let list = streamList tidal
let mute = streamMute tidal
let unmute = streamUnmute tidal
let solo = streamSolo tidal
let unsolo = streamUnsolo tidal
let once = streamOnce tidal False
let asap = streamOnce tidal True
let nudgeAll = streamNudgeAll tidal
let setcps = asap . cps
let xfade = transition tidal (Sound.Tidal.Transition.xfadeIn 4)
let xfadeIn t = transition tidal (Sound.Tidal.Transition.xfadeIn t)
let histpan t = transition tidal (Sound.Tidal.Transition.histpan t)
let wait t = transition tidal (Sound.Tidal.Transition.wait t)
let waitT f t = transition tidal (Sound.Tidal.Transition.waitT f t)
let jump = transition tidal (Sound.Tidal.Transition.jump)
let jumpIn t = transition tidal (Sound.Tidal.Transition.jumpIn t)
let jumpIn' t = transition tidal (Sound.Tidal.Transition.jumpIn' t)
let jumpMod t = transition tidal (Sound.Tidal.Transition.jumpMod t)
let mortal lifespan release = transition tidal (Sound.Tidal.Transition.mortal lifespan release)
let interpolate = transition tidal (Sound.Tidal.Transition.interpolate)
let interpolateIn t = transition tidal (Sound.Tidal.Transition.interpolateIn t)
let clutch = transition tidal (Sound.Tidal.Transition.clutch)
let clutchIn t = transition tidal (Sound.Tidal.Transition.clutchIn t)
let anticipate = transition tidal (Sound.Tidal.Transition.anticipate)
let anticipateIn t = transition tidal (Sound.Tidal.Transition.anticipateIn t)
let d1 = p "1"
let d2 = p "2"
let d3 = p "3"
let d4 = p "4"
let d5 = p "5"
let d6 = p "6"
let d7 = p "7"
let d8 = p "8"
let d9 = p "9"
let d10 = p "10"
let d11 = p "11"
let d12 = p "12"
let d13 = p "13"
let d14 = p "14"
let d15 = p "15"
let d16 = p "16"

:set prompt "tidal> "
`;

const Tidal = class {
  constructor () {
    this.listeners = {}; // e.g.: { "stdout": [ func, func ], "stderr": [ func ] }

    this.dead = false;

    // == setup sclang =========================================================
    this.cpSc = cp.spawn( 'sclang' );

    this.cpSc.stderr.on( 'data', ( data ) => {
      this.emit( 'sc-stderr', data.toString( 'utf8' ) );
    } );

    this.cpSc.stdout.on( 'data', ( data ) => {
      this.emit( 'sc-stdout', data.toString( 'utf8' ) );
    } );

    // == setup ghci ===========================================================
    this.cpGhci = cp.spawn( 'ghci', [ '-XOverloadedStrings' ] );

    this.cpGhci.stderr.on( 'data', ( data ) => {
      this.emit( 'tidal-stderr', data.toString( 'utf8' ) );
    } );

    this.cpGhci.stdout.on( 'data', ( data ) => {
      this.emit( 'tidal-stdout', data.toString( 'utf8' ) );
    } );

    // == execute bootup commands ==============================================
    tidalBootstrap.split( '\n' ).map( ( line ) => {
      this.sendLine( line );
    } );

    // == ready! ===============================================================
    this.emit( 'ready' );

    // == chunky tidal stdout ==================================================
    {
      let str = '';
      let date = 0;

      const append = ( msg ) => {
        str += msg;
        str = str.replace( /Prelude Sound\.Tidal\.Context\| /g, '' );

        date = Date.now();
      };

      this.on( 'tidal-stdout', append );
      this.on( 'tidal-stderr', append );

      const update = () => {
        if ( str !== '' && date < Date.now() - 400 ) {
          this.emit( 'log', str );
          str = '';
        }
        setTimeout( update, 100 );
      };
      update();
    }

    // == sc stdout logger =====================================================
    this.scLog = '';
    {
      const append = ( msg ) => {
        this.scLog += msg;

        const lines = this.scLog.split( '\n' );
        if ( 10 < lines.length ) {
          this.scLog = lines.splice( lines.length - 10 ).join( '\n' )
        }

        if ( 1000 < this.scLog.length ) {
          this.scLog = '...' + this.scLog.substring( this.scLog.length - 1000 );
        }
      };

      this.on( 'sc-stdout', append );
      this.on( 'sc-stderr', append );
    }
  }

  kill () {
    this.cpSc.kill();
    this.cpGhci.kill();
    this.dead = true;

    this.emit( 'kill' );
  }

  sendLine ( line ) {
    if ( this.dead ) { return; }

    this.cpGhci.stdin.write( line );
    this.cpGhci.stdin.write( '\n' );
  }

  evaluate ( code ) {
    if ( this.dead ) { return; }

    this.sendLine( ':{' );
    code.split( '\n' ).map( ( line ) => this.sendLine( line ) );
    this.sendLine( ':}' );
  }

  hush () {
    if ( this.dead ) { return; }

    this.evaluate( 'hush' );
    this.emit( 'hush' );
  }

  getScLog () {
    return this.scLog;
  }

  emit ( name, ...val ) {
    if ( !this.listeners[ name ] ) { return; }

    this.listeners[ name ].map( ( func ) => func( val ) );
  }

  on ( name, func ) {
    if ( !this.listeners[ name ] ) {
      this.listeners[ name ] = [];
    }

    this.listeners[ name ].push( func );
  }

  off ( name, func ) {
    if ( !this.listeners[ name ] ) { return; }

    const index = this.listeners[ name ].indexOf( func );
    if ( index !== -1 ) {
      this.listeners[ name ].splice( index, 1 );
    }
  }
};

module.exports = Tidal;
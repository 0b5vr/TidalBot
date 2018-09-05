const cp = require( 'child_process' );

const tidalBootstrap = `
:set -XOverloadedStrings
:set prompt ""
:module Sound.Tidal.Context
(cps, getNow) <- bpsUtils
(d1,t1) <- superDirtSetters getNow
(d2,t2) <- superDirtSetters getNow
(d3,t3) <- superDirtSetters getNow
(d4,t4) <- superDirtSetters getNow
(d5,t5) <- superDirtSetters getNow
(d6,t6) <- superDirtSetters getNow
(d7,t7) <- superDirtSetters getNow
(d8,t8) <- superDirtSetters getNow
(d9,t9) <- superDirtSetters getNow
let bps x = cps (x/2)
let hush = mapM_ ($ silence) [d1,d2,d3,d4,d5,d6,d7,d8,d9]
let solo = (>>) hush
let replicator text1 = [putStr (text1) | x <- replicate 3000 text1]
let flood text2 = sequence_(replicator text2)
:set prompt "Tidal> "
`;

const Tidal = class {
  constructor () {
    this.listeners = {}; // e.g.: { "stdout": [ func, func ], "stderr": [ func ] }

    this.dead = false;

    // == setup sclang =========================================================
    let cpSc = cp.spawn( 'sclang' );

    cpSc.stderr.on( 'data', ( data ) => {
      const msg = data.toString( 'utf8' );
      this.emit( 'sc-stderr', msg );
    } );

    cpSc.stdout.on( 'data', ( data ) => {
      const msg = data.toString( 'utf8' );
      this.emit( 'sc-stdout', msg );
    } );

    this.cpSc = cpSc;

    // == setup ghci =========================================================
    let cpGhci = cp.spawn( 'ghci', [ '-XOverloadedStrings' ] );

    cpGhci.stderr.on( 'data', ( data ) => {
      const msg = data.toString( 'utf8' );
      this.emit( 'tidal-stderr', msg );
    } );

    cpGhci.stdout.on( 'data', ( data ) => {
      const msg = data.toString( 'utf8' );
      this.emit( 'tidal-stdout', msg );
    } );

    this.cpGhci = cpGhci;

    // == execute bootup commands ============================================
    tidalBootstrap.split( '\n' ).map( ( line ) => {
      this.sendLine( line );
    } );

    // == ready! =============================================================
    this.emit( 'ready' );

    // == chunky tidal stdout ================================================
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

        let lines = this.scLog.split( '\n' );
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
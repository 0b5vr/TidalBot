const cp = require( 'child_process' );

const Tidal = class {
  constructor() {
    this.listeners = {}; // e.g.: { "stdout": [ func, func ], "stderr": [ func ] }

    this.evalQueue = []; // codes being sent before init

    this.isReady = false;

    // == chunky tidal stdout ======================================================================
    {
      let str = '';
      let date = 0;

      const append = ( msg ) => {
        str += msg;
        str = str.replace( /Prelude Sound\.Tidal\.Context\| System.IO\| /g, '' );

        date = Date.now();
      };

      this.on( 'ghci-stdout', append );
      this.on( 'ghci-stderr', append );

      const update = () => {
        if ( str !== '' && date < Date.now() - 400 ) {
          this.emit( 'log', str );
          str = '';
        }
        setTimeout( update, 100 );
      };
      update();
    }

    // == sc stdout logger =========================================================================
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

  start( bootTidalPath ) {
    // == setup sclang =============================================================================
    const cpSc = cp.spawn( 'sclang' );

    cpSc.stderr.on( 'data', ( data ) => {
      process.stderr.write( data );
      this.emit( 'sc-stderr', data.toString( 'utf8' ) );
    } );

    cpSc.stdout.on( 'data', ( data ) => {
      process.stdout.write( data );
      this.emit( 'sc-stdout', data.toString( 'utf8' ) );
    } );

    this.cpSc = cpSc;

    // == setup ghci ===============================================================================
    const cpGhci = cp.spawn(
      'stack',
      [ 'exec', '--package', 'tidal', '--', 'ghci' ],
      { cwd: __dirname }
    );

    cpGhci.stderr.on( 'data', ( data ) => {
      process.stderr.write( data );
      this.emit( 'ghci-stderr', data.toString( 'utf8' ) );
    } );

    cpGhci.stdout.on( 'data', ( data ) => {
      process.stdout.write( data );
      this.emit( 'ghci-stdout', data.toString( 'utf8' ) );
    } );

    this.cpGhci = cpGhci;

    // == ready! ===================================================================================
    this.isReady = true;
    this.emit( 'ready' );

    // == execute BootTidal ========================================================================
    this.sendLine( `:script ${bootTidalPath}` );

    // == evaluate evalQueue =======================================================================
    this.evalQueue.forEach( ( code ) => this.evaluate( code ) );
    this.evalQueue = [];
  }

  stop() {
    this.isReady = false;

    this.cpGhci.stdin.write( ':quit\n' );
    this.cpGhci = null;

    this.cpSc.stdin.write( '0.exit\n' );
    this.cpSc = null;

    this.emit( 'stop' );
  }

  kill() {
    this.isReady = false;

    this.cpSc.kill();
    this.cpSc = null;

    this.cpGhci.kill();
    this.cpGhci = null;

    this.emit( 'stop' );
  }

  sendLine( line ) {
    if ( !this.isReady ) {
      console.warn( 'Tidal: ignoring sendLine because it is not ready' );
      return;
    }

    this.cpGhci.stdin.write( line );
    this.cpGhci.stdin.write( '\n' );
  }

  evaluate( code ) {
    if ( !this.isReady ) {
      this.evalQueue.push( code );
      return;
    }

    this.sendLine( ':{' );
    code.split( '\n' ).map( ( line ) => this.sendLine( line ) );
    this.sendLine( ':}' );
  }

  hush() {
    if ( !this.isReady ) {
      console.warn( 'Tidal: ignoring hush because it is not ready' );
      return;
    }

    this.evaluate( 'hush' );
    this.emit( 'hush' );
  }

  getScLog() {
    return this.scLog;
  }

  emit( name, ...val ) {
    if ( !this.listeners[ name ] ) { return; }

    this.listeners[ name ].map( ( func ) => func( val ) );
  }

  on( name, func ) {
    if ( !this.listeners[ name ] ) {
      this.listeners[ name ] = [];
    }

    this.listeners[ name ].push( func );
  }

  off( name, func ) {
    if ( !this.listeners[ name ] ) { return; }

    const index = this.listeners[ name ].indexOf( func );
    if ( index !== -1 ) {
      this.listeners[ name ].splice( index, 1 );
    }
  }
};

module.exports = Tidal;

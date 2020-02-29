const cp = require( 'child_process' );

const Tidal = class {
  constructor ( bootPath ) {
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
    this.cpGhci = cp.spawn(
      'stack',
      [ 'ghci' ],
      { cwd: __dirname }
    );

    this.cpGhci.stderr.on( 'data', ( data ) => {
      process.stderr.write( data );
      this.emit( 'tidal-stderr', data.toString( 'utf8' ) );
    } );

    this.cpGhci.stdout.on( 'data', ( data ) => {
      process.stdout.write( data );
      this.emit( 'tidal-stdout', data.toString( 'utf8' ) );
    } );

    // == execute bootup commands ==============================================
    this.sendLine( `:script ${bootPath}` );

    // == ready! ===============================================================
    this.emit( 'ready' );

    // == chunky tidal stdout ==================================================
    {
      let str = '';
      let date = 0;

      const append = ( msg ) => {
        str += msg;
        str = str.replace( /Prelude Sound\.Tidal\.Context\| System.IO\| /g, '' );

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
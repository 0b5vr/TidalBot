const { Readable } = require( 'stream' );
const jack = require( './jack-audio' );

const BUFFER_SIZE = Math.pow( 2, 16 );
const CHUNK_SIZE = 256;

const Streamer = class {
  constructor() {
    // == setup jack ===============================================================================
    this.iRead = 0;
    this.iWrite = 0;
    this.queueSize = 0;
    this.buffer = new Int16Array( BUFFER_SIZE );

    const streamer = this;

    this.stream = new Readable( {
      read( size ) {
        for ( let i = 0; i < size / 2 / CHUNK_SIZE; i ++ ) {
          if ( CHUNK_SIZE < streamer.queueSize ) {
            this.push( Buffer.from( streamer.buffer.buffer, streamer.iRead * 2, CHUNK_SIZE * 2 ) );

            streamer.iRead = ( streamer.iRead + CHUNK_SIZE ) % BUFFER_SIZE;
            streamer.queueSize -= CHUNK_SIZE;

            // fast forward by 2x
            if ( BUFFER_SIZE * 0.75 < streamer.queueSize ) {
              streamer.iRead = ( streamer.iRead + CHUNK_SIZE ) % BUFFER_SIZE;
              streamer.queueSize -= CHUNK_SIZE;
            }
          } else {
            this.push( Buffer.alloc( CHUNK_SIZE * 2 ) );
          }
        }
      }
    } );

    jack.bind( ( nFrames, buffer ) => {
      for ( let i = 0; i < nFrames; i ++ ) {
        if ( BUFFER_SIZE <= this.queueSize ) { break; }
        this.buffer[ this.iWrite + 0 ] = parseInt( buffer[ 0 ][ i ] * 32767 );
        this.buffer[ this.iWrite + 1 ] = parseInt( buffer[ 1 ][ i ] * 32767 );
        this.iWrite = ( this.iWrite + 2 ) % BUFFER_SIZE;
        this.queueSize += 2;
      }
    } );
  }

  start( clientName ) {
    jack.start( clientName );
  }

  stop() {
    jack.close();

    this.iRead = 0;
    this.iWrite = 0;
    this.queueSize = 0;
  }
}

module.exports = Streamer;

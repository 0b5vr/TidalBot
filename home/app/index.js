const path = require( 'path' );

// == setup discord ============================================================
const Discord = require( 'discord.js' );
const client = new Discord.Client();

client.on( 'ready', () => {
  console.log( 'Discord bot is working!' );
  client.user.setPresence( {
    status: 'idle'
  } );
} );

let lastTextChannel = null;
let currentConnection = null;

// == setup jack ===============================================================
const BUFFER_SIZE = Math.pow( 2, 16 );
const CHUNK_SIZE = 256;

let streamReadIndex = 0;
let streamWriteIndex = 0;
let streamBufferSize = 0;
const streamBuffer = new Int16Array( BUFFER_SIZE );

const stream = new require( 'stream' ).Readable( {
  read( size ) {
    for ( let i = 0; i < size / 2 / CHUNK_SIZE; i ++ ) {
      if ( CHUNK_SIZE < streamBufferSize ) {
        this.push( Buffer.from( streamBuffer.buffer, streamReadIndex * 2, CHUNK_SIZE * 2 ) );

        streamReadIndex = ( streamReadIndex + CHUNK_SIZE ) % BUFFER_SIZE;
        streamBufferSize -= CHUNK_SIZE;

        // fast forward
        if ( BUFFER_SIZE * 0.75 < streamBufferSize ) {
          streamReadIndex = ( streamReadIndex + CHUNK_SIZE ) % BUFFER_SIZE;
          streamBufferSize -= CHUNK_SIZE;
        }
      } else {
        this.push( Buffer.alloc( CHUNK_SIZE * 2 ) );
      }
    }
  }
} );

const jack = require( './jack-audio' );
jack.bind( ( nFrames, buffer ) => {
  for ( let i = 0; i < nFrames; i ++ ) {
    if ( BUFFER_SIZE <= streamBufferSize ) { break; }
    streamBuffer[ streamWriteIndex + 0 ] = parseInt( buffer[ 0 ][ i ] * 32767 );
    streamBuffer[ streamWriteIndex + 1 ] = parseInt( buffer[ 1 ][ i ] * 32767 );
    streamWriteIndex = ( streamWriteIndex + 2 ) % BUFFER_SIZE;
    streamBufferSize += 2;
  }
} );
jack.start( 'node' );

// == setup tidal ==============================================================
const Tidal = require( './tidal' );
const tidal = new Tidal( path.resolve( __dirname, 'BootTidal.hs' ) );

// == log handler ==============================================================
tidal.on( 'log', ( msg ) => {
  if ( lastTextChannel ) {
    lastTextChannel.send( `\`\`\`\n${msg}\n\`\`\`` );
  }
} );

// == sclog handler ============================================================
const scLogHandler = ( msg ) => {
  if ( msg.toString().includes( 'sc-log' ) ) {
    msg.channel.send(
      `🌀 SuperCollider stdout / stderr:\n\`\`\`\n${ tidal.getScLog() }\n\`\`\``
    );
    return true;
  }
  return false;
};

// == uh =======================================================================
/**
 * @param {Discord.Message} msg
 */
const messageHandler = ( msg ) => {
  const mentioned = msg.mentions.users.some( ( u ) => u.id === client.user.id );
  if ( !mentioned ) { return; }

  lastTextChannel = msg.channel;

  if ( scLogHandler( msg ) ) { return; }

  const str = msg.toString();
  const match = str.match( /```\s*([\S\s]+?)\s*```/m );

  if ( !match ) {
    msg.reply( '\n🤔 Unrecognized. Make sure your code is inside of a code block (use triple backquotes)!' );
    return;
  }

  const code = match[ 1 ];
  console.log( code );

  // temp: to prevent dangerous things
  if ( code.includes( 'import' ) ) {
    msg.reply( '\n<@232233105040211969>' );
    return;
  }

  // it cannot be in two servers at once
  const guild = msg.guild;
  if ( currentConnection?.channel.guild !== msg.guild ) {
    msg.reply( '\n🙇 I\'m currently on an another server!' );
    return;
  }

  if ( !currentConnection ) {
    const user = msg.author;

    let nope = true;
    guild.channels.cache.map( ( ch ) => {
      if (
        ch.speakable && ch.joinable
        && ch.members.some( ( u ) => u.id === user.id )
      ) {
        nope = false;
        ch.join().then( ( conn ) => {
          currentConnection = conn;
          msg.reply( `\n🛰 I joined to ${currentConnection.channel} !` );
          client.user.setPresence( {
            game: { name: 'TidalCycles' },
            status: 'online'
          } );

          // == stream audio ===================================================
          currentConnection.play( stream, { type: 'converted', volume: false, highWaterMark: 1 } );

          // == when all members left... =======================================
          const update = () => {
            const isAnyoneThere = ch.members.some(
              ( u ) => u.id !== client.user.id
            );

            if ( !isAnyoneThere ) {
              if ( lastTextChannel ) {
                lastTextChannel.send( '👋 All users left, bye' );
                lastTextChannel = null;
                tidal.hush();
              }

              currentConnection.disconnect();
              currentConnection = null;
              client.user.setPresence( {
                status: 'idle'
              } );
            }

            if ( currentConnection ) {
              setTimeout( update, 5000 );
            }
          };
          update();
        } );
      }
    } );

    if ( nope ) {
      msg.reply( '\n🤔 You seem not to be in any VC???' );
      return;
    }
  }

  tidal.evaluate( code );
};

client.on( 'message', ( msg ) => messageHandler( msg ) );
client.on( 'messageUpdate', ( _, msg ) => messageHandler( msg ) );

client.login( process.env.TIDALBOT_TOKEN );
process.on( 'SIGTERM', () => {
  client.destroy().then( () => {
    process.exit();
  } );
} );
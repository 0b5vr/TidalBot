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
const jack = require( 'jack-connector' );

const BUFFER_LENGTH = 65536;
const streamArray = [];

const stream = new require( 'stream' ).Readable( {
  read( size ) {
    if ( size / 2 < streamArray.length ) {
      this.push( Buffer.from(
        new Int16Array( streamArray.splice( 0, size / 2 ) ).buffer
      ) );
    } else {
      this.push( Buffer.alloc( size ) );
    }
  }
} );

jack.openClientSync( 'node' );
jack.registerInPortSync( 'left' );
jack.registerInPortSync( 'right' );

jack.bindProcessSync( ( error, nFrames, capture ) => {
  for ( let i = 0; i < nFrames; i ++ ) {
    if ( BUFFER_LENGTH <= streamArray.length ) { break; }
    streamArray.push( parseInt( capture.left[ i ] * 32767 ) );
    streamArray.push( parseInt( capture.right[ i ] * 32767 ) );
  }
} );

jack.activateSync();

// == setup tidal ==============================================================
const Tidal = require( './tidal' );
let tidal = new Tidal();

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
const messageHandler = ( msg ) => {
  lastTextChannel = msg.channel;
  const mentioned = msg.mentions.users.some( ( u ) => u.id === client.user.id );
  if ( !mentioned ) { return; }

  if ( scLogHandler( msg ) ) { return; }

  const str = msg.toString();
  const match = str.match( /```\s*([\S\s]+?)\s*```/m );
  if ( !match ) { return; }

  const code = match[ 1 ];
  console.log( code );

  const guild = msg.guild;
  if ( !currentConnection ) {
    const user = msg.author;

    let nope = true;
    guild.channels.map( ( ch ) => {
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
          currentConnection.playConvertedStream( stream );

          // == when all members left... =======================================
          let update = () => {
            let isAnyoneThere = ch.members.some(
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
  } else if ( currentConnection.channel.guild !== msg.guild ) {
    msg.reply( '\n🙇 I\'m currently on an another server!' );
    return;
  }

  tidal.evaluate( code );
};

client.on( 'message', ( msg ) => messageHandler( msg ) );
client.on( 'messageUpdate', ( _, msg ) => messageHandler( msg ) );

client.login( 'NDYxOTE1MzA1NTUyMzc5OTA0.DhaPww.iDr9SAbbo4aPqOIw_5rW14IscqY' );
process.on( 'SIGTERM', () => {
  client.destroy().then( () => {
    process.exit();
  } );
} );
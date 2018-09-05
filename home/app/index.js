const Discord = require( 'discord.js' );
const client = new Discord.Client();

const lame = require( 'lame' );
const icy = require( 'icy' );

const Tidal = require( './tidal' );
let tidal = new Tidal();
let lastTextChannel = null;
let currentConnecton = null;

// == setup discord ============================================================
client.on( 'ready', () => {
  console.log( 'Discord bot is working!' );
  client.user.setPresence( {
    status: 'idle'
  } );
} );

// == log handler ==============================================================
tidal.on( 'log', ( msg ) => {
  if ( lastTextChannel ) {
    lastTextChannel.send( `\`\`\`\n${msg}\n\`\`\`` );
  }
} );

// == sclog handler ============================================================
const scLogHandler = ( msg ) => {
  if ( msg.toString() === 'tidal-sc-log' ) {
    console.log(tidal.getScLog());
    msg.channel.send( `🌀 SuperCollider stdout / stderr:\n\`\`\`\n${tidal.getScLog()}\n\`\`\`` );
    return true;
  }
  return false;
};

// == uh =======================================================================
const messageHandler = ( msg ) => {
  lastTextChannel = msg.channel;
  const str = msg.toString();

  if ( scLogHandler( msg ) ) { return; }

  const match = str.match( /^tidal\s*```\s*([\S\s]+?)\s*```$/m );
  if ( !match ) { return; }

  const code = match[ 1 ];
  console.log( code );

  const guild = msg.guild;
  if ( !currentConnecton ) {
    const user = msg.author;

    let nope = true;
    guild.channels.map( ( ch ) => {
      if (
        ch.speakable && ch.joinable
        && ch.members.some( ( u ) => u.id === user.id )
      ) {
        nope = false;
        ch.join().then( ( conn ) => {
          currentConnecton = conn;
          msg.reply( `\n🛰 I joined to ${currentConnecton.channel} !` );
          client.user.setPresence( {
            game: { name: 'TidalCycles' },
            status: 'online'
          } );

          // == stream audio ===================================================
          let decoder = new lame.Decoder();
          icy.get( 'http://localhost:8000/stream.mp3', ( res ) => {
            currentConnecton.playStream( res );
          } );

          // == when all members left... =======================================
          let update = () => {
            let isAnyoneThere = ch.members.some( ( u ) => u.id !== client.user.id );
            if ( !isAnyoneThere ) {
              if ( lastTextChannel ) {
                lastTextChannel.send( '👋 All users left, bye' );
                lastTextChannel = null;
                tidal.hush();
              }

              currentConnecton.disconnect();
              currentConnecton = null;
              client.user.setPresence( {
                status: 'idle'
              } );
            }

            if ( currentConnecton ) {
              setTimeout( update, 10000 );
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
  } else if ( currentConnecton.channel.guild !== msg.guild ) {
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
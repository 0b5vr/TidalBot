const path = require( 'path' );
const Streamer = require( './streamer' );
const Tidal = require( './tidal' );

// == setup discord ================================================================================
const Discord = require( 'discord.js' );
const client = new Discord.Client();

client.on( 'ready', () => {
  console.log( 'Discord bot is working!' );
  client.user.setPresence( {
    status: 'idle'
  } );
} );

client.on( 'error', ( error ) => {
  console.error( 'An error occurred while starting Discord bot:' );
  console.error( error );

  client.destroy();
  process.exit();
} );

let lastTextChannel = null;
let currentConnection = null;

// == setup streamer ===============================================================================
const streamer = new Streamer();
const jackClientName = 'node';

// == setup tidal ==================================================================================
const tidal = new Tidal();
const bootTidalPath =  path.resolve( __dirname, 'BootTidal.hs' ) ;

// == log handler ==================================================================================
tidal.on( 'log', ( msg ) => {
  if ( lastTextChannel ) {
    lastTextChannel.send( `\`\`\`\n${msg}\n\`\`\`` );
  }
} );

// == sclog handler ================================================================================
const scLogHandler = ( msg ) => {
  if ( msg.toString().includes( 'sc-log' ) ) {
    msg.channel.send(
      `🌀 SuperCollider stdout / stderr:\n\`\`\`\n${ tidal.getScLog() }\n\`\`\``
    );
    return true;
  }
  return false;
};

// == uh ===========================================================================================
/**
 * @param {Discord.Message} msg
 */
const messageHandler = async ( msg ) => {
  const mentioned = msg.mentions.users.some( ( u ) => u.id === client.user.id );
  if ( !mentioned ) { return; }

  // remove previous reactions
  await Promise.all(
    msg.reactions.cache.map( async ( reaction ) => {
      if ( reaction.users.cache.has( client.user.id ) ) {
        await reaction.users.remove( client.user.id );
      }
    } )
  );

  if ( scLogHandler( msg ) ) { return; }

  const str = msg.toString();
  const match = str.match( /```\s*([\S\s]+?)\s*```/m );

  if ( !match ) {
    msg.reply( '\n🤔 Unrecognized. Make sure your code is inside of a code block (use triple backquotes)!' );
    msg.react( '🤔' );
    return;
  }

  const code = match[ 1 ];
  console.log( `${ msg.author.tag }: ${ code }` );

  // temp: to prevent dangerous things
  if ( code.includes( 'import' ) ) {
    msg.reply( '\n<@232233105040211969>' );
    msg.react( '🚨' );
    return;
  }

  // it cannot be in two servers at once
  const guild = msg.guild;
  if ( currentConnection && currentConnection.channel.guild !== msg.guild ) {
    msg.reply( '\n🙇 I\'m currently on an another server!' );
    msg.react( '🙇' );
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

          currentConnection.on( 'disconnect', () => {
            tidal.stop();
            streamer.stop();
          } );

          // == stream audio =======================================================================
          streamer.start( jackClientName );
          tidal.start( bootTidalPath );
          currentConnection.play(
            streamer.stream,
            { type: 'converted', volume: false, highWaterMark: 1 },
          );

          // == when all members left... ===========================================================
          const update = () => {
            const isAnyoneThere = ch.members.some(
              ( u ) => u.id !== client.user.id
            );

            if ( !isAnyoneThere ) {
              if ( lastTextChannel ) {
                lastTextChannel.send( '👋 All users left, bye' );
                lastTextChannel = null;
              }

              tidal.hush();

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
      msg.react( '🤔' );
      return;
    }
  }

  lastTextChannel = msg.channel;

  tidal.evaluate( code );
  msg.react( '✅' );
};

client.on( 'message', ( msg ) => messageHandler( msg ) );
client.on( 'messageUpdate', ( _, msg ) => messageHandler( msg ) );

client.login( process.env.TIDALBOT_TOKEN );
process.on( 'SIGTERM', () => {
  console.log( 'SIGTERM received' );

  tidal.stop();
  streamer.stop();

  client.destroy();
  process.exit();
} );

/**
 * Parse messages and extract code.
 *
 * @param {string} msg a raw string
 * @returns {string} code
 */
function parseMessage( str ) {
  const matchTripleBackquoteHs = str.match( /```hs\s*([\S\s]+?)\s*```/m );
  if ( matchTripleBackquoteHs ) {
    return matchTripleBackquoteHs[ 1 ];
  }

  const matchTripleBackquote = str.match( /```\s*([\S\s]+?)\s*```/m );
  if ( matchTripleBackquote ) {
    return matchTripleBackquote[ 1 ];
  }

  const matchSingleBackquote = str.match( /`\s*([\S\s]+?)\s*`/m );
  if ( matchSingleBackquote ) {
    return matchSingleBackquote[ 1 ];
  }

  return str;
}

module.exports = parseMessage;

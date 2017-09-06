import R from 'ramda';
import { fromJS } from 'immutable';
import flyd from 'flyd';
import fetch from 'isomorphic-fetch';
import websocket from './flyd-websocket';

/**
 * Connects to a sK server, and returns websocket URL & initial state.
 *
 * @param {string} url
 * @returns {Promise<[ websocketUrl, initialState ]>}
 */
const lookup = async url => {
  const {
    'signalk-http': httpUrl,
    'signalk-ws': wsUrl
  } = await R.composeP(
    R.path(['endpoints', 'v1']),
    R.invoker(0, 'json'),
    fetch
  )(url);
  const initial = await R.composeP(
    fromJS,
    R.invoker(0, 'json'),
    fetch
  )(httpUrl);
  return [ wsUrl, initial ];
};

/**
 * Converts a Signal K path to an array
 *
 * @param {string} path
 * @returns {array}
 */
const getPath = R.memoize(R.split('.'));

/**
 * Apply delta message to state
 *
 * @param {immutable.Map} state
 * @param {Object} message
 * @returns {immutable.Map} new state
 */
const update = (state, {
  updates = [],
  context = 'self'
}) => R.compose(
  R.reduce(
    (state, update) => state.setIn(...update),
    state
  ),
  R.chain(R.compose(
    R.map(
      ({ path, value }) => [
        [ ...getPath(context), ...getPath(path), 'value' ],
        fromJS(value)
      ]
    ),
    R.prop('values')
  ))
)(updates);

/**
 * Connects to a Signal K delta endpoint, and streams immutable states.
 * Accepts a flyd stream for sending data back to the delta endpoint.
 *
 * @param {string} serverUrl
 * @param {object} options
 * @param {flyd.stream} [options.writeStream=flyd.stream] outgoing data stream
 * @returns {flyd.stream<immutable.Map>}
 */
const kumara = (serverUrl, {
  subscribe = 'all',
  writeStream = flyd.stream()
} = {}) => {
  const readStream = flyd.stream();
  lookup(serverUrl).then(
    ([ wsUrl, initial ]) => R.compose(
      flyd.map(readStream),
      flyd.scan(update, initial),
      flyd.map(JSON.parse),
      websocket
    )(
      wsUrl + '?subscribe=' + subscribe,
      undefined,
      writeStream.map(JSON.stringify)
    )
  );
  return readStream;
};

export {
  lookup,
  getPath,
  update
};
export default kumara;

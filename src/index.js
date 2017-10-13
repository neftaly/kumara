import {
  compose,
  composeP,
  path,
  invoker,
  split,
  reduce,
  chain,
  map,
  prop
} from 'ramda';
import { fromJS } from 'immutable';
import flyd from 'flyd';
import fetch from 'isomorphic-fetch';
import websocket from './flyd-websocket';
import memoizee from 'memoizee';

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
  } = await composeP(
    path(['endpoints', 'v1']),
    invoker(0, 'json'),
    fetch
  )(url);
  const initial = await composeP(
    fromJS,
    invoker(0, 'json'),
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
const getPath = memoizee(split('.'));

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
}) => compose(
  reduce(
    (state, update) => state.setIn(...update),
    state
  ),
  chain(compose(
    map(
      ({ path, value }) => [
        [ ...getPath(context), ...getPath(path), 'value' ],
        fromJS(value)
      ]
    ),
    prop('values')
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
    ([ wsUrl, initial ]) => compose(
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

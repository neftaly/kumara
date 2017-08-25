import R from 'ramda';
import flyd from 'flyd';
import filter from 'flyd/module/filter';
import { fromJS, Seq, List } from 'immutable';
import WebSocket from 'universal-websocket-client';

/**
 * Converts a Signal K path to an immutable Seq
 *
 * @param {string} path
 * @returns {immutable.Seq.Indexed}
 */
const pathToSeq = R.memoize(
  R.compose(
    R.constructN(1, Seq),
    R.filter(R.identity),
    R.split('.')
  )
);

/**
 * Apply delta message to state
 *
 * @curried
 * @param {immutable.Map} [message=empty]
 * @param {immutable.Map} state
 * @returns {immutable.Map} new state
 */
const update = R.curry(
  (message, state) => message.get(
    'updates',
    new List()
  ).flatMap(
    update => update.get(
      'values'
    ).map(
      value => [
        pathToSeq(
          message.get('context', 'self')
        ).concat(
          pathToSeq(value.get('path'))
        ),
        value.get('value')
      ]
    )
  ).reduce(
    (state, update) => state.setIn(...update),
    state
  )
);

/**
 * Connects to an endpoint, and returns a stream of single-update deltas.
 * Messages can be sent to the endpoint via the write stream.
 *
 * @param {string} url
 * @param {flyd.stream} writeStream outgoing data stream
 * @returns {flyd.stream<immutable.Map>}
 */
const connection = (url, writeStream) => {
  const readStream = flyd.stream();
  const socket = new WebSocket(url);
  socket.addEventListener('message', R.compose(
    readStream,
    fromJS,
    JSON.parse,
    R.prop('data')
  ));
  socket.addEventListener('close', () => readStream.end(true));
  flyd.on(() => socket.close(), writeStream.end);
  flyd.on(() => socket.close(), readStream.end);
  writeStream.map(JSON.parse).map(socket.send);
  return readStream;
};

/**
 * Apply messages to state object
 *
 * @curried
 * @param {boolean} statistics
 * @param {immutable.Map} [state=immutable.Map]
 * @param {Object[]} details
 * @param {string} details[].direction sent or received
 * @param {immutable.Map} details[].message
 * @returns {immutable.Map}
 */
const applyMessage = R.curry(
  (statistics, state, [direction, message]) => R.compose(
    direction === 'received'
      ? update(message)
      : R.identity,
    statistics
      ? state => state.updateIn(['statistics', direction], R.add(1))
      : R.identity,
    R.when(
      R.isNil,
      () => fromJS({
        server: message,
        statistics: statistics
          ? { errors: 0, sent: 0, received: 0 }
          : undefined
      })
    )
  )(state)
);

/**
 * Connects to a Signal K delta endpoint, and streams immutable states.
 * Accepts a flyd stream for sending data back to the delta endpoint.
 *
 * @param {string} url
 * @param {object} options
 * @param {flyd.stream} [options.writeStream=flyd.stream] outgoing data stream
 * @param {boolean} [options.statistics=true] add statistics object
 * @returns {flyd.stream<immutable.Map>}
 */
const kumara = (url, {
  writeStream = flyd.stream(),
  statistics = true
} = {}) => R.compose(
  R.tap(s => flyd.on(writeStream.end, s.end)), // TODO: Find a cleaner approach to connect stream.ends
  filter(R.identity),
  flyd.scan(
    applyMessage(statistics),
    undefined
  ),
  readStream => flyd.merge(
    writeStream.map(m => ['sent', m]),
    readStream.map(m => ['received', m])
  ),
  connection
)(
  url,
  writeStream
);

export {
  pathToSeq,
  update,
  connection,
  applyMessage
};
export default kumara;
